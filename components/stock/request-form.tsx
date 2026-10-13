"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { saveRequestAction } from "@/app/(dashboard)/stock/requests/actions";
import { cartonsAndUnits, type StockItem } from "@/lib/stock/rules";
import { cn } from "@/lib/utils";

type Line = { itemId: string; units: string };

/** A branch asks the warehouse for stock. Quantities are in units. */
export function RequestForm({ items, balances, initial, requestId, branch: initialBranch, notes: initialNotes }: { items: StockItem[]; balances: Record<string, number>; initial: Line[]; requestId?: string; branch?: string; notes?: string }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(initial);
  const [branch, setBranch] = useState(initialBranch ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [key] = useState(() => `req-${crypto.randomUUID()}`);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return items.filter((i) => i.status !== "DISCONTINUED" && !lines.some((l) => l.itemId === i.id)).filter((i) => `${i.name} ${i.code} ${i.specification}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [query, items, lines]);

  const field = "h-11 w-full rounded-lg border bg-background px-3 text-base";

  const save = () =>
    start(async () => {
      const r = await saveRequestAction({ id: requestId, branch, notes, requestId: key, lines: lines.map((l) => ({ itemId: l.itemId, units: l.units })) });
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) router.push(r.id ? `/stock/requests/${r.id}` : "/stock/requests");
    });

  return (
    <div className="space-y-4">
      <label className="block text-xs text-muted-foreground">
        Which branch is asking?
        <input value={branch} onChange={(e) => setBranch(e.target.value)} className={field} />
      </label>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 size-5 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a product to add" className={cn(field, "pl-10")} />
        {matches.length > 0 ? (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-background shadow-lg">
            {matches.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => {
                    setLines((p) => [...p, { itemId: i.id, units: "" }]);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-muted"
                >
                  <span className="min-w-0 truncate">{i.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">in warehouse {cartonsAndUnits(balances[i.id] ?? 0, i)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Search a product above, then enter how many the branch needs.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {lines.map((l, index) => {
            const item = byId.get(l.itemId);
            if (!item) return null;
            return (
              <li key={l.itemId} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    In warehouse {cartonsAndUnits(balances[item.id] ?? 0, item)} · 1 ctn = {item.unitsPerCarton} {item.unit || "units"}
                  </div>
                </div>
                <div className="w-24">
                  <input value={l.units} onChange={(e) => setLines((p) => p.map((x, i) => (i === index ? { ...x, units: e.target.value } : x)))} inputMode="decimal" className="h-11 w-full rounded-lg border bg-background px-2 text-right text-base" aria-label={`Units of ${item.name}`} />
                  <div className="text-right text-xs text-muted-foreground">{item.unit || "units"}</div>
                </div>
                <button type="button" onClick={() => setLines((p) => p.filter((_, i) => i !== index))} aria-label="Remove" className="p-1 text-muted-foreground">
                  <X className="size-5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <label className="block text-xs text-muted-foreground">
        Note (optional)
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
      </label>
      {msg ? <p className={cn("rounded-lg p-3 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}
      <button type="button" onClick={save} disabled={pending || lines.length === 0} className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground disabled:opacity-50">
        {pending ? "Saving..." : requestId ? "Save changes" : "Send request"}
      </button>
    </div>
  );
}
