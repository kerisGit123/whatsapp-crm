import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole, requireOrgId } from "@/lib/auth";
import { loadStockData, todayIso } from "@/lib/db/stock";
import { monthEndRows } from "@/lib/stock/rules";
import { wasteReasonLabel } from "@/lib/stock/types";
import { MonthLock } from "@/components/stock/month-lock";

export const dynamic = "force-dynamic";

const rm = (n: number) => n.toLocaleString("en-MY", { maximumFractionDigits: 0 });

/** Each month's stock value: opening, bought, used, wasted, closing (managers only: it shows values). */
export default async function MonthEndPage() {
  const orgId = await requireOrgId();
  if ((await getRole()) !== "manager") redirect("/stock");
  const today = todayIso();
  const { items, byItem, lockedThrough } = await loadStockData(orgId);
  const thisMonth = today.slice(0, 7);
  const rows = monthEndRows(items, byItem, thisMonth);
  const finished = rows.filter((r) => r.month < thisMonth);
  const lockedMonth = lockedThrough ? lockedThrough.slice(0, 7) : "";
  const nextToClose = finished.find((r) => r.month > lockedMonth)?.month ?? null;
  const latest = [...rows].reverse().find((r) => Object.keys(r.reasons).length > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link href="/stock" className="text-sm text-muted-foreground hover:underline">
          ← Stock
        </Link>
        <h1 className="text-xl font-semibold">Month end</h1>
      </div>
      <p className="text-sm text-muted-foreground">Values use each item&apos;s average price paid (or the list price). RM.</p>

      <MonthLock nextToClose={nextToClose} lockedThrough={lockedThrough} />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-right text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Month</th>
                <th className="px-3 py-2 font-medium">Opening</th>
                <th className="px-3 py-2 font-medium">Bought</th>
                <th className="px-3 py-2 font-medium">Used</th>
                <th className="px-3 py-2 font-medium">Wasted</th>
                <th className="px-3 py-2 font-medium">Other</th>
                <th className="px-3 py-2 font-medium">Closing</th>
                <th className="px-3 py-2 font-medium">Counted</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.month} className="border-t text-right">
                  <td className="px-3 py-2 text-left font-medium">
                    {r.month}
                    {lockedMonth && r.month <= lockedMonth ? <span className="ml-2 text-xs text-muted-foreground">closed</span> : null}
                  </td>
                  <td className="px-3 py-2">{rm(r.openingValue)}</td>
                  <td className="px-3 py-2">{rm(r.purchasedValue)}</td>
                  <td className="px-3 py-2">{rm(r.usedValue)}</td>
                  <td className="px-3 py-2">{rm(r.wasteValue)}</td>
                  <td className="px-3 py-2">{rm(r.otherOutValue - r.otherInValue)}</td>
                  <td className="px-3 py-2 font-medium">{rm(r.closingValue)}</td>
                  <td className="px-3 py-2">{r.counted ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {latest ? (
        <div className="rounded-lg border p-3">
          <div className="mb-2 text-sm font-medium">Where the loss went in {latest.month}</div>
          <ul className="space-y-1 text-sm">
            {Object.entries(latest.reasons)
              .sort(([, a], [, b]) => b - a)
              .map(([reason, value]) => (
                <li key={reason} className="flex justify-between">
                  <span>{reason === "COUNT" ? "Count short" : wasteReasonLabel(reason) || reason}</span>
                  <span>RM {rm(value)}</span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
