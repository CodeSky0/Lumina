ALTER TABLE realtime_outbox ADD COLUMN recipient_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;
