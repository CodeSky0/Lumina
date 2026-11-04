package seed

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"lumina/api/internal/auth"
	"lumina/api/internal/models"
)

type Options struct {
	Environment       string
	AdminPassword     string
	TeacherPassword   string
	ClassroomPassword string
	DeviceSecret      string
}

type Stats struct {
	Admins        int64
	Classes       int64
	Classrooms    int64
	Teachers      int64
	Subjects      int64
	Assignments   int64
	Channels      int64
	Announcements int64
}

func OptionsFromEnv() Options {
	return Options{Environment: os.Getenv("APP_ENV"), AdminPassword: os.Getenv("SEED_ADMIN_PASSWORD"), TeacherPassword: os.Getenv("SEED_TEACHER_PASSWORD"), ClassroomPassword: os.Getenv("SEED_CLASSROOM_PASSWORD"), DeviceSecret: os.Getenv("SEED_DEVICE_SECRET")}
}

func Run(ctx context.Context, db *gorm.DB, options Options) (Stats, error) {
	if options.Environment != "production" {
		if options.AdminPassword == "" {
			options.AdminPassword = "Admin@2026Lumina"
		}
		if options.TeacherPassword == "" {
			options.TeacherPassword = "Teacher@2026Lumina"
		}
		if options.ClassroomPassword == "" {
			options.ClassroomPassword = "Classroom@2026Lumina"
		}
		if options.DeviceSecret == "" {
			options.DeviceSecret = "lumina-local-development-device-secret-2026"
		}
	}
	if len(options.AdminPassword) < 12 || len(options.TeacherPassword) < 12 || len(options.ClassroomPassword) < 12 || len(options.DeviceSecret) < 32 {
		return Stats{}, fmt.Errorf("种子密码至少十二位，设备密钥至少三十二位；生产环境必须显式提供")
	}
	adminHash, err := bcrypt.GenerateFromPassword([]byte(options.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return Stats{}, err
	}
	teacherHash, err := bcrypt.GenerateFromPassword([]byte(options.TeacherPassword), bcrypt.DefaultCost)
	if err != nil {
		return Stats{}, err
	}
	classroomHash, err := bcrypt.GenerateFromPassword([]byte(options.ClassroomPassword), bcrypt.DefaultCost)
	if err != nil {
		return Stats{}, err
	}
	err = db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := upsertUser(tx, "admin", "系统管理员", models.RoleAdmin, nil, string(adminHash)); err != nil {
			return err
		}
		classIDs := make([]models.ID, 20)
		classNames := make([]string, 20)
		classroomIDs := make([]models.ID, 20)
		for i := 0; i < 20; i++ {
			grade := i%3 + 1
			name := fmt.Sprintf("%s（%02d）班", []string{"高一", "高二", "高三"}[grade-1], i/3+1)
			classNames[i] = name
			if err := tx.Raw(`INSERT INTO classes(name,grade,active) VALUES (?, ?, true) ON CONFLICT(name) DO UPDATE SET grade=EXCLUDED.grade,active=true,updated_at=NOW() RETURNING id`, name, grade).Scan(&classIDs[i]).Error; err != nil {
				return err
			}
			username := fmt.Sprintf("class%02d", i+1)
			userID, err := upsertUser(tx, username, name+"教室", models.RoleClassroom, &classIDs[i], string(classroomHash))
			if err != nil {
				return err
			}
			classroomIDs[i] = userID
			code := deviceCode(options.DeviceSecret, username)
			if err := tx.Exec(`INSERT INTO device_bindings(classroom_user_id,code_hash,expires_at) VALUES (?,?,?) ON CONFLICT(classroom_user_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,used_at=NULL,updated_at=NOW()`, userID, auth.HashDeviceCode(code), time.Now().Add(365*24*time.Hour)).Error; err != nil {
				return err
			}
		}
		teacherIDs := make([]models.ID, 50)
		for i := 0; i < 50; i++ {
			username := fmt.Sprintf("teacher%03d", i+1)
			id, err := upsertUser(tx, username, fmt.Sprintf("教师%03d", i+1), models.RoleTeacher, nil, string(teacherHash))
			if err != nil {
				return err
			}
			teacherIDs[i] = id
		}
		subjects := []struct{ name, icon, color string }{{"语文", "book-open", "#6366f1"}, {"数学", "sigma", "#8b5cf6"}, {"英语", "languages", "#06b6d4"}, {"物理", "atom", "#0ea5e9"}, {"化学", "flask-conical", "#10b981"}, {"生物", "leaf", "#22c55e"}, {"历史", "landmark", "#f59e0b"}, {"地理", "globe", "#14b8a6"}, {"政治", "scale", "#ef4444"}, {"信息技术", "cpu", "#64748b"}}
		subjectIDs := make([]models.ID, len(subjects))
		for i, subject := range subjects {
			if err := tx.Raw(`INSERT INTO subjects(name,icon,color,active) VALUES (?,?,?,true) ON CONFLICT(name) DO UPDATE SET icon=EXCLUDED.icon,color=EXCLUDED.color,active=true,updated_at=NOW() RETURNING id`, subject.name, subject.icon, subject.color).Scan(&subjectIDs[i]).Error; err != nil {
				return err
			}
		}
		for i := 0; i < 300; i++ {
			teacherIndex, classIndex, subjectIndex := assignmentIndexes(i)
			teacherID := teacherIDs[teacherIndex]
			classID := classIDs[classIndex]
			subjectID := subjectIDs[subjectIndex]
			var assignmentID models.ID
			if err := tx.Raw(`INSERT INTO teaching_assignments(teacher_id,class_id,subject_id,active) VALUES (?,?,?,true) ON CONFLICT(teacher_id,class_id,subject_id) DO UPDATE SET active=true,updated_at=NOW() RETURNING id`, teacherID, classID, subjectID).Scan(&assignmentID).Error; err != nil {
				return err
			}
			channelName := fmt.Sprintf("%s · %s · 教师%03d", classNames[classIndex], subjects[subjectIndex].name, teacherIndex+1)
			if err := tx.Exec(`INSERT INTO channels(name,type,class_id,subject_id,teacher_id,active) VALUES (?,'normal',?,?,?,true) ON CONFLICT(class_id,subject_id,teacher_id) WHERE type='normal' DO UPDATE SET name=EXCLUDED.name,active=true,updated_at=NOW()`, channelName, classID, subjectID, teacherID).Error; err != nil {
				return err
			}
		}
		if err := tx.Exec(`INSERT INTO channels(name,type,broadcast_scope,active) VALUES ('全校广播','broadcast','school',true) ON CONFLICT(broadcast_scope) WHERE type='broadcast' AND broadcast_scope='school' DO UPDATE SET name=EXCLUDED.name,active=true,updated_at=NOW()`).Error; err != nil {
			return err
		}
		var admin models.User
		if err := tx.Where("username = 'admin'").First(&admin).Error; err != nil {
			return err
		}
		announcements := []struct {
			key, title, content string
			kind                models.MessageType
		}{{"seed-welcome", "Lumina 校园通讯平台启用", "请各班级与教师通过教学通道开展校内沟通。", models.MessageNotice}, {"seed-drill", "校园应急演练通知", "请留意后续演练安排；收到紧急通知后请及时确认。", models.MessageUrgent}}
		for _, item := range announcements {
			if err := tx.Exec(`INSERT INTO announcements(title,content,type,scope,publisher_id,seed_key) VALUES (?,?,?,'school',?,?) ON CONFLICT(seed_key) DO UPDATE SET title=EXCLUDED.title,content=EXCLUDED.content,type=EXCLUDED.type,scope=EXCLUDED.scope,deleted_at=NULL,updated_at=NOW()`, item.title, item.content, item.kind, admin.ID, item.key).Error; err != nil {
				return err
			}
		}
		settings := []string{`("message_retention_days",'365'::jsonb)`, `("announcement_default_type",'"notice"'::jsonb)`, `("maintenance_mode",'false'::jsonb)`, `("uploads_enabled",'true'::jsonb)`}
		_ = settings
		defaults := map[string]string{"message_retention_days": "365", "announcement_default_type": `"notice"`, "maintenance_mode": "false", "uploads_enabled": "true"}
		for key, value := range defaults {
			if err := tx.Exec(`INSERT INTO system_settings(key,value) VALUES (?,?::jsonb) ON CONFLICT(key) DO NOTHING`, key, value).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return Stats{}, err
	}
	return counts(ctx, db)
}

func assignmentIndexes(i int) (teacherIndex, classIndex, subjectIndex int) {
	teacherIndex = i % 50
	classIndex = (teacherIndex*6 + i/50) % 20
	subjectIndex = i % 10
	return teacherIndex, classIndex, subjectIndex
}

func upsertUser(tx *gorm.DB, username, displayName string, role models.Role, classID *models.ID, passwordHash string) (models.ID, error) {
	var id models.ID
	err := tx.Raw(`INSERT INTO users(username,display_name,role,class_id,password_hash,active) VALUES (?,?,?,?,?,true) ON CONFLICT(username) DO UPDATE SET display_name=EXCLUDED.display_name,role=EXCLUDED.role,class_id=EXCLUDED.class_id,active=true,updated_at=NOW() RETURNING id`, username, displayName, role, classID, passwordHash).Scan(&id).Error
	return id, err
}

func deviceCode(secret, username string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(strings.TrimSpace(username)))
	return fmt.Sprintf("%x", mac.Sum(nil))
}

func counts(ctx context.Context, db *gorm.DB) (Stats, error) {
	var stats Stats
	queries := []struct {
		table, where string
		target       *int64
	}{{"users", "role='admin'", &stats.Admins}, {"classes", "", &stats.Classes}, {"users", "role='classroom'", &stats.Classrooms}, {"users", "role='teacher'", &stats.Teachers}, {"subjects", "", &stats.Subjects}, {"teaching_assignments", "", &stats.Assignments}, {"channels", "type='normal'", &stats.Channels}, {"announcements", "deleted_at IS NULL", &stats.Announcements}}
	for _, query := range queries {
		dbQuery := db.WithContext(ctx).Table(query.table)
		if query.where != "" {
			dbQuery = dbQuery.Where(query.where)
		}
		if err := dbQuery.Count(query.target).Error; err != nil {
			return Stats{}, err
		}
	}
	return stats, nil
}
