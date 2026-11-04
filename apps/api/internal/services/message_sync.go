package services

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"lumina/api/internal/apperror"
	"lumina/api/internal/models"
	"lumina/api/internal/realtime"
)

type SyncResult struct {
	Items       []MessageDTO `json:"items"`
	NextAfterID *models.ID   `json:"next_after_id,omitempty"`
	HasMore     bool         `json:"has_more"`
}

func (s *MessageService) Sync(ctx context.Context, userID, channelID, afterID models.ID, limit int) (*SyncResult, error) {
	if err := s.membership.RequireAccess(ctx, userID, channelID); err != nil {
		return nil, err
	}
	if afterID == 0 {
		var position models.ChannelRead
		err := s.db.WithContext(ctx).Where("channel_id = ? AND user_id = ?", channelID, userID).First(&position).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperror.Internal(err)
		}
		if position.LastReadMessageID != nil {
			afterID = *position.LastReadMessageID
		}
	}
	limit = normalizeHistoryLimit(limit)
	var messages []models.Message
	if err := s.db.WithContext(ctx).Model(&models.Message{}).Preload("Sender").Where("channel_id = ? AND id > ?", channelID, afterID).Order("id ASC").Limit(limit + 1).Find(&messages).Error; err != nil {
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
	result := &SyncResult{Items: items, HasMore: hasMore}
	if len(messages) > 0 {
		id := messages[len(messages)-1].ID
		result.NextAfterID = &id
	}
	return result, nil
}

func normalizeDeliveryIDs(messageIDs []models.ID) ([]models.ID, error) {
	if len(messageIDs) == 0 || len(messageIDs) > 100 {
		return nil, apperror.BadRequest("DELIVERY_ACK_COUNT_INVALID", "每批须确认一至一百条消息")
	}
	seen := make(map[models.ID]bool, len(messageIDs))
	ids := make([]models.ID, 0, len(messageIDs))
	for _, id := range messageIDs {
		if id <= 0 {
			return nil, apperror.BadRequest("MESSAGE_ID_INVALID", "消息标识无效")
		}
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func (s *MessageService) AcknowledgeDeliveries(ctx context.Context, userID models.ID, messageIDs []models.ID) error {
	ids, err := normalizeDeliveryIDs(messageIDs)
	if err != nil {
		return err
	}
	var messages []models.Message
	if err := s.db.WithContext(ctx).Where("id IN ?", ids).Find(&messages).Error; err != nil {
		return apperror.Internal(err)
	}
	if len(messages) != len(ids) {
		return apperror.NotFound("MESSAGE_NOT_FOUND", "部分消息不存在")
	}
	byID := make(map[models.ID]models.Message, len(messages))
	for _, message := range messages {
		byID[message.ID] = message
	}
	ordered := make([]models.Message, 0, len(ids))
	for _, id := range ids {
		message := byID[id]
		if err := s.membership.RequireAccess(ctx, userID, message.ChannelID); err != nil {
			return err
		}
		if message.SenderID != userID {
			ordered = append(ordered, message)
		}
	}
	if len(ordered) == 0 {
		return nil
	}
	now := s.now()
	events := make([]realtime.Event, 0, len(ordered))
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		deliveries := make([]models.MessageDelivery, 0, len(ordered))
		for _, message := range ordered {
			deliveries = append(deliveries, models.MessageDelivery{MessageID: message.ID, UserID: userID, DeliveredAt: now})
		}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&deliveries).Error; err != nil {
			return err
		}
		for _, message := range ordered {
			var count int64
			if err := tx.Model(&models.MessageDelivery{}).Where("message_id = ? AND user_id <> ?", message.ID, message.SenderID).Count(&count).Error; err != nil {
				return err
			}
			event := realtime.NewEvent(realtime.EventDeliveryAck, &message.ChannelID, map[string]any{"message_id": message.ID, "user_id": userID, "delivery_count": count})
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
		return apperror.Internal(err)
	}
	if s.recorder == nil {
		for _, event := range events {
			s.publish(ctx, event)
		}
	}
	return nil
}
