package httpapi

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"lumina/api/internal/auth"
	"lumina/api/internal/config"
	"lumina/api/internal/middleware"
	"lumina/api/internal/models"
	"lumina/api/internal/realtime"
	"lumina/api/internal/services"
)

type Dependencies struct {
	Config        config.Config
	DB            *gorm.DB
	Redis         redis.UniversalClient
	Auth          *auth.Service
	Tokens        *auth.TokenManager
	AuthRepo      auth.Repository
	Admin         *services.AdminService
	Audit         *services.AuditService
	Membership    *services.Membership
	Channels      *services.ChannelService
	Messages      *services.MessageService
	Announcements *services.AnnouncementService
	Uploads       *services.UploadService
	Hub           *realtime.Hub
}

func NewRouter(deps Dependencies) (*gin.Engine, error) {
	router := gin.New()
	if err := router.SetTrustedProxies(deps.Config.TrustedProxies); err != nil {
		return nil, err
	}
	router.Use(middleware.RequestID(), middleware.SecurityHeaders(), middleware.CORS(deps.Config.AllowedOrigins), middleware.RequestLogger(), middleware.Recovery())
	authHandler := NewAuthHandler(deps.Auth, deps.Audit, deps.Config.RefreshCookieSecure)
	adminHandler := NewAdminHandler(deps.Admin, deps.Audit)
	messageHandler := NewMessageHandler(deps.Channels, deps.Messages)
	announcementHandler := NewAnnouncementHandler(deps.Announcements, deps.Messages, deps.Audit)
	uploadHandler := NewUploadHandler(deps.Uploads)
	healthHandler := NewHealthHandler(deps.DB, deps.Redis)
	websocketHandler := NewWebSocketHandler(deps.Auth, deps.Membership, deps.Hub, deps.Config.AllowedOrigins)
	router.GET("/health/live", healthHandler.Live)
	router.GET("/health/ready", healthHandler.Ready)
	router.GET("/ws", websocketHandler.Serve)
	v1 := router.Group("/api/v1")
	authRoutes := v1.Group("/auth")
	loginLimit := middleware.RateLimit(deps.Redis, "login", 10, time.Minute)
	refreshLimit := middleware.RateLimit(deps.Redis, "refresh", 30, time.Minute)
	authRoutes.POST("/login", loginLimit, authHandler.Login)
	authRoutes.POST("/device", loginLimit, authHandler.Device)
	authRoutes.POST("/refresh", refreshLimit, authHandler.Refresh)
	authRoutes.POST("/logout", refreshLimit, authHandler.Logout)
	protected := v1.Group("")
	protected.Use(middleware.RequireAuth(deps.AuthRepo, deps.Tokens))
	protected.GET("/auth/me", authHandler.Me)
	protected.POST("/auth/ws-ticket", authHandler.WSTicket)
	protected.GET("/channels", messageHandler.ListChannels)
	protected.GET("/channels/:id/messages", messageHandler.History)
	protected.GET("/channels/:id/messages/sync", messageHandler.Sync)
	protected.POST("/channels/:id/messages", messageHandler.Send)
	protected.POST("/messages/delivery-ack", messageHandler.DeliveryAck)
	protected.PATCH("/messages/:id", messageHandler.Edit)
	protected.DELETE("/messages/:id", messageHandler.Delete)
	protected.POST("/messages/:id/read", messageHandler.Read)
	protected.POST("/messages/:id/confirm", messageHandler.Confirm)
	protected.GET("/messages/:id/confirmations", messageHandler.ConfirmationStatus)
	protected.POST("/teacher/batch-notices", middleware.RequireRole(models.RoleTeacher), messageHandler.Batch)
	protected.GET("/teacher/urgent-pending", middleware.RequireRole(models.RoleTeacher), announcementHandler.UrgentPending)
	protected.GET("/announcements", announcementHandler.List)
	protected.POST("/announcements", middleware.RequireRole(models.RoleAdmin), announcementHandler.Create)
	protected.POST("/announcements/:id/confirm", announcementHandler.Confirm)
	protected.GET("/announcements/:id/confirmations", announcementHandler.ConfirmationStatus)
	protected.GET("/classroom/urgent-pending", middleware.RequireRole(models.RoleClassroom), announcementHandler.UrgentPending)
	protected.POST("/uploads", middleware.RateLimit(deps.Redis, "upload", 20, time.Minute), uploadHandler.Upload)
	protected.GET("/files/:id", uploadHandler.Download)
	admin := protected.Group("/admin")
	admin.Use(middleware.RequireRole(models.RoleAdmin))
	admin.GET("/dashboard", adminHandler.Dashboard)
	admin.GET("/audit-logs", adminHandler.AuditLogs)
	admin.GET("/settings", adminHandler.Settings)
	admin.PUT("/settings", adminHandler.UpdateSettings)
	admin.PATCH("/settings", adminHandler.UpdateSettings)
	registerAdminResources(admin, adminHandler)
	return router, nil
}

func registerAdminResources(group *gin.RouterGroup, handler *AdminHandler) {
	group.GET("/classes", handler.ListClasses)
	group.POST("/classes", handler.CreateClass)
	group.PATCH("/classes/:id", handler.UpdateClass)
	group.DELETE("/classes/:id", handler.DeleteClass)
	group.POST("/classes/:id/device-code", handler.RotateDevice)
	group.GET("/teachers", handler.ListTeachers)
	group.POST("/teachers", handler.CreateTeacher)
	group.PATCH("/teachers/:id", handler.UpdateTeacher)
	group.DELETE("/teachers/:id", handler.DeleteTeacher)
	group.GET("/subjects", handler.ListSubjects)
	group.POST("/subjects", handler.CreateSubject)
	group.PATCH("/subjects/:id", handler.UpdateSubject)
	group.DELETE("/subjects/:id", handler.DeleteSubject)
	group.GET("/channels", handler.ListChannels)
	group.POST("/channels", handler.CreateChannel)
	group.PATCH("/channels/:id", handler.UpdateChannel)
	group.DELETE("/channels/:id", handler.DeleteChannel)
	group.GET("/assignments", handler.ListAssignments)
	group.POST("/assignments", handler.CreateAssignment)
	group.PATCH("/assignments/:id", handler.UpdateAssignment)
	group.DELETE("/assignments/:id", handler.DeleteAssignment)
}
