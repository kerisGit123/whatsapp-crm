"use server";

import { redirect } from "next/navigation";
import { requireOrgId } from "@/lib/auth";
import { createInvoice } from "@/lib/db/invoices";
import type { InvoiceLineItem } from "@/lib/db/schema";

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

  const invoice = await createInvoice(orgId, { contactId, lineItems, currency });
  redirect(`/invoices/${invoice.id}`);
}
