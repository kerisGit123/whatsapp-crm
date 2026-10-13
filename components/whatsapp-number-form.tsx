"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addWhatsappNumberAction, removeWhatsappNumberAction } from "@/app/(dashboard)/whatsapp/actions";
import { cn } from "@/lib/utils";

const field = "h-11 w-full rounded-lg border bg-background px-3 text-base";

export function AddNumberForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+14155238886" inputMode="tel" className={field} />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className={field} />
      </div>
      {msg ? <p className={cn("rounded-lg p-2 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}
      <button
        type="button"
        disabled={pending || !phone}
        onClick={() =>
          start(async () => {
            const r = await addWhatsappNumberAction(phone, label);
            setMsg({ ok: r.ok, text: r.message });
            if (r.ok) {
              setPhone("");
              setLabel("");
              router.refresh();
            }
          })
        }
        className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add number"}
      </button>
    </div>
  );
}

export function RemoveNumber({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await removeWhatsappNumberAction(id);
          router.refresh();
        })
      }
      className="text-xs text-muted-foreground underline"
    >
      Remove
    </button>
  );
}
