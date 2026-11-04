package services

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"lumina/api/internal/apperror"
	"lumina/api/internal/models"
)

type ConfirmationStatusItem struct {
	UserID      models.ID  `json:"user_id"`
	ClassID     models.ID  `json:"class_id"`
	ClassName   string     `json:"class_name"`
	Confirmed   bool       `json:"confirmed"`
	ConfirmedAt *time.Time `json:"confirmed_at,omitempty"`
}

func canViewConfirmations(user models.User, ownerID models.ID) bool {
	return user.Role == models.RoleAdmin || user.ID == ownerID
}

func requireClassroomConfirmation(user models.User) error {
	if user.Role != models.RoleClassroom {
		return apperror.Forbidden("CONFIRM_ROLE_FORBIDDEN", "只有教室端可以确认紧急通知")
	}
	return nil
}

type confirmationQuery struct {
	table          string
	resourceColumn string
	resourceID     models.ID
	where          string
	args           []any
}

func confirmationStatuses(ctx context.Context, db *gorm.DB, query confirmationQuery) ([]ConfirmationStatusItem, error) {
	sql := fmt.Sprintf(`SELECT u.id AS user_id, c.id AS class_id, c.name AS class_name, confirmations.confirmed_at
		FROM users u
		JOIN classes c ON c.id = u.class_id
		LEFT JOIN %s confirmations ON confirmations.%s = ? AND confirmations.user_id = u.id
		WHERE u.role = 'classroom' AND u.active = true AND c.active = true AND %s
		ORDER BY u.id ASC`, query.table, query.resourceColumn, query.where)
	args := append([]any{query.resourceID}, query.args...)
	rows := make([]struct {
		UserID      models.ID
		ClassID     models.ID
		ClassName   string
		ConfirmedAt *time.Time
	}, 0)
	if err := db.WithContext(ctx).Raw(sql, args...).Scan(&rows).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	items := make([]ConfirmationStatusItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ConfirmationStatusItem{UserID: row.UserID, ClassID: row.ClassID, ClassName: row.ClassName, Confirmed: row.ConfirmedAt != nil, ConfirmedAt: row.ConfirmedAt})
	}
	return items, nil
}

func (s *MessageService) ConfirmationStatus(ctx context.Context, userID, messageID models.ID) ([]ConfirmationStatusItem, error) {
	var message models.Message
	if err := s.db.WithContext(ctx).First(&message, messageID).Error; err != nil {
		return nil, apperror.NotFound("MESSAGE_NOT_FOUND", "消息不存在")
	}
	var requester models.User
	if err := s.db.WithContext(ctx).First(&requester, userID).Error; err != nil {
		return nil, apperror.Unauthorized("ACCOUNT_DISABLED", "账号不可用")
	}
	if !canViewConfirmations(requester, message.SenderID) {
		return nil, apperror.Forbidden("CONFIRMATION_STATUS_FORBIDDEN", "无权查看该消息的确认进度")
	}
	var channel models.Channel
	if err := s.db.WithContext(ctx).First(&channel, message.ChannelID).Error; err != nil || channel.ClassID == nil {
		return nil, apperror.NotFound("CHANNEL_NOT_FOUND", "消息通道不存在")
	}
	return confirmationStatuses(ctx, s.db, confirmationQuery{table: "message_confirmations", resourceColumn: "message_id", resourceID: messageID, where: "u.class_id = ?", args: []any{*channel.ClassID}})
}

func (s *AnnouncementService) ConfirmationStatus(ctx context.Context, userID, announcementID models.ID) ([]ConfirmationStatusItem, error) {
	var announcement models.Announcement
	if err := s.db.WithContext(ctx).First(&announcement, announcementID).Error; err != nil {
		return nil, apperror.NotFound("ANNOUNCEMENT_NOT_FOUND", "公告不存在")
	}
	var requester models.User
	if err := s.db.WithContext(ctx).First(&requester, userID).Error; err != nil {
		return nil, apperror.Unauthorized("ACCOUNT_DISABLED", "账号不可用")
	}
	if !canViewConfirmations(requester, announcement.PublisherID) {
		return nil, apperror.Forbidden("CONFIRMATION_STATUS_FORBIDDEN", "无权查看该公告的确认进度")
	}
	where := "TRUE"
	args := []any{}
	if announcement.Scope == "grade" && announcement.Grade != nil {
		where = "c.grade = ?"
		args = append(args, *announcement.Grade)
	}
	if announcement.Scope == "class" && announcement.TargetClassID != nil {
		where = "c.id = ?"
		args = append(args, *announcement.TargetClassID)
	}
	return confirmationStatuses(ctx, s.db, confirmationQuery{table: "announcement_confirmations", resourceColumn: "announcement_id", resourceID: announcementID, where: where, args: args})
}
