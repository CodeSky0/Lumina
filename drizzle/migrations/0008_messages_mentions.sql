-- 0008: messages.mentions — @提及列表
-- 存储 [{ userId, name }] 的 jsonb 数组，null 表示无提及

ALTER TABLE "messages" ADD COLUMN "mentions" jsonb;
