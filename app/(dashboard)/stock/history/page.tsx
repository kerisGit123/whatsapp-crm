import Link from "next/link";
import { getRole, requireOrgId } from "@/lib/auth";
import { loadStockData } from "@/lib/db/stock";
import { isIn, movementType, wasteReasonLabel } from "@/lib/stock/types";
import { cn } from "@/lib/utils";
import { RemoveMovement } from "@/components/stock/remove-movement";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const orgId = await requireOrgId();
  const role = await getRole();
  const { items, movements } = await loadStockData(orgId);
  const byId = new Map(items.map((i) => [i.id, i]));
  const recent = [...movements].reverse().slice(0, 300);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/stock" className="text-sm text-muted-foreground hover:underline">
          ← Stock
        </Link>
        <h1 className="text-xl font-semibold">History</h1>
        <span className="text-sm text-muted-foreground">latest {recent.length}</span>
      </div>
      {recent.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {recent.map((m) => {
            const item = byId.get(m.itemId);
            const incoming = isIn(m.type);
            return (
              <li key={m.id} className="flex items-start gap-3 p-3">
                <div className="w-20 shrink-0 text-xs text-muted-foreground">{m.date}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item?.name ?? "Removed item"}</div>
                  <div className="text-xs text-muted-foreground">
                    {[movementType(m.type)?.label, m.reason ? wasteReasonLabel(m.reason) : "", m.party, m.reference, m.recordedBy].filter(Boolean).join(" · ")}
                  </div>
                  {role === "manager" ? <RemoveMovement id={m.id} /> : null}
                </div>
                <div className={cn("shrink-0 font-medium", incoming ? "text-green-700" : "text-red-700")}>
                  {incoming ? "+" : "-"}
                  {m.quantity} {item?.unit}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
