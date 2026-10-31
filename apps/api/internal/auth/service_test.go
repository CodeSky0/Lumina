package auth

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"lumina/api/internal/models"
)

type memoryLimiter struct {
	mu       sync.Mutex
	failures map[string]int
	locked   map[string]bool
}

func newMemoryLimiter() *memoryLimiter {
	return &memoryLimiter{failures: map[string]int{}, locked: map[string]bool{}}
}
func (l *memoryLimiter) Locked(_ context.Context, username, ip string) (bool, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.locked[username+ip] || l.locked[username], nil
}
func (l *memoryLimiter) Fail(_ context.Context, username, ip string) (bool, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	key := username + ip
	l.failures[key]++
	l.failures[username]++
	if l.failures[key] >= LoginMaxFailures {
		l.locked[key] = true
	}
	if l.failures[username] >= LoginMaxFailures {
		l.locked[username] = true
	}
	return l.locked[key] || l.locked[username], nil
}
func (l *memoryLimiter) Reset(_ context.Context, username, ip string) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.failures, username+ip)
	delete(l.locked, username+ip)
	delete(l.failures, username)
	delete(l.locked, username)
	return nil
}

type memoryTickets struct{ values map[string]models.ID }

func (s *memoryTickets) Put(_ context.Context, ticket string, id models.ID, _ time.Duration) error {
	if s.values == nil {
		s.values = map[string]models.ID{}
	}
	s.values[ticket] = id
	return nil
}
func (s *memoryTickets) Take(_ context.Context, ticket string) (models.ID, error) {
	id, ok := s.values[ticket]
	if !ok {
		return 0, gorm.ErrRecordNotFound
	}
	delete(s.values, ticket)
	return id, nil
}

type memoryRepository struct {
	mu         sync.Mutex
	users      map[string]*models.User
	tokens     map[string]*models.RefreshToken
	revoked    map[string]bool
	deviceUser models.ID
	deviceUsed bool
}

func (r *memoryRepository) UserByUsername(_ context.Context, username string) (*models.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	user := r.users[username]
	if user == nil {
		return nil, gorm.ErrRecordNotFound
	}
	copy := *user
	return &copy, nil
}
func (r *memoryRepository) UserByID(_ context.Context, id models.ID) (*models.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, user := range r.users {
		if user.ID == id {
			copy := *user
			return &copy, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}
func (r *memoryRepository) CreateRefresh(_ context.Context, token *models.RefreshToken) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	copy := *token
	r.tokens[token.TokenHash] = &copy
	return nil
}
func (r *memoryRepository) RefreshByHash(_ context.Context, hash string) (*models.RefreshToken, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	token := r.tokens[hash]
	if token == nil {
		return nil, gorm.ErrRecordNotFound
	}
	copy := *token
	if r.revoked[token.FamilyID] {
		now := time.Now()
		copy.RevokedAt = &now
	}
	return &copy, nil
}
func (r *memoryRepository) RotateRefresh(_ context.Context, oldToken, newToken *models.RefreshToken) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	old := r.tokens[oldToken.TokenHash]
	if old == nil || old.UsedAt != nil || r.revoked[old.FamilyID] {
		return ErrRefreshReused
	}
	now := time.Now()
	old.UsedAt = &now
	copy := *newToken
	r.tokens[copy.TokenHash] = &copy
	return nil
}
func (r *memoryRepository) RevokeFamily(_ context.Context, family string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.revoked[family] = true
	return nil
}
func (r *memoryRepository) RevokeByHash(_ context.Context, hash string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if token := r.tokens[hash]; token != nil {
		r.revoked[token.FamilyID] = true
	}
	return nil
}
func (r *memoryRepository) RevokeUserSessions(_ context.Context, userID models.ID) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, user := range r.users {
		if user.ID == userID {
			user.TokenVersion++
		}
	}
	for _, token := range r.tokens {
		if token.UserID == userID {
			r.revoked[token.FamilyID] = true
		}
	}
	return nil
}
func (r *memoryRepository) ConsumeDevice(_ context.Context, _ string) (*models.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.deviceUsed {
		return nil, ErrDeviceInvalid
	}
	r.deviceUsed = true
	for _, user := range r.users {
		if user.ID == r.deviceUser && user.Active {
			copy := *user
			return &copy, nil
		}
	}
	return nil, ErrDeviceInvalid
}
func (r *memoryRepository) Transaction(ctx context.Context, fn func(Repository) error) error {
	return fn(r)
}

func newAuthFixture(t *testing.T) (*Service, *memoryRepository) {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	repo := &memoryRepository{users: map[string]*models.User{}, tokens: map[string]*models.RefreshToken{}, revoked: map[string]bool{}, deviceUser: 2}
	repo.users["teacher"] = &models.User{ID: 1, Username: "teacher", DisplayName: "教师", Role: models.RoleTeacher, PasswordHash: string(hash), Active: true}
	repo.users["room"] = &models.User{ID: 2, Username: "room", DisplayName: "教室", Role: models.RoleClassroom, PasswordHash: string(hash), Active: true}
	repo.users["disabled"] = &models.User{ID: 3, Username: "disabled", Role: models.RoleTeacher, PasswordHash: string(hash), Active: false}
	service := NewService(repo, newMemoryLimiter(), &memoryTickets{}, NewTokenManager("01234567890123456789012345678901"))
	return service, repo
}

func TestLoginPasswordAndFiveFailureLockout(t *testing.T) {
	service, _ := newAuthFixture(t)
	if _, err := service.Login(context.Background(), "teacher", "wrong", "127.0.0.1"); err == nil {
		t.Fatal("错误密码不能登录")
	}
	for i := 0; i < 4; i++ {
		_, _ = service.Login(context.Background(), "teacher", "wrong", "127.0.0.1")
	}
	if _, err := service.Login(context.Background(), "teacher", "correct-password", "127.0.0.1"); err == nil {
		t.Fatal("第五次失败后正确密码也应被锁定")
	}
	if _, err := service.Login(context.Background(), "teacher", "correct-password", "10.0.0.2"); err == nil {
		t.Fatal("同一用户名换 IP 后仍应保持锁定")
	}
}

func TestInactiveUserUsesGenericFailure(t *testing.T) {
	service, _ := newAuthFixture(t)
	_, err := service.Login(context.Background(), "disabled", "correct-password", "127.0.0.1")
	if err == nil || err.Error() != "用户名或密码错误" {
		t.Fatalf("停用账号不能泄露状态: %v", err)
	}
}

func TestRefreshRotationAndReuseRevokesFamily(t *testing.T) {
	service, repo := newAuthFixture(t)
	first, err := service.Login(context.Background(), "teacher", "correct-password", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	second, err := service.Refresh(context.Background(), first.RefreshToken)
	if err != nil {
		t.Fatalf("首次刷新失败: %v", err)
	}
	if first.RefreshToken == second.RefreshToken {
		t.Fatal("刷新令牌必须旋转")
	}
	if _, err := service.Refresh(context.Background(), first.RefreshToken); err == nil {
		t.Fatal("旧令牌重用必须失败")
	}
	if !repo.revoked[firstTokenFamily(repo, first.RefreshToken)] {
		t.Fatal("重用后必须撤销整个令牌族")
	}
	if _, err := service.Refresh(context.Background(), second.RefreshToken); err == nil {
		t.Fatal("族撤销后新令牌也必须失效")
	}
}

func firstTokenFamily(repo *memoryRepository, raw string) string {
	return repo.tokens[hashToken(raw)].FamilyID
}

func TestLogoutRevokesRefreshAndBumpsTokenVersion(t *testing.T) {
	service, repo := newAuthFixture(t)
	session, err := service.Login(context.Background(), "teacher", "correct-password", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	stored := repo.tokens[hashToken(session.RefreshToken)]
	if stored.ExpiresAt.Sub(stored.CreatedAt) != RefreshTokenTTL {
		t.Fatalf("刷新令牌有效期错误: %s", stored.ExpiresAt.Sub(stored.CreatedAt))
	}
	if err := service.Logout(context.Background(), session.RefreshToken); err != nil {
		t.Fatal(err)
	}
	if repo.users["teacher"].TokenVersion != 1 {
		t.Fatalf("logout 后令牌版本为 %d，期望 1", repo.users["teacher"].TokenVersion)
	}
	if !repo.revoked[stored.FamilyID] {
		t.Fatal("logout 后刷新令牌仍未撤销")
	}
	if err := service.Logout(context.Background(), session.RefreshToken); err != nil {
		t.Fatal(err)
	}
	if repo.users["teacher"].TokenVersion != 1 {
		t.Fatal("重复 logout 不应再次递增令牌版本")
	}
	if _, err := service.Refresh(context.Background(), session.RefreshToken); err == nil {
		t.Fatal("logout 后刷新令牌必须失效")
	}
}

func TestDeviceCodeAndWSTicketAreOneTime(t *testing.T) {
	service, _ := newAuthFixture(t)
	if _, err := service.DeviceLogin(context.Background(), "012345678901234567890123"); err != nil {
		t.Fatal(err)
	}
	if _, err := service.DeviceLogin(context.Background(), "012345678901234567890123"); !errors.Is(err, ErrDeviceInvalid) && err == nil {
		t.Fatal("设备码只能使用一次")
	}
	ticket, err := service.WSTicket(context.Background(), 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.ConsumeWSTicket(context.Background(), ticket); err != nil {
		t.Fatal(err)
	}
	if _, err := service.ConsumeWSTicket(context.Background(), ticket); err == nil {
		t.Fatal("WebSocket 票据只能使用一次")
	}
}

func TestRedisLoginLimiterAtomicLock(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	limiter := NewRedisLoginLimiter(client)
	ctx := context.Background()
	ips := []string{"ip-1", "ip-2", "ip-3", "ip-4", "ip-5"}
	for i := 0; i < LoginMaxFailures; i++ {
		if _, err := limiter.Fail(ctx, "user", ips[i]); err != nil {
			t.Fatal(err)
		}
	}
	locked, err := limiter.Locked(ctx, "user", "new-ip")
	if err != nil || !locked {
		t.Fatalf("Redis 锁定失败: %v %v", locked, err)
	}
	if ttl := server.TTL("missing"); ttl != 0 {
		t.Fatal("无效测试键")
	}
	if err := limiter.Reset(ctx, "user", "new-ip"); err != nil {
		t.Fatal(err)
	}
	locked, _ = limiter.Locked(ctx, "user", "new-ip")
	if locked {
		t.Fatal("重置后不应锁定")
	}
}
