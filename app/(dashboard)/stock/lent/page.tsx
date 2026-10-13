import Link from "next/link";
import { requireOrgId } from "@/lib/auth";
import { loadStockData } from "@/lib/db/stock";
import { SettleBorrow } from "@/components/stock/settle-borrow";

export const dynamic = "force-dynamic";

/** Stock lent to other branches that has not been settled yet. */
export default async function LentPage() {
  const orgId = await requireOrgId();
  const { items, movements } = await loadStockData(orgId);
  const byId = new Map(items.map((i) => [i.id, i]));
  const open = movements.filter((m) => m.type === "BORROW" && (m.borrowStatus ?? "OUTSTANDING") === "OUTSTANDING").reverse();
  const others = items.filter((i) => i.status !== "DISCONTINUED").map((i) => ({ id: i.id, name: i.name }));

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/stock/requests" className="text-sm text-muted-foreground hover:underline">
          ← Requests
        </Link>
        <h1 className="text-xl font-semibold">Lent out</h1>
      </div>
      {open.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Nothing is lent out right now.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {open.map((m) => {
            const item = byId.get(m.itemId);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item?.name ?? "Removed item"}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.quantity} {item?.unit} to {m.party || "a branch"} on {m.date}
                  </div>
                </div>
                <SettleBorrow movementId={m.id} quantity={m.quantity} unit={item?.unit ?? ""} otherItems={others} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
