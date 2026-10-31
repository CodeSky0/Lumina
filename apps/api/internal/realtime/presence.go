package realtime

import (
	"context"
	"encoding/json"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"lumina/api/internal/models"
)

const presenceTTL = 75 * time.Second

type presenceConnection struct {
	UserID     models.ID   `json:"user_id"`
	ChannelIDs []models.ID `json:"channel_ids"`
}

type RedisPresence struct{ client redis.UniversalClient }

func NewRedisPresence(client redis.UniversalClient) *RedisPresence {
	return &RedisPresence{client: client}
}
func presenceConnectionKey(id string) string { return "lumina:presence:connection:" + id }
func presenceChannelKey(id models.ID) string { return "lumina:presence:channel:" + id.String() }

func (p *RedisPresence) Register(ctx context.Context, connectionID string, userID models.ID, channelIDs []models.ID) error {
	payload, err := json.Marshal(presenceConnection{UserID: userID, ChannelIDs: channelIDs})
	if err != nil {
		return err
	}
	expires := time.Now().Add(presenceTTL).UnixMilli()
	pipe := p.client.TxPipeline()
	pipe.Set(ctx, presenceConnectionKey(connectionID), payload, presenceTTL)
	for _, channelID := range channelIDs {
		pipe.ZAdd(ctx, presenceChannelKey(channelID), redis.Z{Score: float64(expires), Member: connectionID})
	}
	_, err = pipe.Exec(ctx)
	return err
}

func (p *RedisPresence) Heartbeat(ctx context.Context, connectionID string) error {
	payload, err := p.client.Get(ctx, presenceConnectionKey(connectionID)).Bytes()
	if err != nil {
		return err
	}
	var connection presenceConnection
	if err := json.Unmarshal(payload, &connection); err != nil {
		return err
	}
	expires := time.Now().Add(presenceTTL).UnixMilli()
	pipe := p.client.TxPipeline()
	pipe.Expire(ctx, presenceConnectionKey(connectionID), presenceTTL)
	for _, channelID := range connection.ChannelIDs {
		pipe.ZAdd(ctx, presenceChannelKey(channelID), redis.Z{Score: float64(expires), Member: connectionID})
	}
	_, err = pipe.Exec(ctx)
	return err
}

func (p *RedisPresence) Unregister(ctx context.Context, connectionID string) error {
	payload, err := p.client.GetDel(ctx, presenceConnectionKey(connectionID)).Bytes()
	if err == redis.Nil {
		return nil
	}
	if err != nil {
		return err
	}
	var connection presenceConnection
	if err := json.Unmarshal(payload, &connection); err != nil {
		return err
	}
	pipe := p.client.TxPipeline()
	for _, channelID := range connection.ChannelIDs {
		pipe.ZRem(ctx, presenceChannelKey(channelID), connectionID)
	}
	_, err = pipe.Exec(ctx)
	return err
}

func (p *RedisPresence) ChannelOnline(ctx context.Context, channelID models.ID) (bool, error) {
	key := presenceChannelKey(channelID)
	now := time.Now().UnixMilli()
	if err := p.client.ZRemRangeByScore(ctx, key, "-inf", fmtInt(now)).Err(); err != nil {
		return false, err
	}
	count, err := p.client.ZCard(ctx, key).Result()
	return count > 0, err
}

func fmtInt(value int64) string { return strconv.FormatInt(value, 10) }
