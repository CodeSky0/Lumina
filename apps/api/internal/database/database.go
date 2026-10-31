package database

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"lumina/api/internal/config"
)

func Open(cfg config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Warn),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		return nil, fmt.Errorf("连接 PostgreSQL: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("获取数据库连接池: %w", err)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("PostgreSQL 就绪检查: %w", err)
	}
	return db, nil
}

const migrationAdvisoryLockID int64 = 0x4c554d494e414d47

// Migrate 按文件名顺序执行尚未应用的 SQL 迁移，每次迁移均在事务中完成。
func Migrate(ctx context.Context, db *gorm.DB, directory string) (returnErr error) {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	lockConn, err := sqlDB.Conn(ctx)
	if err != nil {
		return fmt.Errorf("获取迁移锁连接: %w", err)
	}
	if _, err := lockConn.ExecContext(ctx, "SELECT pg_advisory_lock($1)", migrationAdvisoryLockID); err != nil {
		_ = lockConn.Close()
		return fmt.Errorf("获取 PostgreSQL 迁移锁: %w", err)
	}
	defer func() {
		unlockCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := lockConn.ExecContext(unlockCtx, "SELECT pg_advisory_unlock($1)", migrationAdvisoryLockID); err != nil && returnErr == nil {
			returnErr = fmt.Errorf("释放 PostgreSQL 迁移锁: %w", err)
		}
		if err := lockConn.Close(); err != nil && returnErr == nil {
			returnErr = fmt.Errorf("关闭迁移锁连接: %w", err)
		}
	}()
	if err := db.WithContext(ctx).Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version BIGINT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).Error; err != nil {
		return err
	}
	entries, err := os.ReadDir(directory)
	if err != nil {
		return fmt.Errorf("读取迁移目录: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".up.sql") {
			names = append(names, entry.Name())
		}
	}
	sort.Strings(names)
	for _, name := range names {
		version, err := strconv.ParseInt(strings.SplitN(name, "_", 2)[0], 10, 64)
		if err != nil {
			return fmt.Errorf("迁移文件名无效 %s: %w", name, err)
		}
		var count int64
		if err := db.WithContext(ctx).Table("schema_migrations").Where("version = ?", version).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			continue
		}
		content, err := os.ReadFile(filepath.Join(directory, name))
		if err != nil {
			return err
		}
		if err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			if err := tx.Exec(string(content)).Error; err != nil {
				return fmt.Errorf("执行迁移 %s: %w", name, err)
			}
			return tx.Exec("INSERT INTO schema_migrations(version) VALUES (?)", version).Error
		}); err != nil {
			return err
		}
	}
	return nil
}
