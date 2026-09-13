-- 0012: subjects — 学科表 + users.subject_id 外键

CREATE TABLE IF NOT EXISTS "subjects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL UNIQUE,
  "slug" text NOT NULL UNIQUE,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
INSERT INTO "subjects" ("name", "slug", "sort_order") VALUES
  ('语文', 'chinese', 0),
  ('数学', 'math', 1),
  ('英语', 'english', 2),
  ('物理', 'physics', 3),
  ('化学', 'chemistry', 4),
  ('生物', 'biology', 5),
  ('政治', 'politics', 6),
  ('历史', 'history', 7),
  ('地理', 'geography', 8)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subject_id" uuid REFERENCES "subjects"("id") ON DELETE SET NULL;
