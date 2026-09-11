CREATE TYPE "app"."whatsapp_delivery_state" AS ENUM('pending', 'claimed', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TABLE "app"."whatsapp_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"booking_id" uuid,
	"lead_id" uuid,
	"recipient_wa_id" text NOT NULL,
	"phone_number_id" text NOT NULL,
	"provider_idempotency_key" text NOT NULL,
	"state" "app"."whatsapp_delivery_state" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_id" text,
	"template_name" text,
	"template_params" jsonb,
	"window_expires_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"claimed_by" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_deliveries_provider_key" UNIQUE("provider_idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "app"."bookings" ALTER COLUMN "contact_email_snapshot" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."contacts" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."schools" ADD COLUMN "whatsapp_phone_number_id" text;--> statement-breakpoint
ALTER TABLE "app"."schools" ADD COLUMN "whatsapp_waba_id" text;--> statement-breakpoint
ALTER TABLE "app"."whatsapp_deliveries" ADD CONSTRAINT "whatsapp_deliveries_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."whatsapp_deliveries" ADD CONSTRAINT "whatsapp_deliveries_booking_fk" FOREIGN KEY ("school_id","booking_id") REFERENCES "app"."bookings"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."whatsapp_deliveries" ADD CONSTRAINT "whatsapp_deliveries_lead_fk" FOREIGN KEY ("school_id","lead_id") REFERENCES "app"."leads"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_deliveries_due_idx" ON "app"."whatsapp_deliveries" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "schools_whatsapp_phone_number_id_unique" ON "app"."schools" USING btree ("whatsapp_phone_number_id") WHERE "app"."schools"."whatsapp_phone_number_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."contacts" ADD CONSTRAINT "contacts_school_phone" UNIQUE("school_id","phone");