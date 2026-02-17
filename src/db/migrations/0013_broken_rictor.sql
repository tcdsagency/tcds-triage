CREATE TYPE "public"."assistant_document_status" AS ENUM('processing', 'ready', 'error');--> statement-breakpoint
CREATE TYPE "public"."assistant_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."assistant_mode" AS ENUM('general', 'document');--> statement-breakpoint
CREATE TABLE "assistant_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"chunk_count" integer DEFAULT 0,
	"status" "assistant_document_status" DEFAULT 'processing' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "assistant_message_role" NOT NULL,
	"content" text NOT NULL,
	"document_ids" jsonb,
	"citations" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'New Chat',
	"mode" "assistant_mode" DEFAULT 'general' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_documents" ADD CONSTRAINT "assistant_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_session_id_assistant_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assistant_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_sessions" ADD CONSTRAINT "assistant_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_documents_tenant_idx" ON "assistant_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "assistant_documents_status_idx" ON "assistant_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assistant_messages_session_idx" ON "assistant_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "assistant_sessions_tenant_idx" ON "assistant_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "assistant_sessions_user_idx" ON "assistant_sessions" USING btree ("user_id");