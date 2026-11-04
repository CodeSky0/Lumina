package auth

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	LoginMaxFailures = 5
	LoginLockTTL     = 15 * time.Minute
)

type LoginLimiter interface {
	Locked(ctx context.Context, username, ip string) (bool, error)
	Fail(ctx context.Context, username, ip string) (bool, error)
	Reset(ctx context.Context, username, ip string) error
}

type RedisLoginLimiter struct{ client redis.UniversalClient }

func NewRedisLoginLimiter(client redis.UniversalClient) *RedisLoginLimiter {
	return &RedisLoginLimiter{client: client}
}

func loginKeys(username, ip string) (string, string) {
	digest := sha256.Sum256([]byte(fmt.Sprintf("%s|%s", username, ip)))
	key := fmt.Sprintf("lumina:login:%x", digest[:])
	return key + ":failures", key + ":lock"
}

func usernameKeys(username string) (string, string) {
	digest := sha256.Sum256([]byte(username))
	key := fmt.Sprintf("lumina:login:username:%x", digest[:])
	return key + ":failures", key + ":lock"
}

func (l *RedisLoginLimiter) Locked(ctx context.Context, username, ip string) (bool, error) {
	_, lockKey := loginKeys(username, ip)
	_, usernameLockKey := usernameKeys(username)
	count, err := l.client.Exists(ctx, lockKey, usernameLockKey).Result()
	return count > 0, err
}

var recordFailure = redis.NewScript(`
if redis.call('EXISTS', KEYS[2]) == 1 or redis.call('EXISTS', KEYS[4]) == 1 then return 1 end
local pair_failures = redis.call('INCR', KEYS[1])
if pair_failures == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local username_failures = redis.call('INCR', KEYS[3])
if username_failures == 1 then redis.call('EXPIRE', KEYS[3], ARGV[1]) end
local locked = 0
if pair_failures >= tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'EX', ARGV[1])
  redis.call('DEL', KEYS[1])
  locked = 1
end
if username_failures >= tonumber(ARGV[2]) then
  redis.call('SET', KEYS[4], '1', 'EX', ARGV[1])
  redis.call('DEL', KEYS[3])
  locked = 1
end
return locked
`)

func (l *RedisLoginLimiter) Fail(ctx context.Context, username, ip string) (bool, error) {
	failureKey, lockKey := loginKeys(username, ip)
	usernameFailureKey, usernameLockKey := usernameKeys(username)
	result, err := recordFailure.Run(ctx, l.client, []string{failureKey, lockKey, usernameFailureKey, usernameLockKey}, int(LoginLockTTL.Seconds()), LoginMaxFailures).Int()
	return result == 1, err
}

func (l *RedisLoginLimiter) Reset(ctx context.Context, username, ip string) error {
	failureKey, lockKey := loginKeys(username, ip)
	usernameFailureKey, usernameLockKey := usernameKeys(username)
	return l.client.Del(ctx, failureKey, lockKey, usernameFailureKey, usernameLockKey).Err()
}
