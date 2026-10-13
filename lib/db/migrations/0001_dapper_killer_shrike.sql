CREATE TABLE "stock_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"code" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"specification" text DEFAULT '' NOT NULL,
	"group" text DEFAULT 'RAW' NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"units_per_carton" numeric(12, 2) DEFAULT 1 NOT NULL,
	"carton_price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"supplier" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"reorder_below_months" numeric(6, 2),
	"shelf_life_days" integer,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"item_id" uuid NOT NULL,
	"movement_date" date NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(14, 2) NOT NULL,
	"party" text DEFAULT '' NOT NULL,
	"unit_cost" numeric(12, 4),
	"expiry_date" date,
	"reference" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"borrow_status" text,
	"borrow_id" text,
	"batch_id" text,
	"order_id" text,
	"reason" text,
	"recorded_by" text DEFAULT '' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_settings" (
	"org_id" text PRIMARY KEY NOT NULL,
	"reorder_below" numeric(6, 2) DEFAULT 2 NOT NULL,
	"order_up_to" numeric(6, 2) DEFAULT 2.5 NOT NULL,
	"lead_days" integer DEFAULT 0 NOT NULL,
	"locked_through" date
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_stock_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."stock_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_items_org_idx" ON "stock_items" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "stock_movements_org_item_idx" ON "stock_movements" USING btree ("org_id","item_id","movement_date");--> statement-breakpoint
CREATE INDEX "stock_movements_batch_idx" ON "stock_movements" USING btree ("org_id","batch_id");