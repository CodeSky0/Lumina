package realtime

import (
	"context"
	"database/sql/driver"
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
	return []string{"id", "event_id", "event_type", "channel_id", "payload", "occurred_at", "created_at", "published_at", "attempts", "available_at", "locked_at", "locked_by"}
}

func TestOutboxStoreRecordClaimAndCompletion(t *testing.T) {
	store, db, mock := newSQLOutboxStore(t)
	event := NewEvent(EventNewMessage, nil, map[string]any{"message_id": models.ID(9)})
	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "realtime_outbox"`).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()
	if err := store.Record(db, event); err != nil {
		t.Fatal(err)
	}

	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT \* FROM "realtime_outbox" WHERE published_at IS NULL`).WillReturnRows(sqlmock.NewRows(outboxColumns()).AddRow(1, event.EventID, event.Type, nil, []byte(`{"message_id":"9"}`), event.OccurredAt, now, nil, 0, now, nil, nil))
	mock.ExpectExec(`UPDATE "realtime_outbox" SET`).WillReturnResult(driver.RowsAffected(1))
	mock.ExpectCommit()
	records, err := store.Claim(context.Background(), "instance-a", 64, now)
	if err != nil || len(records) != 1 || records[0].EventID != event.EventID {
		t.Fatalf("Outbox 认领错误: records=%+v err=%v", records, err)
	}

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "realtime_outbox" SET`).WillReturnResult(driver.RowsAffected(1))
	mock.ExpectCommit()
	if err := store.MarkPublished(context.Background(), 1, now.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "realtime_outbox" SET`).WillReturnResult(driver.RowsAffected(1))
	mock.ExpectCommit()
	if err := store.MarkFailed(context.Background(), 1, 2, now.Add(4*time.Second)); err != nil {
		t.Fatal(err)
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
