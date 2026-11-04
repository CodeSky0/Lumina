package httpapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"lumina/api/internal/apperror"
	"lumina/api/internal/models"
	"lumina/api/internal/services"
)

type AdminHandler struct {
	service *services.AdminService
	audit   *services.AuditService
}

func NewAdminHandler(service *services.AdminService, audit *services.AuditService) *AdminHandler {
	return &AdminHandler{service: service, audit: audit}
}
func (h *AdminHandler) auditFor(c *gin.Context) services.AuditEntry {
	user := currentUser(c)
	return auditContext(c, &user.ID)
}
func bind(c *gin.Context, target any) bool {
	if err := c.ShouldBindJSON(target); err != nil {
		respondError(c, apperror.BadRequest("VALIDATION_ERROR", "请求参数格式不正确"))
		return false
	}
	return true
}
func pagination(c *gin.Context) (int, int) { return queryInt(c, "page", 1), queryInt(c, "size", 20) }

func (h *AdminHandler) Dashboard(c *gin.Context) {
	result, err := h.service.Dashboard(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, result)
}
func (h *AdminHandler) ListClasses(c *gin.Context) {
	page, size := pagination(c)
	items, total, err := h.service.ListClasses(c.Request.Context(), page, size)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, pageData(items, total, page, size))
}
func (h *AdminHandler) CreateClass(c *gin.Context) {
	var input services.ClassInput
	if !bind(c, &input) {
		return
	}
	item, err := h.service.CreateClass(c.Request.Context(), input, h.auditFor(c))
	if err != nil {
		respondError(c, err)
		return
	}
	statusCreated(c, item)
}
func (h *AdminHandler) UpdateClass(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	var input services.ClassInput
	if !bind(c, &input) {
		return
	}
	item, err := h.service.UpdateClass(c.Request.Context(), id, input, h.auditFor(c))
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, item)
}
func (h *AdminHandler) DeleteClass(c *gin.Context) { h.delete(c, h.service.DeleteClass) }
func (h *AdminHandler) RotateDevice(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	code, err := h.service.RotateDeviceCode(c.Request.Context(), id, h.auditFor(c))
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, gin.H{"code": code, "notice": "设备码仅显示一次，旧设备码已失效"})
}

func (h *AdminHandler) ListTeachers(c *gin.Context) {
	page, size := pagination(c)
	items, total, err := h.service.ListTeachers(c.Request.Context(), page, size)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, pageData(items, total, page, size))
}
func (h *AdminHandler) CreateTeacher(c *gin.Context) {
	var input services.TeacherInput
	if !bind(c, &input) {
		return
	}
	item, err := h.service.CreateTeacher(c.Request.Context(), input, h.auditFor(c))
	if err != nil {
		respondError(c, err)
		return
	}
	statusCreated(c, item)
}
func (h *AdminHandler) UpdateTeacher(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	var input services.TeacherInput
	if !bind(c, &input) {
		return
	}
	item, err := h.service.UpdateTeacher(c.Request.Context(), id, input, h.auditFor(c))
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, item)
}
func (h *AdminHandler) DeleteTeacher(c *gin.Context) { h.delete(c, h.service.DeleteTeacher) }

func (h *AdminHandler) ListSubjects(c *gin.Context) {
	page, size := pagination(c)
	items, total, err := h.service.ListSubjects(c.Request.Context(), page, size)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, pageData(items, total, page, size))
}
func (h *AdminHandler) CreateSubject(c *gin.Context) {
	var input services.SubjectInput
	if !bind(c, &input) {
		return
	}
	item, err := h.service.CreateSubject(c.Request.Context(), input, h.auditFor(c))
	if err != nil {
		respondError(c, err)
		return
	}
	statusCreated(c, item)
}
func (h *AdminHandler) UpdateSubject(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	var input services.SubjectInput
	if !bind(c, &input) {
		return
	}
	item, err := h.service.UpdateSubject(c.Request.Context(), id, input, h.auditFor(c))
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, item)
}
func (h *AdminHandler) DeleteSubject(c *gin.Context) { h.delete(c, h.service.DeleteSubject) }

func (h *AdminHandler) ListAssignments(c *gin.Context) {
	page, size := pagination(c)
	items, total, err := h.service.ListAssignments(c.Request.Context(), page, size)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, pageData(items, total, page, size))
}
func (h *AdminHandler) CreateAssignment(c *gin.Context) {
	var input services.AssignmentInput
	if !bind(c, &input) {
		return
	}
	item, err := h.service.CreateAssignment(c.Request.Context(), input, h.auditFor(c))
	if err != nil {
		respondError(c, err)
		return
	}
	statusCreated(c, item)
}
func (h *AdminHandler) UpdateAssignment(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	var input services.AssignmentInput
	if !bind(c, &input) {
		return
	}
	item, err := h.service.UpdateAssignment(c.Request.Context(), id, input, h.auditFor(c))
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, item)
}
func (h *AdminHandler) DeleteAssignment(c *gin.Context) { h.delete(c, h.service.DeleteAssignment) }

func (h *AdminHandler) ListChannels(c *gin.Context) {
	page, size := pagination(c)
	items, total, err := h.service.ListChannels(c.Request.Context(), page, size)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, pageData(items, total, page, size))
}
func (h *AdminHandler) CreateChannel(c *gin.Context) {
	var input services.BroadcastChannelInput
	if !bind(c, &input) {
		return
	}
	item, err := h.service.CreateBroadcastChannel(c.Request.Context(), input, h.auditFor(c))
	if err != nil {
		respondError(c, err)
		return
	}
	statusCreated(c, item)
}
func (h *AdminHandler) UpdateChannel(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	var input services.BroadcastChannelInput
	if !bind(c, &input) {
		return
	}
	item, err := h.service.UpdateBroadcastChannel(c.Request.Context(), id, input, h.auditFor(c))
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, item)
}
func (h *AdminHandler) DeleteChannel(c *gin.Context) { h.delete(c, h.service.DeleteChannel) }

func (h *AdminHandler) AuditLogs(c *gin.Context) {
	page, size := pagination(c)
	items, total, err := h.audit.List(c.Request.Context(), page, size, c.Query("action"), c.Query("resource"))
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, pageData(items, total, page, size))
}
func (h *AdminHandler) Settings(c *gin.Context) {
	settings, err := h.service.Settings(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, settingsMap(settings))
}
func (h *AdminHandler) UpdateSettings(c *gin.Context) {
	var values map[string]json.RawMessage
	if !bind(c, &values) {
		return
	}
	user := currentUser(c)
	settings, err := h.service.UpdateSettings(c.Request.Context(), values, user.ID, h.auditFor(c))
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, settingsMap(settings))
}
func settingsMap(settings []models.SystemSetting) map[string]json.RawMessage {
	result := map[string]json.RawMessage{}
	for _, setting := range settings {
		result[setting.Key] = append([]byte(nil), setting.Value...)
	}
	return result
}
func (h *AdminHandler) delete(c *gin.Context, operation func(context.Context, models.ID, services.AuditEntry) error) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	if err := operation(c.Request.Context(), id, h.auditFor(c)); err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, gin.H{"deleted": true, "id": id})
}
