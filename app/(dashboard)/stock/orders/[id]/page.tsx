import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getRole, requireOrgId } from "@/lib/auth";
import { loadStockData } from "@/lib/db/stock";
import { loadOrder } from "@/lib/db/stock-orders";
import { orderProgress, orderTotal, orderWhatsappText } from "@/lib/stock/orders";
import { cartonsAndUnits, defaultExpiry } from "@/lib/stock/rules";
import { ORDER_STATUSES } from "@/lib/stock/types";
import { Badge } from "@/components/ui/badge";
import { OrderActions } from "@/components/stock/order-actions";
import { ReceiveForm } from "@/components/stock/receive-form";
import { todayIso } from "@/lib/db/stock";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await requireOrgId();
  const role = await getRole();
  const order = await loadOrder(orgId, id);
  if (!order) notFound();

  const { items, movements } = await loadStockData(orgId);
  const byId = new Map(items.map((i) => [i.id, i]));
  const progress = orderProgress(order, movements);
  const { orgId: activeOrg } = await auth();
  const company = activeOrg ? (await (await clerkClient()).organizations.getOrganization({ organizationId: activeOrg })).name : "";
  const whatsappText = orderWhatsappText(order, byId, company);
  const canReceive = order.status === "SENT" || order.status === "PARTLY_RECEIVED";
  const today = todayIso();

  const receiveLines = progress.lines
    .filter((l) => l.outstanding > 0)
    .map((l) => {
      const item = byId.get(l.itemId);
      return {
        itemId: l.itemId,
        name: item?.name ?? "Item",
        unit: item?.unit ?? "",
        unitsPerCarton: item?.unitsPerCarton ?? 1,
        outstanding: l.outstanding,
        cartonPrice: l.cartonPrice,
        expiryHint: item ? defaultExpiry(item, today) : "",
      };
    });

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/stock/orders" className="text-sm text-muted-foreground hover:underline">
          ← Orders
        </Link>
        <h1 className="mr-auto text-xl font-semibold">
          {order.number} · {order.supplier}
        </h1>
        <Badge variant="secondary">{ORDER_STATUSES.find((s) => s.value === order.status)?.label ?? order.status}</Badge>
      </div>
      <div className="text-sm text-muted-foreground">
        Ordered {order.date}
        {order.supplierRef ? ` · supplier PO ${order.supplierRef}` : ""}
        {role === "manager" ? ` · RM ${orderTotal(order, (itemId) => byId.get(itemId)?.unitsPerCarton ?? 1).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
      </div>

      <ul className="divide-y rounded-lg border">
        {progress.lines.map((l) => {
          const item = byId.get(l.itemId);
          return (
            <li key={l.itemId} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{item?.name ?? "Removed item"}</div>
                <div className="text-xs text-muted-foreground">
                  Ordered {item ? cartonsAndUnits(l.orderedUnits, item) : l.orderedUnits}
                  {l.closed ? " · rest not coming" : ""}
                </div>
              </div>
              <div className="text-right text-sm">
                <div>{l.received > 0 ? `${l.received} arrived` : "nothing yet"}</div>
                {l.outstanding > 0 && order.status !== "DRAFT" ? <div className="text-xs text-amber-700">{l.outstanding} to come</div> : null}
              </div>
            </li>
          );
        })}
      </ul>
      {order.notes ? <p className="text-sm text-muted-foreground">{order.notes}</p> : null}

      {role === "manager" ? (
        <OrderActions orderId={order.id} status={order.status} phone={order.supplierPhone} whatsappText={whatsappText} hasReceived={progress.received > 0} />
      ) : null}
      {canReceive && receiveLines.length > 0 ? <ReceiveForm orderId={order.id} lines={receiveLines} showPrices={role === "manager"} /> : null}
    </div>
  );
}
