import { NextResponse } from "next/server";
import { getInvoiceByShareToken } from "@/lib/db/invoices";
import { getContact } from "@/lib/db/contacts";
import { renderInvoicePdfBuffer } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

/** Public, unauthenticated — this is the link sent over WhatsApp. Access
 *  control is the share token itself, not a session. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invoice = await getInvoiceByShareToken(token);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contact = await getContact(invoice.orgId, invoice.contactId);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderInvoicePdfBuffer(invoice, contact);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
    },
  });
}
