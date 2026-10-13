"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenses, incomes } from "@/lib/db/schema";
import { requireManager } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/money/expense-categories";
import { INCOME_CATEGORIES, INCOME_METHODS } from "@/lib/money/income-categories";
import { REPEATS, nextRepeatDate } from "@/lib/money/repeating";

type Result = { ok: boolean; message: string };
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const text = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const refresh = () => revalidatePath("/money");
const METHODS = ["BANK_TRANSFER", "DUITNOW", "CASH", "CHEQUE", "EWALLET", "CARD", "OTHER"];

export async function addExpenseAction(input: {
  name: string;
  date: string;
  amount: number | string;
  category: string;
  paidTo?: string;
  method?: string;
  repeatEvery?: string;
  noBillNeeded?: boolean;
  notes?: string;
  requestId?: string;
}): Promise<Result> {
  const orgId = await requireManager();
  const amount = num(input.amount);
  if (!text(input.name)) return { ok: false, message: "Say what it was for." };
  if (!(amount > 0)) return { ok: false, message: "Type the amount." };
  if (!isDate(input.date)) return { ok: false, message: "Pick a date." };
  const key = text(input.requestId, 64);
  if (key) {
    const [dupe] = await db.select({ id: expenses.id }).from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.source, `form:${key}`)));
    if (dupe) return { ok: true, message: "Already saved." };
  }
  await db.insert(expenses).values({
    orgId,
    name: text(input.name, 200),
    expenseDate: input.date,
    amount,
    category: EXPENSE_CATEGORIES.some((c) => c.value === input.category) ? input.category : "OTHER",
    paidTo: text(input.paidTo, 120),
    method: METHODS.includes(String(input.method)) ? String(input.method) : "OTHER",
    repeatEvery: REPEATS.some((r) => r.value === input.repeatEvery) ? String(input.repeatEvery) : "NONE",
    noBillNeeded: input.noBillNeeded === true,
    notes: text(input.notes, 500),
    source: key ? `form:${key}` : null,
  });
  refresh();
  return { ok: true, message: "Expense saved." };
}

/** Remove an expense (soft delete). One booked from stock is removed with its delivery instead. */
export async function voidExpenseAction(id: string): Promise<Result> {
  const orgId = await requireManager();
  const [row] = await db.select({ source: expenses.source }).from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)));
  if (!row) return { ok: false, message: "Not found." };
  if (row.source?.startsWith("stock:")) return { ok: false, message: "This was added from a stock delivery. Remove the delivery line in Stock history instead." };
  await db.update(expenses).set({ deletedAt: new Date() }).where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)));
  refresh();
  return { ok: true, message: "Removed." };
}

/** A repeating bill fell due: add the next one (a copy on its due date, still repeating), or stop repeating. */
export async function repeatBillAction(expenseId: string, action: "add" | "stop", amount?: number | string, date?: string): Promise<Result> {
  const orgId = await requireManager();
  const [e] = await db.select().from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.id, expenseId)));
  if (!e) return { ok: false, message: "Expense not found." };
  if (action === "stop") {
    await db.update(expenses).set({ repeatEvery: "NONE" }).where(eq(expenses.id, e.id));
    refresh();
    return { ok: true, message: `${e.name} no longer repeats.` };
  }
  if (e.repeatHandled || e.repeatEvery === "NONE") return { ok: false, message: "The next one was already added." };
  // Claim it first, so a second click finds it handled.
  const claimed = await db.update(expenses).set({ repeatHandled: true }).where(and(eq(expenses.id, e.id), eq(expenses.repeatHandled, false))).returning({ id: expenses.id });
  if (!claimed.length) return { ok: false, message: "The next one was already added." };
  const a = num(amount);
  await db.insert(expenses).values({
    orgId,
    name: e.name,
    expenseDate: isDate(date) ? date : nextRepeatDate(e.expenseDate, e.repeatEvery),
    amount: a > 0 ? a : e.amount,
    currency: e.currency,
    category: e.category,
    paidTo: e.paidTo,
    method: e.method,
    repeatEvery: e.repeatEvery,
    propertyId: e.propertyId,
  });
  refresh();
  return { ok: true, message: `Added ${e.name}.` };
}

export async function addIncomeAction(input: { name: string; date: string; amount: number | string; category: string; receivedFrom?: string; method?: string; notes?: string; requestId?: string }): Promise<Result> {
  const orgId = await requireManager();
  const amount = num(input.amount);
  if (!text(input.name)) return { ok: false, message: "Say what it was for." };
  if (!(amount > 0)) return { ok: false, message: "Type the amount." };
  if (!isDate(input.date)) return { ok: false, message: "Pick a date." };
  const key = text(input.requestId, 64);
  if (key) {
    const [dupe] = await db.select({ id: incomes.id }).from(incomes).where(and(eq(incomes.orgId, orgId), eq(incomes.source, `form:${key}`)));
    if (dupe) return { ok: true, message: "Already saved." };
  }
  await db.insert(incomes).values({
    orgId,
    name: text(input.name, 200),
    incomeDate: input.date,
    amount,
    category: INCOME_CATEGORIES.some((c) => c.value === input.category) ? input.category : "OTHER",
    receivedFrom: text(input.receivedFrom, 120),
    method: INCOME_METHODS.some((m) => m.value === input.method) ? String(input.method) : "OTHER",
    notes: text(input.notes, 500),
    source: key ? `form:${key}` : null,
  });
  refresh();
  return { ok: true, message: "Money in saved." };
}

export async function voidIncomeAction(id: string): Promise<Result> {
  const orgId = await requireManager();
  await db.update(incomes).set({ deletedAt: new Date() }).where(and(eq(incomes.orgId, orgId), eq(incomes.id, id)));
  refresh();
  return { ok: true, message: "Removed." };
}
