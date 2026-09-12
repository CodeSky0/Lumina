-- 0010: announcements — 班级公告

CREATE TABLE IF NOT EXISTS "announcements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "announcements_class_idx" ON "announcements" ("class_id");
CREATE INDEX IF NOT EXISTS "announcements_created_at_idx" ON "announcements" ("created_at");
