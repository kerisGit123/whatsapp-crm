"use server";

import { revalidatePath } from "next/cache";
import { requireOrgId } from "@/lib/auth";
import { createContact, updateContactStage } from "@/lib/db/contacts";
import { getContact } from "@/lib/db/contacts";
import { isWithinServiceWindow, recordMessage } from "@/lib/db/whatsapp";
import { sendWhatsappMessage } from "@/lib/twilio";

export async function createContactAction(formData: FormData) {
  const orgId = await requireOrgId();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name || !phone) throw new Error("Name and phone are required");

  await createContact(orgId, { name, phone, stage: "lead" });
  revalidatePath("/contacts");
}

export async function setContactStageAction(contactId: string, stage: string) {
  const orgId = await requireOrgId();
  await updateContactStage(orgId, contactId, stage);
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
}

export async function sendWhatsappMessageAction(contactId: string, body: string) {
  const orgId = await requireOrgId();
  const contact = await getContact(orgId, contactId);
  if (!contact) throw new Error("Contact not found");

  const withinWindow = await isWithinServiceWindow(orgId, contactId);
  if (!withinWindow) {
    throw new Error(
      "Outside the 24h service window — WhatsApp requires a pre-approved template for this send, which isn't wired up yet.",
    );
  }

  const message = await sendWhatsappMessage(contact.phone, body);
  await recordMessage({
    orgId,
    contactId,
    direction: "outbound",
    body,
    twilioSid: message.sid,
    status: "sent",
  });
  revalidatePath(`/contacts/${contactId}`);
}
