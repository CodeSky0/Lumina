package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"lumina/api/internal/apperror"
	"lumina/api/internal/models"
)

const WSTicketTTL = 60 * time.Second

type TicketStore interface {
	Put(ctx context.Context, ticket string, userID models.ID, ttl time.Duration) error
	Take(ctx context.Context, ticket string) (models.ID, error)
}

type RedisTicketStore struct{ client redis.UniversalClient }

func NewRedisTicketStore(client redis.UniversalClient) *RedisTicketStore {
	return &RedisTicketStore{client: client}
}

func ticketKey(ticket string) string { return "lumina:ws-ticket:" + hashToken(ticket) }

func (s *RedisTicketStore) Put(ctx context.Context, ticket string, userID models.ID, ttl time.Duration) error {
	ok, err := s.client.SetNX(ctx, ticketKey(ticket), userID.String(), ttl).Result()
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("票据冲突")
	}
	return nil
}

func (s *RedisTicketStore) Take(ctx context.Context, ticket string) (models.ID, error) {
	value, err := s.client.GetDel(ctx, ticketKey(ticket)).Result()
	if err == redis.Nil {
		return 0, apperror.Unauthorized("WS_TICKET_INVALID", "实时连接票据无效或已使用")
	}
	if err != nil {
		return 0, err
	}
	var id models.ID
	if err := id.Scan(value); err != nil {
		return 0, err
	}
	return id, nil
}
