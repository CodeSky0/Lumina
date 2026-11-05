package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"lumina/api/internal/models"
)

const (
	outboxLease       = 30 * time.Second
	defaultOutboxBulk = 64
)

type outboxRepository interface {
	Claim(ctx context.Context, instanceID string, limit int, now time.Time) ([]models.RealtimeOutbox, error)
	MarkPublished(ctx context.Context, id models.ID, claimToken string, publishedAt time.Time) error
	MarkFailed(ctx context.Context, id models.ID, claimToken string, attempts int, availableAt time.Time) error
}

var ErrOutboxLeaseLost = errors.New("Outbox 租约已失效")

type OutboxStore struct {
	db *gorm.DB
}

func NewOutboxStore(db *gorm.DB) *OutboxStore {
	return &OutboxStore{db: db}
}

func (s *OutboxStore) Record(tx *gorm.DB, event Event) error {
	if event.EventID == "" {
		event.EventID = uuid.NewString()
	}
	if _, err := uuid.Parse(event.EventID); err != nil {
		return fmt.Errorf("Outbox 事件 ID 无效: %w", err)
	}
	if event.Type == "" {
		return errors.New("Outbox 事件类型不能为空")
	}
	if event.OccurredAt.IsZero() {
		event.OccurredAt = time.Now().UTC()
	}
	payload, err := json.Marshal(event.Data)
	if err != nil {
		return fmt.Errorf("序列化 Outbox 事件: %w", err)
	}
	now := time.Now().UTC()
	record := models.RealtimeOutbox{EventID: event.EventID, EventType: event.Type, ChannelID: event.ChannelID, RecipientUserID: event.RecipientUserID, Payload: datatypes.JSON(payload), OccurredAt: event.OccurredAt, AvailableAt: now, CreatedAt: now}
	return tx.Create(&record).Error
}

func (s *OutboxStore) Claim(ctx context.Context, _ string, limit int, now time.Time) ([]models.RealtimeOutbox, error) {
	if limit <= 0 {
		limit = defaultOutboxBulk
	}
	records := make([]models.RealtimeOutbox, 0, limit)
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		leaseExpiredBefore := now.Add(-outboxLease)
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
			Where("published_at IS NULL AND available_at <= ? AND (locked_at IS NULL OR locked_at < ?)", now, leaseExpiredBefore).
			Order("id ASC").Limit(limit).Find(&records).Error; err != nil {
			return err
		}
		for i := range records {
			claimToken := uuid.NewString()
			result := tx.Model(&models.RealtimeOutbox{}).Where("id = ?", records[i].ID).Updates(map[string]any{"locked_at": now, "locked_by": claimToken})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return ErrOutboxLeaseLost
			}
			records[i].LockedAt = &now
			records[i].LockedBy = &claimToken
		}
		return nil
	})
	return records, err
}

func (s *OutboxStore) MarkPublished(ctx context.Context, id models.ID, claimToken string, publishedAt time.Time) error {
	result := s.db.WithContext(ctx).Model(&models.RealtimeOutbox{}).Where("id = ? AND published_at IS NULL AND locked_by = ?", id, claimToken).Updates(map[string]any{"published_at": publishedAt, "locked_at": nil, "locked_by": nil})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrOutboxLeaseLost
	}
	return nil
}

func (s *OutboxStore) MarkFailed(ctx context.Context, id models.ID, claimToken string, attempts int, availableAt time.Time) error {
	result := s.db.WithContext(ctx).Model(&models.RealtimeOutbox{}).Where("id = ? AND published_at IS NULL AND locked_by = ?", id, claimToken).Updates(map[string]any{"attempts": attempts, "available_at": availableAt, "locked_at": nil, "locked_by": nil})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrOutboxLeaseLost
	}
	return nil
}

type OutboxRelay struct {
	repo         outboxRepository
	publisher    Publisher
	instanceID   string
	batchSize    int
	pollInterval time.Duration
	now          func() time.Time
}

func NewOutboxRelay(store *OutboxStore, publisher Publisher, instanceID string) *OutboxRelay {
	return newOutboxRelay(store, publisher, instanceID)
}

func newOutboxRelay(repo outboxRepository, publisher Publisher, instanceID string) *OutboxRelay {
	if instanceID == "" {
		instanceID = uuid.NewString()
	}
	return &OutboxRelay{repo: repo, publisher: publisher, instanceID: instanceID, batchSize: defaultOutboxBulk, pollInterval: time.Second, now: func() time.Time { return time.Now().UTC() }}
}

func (r *OutboxRelay) PublishBatch(ctx context.Context) error {
	now := r.now()
	records, err := r.repo.Claim(ctx, r.instanceID, r.batchSize, now)
	if err != nil {
		return err
	}
	var result error
	for _, record := range records {
		claimToken := ""
		if record.LockedBy != nil {
			claimToken = *record.LockedBy
		}
		event, err := eventFromOutbox(record)
		if err == nil {
			err = r.publisher.Publish(ctx, event)
		}
		if err == nil {
			if markErr := r.repo.MarkPublished(ctx, record.ID, claimToken, r.now()); markErr != nil {
				result = errors.Join(result, markErr)
			}
			continue
		}
		result = errors.Join(result, err)
		next := r.now().Add(outboxBackoff(record.Attempts))
		if markErr := r.repo.MarkFailed(ctx, record.ID, claimToken, record.Attempts+1, next); markErr != nil {
			result = errors.Join(result, markErr)
		}
	}
	return result
}

func (r *OutboxRelay) Run(ctx context.Context) {
	ticker := time.NewTicker(r.pollInterval)
	defer ticker.Stop()
	for {
		if err := r.PublishBatch(ctx); err != nil && ctx.Err() == nil {
			log.Printf("Outbox 批次发布失败: instance_id=%s error=%v", r.instanceID, err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func eventFromOutbox(record models.RealtimeOutbox) (Event, error) {
	data := map[string]any{}
	if err := json.Unmarshal(record.Payload, &data); err != nil {
		return Event{}, fmt.Errorf("反序列化 Outbox 事件: %w", err)
	}
	return Event{EventID: record.EventID, Type: record.EventType, ChannelID: record.ChannelID, RecipientUserID: record.RecipientUserID, OccurredAt: record.OccurredAt, Data: data}, nil
}

func outboxBackoff(attempt int) time.Duration {
	if attempt < 0 {
		attempt = 0
	}
	backoff := time.Second << attempt
	if backoff > 30*time.Second || attempt >= 5 {
		return 30 * time.Second
	}
	return backoff
}
