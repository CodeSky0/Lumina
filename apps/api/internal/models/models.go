package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"gorm.io/datatypes"
)

// ID 将所有数值标识序列化为字符串，避免 JavaScript 精度丢失。
type ID int64

func (id ID) String() string { return strconv.FormatInt(int64(id), 10) }

func (id ID) MarshalJSON() ([]byte, error) { return json.Marshal(id.String()) }

func (id *ID) UnmarshalJSON(data []byte) error {
	value := strings.Trim(string(data), "\"")
	if value == "" || value == "null" {
		return fmt.Errorf("标识不能为空")
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return fmt.Errorf("标识格式无效")
	}
	*id = ID(parsed)
	return nil
}

func (id *ID) Scan(value any) error {
	switch v := value.(type) {
	case int64:
		*id = ID(v)
		return nil
	case []byte:
		parsed, err := strconv.ParseInt(string(v), 10, 64)
		if err != nil {
			return err
		}
		*id = ID(parsed)
		return nil
	case string:
		parsed, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return err
		}
		*id = ID(parsed)
		return nil
	default:
		return fmt.Errorf("不支持的数据库标识类型 %T", value)
	}
}

func (id ID) Value() (driver.Value, error) { return int64(id), nil }

type Role string

const (
	RoleAdmin     Role = "admin"
	RoleTeacher   Role = "teacher"
	RoleClassroom Role = "classroom"
)

func (r Role) Valid() bool { return r == RoleAdmin || r == RoleTeacher || r == RoleClassroom }

type User struct {
	ID           ID        `json:"id" gorm:"primaryKey"`
	Username     string    `json:"username" gorm:"size:64;not null;uniqueIndex"`
	DisplayName  string    `json:"display_name" gorm:"size:100;not null"`
	Role         Role      `json:"role" gorm:"size:20;not null"`
	ClassID      *ID       `json:"class_id,omitempty"`
	SubjectID    *ID       `json:"subject_id,omitempty"`
	PasswordHash string    `json:"-" gorm:"size:100;not null"`
	Active       bool      `json:"active" gorm:"not null;default:true"`
	TokenVersion int64     `json:"-" gorm:"not null;default:0"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	Class        *Class    `json:"-" gorm:"foreignKey:ClassID"`
	Subject      *Subject  `json:"subject,omitempty" gorm:"foreignKey:SubjectID"`
	SubjectName  string    `json:"subject_name,omitempty" gorm:"-"`
}

type Class struct {
	ID        ID        `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"size:100;not null;uniqueIndex"`
	Grade     int       `json:"grade" gorm:"not null"`
	Active    bool      `json:"active" gorm:"not null;default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Subject struct {
	ID        ID        `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"size:100;not null;uniqueIndex"`
	Icon      string    `json:"icon" gorm:"size:50;not null"`
	Color     string    `json:"color" gorm:"size:7;not null"`
	Active    bool      `json:"active" gorm:"not null;default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TeachingAssignment struct {
	ID        ID        `json:"id" gorm:"primaryKey"`
	TeacherID ID        `json:"teacher_id" gorm:"not null;uniqueIndex:idx_assignment_unique"`
	ClassID   ID        `json:"class_id" gorm:"not null;uniqueIndex:idx_assignment_unique"`
	SubjectID ID        `json:"subject_id" gorm:"not null;uniqueIndex:idx_assignment_unique"`
	Active    bool      `json:"active" gorm:"not null;default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Teacher   *User     `json:"teacher,omitempty" gorm:"foreignKey:TeacherID"`
	Class     *Class    `json:"class,omitempty" gorm:"foreignKey:ClassID"`
	Subject   *Subject  `json:"subject,omitempty" gorm:"foreignKey:SubjectID"`
}

type ChannelType string

const (
	ChannelNormal    ChannelType = "normal"
	ChannelBroadcast ChannelType = "broadcast"
)

type Channel struct {
	ID             ID          `json:"id" gorm:"primaryKey"`
	Name           string      `json:"name" gorm:"size:150;not null"`
	Type           ChannelType `json:"type" gorm:"size:20;not null"`
	ClassID        *ID         `json:"class_id,omitempty"`
	SubjectID      *ID         `json:"subject_id,omitempty"`
	TeacherID      *ID         `json:"teacher_id,omitempty"`
	BroadcastScope *string     `json:"broadcast_scope,omitempty" gorm:"size:20"`
	Grade          *int        `json:"grade,omitempty"`
	TargetClassID  *ID         `json:"target_class_id,omitempty"`
	Active         bool        `json:"active" gorm:"not null;default:true"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
	Class          *Class      `json:"-" gorm:"foreignKey:ClassID"`
	Subject        *Subject    `json:"-" gorm:"foreignKey:SubjectID"`
	Teacher        *User       `json:"-" gorm:"foreignKey:TeacherID"`
}

type MessageType string

const (
	MessageText   MessageType = "text"
	MessageImage  MessageType = "image"
	MessageFile   MessageType = "file"
	MessageNotice MessageType = "notice"
	MessageUrgent MessageType = "urgent"
)

func (t MessageType) Valid() bool {
	return t == MessageText || t == MessageImage || t == MessageFile || t == MessageNotice || t == MessageUrgent
}

type Message struct {
	ID          ID             `json:"id" gorm:"primaryKey"`
	ChannelID   ID             `json:"channel_id" gorm:"not null"`
	SenderID    ID             `json:"sender_id" gorm:"not null"`
	ClientMsgID *string        `json:"client_msg_id,omitempty" gorm:"type:uuid"`
	Type        MessageType    `json:"type" gorm:"size:20;not null"`
	Content     string         `json:"content" gorm:"type:text;not null"`
	Metadata    datatypes.JSON `json:"metadata" gorm:"type:jsonb;not null"`
	ReplyToID   *ID            `json:"reply_to_id,omitempty"`
	IsPinned    bool           `json:"is_pinned" gorm:"not null;default:false"`
	CreatedAt   time.Time      `json:"created_at"`
	EditedAt    *time.Time     `json:"edited_at,omitempty"`
	DeletedAt   *time.Time     `json:"deleted_at,omitempty"`
	Sender      *User          `json:"-" gorm:"foreignKey:SenderID"`
}

type MessageRead struct {
	MessageID ID        `json:"message_id" gorm:"primaryKey;autoIncrement:false"`
	UserID    ID        `json:"user_id" gorm:"primaryKey;autoIncrement:false"`
	ReadAt    time.Time `json:"read_at" gorm:"not null"`
}

type MessageConfirmation struct {
	MessageID   ID        `json:"message_id" gorm:"primaryKey;autoIncrement:false"`
	UserID      ID        `json:"user_id" gorm:"primaryKey;autoIncrement:false"`
	ConfirmedAt time.Time `json:"confirmed_at" gorm:"not null"`
}

type MessageDelivery struct {
	MessageID   ID        `json:"message_id" gorm:"primaryKey;autoIncrement:false"`
	UserID      ID        `json:"user_id" gorm:"primaryKey;autoIncrement:false"`
	DeliveredAt time.Time `json:"delivered_at" gorm:"not null"`
}

type RealtimeOutbox struct {
	ID              ID             `json:"id" gorm:"primaryKey"`
	EventID         string         `json:"event_id" gorm:"type:uuid;not null;uniqueIndex"`
	EventType       string         `json:"event_type" gorm:"size:64;not null"`
	ChannelID       *ID            `json:"channel_id,omitempty"`
	Payload         datatypes.JSON `json:"payload" gorm:"type:jsonb;not null"`
	OccurredAt      time.Time      `json:"occurred_at" gorm:"not null"`
	CreatedAt       time.Time      `json:"created_at"`
	PublishedAt     *time.Time     `json:"published_at,omitempty"`
	Attempts        int            `json:"attempts" gorm:"not null;default:0"`
	AvailableAt     time.Time      `json:"available_at" gorm:"not null"`
	LockedAt        *time.Time     `json:"locked_at,omitempty"`
	LockedBy        *string        `json:"locked_by,omitempty" gorm:"size:100"`
	RecipientUserID *ID            `json:"recipient_user_id,omitempty"`
}

func (RealtimeOutbox) TableName() string { return "realtime_outbox" }

type ChannelRead struct {
	ChannelID         ID        `json:"channel_id" gorm:"primaryKey;autoIncrement:false"`
	UserID            ID        `json:"user_id" gorm:"primaryKey;autoIncrement:false"`
	LastReadMessageID *ID       `json:"last_read_message_id,omitempty"`
	UpdatedAt         time.Time `json:"updated_at" gorm:"not null"`
}

type Announcement struct {
	ID            ID          `json:"id" gorm:"primaryKey"`
	Title         string      `json:"title" gorm:"size:200;not null"`
	Content       string      `json:"content" gorm:"type:text;not null"`
	Type          MessageType `json:"type" gorm:"size:20;not null"`
	Scope         string      `json:"scope" gorm:"size:20;not null"`
	Grade         *int        `json:"grade,omitempty"`
	TargetClassID *ID         `json:"target_class_id,omitempty"`
	PublisherID   ID          `json:"publisher_id" gorm:"not null"`
	SeedKey       *string     `json:"-" gorm:"size:100;uniqueIndex"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
	DeletedAt     *time.Time  `json:"deleted_at,omitempty"`
	Publisher     *User       `json:"-" gorm:"foreignKey:PublisherID"`
}

type AnnouncementConfirmation struct {
	AnnouncementID ID        `json:"announcement_id" gorm:"primaryKey;autoIncrement:false"`
	UserID         ID        `json:"user_id" gorm:"primaryKey;autoIncrement:false"`
	ConfirmedAt    time.Time `json:"confirmed_at" gorm:"not null"`
}

type RefreshToken struct {
	ID        string     `json:"id" gorm:"type:uuid;primaryKey"`
	UserID    ID         `json:"user_id" gorm:"not null"`
	FamilyID  string     `json:"family_id" gorm:"type:uuid;not null;index"`
	TokenHash string     `json:"-" gorm:"size:64;not null;uniqueIndex"`
	ExpiresAt time.Time  `json:"expires_at" gorm:"not null"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type DeviceBinding struct {
	ID              ID         `json:"id" gorm:"primaryKey"`
	ClassroomUserID ID         `json:"classroom_user_id" gorm:"not null;uniqueIndex"`
	CodeHash        string     `json:"-" gorm:"size:64;not null;uniqueIndex"`
	ExpiresAt       time.Time  `json:"expires_at" gorm:"not null"`
	UsedAt          *time.Time `json:"used_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type FileObject struct {
	ID           ID        `json:"id" gorm:"primaryKey"`
	OwnerID      ID        `json:"owner_id" gorm:"not null"`
	ChannelID    ID        `json:"channel_id" gorm:"not null"`
	MessageID    *ID       `json:"message_id,omitempty"`
	OriginalName string    `json:"original_name" gorm:"size:255;not null"`
	StoredName   string    `json:"-" gorm:"size:255;not null;uniqueIndex"`
	MIME         string    `json:"mime" gorm:"size:150;not null"`
	Size         int64     `json:"size" gorm:"not null"`
	Kind         string    `json:"kind" gorm:"size:10;not null"`
	CreatedAt    time.Time `json:"created_at"`
}

func (FileObject) TableName() string { return "files" }

type AuditLog struct {
	ID           ID             `json:"id" gorm:"primaryKey"`
	ActorID      *ID            `json:"actor_id,omitempty"`
	Action       string         `json:"action" gorm:"size:100;not null"`
	ResourceType string         `json:"resource_type" gorm:"size:100;not null"`
	ResourceID   string         `json:"resource_id" gorm:"size:100;not null"`
	RequestID    string         `json:"request_id" gorm:"size:100;not null"`
	IPAddress    string         `json:"ip_address" gorm:"size:100;not null"`
	Details      datatypes.JSON `json:"details" gorm:"type:jsonb;not null"`
	CreatedAt    time.Time      `json:"created_at"`
}

type SystemSetting struct {
	Key       string         `json:"key" gorm:"size:100;primaryKey"`
	Value     datatypes.JSON `json:"value" gorm:"type:jsonb;not null"`
	UpdatedBy *ID            `json:"updated_by,omitempty"`
	UpdatedAt time.Time      `json:"updated_at"`
}
