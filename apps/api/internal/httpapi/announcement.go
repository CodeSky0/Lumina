package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"lumina/api/internal/services"
)

type AnnouncementHandler struct {
	service  *services.AnnouncementService
	messages *services.MessageService
	audit    *services.AuditService
}

func NewAnnouncementHandler(service *services.AnnouncementService, messages *services.MessageService, audit *services.AuditService) *AnnouncementHandler {
	return &AnnouncementHandler{service: service, messages: messages, audit: audit}
}
func (h *AnnouncementHandler) List(c *gin.Context) {
	page, size := pagination(c)
	items, total, err := h.service.List(c.Request.Context(), currentUser(c).ID, page, size)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, pageData(items, total, page, size))
}
func (h *AnnouncementHandler) Create(c *gin.Context) {
	var input services.AnnouncementInput
	if !bind(c, &input) {
		return
	}
	user := currentUser(c)
	item, err := h.service.Create(c.Request.Context(), user.ID, input, auditContext(c, &user.ID))
	if err != nil {
		respondError(c, err)
		return
	}
	statusCreated(c, item)
}
func (h *AnnouncementHandler) Confirm(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	confirmedAt, err := h.service.Confirm(c.Request.Context(), currentUser(c).ID, id)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, gin.H{"confirmed": true, "id": id, "confirmed_at": confirmedAt})
}
func (h *AnnouncementHandler) ConfirmationStatus(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	items, err := h.service.ConfirmationStatus(c.Request.Context(), currentUser(c).ID, id)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, gin.H{"items": items})
}
func (h *AnnouncementHandler) UrgentPending(c *gin.Context) {
	userID := currentUser(c).ID
	messages, err := h.messages.PendingUrgent(c.Request.Context(), userID)
	if err != nil {
		respondError(c, err)
		return
	}
	announcements, err := h.service.PendingUrgent(c.Request.Context(), userID)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, gin.H{"messages": messages, "announcements": announcements})
}
