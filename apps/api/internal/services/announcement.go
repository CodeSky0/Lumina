package services

import (
	"context"
	"log"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"lumina/api/internal/apperror"
	"lumina/api/internal/models"
	"lumina/api/internal/realtime"
)

type AnnouncementDTO struct {
	ID            models.ID          `json:"id"`
	Title         string             `json:"title"`
	Content       string             `json:"content"`
	Type          models.MessageType `json:"type"`
	Scope         string             `json:"scope"`
	Grade         *int               `json:"grade,omitempty"`
	TargetClassID *models.ID         `json:"target_class_id,omitempty"`
	PublisherID   models.ID          `json:"publisher_id"`
	PublisherName string             `json:"publisher_name"`
	CreatedAt     time.Time          `json:"created_at"`
	ConfirmedAt   *time.Time         `json:"confirmed_at,omitempty"`
}

type AnnouncementInput struct {
	Title         string             `json:"title"`
	Content       string             `json:"content"`
	Type          models.MessageType `json:"type"`
	Scope         string             `json:"scope"`
	Grade         *int               `json:"grade"`
	TargetClassID *models.ID         `json:"target_class_id"`
}

type AnnouncementService struct {
	db        *gorm.DB
	publisher realtime.Publisher
	recorder  EventRecorder
	now       func() time.Time
}

func NewAnnouncementService(db *gorm.DB, publisher realtime.Publisher, recorders ...EventRecorder) *AnnouncementService {
	var recorder EventRecorder
	if len(recorders) > 0 {
		recorder = recorders[0]
	}
	return &AnnouncementService{db: db, publisher: publisher, recorder: recorder, now: func() time.Time { return time.Now().UTC() }}
}

func (s *AnnouncementService) Create(ctx context.Context, publisherID models.ID, input AnnouncementInput, audit AuditEntry) (*AnnouncementDTO, error) {
	if !validName(input.Title, 200) || !validName(input.Content, 2000) || (input.Type != models.MessageNotice && input.Type != models.MessageUrgent) {
		return nil, apperror.BadRequest("VALIDATION_ERROR", "公告标题、正文或类型无效")
	}
	channelInput := BroadcastChannelInput{Name: input.Title, Scope: input.Scope, Grade: input.Grade, TargetClassID: input.TargetClassID}
	if err := validateBroadcast(channelInput); err != nil {
		return nil, err
	}
	var publisher models.User
	if err := s.db.WithContext(ctx).First(&publisher, publisherID).Error; err != nil || !publisher.Active || publisher.Role != models.RoleAdmin {
		return nil, apperror.Forbidden("ANNOUNCEMENT_FORBIDDEN", "只有管理员可以发布公告")
	}
	announcement := models.Announcement{Title: strings.TrimSpace(input.Title), Content: strings.TrimSpace(input.Content), Type: input.Type, Scope: input.Scope, Grade: input.Grade, TargetClassID: input.TargetClassID, PublisherID: publisherID, CreatedAt: s.now(), UpdatedAt: s.now()}
	var channels []models.Channel
	query := s.db.WithContext(ctx).Where("type = 'broadcast' AND active = true AND broadcast_scope = ?", announcement.Scope)
	if announcement.Scope == "grade" {
		query = query.Where("grade = ?", *announcement.Grade)
	}
	if announcement.Scope == "class" {
		query = query.Where("target_class_id = ?", *announcement.TargetClassID)
	}
	if err := query.Find(&channels).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	dto := AnnouncementDTO{}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&announcement).Error; err != nil {
			return err
		}
		audit.ResourceType = "announcement"
		audit.ResourceID = announcement.ID.String()
		audit.Action = "announcement.create"
		audit.Details = map[string]any{"title": announcement.Title, "type": announcement.Type, "scope": announcement.Scope}
		if err := recordAudit(ctx, tx, audit); err != nil {
			return err
		}
		dto = AnnouncementDTO{ID: announcement.ID, Title: announcement.Title, Content: announcement.Content, Type: announcement.Type, Scope: announcement.Scope, Grade: announcement.Grade, TargetClassID: announcement.TargetClassID, PublisherID: publisherID, PublisherName: publisher.DisplayName, CreatedAt: announcement.CreatedAt}
		if s.recorder != nil {
			for _, channel := range channels {
				if err := s.recorder.Record(tx, realtime.NewEvent(realtime.EventAnnouncement, &channel.ID, map[string]any{"announcement": dto})); err != nil {
					return err
				}
			}
			if len(channels) == 0 {
				return s.recorder.Record(tx, announcementInvalidationEvent(announcement))
			}
		}
		return nil
	})
	if err != nil {
		return nil, apperror.Internal(err)
	}
	if s.recorder == nil {
		for _, channel := range channels {
			s.publish(ctx, realtime.NewEvent(realtime.EventAnnouncement, &channel.ID, map[string]any{"announcement": dto}))
		}
		if len(channels) == 0 {
			s.publish(ctx, announcementInvalidationEvent(announcement))
		}
	}
	return &dto, nil
}

func announcementInvalidationEvent(announcement models.Announcement) realtime.Event {
	return realtime.NewEvent(realtime.EventAnnouncementInvalidated, nil, map[string]any{
		"announcement_id": announcement.ID,
		"scope":           announcement.Scope,
		"grade":           announcement.Grade,
		"target_class_id": announcement.TargetClassID,
	})
}

func (s *AnnouncementService) List(ctx context.Context, userID models.ID, page, size int) ([]AnnouncementDTO, int64, error) {
	page, size = normalizePage(page, size)
	query, err := s.visibleQuery(ctx, userID)
	if err != nil {
		return nil, 0, err
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, apperror.Internal(err)
	}
	var announcements []models.Announcement
	if err := query.Preload("Publisher").Order("id DESC").Offset((page - 1) * size).Limit(size).Find(&announcements).Error; err != nil {
		return nil, 0, apperror.Internal(err)
	}
	items, err := s.hydrate(ctx, userID, announcements)
	return items, total, err
}

func (s *AnnouncementService) Confirm(ctx context.Context, userID, announcementID models.ID) (*time.Time, error) {
	var announcement models.Announcement
	if err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", announcementID).First(&announcement).Error; err != nil {
		return nil, apperror.NotFound("ANNOUNCEMENT_NOT_FOUND", "公告不存在")
	}
	visible, err := s.canAccess(ctx, userID, announcement)
	if err != nil {
		return nil, apperror.Internal(err)
	}
	if !visible {
		return nil, apperror.Forbidden("ANNOUNCEMENT_FORBIDDEN", "无权确认该公告")
	}
	if announcement.Type != models.MessageUrgent {
		return nil, apperror.BadRequest("CONFIRM_NOT_REQUIRED", "普通公告无需确认")
	}
	var user models.User
	if err := s.db.WithContext(ctx).First(&user, userID).Error; err != nil {
		return nil, apperror.Unauthorized("ACCOUNT_DISABLED", "账号不可用")
	}
	if err := requireClassroomConfirmation(user); err != nil {
		return nil, err
	}
	recipientSet := map[models.ID]struct{}{userID: {}, announcement.PublisherID: {}}
	var adminIDs []models.ID
	if err := s.db.WithContext(ctx).Model(&models.User{}).Where("role = ? AND active = true", models.RoleAdmin).Order("id ASC").Pluck("id", &adminIDs).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	for _, adminID := range adminIDs {
		recipientSet[adminID] = struct{}{}
	}
	recipientIDs := make([]models.ID, 0, len(recipientSet))
	for recipientID := range recipientSet {
		recipientIDs = append(recipientIDs, recipientID)
	}
	sort.Slice(recipientIDs, func(i, j int) bool { return recipientIDs[i] < recipientIDs[j] })
	now := s.now()
	confirmation := models.AnnouncementConfirmation{AnnouncementID: announcementID, UserID: userID, ConfirmedAt: now}
	events := make([]realtime.Event, 0, len(recipientIDs))
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&confirmation).Error; err != nil {
			return err
		}
		if err := tx.Where("announcement_id = ? AND user_id = ?", announcementID, userID).First(&confirmation).Error; err != nil {
			return err
		}
		for _, recipientID := range recipientIDs {
			event := realtime.NewDirectedEvent(realtime.EventUrgentConfirmed, recipientID, map[string]any{"kind": "announcement", "announcement_id": announcementID, "user_id": userID, "confirmed_at": confirmation.ConfirmedAt})
			events = append(events, event)
			if s.recorder != nil {
				if err := s.recorder.Record(tx, event); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, apperror.Internal(err)
	}
	if s.recorder == nil {
		for _, event := range events {
			s.publish(ctx, event)
		}
	}
	return &confirmation.ConfirmedAt, nil
}

func (s *AnnouncementService) PendingUrgent(ctx context.Context, userID models.ID) ([]AnnouncementDTO, error) {
	query, err := s.visibleQuery(ctx, userID)
	if err != nil {
		return nil, err
	}
	var announcements []models.Announcement
	if err := query.Preload("Publisher").Where("type = 'urgent' AND NOT EXISTS (SELECT 1 FROM announcement_confirmations ac WHERE ac.announcement_id = announcements.id AND ac.user_id = ?)", userID).Order("id DESC").Find(&announcements).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	return s.hydrate(ctx, userID, announcements)
}

func (s *AnnouncementService) visibleQuery(ctx context.Context, userID models.ID) (*gorm.DB, error) {
	var user models.User
	if err := s.db.WithContext(ctx).Preload("Class").First(&user, userID).Error; err != nil || !user.Active {
		return nil, apperror.Unauthorized("ACCOUNT_DISABLED", "账号不可用")
	}
	query := s.db.WithContext(ctx).Model(&models.Announcement{}).Where("deleted_at IS NULL")
	if user.Role == models.RoleAdmin {
		return query, nil
	}
	if user.Role == models.RoleClassroom {
		if user.ClassID == nil || user.Class == nil {
			return nil, apperror.Forbidden("ANNOUNCEMENT_FORBIDDEN", "账号未绑定班级")
		}
		return query.Where("scope = 'school' OR (scope = 'grade' AND grade = ?) OR (scope = 'class' AND target_class_id = ?)", user.Class.Grade, *user.ClassID), nil
	}
	if user.Role == models.RoleTeacher {
		return query.Where("scope = 'school' OR (scope = 'grade' AND grade IN (SELECT c.grade FROM teaching_assignments a JOIN classes c ON c.id = a.class_id WHERE a.teacher_id = ? AND a.active = true AND c.active = true)) OR (scope = 'class' AND target_class_id IN (SELECT class_id FROM teaching_assignments WHERE teacher_id = ? AND active = true))", user.ID, user.ID), nil
	}
	return nil, apperror.Forbidden("ANNOUNCEMENT_FORBIDDEN", "角色无权查看公告")
}

func (s *AnnouncementService) canAccess(ctx context.Context, userID models.ID, announcement models.Announcement) (bool, error) {
	var user models.User
	if err := s.db.WithContext(ctx).Preload("Class").First(&user, userID).Error; err != nil || !user.Active {
		return false, err
	}
	if user.Role == models.RoleAdmin || announcement.Scope == "school" {
		return true, nil
	}
	if announcement.Scope == "grade" && announcement.Grade != nil {
		if user.Role == models.RoleClassroom {
			return user.Class != nil && user.Class.Grade == *announcement.Grade, nil
		}
		if user.Role == models.RoleTeacher {
			var count int64
			err := s.db.WithContext(ctx).Table("teaching_assignments a").Joins("JOIN classes c ON c.id = a.class_id").Where("a.teacher_id = ? AND a.active = true AND c.grade = ?", user.ID, *announcement.Grade).Count(&count).Error
			return count > 0, err
		}
	}
	if announcement.Scope == "class" && announcement.TargetClassID != nil {
		if user.Role == models.RoleClassroom {
			return user.ClassID != nil && *user.ClassID == *announcement.TargetClassID, nil
		}
		if user.Role == models.RoleTeacher {
			var count int64
			err := s.db.WithContext(ctx).Model(&models.TeachingAssignment{}).Where("teacher_id = ? AND class_id = ? AND active = true", user.ID, *announcement.TargetClassID).Count(&count).Error
			return count > 0, err
		}
	}
	return false, nil
}

func (s *AnnouncementService) hydrate(ctx context.Context, userID models.ID, announcements []models.Announcement) ([]AnnouncementDTO, error) {
	result := make([]AnnouncementDTO, 0, len(announcements))
	if len(announcements) == 0 {
		return result, nil
	}
	ids := make([]models.ID, len(announcements))
	for i := range announcements {
		ids[i] = announcements[i].ID
	}
	confirmed := map[models.ID]time.Time{}
	var confirmations []models.AnnouncementConfirmation
	if err := s.db.WithContext(ctx).Where("user_id = ? AND announcement_id IN ?", userID, ids).Find(&confirmations).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	for _, item := range confirmations {
		confirmed[item.AnnouncementID] = item.ConfirmedAt
	}
	for _, item := range announcements {
		name := ""
		if item.Publisher != nil {
			name = item.Publisher.DisplayName
		}
		var confirmedAt *time.Time
		if value, ok := confirmed[item.ID]; ok {
			copy := value
			confirmedAt = &copy
		}
		result = append(result, AnnouncementDTO{ID: item.ID, Title: item.Title, Content: item.Content, Type: item.Type, Scope: item.Scope, Grade: item.Grade, TargetClassID: item.TargetClassID, PublisherID: item.PublisherID, PublisherName: name, CreatedAt: item.CreatedAt, ConfirmedAt: confirmedAt})
	}
	return result, nil
}

func (s *AnnouncementService) publish(ctx context.Context, event realtime.Event) {
	if s.publisher != nil {
		if err := s.publisher.Publish(ctx, event); err != nil {
			log.Printf("公告实时事件发布失败，数据库记录已提交: event_id=%s error=%v", event.EventID, err)
		}
	}
}
