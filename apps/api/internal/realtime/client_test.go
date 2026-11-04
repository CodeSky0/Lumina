package realtime

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"lumina/api/internal/models"
)

type fakeWrite struct {
	kind  string
	code  int
	event Event
}

type fakeConn struct {
	mu        sync.Mutex
	writes    []fakeWrite
	readErr   chan error
	closeOnce sync.Once
}

func newFakeConn() *fakeConn {
	return &fakeConn{readErr: make(chan error)}
}

func (c *fakeConn) WriteControl(messageType int, _ []byte, _ time.Time) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.writes = append(c.writes, fakeWrite{kind: "close", code: messageType})
	return nil
}

func (c *fakeConn) WriteJSON(value any) error {
	event, ok := value.(Event)
	if !ok {
		return errors.New("unexpected JSON payload")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.writes = append(c.writes, fakeWrite{kind: "event", event: event})
	return nil
}

func (c *fakeConn) ReadJSON(_ any) error {
	err, ok := <-c.readErr
	if !ok {
		return errors.New("connection closed")
	}
	return err
}

func (c *fakeConn) SetReadLimit(_ int64)                {}
func (c *fakeConn) SetReadDeadline(_ time.Time) error   { return nil }
func (c *fakeConn) SetPongHandler(_ func(string) error) {}
func (c *fakeConn) Close() error {
	c.closeOnce.Do(func() { close(c.readErr) })
	return nil
}

func (c *fakeConn) snapshotWrites() []fakeWrite {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]fakeWrite(nil), c.writes...)
}

func TestClientGracefulShutdownDrainsAndStops(t *testing.T) {
	hub := NewHub(nil, nil, nil)
	conn := newFakeConn()
	client := hub.NewClient("connection-1", models.User{ID: 1, Role: models.RoleClassroom, Active: true}, nil, conn)
	hub.Register(client)
	channelID := models.ID(8)
	queued := NewEvent(EventNewMessage, &channelID, map[string]any{"message_id": models.ID(9)})
	client.send <- queued
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	shutdownResult := make(chan error, 1)
	go func() { shutdownResult <- hub.Shutdown(ctx) }()
	select {
	case <-client.graceful:
	case <-time.After(time.Second):
		t.Fatal("Hub 未发送优雅关闭请求")
	}
	runDone := make(chan struct{})
	go func() {
		client.Run()
		close(runDone)
	}()
	if err := <-shutdownResult; err != nil {
		t.Fatal(err)
	}
	select {
	case <-runDone:
	case <-time.After(time.Second):
		t.Fatal("Client.Run 未在优雅关闭后退出")
	}
	writes := conn.snapshotWrites()
	if len(writes) != 3 {
		t.Fatalf("应依次写维护事件、排队事件和 Close 帧: %+v", writes)
	}
	if writes[0].event.Type != EventServerShutdown || writes[1].event.EventID != queued.EventID || writes[2].kind != "close" || writes[2].code != websocket.CloseMessage {
		t.Fatalf("优雅关闭写入顺序错误: %+v", writes)
	}
}

func TestHubRejectsRegistrationAfterShutdown(t *testing.T) {
	hub := NewHub(nil, nil, nil)
	if err := hub.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
	conn := newFakeConn()
	client := hub.NewClient("connection-late", models.User{ID: 2, Role: models.RoleTeacher, Active: true}, nil, conn)
	if hub.Register(client) {
		t.Fatal("Hub 关闭后不得接收新连接")
	}
	select {
	case <-client.done:
	default:
		t.Fatal("被拒绝的连接未清理")
	}
}
