package services

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"lumina/api/internal/models"
)

func newSQLAnnouncementService(t *testing.T) (*AnnouncementService, sqlmock.Sqlmock) {
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
	service := NewAnnouncementService(db, nil)
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
