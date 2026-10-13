import Link from "next/link";
import { Download } from "lucide-react";
import { getRole, requireOrgId } from "@/lib/auth";
import { todayIso } from "@/lib/db/stock";
import { ImportForm } from "@/components/stock/import-form";

export const dynamic = "force-dynamic";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export default async function ExcelPage() {
  await requireOrgId();
  const role = await getRole();
  const today = todayIso();
  const month = today.slice(0, 7);

  const downloads = [
    { label: "Stock in hand", href: "/api/stock/export?kind=hand" },
    { label: "Blank count sheet for a stock take", href: "/api/stock/export?kind=count" },
    { label: `This month's sheet (${month})`, href: `/api/stock/export?kind=month&month=${month}` },
    { label: "In / out, last 30 days", href: `/api/stock/export?kind=history&from=${daysAgo(30)}&to=${today}` },
    { label: "Stock lent to branches", href: "/api/stock/export?kind=borrowed" },
    ...(role === "manager"
      ? [
          { label: "Order plan (what to re-order)", href: "/api/stock/export?kind=order" },
          { label: "Month-end values", href: "/api/stock/export?kind=monthend" },
          { label: `Opening and closing ${today.slice(0, 4)}`, href: `/api/stock/export?kind=year&year=${today.slice(0, 4)}` },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link href="/stock" className="text-sm text-muted-foreground hover:underline">
          ← Stock
        </Link>
        <h1 className="text-xl font-semibold">Excel</h1>
      </div>

      <section>
        <h2 className="mb-2 font-medium">Download</h2>
        <ul className="divide-y rounded-lg border">
          {downloads.map((d) => (
            <li key={d.href}>
              <a href={d.href} className="flex items-center justify-between gap-2 px-3 py-3 text-sm hover:bg-muted/40">
                {d.label} <Download className="size-4 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      {role === "manager" ? (
        <section>
          <h2 className="mb-1 font-medium">Import products and starting stock</h2>
          <p className="mb-2 text-sm text-muted-foreground">Use your monthly sheet (订货单) or a file you downloaded here. Products are matched by item code. Products that already have records keep their stock.</p>
          <ImportForm />
        </section>
      ) : null}
    </div>
  );
}
