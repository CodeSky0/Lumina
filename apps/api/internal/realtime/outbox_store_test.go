package realtime

import (
	"context"
	"database/sql/driver"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"lumina/api/internal/models"
)

func newSQLOutboxStore(t *testing.T) (*OutboxStore, *gorm.DB, sqlmock.Sqlmock) {
	t.Helper()
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	db, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{DisableAutomaticPing: true})
	if err != nil {
		t.Fatal(err)
	}
	return NewOutboxStore(db), db, mock
}

func outboxColumns() []string {
	return []string{"id", "event_id", "event_type", "channel_id", "payload", "occurred_at", "created_at", "published_at", "attempts", "available_at", "locked_at", "locked_by", "recipient_user_id"}
}

func TestOutboxStoreRecordClaimAndCompletion(t *testing.T) {
	store, db, mock := newSQLOutboxStore(t)
	event := NewEvent(EventNewMessage, nil, map[string]any{"message_id": models.ID(9)})
	recipientID := models.ID(8)
	event.RecipientUserID = &recipientID
	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "realtime_outbox"`).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()
	if err := store.Record(db, event); err != nil {
		t.Fatal(err)
	}

	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT \* FROM "realtime_outbox" WHERE published_at IS NULL`).WillReturnRows(sqlmock.NewRows(outboxColumns()).AddRow(1, event.EventID, event.Type, nil, []byte(`{"message_id":"9"}`), event.OccurredAt, now, nil, 0, now, nil, nil, recipientID))
	mock.ExpectExec(`UPDATE "realtime_outbox" SET`).WillReturnResult(driver.RowsAffected(1))
	mock.ExpectCommit()
	records, err := store.Claim(context.Background(), "instance-a", 64, now)
	if err != nil || len(records) != 1 || records[0].EventID != event.EventID || records[0].LockedBy == nil || *records[0].LockedBy == "" {
		t.Fatalf("Outbox 认领错误: records=%+v err=%v", records, err)
	}
	if records[0].RecipientUserID == nil || *records[0].RecipientUserID != recipientID {
		t.Fatalf("Outbox 定向接收者未保留: %+v", records[0])
	}

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "realtime_outbox" SET .* locked_by =`).WillReturnResult(driver.RowsAffected(1))
	mock.ExpectCommit()
	if err := store.MarkPublished(context.Background(), 1, *records[0].LockedBy, now.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "realtime_outbox" SET .* locked_by =`).WillReturnResult(driver.RowsAffected(1))
	mock.ExpectCommit()
	if err := store.MarkFailed(context.Background(), 1, *records[0].LockedBy, 2, now.Add(4*time.Second)); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestOutboxStoreRejectsStaleWorkerAfterLeaseTakeover(t *testing.T) {
	store, _, mock := newSQLOutboxStore(t)
	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	event := NewEvent(EventNewMessage, nil, map[string]any{"message_id": models.ID(9)})
	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT \* FROM "realtime_outbox" WHERE published_at IS NULL`).WillReturnRows(sqlmock.NewRows(outboxColumns()).AddRow(1, event.EventID, event.Type, nil, []byte(`{"message_id":"9"}`), event.OccurredAt, now, nil, 0, now, nil, nil, nil))
	mock.ExpectExec(`UPDATE "realtime_outbox" SET`).WillReturnResult(driver.RowsAffected(1))
	mock.ExpectCommit()
	first, err := store.Claim(context.Background(), "worker-a", 1, now)
	if err != nil || len(first) != 1 || first[0].LockedBy == nil {
		t.Fatalf("首次认领失败: records=%+v err=%v", first, err)
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT \* FROM "realtime_outbox" WHERE published_at IS NULL`).WillReturnRows(sqlmock.NewRows(outboxColumns()).AddRow(1, event.EventID, event.Type, nil, []byte(`{"message_id":"9"}`), event.OccurredAt, now, nil, 0, now, now, *first[0].LockedBy, nil))
	mock.ExpectExec(`UPDATE "realtime_outbox" SET`).WillReturnResult(driver.RowsAffected(1))
	mock.ExpectCommit()
	second, err := store.Claim(context.Background(), "worker-b", 1, now.Add(outboxLease+time.Second))
	if err != nil || len(second) != 1 || second[0].LockedBy == nil || *second[0].LockedBy == *first[0].LockedBy {
		t.Fatalf("过期接管未生成独立令牌: first=%+v second=%+v err=%v", first, second, err)
	}

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "realtime_outbox" SET .* WHERE id = .* AND published_at IS NULL AND locked_by =`).WillReturnResult(driver.RowsAffected(0))
	mock.ExpectCommit()
	if err := store.MarkPublished(context.Background(), 1, *first[0].LockedBy, now.Add(2*outboxLease)); !errors.Is(err, ErrOutboxLeaseLost) {
		t.Fatalf("旧 worker 完成回写必须失败: %v", err)
	}
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "realtime_outbox" SET .* WHERE id = .* AND published_at IS NULL AND locked_by =`).WillReturnResult(driver.RowsAffected(0))
	mock.ExpectCommit()
	if err := store.MarkFailed(context.Background(), 1, *first[0].LockedBy, 1, now.Add(3*outboxLease)); !errors.Is(err, ErrOutboxLeaseLost) {
		t.Fatalf("旧 worker 失败回写必须失败: %v", err)
	}
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "realtime_outbox" SET .* WHERE id = .* AND published_at IS NULL AND locked_by =`).WillReturnResult(driver.RowsAffected(1))
	mock.ExpectCommit()
	if err := store.MarkPublished(context.Background(), 1, *second[0].LockedBy, now.Add(2*outboxLease)); err != nil {
		t.Fatalf("当前 worker 回写失败: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestOutboxRecordRejectsInvalidEventID(t *testing.T) {
	store, db, _ := newSQLOutboxStore(t)
	event := NewEvent(EventNewMessage, nil, map[string]any{})
	event.EventID = "not-a-uuid"
	if err := store.Record(db, event); err == nil {
		t.Fatal("非法事件 ID 不得写入 Outbox")
	}
}

func TestOutboxRelayRunStopsWithContext(t *testing.T) {
	repo := &fakeOutboxRepository{}
	relay := NewOutboxRelay(nil, &recordingPublisher{}, "instance-a")
	relay.repo = repo
	relay.pollInterval = time.Millisecond
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		relay.Run(ctx)
		close(done)
	}()
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Relay 未随 context 停止")
	}
}
