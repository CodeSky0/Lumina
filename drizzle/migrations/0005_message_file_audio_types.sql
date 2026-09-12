-- 扩展 message_type 枚举：添加 file 和 audio
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'file';--> statement-breakpoint
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'audio';
