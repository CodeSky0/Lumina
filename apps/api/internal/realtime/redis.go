package realtime

import (
	"context"
	"encoding/json"
	"log"

	"github.com/redis/go-redis/v9"
)

const EventChannel = "lumina:realtime:events"

type RedisPublisher struct{ client redis.UniversalClient }

func NewRedisPublisher(client redis.UniversalClient) *RedisPublisher {
	return &RedisPublisher{client: client}
}

func (p *RedisPublisher) Publish(ctx context.Context, event Event) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return p.client.Publish(ctx, EventChannel, payload).Err()
}

func Subscribe(ctx context.Context, client redis.UniversalClient, hub *Hub) {
	pubsub := client.Subscribe(ctx, EventChannel)
	defer pubsub.Close()
	messages := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case message, ok := <-messages:
			if !ok {
				return
			}
			var event Event
			if err := json.Unmarshal([]byte(message.Payload), &event); err != nil {
				log.Printf("忽略无效实时事件: %v", err)
				continue
			}
			hub.Broadcast(event)
		}
	}
}
