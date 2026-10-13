/* eslint-disable @typescript-eslint/no-explicit-any */
// Copy one Twenty workspace's stock (items, movements, orders, requests, rule) into this app.
//
//   node --env-file=.env.local --import tsx scripts/migrate-from-twenty.mts --file <dump.json> --org <clerk org id>           (dry run: reads and checks, writes nothing)
//   node --env-file=.env.local --import tsx scripts/migrate-from-twenty.mts --file <dump.json> --org <clerk org id> --apply   (writes)
//   add --selftest to apply into a throwaway org, verify every balance, then delete it again
//
// The dump is what `dump-data.mjs` writes: { owner, items, movements, orders, requests }.
// It refuses to write into a workspace that already has stock items.
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { stockItems, stockMovements, stockOrders, stockRequests, stockSettings } from "../lib/db/schema";
import { loadStockData } from "../lib/db/stock";
import { balanceOf, groupMovements, type StockMovement } from "../lib/stock/rules";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const file = arg("file");
const selftest = flag("selftest");
const orgId = selftest ? `org_migtest_${Date.now()}` : arg("org");
if (!file || !orgId) {
  console.error("Usage: --file <dump.json> --org <clerk org id> [--apply] | --selftest");
  process.exit(2);
}
const apply = flag("apply") || selftest;
const dump = JSON.parse(readFileSync(file, "utf8")) as {
  owner: { name: string; rule?: { reorderBelow: number; orderUpTo: number; leadDays?: number }; lockedThrough?: string | null };
  items: Array<Record<string, any>>;
  movements: StockMovement[];
  orders: Array<Record<string, any>>;
  requests: Array<Record<string, any>>;
};

const [existing] = await db.select({ id: stockItems.id }).from(stockItems).where(eq(stockItems.orgId, orgId)).limit(1);
if (existing && !selftest) {
  console.error(`${orgId} already has stock items. Refusing to write into it.`);
  process.exit(1);
}

const itemIds = new Set(dump.items.map((i) => i.id));
const orphan = dump.movements.filter((m) => !itemIds.has(m.itemId));
console.log(`Source "${dump.owner.name}": ${dump.items.length} items, ${dump.movements.length} movements, ${dump.orders.length} orders, ${dump.requests.length} requests`);
if (orphan.length) console.log(`  skipping ${orphan.length} movements whose item is missing`);

const oldBalance = new Map<string, number>();
const oldByItem = groupMovements(dump.movements.filter((m) => itemIds.has(m.itemId)));
for (const item of dump.items) oldBalance.set(item.id, balanceOf(oldByItem.get(item.id) ?? []));

if (!apply) {
  console.log(`Dry run only. ${[...oldBalance.values()].filter((b) => b !== 0).length} items have stock. Add --apply to write into ${orgId}.`);
  process.exit(0);
}

try {
  // Items (new ids; keep a map for the rest).
  const idMap = new Map<string, string>();
  for (let i = 0; i < dump.items.length; i += 100) {
    const chunk = dump.items.slice(i, i + 100);
    const rows = await db
      .insert(stockItems)
      .values(
        chunk.map((it) => ({
          orgId,
          code: it.code ?? "",
          name: it.name,
          specification: it.specification ?? "",
          group: it.group ?? "RAW",
          unit: it.unit ?? "",
          unitsPerCarton: it.unitsPerCarton ?? 1,
          cartonPrice: it.cartonPrice ?? 0,
          supplier: it.supplier ?? "",
          status: it.status ?? "ACTIVE",
          reorderBelowMonths: it.reorderBelowMonths ?? null,
          shelfLifeDays: it.shelfLifeDays ?? null,
          notes: it.notes ?? "",
        })),
      )
      .returning({ id: stockItems.id });
    chunk.forEach((it, n) => idMap.set(it.id, rows[n].id));
  }

  // Orders first, so movements can point at them.
  const orderMap = new Map<string, string>();
  for (const o of dump.orders) {
    const [row] = await db
      .insert(stockOrders)
      .values({
        orgId,
        number: o.number,
        supplier: o.supplier ?? "",
        supplierPhone: o.supplierPhone ?? "",
        supplierRef: o.supplierRef ?? "",
        orderDate: o.date,
        status: o.status ?? "DRAFT",
        notes: o.notes ?? "",
        lines: (o.lines ?? []).filter((l: any) => idMap.has(l.itemId)).map((l: any) => ({ ...l, itemId: idMap.get(l.itemId) })),
      })
      .returning({ id: stockOrders.id });
    orderMap.set(o.id, row.id);
  }

  // Movements (borrowId points at another movement: remapped after insert).
  const moveMap = new Map<string, string>();
  const moves = dump.movements.filter((m) => idMap.has(m.itemId));
  for (let i = 0; i < moves.length; i += 100) {
    const chunk = moves.slice(i, i + 100);
    const rows = await db
      .insert(stockMovements)
      .values(
        chunk.map((m) => ({
          orgId,
          itemId: idMap.get(m.itemId) as string,
          movementDate: m.date,
          type: m.type,
          quantity: m.quantity,
          party: m.party ?? "",
          unitCost: m.unitCost ?? null,
          expiryDate: m.expiryDate ?? null,
          reference: m.reference ?? "",
          notes: m.notes ?? "",
          borrowStatus: m.borrowStatus ?? null,
          batchId: m.batchId ?? null,
          orderId: m.orderId ? orderMap.get(m.orderId) ?? null : null,
          reason: m.reason ?? null,
          recordedBy: m.recordedBy ?? "",
        })),
      )
      .returning({ id: stockMovements.id });
    chunk.forEach((m, n) => moveMap.set(m.id, rows[n].id));
  }
  for (const m of moves.filter((x) => x.borrowId && moveMap.has(x.borrowId))) {
    await db.update(stockMovements).set({ borrowId: moveMap.get(m.borrowId as string) }).where(eq(stockMovements.id, moveMap.get(m.id) as string));
  }

  for (const r of dump.requests) {
    await db.insert(stockRequests).values({
      orgId,
      number: r.number,
      branch: r.branch ?? "",
      requestDate: r.date,
      status: r.status ?? "REQUESTED",
      notes: r.notes ?? "",
      requestedBy: r.requestedBy ?? "",
      issuedOn: r.issuedOn ?? null,
      issuedBy: r.issuedBy ?? "",
      receivedOn: r.receivedOn ?? null,
      receivedBy: r.receivedBy ?? "",
      lines: (r.lines ?? []).filter((l: any) => idMap.has(l.itemId)).map((l: any) => ({ ...l, itemId: idMap.get(l.itemId) })),
    });
  }

  const rule = dump.owner.rule ?? { reorderBelow: 2, orderUpTo: 2.5, leadDays: 0 };
  await db
    .insert(stockSettings)
    .values({ orgId, reorderBelow: rule.reorderBelow, orderUpTo: rule.orderUpTo, leadDays: rule.leadDays ?? 0, lockedThrough: dump.owner.lockedThrough ?? null })
    .onConflictDoUpdate({ target: stockSettings.orgId, set: { reorderBelow: rule.reorderBelow, orderUpTo: rule.orderUpTo, leadDays: rule.leadDays ?? 0, lockedThrough: dump.owner.lockedThrough ?? null } });

  // Verify: every item's balance must match the source.
  const after = await loadStockData(orgId);
  let bad = 0;
  for (const it of dump.items) {
    const newId = idMap.get(it.id) as string;
    const nb = balanceOf(after.byItem.get(newId) ?? []);
    if (Math.abs(nb - (oldBalance.get(it.id) ?? 0)) > 0.001) {
      bad++;
      console.log(`  MISMATCH ${it.code} ${it.name}: source ${oldBalance.get(it.id)} -> new ${nb}`);
    }
  }
  console.log(`Wrote ${dump.items.length} items, ${moves.length} movements, ${dump.orders.length} orders, ${dump.requests.length} requests into ${orgId}.`);
  console.log(bad ? `${bad} balances differ!` : "All balances match the source.");
  if (bad) process.exitCode = 1;
} finally {
  if (selftest) {
    await db.delete(stockMovements).where(eq(stockMovements.orgId, orgId));
    await db.delete(stockRequests).where(eq(stockRequests.orgId, orgId));
    await db.delete(stockOrders).where(eq(stockOrders.orgId, orgId));
    await db.delete(stockItems).where(eq(stockItems.orgId, orgId));
    await db.delete(stockSettings).where(eq(stockSettings.orgId, orgId));
    console.log("(self-test rows deleted)");
  }
}
