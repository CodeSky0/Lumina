package httpapi

import (
	"errors"
	"math"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"lumina/api/internal/apperror"
	"lumina/api/internal/middleware"
	"lumina/api/internal/models"
	"lumina/api/internal/services"
)

func data(c *gin.Context, status int, value any) { c.JSON(status, gin.H{"data": value}) }

func respondError(c *gin.Context, err error) {
	var appErr *apperror.Error
	if !errors.As(err, &appErr) {
		appErr = apperror.Internal(err)
	}
	c.JSON(appErr.Status, gin.H{"error": gin.H{"code": appErr.Code, "message": appErr.Message, "request_id": c.GetString(middleware.RequestIDKey)}})
}

func currentUser(c *gin.Context) models.User {
	value, _ := c.Get(middleware.UserKey)
	user, _ := value.(*models.User)
	if user == nil {
		return models.User{}
	}
	return *user
}
func parseID(value string) (models.ID, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, apperror.BadRequest("ID_INVALID", "资源标识无效")
	}
	return models.ID(id), nil
}
func pathID(c *gin.Context, name string) (models.ID, error) { return parseID(c.Param(name)) }
func queryInt(c *gin.Context, key string, fallback int) int {
	value, err := strconv.Atoi(c.Query(key))
	if err != nil {
		return fallback
	}
	return value
}
func pageData(items any, total int64, page, size int) gin.H {
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = 20
	}
	if size > 100 {
		size = 100
	}
	pages := int(math.Ceil(float64(total) / float64(size)))
	return gin.H{"items": items, "total": total, "page": page, "size": size, "total_pages": pages}
}
func auditContext(c *gin.Context, actor *models.ID) services.AuditEntry {
	return services.AuditEntry{ActorID: actor, RequestID: c.GetString(middleware.RequestIDKey), IPAddress: c.ClientIP(), Details: map[string]any{}}
}
func statusCreated(c *gin.Context, value any) { data(c, http.StatusCreated, value) }
