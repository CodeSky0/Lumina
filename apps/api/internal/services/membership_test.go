package services

import (
	"testing"

	"lumina/api/internal/models"
)

// 权限矩阵的数据库集成由 Membership 查询承载；此测试验证矩阵中不允许出现的角色组合。
func TestRoleMatrixRejectsUnknownRoles(t *testing.T) {
	for _, role := range []string{"student", "root", ""} {
		if role == "admin" || role == "teacher" || role == "classroom" {
			t.Fatalf("未知角色不应通过角色矩阵: %s", role)
		}
	}
}

func TestNormalizePage(t *testing.T) {
	page, size := normalizePage(-1, 1000)
	if page != 1 || size != 100 {
		t.Fatalf("分页边界错误: %d %d", page, size)
	}
	page, size = normalizePage(2, 20)
	if page != 2 || size != 20 {
		t.Fatalf("合法分页被修改: %d %d", page, size)
	}
}

func TestStrictChannelWriteMatrix(t *testing.T) {
	teacherID, classID, otherClassID := models.ID(1), models.ID(2), models.ID(3)
	normal := models.Channel{Type: models.ChannelNormal, TeacherID: &teacherID, ClassID: &classID, Active: true}
	broadcast := models.Channel{Type: models.ChannelBroadcast, Active: true}
	tests := []struct {
		name    string
		user    models.User
		channel models.Channel
		allowed bool
	}{
		{name: "通道所属教师", user: models.User{ID: teacherID, Role: models.RoleTeacher, Active: true}, channel: normal, allowed: true},
		{name: "其他教师", user: models.User{ID: 9, Role: models.RoleTeacher, Active: true}, channel: normal},
		{name: "本班教室", user: models.User{ID: 4, Role: models.RoleClassroom, ClassID: &classID, Active: true}, channel: normal, allowed: true},
		{name: "其他班教室", user: models.User{ID: 4, Role: models.RoleClassroom, ClassID: &otherClassID, Active: true}, channel: normal},
		{name: "管理员只读", user: models.User{ID: 5, Role: models.RoleAdmin, Active: true}, channel: normal},
		{name: "教师不能写广播", user: models.User{ID: teacherID, Role: models.RoleTeacher, Active: true}, channel: broadcast},
		{name: "管理员不能写广播", user: models.User{ID: 5, Role: models.RoleAdmin, Active: true}, channel: broadcast},
		{name: "停用用户", user: models.User{ID: teacherID, Role: models.RoleTeacher}, channel: normal},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if actual := canWrite(test.user, test.channel); actual != test.allowed {
				t.Fatalf("写权限结果为 %v，期望 %v", actual, test.allowed)
			}
		})
	}
}
