package auth

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"lumina/api/internal/apperror"
	"lumina/api/internal/models"
)

type Session struct {
	AccessToken  string
	RefreshToken string
	ExpiresAt    time.Time
	User         models.User
}

type Service struct {
	repo    Repository
	limiter LoginLimiter
	tickets TicketStore
	tokens  *TokenManager
	now     func() time.Time
}

func NewService(repo Repository, limiter LoginLimiter, tickets TicketStore, tokens *TokenManager) *Service {
	return &Service{repo: repo, limiter: limiter, tickets: tickets, tokens: tokens, now: func() time.Time { return time.Now().UTC() }}
}

func (s *Service) Login(ctx context.Context, username, password, ip string) (*Session, error) {
	username = strings.TrimSpace(username)
	locked, err := s.limiter.Locked(ctx, username, ip)
	if err != nil {
		return nil, apperror.Internal(err)
	}
	if locked {
		return nil, apperror.New(429, "LOGIN_LOCKED", "失败次数过多，请十五分钟后重试")
	}
	user, err := s.repo.UserByUsername(ctx, username)
	valid := err == nil && user.Active && bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) == nil
	if !valid {
		// 对不存在的用户也执行一次 bcrypt，降低账号枚举的时间侧信道。
		if err != nil {
			_ = bcrypt.CompareHashAndPassword([]byte("$2a$10$7EqJtq98hPqEX7fNZaFWoO5uQ6K8rj7RZc6mGfKj3zJmH7gY9kM7u"), []byte(password))
		}
		locked, limitErr := s.limiter.Fail(ctx, username, ip)
		if limitErr != nil {
			return nil, apperror.Internal(limitErr)
		}
		if locked {
			return nil, apperror.New(429, "LOGIN_LOCKED", "失败次数过多，请十五分钟后重试")
		}
		return nil, apperror.Unauthorized("INVALID_CREDENTIALS", "用户名或密码错误")
	}
	if err := s.limiter.Reset(ctx, username, ip); err != nil {
		return nil, apperror.Internal(err)
	}
	return s.newSession(ctx, s.repo, *user, uuid.NewString())
}

func (s *Service) DeviceLogin(ctx context.Context, code string) (*Session, error) {
	if len(strings.TrimSpace(code)) < 24 {
		return nil, apperror.Unauthorized("DEVICE_CODE_INVALID", "设备码无效或已使用")
	}
	var session *Session
	err := s.repo.Transaction(ctx, func(tx Repository) error {
		user, err := tx.ConsumeDevice(ctx, HashDeviceCode(code))
		if err != nil {
			return err
		}
		session, err = s.newSession(ctx, tx, *user, uuid.NewString())
		return err
	})
	if err != nil {
		if errors.Is(err, ErrDeviceInvalid) || errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperror.Unauthorized("DEVICE_CODE_INVALID", "设备码无效或已使用")
		}
		var appErr *apperror.Error
		if errors.As(err, &appErr) {
			return nil, appErr
		}
		return nil, apperror.Internal(err)
	}
	return session, nil
}

func (s *Service) Refresh(ctx context.Context, raw string) (*Session, error) {
	if raw == "" {
		return nil, apperror.Unauthorized("REFRESH_INVALID", "刷新凭证无效")
	}
	oldToken, err := s.repo.RefreshByHash(ctx, hashToken(raw))
	if err != nil {
		return nil, apperror.Unauthorized("REFRESH_INVALID", "刷新凭证无效")
	}
	if oldToken.UsedAt != nil || oldToken.RevokedAt != nil {
		if err := s.repo.RevokeFamily(ctx, oldToken.FamilyID); err != nil {
			return nil, apperror.Internal(err)
		}
		return nil, apperror.Unauthorized("REFRESH_REUSED", "刷新凭证已失效，请重新登录")
	}
	if !oldToken.ExpiresAt.After(s.now()) {
		if err := s.repo.RevokeFamily(ctx, oldToken.FamilyID); err != nil {
			return nil, apperror.Internal(err)
		}
		return nil, apperror.Unauthorized("REFRESH_EXPIRED", "登录已过期，请重新登录")
	}
	user, err := s.repo.UserByID(ctx, oldToken.UserID)
	if err != nil || !user.Active {
		return nil, apperror.Unauthorized("ACCOUNT_DISABLED", "账号不可用，请重新登录")
	}
	rawRefresh, err := randomToken()
	if err != nil {
		return nil, apperror.Internal(err)
	}
	newToken := &models.RefreshToken{ID: uuid.NewString(), UserID: user.ID, FamilyID: oldToken.FamilyID, TokenHash: hashToken(rawRefresh), ExpiresAt: s.now().Add(RefreshTokenTTL), CreatedAt: s.now()}
	var session *Session
	err = s.repo.Transaction(ctx, func(tx Repository) error {
		if err := tx.RotateRefresh(ctx, oldToken, newToken); err != nil {
			return err
		}
		access, expires, err := s.tokens.Generate(*user)
		if err != nil {
			return err
		}
		session = &Session{AccessToken: access, RefreshToken: rawRefresh, ExpiresAt: expires, User: *user}
		return nil
	})
	if errors.Is(err, ErrRefreshReused) {
		if revokeErr := s.repo.RevokeFamily(ctx, oldToken.FamilyID); revokeErr != nil {
			return nil, apperror.Internal(revokeErr)
		}
		return nil, apperror.Unauthorized("REFRESH_REUSED", "刷新凭证已失效，请重新登录")
	}
	if err != nil {
		return nil, apperror.Internal(err)
	}
	return session, nil
}

func (s *Service) Logout(ctx context.Context, raw string) error {
	if raw == "" {
		return nil
	}
	token, err := s.repo.RefreshByHash(ctx, hashToken(raw))
	if err != nil || token.RevokedAt != nil {
		return nil
	}
	return s.repo.RevokeUserSessions(ctx, token.UserID)
}

func (s *Service) Me(ctx context.Context, userID models.ID) (*models.User, error) {
	user, err := s.repo.UserByID(ctx, userID)
	if err != nil || !user.Active {
		return nil, apperror.Unauthorized("ACCOUNT_DISABLED", "账号不可用")
	}
	return user, nil
}

func (s *Service) WSTicket(ctx context.Context, userID models.ID) (string, error) {
	user, err := s.Me(ctx, userID)
	if err != nil || user == nil {
		return "", apperror.Unauthorized("ACCOUNT_DISABLED", "账号不可用")
	}
	ticket, err := randomToken()
	if err != nil {
		return "", apperror.Internal(err)
	}
	if err := s.tickets.Put(ctx, ticket, userID, WSTicketTTL); err != nil {
		return "", apperror.Internal(err)
	}
	return ticket, nil
}

func (s *Service) ConsumeWSTicket(ctx context.Context, ticket string) (*models.User, error) {
	if ticket == "" {
		return nil, apperror.Unauthorized("WS_TICKET_INVALID", "实时连接票据无效或已使用")
	}
	userID, err := s.tickets.Take(ctx, ticket)
	if err != nil {
		var appErr *apperror.Error
		if errors.As(err, &appErr) {
			return nil, appErr
		}
		return nil, apperror.Internal(err)
	}
	return s.Me(ctx, userID)
}

func (s *Service) newSession(ctx context.Context, repo Repository, user models.User, familyID string) (*Session, error) {
	rawRefresh, err := randomToken()
	if err != nil {
		return nil, apperror.Internal(err)
	}
	now := s.now()
	refresh := &models.RefreshToken{ID: uuid.NewString(), UserID: user.ID, FamilyID: familyID, TokenHash: hashToken(rawRefresh), ExpiresAt: now.Add(RefreshTokenTTL), CreatedAt: now}
	if err := repo.CreateRefresh(ctx, refresh); err != nil {
		return nil, apperror.Internal(err)
	}
	access, expires, err := s.tokens.Generate(user)
	if err != nil {
		return nil, apperror.Internal(err)
	}
	return &Session{AccessToken: access, RefreshToken: rawRefresh, ExpiresAt: expires, User: user}, nil
}
