import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  whatsappNumbers,
  whatsappMessages,
  type WhatsappMessage,
  type NewWhatsappMessage,
} from "@/lib/db/schema";

/** Resolves which org owns a Twilio WhatsApp number (E.164, no "whatsapp:" prefix). */
export async function findOrgIdByWhatsappNumber(phoneNumber: string): Promise<string | undefined> {
  const [row] = await db
    .select({ orgId: whatsappNumbers.orgId })
    .from(whatsappNumbers)
    .where(eq(whatsappNumbers.phoneNumber, phoneNumber));
  return row?.orgId;
}

export async function registerWhatsappNumber(
  orgId: string,
  phoneNumber: string,
  label?: string,
): Promise<void> {
  await db.insert(whatsappNumbers).values({ orgId, phoneNumber, label });
}

export async function listMessagesForContact(
  orgId: string,
  contactId: string,
): Promise<WhatsappMessage[]> {
  return db
    .select()
    .from(whatsappMessages)
    .where(and(eq(whatsappMessages.orgId, orgId), eq(whatsappMessages.contactId, contactId)))
    .orderBy(asc(whatsappMessages.createdAt));
}

export async function recordMessage(input: NewWhatsappMessage): Promise<WhatsappMessage> {
  const [row] = await db.insert(whatsappMessages).values(input).returning();
  return row;
}

/** True if the contact has messaged inbound within the last 24h — outside
 *  this window, WhatsApp requires a pre-approved template, not free-form text. */
export async function isWithinServiceWindow(orgId: string, contactId: string): Promise<boolean> {
  const rows = await db
    .select({ createdAt: whatsappMessages.createdAt })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.orgId, orgId),
        eq(whatsappMessages.contactId, contactId),
        eq(whatsappMessages.direction, "inbound"),
      ),
    )
    .orderBy(asc(whatsappMessages.createdAt));
  const last = rows.at(-1);
  if (!last) return false;
  return Date.now() - last.createdAt.getTime() < 24 * 60 * 60 * 1000;
}
