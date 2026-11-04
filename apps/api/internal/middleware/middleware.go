package middleware

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"lumina/api/internal/apperror"
	"lumina/api/internal/auth"
	"lumina/api/internal/models"
)

const UserKey = "lumina.user"
const RequestIDKey = "lumina.request_id"

type UserLookup interface {
	UserByID(ctx context.Context, id models.ID) (*models.User, error)
}

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := strings.TrimSpace(c.GetHeader("X-Request-ID"))
		if len(id) == 0 || len(id) > 100 {
			id = uuid.NewString()
		}
		c.Set(RequestIDKey, id)
		c.Header("X-Request-ID", id)
		c.Next()
	}
}

func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		if c.Request.TLS != nil {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		c.Next()
	}
}

func CORS(allowlist []string) gin.HandlerFunc {
	allowed := map[string]bool{}
	for _, origin := range allowlist {
		allowed[origin] = true
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && allowed[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Max-Age", "600")
		}
		if c.Request.Method == http.MethodOptions {
			if origin != "" && !allowed[origin] {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func RequireAuth(users UserLookup, tokens *auth.TokenManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
			abort(c, apperror.Unauthorized("TOKEN_REQUIRED", "请提供有效的登录凭证"))
			return
		}
		claims, err := tokens.Parse(strings.TrimSpace(parts[1]))
		if err != nil {
			abort(c, err)
			return
		}
		id, err := strconv.ParseInt(claims.Subject, 10, 64)
		if err != nil || id <= 0 {
			abort(c, apperror.Unauthorized("TOKEN_INVALID", "登录状态已失效"))
			return
		}
		user, err := users.UserByID(c.Request.Context(), models.ID(id))
		if err != nil || !user.Active || user.Role != claims.Role || user.TokenVersion != claims.Version {
			abort(c, apperror.Unauthorized("ACCOUNT_DISABLED", "账号不可用或登录状态已失效"))
			return
		}
		c.Set(UserKey, user)
		c.Next()
	}
}

func RequireRole(roles ...models.Role) gin.HandlerFunc {
	allowed := map[models.Role]bool{}
	for _, role := range roles {
		allowed[role] = true
	}
	return func(c *gin.Context) {
		value, exists := c.Get(UserKey)
		if !exists {
			abort(c, apperror.Unauthorized("TOKEN_REQUIRED", "请先登录"))
			return
		}
		user, ok := value.(*models.User)
		if !ok || !allowed[user.Role] {
			abort(c, apperror.Forbidden("ROLE_FORBIDDEN", "当前角色无权执行此操作"))
			return
		}
		c.Next()
	}
}

func abort(c *gin.Context, err error) {
	appErr, ok := err.(*apperror.Error)
	if !ok {
		appErr = apperror.Internal(err)
	}
	requestID, _ := c.Get(RequestIDKey)
	id, _ := requestID.(string)
	c.AbortWithStatusJSON(appErr.Status, gin.H{"error": gin.H{"code": appErr.Code, "message": appErr.Message, "request_id": id}})
}

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		userID := ""
		if value, exists := c.Get(UserKey); exists {
			if user, ok := value.(*models.User); ok {
				userID = user.ID.String()
			}
		}
		log.Printf("http request_id=%v method=%s path=%s status=%d duration_ms=%d user_id=%s", c.GetString(RequestIDKey), c.Request.Method, c.Request.URL.Path, c.Writer.Status(), time.Since(start).Milliseconds(), userID)
	}
}

func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered any) {
		log.Printf("panic request_id=%s error=%v", c.GetString(RequestIDKey), recovered)
		abort(c, apperror.Internal(fmt.Errorf("panic")))
	})
}

func RateLimit(client redis.UniversalClient, name string, limit int, window time.Duration) gin.HandlerFunc {
	script := redis.NewScript(`local current = redis.call('INCR', KEYS[1]); if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return {current, redis.call('TTL', KEYS[1])}`)
	return func(c *gin.Context) {
		digest := sha256.Sum256([]byte(c.ClientIP() + "|" + c.FullPath()))
		key := fmt.Sprintf("lumina:rate:%s:%x", name, digest[:])
		result, err := script.Run(c.Request.Context(), client, []string{key}, int(window.Seconds())).Int64Slice()
		if err != nil {
			abort(c, apperror.New(503, "RATE_LIMIT_UNAVAILABLE", "限流服务暂不可用"))
			return
		}
		if len(result) == 2 && result[0] > int64(limit) {
			c.Header("Retry-After", strconv.FormatInt(result[1], 10))
			abort(c, apperror.New(429, "RATE_LIMITED", "请求过于频繁，请稍后重试"))
			return
		}
		c.Next()
	}
}
