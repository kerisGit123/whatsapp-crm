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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("invoices_org_number_uq").on(t.orgId, t.number),
    index("invoices_org_contact_idx").on(t.orgId, t.contactId),
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
