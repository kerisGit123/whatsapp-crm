// Money data layer against the dev DB with a throwaway workspace id (deleted at the end).
//   node --env-file=.env.local --import tsx scripts/money-smoke.mts
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { expenses, incomes, stockItems, stockMovements } from "../lib/db/schema";
import { bookPurchaseExpense, dueRepeatingBills, listExpenses, listIncomes, monthlyTotals, resyncPurchaseExpense } from "../lib/db/money";
import { insertMovements } from "../lib/db/stock";
import { nextRepeatDate } from "../lib/money/repeating";
import type { StockItem } from "../lib/stock/rules";

const org = `ws_moneytest_${Date.now()}`;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failed++;
};
try {
  const [it] = await db.insert(stockItems).values({ orgId: org, name: "Milk", code: "1.001", unit: "bag", unitsPerCarton: 8, cartonPrice: 160 }).returning();
  const item = { id: it.id, code: "1.001", name: "Milk", unit: "bag", unitsPerCarton: 8 } as StockItem;
  const batch = "b-test-1";
  await insertMovements(org, "T", [{ itemId: it.id, data: { date: "2026-09-10", type: "PURCHASE", quantity: 16, unitCost: 20, batchId: batch } }]);
  await bookPurchaseExpense(org, batch, [{ item, units: 16, unitCost: 20 }], { date: "2026-09-10", supplier: "Acme", reference: "INV1" });
  await bookPurchaseExpense(org, batch, [{ item, units: 16, unitCost: 20 }], { date: "2026-09-10", supplier: "Acme", reference: "INV1" });
  let list = await listExpenses(org, "2026-09");
  check("one expense per delivery, retry does not double", list.length === 1 && list[0].amount === 320 && list[0].category === "STOCK_PURCHASE", JSON.stringify(list.map((e) => e.amount)));

  // Removing half of the delivery shrinks the expense; removing all deletes it.
  await db.insert(stockMovements).values({ orgId: org, itemId: it.id, movementDate: "2026-09-10", type: "PURCHASE", quantity: 8, unitCost: 20, batchId: batch });
  await db.update(stockMovements).set({ deletedAt: new Date() }).where(eq(stockMovements.orgId, org));
  await resyncPurchaseExpense(org, batch);
  list = await listExpenses(org, "2026-09");
  check("all lines removed -> expense removed", list.length === 0);

  await db.insert(expenses).values({ orgId: org, name: "Assessment tax", expenseDate: "2026-01-15", amount: 120, category: "ASSESSMENT_TAX", repeatEvery: "HALF_YEARLY" });
  await db.insert(incomes).values({ orgId: org, name: "Late fee", incomeDate: "2026-09-05", amount: 50, category: "LATE_FEE" });
  const due = await dueRepeatingBills(org, "2026-09-01");
  check("repeating bill is due (next 15 Jul)", due.length === 1 && due[0].nextDate === "2026-07-15", due[0]?.nextDate);
  check("31 Jan + 1 month = 28 Feb", nextRepeatDate("2026-01-31", "MONTHLY") === "2026-02-28");
  check("income listed for its month", (await listIncomes(org, "2026-09")).length === 1);
  const totals = await monthlyTotals(org, 12);
  check("monthly totals combine in and out", totals.some((t) => t.month === "2026-09" && t.in === 50) && totals.some((t) => t.month === "2026-01" && t.out === 120), JSON.stringify(totals));
  check("other workspace sees nothing", (await listExpenses("ws_other", "2026-09")).length === 0);
} finally {
  await db.delete(stockMovements).where(eq(stockMovements.orgId, org));
  await db.delete(stockItems).where(eq(stockItems.orgId, org));
  await db.delete(expenses).where(eq(expenses.orgId, org));
  await db.delete(incomes).where(eq(incomes.orgId, org));
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
