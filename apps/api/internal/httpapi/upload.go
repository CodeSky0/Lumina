package httpapi

import (
	"fmt"
	"mime"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"lumina/api/internal/apperror"
	"lumina/api/internal/services"
)

type UploadHandler struct{ service *services.UploadService }

func NewUploadHandler(service *services.UploadService) *UploadHandler {
	return &UploadHandler{service: service}
}

func (h *UploadHandler) Upload(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, services.MaxFileSize+(1<<20))
	if err := c.Request.ParseMultipartForm(services.MaxFileSize); err != nil {
		respondError(c, apperror.New(413, "UPLOAD_TOO_LARGE", "上传内容超过限制或表单无效"))
		return
	}
	if c.Request.MultipartForm != nil {
		defer c.Request.MultipartForm.RemoveAll()
	}
	channelID, err := parseID(c.PostForm("channel_id"))
	if err != nil {
		respondError(c, apperror.BadRequest("CHANNEL_REQUIRED", "上传必须指定有效通道"))
		return
	}
	header, err := c.FormFile("file")
	if err != nil {
		respondError(c, apperror.BadRequest("FILE_REQUIRED", "必须提供 file 文件字段"))
		return
	}
	declared := header.Size
	if raw := c.PostForm("declared_size"); raw != "" {
		declared, err = strconv.ParseInt(raw, 10, 64)
		if err != nil {
			respondError(c, apperror.BadRequest("SIZE_INVALID", "声明大小格式无效"))
			return
		}
	}
	file, err := h.service.Upload(c.Request.Context(), currentUser(c).ID, channelID, header, declared)
	if err != nil {
		respondError(c, err)
		return
	}
	statusCreated(c, file)
}

func (h *UploadHandler) Download(c *gin.Context) {
	id, err := pathID(c, "id")
	if err != nil {
		respondError(c, err)
		return
	}
	object, file, err := h.service.Open(c.Request.Context(), currentUser(c).ID, id)
	if err != nil {
		respondError(c, err)
		return
	}
	defer file.Close()
	disposition := mime.FormatMediaType("attachment", map[string]string{"filename": object.OriginalName})
	if disposition == "" {
		disposition = fmt.Sprintf(`attachment; filename="file-%s"`, id.String())
	}
	c.Header("Content-Disposition", disposition)
	c.Header("Content-Type", object.MIME)
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Cache-Control", "private, no-store")
	http.ServeContent(c.Writer, c.Request, object.OriginalName, object.CreatedAt, file)
}
