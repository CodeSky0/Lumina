package services

import (
	"context"

	"gorm.io/gorm"

	"lumina/api/internal/apperror"
	"lumina/api/internal/models"
)

type Membership struct{ db *gorm.DB }

func NewMembership(db *gorm.DB) *Membership { return &Membership{db: db} }

func (m *Membership) CanAccess(ctx context.Context, userID, channelID models.ID) (bool, error) {
	user, channel, err := m.load(ctx, userID, channelID)
	if err != nil || !user.Active || !channel.Active {
		return false, err
	}
	if user.Role == models.RoleAdmin {
		return true, nil
	}
	if channel.Type == models.ChannelNormal {
		if user.Role == models.RoleTeacher {
			return channel.TeacherID != nil && *channel.TeacherID == user.ID, nil
		}
		return user.Role == models.RoleClassroom && user.ClassID != nil && channel.ClassID != nil && *channel.ClassID == *user.ClassID, nil
	}
	if channel.BroadcastScope == nil {
		return false, nil
	}
	switch *channel.BroadcastScope {
	case "school":
		return true, nil
	case "grade":
		if channel.Grade == nil {
			return false, nil
		}
		if user.Role == models.RoleClassroom {
			return user.Class != nil && user.Class.Active && user.Class.Grade == *channel.Grade, nil
		}
		return m.teacherHasGrade(ctx, user.ID, *channel.Grade)
	case "class":
		if channel.TargetClassID == nil {
			return false, nil
		}
		if user.Role == models.RoleClassroom {
			return user.ClassID != nil && *user.ClassID == *channel.TargetClassID, nil
		}
		return m.teacherHasClass(ctx, user.ID, *channel.TargetClassID)
	default:
		return false, nil
	}
}

func (m *Membership) RequireAccess(ctx context.Context, userID, channelID models.ID) error {
	allowed, err := m.CanAccess(ctx, userID, channelID)
	if err != nil {
		return apperror.Internal(err)
	}
	if !allowed {
		return apperror.Forbidden("CHANNEL_FORBIDDEN", "无权访问该通道")
	}
	return nil
}

func (m *Membership) RequireWrite(ctx context.Context, userID, channelID models.ID) error {
	user, channel, err := m.load(ctx, userID, channelID)
	if err != nil {
		return apperror.Internal(err)
	}
	if !canWrite(*user, *channel) {
		return apperror.Forbidden("CHANNEL_WRITE_FORBIDDEN", "无权写入该通道")
	}
	return nil
}

func canWrite(user models.User, channel models.Channel) bool {
	if !user.Active || !channel.Active || channel.Type != models.ChannelNormal {
		return false
	}
	switch user.Role {
	case models.RoleTeacher:
		return channel.TeacherID != nil && *channel.TeacherID == user.ID
	case models.RoleClassroom:
		return user.ClassID != nil && channel.ClassID != nil && *channel.ClassID == *user.ClassID
	default:
		return false
	}
}

func (m *Membership) AccessibleChannels(ctx context.Context, userID models.ID) ([]models.Channel, *models.User, error) {
	var user models.User
	if err := m.db.WithContext(ctx).Preload("Class").First(&user, userID).Error; err != nil || !user.Active {
		return nil, nil, apperror.Unauthorized("ACCOUNT_DISABLED", "账号不可用")
	}
	var channels []models.Channel
	query := m.db.WithContext(ctx).Preload("Class").Preload("Subject").Preload("Teacher").Where("active = ?", true).Order("id ASC")
	if user.Role == models.RoleClassroom {
		query = query.Where("(type = 'normal' AND class_id = ?) OR (type = 'broadcast' AND (broadcast_scope = 'school' OR (broadcast_scope = 'grade' AND grade = ?) OR (broadcast_scope = 'class' AND target_class_id = ?)))", user.ClassID, user.Class.Grade, user.ClassID)
	} else if user.Role == models.RoleTeacher {
		query = query.Where("(type = 'normal' AND teacher_id = ?) OR type = 'broadcast'", user.ID)
	}
	if err := query.Find(&channels).Error; err != nil {
		return nil, nil, apperror.Internal(err)
	}
	if user.Role != models.RoleTeacher {
		return channels, &user, nil
	}
	filtered := make([]models.Channel, 0, len(channels))
	for _, channel := range channels {
		if channel.Type == models.ChannelNormal || channel.BroadcastScope == nil || *channel.BroadcastScope == "school" {
			filtered = append(filtered, channel)
			continue
		}
		allowed := false
		var err error
		if *channel.BroadcastScope == "grade" && channel.Grade != nil {
			allowed, err = m.teacherHasGrade(ctx, user.ID, *channel.Grade)
		} else if *channel.BroadcastScope == "class" && channel.TargetClassID != nil {
			allowed, err = m.teacherHasClass(ctx, user.ID, *channel.TargetClassID)
		}
		if err != nil {
			return nil, nil, apperror.Internal(err)
		}
		if allowed {
			filtered = append(filtered, channel)
		}
	}
	return filtered, &user, nil
}

func (m *Membership) PermittedChannelIDs(ctx context.Context, userID models.ID) ([]models.ID, error) {
	channels, _, err := m.AccessibleChannels(ctx, userID)
	if err != nil {
		return nil, err
	}
	ids := make([]models.ID, len(channels))
	for i := range channels {
		ids[i] = channels[i].ID
	}
	return ids, nil
}

func (m *Membership) load(ctx context.Context, userID, channelID models.ID) (*models.User, *models.Channel, error) {
	var user models.User
	if err := m.db.WithContext(ctx).Preload("Class").First(&user, userID).Error; err != nil {
		return nil, nil, err
	}
	var channel models.Channel
	if err := m.db.WithContext(ctx).First(&channel, channelID).Error; err != nil {
		return nil, nil, err
	}
	return &user, &channel, nil
}

func (m *Membership) teacherHasGrade(ctx context.Context, teacherID models.ID, grade int) (bool, error) {
	var count int64
	err := m.db.WithContext(ctx).Table("teaching_assignments a").
		Joins("JOIN classes c ON c.id = a.class_id AND c.active = true").
		Where("a.teacher_id = ? AND a.active = true AND c.grade = ?", teacherID, grade).Count(&count).Error
	return count > 0, err
}

func (m *Membership) teacherHasClass(ctx context.Context, teacherID, classID models.ID) (bool, error) {
	var count int64
	err := m.db.WithContext(ctx).Model(&models.TeachingAssignment{}).
		Where("teacher_id = ? AND class_id = ? AND active = true", teacherID, classID).Count(&count).Error
	return count > 0, err
}
