import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts, type Contact, type NewContact } from "@/lib/db/schema";

export async function listContacts(orgId: string): Promise<Contact[]> {
  return db
    .select()
    .from(contacts)
    .where(eq(contacts.orgId, orgId))
    .orderBy(desc(contacts.createdAt));
}

export async function getContact(orgId: string, contactId: string): Promise<Contact | undefined> {
  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId)));
  return row;
}

export async function findContactByPhone(orgId: string, phone: string): Promise<Contact | undefined> {
  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.orgId, orgId), eq(contacts.phone, phone)));
  return row;
}

export async function createContact(
  orgId: string,
  input: Omit<NewContact, "orgId">,
): Promise<Contact> {
  const [row] = await db
    .insert(contacts)
    .values({ ...input, orgId })
    .returning();
  return row;
}

/** Used by the WhatsApp webhook: link an inbound message to an existing
 *  contact, or create a bare-minimum lead so no message is ever dropped. */
export async function upsertContactByPhone(
  orgId: string,
  phone: string,
  fallbackName: string,
): Promise<Contact> {
  const existing = await findContactByPhone(orgId, phone);
  if (existing) return existing;
  return createContact(orgId, { name: fallbackName, phone, stage: "lead" });
}

export async function updateContactStage(
  orgId: string,
  contactId: string,
  stage: string,
): Promise<void> {
  await db
    .update(contacts)
    .set({ stage, updatedAt: new Date() })
    .where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId)));
}
