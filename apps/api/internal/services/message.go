package services

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"lumina/api/internal/apperror"
	"lumina/api/internal/models"
	"lumina/api/internal/realtime"
)

const (
	MaxMessageRunes = 2000
	RecallWindow    = 2 * time.Minute
)

type MessageDTO struct {
	ID          models.ID          `json:"id"`
	ChannelID   models.ID          `json:"channel_id"`
	SenderID    models.ID          `json:"sender_id"`
	SenderName  string             `json:"sender_name"`
	Type        models.MessageType `json:"type"`
	Content     string             `json:"content"`
	Metadata    json.RawMessage    `json:"metadata"`
	ReplyToID   *models.ID         `json:"reply_to_id,omitempty"`
	IsPinned    bool               `json:"is_pinned"`
	CreatedAt   time.Time          `json:"created_at"`
	EditedAt    *time.Time         `json:"edited_at,omitempty"`
	DeletedAt   *time.Time         `json:"deleted_at,omitempty"`
	ReadCount   int64              `json:"read_count"`
	ConfirmedAt *time.Time         `json:"confirmed_at,omitempty"`
}

type SendMessageInput struct {
	Type      models.MessageType `json:"type"`
	Content   string             `json:"content"`
	Metadata  json.RawMessage    `json:"metadata"`
	ReplyToID *models.ID         `json:"reply_to_id,omitempty"`
}

type HistoryResult struct {
	Items        []MessageDTO `json:"items"`
	NextBeforeID *models.ID   `json:"next_before_id,omitempty"`
	HasMore      bool         `json:"has_more"`
}

type BatchResult struct {
	ChannelID models.ID   `json:"channel_id"`
	Success   bool        `json:"success"`
	Message   *MessageDTO `json:"message,omitempty"`
	Code      string      `json:"code,omitempty"`
	Error     string      `json:"error,omitempty"`
}

type MessageService struct {
	db         *gorm.DB
	membership *Membership
	publisher  realtime.Publisher
	now        func() time.Time
}

func NewMessageService(db *gorm.DB, membership *Membership, publisher realtime.Publisher) *MessageService {
	return &MessageService{db: db, membership: membership, publisher: publisher, now: func() time.Time { return time.Now().UTC() }}
}

func (s *MessageService) History(ctx context.Context, userID, channelID, beforeID models.ID, limit int, query string) (*HistoryResult, error) {
	if err := s.membership.RequireAccess(ctx, userID, channelID); err != nil {
		return nil, err
	}
	limit = normalizeHistoryLimit(limit)
	if len([]rune(query)) > 200 {
		return nil, apperror.BadRequest("VALIDATION_ERROR", "搜索词不能超过二百字")
	}
	db := s.db.WithContext(ctx).Model(&models.Message{}).Preload("Sender").Where("channel_id = ?", channelID)
	if beforeID > 0 {
		db = db.Where("id < ?", beforeID)
	}
	if query = strings.TrimSpace(query); query != "" {
		db = db.Where("deleted_at IS NULL AND content ILIKE ?", "%"+query+"%")
	}
	var messages []models.Message
	if err := db.Order("id DESC").Limit(limit + 1).Find(&messages).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	hasMore := len(messages) > limit
	if hasMore {
		messages = messages[:limit]
	}
	items, err := s.hydrateMessages(ctx, userID, messages)
	if err != nil {
		return nil, err
	}
	result := &HistoryResult{Items: items, HasMore: hasMore}
	if hasMore && len(messages) > 0 {
		id := messages[len(messages)-1].ID
		result.NextBeforeID = &id
	}
	return result, nil
}

func normalizeHistoryLimit(limit int) int {
	if limit <= 0 {
		return 50
	}
	if limit > 100 {
		return 100
	}
	return limit
}

func (s *MessageService) Send(ctx context.Context, userID, channelID models.ID, input SendMessageInput) (*MessageDTO, error) {
	if err := s.membership.RequireWrite(ctx, userID, channelID); err != nil {
		return nil, err
	}
	var sender models.User
	if err := s.db.WithContext(ctx).First(&sender, userID).Error; err != nil || !sender.Active {
		return nil, apperror.Unauthorized("ACCOUNT_DISABLED", "账号不可用")
	}
	if err := validateMessage(sender, input); err != nil {
		return nil, err
	}
	metadata := input.Metadata
	if len(metadata) == 0 {
		metadata = json.RawMessage(`{}`)
	}
	message := models.Message{ChannelID: channelID, SenderID: userID, Type: input.Type, Content: input.Content, Metadata: datatypes.JSON(metadata), ReplyToID: input.ReplyToID, CreatedAt: s.now()}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if input.ReplyToID != nil {
			var reply models.Message
			if err := tx.First(&reply, *input.ReplyToID).Error; err != nil {
				return apperror.BadRequest("REPLY_INVALID", "回复目标不存在")
			}
			if reply.ChannelID != channelID || reply.DeletedAt != nil {
				return apperror.BadRequest("REPLY_INVALID", "回复目标必须属于当前通道且未删除")
			}
		}
		if input.Type == models.MessageImage || input.Type == models.MessageFile {
			var payload struct {
				FileID models.ID `json:"file_id"`
			}
			if err := json.Unmarshal(metadata, &payload); err != nil || payload.FileID == 0 {
				return apperror.BadRequest("FILE_REQUIRED", "图片或文件消息必须关联上传文件")
			}
			var file models.FileObject
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&file, payload.FileID).Error; err != nil {
				return apperror.BadRequest("FILE_INVALID", "上传文件不存在")
			}
			expectedKind := "file"
			if input.Type == models.MessageImage {
				expectedKind = "image"
			}
			if file.OwnerID != userID || file.ChannelID != channelID || file.Kind != expectedKind || file.MessageID != nil {
				return apperror.Forbidden("FILE_INVALID", "上传文件不属于当前用户、通道或已被使用")
			}
		}
		if err := tx.Create(&message).Error; err != nil {
			return err
		}
		if input.Type == models.MessageImage || input.Type == models.MessageFile {
			var payload struct {
				FileID models.ID `json:"file_id"`
			}
			_ = json.Unmarshal(metadata, &payload)
			result := tx.Model(&models.FileObject{}).Where("id = ? AND message_id IS NULL", payload.FileID).Update("message_id", message.ID)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return apperror.Conflict("FILE_ALREADY_USED", "上传文件已被使用")
			}
		}
		read := models.ChannelRead{ChannelID: channelID, UserID: userID, LastReadMessageID: &message.ID, UpdatedAt: s.now()}
		return tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "channel_id"}, {Name: "user_id"}}, DoUpdates: clause.AssignmentColumns([]string{"last_read_message_id", "updated_at"})}).Create(&read).Error
	})
	if err != nil {
		var appErr *apperror.Error
		if errors.As(err, &appErr) {
			return nil, appErr
		}
		return nil, apperror.Internal(err)
	}
	dto := toMessageDTO(message, sender.DisplayName, 0, nil)
	s.publish(ctx, realtime.NewEvent(realtime.EventNewMessage, &channelID, map[string]any{"message": dto}))
	return &dto, nil
}

func validateMessage(sender models.User, input SendMessageInput) error {
	if !input.Type.Valid() {
		return apperror.BadRequest("MESSAGE_TYPE_INVALID", "消息类型无效")
	}
	if utf8.RuneCountInString(input.Content) > MaxMessageRunes {
		return apperror.BadRequest("MESSAGE_TOO_LONG", "消息正文不能超过二千字")
	}
	if len(input.Metadata) > 8192 {
		return apperror.BadRequest("METADATA_TOO_LARGE", "消息元数据过大")
	}
	if len(input.Metadata) > 0 {
		var object map[string]any
		if err := json.Unmarshal(input.Metadata, &object); err != nil || object == nil {
			return apperror.BadRequest("METADATA_INVALID", "消息元数据必须是 JSON 对象")
		}
	}
	if input.Type != models.MessageImage && input.Type != models.MessageFile && strings.TrimSpace(input.Content) == "" {
		return apperror.BadRequest("CONTENT_REQUIRED", "消息正文不能为空")
	}
	if (input.Type == models.MessageNotice || input.Type == models.MessageUrgent) && sender.Role != models.RoleTeacher && sender.Role != models.RoleAdmin {
		return apperror.Forbidden("MESSAGE_TYPE_FORBIDDEN", "只有教师可以发送通知或紧急消息")
	}
	return nil
}

func (s *MessageService) Edit(ctx context.Context, userID, messageID models.ID, content string) (*MessageDTO, error) {
	if utf8.RuneCountInString(strings.TrimSpace(content)) == 0 || utf8.RuneCountInString(content) > MaxMessageRunes {
		return nil, apperror.BadRequest("CONTENT_INVALID", "消息正文须为一至二千字")
	}
	var message models.Message
	if err := s.db.WithContext(ctx).Preload("Sender").First(&message, messageID).Error; err != nil {
		return nil, apperror.NotFound("MESSAGE_NOT_FOUND", "消息不存在")
	}
	if err := s.membership.RequireAccess(ctx, userID, message.ChannelID); err != nil {
		return nil, err
	}
	if message.SenderID != userID {
		return nil, apperror.Forbidden("MESSAGE_EDIT_FORBIDDEN", "只能编辑本人发送的消息")
	}
	if message.DeletedAt != nil {
		return nil, apperror.Conflict("MESSAGE_DELETED", "已删除消息不能编辑")
	}
	if message.Type == models.MessageImage || message.Type == models.MessageFile {
		return nil, apperror.BadRequest("MESSAGE_TYPE_INVALID", "图片或文件消息只能修改说明以外的文字内容")
	}
	now := s.now()
	message.Content = content
	message.EditedAt = &now
	if err := s.db.WithContext(ctx).Model(&models.Message{}).Where("id = ? AND deleted_at IS NULL", messageID).Updates(map[string]any{"content": content, "edited_at": now}).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	count, _ := s.readCount(ctx, messageID)
	dto := toMessageDTO(message, message.Sender.DisplayName, count, nil)
	s.publish(ctx, realtime.NewEvent(realtime.EventMessageEdited, &message.ChannelID, map[string]any{"message": dto}))
	return &dto, nil
}

func (s *MessageService) Delete(ctx context.Context, userID, messageID models.ID) error {
	var message models.Message
	if err := s.db.WithContext(ctx).First(&message, messageID).Error; err != nil {
		return apperror.NotFound("MESSAGE_NOT_FOUND", "消息不存在")
	}
	if err := s.membership.RequireAccess(ctx, userID, message.ChannelID); err != nil {
		return err
	}
	if !CanRecall(message, userID, s.now()) {
		return apperror.Forbidden("RECALL_FORBIDDEN", "仅发送者可在两分钟内撤回消息")
	}
	result := s.db.WithContext(ctx).Model(&models.Message{}).Where("id = ? AND deleted_at IS NULL", messageID).Update("deleted_at", s.now())
	if result.Error != nil {
		return apperror.Internal(result.Error)
	}
	if result.RowsAffected != 1 {
		return apperror.Conflict("MESSAGE_DELETED", "消息已撤回")
	}
	s.publish(ctx, realtime.NewEvent(realtime.EventMessageDeleted, &message.ChannelID, map[string]any{"message_id": messageID, "deleted_at": s.now()}))
	return nil
}

func CanRecall(message models.Message, userID models.ID, now time.Time) bool {
	return message.SenderID == userID && message.DeletedAt == nil && !now.After(message.CreatedAt.Add(RecallWindow))
}

func (s *MessageService) Read(ctx context.Context, userID, messageID models.ID) error {
	message, err := s.markRead(ctx, userID, messageID, false)
	if err != nil {
		return err
	}
	count, _ := s.readCount(ctx, messageID)
	s.publish(ctx, realtime.NewEvent(realtime.EventReadAck, &message.ChannelID, map[string]any{"message_id": messageID, "user_id": userID, "read_count": count}))
	return nil
}

func (s *MessageService) Confirm(ctx context.Context, userID, messageID models.ID) (*time.Time, error) {
	message, err := s.markRead(ctx, userID, messageID, true)
	if err != nil {
		return nil, err
	}
	var confirmation models.MessageConfirmation
	if err := s.db.WithContext(ctx).Where("message_id = ? AND user_id = ?", messageID, userID).First(&confirmation).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	s.publish(ctx, realtime.NewEvent(realtime.EventReadAck, &message.ChannelID, map[string]any{"message_id": messageID, "user_id": userID, "confirmed": true, "confirmed_at": confirmation.ConfirmedAt}))
	return &confirmation.ConfirmedAt, nil
}

func (s *MessageService) markRead(ctx context.Context, userID, messageID models.ID, confirm bool) (*models.Message, error) {
	var message models.Message
	if err := s.db.WithContext(ctx).First(&message, messageID).Error; err != nil {
		return nil, apperror.NotFound("MESSAGE_NOT_FOUND", "消息不存在")
	}
	if err := s.membership.RequireAccess(ctx, userID, message.ChannelID); err != nil {
		return nil, err
	}
	if confirm && message.Type != models.MessageUrgent {
		return nil, apperror.BadRequest("CONFIRM_NOT_REQUIRED", "只有紧急消息需要确认")
	}
	now := s.now()
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		read := models.MessageRead{MessageID: messageID, UserID: userID, ReadAt: now}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&read).Error; err != nil {
			return err
		}
		if confirm {
			confirmation := models.MessageConfirmation{MessageID: messageID, UserID: userID, ConfirmedAt: now}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&confirmation).Error; err != nil {
				return err
			}
		}
		position := models.ChannelRead{ChannelID: message.ChannelID, UserID: userID, LastReadMessageID: &message.ID, UpdatedAt: now}
		return tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "channel_id"}, {Name: "user_id"}}, DoUpdates: clause.Assignments(map[string]any{"last_read_message_id": gorm.Expr("GREATEST(COALESCE(channel_reads.last_read_message_id, 0), excluded.last_read_message_id)"), "updated_at": now})}).Create(&position).Error
	})
	if err != nil {
		return nil, apperror.Internal(err)
	}
	return &message, nil
}

func (s *MessageService) Batch(ctx context.Context, teacherID models.ID, channelIDs []models.ID, content string, messageType models.MessageType) ([]BatchResult, error) {
	if messageType != models.MessageNotice && messageType != models.MessageUrgent {
		return nil, apperror.BadRequest("MESSAGE_TYPE_INVALID", "批量通知类型必须为 notice 或 urgent")
	}
	if len(channelIDs) == 0 || len(channelIDs) > 50 {
		return nil, apperror.BadRequest("CHANNEL_COUNT_INVALID", "每次须选择一至五十个通道")
	}
	seen := map[models.ID]bool{}
	results := make([]BatchResult, 0, len(channelIDs))
	for _, channelID := range channelIDs {
		if seen[channelID] {
			return nil, apperror.BadRequest("CHANNEL_DUPLICATE", "通道列表不能重复")
		}
		seen[channelID] = true
		message, err := s.Send(ctx, teacherID, channelID, SendMessageInput{Type: messageType, Content: content, Metadata: json.RawMessage(`{}`)})
		result := BatchResult{ChannelID: channelID, Success: err == nil, Message: message}
		if err != nil {
			result.Error = "发送失败"
			var appErr *apperror.Error
			if errors.As(err, &appErr) {
				result.Code = appErr.Code
				result.Error = appErr.Message
			} else {
				result.Code = "INTERNAL_ERROR"
			}
		}
		results = append(results, result)
	}
	return results, nil
}

func (s *MessageService) PendingUrgent(ctx context.Context, userID models.ID) ([]MessageDTO, error) {
	channels, _, err := s.membership.AccessibleChannels(ctx, userID)
	if err != nil {
		return nil, err
	}
	ids := make([]models.ID, len(channels))
	for i := range channels {
		ids[i] = channels[i].ID
	}
	if len(ids) == 0 {
		return []MessageDTO{}, nil
	}
	var messages []models.Message
	if err := s.db.WithContext(ctx).Preload("Sender").Where("type = 'urgent' AND deleted_at IS NULL AND sender_id <> ? AND channel_id IN ? AND NOT EXISTS (SELECT 1 FROM message_confirmations mc WHERE mc.message_id = messages.id AND mc.user_id = ?)", userID, ids, userID).Order("id DESC").Find(&messages).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	return s.hydrateMessages(ctx, userID, messages)
}

func (s *MessageService) hydrateMessages(ctx context.Context, userID models.ID, messages []models.Message) ([]MessageDTO, error) {
	items := make([]MessageDTO, 0, len(messages))
	if len(messages) == 0 {
		return items, nil
	}
	ids := make([]models.ID, len(messages))
	for i := range messages {
		ids[i] = messages[i].ID
	}
	counts := map[models.ID]int64{}
	rows := []struct {
		MessageID models.ID
		Count     int64
	}{}
	if err := s.db.WithContext(ctx).Raw("SELECT message_id, COUNT(*) AS count FROM message_reads WHERE message_id IN ? GROUP BY message_id", ids).Scan(&rows).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	for _, row := range rows {
		counts[row.MessageID] = row.Count
	}
	confirmations := map[models.ID]time.Time{}
	var confirmed []models.MessageConfirmation
	if err := s.db.WithContext(ctx).Where("user_id = ? AND message_id IN ?", userID, ids).Find(&confirmed).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	for _, item := range confirmed {
		confirmations[item.MessageID] = item.ConfirmedAt
	}
	for _, message := range messages {
		name := ""
		if message.Sender != nil {
			name = message.Sender.DisplayName
		}
		var confirmedAt *time.Time
		if value, ok := confirmations[message.ID]; ok {
			valueCopy := value
			confirmedAt = &valueCopy
		}
		items = append(items, toMessageDTO(message, name, counts[message.ID], confirmedAt))
	}
	return items, nil
}

func toMessageDTO(message models.Message, senderName string, readCount int64, confirmedAt *time.Time) MessageDTO {
	content := message.Content
	metadata := cloneJSON(message.Metadata)
	if message.DeletedAt != nil {
		content = ""
		metadata = json.RawMessage(`{}`)
	}
	return MessageDTO{ID: message.ID, ChannelID: message.ChannelID, SenderID: message.SenderID, SenderName: senderName, Type: message.Type, Content: content, Metadata: metadata, ReplyToID: message.ReplyToID, IsPinned: message.IsPinned, CreatedAt: message.CreatedAt, EditedAt: message.EditedAt, DeletedAt: message.DeletedAt, ReadCount: readCount, ConfirmedAt: confirmedAt}
}

func (s *MessageService) readCount(ctx context.Context, messageID models.ID) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&models.MessageRead{}).Where("message_id = ?", messageID).Count(&count).Error
	return count, err
}
func (s *MessageService) publish(ctx context.Context, event realtime.Event) {
	if s.publisher != nil {
		if err := s.publisher.Publish(ctx, event); err != nil {
			log.Printf("实时事件发布失败，数据库记录已提交: type=%s event_id=%s error=%v", event.Type, event.EventID, err)
		}
	}
}
