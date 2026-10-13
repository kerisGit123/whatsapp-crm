import Link from "next/link";
import { getRole, requireOrgId } from "@/lib/auth";
import { loadStockData } from "@/lib/db/stock";
import { balanceOf } from "@/lib/stock/rules";
import { TakeForm } from "@/components/stock/take-form";

export const dynamic = "force-dynamic";

export default async function TakePage() {
  const orgId = await requireOrgId();
  const role = await getRole();
  const loaded = await loadStockData(orgId);
  const { byItem } = loaded;
  const items = role === "manager" ? loaded.items : loaded.items.map((i) => ({ ...i, cartonPrice: 0, avgUnitCost: null }));
  const balances = Object.fromEntries(items.map((i) => [i.id, balanceOf(byItem.get(i.id) ?? [])]));

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/stock" className="text-sm text-muted-foreground hover:underline">
          ← Stock
        </Link>
        <h1 className="text-xl font-semibold">Stock take</h1>
      </div>
      <TakeForm items={items} balances={balances} />
    </div>
  );
}
