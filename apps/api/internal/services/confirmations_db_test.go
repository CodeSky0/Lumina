package services

import (
	"context"
	"database/sql/driver"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"lumina/api/internal/models"
	"lumina/api/internal/realtime"
)

func newSQLAnnouncementService(t *testing.T, recorders ...EventRecorder) (*AnnouncementService, sqlmock.Sqlmock) {
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
	service := NewAnnouncementService(db, nil, recorders...)
	service.now = func() (now time.Time) { return testDatabaseTime }
	return service, mock
}

func TestMessageConfirmationStatusIncludesUnconfirmedClass(t *testing.T) {
	service, mock := newSQLMessageService(t, &fakeMessageMembership{}, nil)
	mock.ExpectQuery(`SELECT \* FROM "messages" WHERE "messages"\."id" = \$1`).WithArgs(models.ID(42), 1).WillReturnRows(messageRow(42))
	mock.ExpectQuery(`SELECT \* FROM "users" WHERE "users"\."id" = \$1`).WithArgs(models.ID(1), 1).WillReturnRows(sqlmock.NewRows([]string{"id", "display_name", "role", "active"}).AddRow(1, "教师", "teacher", true))
	mock.ExpectQuery(`SELECT \* FROM "channels" WHERE "channels"\."id" = \$1`).WithArgs(models.ID(2), 1).WillReturnRows(sqlmock.NewRows([]string{"id", "class_id", "name"}).AddRow(2, 3, "高一（01）班 · 语文"))
	mock.ExpectQuery(`SELECT u\.id AS user_id, c\.id AS class_id, c\.name AS class_name`).WillReturnRows(sqlmock.NewRows([]string{"user_id", "class_id", "class_name", "confirmed_at"}).AddRow(7, 3, "高一（01）班", nil))

	items, err := service.ConfirmationStatus(context.Background(), 1, 42)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Confirmed || items[0].ClassName != "高一（01）班" {
		t.Fatalf("未确认班级没有正确出现在明细中: %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestAnnouncementConfirmationRecordsDirectedEventsForDedupedRecipients(t *testing.T) {
	recorder := &fakeEventRecorder{}
	service, mock := newSQLAnnouncementService(t, recorder)
	mock.ExpectQuery(`SELECT \* FROM "announcements" WHERE id = \$1 AND deleted_at IS NULL`).WithArgs(models.ID(9), 1).WillReturnRows(sqlmock.NewRows([]string{"id", "title", "content", "type", "scope", "publisher_id"}).AddRow(9, "紧急", "内容", "urgent", "school", 1))
	mock.ExpectQuery(`SELECT \* FROM "users" WHERE "users"\."id" = \$1`).WithArgs(models.ID(7), 1).WillReturnRows(sqlmock.NewRows([]string{"id", "username", "display_name", "role", "class_id", "password_hash", "active"}).AddRow(7, "class07", "教室", "classroom", 3, "hash", true))
	mock.ExpectQuery(`SELECT \* FROM "classes" WHERE "classes"\."id" = \$1`).WithArgs(models.ID(3)).WillReturnRows(sqlmock.NewRows([]string{"id", "name", "grade", "active"}).AddRow(3, "高一（01）班", 1, true))
	mock.ExpectQuery(`SELECT \* FROM "users" WHERE "users"\."id" = \$1`).WithArgs(models.ID(7), 1).WillReturnRows(sqlmock.NewRows([]string{"id", "username", "display_name", "role", "class_id", "password_hash", "active"}).AddRow(7, "class07", "教室", "classroom", 3, "hash", true))
	mock.ExpectQuery(`SELECT "id" FROM "users" WHERE role = \$1 AND active = true ORDER BY id ASC`).WithArgs(models.RoleAdmin).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1).AddRow(2))
	mock.ExpectBegin()
	mock.ExpectExec(`INSERT INTO "announcement_confirmations"`).WillReturnResult(driver.RowsAffected(1))
	mock.ExpectQuery(`SELECT \* FROM "announcement_confirmations" WHERE \(announcement_id = \$1 AND user_id = \$2\) AND "announcement_confirmations"\."announcement_id" = \$3 AND "announcement_confirmations"\."user_id" = \$4 ORDER BY "announcement_confirmations"\."announcement_id" LIMIT \$5`).WithArgs(models.ID(9), models.ID(7), models.ID(9), models.ID(7), 1).WillReturnRows(sqlmock.NewRows([]string{"announcement_id", "user_id", "confirmed_at"}).AddRow(9, 7, testDatabaseTime))
	mock.ExpectCommit()

	confirmedAt, err := service.Confirm(context.Background(), 7, 9)
	if err != nil {
		t.Fatal(err)
	}
	if confirmedAt == nil || !confirmedAt.Equal(testDatabaseTime) {
		t.Fatalf("公告确认时间错误: %v", confirmedAt)
	}
	if len(recorder.events) != 3 {
		t.Fatalf("定向事件接收者未去重: %+v", recorder.events)
	}
	eventIDs := map[string]bool{}
	for i, recipientID := range []models.ID{1, 2, 7} {
		event := recorder.events[i]
		if event.Type != realtime.EventUrgentConfirmed || event.ChannelID != nil || event.RecipientUserID == nil || *event.RecipientUserID != recipientID || event.Data["user_id"] != models.ID(7) {
			t.Fatalf("公告定向事件错误: %+v", event)
		}
		if eventIDs[event.EventID] {
			t.Fatalf("不同接收者复用了 Outbox 事件 ID: %+v", recorder.events)
		}
		eventIDs[event.EventID] = true
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestAnnouncementConfirmationStatusUsesScope(t *testing.T) {
	service, mock := newSQLAnnouncementService(t)
	mock.ExpectQuery(`SELECT \* FROM "announcements" WHERE "announcements"\."id" = \$1`).WithArgs(models.ID(9), 1).WillReturnRows(sqlmock.NewRows([]string{"id", "title", "content", "type", "scope", "publisher_id"}).AddRow(9, "紧急", "内容", "urgent", "school", 1))
	mock.ExpectQuery(`SELECT \* FROM "users" WHERE "users"\."id" = \$1`).WithArgs(models.ID(1), 1).WillReturnRows(sqlmock.NewRows([]string{"id", "display_name", "role", "active"}).AddRow(1, "管理员", "admin", true))
	mock.ExpectQuery(`SELECT u\.id AS user_id, c\.id AS class_id, c\.name AS class_name`).WillReturnRows(sqlmock.NewRows([]string{"user_id", "class_id", "class_name", "confirmed_at"}).AddRow(7, 3, "高一（01）班", testDatabaseTime))

	items, err := service.ConfirmationStatus(context.Background(), 1, 9)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || !items[0].Confirmed || items[0].ConfirmedAt == nil || !items[0].ConfirmedAt.Equal(testDatabaseTime) {
		t.Fatalf("公告确认时间和状态错误: %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
