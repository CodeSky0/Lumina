-- message_reads: 用户 × 会话 的已读位置（未读计数支持）
CREATE TABLE "message_reads" (
	"user_id" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"last_read_at" timestamptz DEFAULT now() NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "message_reads_user_id_conversation_id_pk" PRIMARY KEY ("user_id","conversation_id")
);
--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
