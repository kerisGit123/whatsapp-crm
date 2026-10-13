// Neon Postgres schema (Drizzle) for the WhatsApp CRM.
//
// Multi-tenant: every row is scoped by orgId, always derived server-side
// from Clerk's auth() — never trusted from the client.
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  numeric,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    // E.164 format, e.g. +14155551234
    phone: text("phone").notNull(),
    email: text("email"),
    stage: text("stage").notNull().default("lead"), // lead | contacted | qualified | won | lost
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("contacts_org_phone_uq").on(t.orgId, t.phone),
    index("contacts_org_stage_idx").on(t.orgId, t.stage),
  ],
);

/** A Twilio WhatsApp-enabled number registered to one org. The webhook uses
 *  the inbound message's `To` field against this table to resolve which
 *  org owns the conversation — Twilio has no tenant concept of its own. */
export const whatsappNumbers = pgTable(
  "whatsapp_numbers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: text("org_id").notNull(),
    // E.164, no "whatsapp:" prefix — that's a Twilio-ism handled at the API boundary.
    phoneNumber: text("phone_number").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("whatsapp_numbers_phone_uq").on(t.phoneNumber),
    index("whatsapp_numbers_org_idx").on(t.orgId),
  ],
);

export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: text("org_id").notNull(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(), // "inbound" | "outbound"
    body: text("body").notNull(),
    // Twilio's MessageSid — dedupes retried webhook deliveries.
    twilioSid: text("twilio_sid"),
    status: text("status").notNull().default("received"), // received | queued | sent | delivered | failed
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("whatsapp_messages_twilio_sid_uq").on(t.twilioSid),
    index("whatsapp_messages_org_contact_idx").on(t.orgId, t.contactId, t.createdAt),
  ],
);

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: text("org_id").notNull(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    number: text("number").notNull(),
    lineItems: jsonb("line_items").$type<InvoiceLineItem[]>().notNull().default([]),
    currency: text("currency").notNull().default("USD"),
    totalCents: integer("total_cents").notNull().default(0),
    status: text("status").notNull().default("draft"), // draft | sent | paid | void
    dueDate: timestamp("due_date", { withTimezone: true }),
    // Unguessable id for the public, unauthenticated PDF link sent over WhatsApp.
    shareToken: uuid("share_token").defaultRandom().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("invoices_org_number_uq").on(t.orgId, t.number),
    index("invoices_org_contact_idx").on(t.orgId, t.contactId),
    uniqueIndex("invoices_share_token_uq").on(t.shareToken),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type WhatsappNumber = typeof whatsappNumbers.$inferSelect;
export type NewWhatsappNumber = typeof whatsappNumbers.$inferInsert;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type NewWhatsappMessage = typeof whatsappMessages.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

// ---------------------------------------------------------------- Stock (F&B)
// Every quantity is in inner units (bag, bottle, pcs). Money is plain numeric RM.

export const stockItems = pgTable(
  "stock_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: text("org_id").notNull(),
    code: text("code").notNull().default(""),
    name: text("name").notNull(),
    specification: text("specification").notNull().default(""),
    group: text("group").notNull().default("RAW"), // RAW | PACKAGING | OTHER | MERCH
    unit: text("unit").notNull().default(""),
    unitsPerCarton: numeric("units_per_carton", { precision: 12, scale: 2, mode: "number" }).notNull().default(1),
    cartonPrice: numeric("carton_price", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
    supplier: text("supplier").notNull().default(""),
    status: text("status").notNull().default("ACTIVE"), // ACTIVE | DISCONTINUED
    reorderBelowMonths: numeric("reorder_below_months", { precision: 6, scale: 2, mode: "number" }),
    shelfLifeDays: integer("shelf_life_days"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("stock_items_org_idx").on(t.orgId, t.status)],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: text("org_id").notNull(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => stockItems.id, { onDelete: "restrict" }),
    movementDate: date("movement_date", { mode: "string" }).notNull(),
    type: text("type").notNull(), // PURCHASE | TAKE | BORROW | RETURN | EXCHANGE_IN | WASTE | ADJUST_IN | ADJUST_OUT
    quantity: numeric("quantity", { precision: 14, scale: 2, mode: "number" }).notNull(),
    party: text("party").notNull().default(""),
    unitCost: numeric("unit_cost", { precision: 12, scale: 4, mode: "number" }),
    expiryDate: date("expiry_date", { mode: "string" }),
    reference: text("reference").notNull().default(""),
    notes: text("notes").notNull().default(""),
    borrowStatus: text("borrow_status"),
    borrowId: text("borrow_id"),
    batchId: text("batch_id"), // lines saved together; also the idempotency key
    orderId: text("order_id"),
    reason: text("reason"),
    recordedBy: text("recorded_by").notNull().default(""),
    // Soft delete: removed lines can be restored.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("stock_movements_org_item_idx").on(t.orgId, t.itemId, t.movementDate),
    index("stock_movements_batch_idx").on(t.orgId, t.batchId),
  ],
);

/** One row per workspace: the re-order rule and the month lock. */
export const stockSettings = pgTable("stock_settings", {
  orgId: text("org_id").primaryKey(),
  reorderBelow: numeric("reorder_below", { precision: 6, scale: 2, mode: "number" }).notNull().default(2),
  orderUpTo: numeric("order_up_to", { precision: 6, scale: 2, mode: "number" }).notNull().default(2.5),
  leadDays: integer("lead_days").notNull().default(0),
  lockedThrough: date("locked_through", { mode: "string" }),
});

export type StockItemRow = typeof stockItems.$inferSelect;
export type StockMovementRow = typeof stockMovements.$inferSelect;
export type StockSettingsRow = typeof stockSettings.$inferSelect;

/** Our order to one supplier. `lines` is a JSON list (see lib/stock/orders.ts). */
export const stockOrders = pgTable(
  "stock_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: text("org_id").notNull(),
    number: text("number").notNull(), // ORD-2026-0001
    supplier: text("supplier").notNull().default(""),
    supplierPhone: text("supplier_phone").notNull().default(""),
    supplierRef: text("supplier_ref").notNull().default(""),
    orderDate: date("order_date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("DRAFT"), // DRAFT | SENT | PARTLY_RECEIVED | RECEIVED | CANCELLED
    notes: text("notes").notNull().default(""),
    lines: jsonb("lines").$type<Array<{ itemId: string; orderedUnits: number; cartonPrice: number; closed?: boolean }>>().notNull().default([]),
    requestKey: text("request_key"), // makes a retried save idempotent
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("stock_orders_org_number_uq").on(t.orgId, t.number),
    uniqueIndex("stock_orders_org_key_uq").on(t.orgId, t.requestKey),
    index("stock_orders_org_status_idx").on(t.orgId, t.status),
  ],
);

/** A branch asks the warehouse for stock. `lines` is a JSON list (lib/stock/requests.ts). */
export const stockRequests = pgTable(
  "stock_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: text("org_id").notNull(),
    number: text("number").notNull(), // REQ-2026-0001
    branch: text("branch").notNull().default(""),
    requestDate: date("request_date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("REQUESTED"), // REQUESTED | ISSUED | RECEIVED | SHORT | CANCELLED
    notes: text("notes").notNull().default(""),
    requestedBy: text("requested_by").notNull().default(""),
    issuedOn: date("issued_on", { mode: "string" }),
    issuedBy: text("issued_by").notNull().default(""),
    receivedOn: date("received_on", { mode: "string" }),
    receivedBy: text("received_by").notNull().default(""),
    requestKey: text("request_key"), // makes a retried save idempotent
    lines: jsonb("lines")
      .$type<Array<{ itemId: string; requestedUnits: number; issuedUnits?: number; receivedUnits?: number; resolved?: "RETURNED" | "WRITTEN_OFF" }>>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("stock_requests_org_number_uq").on(t.orgId, t.number),
    uniqueIndex("stock_requests_org_key_uq").on(t.orgId, t.requestKey),
    index("stock_requests_org_status_idx").on(t.orgId, t.status),
  ],
);

export type StockOrderRow = typeof stockOrders.$inferSelect;
export type StockRequestRow = typeof stockRequests.$inferSelect;
