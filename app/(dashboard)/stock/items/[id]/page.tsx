import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole, requireOrgId } from "@/lib/auth";
import { loadItem, loadItemMovements } from "@/lib/db/stock";
import { balanceOf } from "@/lib/stock/rules";
import { ItemForm } from "@/components/stock/item-form";

export const dynamic = "force-dynamic";

/** /stock/items/new adds an item; /stock/items/<id> edits one (managers only). */
export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await requireOrgId();
  if ((await getRole()) !== "manager") redirect("/stock");

  const item = id === "new" ? null : await loadItem(orgId, id);
  if (id !== "new" && !item) notFound();
  const balance = item ? balanceOf(await loadItemMovements(orgId, item.id)) : 0;

  return (
    <div className="mx-auto max-w-xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/stock" className="text-sm text-muted-foreground hover:underline">
          ← Stock
        </Link>
        <h1 className="text-xl font-semibold">{item ? item.name : "Add item"}</h1>
      </div>
      <ItemForm item={item} balance={balance} />
    </div>
  );
}
