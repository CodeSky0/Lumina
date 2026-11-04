package httpapi

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"lumina/api/internal/apperror"
	"lumina/api/internal/auth"
	"lumina/api/internal/services"
)

const refreshCookieName = "lumina_refresh"

type AuthHandler struct {
	service      *auth.Service
	audit        *services.AuditService
	secureCookie bool
}

func NewAuthHandler(service *auth.Service, audit *services.AuditService, secureCookie bool) *AuthHandler {
	return &AuthHandler{service: service, audit: audit, secureCookie: secureCookie}
}

type loginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}
type deviceRequest struct {
	Code string `json:"code" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var request loginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, apperror.BadRequest("VALIDATION_ERROR", "用户名和密码不能为空"))
		return
	}
	session, err := h.service.Login(c.Request.Context(), request.Username, request.Password, c.ClientIP())
	if err != nil {
		h.recordFailure(c, request.Username)
		respondError(c, err)
		return
	}
	h.setRefreshCookie(c, session.RefreshToken)
	actor := session.User.ID
	entry := auditContext(c, &actor)
	entry.Action = "auth.login"
	entry.ResourceType = "user"
	entry.ResourceID = actor.String()
	entry.Details = map[string]any{"username": session.User.Username}
	if err := h.audit.Record(c.Request.Context(), entry); err != nil {
		log.Printf("登录审计写入失败: %v", err)
	}
	data(c, http.StatusOK, sessionResponse(session))
}

func (h *AuthHandler) Device(c *gin.Context) {
	var request deviceRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, apperror.BadRequest("VALIDATION_ERROR", "设备码不能为空"))
		return
	}
	session, err := h.service.DeviceLogin(c.Request.Context(), request.Code)
	if err != nil {
		respondError(c, err)
		return
	}
	h.setRefreshCookie(c, session.RefreshToken)
	actor := session.User.ID
	entry := auditContext(c, &actor)
	entry.Action = "auth.device"
	entry.ResourceType = "user"
	entry.ResourceID = actor.String()
	if err := h.audit.Record(c.Request.Context(), entry); err != nil {
		log.Printf("设备登录审计写入失败: %v", err)
	}
	data(c, http.StatusOK, sessionResponse(session))
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	cookie, err := c.Cookie(refreshCookieName)
	if err != nil {
		respondError(c, apperror.Unauthorized("REFRESH_REQUIRED", "刷新凭证不存在"))
		return
	}
	session, err := h.service.Refresh(c.Request.Context(), cookie)
	if err != nil {
		h.clearRefreshCookie(c)
		respondError(c, err)
		return
	}
	h.setRefreshCookie(c, session.RefreshToken)
	data(c, http.StatusOK, sessionResponse(session))
}

func (h *AuthHandler) Logout(c *gin.Context) {
	cookie, _ := c.Cookie(refreshCookieName)
	if err := h.service.Logout(c.Request.Context(), cookie); err != nil {
		respondError(c, apperror.Internal(err))
		return
	}
	h.clearRefreshCookie(c)
	data(c, http.StatusOK, gin.H{"logged_out": true})
}

func (h *AuthHandler) Me(c *gin.Context) { user := currentUser(c); data(c, http.StatusOK, user) }
func (h *AuthHandler) WSTicket(c *gin.Context) {
	user := currentUser(c)
	ticket, err := h.service.WSTicket(c.Request.Context(), user.ID)
	if err != nil {
		respondError(c, err)
		return
	}
	data(c, http.StatusOK, gin.H{"ticket": ticket, "expires_at": time.Now().UTC().Add(auth.WSTicketTTL)})
}

func sessionResponse(session *auth.Session) gin.H {
	return gin.H{"access_token": session.AccessToken, "user": session.User, "expires_at": session.ExpiresAt}
}
func (h *AuthHandler) setRefreshCookie(c *gin.Context, token string) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(refreshCookieName, token, int(auth.RefreshTokenTTL.Seconds()), "/api/v1/auth", "", h.secureCookie, true)
}
func (h *AuthHandler) clearRefreshCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(refreshCookieName, "", -1, "/api/v1/auth", "", h.secureCookie, true)
}
func (h *AuthHandler) recordFailure(c *gin.Context, username string) {
	entry := auditContext(c, nil)
	entry.Action = "auth.login_failed"
	entry.ResourceType = "auth"
	entry.ResourceID = "login"
	entry.Details = map[string]any{"username": username}
	if err := h.audit.Record(c.Request.Context(), entry); err != nil {
		log.Printf("失败登录审计写入失败: %v", err)
	}
}
