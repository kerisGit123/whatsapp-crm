CREATE TABLE "stock_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"number" text NOT NULL,
	"supplier" text DEFAULT '' NOT NULL,
	"supplier_phone" text DEFAULT '' NOT NULL,
	"supplier_ref" text DEFAULT '' NOT NULL,
	"order_date" date NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"request_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"number" text NOT NULL,
	"branch" text DEFAULT '' NOT NULL,
	"request_date" date NOT NULL,
	"status" text DEFAULT 'REQUESTED' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"requested_by" text DEFAULT '' NOT NULL,
	"issued_on" date,
	"issued_by" text DEFAULT '' NOT NULL,
	"received_on" date,
	"received_by" text DEFAULT '' NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "stock_orders_org_number_uq" ON "stock_orders" USING btree ("org_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_orders_org_key_uq" ON "stock_orders" USING btree ("org_id","request_key");--> statement-breakpoint
CREATE INDEX "stock_orders_org_status_idx" ON "stock_orders" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_requests_org_number_uq" ON "stock_requests" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "stock_requests_org_status_idx" ON "stock_requests" USING btree ("org_id","status");