DROP TABLE IF EXISTS realtime_outbox;
DROP TABLE IF EXISTS message_deliveries;
DROP INDEX IF EXISTS idx_messages_channel_created_id;
DROP INDEX IF EXISTS uq_messages_sender_client_msg;
ALTER TABLE messages DROP COLUMN IF EXISTS client_msg_id;
