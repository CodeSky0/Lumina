package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type HealthHandler struct {
	db    *gorm.DB
	redis redis.UniversalClient
}

func NewHealthHandler(db *gorm.DB, redisClient redis.UniversalClient) *HealthHandler {
	return &HealthHandler{db: db, redis: redisClient}
}
func (h *HealthHandler) Live(c *gin.Context) { data(c, http.StatusOK, gin.H{"status": "ok"}) }
func (h *HealthHandler) Ready(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()
	sqlDB, err := h.db.DB()
	if err == nil {
		err = sqlDB.PingContext(ctx)
	}
	if err == nil {
		err = h.redis.Ping(ctx).Err()
	}
	if err != nil {
		data(c, http.StatusServiceUnavailable, gin.H{"status": "unavailable"})
		return
	}
	data(c, http.StatusOK, gin.H{"status": "ok", "postgresql": "up", "redis": "up"})
}
