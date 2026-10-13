import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole, requireOrgId } from "@/lib/auth";
import { getSettings } from "@/lib/db/stock";
import { RulesForm } from "@/components/stock/rules-form";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const orgId = await requireOrgId();
  if ((await getRole()) !== "manager") redirect("/stock");
  const { rule } = await getSettings(orgId);

  return (
    <div className="mx-auto max-w-xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/stock" className="text-sm text-muted-foreground hover:underline">
          ← Stock
        </Link>
        <h1 className="text-xl font-semibold">Re-order rules</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        These decide the &quot;Order now&quot; flag and the suggested order. One item can have its own months on its edit page.
      </p>
      <RulesForm reorderBelow={rule.reorderBelow} orderUpTo={rule.orderUpTo} leadDays={rule.leadDays ?? 0} />
    </div>
  );
}
