CREATE TYPE "app"."whatsapp_booking_intent_state" AS ENUM('pending', 'confirmed', 'expired', 'superseded');--> statement-breakpoint
CREATE TABLE "app"."whatsapp_booking_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"offering_id" uuid NOT NULL,
	"slot_id" text NOT NULL,
	"participant_name" text,
	"participant_age" integer,
	"state" "app"."whatsapp_booking_intent_state" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_booking_intents_school_id_id" UNIQUE("school_id","id"),
	CONSTRAINT "whatsapp_booking_intents_age" CHECK ("app"."whatsapp_booking_intents"."participant_age" IS NULL OR "app"."whatsapp_booking_intents"."participant_age" BETWEEN 0 AND 99)
);
--> statement-breakpoint
ALTER TABLE "app"."bookings" ALTER COLUMN "contact_email_snapshot" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."whatsapp_deliveries" ADD COLUMN "interactive_buttons" jsonb;--> statement-breakpoint
ALTER TABLE "app"."whatsapp_booking_intents" ADD CONSTRAINT "whatsapp_booking_intents_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."whatsapp_booking_intents" ADD CONSTRAINT "whatsapp_booking_intents_conversation_fk" FOREIGN KEY ("school_id","conversation_id") REFERENCES "app"."conversations"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."whatsapp_booking_intents" ADD CONSTRAINT "whatsapp_booking_intents_offering_fk" FOREIGN KEY ("school_id","offering_id") REFERENCES "app"."trial_offerings"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_booking_intents_active_pending" ON "app"."whatsapp_booking_intents" USING btree ("conversation_id") WHERE "app"."whatsapp_booking_intents"."state" = 'pending';