import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "./index";
import { expenses, incomes, stockMovements } from "./schema";
import { nextRepeatDate } from "@/lib/money/repeating";
import { cartonsAndUnits, type StockItem } from "@/lib/stock/rules";

const monthRange = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
};

export async function listExpenses(orgId: string, month: string) {
  const { from, to } = monthRange(month);
  return db
    .select()
    .from(expenses)
    .where(and(eq(expenses.orgId, orgId), isNull(expenses.deletedAt), gte(expenses.expenseDate, from), lt(expenses.expenseDate, to)))
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));
}

export async function listIncomes(orgId: string, month: string) {
  const { from, to } = monthRange(month);
  return db
    .select()
    .from(incomes)
    .where(and(eq(incomes.orgId, orgId), isNull(incomes.deletedAt), gte(incomes.incomeDate, from), lt(incomes.incomeDate, to)))
    .orderBy(desc(incomes.incomeDate), desc(incomes.createdAt));
}

/** Month by month totals for the last `months` months (oldest first), in the workspace's own currency. */
export async function monthlyTotals(orgId: string, months = 12) {
  const [out, inn] = await Promise.all([
    db
      .select({ month: sql<string>`to_char(${expenses.expenseDate}, 'YYYY-MM')`, total: sql<number>`sum(${expenses.amount})::float` })
      .from(expenses)
      .where(and(eq(expenses.orgId, orgId), isNull(expenses.deletedAt)))
      .groupBy(sql`1`),
    db
      .select({ month: sql<string>`to_char(${incomes.incomeDate}, 'YYYY-MM')`, total: sql<number>`sum(${incomes.amount})::float` })
      .from(incomes)
      .where(and(eq(incomes.orgId, orgId), isNull(incomes.deletedAt)))
      .groupBy(sql`1`),
  ]);
  const all = new Map<string, { month: string; out: number; in: number }>();
  for (const r of out) all.set(r.month, { month: r.month, out: r.total, in: 0 });
  for (const r of inn) all.set(r.month, { ...(all.get(r.month) ?? { month: r.month, out: 0, in: 0 }), in: r.total });
  return [...all.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-months);
}

/** Repeating bills whose next one is due and not added yet (the latest of each series). */
export async function dueRepeatingBills(orgId: string, today: string) {
  const rows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.orgId, orgId), isNull(expenses.deletedAt), eq(expenses.repeatHandled, false), sql`${expenses.repeatEvery} <> 'NONE'`))
    .orderBy(asc(expenses.expenseDate));
  return rows.map((e) => ({ expense: e, nextDate: nextRepeatDate(e.expenseDate, e.repeatEvery) })).filter((b) => b.nextDate <= today);
}

// ---------------------------------------------------------------- purchases -> expenses

type PurchaseLine = { item: StockItem; units: number; unitCost: number };

/** One expense per delivery, so stock bought shows under Money out. Its `source` ("stock:<batch>") finds it again. */
export async function bookPurchaseExpense(orgId: string, batchId: string, lines: PurchaseLine[], info: { date: string; supplier: string; reference: string }) {
  const amount = Math.round(lines.reduce((sum, l) => sum + l.units * l.unitCost, 0) * 100) / 100;
  if (!(amount > 0)) return;
  const source = `stock:${batchId}`;
  const [existing] = await db.select({ id: expenses.id }).from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.source, source)));
  if (existing) return; // a retried save
  await db.insert(expenses).values({
    orgId,
    name: `Stock purchase · ${info.supplier || "supplier"}${info.reference ? ` · ${info.reference}` : ""}`,
    expenseDate: info.date,
    amount,
    category: "STOCK_PURCHASE",
    paidTo: info.supplier,
    notes: lines.map((l) => `${l.item.code} ${l.item.name}: ${cartonsAndUnits(l.units, l.item)}`).join("\n"),
    source,
  });
}

/** After a purchase line is removed: the delivery's expense follows what is left. */
export async function resyncPurchaseExpense(orgId: string, batchId: string) {
  if (!batchId) return;
  const source = `stock:${batchId}`;
  const [expense] = await db.select().from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.source, source), isNull(expenses.deletedAt)));
  if (!expense) return;
  const left = await db
    .select({ quantity: stockMovements.quantity, unitCost: stockMovements.unitCost })
    .from(stockMovements)
    .where(and(eq(stockMovements.orgId, orgId), eq(stockMovements.batchId, batchId), eq(stockMovements.type, "PURCHASE"), isNull(stockMovements.deletedAt)));
  const amount = Math.round(left.reduce((sum, m) => sum + (m.quantity || 0) * (m.unitCost || 0), 0) * 100) / 100;
  if (amount > 0) await db.update(expenses).set({ amount }).where(eq(expenses.id, expense.id));
  else await db.update(expenses).set({ deletedAt: new Date() }).where(eq(expenses.id, expense.id));
}
