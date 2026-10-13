"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { saveOrderAction } from "@/app/(dashboard)/stock/orders/actions";
import { cn } from "@/lib/utils";

export type OrderItem = {
  id: string;
  name: string;
  specification: string;
  supplier: string;
  cartonPrice: number;
  unitsPerCarton: number;
  unit: string;
  onHandText: string;
  suggested: number; // cartons the rules suggest
  priceChangePct: number | null; // list price vs the last delivery
};

type Line = { itemId: string; cartons: string };

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function OrderForm({ items, initial, orderId, date: initialDate, notes: initialNotes }: { items: OrderItem[]; initial: Line[]; orderId?: string; date?: string; notes?: string }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(initial);
  const [date, setDate] = useState(initialDate ?? todayLocal());
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [requestId] = useState(() => `o-${crypto.randomUUID()}`);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return items.filter((i) => !lines.some((l) => l.itemId === i.id)).filter((i) => `${i.name} ${i.specification} ${i.supplier}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [query, items, lines]);

  const total = lines.reduce((sum, l) => sum + (Number(l.cartons) || 0) * (byId.get(l.itemId)?.cartonPrice ?? 0), 0);
  const suppliers = new Set(lines.map((l) => byId.get(l.itemId)?.supplier || "No supplier"));

  const save = () => {
    setMsg(null);
    start(async () => {
      const r = await saveOrderAction({ id: orderId, date, notes, requestId, lines });
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) router.push(r.id ? `/stock/orders/${r.id}` : "/stock/orders");
    });
  };

  const field = "h-11 w-full rounded-lg border bg-background px-3 text-base";

  return (
    <div className="space-y-4">
      {!orderId && initial.length > 0 ? (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          {initial.length} item{initial.length === 1 ? "" : "s"} below the re-order level were added with the suggested cartons. Change, remove or add more.
        </p>
      ) : null}

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
                    setLines((p) => [...p, { itemId: i.id, cartons: String(i.suggested || 1) }]);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-muted"
                >
                  <span className="min-w-0 truncate">
                    {i.name} <span className="text-xs text-muted-foreground">{i.supplier}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{i.onHandText}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing is below the re-order level. Search a product to add it.</p>
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
                    {item.supplier || "No supplier"} · on hand {item.onHandText} · RM {item.cartonPrice.toFixed(2)}/ctn
                  </div>
                  {item.priceChangePct !== null && item.priceChangePct >= 5 ? (
                    <div className="text-xs font-medium text-amber-700">Price is {item.priceChangePct}% above your last delivery: check with the supplier</div>
                  ) : null}
                </div>
                <div className="w-20">
                  <input
                    value={l.cartons}
                    onChange={(e) => setLines((p) => p.map((x, i) => (i === index ? { ...x, cartons: e.target.value } : x)))}
                    inputMode="decimal"
                    className="h-11 w-full rounded-lg border bg-background px-2 text-right text-base"
                    aria-label={`Cartons of ${item.name}`}
                  />
                  <div className="text-right text-xs text-muted-foreground">ctn</div>
                </div>
                <button type="button" onClick={() => setLines((p) => p.filter((_, i) => i !== index))} aria-label="Remove" className="p-1 text-muted-foreground">
                  <X className="size-5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Order date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <label className="text-xs text-muted-foreground">
          Note (optional)
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
        </label>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
        <span className="text-muted-foreground">
          {suppliers.size > 1 && !orderId ? `${suppliers.size} suppliers: one order each` : "Total at list prices"}
        </span>
        <span className="font-semibold">RM {total.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>

      {msg ? <p className={cn("rounded-lg p-3 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}
      <button type="button" onClick={save} disabled={pending || lines.length === 0} className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground disabled:opacity-50">
        {pending ? "Saving..." : orderId ? "Save changes" : "Save as draft"}
      </button>
    </div>
  );
}
