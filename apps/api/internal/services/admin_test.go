package services

import (
	"testing"

	"lumina/api/internal/models"
)

func TestBroadcastValidation(t *testing.T) {
	grade := 2
	classID := models.ID(8)
	valid := []BroadcastChannelInput{{Name: "全校通知", Scope: "school"}, {Name: "二年级", Scope: "grade", Grade: &grade}, {Name: "八班", Scope: "class", TargetClassID: &classID}}
	for _, input := range valid {
		if err := validateBroadcast(input); err != nil {
			t.Fatalf("合法广播被拒绝: %+v %v", input, err)
		}
	}
	invalid := []BroadcastChannelInput{{Name: "全校通知", Scope: "school", Grade: &grade}, {Name: "年级", Scope: "grade"}, {Name: "班级", Scope: "class", Grade: &grade}}
	for _, input := range invalid {
		if err := validateBroadcast(input); err == nil {
			t.Fatalf("非法广播被接受: %+v", input)
		}
	}
}

func TestResourceValidation(t *testing.T) {
	if validPassword("short") || !validPassword("a-secure-password") {
		t.Fatal("密码边界校验错误")
	}
	if validColor("#xyz123") || !validColor("#6366f1") {
		t.Fatal("颜色校验错误")
	}
}
