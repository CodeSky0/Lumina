package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"lumina/api/internal/apperror"
	"lumina/api/internal/auth"
	"lumina/api/internal/models"
)

type AdminService struct{ db *gorm.DB }

func NewAdminService(db *gorm.DB) *AdminService { return &AdminService{db: db} }

type ClassInput struct {
	Name              string `json:"name"`
	Grade             int    `json:"grade"`
	ClassroomUsername string `json:"classroom_username"`
	ClassroomPassword string `json:"classroom_password"`
	Active            *bool  `json:"active"`
}

type TeacherInput struct {
	Username    string     `json:"username"`
	DisplayName string     `json:"display_name"`
	Password    string     `json:"password"`
	SubjectID   *models.ID `json:"subject_id"`
	Active      *bool      `json:"active"`
}

type SubjectInput struct {
	Name   string `json:"name"`
	Icon   string `json:"icon"`
	Color  string `json:"color"`
	Active *bool  `json:"active"`
}

type AssignmentInput struct {
	TeacherID models.ID `json:"teacher_id"`
	ClassID   models.ID `json:"class_id"`
	SubjectID models.ID `json:"subject_id"`
	Active    *bool     `json:"active"`
}

type BroadcastChannelInput struct {
	Name          string     `json:"name"`
	Scope         string     `json:"scope"`
	Grade         *int       `json:"grade"`
	TargetClassID *models.ID `json:"target_class_id"`
	Active        *bool      `json:"active"`
}

func validName(value string, max int) bool {
	length := len([]rune(strings.TrimSpace(value)))
	return length > 0 && length <= max
}
func validPassword(value string) bool { return len(value) >= 12 && len(value) <= 72 }
func activeValue(value *bool) bool    { return value == nil || *value }

func (s *AdminService) CreateClass(ctx context.Context, input ClassInput, audit AuditEntry) (*models.Class, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.ClassroomUsername = strings.TrimSpace(input.ClassroomUsername)
	if !validName(input.Name, 100) || input.Grade < 1 || input.Grade > 12 || !validName(input.ClassroomUsername, 64) || !validPassword(input.ClassroomPassword) {
		return nil, apperror.BadRequest("VALIDATION_ERROR", "班级、教室用户名或密码格式不正确")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.ClassroomPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, apperror.Internal(err)
	}
	class := &models.Class{Name: input.Name, Grade: input.Grade, Active: activeValue(input.Active)}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(class).Error; err != nil {
			return writeError(err, "班级名称已存在")
		}
		user := models.User{Username: input.ClassroomUsername, DisplayName: input.Name + "教室", Role: models.RoleClassroom, ClassID: &class.ID, PasswordHash: string(hash), Active: class.Active}
		if err := tx.Create(&user).Error; err != nil {
			return writeError(err, "教室用户名已存在")
		}
		audit.ResourceType = "class"
		audit.ResourceID = class.ID.String()
		audit.Action = "class.create"
		audit.Details = map[string]any{"name": class.Name, "grade": class.Grade, "classroom_username": user.Username}
		return recordAudit(ctx, tx, audit)
	})
	if err != nil {
		return nil, mapAdminError(err)
	}
	return class, nil
}

func (s *AdminService) UpdateClass(ctx context.Context, id models.ID, input ClassInput, audit AuditEntry) (*models.Class, error) {
	if !validName(input.Name, 100) || input.Grade < 1 || input.Grade > 12 {
		return nil, apperror.BadRequest("VALIDATION_ERROR", "班级名称或年级无效")
	}
	var class models.Class
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&class, id).Error; err != nil {
			return err
		}
		wasActive := class.Active
		class.Name = strings.TrimSpace(input.Name)
		class.Grade = input.Grade
		if input.Active != nil {
			class.Active = *input.Active
		}
		if err := tx.Save(&class).Error; err != nil {
			return writeError(err, "班级名称已存在")
		}
		if input.Active != nil && !*input.Active {
			if err := deactivateClassRelations(tx, id); err != nil {
				return err
			}
		}
		if input.Active != nil && *input.Active && !wasActive {
			if err := activateClassroomAccount(tx, id); err != nil {
				return err
			}
		}
		audit.ResourceType = "class"
		audit.ResourceID = id.String()
		audit.Action = "class.update"
		audit.Details = map[string]any{"name": class.Name, "grade": class.Grade, "active": class.Active}
		return recordAudit(ctx, tx, audit)
	})
	if err != nil {
		return nil, mapAdminError(err)
	}
	return &class, nil
}

func (s *AdminService) DeleteClass(ctx context.Context, id models.ID, audit AuditEntry) error {
	return s.softDelete(ctx, "class", id, audit, func(tx *gorm.DB) error {
		if err := tx.Model(&models.Class{}).Where("id = ?", id).Updates(map[string]any{"active": false, "updated_at": time.Now().UTC()}).Error; err != nil {
			return err
		}
		return deactivateClassRelations(tx, id)
	})
}

func deactivateClassRelations(tx *gorm.DB, id models.ID) error {
	now := time.Now().UTC()
	var classroomIDs []models.ID
	if err := tx.Model(&models.User{}).Where("class_id = ? AND role = 'classroom'", id).Pluck("id", &classroomIDs).Error; err != nil {
		return err
	}
	if err := revokeUserSessions(tx, classroomIDs...); err != nil {
		return err
	}
	if err := tx.Model(&models.User{}).Where("class_id = ? AND role = 'classroom'", id).Updates(map[string]any{"active": false, "updated_at": now}).Error; err != nil {
		return err
	}
	if err := tx.Model(&models.TeachingAssignment{}).Where("class_id = ?", id).Updates(map[string]any{"active": false, "updated_at": now}).Error; err != nil {
		return err
	}
	return tx.Model(&models.Channel{}).Where("class_id = ? OR target_class_id = ?", id, id).Updates(map[string]any{"active": false, "updated_at": now}).Error
}

func activateClassroomAccount(tx *gorm.DB, classID models.ID) error {
	var classroom models.User
	err := tx.Where("class_id = ? AND role = 'classroom'", classID).Order("id ASC").First(&classroom).Error
	if err == gorm.ErrRecordNotFound {
		return nil
	}
	if err != nil {
		return err
	}
	return tx.Model(&classroom).Updates(map[string]any{"active": true, "updated_at": time.Now().UTC()}).Error
}

func revokeUserSessions(tx *gorm.DB, userIDs ...models.ID) error {
	if len(userIDs) == 0 {
		return nil
	}
	now := time.Now().UTC()
	if err := tx.Model(&models.User{}).Where("id IN ?", userIDs).Updates(map[string]any{"token_version": gorm.Expr("token_version + 1"), "updated_at": now}).Error; err != nil {
		return err
	}
	return tx.Model(&models.RefreshToken{}).Where("user_id IN ? AND revoked_at IS NULL", userIDs).Update("revoked_at", now).Error
}

func (s *AdminService) CreateTeacher(ctx context.Context, input TeacherInput, audit AuditEntry) (*models.User, error) {
	if !validName(input.Username, 64) || !validName(input.DisplayName, 100) || !validPassword(input.Password) {
		return nil, apperror.BadRequest("VALIDATION_ERROR", "教师用户名、姓名或密码格式不正确")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, apperror.Internal(err)
	}
	teacher := &models.User{Username: strings.TrimSpace(input.Username), DisplayName: strings.TrimSpace(input.DisplayName), Role: models.RoleTeacher, PasswordHash: string(hash), Active: activeValue(input.Active), SubjectID: input.SubjectID}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if teacher.SubjectID != nil {
			subject, err := loadActiveSubject(tx, *teacher.SubjectID)
			if err != nil {
				return err
			}
			teacher.SubjectID = &subject.ID
		}
		if err := tx.Create(teacher).Error; err != nil {
			return writeError(err, "教师用户名已存在")
		}
		audit.ResourceType = "teacher"
		audit.ResourceID = teacher.ID.String()
		audit.Action = "teacher.create"
		audit.Details = map[string]any{"username": teacher.Username, "display_name": teacher.DisplayName, "subject_id": optionalID(teacher.SubjectID)}
		return recordAudit(ctx, tx, audit)
	})
	if err != nil {
		return nil, mapAdminError(err)
	}
	return teacher, nil
}

func (s *AdminService) UpdateTeacher(ctx context.Context, id models.ID, input TeacherInput, audit AuditEntry) (*models.User, error) {
	if !validName(input.DisplayName, 100) {
		return nil, apperror.BadRequest("VALIDATION_ERROR", "教师姓名无效")
	}
	var teacher models.User
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND role = 'teacher'", id).First(&teacher).Error; err != nil {
			return err
		}
		teacher.DisplayName = strings.TrimSpace(input.DisplayName)
		if input.Active != nil {
			teacher.Active = *input.Active
		}
		if input.Password != "" {
			if !validPassword(input.Password) {
				return apperror.BadRequest("VALIDATION_ERROR", "密码至少十二位")
			}
			hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
			if err != nil {
				return err
			}
			teacher.PasswordHash = string(hash)
		}
		if input.SubjectID != nil {
			subjectID := *input.SubjectID
			if subjectID == 0 {
				hasAssignments, err := teacherHasActiveAssignments(tx, id)
				if err != nil {
					return err
				}
				if hasAssignments {
					return apperror.Conflict("TEACHER_SUBJECT_LOCKED", "教师已有教学任务，请先停用或删除任务后再清空科目")
				}
				teacher.SubjectID = nil
			} else {
				subject, err := loadActiveSubject(tx, subjectID)
				if err != nil {
					return err
				}
				if teacher.SubjectID == nil || *teacher.SubjectID != subjectID {
					hasAssignments, err := teacherHasActiveAssignments(tx, id)
					if err != nil {
						return err
					}
					if hasAssignments {
						return apperror.Conflict("TEACHER_SUBJECT_LOCKED", "教师已有教学任务，请先停用或删除任务后再更换科目")
					}
				}
				teacher.SubjectID = &subject.ID
			}
		}
		if err := tx.Save(&teacher).Error; err != nil {
			return err
		}
		if input.Password != "" || (input.Active != nil && !*input.Active) {
			if err := revokeUserSessions(tx, id); err != nil {
				return err
			}
		}
		if input.Active != nil && !*input.Active {
			if err := deactivateTeacherRelations(tx, id); err != nil {
				return err
			}
		}
		audit.ResourceType = "teacher"
		audit.ResourceID = id.String()
		audit.Action = "teacher.update"
		audit.Details = map[string]any{"display_name": teacher.DisplayName, "active": teacher.Active, "subject_id": optionalID(teacher.SubjectID), "password_changed": input.Password != ""}
		return recordAudit(ctx, tx, audit)
	})
	if err != nil {
		return nil, mapAdminError(err)
	}
	return &teacher, nil
}

func (s *AdminService) DeleteTeacher(ctx context.Context, id models.ID, audit AuditEntry) error {
	return s.softDelete(ctx, "teacher", id, audit, func(tx *gorm.DB) error {
		result := tx.Model(&models.User{}).Where("id = ? AND role = 'teacher'", id).Updates(map[string]any{"active": false, "updated_at": time.Now().UTC()})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		if err := revokeUserSessions(tx, id); err != nil {
			return err
		}
		return deactivateTeacherRelations(tx, id)
	})
}

func deactivateTeacherRelations(tx *gorm.DB, id models.ID) error {
	now := time.Now().UTC()
	if err := tx.Model(&models.TeachingAssignment{}).Where("teacher_id = ?", id).Updates(map[string]any{"active": false, "updated_at": now}).Error; err != nil {
		return err
	}
	return tx.Model(&models.Channel{}).Where("teacher_id = ?", id).Updates(map[string]any{"active": false, "updated_at": now}).Error
}

func (s *AdminService) CreateSubject(ctx context.Context, input SubjectInput, audit AuditEntry) (*models.Subject, error) {
	if !validName(input.Name, 100) || !validName(input.Icon, 50) || !validColor(input.Color) {
		return nil, apperror.BadRequest("VALIDATION_ERROR", "科目名称、图标或颜色无效")
	}
	subject := &models.Subject{Name: strings.TrimSpace(input.Name), Icon: strings.TrimSpace(input.Icon), Color: input.Color, Active: activeValue(input.Active)}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(subject).Error; err != nil {
			return writeError(err, "科目名称已存在")
		}
		audit.ResourceType = "subject"
		audit.ResourceID = subject.ID.String()
		audit.Action = "subject.create"
		audit.Details = map[string]any{"name": subject.Name, "color": subject.Color}
		return recordAudit(ctx, tx, audit)
	})
	if err != nil {
		return nil, mapAdminError(err)
	}
	return subject, nil
}

func (s *AdminService) UpdateSubject(ctx context.Context, id models.ID, input SubjectInput, audit AuditEntry) (*models.Subject, error) {
	if !validName(input.Name, 100) || !validName(input.Icon, 50) || !validColor(input.Color) {
		return nil, apperror.BadRequest("VALIDATION_ERROR", "科目名称、图标或颜色无效")
	}
	var subject models.Subject
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&subject, id).Error; err != nil {
			return err
		}
		subject.Name = strings.TrimSpace(input.Name)
		subject.Icon = strings.TrimSpace(input.Icon)
		subject.Color = input.Color
		if input.Active != nil {
			subject.Active = *input.Active
		}
		if err := tx.Save(&subject).Error; err != nil {
			return writeError(err, "科目名称已存在")
		}
		if input.Active != nil && !*input.Active {
			if err := deactivateSubjectRelations(tx, id); err != nil {
				return err
			}
		}
		audit.ResourceType = "subject"
		audit.ResourceID = id.String()
		audit.Action = "subject.update"
		audit.Details = map[string]any{"name": subject.Name, "active": subject.Active}
		return recordAudit(ctx, tx, audit)
	})
	if err != nil {
		return nil, mapAdminError(err)
	}
	return &subject, nil
}

func (s *AdminService) DeleteSubject(ctx context.Context, id models.ID, audit AuditEntry) error {
	return s.softDelete(ctx, "subject", id, audit, func(tx *gorm.DB) error {
		if err := tx.Model(&models.Subject{}).Where("id = ?", id).Updates(map[string]any{"active": false, "updated_at": time.Now().UTC()}).Error; err != nil {
			return err
		}
		return deactivateSubjectRelations(tx, id)
	})
}

func deactivateSubjectRelations(tx *gorm.DB, id models.ID) error {
	now := time.Now().UTC()
	if err := tx.Model(&models.TeachingAssignment{}).Where("subject_id = ?", id).Updates(map[string]any{"active": false, "updated_at": now}).Error; err != nil {
		return err
	}
	if err := tx.Model(&models.Channel{}).Where("subject_id = ?", id).Updates(map[string]any{"active": false, "updated_at": now}).Error; err != nil {
		return err
	}
	return tx.Model(&models.User{}).Where("role = 'teacher' AND subject_id = ?", id).Updates(map[string]any{"subject_id": nil, "updated_at": now}).Error
}

func validColor(value string) bool {
	if len(value) != 7 || value[0] != '#' {
		return false
	}
	for _, char := range value[1:] {
		if !strings.ContainsRune("0123456789abcdefABCDEF", char) {
			return false
		}
	}
	return true
}

func (s *AdminService) CreateAssignment(ctx context.Context, input AssignmentInput, audit AuditEntry) (*models.TeachingAssignment, error) {
	if input.TeacherID == 0 || input.ClassID == 0 {
		return nil, apperror.BadRequest("VALIDATION_ERROR", "教学任务必须指定教师和班级")
	}
	assignment := &models.TeachingAssignment{TeacherID: input.TeacherID, ClassID: input.ClassID, Active: activeValue(input.Active)}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		teacher, class, subject, err := resolveAssignmentRefs(tx, input.TeacherID, input.ClassID, input.SubjectID)
		if err != nil {
			return err
		}
		assignment.SubjectID = subject.ID
		if err := tx.Create(assignment).Error; err != nil {
			return writeError(err, "该教师在本班的教学任务已存在")
		}
		channel := models.Channel{Name: class.Name + " · " + subject.Name + " · " + teacher.DisplayName, Type: models.ChannelNormal, ClassID: &assignment.ClassID, SubjectID: &assignment.SubjectID, TeacherID: &assignment.TeacherID, Active: assignment.Active}
		if err := tx.Create(&channel).Error; err != nil {
			return writeError(err, "对应教学通道已存在")
		}
		audit.ResourceType = "assignment"
		audit.ResourceID = assignment.ID.String()
		audit.Action = "assignment.create"
		audit.Details = map[string]any{"channel_id": channel.ID.String(), "teacher_id": assignment.TeacherID.String(), "class_id": assignment.ClassID.String(), "subject_id": assignment.SubjectID.String()}
		return recordAudit(ctx, tx, audit)
	})
	if err != nil {
		return nil, mapAdminError(err)
	}
	return assignment, nil
}

func (s *AdminService) UpdateAssignment(ctx context.Context, id models.ID, input AssignmentInput, audit AuditEntry) (*models.TeachingAssignment, error) {
	if input.TeacherID == 0 || input.ClassID == 0 {
		return nil, apperror.BadRequest("VALIDATION_ERROR", "教学任务必须指定教师和班级")
	}
	var assignment models.TeachingAssignment
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&assignment, id).Error; err != nil {
			return err
		}
		oldTeacherID, oldClassID, oldSubjectID := assignment.TeacherID, assignment.ClassID, assignment.SubjectID
		teacher, class, subject, err := resolveAssignmentRefs(tx, input.TeacherID, input.ClassID, input.SubjectID)
		if err != nil {
			return err
		}
		var channel models.Channel
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("type = 'normal' AND class_id = ? AND subject_id = ? AND teacher_id = ?", oldClassID, oldSubjectID, oldTeacherID).First(&channel).Error; err != nil {
			return fmt.Errorf("教学通道缺失: %w", err)
		}
		assignment.TeacherID = input.TeacherID
		assignment.ClassID = input.ClassID
		assignment.SubjectID = subject.ID
		if input.Active != nil {
			assignment.Active = *input.Active
		}
		if err := tx.Save(&assignment).Error; err != nil {
			return writeError(err, "该教师在本班的教学任务已存在")
		}
		channel.ClassID = &assignment.ClassID
		channel.SubjectID = &assignment.SubjectID
		channel.TeacherID = &assignment.TeacherID
		channel.Active = assignment.Active
		channel.Name = class.Name + " · " + subject.Name + " · " + teacher.DisplayName
		if err := tx.Save(&channel).Error; err != nil {
			return writeError(err, "对应教学通道已存在")
		}
		audit.ResourceType = "assignment"
		audit.ResourceID = id.String()
		audit.Action = "assignment.update"
		audit.Details = map[string]any{"teacher_id": assignment.TeacherID.String(), "class_id": assignment.ClassID.String(), "subject_id": assignment.SubjectID.String()}
		return recordAudit(ctx, tx, audit)
	})
	if err != nil {
		return nil, mapAdminError(err)
	}
	return &assignment, nil
}

func (s *AdminService) DeleteAssignment(ctx context.Context, id models.ID, audit AuditEntry) error {
	return s.softDelete(ctx, "assignment", id, audit, func(tx *gorm.DB) error {
		var assignment models.TeachingAssignment
		if err := tx.First(&assignment, id).Error; err != nil {
			return err
		}
		if err := tx.Model(&assignment).Updates(map[string]any{"active": false, "updated_at": time.Now().UTC()}).Error; err != nil {
			return err
		}
		return tx.Model(&models.Channel{}).Where("type = 'normal' AND class_id = ? AND subject_id = ? AND teacher_id = ?", assignment.ClassID, assignment.SubjectID, assignment.TeacherID).Updates(map[string]any{"active": false, "updated_at": time.Now().UTC()}).Error
	})
}

func resolveAssignmentRefs(tx *gorm.DB, teacherID, classID, subjectID models.ID) (*models.User, *models.Class, *models.Subject, error) {
	var teacher models.User
	var class models.Class
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND role = 'teacher' AND active = true", teacherID).First(&teacher).Error; err != nil {
		return nil, nil, nil, apperror.BadRequest("ASSIGNMENT_INACTIVE", "教师不存在或已停用")
	}
	if err := tx.Where("id = ? AND active = true", classID).First(&class).Error; err != nil {
		return nil, nil, nil, apperror.BadRequest("ASSIGNMENT_INACTIVE", "班级不存在或已停用")
	}
	if subjectID == 0 {
		if teacher.SubjectID == nil {
			return nil, nil, nil, apperror.BadRequest("TEACHER_SUBJECT_REQUIRED", "请先在教师管理中为教师设置教授科目")
		}
		subjectID = *teacher.SubjectID
	} else if teacher.SubjectID != nil && *teacher.SubjectID != subjectID {
		return nil, nil, nil, apperror.Conflict("TEACHER_SUBJECT_LOCKED", "每位教师只教授一个科目，请为教师更换科目或选择相同科目的任务")
	}
	var conflicting int64
	if err := tx.Model(&models.TeachingAssignment{}).Where("teacher_id = ? AND active = true AND subject_id <> ?", teacherID, subjectID).Count(&conflicting).Error; err != nil {
		return nil, nil, nil, err
	}
	if conflicting > 0 {
		return nil, nil, nil, apperror.Conflict("TEACHER_SUBJECT_LOCKED", "该教师已有其他科目的教学任务，需先停用后再分配")
	}
	subject, err := loadActiveSubject(tx, subjectID)
	if err != nil {
		return nil, nil, nil, err
	}
	if teacher.SubjectID == nil {
		teacher.SubjectID = &subject.ID
		if err := tx.Model(&teacher).Updates(map[string]any{"subject_id": subject.ID, "updated_at": time.Now().UTC()}).Error; err != nil {
			return nil, nil, nil, err
		}
	}
	return &teacher, &class, subject, nil
}

func loadActiveSubject(tx *gorm.DB, subjectID models.ID) (*models.Subject, error) {
	if subjectID == 0 {
		return nil, apperror.BadRequest("SUBJECT_REQUIRED", "科目不能为空")
	}
	var subject models.Subject
	if err := tx.Where("id = ? AND active = true", subjectID).First(&subject).Error; err != nil {
		return nil, apperror.BadRequest("SUBJECT_INACTIVE", "科目不存在或已停用")
	}
	return &subject, nil
}

func teacherHasActiveAssignments(tx *gorm.DB, teacherID models.ID) (bool, error) {
	var count int64
	if err := tx.Model(&models.TeachingAssignment{}).Where("teacher_id = ? AND active = true", teacherID).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func optionalID(id *models.ID) any {
	if id == nil {
		return nil
	}
	return id.String()
}

func (s *AdminService) CreateBroadcastChannel(ctx context.Context, input BroadcastChannelInput, audit AuditEntry) (*models.Channel, error) {
	if err := validateBroadcast(input); err != nil {
		return nil, err
	}
	channel := &models.Channel{Name: strings.TrimSpace(input.Name), Type: models.ChannelBroadcast, BroadcastScope: &input.Scope, Grade: input.Grade, TargetClassID: input.TargetClassID, Active: activeValue(input.Active)}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(channel).Error; err != nil {
			return writeError(err, "相同范围的广播通道已存在")
		}
		audit.ResourceType = "channel"
		audit.ResourceID = channel.ID.String()
		audit.Action = "channel.create"
		audit.Details = map[string]any{"name": channel.Name, "scope": input.Scope}
		return recordAudit(ctx, tx, audit)
	})
	if err != nil {
		return nil, mapAdminError(err)
	}
	return channel, nil
}

func (s *AdminService) UpdateBroadcastChannel(ctx context.Context, id models.ID, input BroadcastChannelInput, audit AuditEntry) (*models.Channel, error) {
	if err := validateBroadcast(input); err != nil {
		return nil, err
	}
	var channel models.Channel
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ? AND type = 'broadcast'", id).First(&channel).Error; err != nil {
			return err
		}
		channel.Name = strings.TrimSpace(input.Name)
		channel.BroadcastScope = &input.Scope
		channel.Grade = input.Grade
		channel.TargetClassID = input.TargetClassID
		if input.Active != nil {
			channel.Active = *input.Active
		}
		if err := tx.Save(&channel).Error; err != nil {
			return writeError(err, "相同范围的广播通道已存在")
		}
		audit.ResourceType = "channel"
		audit.ResourceID = id.String()
		audit.Action = "channel.update"
		audit.Details = map[string]any{"name": channel.Name, "scope": input.Scope, "active": channel.Active}
		return recordAudit(ctx, tx, audit)
	})
	if err != nil {
		return nil, mapAdminError(err)
	}
	return &channel, nil
}

func (s *AdminService) DeleteChannel(ctx context.Context, id models.ID, audit AuditEntry) error {
	return s.softDelete(ctx, "channel", id, audit, func(tx *gorm.DB) error {
		result := tx.Model(&models.Channel{}).Where("id = ?", id).Update("active", false)
		if result.Error == nil && result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return result.Error
	})
}

func validateBroadcast(input BroadcastChannelInput) error {
	if !validName(input.Name, 150) {
		return apperror.BadRequest("VALIDATION_ERROR", "通道名称无效")
	}
	valid := (input.Scope == "school" && input.Grade == nil && input.TargetClassID == nil) || (input.Scope == "grade" && input.Grade != nil && *input.Grade >= 1 && *input.Grade <= 12 && input.TargetClassID == nil) || (input.Scope == "class" && input.Grade == nil && input.TargetClassID != nil)
	if !valid {
		return apperror.BadRequest("VALIDATION_ERROR", "广播范围与目标不匹配")
	}
	return nil
}

type ClassDTO struct {
	models.Class
	ClassroomUserID   *models.ID `json:"classroom_user_id,omitempty"`
	ClassroomUsername string     `json:"classroom_username,omitempty"`
}

func (s *AdminService) ListClasses(ctx context.Context, page, size int) ([]ClassDTO, int64, error) {
	page, size = normalizePage(page, size)
	var total int64
	if err := s.db.WithContext(ctx).Model(&models.Class{}).Count(&total).Error; err != nil {
		return nil, 0, apperror.Internal(err)
	}
	var classes []models.Class
	if err := s.db.WithContext(ctx).Model(&models.Class{}).Order("name").Offset((page - 1) * size).Limit(size).Find(&classes).Error; err != nil {
		return nil, 0, apperror.Internal(err)
	}
	result := make([]ClassDTO, len(classes))
	for i := range classes {
		result[i].Class = classes[i]
	}
	if len(classes) == 0 {
		return result, total, nil
	}
	classIDs := make([]models.ID, len(classes))
	for i := range classes {
		classIDs[i] = classes[i].ID
	}
	var classrooms []models.User
	if err := s.db.WithContext(ctx).Where("role = 'classroom' AND class_id IN ?", classIDs).Order("id ASC").Find(&classrooms).Error; err != nil {
		return nil, 0, apperror.Internal(err)
	}
	byClass := make(map[models.ID]models.User, len(classrooms))
	for _, classroom := range classrooms {
		if classroom.ClassID == nil {
			continue
		}
		if _, exists := byClass[*classroom.ClassID]; !exists {
			byClass[*classroom.ClassID] = classroom
		}
	}
	for i := range result {
		if classroom, ok := byClass[result[i].ID]; ok {
			id := classroom.ID
			result[i].ClassroomUserID = &id
			result[i].ClassroomUsername = classroom.Username
		}
	}
	return result, total, nil
}
func (s *AdminService) ListTeachers(ctx context.Context, page, size int) ([]models.User, int64, error) {
	var items []models.User
	total, err := listPaged(s.db.WithContext(ctx).Preload("Subject").Where("role = 'teacher'"), &items, page, size, "display_name", "")
	if err != nil {
		return nil, 0, err
	}
	for i := range items {
		if items[i].Subject != nil {
			items[i].SubjectName = items[i].Subject.Name
		}
	}
	return items, total, nil
}
func (s *AdminService) ListSubjects(ctx context.Context, page, size int) ([]models.Subject, int64, error) {
	var items []models.Subject
	total, err := listPaged(s.db.WithContext(ctx), &items, page, size, "name", "")
	return items, total, err
}
func (s *AdminService) ListAssignments(ctx context.Context, page, size int) ([]models.TeachingAssignment, int64, error) {
	var items []models.TeachingAssignment
	total, err := listPaged(s.db.WithContext(ctx).Preload("Teacher").Preload("Class").Preload("Subject"), &items, page, size, "id DESC", "")
	return items, total, err
}
func (s *AdminService) ListChannels(ctx context.Context, page, size int) ([]models.Channel, int64, error) {
	var items []models.Channel
	total, err := listPaged(s.db.WithContext(ctx).Preload("Class").Preload("Subject").Preload("Teacher"), &items, page, size, "id DESC", "")
	return items, total, err
}

func listPaged(db *gorm.DB, dest any, page, size int, order, _ string) (int64, error) {
	page, size = normalizePage(page, size)
	var total int64
	if err := db.Model(dest).Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return 0, apperror.Internal(err)
	}
	if err := db.Model(dest).Order(order).Offset((page - 1) * size).Limit(size).Find(dest).Error; err != nil {
		return 0, apperror.Internal(err)
	}
	return total, nil
}

func (s *AdminService) Dashboard(ctx context.Context) (map[string]int64, error) {
	result := map[string]int64{}
	queries := map[string]struct{ table, where string }{"classes": {"classes", "active = true"}, "teachers": {"users", "role = 'teacher' AND active = true"}, "classrooms": {"users", "role = 'classroom' AND active = true"}, "subjects": {"subjects", "active = true"}, "assignments": {"teaching_assignments", "active = true"}, "channels": {"channels", "active = true"}, "messages": {"messages", "deleted_at IS NULL"}, "announcements": {"announcements", "deleted_at IS NULL"}}
	for key, query := range queries {
		var count int64
		if err := s.db.WithContext(ctx).Table(query.table).Where(query.where).Count(&count).Error; err != nil {
			return nil, apperror.Internal(err)
		}
		result[key] = count
	}
	return result, nil
}

var allowedSettings = map[string]bool{"message_retention_days": true, "announcement_default_type": true, "maintenance_mode": true, "uploads_enabled": true}

func (s *AdminService) Settings(ctx context.Context) ([]models.SystemSetting, error) {
	var settings []models.SystemSetting
	if err := s.db.WithContext(ctx).Order("key").Find(&settings).Error; err != nil {
		return nil, apperror.Internal(err)
	}
	return settings, nil
}
func (s *AdminService) UpdateSettings(ctx context.Context, values map[string]json.RawMessage, actor models.ID, audit AuditEntry) ([]models.SystemSetting, error) {
	if len(values) == 0 {
		return nil, apperror.BadRequest("VALIDATION_ERROR", "设置不能为空")
	}
	for key, raw := range values {
		if !allowedSettings[key] {
			return nil, apperror.BadRequest("VALIDATION_ERROR", "包含不支持的设置项")
		}
		var value any
		if err := json.Unmarshal(raw, &value); err != nil {
			return nil, apperror.BadRequest("VALIDATION_ERROR", "设置值不是有效 JSON")
		}
		if key == "message_retention_days" {
			number, ok := value.(float64)
			if !ok || number < 1 || number > 3650 || number != float64(int(number)) {
				return nil, apperror.BadRequest("VALIDATION_ERROR", "消息保留天数无效")
			}
		}
		if key == "announcement_default_type" && value != "notice" && value != "urgent" {
			return nil, apperror.BadRequest("VALIDATION_ERROR", "默认公告类型无效")
		}
		if key == "maintenance_mode" || key == "uploads_enabled" {
			if _, ok := value.(bool); !ok {
				return nil, apperror.BadRequest("VALIDATION_ERROR", "开关设置必须为布尔值")
			}
		}
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		for key, raw := range values {
			setting := models.SystemSetting{Key: key, Value: datatypes.JSON(raw), UpdatedBy: &actor, UpdatedAt: now}
			if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "key"}}, DoUpdates: clause.AssignmentColumns([]string{"value", "updated_by", "updated_at"})}).Create(&setting).Error; err != nil {
				return err
			}
		}
		audit.ResourceType = "settings"
		audit.ResourceID = "system"
		audit.Action = "settings.update"
		audit.Details = values
		return recordAudit(ctx, tx, audit)
	})
	if err != nil {
		return nil, apperror.Internal(err)
	}
	return s.Settings(ctx)
}

func (s *AdminService) RotateDeviceCode(ctx context.Context, classID models.ID, audit AuditEntry) (string, error) {
	var user models.User
	if err := s.db.WithContext(ctx).Where("class_id = ? AND role = 'classroom' AND active = true", classID).First(&user).Error; err != nil {
		return "", apperror.NotFound("CLASSROOM_NOT_FOUND", "教室用户不存在")
	}
	raw, err := randomDeviceCode()
	if err != nil {
		return "", apperror.Internal(err)
	}
	now := time.Now().UTC()
	binding := models.DeviceBinding{ClassroomUserID: user.ID, CodeHash: auth.HashDeviceCode(raw), ExpiresAt: now.Add(365 * 24 * time.Hour), CreatedAt: now, UpdatedAt: now}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "classroom_user_id"}}, DoUpdates: clause.AssignmentColumns([]string{"code_hash", "expires_at", "used_at", "updated_at"})}).Create(&binding).Error; err != nil {
			return err
		}
		audit.ResourceType = "class"
		audit.ResourceID = classID.String()
		audit.Action = "device.rotate"
		audit.Details = map[string]any{"classroom_user_id": user.ID.String()}
		return recordAudit(ctx, tx, audit)
	})
	if err != nil {
		return "", apperror.Internal(err)
	}
	return raw, nil
}

func randomDeviceCode() (string, error) {
	raw := make([]byte, 32)
	if _, err := randRead(raw); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", raw), nil
}

var randRead = func(buffer []byte) (int, error) { return cryptoRandRead(buffer) }

func (s *AdminService) softDelete(ctx context.Context, resource string, id models.ID, audit AuditEntry, mutate func(*gorm.DB) error) error {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := mutate(tx); err != nil {
			return err
		}
		audit.ResourceType = resource
		audit.ResourceID = id.String()
		audit.Action = resource + ".delete"
		audit.Details = map[string]any{"soft_delete": true}
		return recordAudit(ctx, tx, audit)
	})
	return mapAdminError(err)
}

func writeError(err error, conflictMessage string) error {
	if err != nil && (strings.Contains(strings.ToLower(err.Error()), "duplicate") || strings.Contains(strings.ToLower(err.Error()), "unique")) {
		return apperror.Conflict("RESOURCE_EXISTS", conflictMessage)
	}
	return err
}
func mapAdminError(err error) error {
	if err == nil {
		return nil
	}
	var appErr *apperror.Error
	if errorsAs(err, &appErr) {
		return err
	}
	if err == gorm.ErrRecordNotFound {
		return apperror.NotFound("RESOURCE_NOT_FOUND", "资源不存在")
	}
	return apperror.Internal(err)
}
