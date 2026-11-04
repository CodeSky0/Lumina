package config

import "testing"

func TestLoadRequiresSecrets(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("JWT_SECRET", "")
	if _, err := Load(); err == nil {
		t.Fatal("缺少数据库配置时必须失败")
	}
	t.Setenv("DATABASE_URL", "postgres://localhost/lumina")
	if _, err := Load(); err == nil {
		t.Fatal("短 JWT 密钥必须被拒绝")
	}
}

func TestLoadValidConfiguration(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/lumina")
	t.Setenv("JWT_SECRET", "01234567890123456789012345678901")
	t.Setenv("CORS_ALLOWLIST", "https://school.example,https://teacher.example")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("加载配置失败: %v", err)
	}
	if len(cfg.AllowedOrigins) != 2 || cfg.RedisDB != 0 {
		t.Fatalf("配置解析结果不正确: %+v", cfg)
	}
}

func TestProductionRequiresSecureCookie(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATABASE_URL", "postgres://localhost/lumina")
	t.Setenv("JWT_SECRET", "01234567890123456789012345678901")
	t.Setenv("REFRESH_COOKIE_SECURE", "false")
	if _, err := Load(); err == nil {
		t.Fatal("生产环境的不安全 Cookie 必须被拒绝")
	}
}
