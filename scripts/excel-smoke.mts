// Excel round trip without a database: our own exports must be readable, and the
// monthly sheet must re-import into the same products and take-outs.
//   node --import tsx scripts/excel-smoke.mts
import { countWorkbook, stockHandWorkbook, yearWorkbook, monthEndWorkbook, borrowWorkbook } from "../lib/stock/excel-more";
import { stockMonthWorkbook } from "../lib/stock/excel";
import { readXlsx } from "../lib/stock/xlsx-read";
import { pickStockSheet } from "../lib/stock/import";
import { groupMovements, monthEndRows, stockStatus, yearGrid, DEFAULT_RULE, type StockItem, type StockMovement } from "../lib/stock/rules";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failed++;
};

const item = (id: string, code: string, name: string): StockItem => ({
  id, code, name, specification: "3kg*8", group: "RAW", unit: "bag", unitsPerCarton: 8, cartonPrice: 160, supplier: "Acme",
  status: "ACTIVE", reorderBelowMonths: null, shelfLifeDays: null, notes: "", ownerId: "o", ownerName: "",
});
const mv = (itemId: string, date: string, type: string, quantity: number, extra: Partial<StockMovement> = {}): StockMovement => ({
  id: `${itemId}-${date}-${type}`, itemId, date, type, quantity, party: "", unitCost: null, expiryDate: null, reference: "", notes: "",
  borrowStatus: null, borrowId: null, ownerId: "o", ...extra,
});

const items = [item("a", "1.001", "Milk powder"), item("b", "1.002", "Cups 16oz")];
const movements = [
  mv("a", "2026-08-31", "ADJUST_IN", 40, { unitCost: 20 }),
  mv("a", "2026-09-05", "TAKE", 10),
  mv("a", "2026-09-12", "TAKE", 6),
  mv("a", "2026-09-20", "PURCHASE", 16, { unitCost: 20 }),
  mv("b", "2026-08-31", "ADJUST_IN", 100, { unitCost: 1 }),
  mv("b", "2026-09-07", "TAKE", 30),
  mv("b", "2026-09-15", "BORROW", 10, { party: "Branch 2", borrowStatus: "OUTSTANDING" }),
];
const byItem = groupMovements(movements);
const heading = { title: "Test", company: "Test Co", generatedOn: "2026-10-01" };
const statuses = items.map((i) => stockStatus(i, byItem.get(i.id) ?? [], DEFAULT_RULE, "2026-10-01"));

const books: Array<[string, Uint8Array]> = [
  ["count sheet", countWorkbook(items, heading)],
  ["stock in hand", stockHandWorkbook(statuses, "2026-10-01", heading)],
  ["year grid", yearWorkbook(yearGrid(items, byItem, 2026), 2026, 10, heading)],
  ["month end", monthEndWorkbook(monthEndRows(items, byItem, "2026-10"), null, heading)],
  ["borrowed", borrowWorkbook(items, movements, "2026-10-01", heading)],
  ["month sheet", stockMonthWorkbook(items, byItem, "2026-09", () => DEFAULT_RULE, { company: "Test Co", generatedOn: "2026-10-01" })],
];
for (const [name, bytes] of books) {
  let rows = 0;
  try {
    rows = readXlsx(bytes).reduce((n, s) => n + s.rows.length, 0);
  } catch (e) {
    check(`${name} readable`, false, String(e));
    continue;
  }
  check(`${name} readable`, rows > 3, `${rows} rows`);
}

// The monthly sheet imports back into the same products and take-outs.
const sheet = pickStockSheet(readXlsx(books[5][1]));
check("month sheet re-imports", !!sheet && sheet.rows.length === 2, sheet ? `${sheet.rows.length} rows` : "no sheet");
const milk = sheet?.rows.find((r) => r.code === "1.001");
check("code + name round trip", milk?.name === "Milk powder");
check("opening 40 units", milk?.openingUnits === 40, String(milk?.openingUnits));
check("takes 10 + 6 on their dates", (milk?.takes.length ?? 0) === 2 && milk!.takes.reduce((s, t) => s + t.units, 0) === 16, JSON.stringify(milk?.takes));

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
