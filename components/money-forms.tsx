"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addExpenseAction, addIncomeAction, repeatBillAction, voidExpenseAction, voidIncomeAction } from "@/app/(dashboard)/money/actions";
import { EXPENSE_AREAS, EXPENSE_CATEGORIES, EXPENSE_GROUPS } from "@/lib/money/expense-categories";
import { INCOME_CATEGORIES, INCOME_METHODS } from "@/lib/money/income-categories";
import { REPEATS } from "@/lib/money/repeating";
import { cn } from "@/lib/utils";

const field = "h-11 w-full rounded-lg border bg-background px-3 text-base";
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function Notice({ msg }: { msg: { ok: boolean; text: string } | null }) {
  return msg ? <p className={cn("rounded-lg p-2 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null;
}

export function ExpenseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: "", amount: "", date: todayLocal(), category: "OTHER", paidTo: "", method: "OTHER", repeatEvery: "NONE", notes: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [requestId, setRequestId] = useState(() => `exp-${crypto.randomUUID()}`);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
        + Add expense
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <input value={v.name} onChange={set("name")} placeholder="What was it for?" className={field} />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Amount
          <input value={v.amount} onChange={set("amount")} inputMode="decimal" className={field} />
        </label>
        <label className="text-xs text-muted-foreground">
          Date
          <input type="date" value={v.date} onChange={set("date")} className={field} />
        </label>
      </div>
      <label className="block text-xs text-muted-foreground">
        Category
        <select value={v.category} onChange={set("category")} className={field}>
          {EXPENSE_AREAS.map((a) => (
            <optgroup key={a.key} label={`${a.icon} ${a.label}`}>
              {EXPENSE_GROUPS.filter((g) => g.area === a.key).flatMap((g) =>
                EXPENSE_CATEGORIES.filter((c) => c.group === g.key).map((c) => (
                  <option key={c.value} value={c.value}>
                    {g.label}: {c.label}
                  </option>
                )),
              )}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Paid to
          <input value={v.paidTo} onChange={set("paidTo")} className={field} />
        </label>
        <label className="text-xs text-muted-foreground">
          Repeats
          <select value={v.repeatEvery} onChange={set("repeatEvery")} className={field}>
            {REPEATS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input value={v.notes} onChange={set("notes")} placeholder="Note (optional)" className={field} />
      <Notice msg={msg} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await addExpenseAction({ ...v, requestId });
              setMsg({ ok: r.ok, text: r.message });
              if (r.ok) {
                setV({ ...v, name: "", amount: "", notes: "", paidTo: "" });
                setRequestId(`exp-${crypto.randomUUID()}`);
                router.refresh();
              }
            })
          }
          className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-lg border px-4 text-sm">
          Close
        </button>
      </div>
    </div>
  );
}

export function IncomeForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: "", amount: "", date: todayLocal(), category: "OTHER", receivedFrom: "", method: "BANK_TRANSFER", notes: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [requestId, setRequestId] = useState(() => `inc-${crypto.randomUUID()}`);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
        + Add money in
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <input value={v.name} onChange={set("name")} placeholder="What was it for?" className={field} />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Amount
          <input value={v.amount} onChange={set("amount")} inputMode="decimal" className={field} />
        </label>
        <label className="text-xs text-muted-foreground">
          Date
          <input type="date" value={v.date} onChange={set("date")} className={field} />
        </label>
        <label className="text-xs text-muted-foreground">
          Kind
          <select value={v.category} onChange={set("category")} className={field}>
            {INCOME_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          How paid
          <select value={v.method} onChange={set("method")} className={field}>
            {INCOME_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input value={v.receivedFrom} onChange={set("receivedFrom")} placeholder="Received from" className={field} />
      <input value={v.notes} onChange={set("notes")} placeholder="Note (optional)" className={field} />
      <Notice msg={msg} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await addIncomeAction({ ...v, requestId });
              setMsg({ ok: r.ok, text: r.message });
              if (r.ok) {
                setV({ ...v, name: "", amount: "", notes: "", receivedFrom: "" });
                setRequestId(`inc-${crypto.randomUUID()}`);
                router.refresh();
              }
            })
          }
          className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-lg border px-4 text-sm">
          Close
        </button>
      </div>
    </div>
  );
}

/** Two taps to remove a row. */
export function RemoveRow({ id, kind }: { id: string; kind: "expense" | "income" }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="text-xs text-muted-foreground underline">
        Remove
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = kind === "expense" ? await voidExpenseAction(id) : await voidIncomeAction(id);
            if (!r.ok) setError(r.message);
            setConfirm(false);
            router.refresh();
          })
        }
        className="font-medium text-red-700 underline"
      >
        Yes, remove
      </button>
      <button type="button" onClick={() => setConfirm(false)} className="underline">
        Keep
      </button>
      {error ? <span className="text-red-700">{error}</span> : null}
    </span>
  );
}

/** A repeating bill is due: add the next one with one tap (the amount can change). */
export function DueBill({ id, name, nextDate, amount, every }: { id: string; name: string; nextDate: string; amount: number; every: string }) {
  const router = useRouter();
  const [value, setValue] = useState(String(amount));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const run = (action: "add" | "stop") =>
    start(async () => {
      const r = await repeatBillAction(id, action, value, nextDate);
      setMsg(r.ok ? "" : r.message);
      router.refresh();
    });
  return (
    <li className="flex flex-wrap items-center gap-2 p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">
          {every.toLowerCase().replace("_", " ")} · due {nextDate}
        </div>
      </div>
      <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className="h-10 w-24 rounded-lg border bg-background px-2 text-right" aria-label={`Amount of ${name}`} />
      <button type="button" disabled={pending} onClick={() => run("add")} className="h-10 rounded-lg bg-primary px-3 text-sm text-primary-foreground">
        Add
      </button>
      <button type="button" disabled={pending} onClick={() => run("stop")} className="h-10 rounded-lg border px-3 text-sm">
        Stop
      </button>
      {msg ? <span className="w-full text-xs text-red-700">{msg}</span> : null}
    </li>
  );
}
