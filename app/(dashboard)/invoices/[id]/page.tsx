import { notFound } from "next/navigation";
import { requireOrgId } from "@/lib/auth";
import { getInvoice } from "@/lib/db/invoices";
import { getContact } from "@/lib/db/contacts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await requireOrgId();
  const invoice = await getInvoice(orgId, id);
  if (!invoice) notFound();

  const contact = await getContact(orgId, invoice.contactId);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{invoice.number}</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.createdAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{invoice.status}</Badge>
          <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
            <Button variant="outline">
              <Download className="size-4" />
              PDF
            </Button>
          </a>
        </div>
      </div>

      <Card className="p-6">
        <div className="mb-6">
          <div className="text-xs uppercase text-muted-foreground">Bill to</div>
          <div className="font-medium">{contact?.name ?? "Unknown contact"}</div>
          <div className="text-sm text-muted-foreground">{contact?.phone}</div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[3fr_1fr_1fr_1fr] gap-2 border-b pb-2 text-xs font-medium text-muted-foreground">
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Price</span>
            <span className="text-right">Total</span>
          </div>
          {invoice.lineItems.map((li, i) => (
            <div key={i} className="grid grid-cols-[3fr_1fr_1fr_1fr] gap-2 py-1 text-sm">
              <span>{li.description}</span>
              <span className="text-right">{li.quantity}</span>
              <span className="text-right">
                {formatCents(li.unitPrice * 100, invoice.currency)}
              </span>
              <span className="text-right">
                {formatCents(li.quantity * li.unitPrice * 100, invoice.currency)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end border-t pt-4">
          <div className="text-right">
            <div className="text-xs uppercase text-muted-foreground">Total</div>
            <div className="text-lg font-semibold">
              {formatCents(invoice.totalCents, invoice.currency)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
