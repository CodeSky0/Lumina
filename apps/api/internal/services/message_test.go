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

func TestClientMessageIDValidation(t *testing.T) {
	id, err := normalizeClientMessageID("550E8400-E29B-41D4-A716-446655440000")
	if err != nil || id == nil || *id != "550e8400-e29b-41d4-a716-446655440000" {
		t.Fatalf("UUID 应被规范化: id=%v err=%v", id, err)
	}
	if id, err := normalizeClientMessageID(""); err != nil || id != nil {
		t.Fatalf("旧客户端的空幂等键应保持兼容: id=%v err=%v", id, err)
	}
	if _, err := normalizeClientMessageID("not-a-uuid"); err == nil {
		t.Fatal("非法幂等键必须被拒绝")
	} else if appErr, ok := err.(*apperror.Error); !ok || appErr.Code != "CLIENT_MSG_ID_INVALID" {
		t.Fatalf("非法幂等键错误不正确: %v", err)
	}
}

func TestMessageIdempotencyPayloadComparison(t *testing.T) {
	clientID := "550e8400-e29b-41d4-a716-446655440000"
	replyID := models.ID(9)
	message := models.Message{ChannelID: 2, SenderID: 3, ClientMsgID: &clientID, Type: models.MessageText, Content: "内容", Metadata: []byte(`{"a":1,"b":2}`), ReplyToID: &replyID}
	input := SendMessageInput{ClientMsgID: clientID, Type: models.MessageText, Content: "内容", Metadata: json.RawMessage(`{"b":2,"a":1}`), ReplyToID: &replyID}
	if !sameMessageRequest(message, 2, input) {
		t.Fatal("语义相同的 JSON 元数据应被视为同一请求")
	}
	input.Content = "不同内容"
	if sameMessageRequest(message, 2, input) {
		t.Fatal("正文变化必须触发幂等冲突")
	}
	input.Content = message.Content
	if sameMessageRequest(message, 4, input) {
		t.Fatal("通道变化必须触发幂等冲突")
	}
	otherReply := models.ID(10)
	input.ReplyToID = &otherReply
	if sameMessageRequest(message, 2, input) {
		t.Fatal("回复目标变化必须触发幂等冲突")
	}
}

func TestBatchTargetsRejectsDuplicates(t *testing.T) {
	service := &MessageService{}
	targets := []BatchTarget{{ChannelID: 1, ClientMsgID: "550e8400-e29b-41d4-a716-446655440000"}, {ChannelID: 1, ClientMsgID: "660e8400-e29b-41d4-a716-446655440000"}}
	if _, err := service.BatchTargets(context.Background(), 1, targets, "通知", models.MessageNotice); err == nil {
		t.Fatal("批量目标通道不能重复")
	} else if appErr, ok := err.(*apperror.Error); !ok || appErr.Code != "CHANNEL_DUPLICATE" {
		t.Fatalf("重复通道错误不正确: %v", err)
	}
}

func TestDeliveryAcknowledgementInputRules(t *testing.T) {
	if _, err := normalizeDeliveryIDs(nil); err == nil {
		t.Fatal("空 delivery ACK 必须被拒绝")
	}
	tooMany := make([]models.ID, 101)
	if _, err := normalizeDeliveryIDs(tooMany); err == nil {
		t.Fatal("单批 delivery ACK 不能超过 100 条")
	}
	ids, err := normalizeDeliveryIDs([]models.ID{3, 2, 3, 1, 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(ids) != 3 || ids[0] != 3 || ids[1] != 2 || ids[2] != 1 {
		t.Fatalf("delivery ACK 应按首次出现顺序去重: %v", ids)
	}
}

func TestMessageDTOCarriesClientIDAndDeliveryState(t *testing.T) {
	clientID := "550e8400-e29b-41d4-a716-446655440000"
	message := models.Message{ID: 1, ChannelID: 2, SenderID: 3, ClientMsgID: &clientID, Type: models.MessageText, Content: "消息"}
	dto := toMessageDTO(message, "教师", 0, nil)
	dto.DeliveryCount = 1
	payload, err := json.Marshal(dto)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(payload), `"client_msg_id":"550e8400-e29b-41d4-a716-446655440000"`) || !strings.Contains(string(payload), `"delivery_count":1`) {
		t.Fatalf("消息 DTO 缺少幂等键或投递状态: %s", payload)
	}
}
