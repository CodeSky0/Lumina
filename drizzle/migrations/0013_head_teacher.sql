-- 0013: teacher_classes.is_head_teacher — 班主任标记 + 部分唯一索引

ALTER TABLE "teacher_classes" ADD COLUMN IF NOT EXISTS "is_head_teacher" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_classes_head_unique" ON "teacher_classes" ("class_id") WHERE "is_head_teacher" = true;
