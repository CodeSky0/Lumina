-- 0009: push_subscriptions — 浏览器 Web Push 订阅

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_unique" ON "push_subscriptions" ("endpoint");
