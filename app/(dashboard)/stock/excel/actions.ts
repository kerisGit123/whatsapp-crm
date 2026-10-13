"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { stockItems } from "@/lib/db/schema";
import { requireManager, requireOrgId } from "@/lib/auth";
import { batchExists, getSettings, insertMovements, loadStockData, todayIso, type MovementInput } from "@/lib/db/stock";
import { importChanges, importClosing, importComputedClosing, importDates, pickStockSheet, type ImportRow } from "@/lib/stock/import";
import { readXlsx } from "@/lib/stock/xlsx-read";
import type { StockItem } from "@/lib/stock/rules";

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const MAX_BASE64 = 12_000_000;

const actor = async () => {
  const u = await currentUser();
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.emailAddresses[0]?.emailAddress || "";
};

const unitPrice = (i: Pick<StockItem, "cartonPrice" | "unitsPerCarton">) => i.cartonPrice / (i.unitsPerCarton || 1);

export type ImportPreview = {
  ok: boolean;
  message: string;
  sheet?: { name: string; sheetDate: string | null; takeDates: string[]; inDates: string[]; warnings: string[]; balanceDiffers: string[] };
  dates?: { opening: string; closing: string };
  rows?: Array<ImportRow & { closingUnits: number; status: "NEW" | "CHANGED" | "SAME"; changes: string[]; hasRecords: boolean }>;
};

type ImportOptions = { mode: "month" | "closing"; openingDate?: string; closingDate?: string; includeOrder: boolean; includeTakes: boolean; updateDetails: boolean; supplier: string; requestId?: string };

async function plan(orgId: string, base64: string) {
  if (!base64) throw new Error("Choose the Excel file first.");
  if (base64.length > MAX_BASE64) throw new Error("That file is too big (over 9 MB). Save just the stock sheet and try again.");
  const sheet = pickStockSheet(readXlsx(new Uint8Array(Buffer.from(base64, "base64"))));
  if (!sheet || !sheet.rows.length) throw new Error('No products found. The sheet needs a heading row with "Item Code" and "Product Name".');

  const { items, movements } = await loadStockData(orgId);
  const byCode = new Map(items.filter((i) => i.code).map((i) => [i.code, i]));
  const withHistory = new Set(movements.map((m) => m.itemId));
  const rows = sheet.rows.map((row) => {
    const item = byCode.get(row.code) ?? null;
    return { row, item, changes: item ? importChanges(row, item) : [], fresh: !item || !withHistory.has(item.id), closing: importClosing(row) };
  });
  return { sheet, rows };
}

/** Read the file and say what would happen. Nothing is saved. */
export async function previewImportAction(base64: string): Promise<ImportPreview> {
  const orgId = await requireManager();
  try {
    const { sheet, rows } = await plan(orgId, base64);
    return {
      ok: true,
      message: `Read ${sheet.rows.length} products from "${sheet.sheet}". Check them, then press Import.`,
      sheet: {
        name: sheet.sheet,
        sheetDate: sheet.sheetDate,
        takeDates: sheet.takeDates,
        inDates: sheet.inDates,
        warnings: sheet.warnings,
        balanceDiffers: rows.filter((p) => p.row.balanceUnits !== null && Math.abs(p.row.balanceUnits - importComputedClosing(p.row)) > 0.01).map((p) => p.row.code),
      },
      dates: importDates(sheet, todayIso()),
      rows: rows.map((p) => ({ ...p.row, closingUnits: p.closing, status: !p.item ? "NEW" : p.changes.length ? "CHANGED" : "SAME", changes: p.changes, hasRecords: !p.fresh })),
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not read that file." };
  }
}

/** Add the products and (for products with no records yet) their starting stock. */
export async function applyImportAction(base64: string, options: ImportOptions): Promise<{ ok: boolean; message: string }> {
  const orgId = await requireManager();
  const requestId = clean(options.requestId).slice(0, 64);
  if (requestId && (await batchExists(orgId, requestId))) return { ok: true, message: "Import already saved." };

  let planned: Awaited<ReturnType<typeof plan>>;
  try {
    planned = await plan(orgId, base64);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not read that file." };
  }
  const { sheet, rows } = planned;
  const mode = options.mode === "closing" ? "closing" : "month";
  const openingDate = isDate(options.openingDate) ? options.openingDate : null;
  const closingDate = isDate(options.closingDate) ? options.closingDate : null;
  if (mode === "month" && !openingDate) return { ok: false, message: "Choose the opening date." };
  if (mode === "closing" && !closingDate) return { ok: false, message: "Choose the date of the balance." };

  const datedLines = [...(options.includeTakes ? sheet.takeDates : []), ...(options.includeOrder ? sheet.inDates : [])].sort();
  if (mode === "month" && datedLines.some((d) => d < (openingDate as string))) {
    return { ok: false, message: `The opening date must be on or before the first dated IN or OUT (${datedLines[0]}).` };
  }
  const firstDate = ([...(mode === "closing" ? [closingDate as string] : [openingDate as string, ...datedLines])].sort())[0];
  const { lockedThrough } = await getSettings(orgId);
  if (lockedThrough && firstDate <= lockedThrough) return { ok: false, message: `Stock is locked up to ${lockedThrough}. Use a later date, or reopen the month.` };

  const suggested = importDates(sheet, todayIso()).closing;
  const adjustDate = [closingDate ?? suggested, ...datedLines].sort().slice(-1)[0];

  // 1. Products: add new ones, bring changed ones up to date.
  const itemData = (row: ImportRow) => ({
    name: row.name.slice(0, 200),
    code: row.code,
    specification: row.specification.slice(0, 200),
    group: row.group,
    unit: row.unit,
    unitsPerCarton: row.unitsPerCarton,
    cartonPrice: row.cartonPrice,
  });
  const toCreate = rows.filter((p) => !p.item);
  for (let i = 0; i < toCreate.length; i += 100) {
    await db.insert(stockItems).values(toCreate.slice(i, i + 100).map((p) => ({ ...itemData(p.row), supplier: clean(options.supplier).slice(0, 120), orgId })));
  }
  const toUpdate = options.updateDetails ? rows.filter((p) => p.item && p.changes.length) : [];
  for (const p of toUpdate) {
    const item = p.item as StockItem;
    const data = itemData(p.row.perCartonGuessed ? { ...p.row, unitsPerCarton: item.unitsPerCarton } : p.row);
    await db.update(stockItems).set({ ...data, updatedAt: new Date() }).where(and(eq(stockItems.orgId, orgId), eq(stockItems.id, item.id)));
  }

  // 2. Stock lines, only for products with no records yet.
  const codes = rows.map((p) => p.row.code);
  const dbItems = (await db.select().from(stockItems).where(and(eq(stockItems.orgId, orgId), inArray(stockItems.code, codes)))).map((r) => ({ id: r.id, code: r.code, cartonPrice: r.cartonPrice, unitsPerCarton: r.unitsPerCarton }));
  const idByCode = new Map(dbItems.map((i) => [i.code, i]));
  const lines: Array<{ itemId: string; data: MovementInput }> = [];
  let skipped = 0;

  for (const p of rows) {
    const item = idByCode.get(p.row.code);
    if (!item) continue;
    if (!p.fresh) {
      skipped += 1;
      continue;
    }
    const cost = unitPrice(item);
    const common = { batchId: requestId || null, expiryDate: p.row.expiryDate };
    const add = (data: MovementInput) => lines.push({ itemId: item.id, data });

    if (mode === "closing") {
      if (p.closing > 0) add({ ...common, date: closingDate as string, type: "ADJUST_IN", quantity: p.closing, unitCost: cost, notes: "Opening balance (from Excel)" });
      continue;
    }
    if (p.row.openingUnits > 0) add({ ...common, date: openingDate as string, type: "ADJUST_IN", quantity: p.row.openingUnits, unitCost: cost, notes: "Opening balance (from Excel)" });
    if (p.row.openingUnits < 0) add({ ...common, expiryDate: null, date: openingDate as string, type: "ADJUST_OUT", quantity: -p.row.openingUnits, notes: "Opening balance below zero (from Excel)" });
    if (options.includeOrder && p.row.orderUnits > 0) add({ ...common, date: openingDate as string, type: "PURCHASE", quantity: p.row.orderUnits, unitCost: cost, party: clean(options.supplier), reference: "From Excel: this month ordering" });
    if (options.includeOrder) for (const d of p.row.ins) add({ ...common, date: d.date, type: "PURCHASE", quantity: d.units, unitCost: cost, reference: "From Excel" });
    if (options.includeTakes) for (const t of p.row.takes) add({ ...common, expiryDate: null, date: t.date, type: "TAKE", quantity: t.units, notes: "From Excel" });
    if (options.includeOrder && options.includeTakes && p.row.balanceUnits !== null) {
      const gap = Math.round((p.row.balanceUnits - importComputedClosing(p.row)) * 100) / 100;
      if (gap !== 0) add({ ...common, expiryDate: null, date: adjustDate, type: gap > 0 ? "ADJUST_IN" : "ADJUST_OUT", quantity: Math.abs(gap), notes: "From Excel: matches the sheet's balance (waste, lending or count differences)" });
    }
  }
  await insertMovements(orgId, await actor(), lines);
  revalidatePath("/stock", "layout");

  const parts = [
    toCreate.length ? `${toCreate.length} product${toCreate.length === 1 ? "" : "s"} added` : "",
    toUpdate.length ? `${toUpdate.length} updated` : "",
    `${lines.length} stock line${lines.length === 1 ? "" : "s"} recorded`,
    skipped ? `${skipped} already had records (stock left as is)` : "",
  ].filter(Boolean);
  return { ok: true, message: `Imported: ${parts.join(", ")}.` };
}

/** A count sheet filled in at the shelf: counts per product, found by item code. Nothing is saved. */
export async function readCountsAction(base64: string): Promise<{ ok: boolean; message: string; counts?: Array<{ itemId: string; units: number }>; unmatched?: string[] }> {
  const orgId = await requireOrgId();
  if (!base64) return { ok: false, message: "Choose the filled-in count sheet first." };
  if (base64.length > MAX_BASE64) return { ok: false, message: "That file is too big." };
  let sheets: ReturnType<typeof readXlsx>;
  try {
    sheets = readXlsx(new Uint8Array(Buffer.from(base64, "base64")));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not read that file." };
  }
  const { items: all } = await loadStockData(orgId);
  const items = all.filter((i) => i.status !== "DISCONTINUED");
  const byCode = new Map(items.filter((i) => i.code).map((i) => [i.code, i]));
  const byName = new Map(items.map((i) => [i.name.toLowerCase(), i]));
  const counts: Array<{ itemId: string; units: number }> = [];
  const unmatched: string[] = [];
  let found = false;

  for (const sheet of sheets) {
    const headerAt = sheet.rows.findIndex((row) => row.some((v) => /^item code/i.test(clean(v))) && row.some((v) => /counted ?\(ctn\)/i.test(clean(v))));
    if (headerAt < 0) continue;
    found = true;
    const header = sheet.rows[headerAt];
    const col = (pattern: RegExp) => header.findIndex((v) => pattern.test(clean(v)));
    const [codeCol, nameCol, ctnCol, looseCol] = [col(/^item code/i), col(/^product name/i), col(/counted ?\(ctn\)/i), col(/counted ?\(loose/i)];
    const numberOf = (v: unknown) => (v === null || v === undefined || clean(v) === "" ? null : Number(clean(v).replace(/[^0-9.-]/g, "")));

    for (const row of sheet.rows.slice(headerAt + 1)) {
      const cartons = ctnCol >= 0 ? numberOf(row[ctnCol]) : null;
      const loose = looseCol >= 0 ? numberOf(row[looseCol]) : null;
      if ((cartons === null || Number.isNaN(cartons)) && (loose === null || Number.isNaN(loose))) continue;
      const code = clean(row[codeCol]);
      const name = clean(row[nameCol]);
      const item = (code ? byCode.get(code) : undefined) ?? byName.get(name.toLowerCase());
      if (!item) {
        unmatched.push(code || name || "a row");
        continue;
      }
      const units = Math.round(((cartons || 0) * item.unitsPerCarton + (loose || 0)) * 100) / 100;
      if (units >= 0) counts.push({ itemId: item.id, units });
    }
    break;
  }
  if (!found) return { ok: false, message: 'This is not a count sheet. It needs the "Item code", "Counted (ctn)" and "Counted (loose units)" columns: download the count sheet from the Stock take screen.' };
  return {
    ok: true,
    counts,
    unmatched,
    message: counts.length ? `Read ${counts.length} counted product${counts.length === 1 ? "" : "s"}${unmatched.length ? `, ${unmatched.length} not recognised` : ""}. Check them, then save.` : 'No counts found: fill in the "Counted" columns first.',
  };
}
