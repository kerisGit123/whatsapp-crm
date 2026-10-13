import Link from "next/link";
import { Plus } from "lucide-react";
import { getRole, requireOrgId } from "@/lib/auth";
import { getSettings, loadStockData, todayIso } from "@/lib/db/stock";
import { loadOrders } from "@/lib/db/stock-orders";
import { orderAttention, orderProgress, orderTotal } from "@/lib/stock/orders";
import { ORDER_STATUSES } from "@/lib/stock/types";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-800",
  PARTLY_RECEIVED: "bg-amber-100 text-amber-800",
  RECEIVED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default async function OrdersPage() {
  const orgId = await requireOrgId();
  const role = await getRole();
  const today = todayIso();
  const [orders, { items, movements }, { rule }] = await Promise.all([loadOrders(orgId), loadStockData(orgId), getSettings(orgId)]);
  const perCarton = (id: string) => items.find((i) => i.id === id)?.unitsPerCarton ?? 1;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/stock" className="text-sm text-muted-foreground hover:underline">
          ← Stock
        </Link>
        <h1 className="mr-auto text-xl font-semibold">Orders to suppliers</h1>
        {role === "manager" ? (
          <Link href="/stock/orders/new" className={cn(buttonVariants({ size: "lg" }))}>
            <Plus /> New order
          </Link>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No orders yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {orders.map((o) => {
            const attention = orderAttention(o, movements, today, rule.leadDays ?? 0);
            const progress = orderProgress(o, movements);
            return (
              <li key={o.id}>
                <Link href={`/stock/orders/${o.id}`} className="flex items-center gap-3 p-3 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {o.number} · {o.supplier}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.date} · {o.lines.length} item{o.lines.length === 1 ? "" : "s"}
                      {role === "manager" ? ` · RM ${orderTotal(o, perCarton).toLocaleString("en-MY", { maximumFractionDigits: 0 })}` : ""}
                      {progress.outstanding > 0 && o.status !== "DRAFT" && o.status !== "CANCELLED" ? ` · still to come: ${progress.outstanding} units` : ""}
                    </div>
                    {attention ? (
                      <div className="text-xs font-medium text-amber-700">
                        {attention === "LATE" ? "Sent, nothing has arrived yet: chase the supplier" : "Part of the goods are still to come"}
                      </div>
                    ) : null}
                  </div>
                  <Badge className={cn("shrink-0", COLORS[o.status])}>{ORDER_STATUSES.find((s) => s.value === o.status)?.label ?? o.status}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
