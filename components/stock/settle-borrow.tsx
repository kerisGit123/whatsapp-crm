"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { settleBorrowAction } from "@/app/(dashboard)/stock/requests/actions";
import { cn } from "@/lib/utils";

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const field = "h-11 w-full rounded-lg border bg-background px-3 text-base";

/** How a lending was settled: it came back, was swapped for something else, or was paid. */
export function SettleBorrow({ movementId, quantity, unit, otherItems }: { movementId: string; quantity: number; unit: string; otherItems: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [how, setHow] = useState<"RETURNED" | "EXCHANGED" | "PAID">("RETURNED");
  const [qty, setQty] = useState(String(quantity));
  const [exItem, setExItem] = useState("");
  const [exQty, setExQty] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [key] = useState(() => `settle-${crypto.randomUUID()}`);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-9 rounded-lg border px-3 text-sm">
        Settle
      </button>
    );
  }

  const save = () =>
    start(async () => {
      const r = await settleBorrowAction({ movementId, how, date: todayLocal(), quantity: qty, exchangeItemId: exItem, exchangeQuantity: exQty, amount, requestId: key });
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) router.refresh();
    });

  return (
    <div className="mt-2 w-full space-y-2 rounded-lg bg-muted/40 p-3">
      <div className="flex flex-wrap gap-2">
        {(["RETURNED", "EXCHANGED", "PAID"] as const).map((h) => (
          <button key={h} type="button" onClick={() => setHow(h)} className={cn("rounded-full border px-3 py-1.5 text-sm", how === h ? "border-primary bg-primary/10" : "")}>
            {h === "RETURNED" ? "Came back" : h === "EXCHANGED" ? "Swapped" : "Paid for"}
          </button>
        ))}
      </div>
      {how === "RETURNED" ? (
        <label className="block text-xs text-muted-foreground">
          How many came back ({unit || "units"})
          <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className={field} />
        </label>
      ) : null}
      {how === "EXCHANGED" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            Received instead
            <select value={exItem} onChange={(e) => setExItem(e.target.value)} className={field}>
              <option value="">Pick an item</option>
              {otherItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            How many
            <input value={exQty} onChange={(e) => setExQty(e.target.value)} inputMode="decimal" className={field} />
          </label>
        </div>
      ) : null}
      {how === "PAID" ? (
        <label className="block text-xs text-muted-foreground">
          Amount paid (RM)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={field} />
        </label>
      ) : null}
      {msg ? <p className={cn("rounded-lg p-2 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={save} className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-lg border px-4 text-sm">
          Close
        </button>
      </div>
    </div>
  );
}
