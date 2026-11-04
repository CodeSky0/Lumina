package services

import (
	"encoding/json"
	"strings"
	"testing"

	"lumina/api/internal/models"
	"lumina/api/internal/realtime"
)

func TestAnnouncementInvalidationEventHasScopeButNoSensitiveBody(t *testing.T) {
	grade := 3
	classID := models.ID(8)
	for _, announcement := range []models.Announcement{
		{ID: 9007199254740993, Title: "机密标题", Content: "机密正文", Scope: "grade", Grade: &grade},
		{ID: 9, Title: "机密标题", Content: "机密正文", Scope: "class", TargetClassID: &classID},
	} {
		event := announcementInvalidationEvent(announcement)
		if event.Type != realtime.EventAnnouncementInvalidated || event.ChannelID != nil {
			t.Fatalf("失效事件应为全局事件: %+v", event)
		}
		payload, err := json.Marshal(event)
		if err != nil {
			t.Fatal(err)
		}
		text := string(payload)
		if strings.Contains(text, "机密") || strings.Contains(text, "title") || strings.Contains(text, "content") {
			t.Fatalf("失效事件泄露公告正文或标题: %s", text)
		}
		if announcement.ID == 9007199254740993 && !strings.Contains(text, `"announcement_id":"9007199254740993"`) {
			t.Fatalf("公告 ID 未按字符串安全序列化: %s", text)
		}
	}
}
