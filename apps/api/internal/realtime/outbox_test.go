package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"gorm.io/datatypes"

	"lumina/api/internal/models"
)

type fakeOutboxRepository struct {
	records         []models.RealtimeOutbox
	publishedIDs    []models.ID
	publishedTokens []string
	failedIDs       []models.ID
	failedTokens    []string
	failedAttempt   int
	availableAt     time.Time
}

func (r *fakeOutboxRepository) Claim(_ context.Context, _ string, limit int, _ time.Time) ([]models.RealtimeOutbox, error) {
	if len(r.records) > limit {
		return r.records[:limit], nil
	}
	return r.records, nil
}

func (r *fakeOutboxRepository) MarkPublished(_ context.Context, id models.ID, claimToken string, _ time.Time) error {
	r.publishedIDs = append(r.publishedIDs, id)
	r.publishedTokens = append(r.publishedTokens, claimToken)
	return nil
}

func (r *fakeOutboxRepository) MarkFailed(_ context.Context, id models.ID, claimToken string, attempts int, availableAt time.Time) error {
	r.failedIDs = append(r.failedIDs, id)
	r.failedTokens = append(r.failedTokens, claimToken)
	r.failedAttempt = attempts
	r.availableAt = availableAt
	return nil
}

type recordingPublisher struct {
	events []Event
	err    error
}

func (p *recordingPublisher) Publish(_ context.Context, event Event) error {
	p.events = append(p.events, event)
	return p.err
}

func TestOutboxBackoff(t *testing.T) {
	want := []time.Duration{time.Second, 2 * time.Second, 4 * time.Second, 8 * time.Second, 16 * time.Second, 30 * time.Second, 30 * time.Second}
	for attempt, expected := range want {
		if got := outboxBackoff(attempt); got != expected {
			t.Fatalf("attempt=%d got=%s want=%s", attempt, got, expected)
		}
	}
}

func TestOutboxEventRoundTrip(t *testing.T) {
	channelID := models.ID(7)
	original := NewEvent(EventNewMessage, &channelID, map[string]any{"message_id": models.ID(9)})
	recipientID := models.ID(8)
	original.RecipientUserID = &recipientID
	payload, err := json.Marshal(original.Data)
	if err != nil {
		t.Fatal(err)
	}
	record := models.RealtimeOutbox{EventID: original.EventID, EventType: original.Type, ChannelID: original.ChannelID, RecipientUserID: original.RecipientUserID, Payload: datatypes.JSON(payload), OccurredAt: original.OccurredAt}
	actual, err := eventFromOutbox(record)
	if err != nil {
		t.Fatal(err)
	}
	if actual.EventID != original.EventID || actual.Type != original.Type || actual.ChannelID == nil || *actual.ChannelID != channelID || actual.RecipientUserID == nil || *actual.RecipientUserID != recipientID || !actual.OccurredAt.Equal(original.OccurredAt) {
		t.Fatalf("Outbox 事件信封不一致: %+v", actual)
	}
	if actual.Data["message_id"] != "9" {
		t.Fatalf("Outbox 字符串 ID 未保留: %+v", actual.Data)
	}
}

func TestOutboxRelayPublishesClaimedEvent(t *testing.T) {
	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	event := NewEvent(EventNewMessage, nil, map[string]any{"message_id": models.ID(9)})
	payload, _ := json.Marshal(event.Data)
	claimToken := "claim-a"
	repo := &fakeOutboxRepository{records: []models.RealtimeOutbox{{ID: 1, EventID: event.EventID, EventType: event.Type, Payload: datatypes.JSON(payload), OccurredAt: event.OccurredAt, LockedBy: &claimToken}}}
	publisher := &recordingPublisher{}
	relay := newOutboxRelay(repo, publisher, "instance-a")
	relay.now = func() time.Time { return now }
	if err := relay.PublishBatch(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(publisher.events) != 1 || publisher.events[0].EventID != event.EventID {
		t.Fatalf("Relay 未按原事件 ID 发布: %+v", publisher.events)
	}
	if len(repo.publishedIDs) != 1 || repo.publishedIDs[0] != 1 || len(repo.publishedTokens) != 1 || repo.publishedTokens[0] != claimToken || len(repo.failedIDs) != 0 {
		t.Fatalf("成功后未按认领令牌标记 Outbox: %+v", repo)
	}
}

func TestOutboxRelayRetriesFailureWithoutDroppingEvent(t *testing.T) {
	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	event := NewEvent(EventNewMessage, nil, map[string]any{"message_id": models.ID(9)})
	payload, _ := json.Marshal(event.Data)
	repo := &fakeOutboxRepository{records: []models.RealtimeOutbox{{ID: 1, EventID: event.EventID, EventType: event.Type, Payload: datatypes.JSON(payload), OccurredAt: event.OccurredAt}}}
	publisher := &recordingPublisher{err: errors.New("redis unavailable")}
	relay := newOutboxRelay(repo, publisher, "instance-a")
	relay.now = func() time.Time { return now }
	if err := relay.PublishBatch(context.Background()); err == nil {
		t.Fatal("发布失败必须返回错误并保留待重试记录")
	}
	if len(repo.publishedIDs) != 0 || len(repo.failedIDs) != 1 || repo.failedAttempt != 1 {
		t.Fatalf("失败记录被错误完成或未更新尝试次数: %+v", repo)
	}
	if !repo.availableAt.Equal(now.Add(time.Second)) {
		t.Fatalf("首次重试退避应为 1 秒: %s", repo.availableAt)
	}
}
