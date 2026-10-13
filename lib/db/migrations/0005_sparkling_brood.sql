CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"expense_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'MYR' NOT NULL,
	"category" text DEFAULT 'OTHER' NOT NULL,
	"paid_to" text DEFAULT '' NOT NULL,
	"method" text DEFAULT 'OTHER' NOT NULL,
	"no_bill_needed" boolean DEFAULT false NOT NULL,
	"repeat_every" text DEFAULT 'NONE' NOT NULL,
	"repeat_handled" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"source" text,
	"property_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"income_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'MYR' NOT NULL,
	"category" text DEFAULT 'OTHER' NOT NULL,
	"received_from" text DEFAULT '' NOT NULL,
	"method" text DEFAULT 'OTHER' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"source" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "expenses_org_date_idx" ON "expenses" USING btree ("org_id","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_org_source_idx" ON "expenses" USING btree ("org_id","source");--> statement-breakpoint
CREATE INDEX "incomes_org_date_idx" ON "incomes" USING btree ("org_id","income_date");