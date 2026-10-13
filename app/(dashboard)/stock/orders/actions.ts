"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { stockOrders } from "@/lib/db/schema";
import { requireManager, requireOrgId } from "@/lib/auth";
import { batchExists, getSettings, insertMovements, loadItemsByIds, loadStockData, todayIso, type MovementInput } from "@/lib/db/stock";
import { loadOrder, nextOrderNumber } from "@/lib/db/stock-orders";
import { defaultExpiry, type StockItem } from "@/lib/stock/rules";
import { bookPurchaseExpense } from "@/lib/db/money";
import { normalizePhone, orderProgress, orderStatusFor, type OrderLine, type StockOrder } from "@/lib/stock/orders";

type Result = { ok: boolean; message: string; id?: string };
const fail = (message: string): Result => ({ ok: false, message });
const done = (message: string, id?: string): Result => ({ ok: true, message, id });
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const text = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const refresh = () => revalidatePath("/stock", "layout");

const actor = async () => {
  const u = await currentUser();
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.emailAddresses[0]?.emailAddress || "";
};

const lockedMessage = (through: string | null, date: string) =>
  through && date <= through ? `Stock is locked up to ${through}. Use a later date, or ask a manager to reopen the month.` : null;

/** New orders (one per supplier) or a change to a draft. Lines are in cartons. */
export async function saveOrderAction(input: { id?: string; date?: string; notes?: string; requestId?: string; lines: Array<{ itemId: string; cartons: number | string }> }): Promise<Result> {
  const orgId = await requireManager();
  const date = isDate(input.date) ? input.date : todayIso();
  const wanted = (input.lines ?? []).map((l) => ({ itemId: text(l.itemId, 64), cartons: num(l.cartons) })).filter((l) => l.itemId && l.cartons > 0);
  if (!wanted.length) return fail("Put at least one carton on the order.");

  const items = await loadItemsByIds(orgId, wanted.map((l) => l.itemId));
  for (const l of wanted) if (!items.get(l.itemId)) return fail("One of the items no longer exists.");
  const lineOf = (l: { itemId: string; cartons: number }): OrderLine => {
    const item = items.get(l.itemId) as StockItem;
    return { itemId: l.itemId, orderedUnits: Math.round(l.cartons * (item.unitsPerCarton || 1) * 100) / 100, cartonPrice: item.cartonPrice };
  };

  if (input.id) {
    const order = await loadOrder(orgId, text(input.id, 64));
    if (!order) return fail("Order not found.");
    if (order.status !== "DRAFT") return fail("Only a draft order can be changed. Cancel it and make a new one instead.");
    await db
      .update(stockOrders)
      .set({ lines: wanted.map(lineOf), orderDate: date, notes: text(input.notes, 500) })
      .where(and(eq(stockOrders.orgId, orgId), eq(stockOrders.id, order.id)));
    refresh();
    return done(`${order.number} updated.`, order.id);
  }

  // One order per supplier.
  const groups = new Map<string, typeof wanted>();
  for (const l of wanted) {
    const key = (items.get(l.itemId) as StockItem).supplier || "No supplier";
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  const requestId = text(input.requestId, 64);
  const made: string[] = [];
  let firstId: string | undefined;
  let index = 0;

  for (const [supplier, list] of groups) {
    const key = requestId ? `${requestId}#${index++}` : null;
    if (key) {
      const [existing] = await db.select({ id: stockOrders.id }).from(stockOrders).where(and(eq(stockOrders.orgId, orgId), eq(stockOrders.requestKey, key)));
      if (existing) return done("Order already saved.", existing.id);
    }
    // The supplier's number is remembered from their last order.
    const [previous] = await db
      .select({ phone: stockOrders.supplierPhone })
      .from(stockOrders)
      .where(and(eq(stockOrders.orgId, orgId), eq(stockOrders.supplier, supplier)))
      .orderBy(desc(stockOrders.createdAt))
      .limit(1);
    const number = await nextOrderNumber(orgId, date.slice(0, 4));
    const [row] = await db
      .insert(stockOrders)
      .values({ orgId, number, supplier, supplierPhone: previous?.phone ?? "", orderDate: date, lines: list.map(lineOf), notes: text(input.notes, 500), requestKey: key })
      .returning({ id: stockOrders.id });
    firstId ??= row.id;
    made.push(`${number} (${supplier})`);
  }
  refresh();
  return done(`Order saved: ${made.join(", ")}. Send it to the supplier, then mark it as sent.`, made.length === 1 ? firstId : undefined);
}

export async function setOrderPhoneAction(orderId: string, phone: string): Promise<Result> {
  const orgId = await requireManager();
  const order = await loadOrder(orgId, orderId);
  if (!order) return fail("Order not found.");
  const normalized = normalizePhone(text(phone, 40));
  if (!normalized) return fail("That does not look like a phone number. Use the supplier's WhatsApp number, e.g. 012-345 6789 or +60 12 345 6789.");
  await db.update(stockOrders).set({ supplierPhone: normalized }).where(and(eq(stockOrders.orgId, orgId), eq(stockOrders.id, orderId)));
  refresh();
  return done(`Saved ${normalized} for ${order.supplier}.`);
}

export async function setOrderStatusAction(orderId: string, wanted: "SENT" | "CANCELLED" | "CLOSE_REST" | "DRAFT", supplierRef = ""): Promise<Result> {
  const orgId = await requireManager();
  const order = await loadOrder(orgId, orderId);
  if (!order) return fail("Order not found.");
  const { byItem, movements } = await loadStockData(orgId);
  void byItem;
  const progress = orderProgress(order, movements);
  const set = async (values: Partial<typeof stockOrders.$inferInsert>) => {
    await db.update(stockOrders).set(values).where(and(eq(stockOrders.orgId, orgId), eq(stockOrders.id, orderId)));
    refresh();
  };

  if (wanted === "SENT") {
    if (order.status !== "DRAFT") return fail("Only a draft can be marked as sent.");
    await set({ status: "SENT", ...(text(supplierRef, 120) ? { supplierRef: text(supplierRef, 120) } : {}) });
    return done(`${order.number} marked as sent to ${order.supplier}.`);
  }
  if (wanted === "CANCELLED") {
    if (progress.received > 0) return fail('Some goods already arrived. Use "close the rest" instead.');
    await set({ status: "CANCELLED" });
    return done(`${order.number} cancelled.`);
  }
  if (wanted === "CLOSE_REST") {
    await set({ lines: order.lines.map((l) => ({ ...l, closed: true })), status: "RECEIVED" });
    return done(`${order.number} closed; anything not received is no longer on order.`);
  }
  if (order.status !== "CANCELLED" && order.status !== "SENT") return fail("Only a sent or cancelled order can go back to draft.");
  await set({ status: progress.received > 0 ? "PARTLY_RECEIVED" : "DRAFT" });
  return done(`${order.number} is open again.`);
}

export type ReceiveInput = {
  orderId: string;
  date: string;
  reference?: string;
  requestId?: string;
  lines: Array<{ itemId: string; units: number | string; expiryDate?: string | null; close?: boolean; cartonPrice?: number | string | null }>;
};

/** Goods arrived against an order: purchase lines, then the order's status follows. */
export async function receiveOrderAction(input: ReceiveInput): Promise<Result> {
  const orgId = await requireOrgId(); // staff at the back door receive deliveries
  const order = await loadOrder(orgId, text(input.orderId, 64));
  if (!order) return fail("Order not found.");
  if (order.status === "CANCELLED" || order.status === "RECEIVED") return fail("This order is already finished.");
  if (order.status === "DRAFT") return fail("Mark the order as sent before receiving goods.");
  if (!isDate(input.date)) return fail("Pick the date the goods arrived.");
  const locked = lockedMessage((await getSettings(orgId)).lockedThrough, input.date);
  if (locked) return fail(locked);

  const batch = text(input.requestId, 64) || `rcv-${crypto.randomUUID()}`;
  if (await batchExists(orgId, batch)) return done("Already saved.");

  const lines = (input.lines ?? []).map((l) => ({
    itemId: text(l.itemId, 64),
    units: num(l.units) || 0,
    expiryDate: isDate(l.expiryDate) ? l.expiryDate : null,
    close: l.close === true,
    cartonPrice: num(l.cartonPrice) > 0 ? num(l.cartonPrice) : null, // what the invoice says, when it differs
  }));
  const ordered = new Map(order.lines.map((l) => [l.itemId, l]));
  if (lines.some((l) => !ordered.has(l.itemId))) return fail("A line is not on this order.");
  if (!lines.some((l) => l.units > 0 || l.close)) return fail("Type what arrived (or mark a line as not coming).");

  const items = await loadItemsByIds(orgId, lines.map((l) => l.itemId));
  const reference = text(input.reference, 120) || order.supplierRef || order.number;
  const list: Array<{ itemId: string; data: MovementInput }> = lines
    .filter((l) => l.units > 0)
    .map((l) => {
      const item = items.get(l.itemId) as StockItem;
      return {
        itemId: l.itemId,
        data: {
          date: input.date,
          type: "PURCHASE",
          quantity: l.units,
          party: order.supplier,
          unitCost: (l.cartonPrice ?? ordered.get(l.itemId)?.cartonPrice ?? item.cartonPrice) / (item.unitsPerCarton || 1),
          expiryDate: l.expiryDate ?? (defaultExpiry(item, input.date) || null),
          reference,
          notes: `Order ${order.number}`,
          batchId: batch,
          orderId: order.id,
        },
      };
    });
  await insertMovements(orgId, await actor(), list);
  await bookPurchaseExpense(
    orgId,
    batch,
    lines
      .filter((l) => l.units > 0)
      .map((l) => {
        const item = items.get(l.itemId) as StockItem;
        return { item, units: l.units, unitCost: (l.cartonPrice ?? ordered.get(l.itemId)?.cartonPrice ?? item.cartonPrice) / (item.unitsPerCarton || 1) };
      }),
    { date: input.date, supplier: order.supplier, reference },
  );

  // Lines that will not come any more stop counting as on order.
  const closing = new Set(lines.filter((l) => l.close).map((l) => l.itemId));
  const updated: StockOrder = { ...order, lines: order.lines.map((l) => (closing.has(l.itemId) ? { ...l, closed: true } : l)) };
  const { movements } = await loadStockData(orgId);
  const status = orderStatusFor(updated, orderProgress(updated, movements).lines);
  await db
    .update(stockOrders)
    .set({ lines: updated.lines, status, ...(text(input.reference, 120) && !order.supplierRef ? { supplierRef: text(input.reference, 120) } : {}) })
    .where(and(eq(stockOrders.orgId, orgId), eq(stockOrders.id, order.id)));
  refresh();
  return done(status === "RECEIVED" ? `${order.number} is complete.` : `Received. ${order.number} still has items to come.`);
}
