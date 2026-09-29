import Link from "next/link";
import { requireOrgId } from "@/lib/auth";
import { listInvoices } from "@/lib/db/invoices";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400",
  sent: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  void: "bg-red-500/10 text-red-600 dark:text-red-400",
};

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default async function InvoicesPage() {
  const orgId = await requireOrgId();
  const invoices = await listInvoices(orgId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
          </p>
        </div>
        <Link href="/invoices/new">
          <Button>New invoice</Button>
        </Link>
      </div>

      {invoices.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No invoices yet — create one for a contact.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
            >
              <div>
                <div className="font-medium leading-tight">{inv.number}</div>
                <div className="text-sm text-muted-foreground">
                  {inv.createdAt.toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium">{formatCents(inv.totalCents, inv.currency)}</span>
                <Badge className={STATUS_STYLE[inv.status] ?? STATUS_STYLE.draft}>
                  {inv.status}
                </Badge>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
