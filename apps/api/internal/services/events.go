package services

import (
	"gorm.io/gorm"

	"lumina/api/internal/realtime"
)

// EventRecorder 将持久业务事件写入调用方当前事务，提交后由 relay 异步发布。
type EventRecorder interface {
	Record(tx *gorm.DB, event realtime.Event) error
}
