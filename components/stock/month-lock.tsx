"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeMonthAction, reopenMonthAction } from "@/app/(dashboard)/stock/month-end/actions";
import { cn } from "@/lib/utils";

/** Close the next finished month, or open the latest closed one again (managers). */
export function MonthLock({ nextToClose, lockedThrough }: { nextToClose: string | null; lockedThrough: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<"" | "close" | "reopen">("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message });
      setConfirm("");
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="text-sm">{lockedThrough ? `Closed up to ${lockedThrough}. Stock can't be recorded on or before that date.` : "No month is closed yet."}</div>
      <div className="flex flex-wrap gap-2">
        {nextToClose ? (
          <button type="button" disabled={pending} onClick={() => setConfirm("close")} className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
            Close {nextToClose}
          </button>
        ) : null}
        {lockedThrough ? (
          <button type="button" disabled={pending} onClick={() => setConfirm("reopen")} className="h-11 rounded-lg border px-4 text-sm">
            Reopen the latest closed month
          </button>
        ) : null}
      </div>
      {confirm ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          {confirm === "close" ? `Close ${nextToClose}? Nobody can add or change stock in it after this.` : "Reopen the latest closed month so corrections can be made?"}
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={pending} onClick={() => run(() => (confirm === "close" ? closeMonthAction(nextToClose as string) : reopenMonthAction()))} className="h-11 rounded-lg bg-red-600 px-4 text-sm text-white">
              Yes
            </button>
            <button type="button" onClick={() => setConfirm("")} className="h-11 rounded-lg border px-4 text-sm">
              No
            </button>
          </div>
        </div>
      ) : null}
      {msg ? <p className={cn("rounded-lg p-2 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}
    </div>
  );
}
