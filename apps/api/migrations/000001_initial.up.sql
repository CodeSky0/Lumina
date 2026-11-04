CREATE TABLE classes (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subjects (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50) NOT NULL CHECK (CHAR_LENGTH(icon) BETWEEN 1 AND 50),
    color VARCHAR(7) NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE CHECK (username ~ '^[a-zA-Z0-9_.-]{3,64}$'),
    display_name VARCHAR(100) NOT NULL CHECK (CHAR_LENGTH(display_name) BETWEEN 1 AND 100),
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin','teacher','classroom')),
    class_id BIGINT REFERENCES classes(id) ON DELETE RESTRICT,
    password_hash VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    token_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((role = 'classroom' AND class_id IS NOT NULL) OR (role <> 'classroom' AND class_id IS NULL))
);
CREATE INDEX idx_users_class_active ON users(class_id, active) WHERE role = 'classroom';
CREATE INDEX idx_users_role_active ON users(role, active);

CREATE TABLE teaching_assignments (
    id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    subject_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_assignment UNIQUE (teacher_id, class_id, subject_id)
);
CREATE INDEX idx_assignments_teacher_active ON teaching_assignments(teacher_id, active);
CREATE INDEX idx_assignments_class_active ON teaching_assignments(class_id, active);

CREATE TABLE channels (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 150),
    type VARCHAR(20) NOT NULL CHECK (type IN ('normal','broadcast')),
    class_id BIGINT REFERENCES classes(id) ON DELETE RESTRICT,
    subject_id BIGINT REFERENCES subjects(id) ON DELETE RESTRICT,
    teacher_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    broadcast_scope VARCHAR(20) CHECK (broadcast_scope IN ('school','grade','class')),
    grade INTEGER CHECK (grade BETWEEN 1 AND 12),
    target_class_id BIGINT REFERENCES classes(id) ON DELETE RESTRICT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (type = 'normal' AND class_id IS NOT NULL AND subject_id IS NOT NULL AND teacher_id IS NOT NULL AND broadcast_scope IS NULL AND grade IS NULL AND target_class_id IS NULL)
        OR
        (type = 'broadcast' AND class_id IS NULL AND subject_id IS NULL AND teacher_id IS NULL AND (
            (broadcast_scope = 'school' AND grade IS NULL AND target_class_id IS NULL) OR
            (broadcast_scope = 'grade' AND grade IS NOT NULL AND target_class_id IS NULL) OR
            (broadcast_scope = 'class' AND grade IS NULL AND target_class_id IS NOT NULL)
        ))
    )
);
CREATE UNIQUE INDEX uq_normal_channel ON channels(class_id, subject_id, teacher_id) WHERE type = 'normal';
CREATE UNIQUE INDEX uq_school_channel ON channels(broadcast_scope) WHERE type = 'broadcast' AND broadcast_scope = 'school';
CREATE UNIQUE INDEX uq_grade_channel ON channels(broadcast_scope, grade) WHERE type = 'broadcast' AND broadcast_scope = 'grade';
CREATE UNIQUE INDEX uq_class_channel ON channels(broadcast_scope, target_class_id) WHERE type = 'broadcast' AND broadcast_scope = 'class';
CREATE INDEX idx_channels_teacher ON channels(teacher_id, active) WHERE type = 'normal';
CREATE INDEX idx_channels_class ON channels(class_id, active) WHERE type = 'normal';

CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('text','image','file','notice','urgent')),
    content TEXT NOT NULL CHECK (CHAR_LENGTH(content) <= 2000),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (JSONB_TYPEOF(metadata) = 'object'),
    reply_to_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CHECK (edited_at IS NULL OR edited_at >= created_at),
    CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);
CREATE INDEX idx_messages_channel_cursor ON messages(channel_id, id DESC);
CREATE INDEX idx_messages_channel_content ON messages(channel_id, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_urgent ON messages(channel_id, id DESC) WHERE type = 'urgent' AND deleted_at IS NULL;

CREATE TABLE message_reads (
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(message_id, user_id)
);
CREATE INDEX idx_message_reads_user ON message_reads(user_id, message_id DESC);

CREATE TABLE message_confirmations (
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(message_id, user_id)
);

CREATE TABLE channel_reads (
    channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(channel_id, user_id)
);
CREATE INDEX idx_channel_reads_user ON channel_reads(user_id, channel_id);

CREATE TABLE announcements (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL CHECK (CHAR_LENGTH(title) BETWEEN 1 AND 200),
    content TEXT NOT NULL CHECK (CHAR_LENGTH(content) BETWEEN 1 AND 2000),
    type VARCHAR(20) NOT NULL CHECK (type IN ('notice','urgent')),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('school','grade','class')),
    grade INTEGER CHECK (grade BETWEEN 1 AND 12),
    target_class_id BIGINT REFERENCES classes(id) ON DELETE RESTRICT,
    publisher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seed_key VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CHECK ((scope = 'school' AND grade IS NULL AND target_class_id IS NULL) OR
           (scope = 'grade' AND grade IS NOT NULL AND target_class_id IS NULL) OR
           (scope = 'class' AND grade IS NULL AND target_class_id IS NOT NULL))
);
CREATE INDEX idx_announcements_scope ON announcements(scope, grade, target_class_id, id DESC) WHERE deleted_at IS NULL;

CREATE TABLE announcement_confirmations (
    announcement_id BIGINT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(announcement_id, user_id)
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_user_expiry ON refresh_tokens(user_id, expires_at DESC);

CREATE TABLE device_bindings (
    id BIGSERIAL PRIMARY KEY,
    classroom_user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    code_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_device_lookup ON device_bindings(code_hash, expires_at) WHERE used_at IS NULL;

CREATE TABLE files (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL UNIQUE,
    mime VARCHAR(150) NOT NULL,
    size BIGINT NOT NULL CHECK (size > 0),
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('image','file')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_files_channel ON files(channel_id, id DESC);
CREATE INDEX idx_files_owner ON files(owner_id, id DESC);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    request_id VARCHAR(100) NOT NULL,
    ip_address VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_created ON audit_logs(id DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, id DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id, id DESC);

CREATE FUNCTION prevent_audit_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit logs are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
