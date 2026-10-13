"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { stockItems, stockMovements, stockSettings } from "@/lib/db/schema";
import { requireManager, requireOrgId } from "@/lib/auth";
import {
  batchExists,
  getSettings,
  insertMovements,
  loadItem,
  loadItemMovements,
  loadItemsByIds,
  loadMovementsUpTo,
  todayIso,
  type MovementInput,
} from "@/lib/db/stock";
import { balanceOf, cartonsAndUnits, defaultExpiry, unitPrice } from "@/lib/stock/rules";
import { STOCK_GROUPS, WASTE_REASONS } from "@/lib/stock/types";

export type Result = { ok: boolean; message: string; id?: string };

const fail = (message: string): Result => ({ ok: false, message });
const done = (message: string, id?: string): Result => ({ ok: true, message, id });
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const text = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const RECORDABLE = ["PURCHASE", "TAKE", "BORROW", "WASTE", "RETURN", "EXCHANGE_IN"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const lockedMessage = (through: string | null, date: string) =>
  through && date <= through
    ? `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)} is closed (stock is locked up to ${through}). Use a later date, or ask a manager to reopen the month.`
    : null;

const actor = async () => {
  const u = await currentUser();
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.emailAddresses[0]?.emailAddress || "";
};

const refresh = () => revalidatePath("/stock", "layout");

export async function saveItemAction(input: Record<string, unknown>): Promise<Result> {
  const orgId = await requireManager(); // staff may not add items or change prices
  const id = text(input.id, 64);
  const name = text(input.name, 200);
  const perCarton = num(input.unitsPerCarton);
  const price = num(input.cartonPrice);
  const reorder = input.reorderBelowMonths === "" || input.reorderBelowMonths == null ? null : num(input.reorderBelowMonths);
  const shelfLife = input.shelfLifeDays === "" || input.shelfLifeDays == null ? null : Math.round(num(input.shelfLifeDays));

  if (!name) return fail("Give the item a name.");
  if (!(perCarton > 0)) return fail("Units per carton must be 1 or more.");
  if (!(price >= 0)) return fail("Carton price must be a number.");
  if (reorder !== null && !(reorder > 0)) return fail("Re-order below must be more than 0 months, or empty.");
  if (shelfLife !== null && !(shelfLife >= 1 && shelfLife <= 3650)) return fail("Shelf life is a number of days, 1 to 3650 (or leave it empty).");

  const data = {
    name,
    code: text(input.code, 40),
    specification: text(input.specification, 200),
    group: STOCK_GROUPS.some((g) => g.value === input.group) ? String(input.group) : "RAW",
    unit: text(input.unit, 30),
    unitsPerCarton: perCarton,
    cartonPrice: price,
    supplier: text(input.supplier, 120),
    reorderBelowMonths: reorder,
    shelfLifeDays: shelfLife,
    notes: text(input.notes, 500),
    updatedAt: new Date(),
  };

  if (id) {
    const existing = await loadItem(orgId, id);
    if (!existing) return fail("Item not found.");
    await db.update(stockItems).set(data).where(and(eq(stockItems.orgId, orgId), eq(stockItems.id, id)));
    refresh();
    return done("Item saved.", id);
  }

  const opening = num(input.openingUnits);
  const openingDate = isDate(input.openingDate) ? input.openingDate : todayIso();
  if (opening > 0) {
    const locked = lockedMessage((await getSettings(orgId)).lockedThrough, openingDate);
    if (locked) return fail(locked);
  }
  const [created] = await db.insert(stockItems).values({ ...data, orgId }).returning({ id: stockItems.id });
  if (opening > 0) {
    await insertMovements(orgId, await actor(), [
      {
        itemId: created.id,
        data: {
          date: openingDate,
          type: "ADJUST_IN",
          quantity: opening,
          unitCost: price / perCarton,
          expiryDate: isDate(input.expiryDate) ? input.expiryDate : null,
          notes: "Opening balance",
        },
      },
    ]);
  }
  refresh();
  return done("Item added.", created.id);
}

export async function setStatusAction(itemId: string, status: "ACTIVE" | "DISCONTINUED", writeOff = false): Promise<Result> {
  const orgId = await requireManager();
  const item = await loadItem(orgId, itemId);
  if (!item) return fail("Item not found.");

  if (status === "DISCONTINUED") {
    const balance = balanceOf(await loadItemMovements(orgId, itemId));
    if (balance > 0 && !writeOff) {
      return fail(`${cartonsAndUnits(balance, item)} is still in stock. Use it up first, or write it off as waste.`);
    }
    if (balance > 0) {
      const date = todayIso();
      const locked = lockedMessage((await getSettings(orgId)).lockedThrough, date);
      if (locked) return fail(locked);
      await insertMovements(orgId, await actor(), [
        { itemId, data: { date, type: "WASTE", reason: "DISCONTINUED", quantity: balance, notes: "Written off when discontinued" } },
      ]);
    }
  }
  await db.update(stockItems).set({ status, updatedAt: new Date() }).where(and(eq(stockItems.orgId, orgId), eq(stockItems.id, itemId)));
  refresh();
  return done(status === "DISCONTINUED" ? `${item.name} is discontinued.` : `${item.name} is active again.`);
}

export type RecordInput = {
  type: string;
  date: string;
  party?: string;
  reference?: string;
  notes?: string;
  reason?: string;
  requestId?: string;
  lines: Array<{ itemId: string; quantity: number | string; unitCost?: number | string | null; expiryDate?: string | null }>;
};

export async function recordAction(input: RecordInput): Promise<Result> {
  const orgId = await requireOrgId(); // staff record stock in and out
  const type = text(input.type, 20);
  const lines = Array.isArray(input.lines) ? input.lines : [];

  if (!RECORDABLE.includes(type)) return fail("Pick what happened (purchase, taken out, lent...).");
  if (!isDate(input.date)) return fail("Pick a date.");
  if (!lines.length) return fail("Add at least one item.");
  if (type === "BORROW" && !text(input.party)) return fail("Say which branch borrowed it.");
  const reason = type === "WASTE" ? text(input.reason, 20) : "";
  if (type === "WASTE" && !WASTE_REASONS.some((r) => r.pick && r.value === reason)) {
    return fail("Pick why it was wasted (expired, spilled, staff meal...).");
  }

  const requestId = text(input.requestId, 64) || `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  if (await batchExists(orgId, requestId)) return done("Already saved.");

  const items = await loadItemsByIds(orgId, lines.map((l) => text(l.itemId, 64)));
  for (const line of lines) {
    const item = items.get(text(line.itemId, 64));
    if (!(num(line.quantity) > 0)) return fail("Each line needs a quantity more than 0.");
    if (!item) return fail("One of the items no longer exists.");
    if (item.status === "DISCONTINUED" && type === "PURCHASE") return fail(`${item.name} is discontinued. Reactivate it before buying more.`);
  }
  const locked = lockedMessage((await getSettings(orgId)).lockedThrough, input.date);
  if (locked) return fail(locked);

  await insertMovements(
    orgId,
    await actor(),
    lines.map((line) => {
      const item = items.get(text(line.itemId, 64))!;
      const cost = line.unitCost === undefined || line.unitCost === null || line.unitCost === "" ? NaN : num(line.unitCost);
      const data: MovementInput = {
        date: input.date,
        type,
        quantity: num(line.quantity),
        party: text(input.party, 120),
        unitCost: type === "PURCHASE" ? (cost >= 0 ? cost : unitPrice(item)) : null,
        expiryDate: isDate(line.expiryDate) ? line.expiryDate : type === "PURCHASE" ? defaultExpiry(item, input.date) || null : null,
        reference: text(input.reference, 120),
        notes: text(input.notes, 500),
        reason: reason || null,
        borrowStatus: type === "BORROW" ? "OUTSTANDING" : null,
        batchId: requestId,
      };
      return { itemId: item.id, data };
    }),
  );
  refresh();
  return done(`Recorded ${lines.length} line${lines.length === 1 ? "" : "s"}.`);
}

export async function stockTakeAction(input: { date?: string; requestId?: string; counts: Array<{ itemId: string; counted: number | string }> }): Promise<Result> {
  const orgId = await requireOrgId();
  const date = isDate(input.date) ? input.date : todayIso();
  const requestId = text(input.requestId, 64) || `take-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  if (await batchExists(orgId, requestId)) return done("Stock take already saved.");

  const counts = (input.counts ?? []).filter((c) => c.counted !== "" && num(c.counted) >= 0);
  const locked = lockedMessage((await getSettings(orgId)).lockedThrough, date);
  if (locked) return fail(locked);

  const items = await loadItemsByIds(orgId, counts.map((c) => text(c.itemId, 64)));
  const movements = await loadMovementsUpTo(orgId, [...items.keys()], date);
  const adjustments: Array<{ itemId: string; data: MovementInput }> = [];

  for (const entry of counts) {
    const item = items.get(text(entry.itemId, 64));
    if (!item) continue;
    const counted = num(entry.counted);
    const expected = balanceOf(movements.get(item.id) ?? []);
    const diff = Math.round((counted - expected) * 100) / 100;
    if (diff === 0) continue;
    adjustments.push({
      itemId: item.id,
      data: {
        date,
        type: diff > 0 ? "ADJUST_IN" : "ADJUST_OUT",
        quantity: Math.abs(diff),
        notes: `Stock take: counted ${counted}, expected ${expected}`,
        batchId: requestId,
        reason: diff < 0 ? "COUNT" : null,
      },
    });
  }
  await insertMovements(orgId, await actor(), adjustments);
  refresh();
  const n = adjustments.length;
  return done(n ? `Stock take saved: ${n} item${n === 1 ? "" : "s"} adjusted.` : "Stock take saved: everything matched.");
}

export async function deleteMovementAction(movementId: string): Promise<Result> {
  const orgId = await requireManager(); // staff cannot remove recorded lines
  const [m] = await db
    .select({ id: stockMovements.id, date: stockMovements.movementDate })
    .from(stockMovements)
    .where(and(eq(stockMovements.orgId, orgId), eq(stockMovements.id, movementId)));
  if (!m) return fail("Movement not found.");
  const locked = lockedMessage((await getSettings(orgId)).lockedThrough, m.date);
  if (locked) return fail(locked);
  await db.update(stockMovements).set({ deletedAt: new Date() }).where(eq(stockMovements.id, movementId));
  refresh();
  return done("Removed.");
}

export async function saveRuleAction(input: { reorderBelow: number | string; orderUpTo: number | string; leadDays: number | string }): Promise<Result> {
  const orgId = await requireManager();
  const reorderBelow = num(input.reorderBelow);
  const orderUpTo = num(input.orderUpTo);
  const leadDays = Math.round(num(input.leadDays) || 0);
  if (!(reorderBelow > 0) || !(orderUpTo > 0)) return fail("Months must be more than 0.");
  if (!(leadDays >= 0 && leadDays <= 120)) return fail("Delivery days must be 0 to 120.");
  await db
    .insert(stockSettings)
    .values({ orgId, reorderBelow, orderUpTo, leadDays })
    .onConflictDoUpdate({ target: stockSettings.orgId, set: { reorderBelow, orderUpTo, leadDays } });
  refresh();
  return done("Saved.");
}
