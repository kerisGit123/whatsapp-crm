"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveItemAction, setStatusAction } from "@/app/(dashboard)/stock/actions";
import { STOCK_GROUPS } from "@/lib/stock/types";
import type { StockItem } from "@/lib/stock/rules";
import { cn } from "@/lib/utils";

const field = "h-11 w-full rounded-lg border bg-background px-3 text-base";

export function ItemForm({ item, balance }: { item: StockItem | null; balance: number }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: item?.name ?? "",
    code: item?.code ?? "",
    specification: item?.specification ?? "",
    group: item?.group ?? "RAW",
    unit: item?.unit ?? "",
    unitsPerCarton: String(item?.unitsPerCarton ?? 1),
    cartonPrice: String(item?.cartonPrice ?? 0),
    supplier: item?.supplier ?? "",
    reorderBelowMonths: item?.reorderBelowMonths == null ? "" : String(item.reorderBelowMonths),
    shelfLifeDays: item?.shelfLifeDays == null ? "" : String(item.shelfLifeDays),
    notes: item?.notes ?? "",
    openingUnits: "",
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [key]: e.target.value }));

  const save = () =>
    start(async () => {
      const r = await saveItemAction({ ...v, id: item?.id });
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) router.push("/stock");
    });

  const toggle = (writeOff = false) =>
    start(async () => {
      const r = await setStatusAction(item!.id, item!.status === "ACTIVE" ? "DISCONTINUED" : "ACTIVE", writeOff);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) router.push("/stock");
    });

  return (
    <div className="space-y-3">
      <label className="block text-xs text-muted-foreground">
        Product name
        <input value={v.name} onChange={set("name")} className={field} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Item code
          <input value={v.code} onChange={set("code")} className={field} />
        </label>
        <label className="text-xs text-muted-foreground">
          Group
          <select value={v.group} onChange={set("group")} className={field}>
            {STOCK_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs text-muted-foreground">
        Specification (e.g. 3kg*8 bags)
        <input value={v.specification} onChange={set("specification")} className={field} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted-foreground">
          Unit (bag, bottle...)
          <input value={v.unit} onChange={set("unit")} className={field} />
        </label>
        <label className="text-xs text-muted-foreground">
          Units per carton
          <input value={v.unitsPerCarton} onChange={set("unitsPerCarton")} inputMode="decimal" className={field} />
        </label>
        <label className="text-xs text-muted-foreground">
          Carton price (RM)
          <input value={v.cartonPrice} onChange={set("cartonPrice")} inputMode="decimal" className={field} />
        </label>
      </div>
      <label className="block text-xs text-muted-foreground">
        Supplier
        <input value={v.supplier} onChange={set("supplier")} className={field} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Re-order below (months, optional)
          <input value={v.reorderBelowMonths} onChange={set("reorderBelowMonths")} inputMode="decimal" className={field} />
        </label>
        <label className="text-xs text-muted-foreground">
          Shelf life (days, optional)
          <input value={v.shelfLifeDays} onChange={set("shelfLifeDays")} inputMode="numeric" className={field} />
        </label>
      </div>
      {!item ? (
        <label className="block text-xs text-muted-foreground">
          Stock you have now (units, optional)
          <input value={v.openingUnits} onChange={set("openingUnits")} inputMode="decimal" className={field} />
        </label>
      ) : null}
      <label className="block text-xs text-muted-foreground">
        Notes
        <textarea value={v.notes} onChange={set("notes")} rows={2} className="w-full rounded-lg border bg-background px-3 py-2 text-base" />
      </label>

      {msg ? <p className={cn("rounded-lg p-3 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}

      <button type="button" onClick={save} disabled={pending} className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground disabled:opacity-50">
        {pending ? "Saving..." : item ? "Save changes" : "Add item"}
      </button>

      {item ? (
        <div className="space-y-2 border-t pt-3">
          <button type="button" onClick={() => toggle(false)} disabled={pending} className="h-11 w-full rounded-lg border text-sm">
            {item.status === "ACTIVE" ? "Discontinue this item" : "Make active again"}
          </button>
          {item.status === "ACTIVE" && balance > 0 ? (
            <button type="button" onClick={() => toggle(true)} disabled={pending} className="h-11 w-full rounded-lg border border-red-300 text-sm text-red-700">
              Discontinue and write off the {balance} {item.unit || "units"} left
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
