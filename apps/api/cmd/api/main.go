package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"lumina/api/internal/auth"
	"lumina/api/internal/config"
	"lumina/api/internal/database"
	"lumina/api/internal/httpapi"
	"lumina/api/internal/realtime"
	"lumina/api/internal/services"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("配置错误: %v", err)
	}
	db, err := database.Open(cfg)
	if err != nil {
		log.Fatalf("数据库错误: %v", err)
	}
	redisClient := redis.NewClient(&redis.Options{Addr: cfg.RedisAddr, Password: cfg.RedisPassword, DB: cfg.RedisDB})
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	if err := redisClient.Ping(pingCtx).Err(); err != nil {
		cancel()
		log.Fatalf("Redis 错误: %v", err)
	}
	cancel()
	authRepo := auth.NewGORMRepository(db)
	tokens := auth.NewTokenManager(cfg.JWTSecret)
	limiter := auth.NewRedisLoginLimiter(redisClient)
	tickets := auth.NewRedisTicketStore(redisClient)
	authService := auth.NewService(authRepo, limiter, tickets, tokens)
	publisher := realtime.NewRedisPublisher(redisClient)
	outbox := realtime.NewOutboxStore(db)
	relay := realtime.NewOutboxRelay(outbox, publisher, "")
	relayCtx, stopRelay := context.WithCancel(context.Background())
	defer stopRelay()
	relayDone := make(chan struct{})
	go func() {
		defer close(relayDone)
		relay.Run(relayCtx)
	}()
	membership := services.NewMembership(db)
	presence := realtime.NewRedisPresence(redisClient)
	hub := realtime.NewHub(membership, publisher, presence)
	audit := services.NewAuditService(db)
	admin := services.NewAdminService(db)
	channels := services.NewChannelService(db, membership, hub)
	messages := services.NewMessageService(db, membership, publisher, outbox)
	announcements := services.NewAnnouncementService(db, publisher, outbox)
	uploads := services.NewUploadService(db, membership, cfg.UploadDir)
	router, err := httpapi.NewRouter(httpapi.Dependencies{Config: cfg, DB: db, Redis: redisClient, Auth: authService, Tokens: tokens, AuthRepo: authRepo, Admin: admin, Audit: audit, Membership: membership, Channels: channels, Messages: messages, Announcements: announcements, Uploads: uploads, Hub: hub})
	if err != nil {
		log.Fatalf("路由初始化错误: %v", err)
	}
	go realtime.Subscribe(ctx, redisClient, hub)
	server := &http.Server{Addr: cfg.Address, Handler: router, ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 60 * time.Second, WriteTimeout: 65 * time.Second, IdleTimeout: 120 * time.Second, MaxHeaderBytes: 1 << 20}
	go func() {
		log.Printf("Lumina API 开始监听 %s", cfg.Address)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("HTTP 服务错误: %v", err)
		}
	}()
	<-ctx.Done()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP 优雅退出失败: %v", err)
	}
	if err := hub.Shutdown(shutdownCtx); err != nil {
		log.Printf("WebSocket 优雅退出失败: %v", err)
	}
	stopRelay()
	<-relayDone
	if err := redisClient.Close(); err != nil {
		log.Printf("Redis 关闭失败: %v", err)
	}
	if sqlDB, err := db.DB(); err == nil {
		if err := sqlDB.Close(); err != nil {
			log.Printf("数据库关闭失败: %v", err)
		}
	}
}
