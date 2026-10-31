package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"lumina/api/internal/auth"
	"lumina/api/internal/models"
)

type stubUsers struct{ user *models.User }

func (s stubUsers) UserByID(_ context.Context, id models.ID) (*models.User, error) {
	if s.user != nil && s.user.ID == id {
		return s.user, nil
	}
	return nil, gorm.ErrRecordNotFound
}

func TestRBACAndInactiveUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tokens := auth.NewTokenManager("01234567890123456789012345678901")
	teacher := &models.User{ID: 1, Username: "teacher", Role: models.RoleTeacher, Active: true}
	raw, _, err := tokens.Generate(*teacher)
	if err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.Use(RequestID())
	router.GET("/admin", RequireAuth(stubUsers{teacher}, tokens), RequireRole(models.RoleAdmin), func(c *gin.Context) { c.Status(204) })
	request := httptest.NewRequest(http.MethodGet, "/admin", nil)
	request.Header.Set("Authorization", "Bearer "+raw)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("教师访问管理接口应返回 403，实际 %d", response.Code)
	}
	teacher.Active = false
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("停用账号应返回 401，实际 %d", response.Code)
	}
}

func TestTokenVersionMismatchRejectsOldAccessToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tokens := auth.NewTokenManager("01234567890123456789012345678901")
	teacher := &models.User{ID: 1, Username: "teacher", Role: models.RoleTeacher, TokenVersion: 1, Active: true}
	raw, _, err := tokens.Generate(*teacher)
	if err != nil {
		t.Fatal(err)
	}
	teacher.TokenVersion = 2
	router := gin.New()
	router.GET("/me", RequireAuth(stubUsers{teacher}, tokens), func(c *gin.Context) { c.Status(204) })
	request := httptest.NewRequest(http.MethodGet, "/me", nil)
	request.Header.Set("Authorization", "Bearer "+raw)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("旧版本访问令牌应返回 401，实际 %d", response.Code)
	}
}

func TestRequestIDAndSecurityHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequestID(), SecurityHeaders())
	router.GET("/", func(c *gin.Context) { c.Status(204) })
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/", nil))
	if response.Header().Get("X-Request-ID") == "" || response.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("请求 ID 或安全响应头缺失")
	}
}
