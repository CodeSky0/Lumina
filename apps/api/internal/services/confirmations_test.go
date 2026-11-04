package services

import (
	"testing"

	"lumina/api/internal/models"
)

func TestConfirmationPermissions(t *testing.T) {
	admin := models.User{ID: 1, Role: models.RoleAdmin}
	owner := models.User{ID: 2, Role: models.RoleTeacher}
	other := models.User{ID: 3, Role: models.RoleTeacher}
	classroom := models.User{ID: 4, Role: models.RoleClassroom}
	if !canViewConfirmations(admin, 99) {
		t.Fatal("管理员应能查看确认进度")
	}
	if !canViewConfirmations(owner, 2) {
		t.Fatal("发送者应能查看自己的消息确认进度")
	}
	if canViewConfirmations(other, 2) {
		t.Fatal("无关教师不能读取其他教师的确认进度")
	}
	if err := requireClassroomConfirmation(classroom); err != nil {
		t.Fatalf("教室角色应能确认紧急通知: %v", err)
	}
	if err := requireClassroomConfirmation(owner); err == nil {
		t.Fatal("教师浏览紧急通知不得写入教室确认记录")
	}
	if err := requireClassroomConfirmation(admin); err == nil {
		t.Fatal("管理员查看确认进度不得写入教室确认记录")
	}
}
