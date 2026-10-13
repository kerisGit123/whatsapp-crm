"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyImportAction, previewImportAction, type ImportPreview } from "@/app/(dashboard)/stock/excel/actions";
import { fileToBase64 } from "@/lib/file-base64";
import { cn } from "@/lib/utils";

const field = "h-11 w-full rounded-lg border bg-background px-3 text-base";

/** Add products and starting stock from the monthly Excel sheet (订货单): read, check, import. */
export function ImportForm() {
  const router = useRouter();
  const [file64, setFile64] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<"month" | "closing">("month");
  const [openingDate, setOpeningDate] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [includeOrder, setIncludeOrder] = useState(true);
  const [includeTakes, setIncludeTakes] = useState(true);
  const [updateDetails, setUpdateDetails] = useState(true);
  const [supplier, setSupplier] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [requestId] = useState(() => `imp-${crypto.randomUUID()}`);

  const choose = (file: File | undefined) => {
    if (!file) return;
    setMsg(null);
    setPreview(null);
    start(async () => {
      try {
        const b64 = await fileToBase64(file);
        setFile64(b64);
        setFileName(file.name);
        const p = await previewImportAction(b64);
        setPreview(p);
        if (p.ok && p.dates) {
          setOpeningDate(p.dates.opening);
          setClosingDate(p.dates.closing);
        } else setMsg({ ok: false, text: p.message });
      } catch (error) {
        setMsg({ ok: false, text: error instanceof Error ? error.message : "Could not read that file." });
      }
    });
  };

  const apply = () =>
    start(async () => {
      const r = await applyImportAction(file64, { mode, openingDate, closingDate, includeOrder, includeTakes, updateDetails, supplier, requestId });
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        setPreview(null);
        router.refresh();
      }
    });

  const rows = preview?.rows ?? [];
  const counts = { NEW: 0, CHANGED: 0, SAME: 0 };
  for (const r of rows) counts[r.status] += 1;

  return (
    <div className="space-y-3">
      <label className="block rounded-lg border border-dashed p-6 text-center">
        <span className="text-sm">{fileName || "Choose the Excel file (.xlsx)"}</span>
        <input type="file" accept=".xlsx" className="mt-2 block w-full text-sm" onChange={(e) => choose(e.target.files?.[0])} />
      </label>
      {pending && !preview ? <p className="text-sm text-muted-foreground">Reading the file...</p> : null}

      {preview?.ok ? (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm">{preview.message}</p>
          <p className="text-sm text-muted-foreground">
            {counts.NEW} new · {counts.CHANGED} changed · {counts.SAME} same
          </p>
          {preview.sheet?.warnings.map((w) => (
            <p key={w} className="text-sm text-amber-800">
              {w}
            </p>
          ))}
          {preview.sheet && preview.sheet.balanceDiffers.length > 0 ? (
            <p className="text-sm text-amber-800">{preview.sheet.balanceDiffers.length} products have a balance that is not opening + in - out (waste or lending). The sheet&apos;s balance wins.</p>
          ) : null}

          <div className="flex gap-2">
            {(["month", "closing"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-full border px-3 py-1.5 text-sm", mode === m ? "border-primary bg-primary/10" : "")}>
                {m === "month" ? "Whole month (opening + in + out)" : "Just the balance"}
              </button>
            ))}
          </div>
          {mode === "month" ? (
            <label className="block text-xs text-muted-foreground">
              Opening date
              <input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} className={field} />
            </label>
          ) : (
            <label className="block text-xs text-muted-foreground">
              Date of the balance
              <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className={field} />
            </label>
          )}
          {mode === "month" ? (
            <div className="space-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={includeOrder} onChange={(e) => setIncludeOrder(e.target.checked)} className="size-4" /> Include deliveries (what was ordered / came in)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={includeTakes} onChange={(e) => setIncludeTakes(e.target.checked)} className="size-4" /> Include take-outs by date
              </label>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={updateDetails} onChange={(e) => setUpdateDetails(e.target.checked)} className="size-4" /> Update names, specs and prices of products I already have
          </label>
          <label className="block text-xs text-muted-foreground">
            Supplier for new products (optional)
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={field} />
          </label>

          <div className="max-h-64 overflow-y-auto rounded-lg border text-sm">
            {rows.slice(0, 200).map((r) => (
              <div key={r.code || r.name} className="flex items-center gap-2 border-b px-3 py-2 last:border-0">
                <span className="min-w-0 flex-1 truncate">
                  {r.code} {r.name}
                </span>
                <span className="text-xs text-muted-foreground">{r.closingUnits} {r.unit}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs", r.status === "NEW" ? "bg-green-100 text-green-800" : r.status === "CHANGED" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700")}>{r.status === "NEW" ? "New" : r.status === "CHANGED" ? "Changed" : "Same"}</span>
              </div>
            ))}
          </div>

          <button type="button" onClick={apply} disabled={pending} className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground disabled:opacity-50">
            {pending ? "Importing..." : `Import ${rows.length} products`}
          </button>
        </div>
      ) : null}
      {msg ? <p className={cn("rounded-lg p-3 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}
    </div>
  );
}
