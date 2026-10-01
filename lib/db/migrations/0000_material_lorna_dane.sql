CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"stage" text DEFAULT 'lead' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contact_id" uuid NOT NULL,
	"number" text NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"due_date" timestamp with time zone,
	"share_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contact_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"body" text NOT NULL,
	"twilio_sid" text,
	"status" text DEFAULT 'received' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"phone_number" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_org_phone_uq" ON "contacts" USING btree ("org_id","phone");--> statement-breakpoint
CREATE INDEX "contacts_org_stage_idx" ON "contacts" USING btree ("org_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_org_number_uq" ON "invoices" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "invoices_org_contact_idx" ON "invoices" USING btree ("org_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_share_token_uq" ON "invoices" USING btree ("share_token");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_twilio_sid_uq" ON "whatsapp_messages" USING btree ("twilio_sid");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_org_contact_idx" ON "whatsapp_messages" USING btree ("org_id","contact_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_numbers_phone_uq" ON "whatsapp_numbers" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "whatsapp_numbers_org_idx" ON "whatsapp_numbers" USING btree ("org_id");