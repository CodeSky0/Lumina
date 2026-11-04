package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"lumina/api/internal/models"
	"lumina/api/internal/services"
)

type MessageHandler struct {
	channels *services.ChannelService
	messages *services.MessageService
}

func NewMessageHandler(channels *services.ChannelService, messages *services.MessageService) *MessageHandler {
	return &MessageHandler{channels: channels, messages: messages}
}
func (h *MessageHandler) ListChannels(c *gin.Context) {
	items, err := h.channels.List(c.Request.Context(), currentUser(c).ID)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, items)
}
func (h *MessageHandler) History(c *gin.Context) {
	channelID, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	var before models.ID
	if raw := c.Query("before_id"); raw != "" {
		before, err = parseID(raw)
		if err != nil {
			respondError(c, err)
			return
		}
	}
	result, err := h.messages.History(c.Request.Context(), currentUser(c).ID, channelID, before, queryInt(c, "limit", 50), c.Query("q"))
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, result)
}
func (h *MessageHandler) Sync(c *gin.Context) {
	channelID, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	var afterID models.ID
	if raw := c.Query("after_id"); raw != "" {
		afterID, err = parseID(raw)
		if err != nil {
			respondError(c, err)
			return
		}
	}
	result, err := h.messages.Sync(c.Request.Context(), currentUser(c).ID, channelID, afterID, queryInt(c, "limit", 50))
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, result)
}
func (h *MessageHandler) Send(c *gin.Context) {
	channelID, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	var input services.SendMessageInput
	if !bind(c, &input) {
		return
	}
	message, err := h.messages.Send(c.Request.Context(), currentUser(c).ID, channelID, input)
	if err != nil {
		respondError(c, err)
		return
	}
	statusCreated(c, message)
}
func (h *MessageHandler) DeliveryAck(c *gin.Context) {
	var input struct {
		MessageIDs []models.ID `json:"message_ids"`
	}
	if !bind(c, &input) {
		return
	}
	if err := h.messages.AcknowledgeDeliveries(c.Request.Context(), currentUser(c).ID, input.MessageIDs); err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, gin.H{"delivered": true})
}
func (h *MessageHandler) Edit(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	var input struct {
		Content string `json:"content"`
	}
	if !bind(c, &input) {
		return
	}
	message, err := h.messages.Edit(c.Request.Context(), currentUser(c).ID, id, input.Content)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, message)
}
func (h *MessageHandler) Delete(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	if err := h.messages.Delete(c.Request.Context(), currentUser(c).ID, id); err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, gin.H{"deleted": true, "id": id})
}
func (h *MessageHandler) ConfirmationStatus(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	items, err := h.messages.ConfirmationStatus(c.Request.Context(), currentUser(c).ID, id)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, gin.H{"items": items})
}
func (h *MessageHandler) Read(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	if err := h.messages.Read(c.Request.Context(), currentUser(c).ID, id); err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, gin.H{"read": true, "id": id})
}
func (h *MessageHandler) Confirm(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	confirmedAt, err := h.messages.Confirm(c.Request.Context(), currentUser(c).ID, id)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, gin.H{"confirmed": true, "id": id, "confirmed_at": confirmedAt})
}

type batchRequest struct {
	ChannelIDs []models.ID            `json:"channel_ids"`
	Targets    []services.BatchTarget `json:"targets"`
	Content    string                 `json:"content"`
	Type       models.MessageType     `json:"type"`
}

func (h *MessageHandler) Batch(c *gin.Context) {
	var input batchRequest
	if !bind(c, &input) {
		return
	}
	targets := input.Targets
	if len(targets) == 0 {
		targets = make([]services.BatchTarget, 0, len(input.ChannelIDs))
		for _, channelID := range input.ChannelIDs {
			targets = append(targets, services.BatchTarget{ChannelID: channelID})
		}
	}
	results, err := h.messages.BatchTargets(c.Request.Context(), currentUser(c).ID, targets, input.Content, input.Type)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, gin.H{"items": results})
}
