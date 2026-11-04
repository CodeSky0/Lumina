package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"lumina/api/internal/apperror"
	"lumina/api/internal/auth"
	"lumina/api/internal/realtime"
	"lumina/api/internal/services"
)

type WebSocketHandler struct {
	auth       *auth.Service
	membership *services.Membership
	hub        *realtime.Hub
	upgrader   websocket.Upgrader
}

func NewWebSocketHandler(authService *auth.Service, membership *services.Membership, hub *realtime.Hub, allowlist []string) *WebSocketHandler {
	allowed := map[string]bool{}
	for _, origin := range allowlist {
		allowed[origin] = true
	}
	handler := &WebSocketHandler{auth: authService, membership: membership, hub: hub}
	handler.upgrader = websocket.Upgrader{ReadBufferSize: 4096, WriteBufferSize: 4096, CheckOrigin: func(r *http.Request) bool { origin := r.Header.Get("Origin"); return origin == "" || allowed[origin] }}
	return handler
}

func (h *WebSocketHandler) Serve(c *gin.Context) {
	user, err := h.auth.ConsumeWSTicket(c.Request.Context(), c.Query("ticket"))
	if err != nil {
		respondError(c, err)
		return
	}
	channelIDs, err := h.membership.PermittedChannelIDs(c.Request.Context(), user.ID)
	if err != nil {
		respondError(c, err)
		return
	}
	connection, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	client := h.hub.NewClient(uuid.NewString(), *user, channelIDs, connection)
	h.hub.Register(client)
	go client.WritePump()
	client.ReadPump()
}

func methodNotAllowed(c *gin.Context) {
	respondError(c, apperror.New(405, "METHOD_NOT_ALLOWED", "请求方法不受支持"))
}
