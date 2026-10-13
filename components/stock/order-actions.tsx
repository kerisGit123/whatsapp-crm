"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setOrderPhoneAction, setOrderStatusAction } from "@/app/(dashboard)/stock/orders/actions";
import { cn } from "@/lib/utils";

const btn = "h-11 rounded-lg border px-4 text-sm";

/** Manager buttons on an order: send by WhatsApp, mark sent, edit, close, cancel. */
export function OrderActions({ orderId, status, phone, whatsappText, hasReceived }: { orderId: string; status: string; phone: string; whatsappText: string; hasReceived: boolean }) {
  const router = useRouter();
  const [number, setNumber] = useState(phone);
  const [confirm, setConfirm] = useState<"" | "CANCELLED" | "CLOSE_REST">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message });
      setConfirm("");
      if (r.ok) router.refresh();
    });

  const digits = number.replace(/[^\d]/g, "");
  const waHref = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(whatsappText)}` : "";

  return (
    <div className="space-y-3">
      {status === "DRAFT" || status === "SENT" ? (
        <div className="rounded-lg border p-3">
          <div className="mb-2 text-sm font-medium">Send to the supplier</div>
          <div className="flex flex-wrap gap-2">
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Supplier WhatsApp, e.g. 012-345 6789"
              inputMode="tel"
              className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-base"
            />
            <button type="button" disabled={pending || !number} onClick={() => run(() => setOrderPhoneAction(orderId, number))} className={btn}>
              Save number
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {waHref ? (
              <a href={waHref} target="_blank" rel="noreferrer" className={cn(btn, "flex items-center bg-green-600 text-white")}>
                Open in WhatsApp
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">Type the supplier&apos;s number to open WhatsApp with the order written out.</span>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" ? (
          <>
            <button type="button" disabled={pending} onClick={() => run(() => setOrderStatusAction(orderId, "SENT"))} className={cn(btn, "bg-primary text-primary-foreground")}>
              Mark as sent
            </button>
            <Link href={`/stock/orders/${orderId}/edit`} className={cn(btn, "flex items-center")}>
              Edit
            </Link>
          </>
        ) : null}
        {status === "SENT" || status === "PARTLY_RECEIVED" ? (
          <button type="button" disabled={pending} onClick={() => setConfirm("CLOSE_REST")} className={btn}>
            Close the rest
          </button>
        ) : null}
        {(status === "DRAFT" || status === "SENT") && !hasReceived ? (
          <button type="button" disabled={pending} onClick={() => setConfirm("CANCELLED")} className={cn(btn, "text-red-700")}>
            Cancel order
          </button>
        ) : null}
        {status === "CANCELLED" || status === "SENT" ? (
          <button type="button" disabled={pending} onClick={() => run(() => setOrderStatusAction(orderId, "DRAFT"))} className={btn}>
            Back to draft
          </button>
        ) : null}
      </div>

      {confirm ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          {confirm === "CANCELLED" ? "Cancel this order? Nothing has arrived, so nothing is lost." : "Stop waiting for anything that has not arrived? The order will be marked complete."}
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={pending} onClick={() => run(() => setOrderStatusAction(orderId, confirm))} className={cn(btn, "bg-red-600 text-white")}>
              Yes
            </button>
            <button type="button" onClick={() => setConfirm("")} className={btn}>
              No
            </button>
          </div>
        </div>
      ) : null}
      {msg ? <p className={cn("rounded-lg p-3 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}
    </div>
  );
}
