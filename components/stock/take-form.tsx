"use client";

import { useMemo, useState, useTransition } from "react";
import { stockTakeAction } from "@/app/(dashboard)/stock/actions";
import { cartonsAndUnits, type StockItem } from "@/lib/stock/rules";
import { cn } from "@/lib/utils";

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Count the shelf: type what you counted in units; blank = not counted. */
export function TakeForm({ items, balances }: { items: StockItem[]; balances: Record<string, number> }) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [date, setDate] = useState(todayLocal());
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [requestId, setRequestId] = useState(() => `t-${crypto.randomUUID()}`);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((i) => i.status !== "DISCONTINUED").filter((i) => !needle || `${i.name} ${i.code}`.toLowerCase().includes(needle));
  }, [items, query]);

  const filled = Object.entries(counts).filter(([, v]) => v !== "");
  const differences = filled.filter(([id, v]) => Math.round((Number(v) - (balances[id] ?? 0)) * 100) !== 0).length;

  const save = () => {
    setMsg(null);
    start(async () => {
      const result = await stockTakeAction({
        date,
        requestId,
        counts: filled.map(([itemId, counted]) => ({ itemId, counted })),
      });
      setMsg({ ok: result.ok, text: result.message });
      if (result.ok) {
        setCounts({});
        setRequestId(`t-${crypto.randomUUID()}`);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a product" className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-base" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-lg border bg-background px-3 text-base" />
      </div>
      <p className="text-sm text-muted-foreground">Type what you counted in units. Leave blank what you did not count.</p>
      <ul className="divide-y rounded-lg border">
        {shown.map((i) => {
          const expected = balances[i.id] ?? 0;
          const value = counts[i.id] ?? "";
          const diff = value === "" ? null : Math.round((Number(value) - expected) * 100) / 100;
          return (
            <li key={i.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{i.name}</div>
                <div className="text-xs text-muted-foreground">
                  System: {expected} {i.unit || "units"} ({cartonsAndUnits(expected, i)})
                </div>
              </div>
              <div className="w-28">
                <input
                  value={value}
                  onChange={(e) => setCounts((prev) => ({ ...prev, [i.id]: e.target.value }))}
                  inputMode="decimal"
                  placeholder="Counted"
                  className="h-11 w-full rounded-lg border bg-background px-3 text-right text-base"
                />
                {diff !== null && diff !== 0 ? (
                  <div className={cn("mt-0.5 text-right text-xs", diff > 0 ? "text-green-700" : "text-red-700")}>{diff > 0 ? `+${diff}` : diff}</div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {msg ? <p className={cn("rounded-lg p-3 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}
      <button
        type="button"
        onClick={save}
        disabled={pending || filled.length === 0}
        className="sticky bottom-3 h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground shadow disabled:opacity-50"
      >
        {pending ? "Saving..." : `Save count (${filled.length} counted, ${differences} differ)`}
      </button>
    </div>
  );
}
