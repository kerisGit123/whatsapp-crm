import Link from "next/link";
import { notFound } from "next/navigation";
import { getRole, requireOrgId } from "@/lib/auth";
import { loadStockData } from "@/lib/db/stock";
import { loadRequest } from "@/lib/db/stock-orders";
import { shortUnits, unresolvedShort } from "@/lib/stock/requests";
import { REQUEST_STATUSES } from "@/lib/stock/types";
import { Badge } from "@/components/ui/badge";
import { RequestActions } from "@/components/stock/request-actions";

export const dynamic = "force-dynamic";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await requireOrgId();
  const role = await getRole();
  const request = await loadRequest(orgId, id);
  if (!request) notFound();
  const { items } = await loadStockData(orgId);
  const byId = new Map(items.map((i) => [i.id, i]));

  const lines = request.lines.map((l) => ({
    itemId: l.itemId,
    name: byId.get(l.itemId)?.name ?? "Removed item",
    unit: byId.get(l.itemId)?.unit ?? "",
    requested: l.requestedUnits,
    issued: l.issuedUnits ?? null,
    received: l.receivedUnits ?? null,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/stock/requests" className="text-sm text-muted-foreground hover:underline">
          ← Requests
        </Link>
        <h1 className="mr-auto text-xl font-semibold">
          {request.number} · {request.branch}
        </h1>
        <Badge variant="secondary">{REQUEST_STATUSES.find((s) => s.value === request.status)?.label ?? request.status}</Badge>
      </div>
      <div className="text-sm text-muted-foreground">
        Asked {request.date}
        {request.requestedBy ? ` by ${request.requestedBy}` : ""}
        {request.issuedOn ? ` · issued ${request.issuedOn}${request.issuedBy ? ` by ${request.issuedBy}` : ""}` : ""}
        {request.receivedOn ? ` · received ${request.receivedOn}${request.receivedBy ? ` by ${request.receivedBy}` : ""}` : ""}
      </div>

      <ul className="divide-y rounded-lg border">
        {request.lines.map((l) => {
          const short = shortUnits(l);
          return (
            <li key={l.itemId} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{byId.get(l.itemId)?.name ?? "Removed item"}</div>
                <div className="text-xs text-muted-foreground">
                  Asked {l.requestedUnits}
                  {l.issuedUnits !== undefined ? ` · issued ${l.issuedUnits}` : ""}
                  {l.receivedUnits !== undefined ? ` · arrived ${l.receivedUnits}` : ""}
                </div>
              </div>
              {short > 0 ? (
                <div className="text-right text-sm text-red-700">
                  {short} short
                  {l.resolved ? <div className="text-xs">{l.resolved === "RETURNED" ? "put back in stock" : "written off"}</div> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {request.notes ? <p className="text-sm text-muted-foreground">{request.notes}</p> : null}

      <a href={`/api/stock/export?kind=request&request=${request.id}`} className="inline-block text-sm underline">
        Delivery note / picking list (Excel)
      </a>

      <RequestActions id={request.id} status={request.status} lines={lines} isManager={role === "manager"} hasShort={unresolvedShort(request).length > 0} />
    </div>
  );
}
