import Link from "next/link";
import { getRole, requireOrgId } from "@/lib/auth";
import { loadStockData } from "@/lib/db/stock";
import { balanceOf } from "@/lib/stock/rules";
import { QuickForm } from "@/components/stock/quick-form";

export const dynamic = "force-dynamic";

const KINDS = ["TAKE", "WASTE", "PURCHASE", "BORROW"] as const;

export default async function QuickPage({ searchParams }: { searchParams: Promise<{ type?: string; item?: string }> }) {
  const { type, item } = await searchParams;
  const orgId = await requireOrgId();
  const role = await getRole();
  const loaded = await loadStockData(orgId);
  const { byItem } = loaded;
  // Staff never receive prices.
  const items = role === "manager" ? loaded.items : loaded.items.map((i) => ({ ...i, cartonPrice: 0, avgUnitCost: null }));
  const balances = Object.fromEntries(items.map((i) => [i.id, balanceOf(byItem.get(i.id) ?? [])]));
  const kind = KINDS.find((k) => k === type) ?? "TAKE";

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/stock" className="text-sm text-muted-foreground hover:underline">
          ← Stock
        </Link>
        <h1 className="text-xl font-semibold">Quick entry</h1>
      </div>
      <QuickForm items={items} balances={balances} initialKind={kind} initialItem={item} showPrices={role === "manager"} />
    </div>
  );
}
