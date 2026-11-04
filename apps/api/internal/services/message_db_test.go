package services

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"lumina/api/internal/models"
	"lumina/api/internal/realtime"
)

const testClientMessageID = "550e8400-e29b-41d4-a716-446655440000"

var testDatabaseTime = time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)

type fakeMessageMembership struct {
	writeCalls  int
	accessCalls int
	channels    []models.Channel
}

func (m *fakeMessageMembership) RequireWrite(_ context.Context, _, _ models.ID) error {
	m.writeCalls++
	return nil
}
func (m *fakeMessageMembership) RequireAccess(_ context.Context, _, _ models.ID) error {
	m.accessCalls++
	return nil
}
func (m *fakeMessageMembership) AccessibleChannels(_ context.Context, _ models.ID) ([]models.Channel, *models.User, error) {
	return m.channels, &models.User{ID: 1, Role: models.RoleTeacher}, nil
}

type fakeEventRecorder struct {
	events []realtime.Event
}

func (r *fakeEventRecorder) Record(_ *gorm.DB, event realtime.Event) error {
	r.events = append(r.events, event)
	return nil
}

type fakeMessagePublisher struct {
	events []realtime.Event
}

func (p *fakeMessagePublisher) Publish(_ context.Context, event realtime.Event) error {
	p.events = append(p.events, event)
	return nil
}

func newSQLMessageService(t *testing.T, membership MessageMembership, publisher realtime.Publisher, recorders ...EventRecorder) (*MessageService, sqlmock.Sqlmock) {
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
	service := NewMessageService(db, membership, publisher, recorders...)
	service.now = func() time.Time { return testDatabaseTime }
	return service, mock
}

func expectSenderQuery(mock sqlmock.Sqlmock, userID models.ID) {
	mock.ExpectQuery(`SELECT \* FROM "users"`).WithArgs(userID, 1).WillReturnRows(sqlmock.NewRows([]string{"id", "username", "display_name", "role", "active"}).AddRow(userID, "teacher", "教师", "teacher", true))
}

func messageColumns() []string {
	return []string{"id", "channel_id", "sender_id", "client_msg_id", "type", "content", "metadata", "reply_to_id", "is_pinned", "created_at", "edited_at", "deleted_at"}
}

func messageRow(id models.ID) *sqlmock.Rows {
	return sqlmock.NewRows(messageColumns()).AddRow(id, 2, 1, testClientMessageID, "text", "内容", []byte(`{}`), nil, false, testDatabaseTime, nil, nil)
}

func textInput() SendMessageInput {
	return SendMessageInput{ClientMsgID: testClientMessageID, Type: models.MessageText, Content: "内容", Metadata: json.RawMessage(`{}`)}
}

func TestMessageSendIdempotentReplayWithSQL(t *testing.T) {
	membership := &fakeMessageMembership{}
	publisher := &fakeMessagePublisher{}
	service, mock := newSQLMessageService(t, membership, publisher)
	expectSenderQuery(mock, 1)
	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT \* FROM "messages" WHERE sender_id = \$1 AND client_msg_id = \$2`).WithArgs(models.ID(1), testClientMessageID, 1).WillReturnRows(messageRow(42))
	mock.ExpectCommit()

	dto, err := service.Send(context.Background(), 1, 2, textInput())
	if err != nil {
		t.Fatal(err)
	}
	if dto.ID != 42 || dto.ClientMsgID == nil || *dto.ClientMsgID != testClientMessageID {
		t.Fatalf("幂等重放未返回首次消息: %+v", dto)
	}
	if len(publisher.events) != 0 || membership.writeCalls != 1 {
		t.Fatalf("重放不应重复发布事件，权限应校验一次: events=%d writes=%d", len(publisher.events), membership.writeCalls)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestMessageSendCreatesAndRecordsEventInTransaction(t *testing.T) {
	membership := &fakeMessageMembership{}
	publisher := &fakeMessagePublisher{}
	recorder := &fakeEventRecorder{}
	service, mock := newSQLMessageService(t, membership, publisher, recorder)
	expectSenderQuery(mock, 1)
	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT \* FROM "messages" WHERE sender_id = \$1 AND client_msg_id = \$2`).WithArgs(models.ID(1), testClientMessageID, 1).WillReturnError(gorm.ErrRecordNotFound)
	mock.ExpectQuery(`INSERT INTO "messages"`).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(42))
	mock.ExpectExec(`INSERT INTO "channel_reads"`).WillReturnResult(driver.RowsAffected(1))
	mock.ExpectCommit()

	dto, err := service.Send(context.Background(), 1, 2, textInput())
	if err != nil {
		t.Fatal(err)
	}
	if dto.ID != 42 || len(recorder.events) != 1 || recorder.events[0].Type != realtime.EventNewMessage {
		t.Fatalf("新消息未在事务内记录事件: dto=%+v events=%+v", dto, recorder.events)
	}
	if len(publisher.events) != 0 {
		t.Fatal("使用 Outbox 时不得直接发布业务事件")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestMessageSendUniqueConflictReturnsCommittedMessage(t *testing.T) {
	service, mock := newSQLMessageService(t, &fakeMessageMembership{}, nil)
	expectSenderQuery(mock, 1)
	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT \* FROM "messages" WHERE sender_id = \$1 AND client_msg_id = \$2`).WithArgs(models.ID(1), testClientMessageID, 1).WillReturnError(gorm.ErrRecordNotFound)
	mock.ExpectQuery(`INSERT INTO "messages"`).WillReturnError(&pgconn.PgError{Code: "23505", Message: "duplicate key"})
	mock.ExpectRollback()
	mock.ExpectQuery(`SELECT \* FROM "messages" WHERE sender_id = \$1 AND client_msg_id = \$2`).WithArgs(models.ID(1), testClientMessageID, 1).WillReturnRows(messageRow(42))

	dto, err := service.Send(context.Background(), 1, 2, textInput())
	if err != nil {
		t.Fatal(err)
	}
	if dto.ID != 42 {
		t.Fatalf("唯一冲突后未返回已提交消息: %+v", dto)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func expectHydrationQueries(mock sqlmock.Sqlmock) {
	mock.ExpectQuery(`SELECT \* FROM "users" WHERE "users"\."id" = \$1`).WithArgs(models.ID(1)).WillReturnRows(sqlmock.NewRows([]string{"id", "display_name"}).AddRow(1, "教师"))
	mock.ExpectQuery(`SELECT mr\.message_id, COUNT\(\*\) AS count FROM message_reads`).WillReturnRows(sqlmock.NewRows([]string{"message_id", "count"}).AddRow(41, 1).AddRow(42, 0))
	mock.ExpectQuery(`SELECT md\.message_id, COUNT\(\*\) AS count FROM message_deliveries`).WillReturnRows(sqlmock.NewRows([]string{"message_id", "count"}).AddRow(41, 1).AddRow(42, 1))
	mock.ExpectQuery(`SELECT \* FROM "message_confirmations"`).WillReturnRows(sqlmock.NewRows([]string{"message_id", "user_id", "confirmed_at"}))
}

func TestMessageSyncUsesCursorAndHydratesCounts(t *testing.T) {
	membership := &fakeMessageMembership{}
	service, mock := newSQLMessageService(t, membership, nil)
	mock.ExpectQuery(`SELECT \* FROM "messages" WHERE channel_id = \$1 AND id > \$2`).WithArgs(models.ID(2), models.ID(40), 51).WillReturnRows(messageRow(41).AddRow(42, 2, 1, testClientMessageID, "text", "下一条", []byte(`{}`), nil, false, testDatabaseTime, nil, nil))
	expectHydrationQueries(mock)

	result, err := service.Sync(context.Background(), 7, 2, 40, 50)
	if err != nil {
		t.Fatal(err)
	}
	if result.HasMore || result.NextAfterID == nil || *result.NextAfterID != 42 || len(result.Items) != 2 {
		t.Fatalf("增量同步游标或结果错误: %+v", result)
	}
	if result.Items[0].ReadCount != 1 || result.Items[0].DeliveryCount != 1 || result.Items[1].Content != "下一条" {
		t.Fatalf("消息回执计数或顺序错误: %+v", result.Items)
	}
	if membership.accessCalls != 1 {
		t.Fatalf("同步必须重新校验通道权限: %d", membership.accessCalls)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestDeliveryAcknowledgementBatchIsIdempotentAndAuthorized(t *testing.T) {
	membership := &fakeMessageMembership{}
	recorder := &fakeEventRecorder{}
	service, mock := newSQLMessageService(t, membership, nil, recorder)
	mock.ExpectQuery(`SELECT \* FROM "messages" WHERE id IN`).WithArgs(models.ID(41), models.ID(42)).WillReturnRows(messageRow(41).AddRow(42, 2, 1, testClientMessageID, "text", "下一条", []byte(`{}`), nil, false, testDatabaseTime, nil, nil))
	mock.ExpectBegin()
	mock.ExpectExec(`INSERT INTO "message_deliveries"`).WillReturnResult(driver.RowsAffected(2))
	mock.ExpectQuery(`SELECT count\(\*\) FROM "message_deliveries" WHERE message_id = \$1 AND user_id <> \$2`).WithArgs(models.ID(41), models.ID(1)).WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(`SELECT count\(\*\) FROM "message_deliveries" WHERE message_id = \$1 AND user_id <> \$2`).WithArgs(models.ID(42), models.ID(1)).WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
	mock.ExpectCommit()

	if err := service.AcknowledgeDeliveries(context.Background(), 7, []models.ID{41, 42, 41}); err != nil {
		t.Fatal(err)
	}
	if membership.accessCalls != 2 || len(recorder.events) != 2 {
		t.Fatalf("每条消息都应校验权限并产生回执事件: accesses=%d events=%d", membership.accessCalls, len(recorder.events))
	}
	if recorder.events[0].Type != realtime.EventDeliveryAck || recorder.events[0].Data["delivery_count"] != int64(1) || recorder.events[1].Data["delivery_count"] != int64(2) {
		t.Fatalf("delivery ACK 计数事件错误: %+v", recorder.events)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
