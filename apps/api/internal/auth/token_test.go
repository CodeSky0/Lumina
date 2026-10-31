package auth

import (
	"testing"
	"time"

	"lumina/api/internal/models"
)

func TestAccessTokenContainsRoleAndExpires(t *testing.T) {
	manager := NewTokenManager("01234567890123456789012345678901")
	now := time.Date(2026, 10, 30, 8, 0, 0, 0, time.UTC)
	manager.now = func() time.Time { return now }
	raw, expires, err := manager.Generate(models.User{ID: 42, Username: "teacher01", Role: models.RoleTeacher, TokenVersion: 7, Active: true})
	if err != nil {
		t.Fatal(err)
	}
	if !expires.Equal(now.Add(24 * time.Hour)) {
		t.Fatalf("访问令牌有效期错误: %s", expires)
	}
	claims, err := manager.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Subject != "42" || claims.Role != models.RoleTeacher || claims.Version != 7 {
		t.Fatalf("令牌声明错误: %+v", claims)
	}
	manager.now = func() time.Time { return now.Add(25 * time.Hour) }
	if _, err := manager.Parse(raw); err == nil {
		t.Fatal("过期令牌必须被拒绝")
	}
}

func TestJSONIDAlwaysUsesString(t *testing.T) {
	value, err := models.ID(9007199254740993).MarshalJSON()
	if err != nil || string(value) != `"9007199254740993"` {
		t.Fatalf("ID 序列化不兼容 JavaScript: %s %v", value, err)
	}
}
