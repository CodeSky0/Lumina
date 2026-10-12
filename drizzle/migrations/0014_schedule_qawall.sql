-- 课表（大屏下节课功能）
CREATE TABLE IF NOT EXISTS "schedule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE cascade,
  "day_of_week" integer NOT NULL,
  "period" integer NOT NULL,
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE cascade,
  "teacher_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "schedule_class_day_period_unique" UNIQUE ("class_id", "day_of_week", "period")
);
CREATE INDEX IF NOT EXISTS "schedule_class_idx" ON "schedule" ("class_id");

-- 答疑墙 — 提问
CREATE TABLE IF NOT EXISTS "questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asker_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "class_id" uuid REFERENCES "classes"("id") ON DELETE set null,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "questions_class_idx" ON "questions" ("class_id");
CREATE INDEX IF NOT EXISTS "questions_created_at_idx" ON "questions" ("created_at");

-- 答疑墙 — 回答
CREATE TABLE IF NOT EXISTS "answers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "question_id" uuid NOT NULL REFERENCES "questions"("id") ON DELETE cascade,
  "answerer_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "answers_question_idx" ON "answers" ("question_id");
