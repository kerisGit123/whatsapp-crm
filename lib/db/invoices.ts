import { and, desc, eq, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, type Invoice, type InvoiceLineItem } from "@/lib/db/schema";

export async function listInvoices(orgId: string): Promise<Invoice[]> {
  return db
    .select()
    .from(invoices)
    .where(eq(invoices.orgId, orgId))
    .orderBy(desc(invoices.createdAt));
}

export async function getInvoice(orgId: string, invoiceId: string): Promise<Invoice | undefined> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)));
  return row;
}

/** Sequential per-org invoice number, e.g. INV-0001. Not race-proof under
 *  concurrent creates — acceptable for v1's expected usage volume. */
export async function nextInvoiceNumber(orgId: string): Promise<string> {
  const [row] = await db
    .select({ n: count() })
    .from(invoices)
    .where(eq(invoices.orgId, orgId));
  return `INV-${String((row?.n ?? 0) + 1).padStart(4, "0")}`;
}

export function computeTotalCents(lineItems: InvoiceLineItem[]): number {
  return lineItems.reduce((sum, li) => sum + Math.round(li.quantity * li.unitPrice * 100), 0);
}

export async function createInvoice(
  orgId: string,
  input: {
    contactId: string;
    lineItems: InvoiceLineItem[];
    currency: string;
    dueDate?: Date | null;
  },
): Promise<Invoice> {
  const number = await nextInvoiceNumber(orgId);
  const [row] = await db
    .insert(invoices)
    .values({
      orgId,
      contactId: input.contactId,
      number,
      lineItems: input.lineItems,
      currency: input.currency,
      totalCents: computeTotalCents(input.lineItems),
      status: "draft",
      dueDate: input.dueDate ?? null,
    })
    .returning();
  return row;
}

export async function setInvoiceStatus(
  orgId: string,
  invoiceId: string,
  status: string,
): Promise<void> {
  await db
    .update(invoices)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)));
}
