package realtime

import (
	"context"
	"testing"
	"time"

	"lumina/api/internal/models"
)

func testClient(hub *Hub, userID models.ID, channels ...models.ID) *Client {
	return hub.NewClient(uuidString(userID), models.User{ID: userID, DisplayName: "测试用户", Role: models.RoleClassroom, Active: true}, channels, nil)
}
func uuidString(id models.ID) string { return "connection-" + id.String() }

type mutableAuthorizer struct{ allowed bool }

func (a *mutableAuthorizer) CanAccess(_ context.Context, _, _ models.ID) (bool, error) {
	return a.allowed, nil
}

func drain(client *Client) {
	for {
		select {
		case <-client.send:
		default:
			return
		}
	}
}

func TestHubFanoutAndChannelIsolation(t *testing.T) {
	hub := NewHub(nil, nil, nil)
	first := testClient(hub, 1, 10)
	second := testClient(hub, 2, 10)
	outsider := testClient(hub, 3, 11)
	hub.Register(first)
	hub.Register(second)
	hub.Register(outsider)
	drain(first)
	drain(second)
	drain(outsider)
	channel := models.ID(10)
	event := NewEvent(EventNewMessage, &channel, map[string]any{"message_id": "1"})
	hub.Broadcast(event)
	for _, client := range []*Client{first, second} {
		select {
		case received := <-client.send:
			if received.EventID != event.EventID {
				t.Fatal("事件 ID 不一致")
			}
		case <-time.After(time.Second):
			t.Fatal("目标通道未收到事件")
		}
	}
	select {
	case <-outsider.send:
		t.Fatal("其他通道收到泄露事件")
	default:
	}
	hub.Unregister(first)
	hub.Unregister(second)
	hub.Unregister(outsider)
}

func TestDuplicateRegistrationDoesNotDuplicateDelivery(t *testing.T) {
	hub := NewHub(nil, nil, nil)
	client := testClient(hub, 1, 10)
	hub.Register(client)
	hub.Register(client)
	drain(client)
	channel := models.ID(10)
	hub.Broadcast(NewEvent(EventTyping, &channel, map[string]any{}))
	<-client.send
	select {
	case <-client.send:
		t.Fatal("重复注册造成重复投递")
	default:
	}
}

func TestSlowClientIsEvicted(t *testing.T) {
	hub := NewHub(nil, nil, nil)
	hub.queueSize = 1
	client := testClient(hub, 1, 10)
	hub.Register(client)
	drain(client)
	channel := models.ID(10)
	hub.Broadcast(NewEvent(EventNewMessage, &channel, map[string]any{"n": 1}))
	hub.Broadcast(NewEvent(EventNewMessage, &channel, map[string]any{"n": 2}))
	select {
	case <-client.done:
	case <-time.After(time.Second):
		t.Fatal("有界队列满后未剔除慢连接")
	}
	hub.mu.Lock()
	_, exists := hub.clients[client]
	hub.mu.Unlock()
	if exists {
		t.Fatal("慢连接仍保留在 Hub 中")
	}
}

func TestHubRechecksChannelPermissionBeforeDelivery(t *testing.T) {
	authorizer := &mutableAuthorizer{allowed: true}
	hub := NewHub(authorizer, nil, nil)
	client := testClient(hub, 1, 10)
	hub.Register(client)
	drain(client)
	authorizer.allowed = false
	channel := models.ID(10)
	hub.Broadcast(NewEvent(EventNewMessage, &channel, map[string]any{"message_id": models.ID(1)}))
	select {
	case <-client.send:
		t.Fatal("权限收回后仍收到通道事件")
	default:
	}
	authorizer.allowed = true
	hub.Broadcast(NewEvent(EventNewMessage, &channel, map[string]any{"message_id": models.ID(2)}))
	select {
	case <-client.send:
	case <-time.After(time.Second):
		t.Fatal("恢复权限后未收到通道事件")
	}
}

func TestGlobalInvalidationDoesNotRequireChannelSnapshot(t *testing.T) {
	authorizer := &mutableAuthorizer{allowed: false}
	hub := NewHub(authorizer, nil, nil)
	client := testClient(hub, 1)
	hub.Register(client)
	hub.Broadcast(NewEvent(EventAnnouncementInvalidated, nil, map[string]any{"announcement_id": models.ID(1), "scope": "class"}))
	select {
	case event := <-client.send:
		if event.ChannelID != nil || event.Type != EventAnnouncementInvalidated {
			t.Fatalf("全局失效事件错误: %+v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("在线客户端未收到全局失效事件")
	}
}

func TestHeartbeatConfiguration(t *testing.T) {
	if HeartbeatInterval != 25*time.Second || PongWait != 60*time.Second {
		t.Fatal("心跳或读取超时配置不符合契约")
	}
	hub := NewHub(nil, nil, nil)
	client := testClient(hub, 1)
	if client.heartbeat != 25*time.Second || cap(client.send) != DefaultOutboundQueue {
		t.Fatal("客户端心跳或有界队列未初始化")
	}
}
