-- conversation_preferences: 用户对会话的偏好（置顶/免打扰）
CREATE TABLE "conversation_preferences" (
	"user_id" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"muted" boolean DEFAULT false NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_preferences_user_id_conversation_id_pk" PRIMARY KEY ("user_id","conversation_id")
);
--> statement-breakpoint
ALTER TABLE "conversation_preferences" ADD CONSTRAINT "conversation_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_preferences" ADD CONSTRAINT "conversation_preferences_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
