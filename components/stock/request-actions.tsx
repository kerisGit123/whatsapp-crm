"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelRequestAction, issueRequestAction, receiveRequestAction, resolveShortAction } from "@/app/(dashboard)/stock/requests/actions";
import { cn } from "@/lib/utils";

export type ReqLine = { itemId: string; name: string; unit: string; requested: number; issued: number | null; received: number | null };

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const field = "h-11 w-full rounded-lg border bg-background px-3 text-base";
const btn = "h-11 rounded-lg border px-4 text-sm";

export function RequestActions({ id, status, lines, isManager, hasShort }: { id: string; status: string; lines: ReqLine[]; isManager: boolean; hasShort: boolean }) {
  const router = useRouter();
  const [date, setDate] = useState(todayLocal());
  const [given, setGiven] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.itemId, String(status === "ISSUED" ? l.issued ?? 0 : l.requested)])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, start] = useTransition();
  const [issueKey] = useState(() => `iss-${crypto.randomUUID()}`);
  const [shortKey] = useState(() => `short-${crypto.randomUUID()}`);

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message });
      setConfirmCancel(false);
      if (r.ok) router.refresh();
    });

  const list = (status === "ISSUED" ? lines.filter((l) => (l.issued ?? 0) > 0) : lines).map((l) => (
    <li key={l.itemId} className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{l.name}</div>
        <div className="text-xs text-muted-foreground">{status === "ISSUED" ? `issued ${l.issued}` : `requested ${l.requested}`} {l.unit}</div>
      </div>
      <input value={given[l.itemId] ?? ""} onChange={(e) => setGiven((p) => ({ ...p, [l.itemId]: e.target.value }))} inputMode="decimal" className="h-11 w-24 rounded-lg border bg-background px-2 text-right text-base" aria-label={`Quantity of ${l.name}`} />
    </li>
  ));

  return (
    <div className="space-y-3">
      {status === "REQUESTED" ? (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="font-medium">Issue from the warehouse</div>
          <p className="text-xs text-muted-foreground">Change a number if you send less. Saving takes the stock out of the warehouse.</p>
          <ul className="divide-y">{list}</ul>
          <label className="block text-xs text-muted-foreground">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
          <button type="button" disabled={pending} onClick={() => run(() => issueRequestAction({ id, date, requestId: issueKey, lines: lines.map((l) => ({ itemId: l.itemId, issuedUnits: given[l.itemId] })) }))} className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground disabled:opacity-50">
            {pending ? "Saving..." : "Issue to branch"}
          </button>
          <div className="flex gap-2">
            <Link href={`/stock/requests/${id}/edit`} className={cn(btn, "flex items-center")}>
              Edit
            </Link>
            <button type="button" disabled={pending} onClick={() => setConfirmCancel(true)} className={cn(btn, "text-red-700")}>
              Cancel request
            </button>
          </div>
          {confirmCancel ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
              Cancel this request?
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={pending} onClick={() => run(() => cancelRequestAction(id))} className={cn(btn, "bg-red-600 text-white")}>
                  Yes
                </button>
                <button type="button" onClick={() => setConfirmCancel(false)} className={btn}>
                  No
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {status === "ISSUED" ? (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="font-medium">Branch: what actually arrived?</div>
          <p className="text-xs text-muted-foreground">Count it. Type less if something is missing.</p>
          <ul className="divide-y">{list}</ul>
          <label className="block text-xs text-muted-foreground">
            Date received
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
          <button type="button" disabled={pending} onClick={() => run(() => receiveRequestAction({ id, date, lines: lines.map((l) => ({ itemId: l.itemId, receivedUnits: given[l.itemId] })) }))} className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground disabled:opacity-50">
            {pending ? "Saving..." : "Confirm delivery"}
          </button>
        </div>
      ) : null}

      {status === "SHORT" && hasShort ? (
        isManager ? (
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="font-medium">Some items did not arrive</div>
            <p className="text-xs text-muted-foreground">Put them back in the warehouse count, or write them off as lost on the way.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => run(() => resolveShortAction({ id, how: "RETURN", requestId: shortKey }))} className={btn}>
                Put back in stock
              </button>
              <button type="button" disabled={pending} onClick={() => run(() => resolveShortAction({ id, how: "WRITE_OFF", requestId: shortKey }))} className={cn(btn, "text-red-700")}>
                Write off as lost
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Some items are short. A manager will put them back in stock or write them off.</p>
        )
      ) : null}

      {msg ? <p className={cn("rounded-lg p-3 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}
    </div>
  );
}
