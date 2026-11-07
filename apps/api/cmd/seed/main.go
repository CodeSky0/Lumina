package main

import (
	"context"
	"flag"
	"log"
	"time"

	"lumina/api/internal/config"
	"lumina/api/internal/database"
	"lumina/api/internal/seed"
)

func main() {
	flag.Parse()
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("配置错误: %v", err)
	}
	db, err := database.Open(cfg)
	if err != nil {
		log.Fatalf("数据库错误: %v", err)
	}
	options := seed.OptionsFromEnv()
	options.Environment = cfg.Environment
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	stats, err := seed.Run(ctx, db, options)
	if err != nil {
		log.Fatalf("种子执行失败: %v", err)
	}
	log.Printf("种子完成: 管理员=%d 班级=%d 教室用户=%d 教师=%d 科目=%d 教学任务=%d 教学通道=%d 公告=%d", stats.Admins, stats.Classes, stats.Classrooms, stats.Teachers, stats.Subjects, stats.Assignments, stats.Channels, stats.Announcements)
}
