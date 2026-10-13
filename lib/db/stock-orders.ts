import { and, desc, eq, like } from "drizzle-orm";
import { db } from "./index";
import { stockOrders, stockRequests } from "./schema";
import { parseOrderLines, type StockOrder } from "@/lib/stock/orders";
import { parseRequestLines, type StockRequest } from "@/lib/stock/requests";

const toOrder = (r: typeof stockOrders.$inferSelect): StockOrder => ({
  id: r.id,
  number: r.number,
  supplier: r.supplier,
  date: r.orderDate,
  status: r.status,
  supplierRef: r.supplierRef,
  supplierPhone: r.supplierPhone,
  notes: r.notes,
  ownerId: r.orgId,
  lines: parseOrderLines(r.lines),
});

const toRequest = (r: typeof stockRequests.$inferSelect): StockRequest => ({
  id: r.id,
  number: r.number,
  branch: r.branch,
  date: r.requestDate,
  status: r.status,
  notes: r.notes,
  requestedBy: r.requestedBy,
  issuedOn: r.issuedOn,
  issuedBy: r.issuedBy,
  receivedOn: r.receivedOn,
  receivedBy: r.receivedBy,
  ownerId: r.orgId,
  lines: parseRequestLines(r.lines),
});

export async function loadOrders(orgId: string) {
  const rows = await db.select().from(stockOrders).where(eq(stockOrders.orgId, orgId)).orderBy(desc(stockOrders.orderDate), desc(stockOrders.createdAt));
  return rows.map(toOrder);
}

export async function loadOrder(orgId: string, id: string) {
  const [row] = await db.select().from(stockOrders).where(and(eq(stockOrders.orgId, orgId), eq(stockOrders.id, id)));
  return row ? toOrder(row) : null;
}

/** ORD-2026-0001: the next free number for the year in this workspace. */
export async function nextOrderNumber(orgId: string, year: string) {
  const rows = await db.select({ n: stockOrders.number }).from(stockOrders).where(and(eq(stockOrders.orgId, orgId), like(stockOrders.number, `ORD-${year}-%`)));
  const max = rows.reduce((m, r) => Math.max(m, Number(r.n.split("-")[2]) || 0), 0);
  return `ORD-${year}-${String(max + 1).padStart(4, "0")}`;
}

export async function loadRequests(orgId: string) {
  const rows = await db.select().from(stockRequests).where(eq(stockRequests.orgId, orgId)).orderBy(desc(stockRequests.requestDate), desc(stockRequests.createdAt));
  return rows.map(toRequest);
}

export async function loadRequest(orgId: string, id: string) {
  const [row] = await db.select().from(stockRequests).where(and(eq(stockRequests.orgId, orgId), eq(stockRequests.id, id)));
  return row ? toRequest(row) : null;
}

export async function nextRequestNumber(orgId: string, year: string) {
  const rows = await db.select({ n: stockRequests.number }).from(stockRequests).where(and(eq(stockRequests.orgId, orgId), like(stockRequests.number, `REQ-${year}-%`)));
  const max = rows.reduce((m, r) => Math.max(m, Number(r.n.split("-")[2]) || 0), 0);
  return `REQ-${year}-${String(max + 1).padStart(4, "0")}`;
}
