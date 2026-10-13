import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrgId } from "@/lib/auth";
import { loadStockData } from "@/lib/db/stock";
import { loadRequest } from "@/lib/db/stock-orders";
import { balanceOf } from "@/lib/stock/rules";
import { RequestForm } from "@/components/stock/request-form";

export const dynamic = "force-dynamic";

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await requireOrgId();
  const request = await loadRequest(orgId, id);
  if (!request) notFound();
  if (request.status !== "REQUESTED") redirect(`/stock/requests/${id}`);
  const { items, byItem } = await loadStockData(orgId);
  const balances = Object.fromEntries(items.map((i) => [i.id, balanceOf(byItem.get(i.id) ?? [])]));

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/stock/requests/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← {request.number}
        </Link>
        <h1 className="text-xl font-semibold">Edit request</h1>
      </div>
      <RequestForm items={items} balances={balances} initial={request.lines.map((l) => ({ itemId: l.itemId, units: String(l.requestedUnits) }))} requestId={id} branch={request.branch} notes={request.notes} />
    </div>
  );
}
