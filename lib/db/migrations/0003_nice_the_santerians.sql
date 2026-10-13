ALTER TABLE "stock_requests" ADD COLUMN "request_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_requests_org_key_uq" ON "stock_requests" USING btree ("org_id","request_key");