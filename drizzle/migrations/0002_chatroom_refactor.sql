CREATE TYPE "conversation_type" AS ENUM('group', 'direct');--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "conversation_type" NOT NULL,
	"class_id" uuid,
	"participant_a_id" text,
	"participant_b_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "conversations_class_idx" ON "conversations" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "conversations_participant_a_idx" ON "conversations" USING btree ("participant_a_id");--> statement-breakpoint
CREATE INDEX "conversations_participant_b_idx" ON "conversations" USING btree ("participant_b_id");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant_a_id_users_id_fk" FOREIGN KEY ("participant_a_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant_b_id_users_id_fk" FOREIGN KEY ("participant_b_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_target_class_id_classes_id_fk";--> statement-breakpoint
DROP INDEX "messages_target_class_idx";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "target_class_id";--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "conversation_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;