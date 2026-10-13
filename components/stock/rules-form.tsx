"use client";

import { useState, useTransition } from "react";
import { saveRuleAction } from "@/app/(dashboard)/stock/actions";
import { cn } from "@/lib/utils";

const field = "h-11 w-full rounded-lg border bg-background px-3 text-base";

export function RulesForm({ reorderBelow, orderUpTo, leadDays }: { reorderBelow: number; orderUpTo: number; leadDays: number }) {
  const [v, setV] = useState({ reorderBelow: String(reorderBelow), orderUpTo: String(orderUpTo), leadDays: String(leadDays) });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Order when stock will last less than (months)
        <input value={v.reorderBelow} onChange={(e) => setV({ ...v, reorderBelow: e.target.value })} inputMode="decimal" className={field} />
      </label>
      <label className="block text-sm">
        When ordering, order enough for (months)
        <input value={v.orderUpTo} onChange={(e) => setV({ ...v, orderUpTo: e.target.value })} inputMode="decimal" className={field} />
      </label>
      <label className="block text-sm">
        Supplier delivery takes (days)
        <input value={v.leadDays} onChange={(e) => setV({ ...v, leadDays: e.target.value })} inputMode="numeric" className={field} />
      </label>
      {msg ? <p className={cn("rounded-lg p-3 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await saveRuleAction(v);
          setMsg({ ok: r.ok, text: r.message });
        })}
        className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
