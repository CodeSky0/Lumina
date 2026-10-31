package main

import (
	"context"
	"flag"
	"log"
	"time"

	"lumina/api/internal/config"
	"lumina/api/internal/database"
)

func main() {
	directory := flag.String("dir", "migrations", "SQL 迁移目录")
	flag.Parse()
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("配置错误: %v", err)
	}
	db, err := database.Open(cfg)
	if err != nil {
		log.Fatalf("数据库错误: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	if err := database.Migrate(ctx, db, *directory); err != nil {
		log.Fatalf("迁移失败: %v", err)
	}
	log.Print("数据库迁移完成")
}
