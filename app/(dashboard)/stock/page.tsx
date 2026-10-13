import Link from "next/link";
import { Plus, ClipboardCheck, Zap, History, SlidersHorizontal, Truck, Store } from "lucide-react";
import { getRole, requireOrgId } from "@/lib/auth";
import { loadStockData, todayIso } from "@/lib/db/stock";
import { loadOrders } from "@/lib/db/stock-orders";
import { onOrderUnits, orderAttention } from "@/lib/stock/orders";
import { cartonsAndUnits, expiryState, stockStatus, type StockFlag } from "@/lib/stock/rules";
import { stockGroupLabel } from "@/lib/stock/types";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FLAGS: Record<StockFlag, { label: string; className: string }> = {
  ORDER: { label: "Order now", className: "bg-red-100 text-red-800" },
  ON_ORDER: { label: "On order", className: "bg-blue-100 text-blue-800" },
  LOW: { label: "Getting low", className: "bg-amber-100 text-amber-800" },
  OK: { label: "OK", className: "bg-green-100 text-green-800" },
  NO_USE: { label: "Not used", className: "bg-gray-100 text-gray-700" },
  EMPTY: { label: "Empty", className: "bg-gray-100 text-gray-700" },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "ORDER", label: "Order now" },
  { value: "LOW", label: "Getting low" },
  { value: "EXPIRY", label: "Expiring" },
];

export default async function StockPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const { q = "", show = "all" } = await searchParams;
  const orgId = await requireOrgId();
  const role = await getRole();
  const today = todayIso();
  const [{ items, byItem, movements, rule }, orders] = await Promise.all([loadStockData(orgId), loadOrders(orgId)]);
  const onOrder = onOrderUnits(orders, movements);
  const lateOrders = orders.filter((o) => orderAttention(o, movements, today, rule.leadDays ?? 0) !== null).length;

  const all = items
    .filter((i) => i.status !== "DISCONTINUED")
    .map((item) => stockStatus(item, byItem.get(item.id) ?? [], rule, today, onOrder.get(item.id) ?? 0));

  const needle = q.trim().toLowerCase();
  const rows = all
    .filter((s) => !needle || `${s.item.name} ${s.item.code} ${s.item.supplier}`.toLowerCase().includes(needle))
    .filter((s) => (show === "ORDER" ? s.flag === "ORDER" : show === "LOW" ? s.flag === "LOW" : show === "EXPIRY" ? expiryState(s.nearestExpiry, today, 30) !== null && expiryState(s.nearestExpiry, today, 30) !== "OK" : true));

  const toOrder = all.filter((s) => s.flag === "ORDER").length;
  const expiring = all.filter((s) => s.balance > 0 && ["EXPIRED", "SOON"].includes(expiryState(s.nearestExpiry, today, 30) ?? "")).length;
  const totalValue = all.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Stock</h1>
        <Link href="/stock/quick" className={cn(buttonVariants({ size: "lg" }))}>
          <Zap /> Quick entry
        </Link>
        <Link href="/stock/take" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          <ClipboardCheck /> Stock take
        </Link>
        <details className="relative">
          <summary className={cn(buttonVariants({ variant: "outline", size: "lg" }), "cursor-pointer list-none")}>More ▾</summary>
          <div className="absolute right-0 z-20 mt-1 flex w-52 flex-col overflow-hidden rounded-lg border bg-background py-1 shadow-lg">
            {[
              { href: "/stock/orders", label: "Orders to suppliers", icon: Truck, show: true },
              { href: "/stock/requests", label: "Branch requests", icon: Store, show: true },
              { href: "/stock/history", label: "History", icon: History, show: true },
              { href: "/stock/items/new", label: "Add item", icon: Plus, show: role === "manager" },
              { href: "/stock/rules", label: "Re-order rules", icon: SlidersHorizontal, show: role === "manager" },
            ]
              .filter((l) => l.show)
              .map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="flex items-center gap-2 px-3 py-3 text-sm hover:bg-muted">
                  <Icon className="size-4" /> {label}
                </Link>
              ))}
          </div>
        </details>
      </div>

      {lateOrders > 0 ? (
        <Link href="/stock/orders" className="mb-4 block rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {lateOrders} order{lateOrders === 1 ? " needs" : "s need"} a look: goods are late or only partly arrived.
        </Link>
      ) : null}

      <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg border p-3">
          <div className="text-muted-foreground">Items</div>
          <div className="text-lg font-semibold">{all.length}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-muted-foreground">To order</div>
          <div className={cn("text-lg font-semibold", toOrder > 0 && "text-red-700")}>{toOrder}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-muted-foreground">{role === "manager" ? "Stock value" : "Expiring soon"}</div>
          <div className="text-lg font-semibold">{role === "manager" ? `RM ${totalValue.toLocaleString("en-MY", { maximumFractionDigits: 0 })}` : expiring}</div>
        </div>
      </div>

      <form className="mb-3 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search product, code or supplier"
          className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm"
        />
        <input type="hidden" name="show" value={show} />
        <button className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>Search</button>
      </form>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/stock?show=${f.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn("rounded-full border px-3 py-1 text-sm", show === f.value ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {f.label}
            {f.value === "ORDER" && toOrder ? ` (${toOrder})` : ""}
            {f.value === "EXPIRY" && expiring ? ` (${expiring})` : ""}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No products yet.{" "}
          {role === "manager" ? (
            <Link href="/stock/items/new" className="text-primary underline">
              Add your first item
            </Link>
          ) : (
            "Ask a manager to add products."
          )}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Nothing matches.</div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((s) => {
            const exp = expiryState(s.nearestExpiry, today, 30);
            return (
              <li key={s.item.id}>
                <Link href={role === "manager" ? `/stock/items/${s.item.id}` : `/stock/quick?item=${s.item.id}`} className="flex items-center gap-3 p-3 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.item.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[s.item.code, s.item.specification, stockGroupLabel(s.item.group)].filter(Boolean).join(" · ")}
                    </div>
                    {exp && exp !== "OK" ? (
                      <div className={cn("text-xs", exp === "EXPIRED" ? "text-red-700" : "text-amber-700")}>
                        {exp === "EXPIRED" ? "Expired" : "Expires"} {s.nearestExpiry}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{cartonsAndUnits(s.balance, s.item)}</div>
                    <div className="text-xs text-muted-foreground">{s.monthsLeft !== null ? `${s.monthsLeft} mo left` : "no use yet"}</div>
                  </div>
                  <Badge className={cn("shrink-0", FLAGS[s.flag].className)}>{FLAGS[s.flag].label}</Badge>
                </Link>
                {s.flag === "ORDER" && s.suggestedCartons > 0 ? (
                  <div className="-mt-1 px-3 pb-2 text-xs text-muted-foreground">Suggested order: {s.suggestedCartons} ctn</div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
