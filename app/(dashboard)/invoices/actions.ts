"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrgId } from "@/lib/auth";
import { createInvoice, getInvoice, invoicePublicUrl, setInvoiceStatus } from "@/lib/db/invoices";
import { getContact } from "@/lib/db/contacts";
import { isWithinServiceWindow, recordMessage } from "@/lib/db/whatsapp";
import { sendWhatsappMessage } from "@/lib/twilio";
import type { InvoiceLineItem } from "@/lib/db/schema";

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export async function createInvoiceAction(formData: FormData) {
  const orgId = await requireOrgId();
  const contactId = String(formData.get("contactId") ?? "");
  const currency = String(formData.get("currency") ?? "USD");
  if (!contactId) throw new Error("A contact is required");

  const descriptions = formData.getAll("description") as string[];
  const quantities = formData.getAll("quantity") as string[];
  const unitPrices = formData.getAll("unitPrice") as string[];

  const lineItems: InvoiceLineItem[] = descriptions
    .map((description, i) => ({
      description: description.trim(),
      quantity: Number(quantities[i] ?? 0),
      unitPrice: Number(unitPrices[i] ?? 0),
    }))
    .filter((li) => li.description && li.quantity > 0 && li.unitPrice >= 0);

  if (lineItems.length === 0) throw new Error("At least one line item is required");

  const dueDateInput = String(formData.get("dueDate") ?? "");
  const dueDate = dueDateInput ? new Date(dueDateInput) : null;

  const invoice = await createInvoice(orgId, { contactId, lineItems, currency, dueDate });
  redirect(`/invoices/${invoice.id}`);
}

export async function sendInvoiceWhatsappAction(invoiceId: string) {
  const orgId = await requireOrgId();

  const invoice = await getInvoice(orgId, invoiceId);
  if (!invoice) throw new Error("Invoice not found");

  const contact = await getContact(orgId, invoice.contactId);
  if (!contact) throw new Error("Contact not found");

  const withinWindow = await isWithinServiceWindow(orgId, contact.id);
  if (!withinWindow) {
    throw new Error(
      "Outside the 24h service window — WhatsApp requires a pre-approved template for this send, which isn't wired up yet.",
    );
  }

  const body = [
    `Invoice ${invoice.number}`,
    `Amount due: ${formatCents(invoice.totalCents, invoice.currency)}`,
    invoice.dueDate ? `Due: ${invoice.dueDate.toLocaleDateString()}` : null,
    invoicePublicUrl(invoice),
  ]
    .filter(Boolean)
    .join("\n");

  const message = await sendWhatsappMessage(contact.phone, body);
  await recordMessage({
    orgId,
    contactId: contact.id,
    direction: "outbound",
    body,
    twilioSid: message.sid,
    status: "sent",
  });

  if (invoice.status === "draft") {
    await setInvoiceStatus(orgId, invoiceId, "sent");
  }

  revalidatePath(`/invoices/${invoiceId}`);
}
