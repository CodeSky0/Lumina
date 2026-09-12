-- messages: 添加撤回与编辑支持字段
ALTER TABLE "messages" ADD COLUMN "deleted_at" timestamptz;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "edited_at" timestamptz;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "edit_history" jsonb;
