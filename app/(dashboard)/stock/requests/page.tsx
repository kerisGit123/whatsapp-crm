import Link from "next/link";
import { Plus } from "lucide-react";
import { requireOrgId } from "@/lib/auth";
import { loadRequests } from "@/lib/db/stock-orders";
import { REQUEST_STATUSES } from "@/lib/stock/types";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const COLORS: Record<string, string> = {
  REQUESTED: "bg-blue-100 text-blue-800",
  ISSUED: "bg-amber-100 text-amber-800",
  RECEIVED: "bg-green-100 text-green-800",
  SHORT: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-700",
};

export default async function RequestsPage() {
  const orgId = await requireOrgId();
  const requests = await loadRequests(orgId);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/stock" className="text-sm text-muted-foreground hover:underline">
          ← Stock
        </Link>
        <h1 className="mr-auto text-xl font-semibold">Branch requests</h1>
        <Link href="/stock/lent" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Lent out
        </Link>
        <Link href="/stock/requests/new" className={cn(buttonVariants({ size: "lg" }))}>
          <Plus /> New request
        </Link>
      </div>
      {requests.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No requests yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {requests.map((r) => (
            <li key={r.id}>
              <Link href={`/stock/requests/${r.id}`} className="flex items-center gap-3 p-3 hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {r.number} · {r.branch}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.date} · {r.lines.length} item{r.lines.length === 1 ? "" : "s"}
                    {r.requestedBy ? ` · ${r.requestedBy}` : ""}
                  </div>
                </div>
                <Badge className={cn("shrink-0", COLORS[r.status])}>{REQUEST_STATUSES.find((s) => s.value === r.status)?.label ?? r.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
