package realtime

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"lumina/api/internal/models"
)

type Conn interface {
	WriteControl(messageType int, data []byte, deadline time.Time) error
	WriteJSON(value any) error
	ReadJSON(value any) error
	SetReadLimit(limit int64)
	SetReadDeadline(deadline time.Time) error
	SetPongHandler(handler func(appData string) error)
	Close() error
}

type IncomingEvent struct {
	Type      string         `json:"type"`
	ChannelID models.ID      `json:"channel_id"`
	Data      map[string]any `json:"data"`
}

type Client struct {
	id           string
	user         models.User
	channels     map[models.ID]bool
	conn         Conn
	hub          *Hub
	send         chan Event
	done         chan struct{}
	graceful     chan struct{}
	writeDone    chan struct{}
	closeOnce    sync.Once
	gracefulOnce sync.Once
	heartbeat    time.Duration
	pongWait     time.Duration
}

func (c *Client) Close() {
	c.closeOnce.Do(func() {
		close(c.done)
		if c.conn != nil {
			_ = c.conn.Close()
		}
	})
}

func (c *Client) requestGracefulShutdown() {
	c.gracefulOnce.Do(func() { close(c.graceful) })
}

func (c *Client) writeEvent(event Event) error {
	if socket, ok := c.conn.(*websocket.Conn); ok {
		_ = socket.SetWriteDeadline(time.Now().Add(c.pongWait))
	}
	return c.conn.WriteJSON(event)
}

func (c *Client) writeGracefulClose() {
	if err := c.writeEvent(NewEvent(EventServerShutdown, nil, map[string]any{"reason": "maintenance"})); err != nil {
		return
	}
	for {
		select {
		case event := <-c.send:
			if err := c.writeEvent(event); err != nil {
				return
			}
		default:
			_ = c.conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseGoingAway, "server shutdown"), time.Now().Add(10*time.Second))
			return
		}
	}
}

func (c *Client) WritePump() {
	defer close(c.writeDone)
	if c.conn == nil {
		c.Close()
		return
	}
	ticker := time.NewTicker(c.heartbeat)
	defer ticker.Stop()
	defer c.Close()
	for {
		select {
		case <-c.graceful:
			c.writeGracefulClose()
			return
		default:
		}
		select {
		case <-c.graceful:
			c.writeGracefulClose()
			return
		case event := <-c.send:
			if err := c.writeEvent(event); err != nil {
				return
			}
		case <-ticker.C:
			if err := c.conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(10*time.Second)); err != nil {
				return
			}
			if c.hub.presence != nil {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				_ = c.hub.presence.Heartbeat(ctx, c.id)
				cancel()
			}
		case <-c.done:
			return
		}
	}
}

func (c *Client) Run() {
	if c.conn == nil {
		return
	}
	go c.WritePump()
	c.ReadPump()
	<-c.writeDone
}

func (c *Client) ReadPump() {
	if c.conn == nil {
		return
	}
	defer c.hub.Unregister(c)
	c.conn.SetReadLimit(4096)
	_ = c.conn.SetReadDeadline(time.Now().Add(c.pongWait))
	c.conn.SetPongHandler(func(string) error { return c.conn.SetReadDeadline(time.Now().Add(c.pongWait)) })
	for {
		var incoming IncomingEvent
		if err := c.conn.ReadJSON(&incoming); err != nil {
			return
		}
		if incoming.Type != EventTyping {
			continue
		}
		if raw, err := json.Marshal(incoming.Data); err == nil && len(raw) <= 1024 {
			c.hub.handleTyping(c, incoming)
		}
	}
}
