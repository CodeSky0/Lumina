package services

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"lumina/api/internal/apperror"
	"lumina/api/internal/models"
)

const (
	MaxImageSize = 5 << 20
	MaxFileSize  = 20 << 20
)

var uploadKinds = map[string]string{".jpg": "image", ".jpeg": "image", ".png": "image", ".gif": "image", ".webp": "image", ".pdf": "file", ".txt": "file", ".doc": "file", ".docx": "file", ".xls": "file", ".xlsx": "file", ".ppt": "file", ".pptx": "file", ".zip": "file"}

type UploadService struct {
	db         *gorm.DB
	membership *Membership
	directory  string
}

func NewUploadService(db *gorm.DB, membership *Membership, directory string) *UploadService {
	return &UploadService{db: db, membership: membership, directory: directory}
}

func (s *UploadService) Upload(ctx context.Context, userID, channelID models.ID, header *multipart.FileHeader, declaredSize int64) (*models.FileObject, error) {
	if err := s.membership.RequireWrite(ctx, userID, channelID); err != nil {
		return nil, err
	}
	var setting models.SystemSetting
	if err := s.db.WithContext(ctx).Where("key = 'uploads_enabled'").First(&setting).Error; err == nil {
		var enabled bool
		if json.Unmarshal(setting.Value, &enabled) == nil && !enabled {
			return nil, apperror.New(503, "UPLOADS_DISABLED", "文件上传已暂停")
		}
	} else if err != gorm.ErrRecordNotFound {
		return nil, apperror.Internal(err)
	}
	original := filepath.Base(strings.ReplaceAll(header.Filename, "\\", "/"))
	extension := strings.ToLower(filepath.Ext(original))
	kind, allowed := uploadKinds[extension]
	if !allowed || !validName(original, 255) {
		return nil, apperror.BadRequest("FILE_TYPE_INVALID", "文件类型不受支持")
	}
	limit := int64(MaxFileSize)
	if kind == "image" {
		limit = MaxImageSize
	}
	if header.Size <= 0 || header.Size > limit || declaredSize <= 0 || declaredSize > limit || declaredSize != header.Size {
		return nil, apperror.New(413, "FILE_TOO_LARGE", "文件为空、声明大小不一致或超过大小限制")
	}
	source, err := header.Open()
	if err != nil {
		return nil, apperror.BadRequest("FILE_READ_ERROR", "无法读取上传文件")
	}
	defer source.Close()
	reader := bufio.NewReader(source)
	prefix, err := reader.Peek(512)
	if err != nil && err != io.EOF && err != bufio.ErrBufferFull {
		return nil, apperror.BadRequest("FILE_READ_ERROR", "无法检测文件内容")
	}
	detected := http.DetectContentType(prefix)
	declaredMIME := strings.ToLower(strings.TrimSpace(strings.Split(header.Header.Get("Content-Type"), ";")[0]))
	if err := validateMIME(extension, kind, detected, declaredMIME); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(s.directory, 0700); err != nil {
		return nil, apperror.Internal(err)
	}
	stored := uuid.NewString() + extension
	path := filepath.Join(s.directory, stored)
	target, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return nil, apperror.Internal(err)
	}
	written, copyErr := io.CopyN(target, reader, limit+1)
	closeErr := target.Close()
	if copyErr != nil && copyErr != io.EOF {
		_ = os.Remove(path)
		return nil, apperror.Internal(copyErr)
	}
	if closeErr != nil {
		_ = os.Remove(path)
		return nil, apperror.Internal(closeErr)
	}
	if written <= 0 || written > limit || written != header.Size {
		_ = os.Remove(path)
		return nil, apperror.New(413, "FILE_SIZE_MISMATCH", "文件实际大小与声明不一致或超过限制")
	}
	file := &models.FileObject{OwnerID: userID, ChannelID: channelID, OriginalName: original, StoredName: stored, MIME: detected, Size: written, Kind: kind}
	if err := s.db.WithContext(ctx).Create(file).Error; err != nil {
		_ = os.Remove(path)
		return nil, apperror.Internal(err)
	}
	return file, nil
}

func validateMIME(extension, kind, detected, declared string) error {
	detectedBase := strings.ToLower(strings.TrimSpace(strings.Split(detected, ";")[0]))
	declaredBase := strings.ToLower(strings.TrimSpace(strings.Split(declared, ";")[0]))
	if kind == "image" {
		expected := map[string]string{".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}[extension]
		if detectedBase != expected || (declaredBase != "" && declaredBase != expected && !(expected == "image/jpeg" && declaredBase == "image/jpg")) {
			return apperror.BadRequest("MIME_MISMATCH", "图片扩展名、声明 MIME 与实际内容不一致")
		}
		return nil
	}
	validDetected := detectedBase == "application/octet-stream"
	switch extension {
	case ".pdf":
		validDetected = detectedBase == "application/pdf"
	case ".txt":
		validDetected = strings.HasPrefix(detectedBase, "text/plain")
	case ".zip", ".docx", ".xlsx", ".pptx":
		validDetected = detectedBase == "application/zip" || detectedBase == "application/octet-stream"
	case ".doc", ".xls", ".ppt":
		validDetected = detectedBase == "application/octet-stream" || detectedBase == "application/x-cfb"
	}
	if !validDetected {
		return apperror.BadRequest("MIME_MISMATCH", "文件扩展名与实际内容不一致")
	}
	if declaredBase != "" && declaredBase != detectedBase && declaredBase != "application/octet-stream" {
		officeAlias := (extension == ".docx" || extension == ".xlsx" || extension == ".pptx" || extension == ".doc" || extension == ".xls" || extension == ".ppt") && (detectedBase == "application/zip" || detectedBase == "application/octet-stream")
		if !officeAlias {
			return apperror.BadRequest("MIME_MISMATCH", "声明 MIME 与文件内容不一致")
		}
	}
	return nil
}

func (s *UploadService) Open(ctx context.Context, userID, fileID models.ID) (*models.FileObject, *os.File, error) {
	var object models.FileObject
	if err := s.db.WithContext(ctx).First(&object, fileID).Error; err != nil {
		return nil, nil, apperror.NotFound("FILE_NOT_FOUND", "文件不存在")
	}
	if err := s.membership.RequireAccess(ctx, userID, object.ChannelID); err != nil {
		return nil, nil, err
	}
	if object.StoredName != filepath.Base(object.StoredName) {
		return nil, nil, apperror.Internal(fmt.Errorf("非法存储对象名"))
	}
	path := filepath.Join(s.directory, object.StoredName)
	file, err := os.Open(path)
	if err != nil {
		return nil, nil, apperror.NotFound("FILE_NOT_FOUND", "文件内容不存在")
	}
	return &object, file, nil
}

type ReadResult struct {
	Object  models.FileObject
	Content []byte
}

func ReadAllAndClose(file *os.File) ([]byte, error) { defer file.Close(); return io.ReadAll(file) }
