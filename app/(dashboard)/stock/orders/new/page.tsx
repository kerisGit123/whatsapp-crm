import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole, requireOrgId } from "@/lib/auth";
import { loadStockData, todayIso } from "@/lib/db/stock";
import { loadOrders } from "@/lib/db/stock-orders";
import { orderFormItems } from "@/lib/stock/order-items";
import { OrderForm } from "@/components/stock/order-form";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const orgId = await requireOrgId();
  if ((await getRole()) !== "manager") redirect("/stock/orders");
  const [{ items, byItem, movements, rule }, orders] = await Promise.all([loadStockData(orgId), loadOrders(orgId)]);
  const { list, suggested } = orderFormItems(items, byItem, movements, orders, rule, todayIso());

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/stock/orders" className="text-sm text-muted-foreground hover:underline">
          ← Orders
        </Link>
        <h1 className="text-xl font-semibold">New order</h1>
      </div>
      <OrderForm items={list} initial={suggested} />
    </div>
  );
}
