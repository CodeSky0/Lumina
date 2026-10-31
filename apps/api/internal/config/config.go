package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Environment         string
	Address             string
	DatabaseURL         string
	RedisAddr           string
	RedisPassword       string
	RedisDB             int
	JWTSecret           string
	RefreshCookieSecure bool
	AllowedOrigins      []string
	TrustedProxies      []string
	UploadDir           string
	ShutdownTimeout     time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		Environment:         env("APP_ENV", "development"),
		Address:             env("API_ADDRESS", ":8080"),
		DatabaseURL:         strings.TrimSpace(os.Getenv("DATABASE_URL")),
		RedisAddr:           env("REDIS_ADDR", "127.0.0.1:6379"),
		RedisPassword:       os.Getenv("REDIS_PASSWORD"),
		JWTSecret:           strings.TrimSpace(os.Getenv("JWT_SECRET")),
		RefreshCookieSecure: env("REFRESH_COOKIE_SECURE", "false") == "true",
		AllowedOrigins:      splitEnv("CORS_ALLOWLIST", "http://localhost:3000"),
		TrustedProxies:      splitEnv("TRUSTED_PROXIES", "127.0.0.1"),
		UploadDir:           env("UPLOAD_DIR", "data/uploads"),
		ShutdownTimeout:     15 * time.Second,
	}
	redisDB, err := strconv.Atoi(env("REDIS_DB", "0"))
	if err != nil || redisDB < 0 {
		return Config{}, fmt.Errorf("REDIS_DB 必须是非负整数")
	}
	cfg.RedisDB = redisDB
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL 为必填项")
	}
	if len(cfg.JWTSecret) < 32 {
		return Config{}, fmt.Errorf("JWT_SECRET 为必填项且至少 32 字节")
	}
	if cfg.Environment == "production" && !cfg.RefreshCookieSecure {
		return Config{}, fmt.Errorf("生产环境必须启用 REFRESH_COOKIE_SECURE")
	}
	if len(cfg.AllowedOrigins) == 0 {
		return Config{}, fmt.Errorf("CORS_ALLOWLIST 不能为空")
	}
	for _, origin := range cfg.AllowedOrigins {
		if origin == "*" {
			return Config{}, fmt.Errorf("携带凭据的跨域配置禁止使用通配符")
		}
	}
	return cfg, nil
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func splitEnv(key, fallback string) []string {
	parts := strings.Split(env(key, fallback), ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if value := strings.TrimSpace(part); value != "" {
			result = append(result, value)
		}
	}
	return result
}
