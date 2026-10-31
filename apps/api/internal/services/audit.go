package services

import (
	"context"
	"encoding/json"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"

	"lumina/api/internal/apperror"
	"lumina/api/internal/models"
)

type AuditEntry struct {
	ActorID      *models.ID
	Action       string
	ResourceType string
	ResourceID   string
	RequestID    string
	IPAddress    string
	Details      any
}

type AuditService struct{ db *gorm.DB }

func NewAuditService(db *gorm.DB) *AuditService { return &AuditService{db: db} }

func (s *AuditService) Record(ctx context.Context, entry AuditEntry) error {
	return recordAudit(ctx, s.db, entry)
}

func recordAudit(ctx context.Context, db *gorm.DB, entry AuditEntry) error {
	details, err := json.Marshal(entry.Details)
	if err != nil {
		return err
	}
	if entry.Details == nil {
		details = []byte("{}")
	}
	log := models.AuditLog{ActorID: entry.ActorID, Action: entry.Action, ResourceType: entry.ResourceType, ResourceID: entry.ResourceID, RequestID: entry.RequestID, IPAddress: entry.IPAddress, Details: datatypes.JSON(details), CreatedAt: time.Now().UTC()}
	return db.WithContext(ctx).Create(&log).Error
}

func (s *AuditService) List(ctx context.Context, page, size int, action, resource string) ([]models.AuditLog, int64, error) {
	page, size = normalizePage(page, size)
	query := s.db.WithContext(ctx).Model(&models.AuditLog{})
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if resource != "" {
		query = query.Where("resource_type = ?", resource)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, apperror.Internal(err)
	}
	var items []models.AuditLog
	if err := query.Order("id DESC").Offset((page - 1) * size).Limit(size).Find(&items).Error; err != nil {
		return nil, 0, apperror.Internal(err)
	}
	return items, total, nil
}

func normalizePage(page, size int) (int, int) {
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = 20
	}
	if size > 100 {
		size = 100
	}
	return page, size
}
