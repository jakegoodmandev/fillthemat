CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TYPE "app"."booking_status" AS ENUM('booked', 'showed', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "app"."cron_result" AS ENUM('success', 'error');--> statement-breakpoint
CREATE TYPE "app"."email_kind" AS ENUM('prospect_confirmation', 'booking_reminder', 'booking_cancellation', 'owner_booking', 'owner_cancellation', 'owner_lead');--> statement-breakpoint
CREATE TYPE "app"."email_state" AS ENUM('pending', 'claimed', 'sent', 'failed', 'delivered', 'bounced', 'complained');--> statement-breakpoint
CREATE TYPE "app"."message_completion" AS ENUM('complete', 'streaming', 'aborted', 'error');--> statement-breakpoint
CREATE TABLE "app"."bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"trial_offering_id" uuid NOT NULL,
	"trial_window_id" uuid NOT NULL,
	"trial_occurrence_id" uuid NOT NULL,
	"conversation_id" uuid,
	"landing_session_id" uuid,
	"idempotency_key" text NOT NULL,
	"status" "app"."booking_status" DEFAULT 'booked' NOT NULL,
	"participant_name_snapshot" text NOT NULL,
	"participant_age_snapshot" integer NOT NULL,
	"offering_name_snapshot" text NOT NULL,
	"timezone_snapshot" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"location_snapshot" text,
	"instructions_snapshot" text,
	"contact_email_snapshot" text NOT NULL,
	"contact_name_snapshot" text NOT NULL,
	"contact_phone_snapshot" text NOT NULL,
	"ics_uid" text NOT NULL,
	"ics_sequence" integer DEFAULT 0 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_school_id_id" UNIQUE("school_id","id"),
	CONSTRAINT "bookings_school_idempotency" UNIQUE("school_id","idempotency_key"),
	CONSTRAINT "bookings_participant_age" CHECK ("app"."bookings"."participant_age_snapshot" BETWEEN 0 AND 99)
);
--> statement-breakpoint
CREATE TABLE "app"."contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_school_id_id" UNIQUE("school_id","id"),
	CONSTRAINT "contacts_school_email" UNIQUE("school_id","email")
);
--> statement-breakpoint
CREATE TABLE "app"."conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"landing_session_id" uuid,
	"contact_id" uuid,
	"resume_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"generating_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_school_id_id" UNIQUE("school_id","id"),
	CONSTRAINT "conversations_resume_token_hash" UNIQUE("resume_token_hash")
);
--> statement-breakpoint
CREATE TABLE "app"."cron_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"purged_count" integer DEFAULT 0 NOT NULL,
	"result" "app"."cron_result",
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "app"."email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"booking_id" uuid,
	"lead_id" uuid,
	"kind" "app"."email_kind" NOT NULL,
	"recipient" text NOT NULL,
	"provider_idempotency_key" text NOT NULL,
	"state" "app"."email_state" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_id" text,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"claimed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_deliveries_provider_key" UNIQUE("provider_idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "app"."faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faqs_school_id_id" UNIQUE("school_id","id"),
	CONSTRAINT "faqs_question_len" CHECK (char_length("app"."faqs"."question") BETWEEN 1 AND 200),
	CONSTRAINT "faqs_answer_len" CHECK (char_length("app"."faqs"."answer") BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE TABLE "app"."funnel_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"landing_session_id" uuid,
	"conversation_id" uuid,
	"booking_id" uuid,
	"lead_id" uuid,
	"event_type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."landing_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"session_key_hash" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"qualified_at" timestamp with time zone,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"is_preview" boolean DEFAULT false NOT NULL,
	"bot_exclusion_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "landing_sessions_school_id_id" UNIQUE("school_id","id"),
	CONSTRAINT "landing_sessions_school_key" UNIQUE("school_id","session_key_hash")
);
--> statement-breakpoint
CREATE TABLE "app"."leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"landing_session_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"participant_name" text,
	"participant_age" integer,
	"trial_offering_id" uuid,
	"stated_need" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_school_id_id" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" text NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"completion" "app"."message_completion" DEFAULT 'complete' NOT NULL,
	"purge_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_conversation_message_id" UNIQUE("conversation_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "app"."participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_school_id_id" UNIQUE("school_id","id"),
	CONSTRAINT "participants_contact_normalized_name" UNIQUE("contact_id","normalized_name")
);
--> statement-breakpoint
CREATE TABLE "app"."schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"approved_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"previewed_at" timestamp with time zone,
	"notification_email" text NOT NULL,
	"phone" text,
	"website" text,
	"address" text,
	"country" text DEFAULT 'US' NOT NULL,
	"city" text,
	"parking_notes" text,
	"access_notes" text,
	"trial_guidance" text,
	"pricing" text,
	"welcome_message" text,
	"agent_instructions" text,
	"logo_url" text,
	"primary_color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_owner_user_id_unique" UNIQUE("owner_user_id"),
	CONSTRAINT "schools_slug_unique" UNIQUE("slug"),
	CONSTRAINT "schools_school_id_unique" UNIQUE("id"),
	CONSTRAINT "schools_slug_format" CHECK ("app"."schools"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("app"."schools"."slug") BETWEEN 3 AND 48),
	CONSTRAINT "schools_primary_color" CHECK ("app"."schools"."primary_color" IS NULL OR "app"."schools"."primary_color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "schools_logo_url" CHECK ("app"."schools"."logo_url" IS NULL OR "app"."schools"."logo_url" ~ '^https://')
);
--> statement-breakpoint
CREATE TABLE "app"."trial_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"trial_window_id" uuid NOT NULL,
	"trial_offering_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL,
	"booked_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trial_occurrences_school_id_id" UNIQUE("school_id","id"),
	CONSTRAINT "trial_occurrences_window_start" UNIQUE("trial_window_id","start_at"),
	CONSTRAINT "trial_occurrences_booked_count" CHECK ("app"."trial_occurrences"."booked_count" >= 0 AND "app"."trial_occurrences"."booked_count" <= "app"."trial_occurrences"."capacity"),
	CONSTRAINT "trial_occurrences_capacity" CHECK ("app"."trial_occurrences"."capacity" BETWEEN 1 AND 50),
	CONSTRAINT "trial_occurrences_range" CHECK ("app"."trial_occurrences"."end_at" > "app"."trial_occurrences"."start_at")
);
--> statement-breakpoint
CREATE TABLE "app"."trial_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"minimum_age" integer,
	"maximum_age" integer,
	"expectations" text,
	"attire" text,
	"waiver_notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trial_offerings_school_id_id" UNIQUE("school_id","id"),
	CONSTRAINT "trial_offerings_age_range" CHECK (("app"."trial_offerings"."minimum_age" IS NULL OR "app"."trial_offerings"."minimum_age" BETWEEN 0 AND 99)
        AND ("app"."trial_offerings"."maximum_age" IS NULL OR "app"."trial_offerings"."maximum_age" BETWEEN 0 AND 99)
        AND ("app"."trial_offerings"."minimum_age" IS NULL OR "app"."trial_offerings"."maximum_age" IS NULL OR "app"."trial_offerings"."minimum_age" <= "app"."trial_offerings"."maximum_age")),
	CONSTRAINT "trial_offerings_name_len" CHECK (char_length("app"."trial_offerings"."name") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE TABLE "app"."trial_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"trial_offering_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"capacity" integer NOT NULL,
	"label" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trial_windows_school_id_id" UNIQUE("school_id","id"),
	CONSTRAINT "trial_windows_day" CHECK ("app"."trial_windows"."day_of_week" BETWEEN 0 AND 6),
	CONSTRAINT "trial_windows_start_minute" CHECK ("app"."trial_windows"."start_minute" BETWEEN 0 AND 1439),
	CONSTRAINT "trial_windows_duration" CHECK ("app"."trial_windows"."duration_minutes" > 0),
	CONSTRAINT "trial_windows_capacity" CHECK ("app"."trial_windows"."capacity" BETWEEN 1 AND 50)
);
--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."bookings" ADD CONSTRAINT "bookings_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bookings" ADD CONSTRAINT "bookings_contact_fk" FOREIGN KEY ("school_id","contact_id") REFERENCES "app"."contacts"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bookings" ADD CONSTRAINT "bookings_participant_fk" FOREIGN KEY ("school_id","participant_id") REFERENCES "app"."participants"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bookings" ADD CONSTRAINT "bookings_offering_fk" FOREIGN KEY ("school_id","trial_offering_id") REFERENCES "app"."trial_offerings"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bookings" ADD CONSTRAINT "bookings_window_fk" FOREIGN KEY ("school_id","trial_window_id") REFERENCES "app"."trial_windows"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bookings" ADD CONSTRAINT "bookings_occurrence_fk" FOREIGN KEY ("school_id","trial_occurrence_id") REFERENCES "app"."trial_occurrences"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bookings" ADD CONSTRAINT "bookings_conversation_fk" FOREIGN KEY ("school_id","conversation_id") REFERENCES "app"."conversations"("school_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bookings" ADD CONSTRAINT "bookings_landing_session_fk" FOREIGN KEY ("school_id","landing_session_id") REFERENCES "app"."landing_sessions"("school_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."contacts" ADD CONSTRAINT "contacts_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversations" ADD CONSTRAINT "conversations_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversations" ADD CONSTRAINT "conversations_landing_session_fk" FOREIGN KEY ("school_id","landing_session_id") REFERENCES "app"."landing_sessions"("school_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversations" ADD CONSTRAINT "conversations_contact_fk" FOREIGN KEY ("school_id","contact_id") REFERENCES "app"."contacts"("school_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."email_deliveries" ADD CONSTRAINT "email_deliveries_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."email_deliveries" ADD CONSTRAINT "email_deliveries_booking_fk" FOREIGN KEY ("school_id","booking_id") REFERENCES "app"."bookings"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."email_deliveries" ADD CONSTRAINT "email_deliveries_lead_fk" FOREIGN KEY ("school_id","lead_id") REFERENCES "app"."leads"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."faqs" ADD CONSTRAINT "faqs_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."funnel_events" ADD CONSTRAINT "funnel_events_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."landing_sessions" ADD CONSTRAINT "landing_sessions_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."leads" ADD CONSTRAINT "leads_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."leads" ADD CONSTRAINT "leads_landing_session_fk" FOREIGN KEY ("school_id","landing_session_id") REFERENCES "app"."landing_sessions"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."leads" ADD CONSTRAINT "leads_contact_fk" FOREIGN KEY ("school_id","contact_id") REFERENCES "app"."contacts"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."leads" ADD CONSTRAINT "leads_offering_fk" FOREIGN KEY ("school_id","trial_offering_id") REFERENCES "app"."trial_offerings"("school_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."participants" ADD CONSTRAINT "participants_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."participants" ADD CONSTRAINT "participants_contact_fk" FOREIGN KEY ("school_id","contact_id") REFERENCES "app"."contacts"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."schools" ADD CONSTRAINT "schools_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."trial_occurrences" ADD CONSTRAINT "trial_occurrences_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."trial_occurrences" ADD CONSTRAINT "trial_occurrences_window_fk" FOREIGN KEY ("school_id","trial_window_id") REFERENCES "app"."trial_windows"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."trial_occurrences" ADD CONSTRAINT "trial_occurrences_offering_fk" FOREIGN KEY ("school_id","trial_offering_id") REFERENCES "app"."trial_offerings"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."trial_offerings" ADD CONSTRAINT "trial_offerings_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."trial_windows" ADD CONSTRAINT "trial_windows_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."trial_windows" ADD CONSTRAINT "trial_windows_offering_fk" FOREIGN KEY ("school_id","trial_offering_id") REFERENCES "app"."trial_offerings"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_active_participant_occurrence" ON "app"."bookings" USING btree ("trial_occurrence_id","participant_id") WHERE "app"."bookings"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "email_deliveries_due_idx" ON "app"."email_deliveries" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "funnel_events_school_created_idx" ON "app"."funnel_events" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_purge_at_idx" ON "app"."messages" USING btree ("purge_at");--> statement-breakpoint
ALTER TABLE "app"."users" ADD CONSTRAINT "users_id_auth_users_fk" FOREIGN KEY ("id") REFERENCES auth.users(id) ON DELETE cascade;--> statement-breakpoint
REVOKE ALL ON SCHEMA app FROM PUBLIC;
REVOKE ALL ON SCHEMA app FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM anon, authenticated;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.prevent_published_school_identity_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.published_at IS NOT NULL THEN
    IF NEW.slug IS DISTINCT FROM OLD.slug OR NEW.timezone IS DISTINCT FROM OLD.timezone THEN
      RAISE EXCEPTION 'slug and timezone are immutable after publish';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER schools_identity_immutable
  BEFORE UPDATE ON app.schools
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_published_school_identity_change();