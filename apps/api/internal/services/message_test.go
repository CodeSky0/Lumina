package services

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"lumina/api/internal/apperror"
	"lumina/api/internal/models"
	"lumina/api/internal/realtime"
)

func TestMessageLengthAndTypeRules(t *testing.T) {
	teacher := models.User{Role: models.RoleTeacher}
	classroom := models.User{Role: models.RoleClassroom}
	valid := SendMessageInput{Type: models.MessageText, Content: strings.Repeat("字", 2000), Metadata: json.RawMessage(`{}`)}
	if err := validateMessage(teacher, valid); err != nil {
		t.Fatalf("二千字文本应合法: %v", err)
	}
	valid.Content += "字"
	if err := validateMessage(teacher, valid); err == nil {
		t.Fatal("超过二千字必须被拒绝")
	}
	if err := validateMessage(classroom, SendMessageInput{Type: models.MessageUrgent, Content: "紧急"}); err == nil {
		t.Fatal("教室不能发送紧急消息")
	}
	if err := validateMessage(teacher, SendMessageInput{Type: models.MessageText, Content: "x", Metadata: json.RawMessage(`[]`)}); err == nil {
		t.Fatal("元数据必须是对象")
	}
}

func TestRecallRulesUseServerTime(t *testing.T) {
	created := time.Date(2026, 10, 30, 8, 0, 0, 0, time.UTC)
	message := models.Message{SenderID: 7, CreatedAt: created}
	if !CanRecall(message, 7, created.Add(2*time.Minute)) {
		t.Fatal("两分钟边界应允许撤回")
	}
	if CanRecall(message, 7, created.Add(2*time.Minute+time.Nanosecond)) {
		t.Fatal("超过两分钟必须拒绝撤回")
	}
	if CanRecall(message, 8, created) {
		t.Fatal("非发送者不能撤回")
	}
	now := created.Add(time.Minute)
	message.DeletedAt = &now
	if CanRecall(message, 7, created.Add(time.Minute)) {
		t.Fatal("已撤回消息不能重复撤回")
	}
}

func TestHistoryCursorLimits(t *testing.T) {
	for input, expected := range map[int]int{0: 50, -1: 50, 1: 1, 100: 100, 101: 100} {
		if actual := normalizeHistoryLimit(input); actual != expected {
			t.Fatalf("limit=%d 得到 %d，期望 %d", input, actual, expected)
		}
	}
}

func TestDeletedMessageDTODoesNotLeakContent(t *testing.T) {
	now := time.Now()
	message := models.Message{ID: 1, ChannelID: 2, SenderID: 3, Content: "机密正文", Metadata: []byte(`{"file_id":"9"}`), DeletedAt: &now}
	dto := toMessageDTO(message, "教师", 0, nil)
	if dto.Content != "" || string(dto.Metadata) != `{}` {
		t.Fatalf("撤回消息仍泄露正文或元数据: %+v", dto)
	}
}

func TestMessageAndWSEventIDsUseSortableStrings(t *testing.T) {
	dto := toMessageDTO(models.Message{ID: 9007199254740993, ChannelID: 2, SenderID: 3, Type: models.MessageText, Content: "消息"}, "教师", 0, nil)
	channelID := dto.ChannelID
	event := realtime.NewEvent(realtime.EventNewMessage, &channelID, map[string]any{"message": dto})
	for name, value := range map[string]any{"HTTP 消息响应": dto, "WS 消息事件": event} {
		payload, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(string(payload), `"id":"9007199254740993"`) {
			t.Fatalf("%s的消息 ID 不是安全字符串: %s", name, payload)
		}
	}
}

func TestBatchRejectsInvalidType(t *testing.T) {
	service := &MessageService{}
	if _, err := service.Batch(context.Background(), 1, []models.ID{1}, "通知", models.MessageText); err == nil {
		t.Fatal("批量接口不能用于普通文本")
	} else if appErr, ok := err.(*apperror.Error); !ok || appErr.Status != 400 {
		t.Fatalf("错误类型不正确: %v", err)
	}
}
