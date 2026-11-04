package auth

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"lumina/api/internal/models"
)

var ErrRefreshReused = errors.New("refresh token reused")
var ErrDeviceInvalid = errors.New("device code invalid")

type Repository interface {
	UserByUsername(ctx context.Context, username string) (*models.User, error)
	UserByID(ctx context.Context, id models.ID) (*models.User, error)
	CreateRefresh(ctx context.Context, token *models.RefreshToken) error
	RefreshByHash(ctx context.Context, hash string) (*models.RefreshToken, error)
	RotateRefresh(ctx context.Context, oldToken, newToken *models.RefreshToken) error
	RevokeFamily(ctx context.Context, familyID string) error
	RevokeByHash(ctx context.Context, hash string) error
	RevokeUserSessions(ctx context.Context, userID models.ID) error
	ConsumeDevice(ctx context.Context, codeHash string) (*models.User, error)
	Transaction(ctx context.Context, fn func(Repository) error) error
}

type GORMRepository struct{ db *gorm.DB }

func NewGORMRepository(db *gorm.DB) *GORMRepository { return &GORMRepository{db: db} }

func (r *GORMRepository) UserByUsername(ctx context.Context, username string) (*models.User, error) {
	var user models.User
	if err := r.db.WithContext(ctx).Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *GORMRepository) UserByID(ctx context.Context, id models.ID) (*models.User, error) {
	var user models.User
	if err := r.db.WithContext(ctx).First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *GORMRepository) CreateRefresh(ctx context.Context, token *models.RefreshToken) error {
	return r.db.WithContext(ctx).Create(token).Error
}

func (r *GORMRepository) RefreshByHash(ctx context.Context, hash string) (*models.RefreshToken, error) {
	var token models.RefreshToken
	if err := r.db.WithContext(ctx).Where("token_hash = ?", hash).First(&token).Error; err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *GORMRepository) RotateRefresh(ctx context.Context, oldToken, newToken *models.RefreshToken) error {
	now := time.Now().UTC()
	result := r.db.WithContext(ctx).Model(&models.RefreshToken{}).
		Where("id = ? AND used_at IS NULL AND revoked_at IS NULL", oldToken.ID).
		Updates(map[string]any{"used_at": now})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrRefreshReused
	}
	return r.db.WithContext(ctx).Create(newToken).Error
}

func (r *GORMRepository) RevokeFamily(ctx context.Context, familyID string) error {
	return r.db.WithContext(ctx).Model(&models.RefreshToken{}).
		Where("family_id = ? AND revoked_at IS NULL", familyID).
		Update("revoked_at", time.Now().UTC()).Error
}

func (r *GORMRepository) RevokeByHash(ctx context.Context, hash string) error {
	return r.db.WithContext(ctx).Model(&models.RefreshToken{}).
		Where("token_hash = ? AND revoked_at IS NULL", hash).
		Update("revoked_at", time.Now().UTC()).Error
}

func (r *GORMRepository) RevokeUserSessions(ctx context.Context, userID models.ID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		result := tx.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]any{"token_version": gorm.Expr("token_version + 1"), "updated_at": now})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		return tx.Model(&models.RefreshToken{}).Where("user_id = ? AND revoked_at IS NULL", userID).Update("revoked_at", now).Error
	})
}

func (r *GORMRepository) ConsumeDevice(ctx context.Context, codeHash string) (*models.User, error) {
	var binding models.DeviceBinding
	if err := r.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("code_hash = ?", codeHash).First(&binding).Error; err != nil {
		return nil, ErrDeviceInvalid
	}
	now := time.Now().UTC()
	if binding.UsedAt != nil || !binding.ExpiresAt.After(now) {
		return nil, ErrDeviceInvalid
	}
	result := r.db.WithContext(ctx).Model(&models.DeviceBinding{}).
		Where("id = ? AND used_at IS NULL AND expires_at > ?", binding.ID, now).
		Update("used_at", now)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected != 1 {
		return nil, ErrDeviceInvalid
	}
	user, err := r.UserByID(ctx, binding.ClassroomUserID)
	if err != nil || !user.Active || user.Role != models.RoleClassroom {
		return nil, ErrDeviceInvalid
	}
	return user, nil
}

func (r *GORMRepository) Transaction(ctx context.Context, fn func(Repository) error) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(&GORMRepository{db: tx})
	})
}
