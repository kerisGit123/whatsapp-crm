import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth";
import { getInvoice } from "@/lib/db/invoices";
import { getContact } from "@/lib/db/contacts";
import { renderInvoicePdfBuffer } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await requireManager();

  const invoice = await getInvoice(orgId, id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contact = await getContact(orgId, invoice.contactId);
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const buffer = await renderInvoicePdfBuffer(invoice, contact);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
    },
  });
}
