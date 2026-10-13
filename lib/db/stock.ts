import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";
import { db } from "./index";
import { stockItems, stockMovements, stockSettings } from "./schema";
import { averageUnitCost, balanceOf, groupMovements, type StockItem, type StockMovement, type StockRule } from "@/lib/stock/rules";
import { DEFAULT_ORDER_UP_TO_MONTHS, DEFAULT_REORDER_BELOW_MONTHS } from "@/lib/stock/types";

export type MovementInput = {
  date: string;
  type: string;
  quantity: number;
  party?: string;
  unitCost?: number | null;
  expiryDate?: string | null;
  reference?: string;
  notes?: string;
  borrowStatus?: string | null;
  reason?: string | null;
  batchId?: string | null;
};

export const todayIso = () => new Date().toISOString().slice(0, 10);

const toItem = (r: typeof stockItems.$inferSelect): StockItem => ({
  id: r.id,
  code: r.code,
  name: r.name,
  specification: r.specification,
  group: r.group,
  unit: r.unit,
  unitsPerCarton: r.unitsPerCarton,
  cartonPrice: r.cartonPrice,
  supplier: r.supplier,
  status: r.status,
  reorderBelowMonths: r.reorderBelowMonths,
  shelfLifeDays: r.shelfLifeDays,
  notes: r.notes,
  ownerId: r.orgId,
  ownerName: "",
});

const toMovement = (r: typeof stockMovements.$inferSelect): StockMovement => ({
  id: r.id,
  itemId: r.itemId,
  date: r.movementDate,
  type: r.type,
  quantity: r.quantity,
  party: r.party,
  unitCost: r.unitCost,
  expiryDate: r.expiryDate,
  reference: r.reference,
  notes: r.notes,
  borrowStatus: r.borrowStatus,
  borrowId: r.borrowId,
  batchId: r.batchId,
  orderId: r.orderId,
  recordedBy: r.recordedBy,
  reason: r.reason ?? undefined,
  ownerId: r.orgId,
});

export async function getSettings(orgId: string) {
  const [row] = await db.select().from(stockSettings).where(eq(stockSettings.orgId, orgId));
  return {
    rule: {
      reorderBelow: row?.reorderBelow ?? DEFAULT_REORDER_BELOW_MONTHS,
      orderUpTo: row?.orderUpTo ?? DEFAULT_ORDER_UP_TO_MONTHS,
      leadDays: row?.leadDays ?? 0,
    } as StockRule,
    lockedThrough: row?.lockedThrough ?? null,
  };
}

/** Everything the Stock page needs for one workspace. */
export async function loadStockData(orgId: string) {
  const [itemRows, moveRows, settings] = await Promise.all([
    db.select().from(stockItems).where(eq(stockItems.orgId, orgId)).orderBy(asc(stockItems.name)),
    db
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.orgId, orgId), isNull(stockMovements.deletedAt)))
      .orderBy(asc(stockMovements.movementDate), asc(stockMovements.createdAt)),
    getSettings(orgId),
  ]);
  const movements = moveRows.map(toMovement);
  const byItem = groupMovements(movements);
  const items = itemRows.map((r) => {
    const item = toItem(r);
    item.avgUnitCost = averageUnitCost(byItem.get(item.id) ?? []);
    return item;
  });
  return { items, movements, byItem, ...settings };
}

export async function loadItem(orgId: string, id: string) {
  const [row] = await db.select().from(stockItems).where(and(eq(stockItems.orgId, orgId), eq(stockItems.id, id)));
  return row ? toItem(row) : null;
}

export async function loadItemMovements(orgId: string, itemId: string) {
  const rows = await db
    .select()
    .from(stockMovements)
    .where(and(eq(stockMovements.orgId, orgId), eq(stockMovements.itemId, itemId), isNull(stockMovements.deletedAt)))
    .orderBy(asc(stockMovements.movementDate), asc(stockMovements.createdAt));
  return rows.map(toMovement);
}

export async function loadItemsByIds(orgId: string, ids: string[]) {
  if (!ids.length) return new Map<string, StockItem>();
  const rows = await db.select().from(stockItems).where(and(eq(stockItems.orgId, orgId), inArray(stockItems.id, ids)));
  return new Map(rows.map((r) => [r.id, toItem(r)]));
}

/** Movements of the given items up to (and including) a date, for stock takes. */
export async function loadMovementsUpTo(orgId: string, itemIds: string[], date: string) {
  if (!itemIds.length) return new Map<string, StockMovement[]>();
  const rows = await db
    .select()
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.orgId, orgId),
        inArray(stockMovements.itemId, itemIds),
        isNull(stockMovements.deletedAt),
        lte(stockMovements.movementDate, date),
      ),
    );
  return groupMovements(rows.map(toMovement));
}

export async function batchExists(orgId: string, batchId: string) {
  const [row] = await db
    .select({ id: stockMovements.id })
    .from(stockMovements)
    .where(and(eq(stockMovements.orgId, orgId), eq(stockMovements.batchId, batchId)))
    .limit(1);
  return Boolean(row);
}

export async function insertMovements(orgId: string, recordedBy: string, list: Array<{ itemId: string; data: MovementInput }>) {
  for (let i = 0; i < list.length; i += 100) {
    await db.insert(stockMovements).values(
      list.slice(i, i + 100).map(({ itemId, data }) => ({
        orgId,
        itemId,
        movementDate: data.date,
        type: data.type,
        quantity: Math.round(data.quantity * 100) / 100,
        party: data.party ?? "",
        unitCost: data.unitCost ?? null,
        expiryDate: data.expiryDate || null,
        reference: data.reference ?? "",
        notes: data.notes ?? "",
        borrowStatus: data.borrowStatus ?? null,
        reason: data.reason ?? null,
        batchId: data.batchId ?? null,
        recordedBy,
      })),
    );
  }
}

export { balanceOf };
