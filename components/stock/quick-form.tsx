"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { recordAction } from "@/app/(dashboard)/stock/actions";
import { cartonsAndUnits, defaultExpiry, type StockItem } from "@/lib/stock/rules";
import { WASTE_REASONS } from "@/lib/stock/types";
import { cn } from "@/lib/utils";

type Kind = "TAKE" | "WASTE" | "PURCHASE" | "BORROW";

const KINDS: Array<{ value: Kind; label: string; hint: string }> = [
  { value: "TAKE", label: "Take out", hint: "Used in the shop" },
  { value: "WASTE", label: "Waste", hint: "Expired, spilled, staff meal" },
  { value: "PURCHASE", label: "Stock in", hint: "A delivery arrived" },
  { value: "BORROW", label: "Lend", hint: "To another branch" },
];

type Line = { itemId: string; qty: string; cost: string; expiry: string };

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function QuickForm({
  items,
  balances,
  initialKind,
  initialItem,
}: {
  items: StockItem[];
  balances: Record<string, number>;
  initialKind: Kind;
  initialItem?: string;
}) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [date, setDate] = useState(todayLocal());
  const [party, setParty] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<Line[]>(initialItem ? [{ itemId: initialItem, qty: "", cost: "", expiry: "" }] : []);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [requestId, setRequestId] = useState(() => `q-${crypto.randomUUID()}`);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return items
      .filter((i) => i.status !== "DISCONTINUED" && !lines.some((l) => l.itemId === i.id))
      .filter((i) => `${i.name} ${i.code} ${i.specification}`.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [query, items, lines]);

  const add = (item: StockItem) => {
    setLines((prev) => [...prev, { itemId: item.id, qty: "", cost: "", expiry: "" }]);
    setQuery("");
  };
  const patch = (index: number, change: Partial<Line>) => setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...change } : l)));

  const submit = () => {
    setMsg(null);
    start(async () => {
      const result = await recordAction({
        type: kind,
        date,
        party,
        reference,
        notes,
        reason,
        requestId,
        lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.qty, unitCost: kind === "PURCHASE" && l.cost !== "" ? l.cost : null, expiryDate: l.expiry || null })),
      });
      setMsg({ ok: result.ok, text: result.message });
      if (result.ok) {
        // Saved: start a fresh entry (new id so the next save is not skipped as a duplicate).
        setLines([]);
        setNotes("");
        setReference("");
        setRequestId(`q-${crypto.randomUUID()}`);
      }
    });
  };

  const input = "h-11 w-full rounded-lg border bg-background px-3 text-base";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={cn("rounded-lg border p-3 text-left", kind === k.value ? "border-primary bg-primary/10" : "hover:bg-muted")}
          >
            <div className="font-medium">{k.label}</div>
            <div className="text-xs text-muted-foreground">{k.hint}</div>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 size-5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a product to add"
          className={cn(input, "pl-10")}
        />
        {matches.length > 0 ? (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-background shadow-lg">
            {matches.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => add(i)} className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-muted">
                  <span className="min-w-0 truncate">
                    {i.name} <span className="text-xs text-muted-foreground">{i.specification}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{cartonsAndUnits(balances[i.id] ?? 0, i)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Search a product above, then enter how many.</p>
      ) : (
        <ul className="space-y-2">
          {lines.map((l, index) => {
            const item = byId.get(l.itemId);
            if (!item) return null;
            const suggested = kind === "PURCHASE" ? defaultExpiry(item, date) : "";
            return (
              <li key={l.itemId} className="rounded-lg border p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      On hand {cartonsAndUnits(balances[item.id] ?? 0, item)} · 1 ctn = {item.unitsPerCarton} {item.unit || "units"}
                    </div>
                  </div>
                  <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))} aria-label="Remove" className="p-1 text-muted-foreground">
                    <X className="size-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-muted-foreground">
                    How many ({item.unit || "units"})
                    <input value={l.qty} onChange={(e) => patch(index, { qty: e.target.value })} inputMode="decimal" className={input} />
                  </label>
                  {kind === "PURCHASE" ? (
                    <label className="text-xs text-muted-foreground">
                      Price per {item.unit || "unit"} (RM)
                      <input value={l.cost} onChange={(e) => patch(index, { cost: e.target.value })} inputMode="decimal" placeholder={(item.cartonPrice / (item.unitsPerCarton || 1)).toFixed(2)} className={input} />
                    </label>
                  ) : null}
                  {kind === "PURCHASE" ? (
                    <label className="col-span-2 text-xs text-muted-foreground">
                      Expiry date
                      <input type="date" value={l.expiry} onChange={(e) => patch(index, { expiry: e.target.value })} className={input} />
                      {suggested && !l.expiry ? <span className="mt-1 block">Left empty: {suggested} ({item.shelfLifeDays} days shelf life)</span> : null}
                    </label>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {kind === "WASTE" ? (
        <div>
          <div className="mb-1 text-sm font-medium">Why?</div>
          <div className="flex flex-wrap gap-2">
            {WASTE_REASONS.filter((r) => r.pick).map((r) => (
              <button key={r.value} type="button" onClick={() => setReason(r.value)} className={cn("rounded-full border px-3 py-2 text-sm", reason === r.value ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </label>
        {kind === "BORROW" || kind === "PURCHASE" ? (
          <label className="text-xs text-muted-foreground">
            {kind === "BORROW" ? "Which branch?" : "Supplier"}
            <input value={party} onChange={(e) => setParty(e.target.value)} className={input} />
          </label>
        ) : null}
        {kind === "PURCHASE" ? (
          <label className="text-xs text-muted-foreground">
            Invoice / DO number
            <input value={reference} onChange={(e) => setReference(e.target.value)} className={input} />
          </label>
        ) : null}
        <label className={cn("text-xs text-muted-foreground", kind === "PURCHASE" ? "" : "sm:col-span-2")}>
          Note (optional)
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
        </label>
      </div>

      {msg ? <p className={cn("rounded-lg p-3 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}

      <button
        type="button"
        onClick={submit}
        disabled={pending || lines.length === 0}
        className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Saving..." : `Save ${KINDS.find((k) => k.value === kind)?.label.toLowerCase()}`}
      </button>
    </div>
  );
}
