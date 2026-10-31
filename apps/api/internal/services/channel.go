package services

import (
	"context"
	"encoding/json"

	"gorm.io/gorm"

	"lumina/api/internal/apperror"
	"lumina/api/internal/models"
)

type OnlineChecker interface {
	IsChannelOnline(channelID models.ID) bool
}

type ChannelDTO struct {
	ID           models.ID          `json:"id"`
	Name         string             `json:"name"`
	Type         models.ChannelType `json:"type"`
	ClassID      *models.ID         `json:"class_id,omitempty"`
	SubjectID    *models.ID         `json:"subject_id,omitempty"`
	TeacherID    *models.ID         `json:"teacher_id,omitempty"`
	ClassName    string             `json:"class_name,omitempty"`
	Grade        *int               `json:"grade,omitempty"`
	SubjectName  string             `json:"subject_name,omitempty"`
	SubjectIcon  string             `json:"subject_icon,omitempty"`
	SubjectColor string             `json:"subject_color,omitempty"`
	TeacherName  string             `json:"teacher_name,omitempty"`
	LastMessage  *MessageDTO        `json:"last_message,omitempty"`
	UnreadCount  int64              `json:"unread_count"`
	Online       bool               `json:"online"`
}

type ChannelService struct {
	db         *gorm.DB
	membership *Membership
	online     OnlineChecker
}

func NewChannelService(db *gorm.DB, membership *Membership, online OnlineChecker) *ChannelService {
	return &ChannelService{db: db, membership: membership, online: online}
}

func (s *ChannelService) List(ctx context.Context, userID models.ID) ([]ChannelDTO, error) {
	channels, _, err := s.membership.AccessibleChannels(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(channels) == 0 {
		return []ChannelDTO{}, nil
	}
	ids := make([]models.ID, len(channels))
	for i := range channels {
		ids[i] = channels[i].ID
	}
	last, err := s.lastMessages(ctx, ids)
	if err != nil {
		return nil, err
	}
	unread, err := s.unreadCounts(ctx, userID, ids)
	if err != nil {
		return nil, err
	}
	result := make([]ChannelDTO, 0, len(channels))
	for _, channel := range channels {
		dto := ChannelDTO{ID: channel.ID, Name: channel.Name, Type: channel.Type, ClassID: channel.ClassID, SubjectID: channel.SubjectID, TeacherID: channel.TeacherID, Grade: channel.Grade, LastMessage: last[channel.ID], UnreadCount: unread[channel.ID]}
		if channel.Class != nil {
			dto.ClassName = channel.Class.Name
			if dto.Grade == nil {
				grade := channel.Class.Grade
				dto.Grade = &grade
			}
		}
		if channel.Subject != nil {
			dto.SubjectName = channel.Subject.Name
			dto.SubjectIcon = channel.Subject.Icon
			dto.SubjectColor = channel.Subject.Color
		}
		if channel.Teacher != nil {
			dto.TeacherName = channel.Teacher.DisplayName
		}
		if s.online != nil {
			dto.Online = s.online.IsChannelOnline(channel.ID)
		}
		result = append(result, dto)
	}
	return result, nil
}

func (s *ChannelService) lastMessages(ctx context.Context, ids []models.ID) (map[models.ID]*MessageDTO, error) {
	var messages []models.Message
	if err := s.db.WithContext(ctx).Raw(`SELECT DISTINCT ON (channel_id) * FROM messages WHERE channel_id IN ? AND deleted_at IS NULL ORDER BY channel_id, id DESC`, ids).Scan(&messages).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	senderIDs := make([]models.ID, 0, len(messages))
	seen := map[models.ID]bool{}
	for _, message := range messages {
		if !seen[message.SenderID] {
			senderIDs = append(senderIDs, message.SenderID)
			seen[message.SenderID] = true
		}
	}
	names := map[models.ID]string{}
	if len(senderIDs) > 0 {
		var users []models.User
		if err := s.db.WithContext(ctx).Select("id", "display_name").Where("id IN ?", senderIDs).Find(&users).Error; err != nil {
			return nil, apperror.Internal(err)
		}
		for _, user := range users {
			names[user.ID] = user.DisplayName
		}
	}
	result := map[models.ID]*MessageDTO{}
	for i := range messages {
		message := messages[i]
		dto := toMessageDTO(message, names[message.SenderID], 0, nil)
		result[message.ChannelID] = &dto
	}
	return result, nil
}

func (s *ChannelService) unreadCounts(ctx context.Context, userID models.ID, ids []models.ID) (map[models.ID]int64, error) {
	rows := []struct {
		ChannelID models.ID
		Count     int64
	}{}
	if err := s.db.WithContext(ctx).Raw(`SELECT m.channel_id, COUNT(*) AS count FROM messages m LEFT JOIN channel_reads cr ON cr.channel_id = m.channel_id AND cr.user_id = ? WHERE m.channel_id IN ? AND m.sender_id <> ? AND m.deleted_at IS NULL AND (cr.last_read_message_id IS NULL OR m.id > cr.last_read_message_id) GROUP BY m.channel_id`, userID, ids, userID).Scan(&rows).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	result := map[models.ID]int64{}
	for _, row := range rows {
		result[row.ChannelID] = row.Count
	}
	return result, nil
}

func cloneJSON(input []byte) json.RawMessage {
	if len(input) == 0 {
		return json.RawMessage(`{}`)
	}
	return json.RawMessage(append([]byte(nil), input...))
}
