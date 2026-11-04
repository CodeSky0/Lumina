ALTER TABLE messages ADD COLUMN client_msg_id UUID;
CREATE UNIQUE INDEX uq_messages_sender_client_msg
    ON messages(sender_id, client_msg_id) WHERE client_msg_id IS NOT NULL;
CREATE INDEX idx_messages_channel_created_id ON messages(channel_id, created_at, id);

CREATE TABLE message_deliveries (
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(message_id, user_id)
);
CREATE INDEX idx_message_deliveries_user ON message_deliveries(user_id, message_id DESC);

CREATE TABLE realtime_outbox (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    event_type VARCHAR(64) NOT NULL,
    channel_id BIGINT REFERENCES channels(id) ON DELETE CASCADE,
    payload JSONB NOT NULL CHECK (JSONB_TYPEOF(payload) = 'object'),
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(100)
);
CREATE INDEX idx_outbox_pending ON realtime_outbox(id)
    WHERE published_at IS NULL;
