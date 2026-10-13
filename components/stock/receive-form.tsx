"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { receiveOrderAction } from "@/app/(dashboard)/stock/orders/actions";
import { cn } from "@/lib/utils";

export type ReceiveLine = {
  itemId: string;
  name: string;
  unit: string;
  unitsPerCarton: number;
  outstanding: number; // units still to come
  cartonPrice: number;
  expiryHint: string; // expiry filled in from shelf life ('' if unknown)
};

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type Row = { units: string; price: string; expiry: string; close: boolean };

/** Goods arrived: type what came per line (default: everything still to come). */
export function ReceiveForm({ orderId, lines, showPrices }: { orderId: string; lines: ReceiveLine[]; showPrices: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(lines.map((l) => [l.itemId, { units: String(l.outstanding), price: "", expiry: "", close: false }])));
  const [date, setDate] = useState(todayLocal());
  const [reference, setReference] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [requestId] = useState(() => `r-${crypto.randomUUID()}`);

  const patch = (id: string, change: Partial<Row>) => setRows((p) => ({ ...p, [id]: { ...p[id], ...change } }));

  const save = () => {
    setMsg(null);
    start(async () => {
      const r = await receiveOrderAction({
        orderId,
        date,
        reference,
        requestId,
        lines: lines.map((l) => ({ itemId: l.itemId, units: rows[l.itemId].units, expiryDate: rows[l.itemId].expiry || null, close: rows[l.itemId].close, cartonPrice: rows[l.itemId].price || null })),
      });
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) router.refresh();
    });
  };

  const field = "h-11 w-full rounded-lg border bg-background px-3 text-base";

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="font-medium">Goods arrived</div>
      <p className="text-xs text-muted-foreground">Type what actually arrived, in units. Lower it for a short delivery.</p>
      <ul className="space-y-3">
        {lines.map((l) => {
          const row = rows[l.itemId];
          return (
            <li key={l.itemId} className="rounded-lg bg-muted/30 p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground">
                  still to come {l.outstanding} {l.unit}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Arrived ({l.unit || "units"})
                  <input value={row.units} onChange={(e) => patch(l.itemId, { units: e.target.value })} inputMode="decimal" className={field} />
                </label>
                {showPrices ? (
                  <label className="text-xs text-muted-foreground">
                    Carton price on invoice
                    <input value={row.price} onChange={(e) => patch(l.itemId, { price: e.target.value })} inputMode="decimal" placeholder={l.cartonPrice.toFixed(2)} className={field} />
                  </label>
                ) : null}
                <label className="col-span-2 text-xs text-muted-foreground">
                  Expiry date
                  <input type="date" value={row.expiry} onChange={(e) => patch(l.itemId, { expiry: e.target.value })} className={field} />
                  {l.expiryHint && !row.expiry ? <span className="mt-1 block">Left empty: {l.expiryHint} (from shelf life)</span> : null}
                </label>
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={row.close} onChange={(e) => patch(l.itemId, { close: e.target.checked })} className="size-4" />
                The rest of this item is not coming
              </label>
            </li>
          );
        })}
      </ul>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Date arrived
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <label className="text-xs text-muted-foreground">
          Invoice / DO number
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={field} />
        </label>
      </div>
      {msg ? <p className={cn("rounded-lg p-3 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}
      <button type="button" onClick={save} disabled={pending} className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground disabled:opacity-50">
        {pending ? "Saving..." : "Save delivery"}
      </button>
    </div>
  );
}
