// Smoke test for the stock data layer + rules against the dev Neon DB, using a
// throwaway workspace id that is deleted at the end.
//   node --env-file=.env.local --import tsx scripts/stock-smoke.mts
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { stockItems, stockMovements, stockSettings } from "../lib/db/schema";
import { batchExists, insertMovements, loadStockData, todayIso } from "../lib/db/stock";
import { balanceOf, cartonsAndUnits, stockStatus } from "../lib/stock/rules";

const orgId = `org_smoke_${Date.now()}`;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failed++;
};

try {
  const [item] = await db
    .insert(stockItems)
    .values({ orgId, name: "Milk powder", unit: "bag", unitsPerCarton: 8, cartonPrice: 160, shelfLifeDays: 365 })
    .returning();

  const today = todayIso();
  const day = (offset: number) => new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);

  await insertMovements(orgId, "Test", [
    { itemId: item.id, data: { date: day(-70), type: "ADJUST_IN", quantity: 40, unitCost: 20, notes: "Opening balance" } },
    { itemId: item.id, data: { date: day(-40), type: "TAKE", quantity: 16, batchId: "b1" } },
    { itemId: item.id, data: { date: day(-10), type: "TAKE", quantity: 14, batchId: "b2" } },
    { itemId: item.id, data: { date: day(-5), type: "WASTE", quantity: 2, reason: "DAMAGED", batchId: "b3" } },
  ]);

  const data = await loadStockData(orgId);
  const moves = data.byItem.get(item.id) ?? [];
  check("loads 4 movements", moves.length === 4, String(moves.length));
  check("balance 40-16-14-2 = 8", balanceOf(moves) === 8, String(balanceOf(moves)));
  check("avg unit cost 20", data.items[0].avgUnitCost === 20, String(data.items[0].avgUnitCost));
  check("cartons text", cartonsAndUnits(8, data.items[0]) === "1 ctn", cartonsAndUnits(8, data.items[0]));
  check("batchExists true", await batchExists(orgId, "b2"));
  check("batchExists false", !(await batchExists(orgId, "nope")));

  const status = stockStatus(data.items[0], moves, data.rule, today);
  check("forecast > 0 and flag ORDER", status.forecast > 0 && status.flag === "ORDER", `forecast=${status.forecast} flag=${status.flag} suggest=${status.suggestedCartons}ctn`);

  // Soft delete drops a line from the balance.
  const target = (await db.select().from(stockMovements).where(eq(stockMovements.orgId, orgId))).find((m) => m.batchId === "b3")!;
  await db.update(stockMovements).set({ deletedAt: new Date() }).where(eq(stockMovements.id, target.id));
  const after = await loadStockData(orgId);
  check("soft-deleted line ignored (balance 10)", balanceOf(after.byItem.get(item.id) ?? []) === 10);

  // Other workspaces never see these rows.
  const other = await loadStockData("org_someone_else");
  check("other workspace sees nothing", other.items.length === 0 && other.movements.length === 0);
} finally {
  await db.delete(stockMovements).where(eq(stockMovements.orgId, orgId));
  await db.delete(stockItems).where(eq(stockItems.orgId, orgId));
  await db.delete(stockSettings).where(eq(stockSettings.orgId, orgId));
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
