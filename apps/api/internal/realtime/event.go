package realtime

import (
	"context"
	"time"

	"github.com/google/uuid"

	"lumina/api/internal/models"
)

const (
	EventNewMessage              = "new_message"
	EventMessageEdited           = "message_edited"
	EventMessageDeleted          = "message_deleted"
	EventAnnouncement            = "announcement"
	EventAnnouncementInvalidated = "announcement_invalidated"
	EventTyping                  = "typing"
	EventPresence                = "presence"
	EventReadAck                 = "read_ack"
)

type Event struct {
	EventID    string         `json:"event_id"`
	Type       string         `json:"type"`
	ChannelID  *models.ID     `json:"channel_id,omitempty"`
	OccurredAt time.Time      `json:"occurred_at"`
	Data       map[string]any `json:"data"`
}

func NewEvent(eventType string, channelID *models.ID, data map[string]any) Event {
	return Event{EventID: uuid.NewString(), Type: eventType, ChannelID: channelID, OccurredAt: time.Now().UTC(), Data: data}
}

type Publisher interface {
	Publish(ctx context.Context, event Event) error
}
