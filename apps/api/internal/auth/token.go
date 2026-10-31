package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"lumina/api/internal/apperror"
	"lumina/api/internal/models"
)

const AccessTokenTTL = 24 * time.Hour
const RefreshTokenTTL = 7 * 24 * time.Hour

type Claims struct {
	Username string      `json:"username"`
	Role     models.Role `json:"role"`
	Version  int64       `json:"version"`
	jwt.RegisteredClaims
}

type TokenManager struct {
	secret []byte
	now    func() time.Time
}

func NewTokenManager(secret string) *TokenManager {
	return &TokenManager{secret: []byte(secret), now: func() time.Time { return time.Now().UTC() }}
}

func (m *TokenManager) Generate(user models.User) (string, time.Time, error) {
	now := m.now()
	expires := now.Add(AccessTokenTTL)
	claims := Claims{
		Username: user.Username,
		Role:     user.Role,
		Version:  user.TokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			ExpiresAt: jwt.NewNumericDate(expires),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now.Add(-time.Second)),
			ID:        uuid.NewString(),
			Issuer:    "lumina-api",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(m.secret)
	return signed, expires, err
}

func (m *TokenManager) Parse(raw string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("非预期签名算法")
		}
		return m.secret, nil
	}, jwt.WithIssuer("lumina-api"), jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithTimeFunc(m.now))
	if err != nil || !token.Valid {
		return nil, apperror.Unauthorized("TOKEN_INVALID", "登录状态已失效，请重新登录")
	}
	if claims.Subject == "" || !claims.Role.Valid() {
		return nil, apperror.Unauthorized("TOKEN_INVALID", "登录状态已失效，请重新登录")
	}
	return claims, nil
}

func randomToken() (string, error) {
	buffer := make([]byte, 48)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func hashToken(raw string) string {
	digest := sha256.Sum256([]byte(raw))
	return base64.RawURLEncoding.EncodeToString(digest[:])
}

func HashDeviceCode(raw string) string {
	digest := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("%x", digest[:])
}
