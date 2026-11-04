package realtime

import (
	"context"
	"sync"
	"time"

	"lumina/api/internal/models"
)

const (
	DefaultOutboundQueue = 64
	HeartbeatInterval    = 25 * time.Second
	PongWait             = 60 * time.Second
)

type ChannelAuthorizer interface {
	CanAccess(ctx context.Context, userID, channelID models.ID) (bool, error)
}

type PresenceTracker interface {
	Register(ctx context.Context, connectionID string, userID models.ID, channelIDs []models.ID) error
	Heartbeat(ctx context.Context, connectionID string) error
	Unregister(ctx context.Context, connectionID string) error
	ChannelOnline(ctx context.Context, channelID models.ID) (bool, error)
}

type Hub struct {
	mu         sync.Mutex
	clients    map[*Client]struct{}
	byUser     map[models.ID]map[*Client]struct{}
	byChannel  map[models.ID]map[*Client]struct{}
	queueSize  int
	authorizer ChannelAuthorizer
	publisher  Publisher
	presence   PresenceTracker
	closing    bool
	clientsWG  sync.WaitGroup
}

func NewHub(authorizer ChannelAuthorizer, publisher Publisher, presence PresenceTracker) *Hub {
	return &Hub{clients: map[*Client]struct{}{}, byUser: map[models.ID]map[*Client]struct{}{}, byChannel: map[models.ID]map[*Client]struct{}{}, queueSize: DefaultOutboundQueue, authorizer: authorizer, publisher: publisher, presence: presence}
}

func (h *Hub) NewClient(connectionID string, user models.User, channelIDs []models.ID, conn Conn) *Client {
	channels := make(map[models.ID]bool, len(channelIDs))
	for _, id := range channelIDs {
		channels[id] = true
	}
	return &Client{id: connectionID, user: user, channels: channels, conn: conn, hub: h, send: make(chan Event, h.queueSize), done: make(chan struct{}), graceful: make(chan struct{}), writeDone: make(chan struct{}), heartbeat: HeartbeatInterval, pongWait: PongWait}
}

func (h *Hub) Register(client *Client) bool {
	h.mu.Lock()
	if h.closing {
		h.mu.Unlock()
		client.Close()
		return false
	}
	if _, exists := h.clients[client]; exists {
		h.mu.Unlock()
		return true
	}
	h.clients[client] = struct{}{}
	h.clientsWG.Add(1)
	if h.byUser[client.user.ID] == nil {
		h.byUser[client.user.ID] = map[*Client]struct{}{}
	}
	h.byUser[client.user.ID][client] = struct{}{}
	channelIDs := make([]models.ID, 0, len(client.channels))
	for channelID := range client.channels {
		if h.byChannel[channelID] == nil {
			h.byChannel[channelID] = map[*Client]struct{}{}
		}
		h.byChannel[channelID][client] = struct{}{}
		channelIDs = append(channelIDs, channelID)
	}
	h.mu.Unlock()
	if h.presence != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		_ = h.presence.Register(ctx, client.id, client.user.ID, channelIDs)
		cancel()
	}
	for _, channelID := range channelIDs {
		id := channelID
		h.emit(context.Background(), NewEvent(EventPresence, &id, map[string]any{"user_id": client.user.ID, "online": true}))
	}
	return true
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	_, registered := h.clients[client]
	offlineChannels := h.unregisterLocked(client)
	h.mu.Unlock()
	if registered {
		defer h.clientsWG.Done()
	}
	if h.presence != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		_ = h.presence.Unregister(ctx, client.id)
		cancel()
	}
	client.Close()
	for _, channelID := range offlineChannels {
		id := channelID
		h.emit(context.Background(), NewEvent(EventPresence, &id, map[string]any{"user_id": client.user.ID, "online": false}))
	}
}

func (h *Hub) unregisterLocked(client *Client) []models.ID {
	if _, exists := h.clients[client]; !exists {
		return nil
	}
	delete(h.clients, client)
	if users := h.byUser[client.user.ID]; users != nil {
		delete(users, client)
		if len(users) == 0 {
			delete(h.byUser, client.user.ID)
		}
	}
	offline := make([]models.ID, 0)
	for channelID := range client.channels {
		clients := h.byChannel[channelID]
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.byChannel, channelID)
		}
		stillOnline := false
		for other := range clients {
			if other.user.ID == client.user.ID {
				stillOnline = true
				break
			}
		}
		if !stillOnline {
			offline = append(offline, channelID)
		}
	}
	return offline
}

func (h *Hub) Broadcast(event Event) {
	h.mu.Lock()
	recipients := map[*Client]struct{}{}
	if event.ChannelID == nil {
		for client := range h.clients {
			recipients[client] = struct{}{}
		}
	} else {
		for client := range h.byChannel[*event.ChannelID] {
			recipients[client] = struct{}{}
		}
	}
	h.mu.Unlock()

	evicted := make([]*Client, 0)
	for client := range recipients {
		if event.ChannelID != nil && h.authorizer != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			allowed, err := h.authorizer.CanAccess(ctx, client.user.ID, *event.ChannelID)
			cancel()
			if err != nil || !allowed {
				continue
			}
		}
		select {
		case client.send <- event:
		default:
			evicted = append(evicted, client)
		}
	}

	h.mu.Lock()
	offline := make([][]models.ID, 0, len(evicted))
	for _, client := range evicted {
		if _, registered := h.clients[client]; registered {
			offline = append(offline, h.unregisterLocked(client))
			h.clientsWG.Done()
		} else {
			offline = append(offline, nil)
		}
	}
	h.mu.Unlock()
	for i, client := range evicted {
		client.Close()
		if h.presence != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			_ = h.presence.Unregister(ctx, client.id)
			cancel()
		}
		for _, channelID := range offline[i] {
			id := channelID
			h.emit(context.Background(), NewEvent(EventPresence, &id, map[string]any{"user_id": client.user.ID, "online": false}))
		}
	}
}

func (h *Hub) Shutdown(ctx context.Context) error {
	h.mu.Lock()
	h.closing = true
	clients := make([]*Client, 0, len(h.clients))
	for client := range h.clients {
		clients = append(clients, client)
	}
	h.mu.Unlock()
	for _, client := range clients {
		client.requestGracefulShutdown()
	}
	done := make(chan struct{})
	go func() {
		h.clientsWG.Wait()
		close(done)
	}()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		for _, client := range clients {
			client.Close()
		}
		return ctx.Err()
	}
}

func (h *Hub) IsChannelOnline(channelID models.ID) bool {
	if h.presence != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		online, err := h.presence.ChannelOnline(ctx, channelID)
		cancel()
		if err == nil {
			return online
		}
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.byChannel[channelID]) > 0
}

func (h *Hub) emit(ctx context.Context, event Event) {
	if h.publisher != nil {
		if err := h.publisher.Publish(ctx, event); err == nil {
			return
		}
	}
	h.Broadcast(event)
}

func (h *Hub) handleTyping(client *Client, incoming IncomingEvent) {
	if incoming.Type != EventTyping || incoming.ChannelID == 0 || !client.channels[incoming.ChannelID] {
		return
	}
	if h.authorizer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		allowed, err := h.authorizer.CanAccess(ctx, client.user.ID, incoming.ChannelID)
		cancel()
		if err != nil || !allowed {
			return
		}
	}
	typing := true
	if incoming.Data["typing"] == false {
		typing = false
	}
	channelID := incoming.ChannelID
	h.emit(context.Background(), NewEvent(EventTyping, &channelID, map[string]any{"user_id": client.user.ID, "display_name": client.user.DisplayName, "typing": typing}))
}
