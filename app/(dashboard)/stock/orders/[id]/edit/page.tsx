import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole, requireOrgId } from "@/lib/auth";
import { loadStockData, todayIso } from "@/lib/db/stock";
import { loadOrder, loadOrders } from "@/lib/db/stock-orders";
import { orderFormItems } from "@/lib/stock/order-items";
import { OrderForm } from "@/components/stock/order-form";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await requireOrgId();
  if ((await getRole()) !== "manager") redirect("/stock/orders");
  const order = await loadOrder(orgId, id);
  if (!order) notFound();
  if (order.status !== "DRAFT") redirect(`/stock/orders/${id}`);

  const [{ items, byItem, movements, rule }, orders] = await Promise.all([loadStockData(orgId), loadOrders(orgId)]);
  const { list } = orderFormItems(items, byItem, movements, orders, rule, todayIso());
  const initial = order.lines.map((l) => {
    const per = items.find((i) => i.id === l.itemId)?.unitsPerCarton || 1;
    return { itemId: l.itemId, cartons: String(Math.round((l.orderedUnits / per) * 100) / 100) };
  });

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/stock/orders/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← {order.number}
        </Link>
        <h1 className="text-xl font-semibold">Edit order</h1>
      </div>
      <OrderForm items={list} initial={initial} orderId={id} date={order.date} notes={order.notes} />
    </div>
  );
}
