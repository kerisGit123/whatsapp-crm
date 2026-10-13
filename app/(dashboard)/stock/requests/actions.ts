"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { incomes, stockMovements, stockRequests } from "@/lib/db/schema";
import { requireManager, requireOrgId } from "@/lib/auth";
import { batchExists, getSettings, insertMovements, loadItemsByIds, todayIso, type MovementInput } from "@/lib/db/stock";
import { loadRequest, nextRequestNumber } from "@/lib/db/stock-orders";
import { shortUnits, unresolvedShort } from "@/lib/stock/requests";
import { cartonsAndUnits } from "@/lib/stock/rules";

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
const r2 = (n: number) => Math.round(n * 100) / 100;

const actor = async () => {
  const u = await currentUser();
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.emailAddresses[0]?.emailAddress || "";
};
const lockedMessage = (through: string | null, date: string) =>
  through && date <= through ? `Stock is locked up to ${through}. Use a later date, or ask a manager to reopen the month.` : null;

/** A branch asks for stock (or a not-yet-issued request is changed). Lines are in units. */
export async function saveRequestAction(input: { id?: string; branch?: string; notes?: string; requestId?: string; lines: Array<{ itemId: string; units: number | string }> }): Promise<Result> {
  const orgId = await requireOrgId();
  const merged = new Map<string, number>();
  for (const l of input.lines ?? []) {
    const itemId = text(l.itemId, 64);
    if (itemId && num(l.units) > 0) merged.set(itemId, r2((merged.get(itemId) ?? 0) + num(l.units)));
  }
  if (!merged.size) return fail("Put at least one item on the request.");
  const items = await loadItemsByIds(orgId, [...merged.keys()]);
  for (const id of merged.keys()) if (!items.get(id)) return fail("One of the items no longer exists.");

  const lines = [...merged].map(([itemId, requestedUnits]) => ({ itemId, requestedUnits }));
  const branch = text(input.branch, 80) || "Branch";
  const notes = text(input.notes, 500);

  if (input.id) {
    const request = await loadRequest(orgId, text(input.id, 64));
    if (!request) return fail("Request not found.");
    if (request.status !== "REQUESTED") return fail("Only a request that has not been issued can be changed.");
    await db.update(stockRequests).set({ lines, branch, notes }).where(and(eq(stockRequests.orgId, orgId), eq(stockRequests.id, request.id)));
    refresh();
    return done(`${request.number} updated.`, request.id);
  }

  const key = text(input.requestId, 64);
  if (key) {
    const [existing] = await db.select({ id: stockRequests.id }).from(stockRequests).where(and(eq(stockRequests.orgId, orgId), eq(stockRequests.requestKey, key)));
    if (existing) return done("Request already saved.", existing.id);
  }
  const date = todayIso();
  const number = await nextRequestNumber(orgId, date.slice(0, 4));
  const [row] = await db
    .insert(stockRequests)
    .values({ orgId, number, branch, requestDate: date, lines, notes, requestedBy: await actor(), requestKey: key || null })
    .returning({ id: stockRequests.id });
  refresh();
  return done(`${number} saved. The warehouse issues it from the request page.`, row.id);
}

/** The warehouse sends the stock: each line becomes a take-out to the branch. */
export async function issueRequestAction(input: { id: string; date?: string; requestId?: string; lines: Array<{ itemId: string; issuedUnits: number | string }> }): Promise<Result> {
  const orgId = await requireOrgId();
  const request = await loadRequest(orgId, text(input.id, 64));
  if (!request) return fail("Request not found.");
  if (request.status !== "REQUESTED") return fail("This request was already issued or cancelled. Reload the page.");
  const date = isDate(input.date) ? input.date : todayIso();
  const given = new Map((input.lines ?? []).map((l) => [text(l.itemId, 64), num(l.issuedUnits)]));
  const lines = request.lines.map((l) => {
    const units = given.has(l.itemId) ? (given.get(l.itemId) as number) : l.requestedUnits;
    return { ...l, issuedUnits: Number.isFinite(units) && units > 0 ? r2(units) : 0 };
  });
  if (!lines.some((l) => l.issuedUnits > 0)) return fail("Issue at least one item, or cancel the request.");
  const locked = lockedMessage((await getSettings(orgId)).lockedThrough, date);
  if (locked) return fail(locked);

  const batch = text(input.requestId, 64) || `iss-${request.id}`;
  // A retried save: the take-outs exist already, only the status may be missing.
  if (!(await batchExists(orgId, batch))) {
    const items = await loadItemsByIds(orgId, lines.map((l) => l.itemId));
    const list: Array<{ itemId: string; data: MovementInput }> = lines
      .filter((l) => l.issuedUnits > 0 && items.has(l.itemId))
      .map((l) => ({ itemId: l.itemId, data: { date, type: "TAKE", quantity: l.issuedUnits, party: request.branch, reference: request.number, notes: "Branch request", batchId: batch } }));
    await insertMovements(orgId, await actor(), list);
  }
  await db
    .update(stockRequests)
    .set({ status: "ISSUED", lines, issuedOn: date, issuedBy: await actor() })
    .where(and(eq(stockRequests.orgId, orgId), eq(stockRequests.id, request.id)));
  refresh();
  const count = lines.filter((l) => l.issuedUnits > 0).length;
  return done(`Issued ${count} item${count === 1 ? "" : "s"} to ${request.branch}. They confirm what arrived.`);
}

/** The branch counts what arrived. Less than issued makes the request "short". */
export async function receiveRequestAction(input: { id: string; date?: string; lines: Array<{ itemId: string; receivedUnits: number | string }> }): Promise<Result> {
  const orgId = await requireOrgId();
  const request = await loadRequest(orgId, text(input.id, 64));
  if (!request) return fail("Request not found.");
  if (request.status !== "ISSUED") return fail("This delivery was already confirmed, or has not been issued yet. Reload the page.");
  const items = await loadItemsByIds(orgId, request.lines.map((l) => l.itemId));
  const got = new Map((input.lines ?? []).map((l) => [text(l.itemId, 64), num(l.receivedUnits)]));
  const lines: typeof request.lines = [];

  for (const l of request.lines) {
    if (!((l.issuedUnits ?? 0) > 0)) {
      lines.push(l);
      continue;
    }
    const units = got.has(l.itemId) ? (got.get(l.itemId) as number) : (l.issuedUnits as number);
    if (!(Number.isFinite(units) && units >= 0)) return fail("Type how many arrived (0 if none).");
    if (units > (l.issuedUnits as number) + 0.001) return fail(`${items.get(l.itemId)?.name ?? "An item"}: more arrived than was issued (${l.issuedUnits}). Ask the warehouse to correct what they issued.`);
    lines.push({ ...l, receivedUnits: r2(units) });
  }
  const short = lines.filter((l) => shortUnits(l) > 0);
  await db
    .update(stockRequests)
    .set({ status: short.length ? "SHORT" : "RECEIVED", lines, receivedOn: isDate(input.date) ? input.date : todayIso(), receivedBy: await actor() })
    .where(and(eq(stockRequests.orgId, orgId), eq(stockRequests.id, request.id)));
  refresh();
  return done(short.length ? `Saved: ${short.length} item${short.length === 1 ? " is" : "s are"} short. A manager puts them back in stock or writes them off.` : "Delivery confirmed: everything arrived.");
}

/** A manager settles a shortage: back into stock, or written off as lost. */
export async function resolveShortAction(input: { id: string; how: "RETURN" | "WRITE_OFF"; date?: string; requestId?: string }): Promise<Result> {
  const orgId = await requireManager();
  const request = await loadRequest(orgId, text(input.id, 64));
  if (!request) return fail("Request not found.");
  if (request.status !== "SHORT") return fail("Nothing short to settle on this request.");
  const how = input.how === "WRITE_OFF" ? "WRITE_OFF" : "RETURN";
  const date = isDate(input.date) ? input.date : todayIso();
  const locked = lockedMessage((await getSettings(orgId)).lockedThrough, date);
  if (locked) return fail(locked);

  const pending = unresolvedShort(request);
  const batch = text(input.requestId, 64) || `short-${request.id}`;
  if (!(await batchExists(orgId, batch))) {
    const items = await loadItemsByIds(orgId, pending.map((l) => l.itemId));
    const list: Array<{ itemId: string; data: MovementInput }> = [];
    for (const l of pending.filter((p) => items.has(p.itemId))) {
      const units = shortUnits(l);
      const common = { date, quantity: units, party: request.branch, reference: request.number, batchId: batch };
      // The short units are not at the branch, so they come back into the warehouse count.
      list.push({ itemId: l.itemId, data: { ...common, type: "RETURN", notes: how === "RETURN" ? `Short delivery ${request.number}: not received by ${request.branch}, put back in stock` : `Short delivery ${request.number}: not received by ${request.branch} (undoes that part of the take-out)` } });
      // Lost on the way: bring them back, then write the same units off so the loss is on record
      // without the warehouse count dropping twice.
      if (how === "WRITE_OFF") list.push({ itemId: l.itemId, data: { ...common, type: "WASTE", reason: "LOST", notes: `Short delivery ${request.number}: lost on the way to ${request.branch}` } });
    }
    await insertMovements(orgId, await actor(), list);
  }
  const lines = request.lines.map((l) => (shortUnits(l) > 0 && !l.resolved ? { ...l, resolved: (how === "RETURN" ? "RETURNED" : "WRITTEN_OFF") as "RETURNED" | "WRITTEN_OFF" } : l));
  await db.update(stockRequests).set({ status: "RECEIVED", lines }).where(and(eq(stockRequests.orgId, orgId), eq(stockRequests.id, request.id)));
  refresh();
  return done(how === "RETURN" ? "Put back in stock." : "Written off as lost.");
}

export async function cancelRequestAction(id: string): Promise<Result> {
  const orgId = await requireOrgId();
  const request = await loadRequest(orgId, text(id, 64));
  if (!request) return fail("Request not found.");
  if (request.status !== "REQUESTED") return fail("Only a request that has not been issued can be cancelled.");
  await db.update(stockRequests).set({ status: "CANCELLED" }).where(and(eq(stockRequests.orgId, orgId), eq(stockRequests.id, request.id)));
  refresh();
  return done(`${request.number} cancelled.`);
}

/** Lent stock comes back, is swapped for something else, or is paid for. */
export async function settleBorrowAction(input: {
  movementId: string;
  how: "RETURNED" | "EXCHANGED" | "PAID";
  date?: string;
  quantity?: number | string;
  exchangeItemId?: string;
  exchangeQuantity?: number | string;
  amount?: number | string;
  notes?: string;
  requestId?: string;
}): Promise<Result> {
  const orgId = await requireOrgId();
  const [borrow] = await db.select().from(stockMovements).where(and(eq(stockMovements.orgId, orgId), eq(stockMovements.id, text(input.movementId, 64))));
  if (!borrow || borrow.type !== "BORROW") return fail("That lending was not found.");
  if ((borrow.borrowStatus ?? "OUTSTANDING") !== "OUTSTANDING") return fail("This lending is already settled.");
  const batch = text(input.requestId, 64) || `settle-${borrow.id}`;
  if (await batchExists(orgId, batch)) return done("Already settled.");

  const date = isDate(input.date) ? input.date : todayIso();
  const items = await loadItemsByIds(orgId, [borrow.itemId, text(input.exchangeItemId, 64)].filter(Boolean));
  const item = items.get(borrow.itemId);
  if (!item) return fail("The item no longer exists.");
  if (input.how !== "PAID") {
    const locked = lockedMessage((await getSettings(orgId)).lockedThrough, date);
    if (locked) return fail(locked);
  }
  const notes = text(input.notes, 300);
  const who = await actor();

  if (input.how === "RETURNED") {
    const quantity = num(input.quantity ?? borrow.quantity);
    if (!(quantity > 0)) return fail("How many came back?");
    await insertMovements(orgId, who, [{ itemId: item.id, data: { date, type: "RETURN", quantity, party: borrow.party, borrowId: borrow.id, notes, batchId: batch } }]);
  } else if (input.how === "EXCHANGED") {
    const other = items.get(text(input.exchangeItemId, 64));
    const quantity = num(input.exchangeQuantity);
    if (!other) return fail("Pick the item received in exchange.");
    if (!(quantity > 0)) return fail("How many of it came in?");
    await insertMovements(orgId, who, [
      { itemId: other.id, data: { date, type: "EXCHANGE_IN", quantity, party: borrow.party, borrowId: borrow.id, notes: `For ${cartonsAndUnits(borrow.quantity, item)} ${item.name} lent`, batchId: batch } },
    ]);
  } else if (input.how === "PAID") {
    const amount = num(input.amount);
    if (!(amount > 0)) return fail("How much was paid?");
    // The payment is money in, under Money.
    await db.insert(incomes).values({
      orgId,
      name: `Paid for ${item.name} lent (${cartonsAndUnits(borrow.quantity, item)})`,
      incomeDate: date,
      amount,
      category: "BUSINESS",
      receivedFrom: borrow.party,
      notes,
      source: `borrow:${borrow.id}`,
    });
  } else {
    return fail("Choose returned, exchanged or paid.");
  }
  await db.update(stockMovements).set({ borrowStatus: input.how }).where(eq(stockMovements.id, borrow.id));
  refresh();
  return done(input.how === "PAID" ? "Settled. The payment is recorded under Money in." : "Settled and added back to stock.");
}
