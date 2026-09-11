CREATE TYPE "app"."whatsapp_job_state" AS ENUM('pending', 'claimed', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "app"."whatsapp_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"phone_number_id" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"kind" text DEFAULT 'inbound_message' NOT NULL,
	"payload" jsonb NOT NULL,
	"state" "app"."whatsapp_job_state" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_jobs_dedupe_key" UNIQUE("dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "app"."whatsapp_deliveries" ADD COLUMN "body" text;--> statement-breakpoint
ALTER TABLE "app"."whatsapp_deliveries" ADD COLUMN "status_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."whatsapp_jobs" ADD CONSTRAINT "whatsapp_jobs_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_jobs_due_idx" ON "app"."whatsapp_jobs" USING btree ("state","next_attempt_at");