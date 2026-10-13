import Link from "next/link";
import { getRole, requireOrgId } from "@/lib/auth";
import { loadStockData } from "@/lib/db/stock";
import { balanceOf } from "@/lib/stock/rules";
import { RequestForm } from "@/components/stock/request-form";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const orgId = await requireOrgId();
  const role = await getRole();
  const loaded = await loadStockData(orgId);
  const { byItem } = loaded;
  const items = role === "manager" ? loaded.items : loaded.items.map((i) => ({ ...i, cartonPrice: 0, avgUnitCost: null }));
  const balances = Object.fromEntries(items.map((i) => [i.id, balanceOf(byItem.get(i.id) ?? [])]));

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/stock/requests" className="text-sm text-muted-foreground hover:underline">
          ← Requests
        </Link>
        <h1 className="text-xl font-semibold">New branch request</h1>
      </div>
      <RequestForm items={items} balances={balances} initial={[]} />
    </div>
  );
}
