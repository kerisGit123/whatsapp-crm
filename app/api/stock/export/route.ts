import { auth, clerkClient } from "@clerk/nextjs/server";
import { getRole } from "@/lib/auth";
import { loadStockData, todayIso } from "@/lib/db/stock";
import { loadOrders, loadRequests } from "@/lib/db/stock-orders";
import { historySheet, monthEndRows, stockStatus, yearGrid } from "@/lib/stock/rules";
import { onOrderUnits, orderProgress } from "@/lib/stock/orders";
import { stockMonthFileName, stockMonthWorkbook } from "@/lib/stock/excel";
import { borrowWorkbook, countWorkbook, deliveryNoteWorkbook, historyWorkbook, monthEndWorkbook, orderWorkbook, purchaseOrderWorkbook, stockHandWorkbook, yearWorkbook } from "@/lib/stock/excel-more";

// GET /api/stock/export?kind=...  (signed-in members of the active workspace)
//   month&month=2026-05   the restock sheet        count      blank count sheet
//   hand                  stock in hand            order      the order plan (&orders=<id:ctn,...>)
//   history&from=&to=     in/out grid              borrowed   stock lent to branches
//   po&order=<id>         one order for supplier   request&request=<id>  delivery note
//   monthend              month-end values         year&year=2026  opening/closing grid

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const plain = (body: string, status: number) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return plain("Sign in and pick a workspace first.", 401);
  const q = new URL(req.url).searchParams;
  const kind = q.get("kind") ?? "month";
  const today = todayIso();
  const role = await getRole();
  // Prices and values are for managers only.
  if (["order", "po", "monthend", "year"].includes(kind) && role !== "manager") return plain("Managers only.", 403);

  const [{ items, movements, byItem, rule, lockedThrough }, orders, requests] = await Promise.all([loadStockData(orgId), loadOrders(orgId), loadRequests(orgId)]);
  const company = (await (await clerkClient()).organizations.getOrganization({ organizationId: orgId })).name;
  const heading = { company, generatedOn: today };
  const onOrder = onOrderUnits(orders, movements);
  const statuses = () => items.map((item) => stockStatus(item, byItem.get(item.id) ?? [], rule, today, onOrder.get(item.id) ?? 0));
  const file = (name: string, bytes: Uint8Array) =>
    new Response(Buffer.from(bytes), { headers: { "Content-Type": MIME, "Content-Disposition": `attachment; filename="${name}"` } });

  if (kind === "month") {
    const month = q.get("month") ?? today.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return plain("month must be like 2026-05.", 400);
    return file(stockMonthFileName(month), stockMonthWorkbook(items, byItem, month, () => rule, heading));
  }
  if (kind === "count") return file(`stock-count-sheet-${today}.xlsx`, countWorkbook(items, { title: "Stock count sheet 盘点表", ...heading }));
  if (kind === "hand") return file(`stock-in-hand-${today}.xlsx`, stockHandWorkbook(statuses(), today, { title: "Stock in hand 库存", ...heading }));
  if (kind === "borrowed") return file(`stock-borrowed-${today}.xlsx`, borrowWorkbook(items, movements, today, { title: "Stock lent to branches 借出", ...heading }));
  if (kind === "history") {
    const from = q.get("from");
    const to = q.get("to");
    if (!isDate(from) || !isDate(to) || from > to) return plain("from and to must be dates, from first.", 400);
    return file(`stock-in-out-${from}-to-${to}.xlsx`, historyWorkbook(historySheet(items, byItem, from, to), { title: "Stock in / out 进出记录", ...heading, period: `${from} to ${to}` }));
  }
  if (kind === "order") {
    // The cartons typed on the page; items not listed keep the suggestion.
    const edited = new Map(
      (q.get("orders") ?? "")
        .split(",")
        .map((pair) => pair.split(":"))
        .filter(([id, ctn]) => id && ctn !== undefined)
        .map(([id, ctn]) => [id, Math.max(0, Number(ctn) || 0)] as const),
    );
    return file(`stock-order-${today}.xlsx`, orderWorkbook(statuses(), (st) => edited.get(st.item.id) ?? st.suggestedCartons, { title: "订货单 Purchase order", ...heading }));
  }
  if (kind === "po") {
    const order = orders.find((o) => o.id === q.get("order"));
    if (!order) return plain("Order not found.", 404);
    return file(`${order.number || "order"}.xlsx`, purchaseOrderWorkbook(order, orderProgress(order, movements).lines, new Map(items.map((i) => [i.id, i])), { title: "Order", ...heading }));
  }
  if (kind === "request") {
    const request = requests.find((r) => r.id === q.get("request"));
    if (!request) return plain("Request not found.", 404);
    return file(`${request.number}-delivery-note.xlsx`, deliveryNoteWorkbook(request, new Map(items.map((i) => [i.id, i])), heading));
  }
  if (kind === "monthend") {
    return file(`stock-month-end-${today}.xlsx`, monthEndWorkbook(monthEndRows(items, byItem, today.slice(0, 7)), lockedThrough, { title: "Stock month end 月结", ...heading }));
  }
  if (kind === "year") {
    const year = Number(q.get("year")) || Number(today.slice(0, 4));
    const thisYear = Number(today.slice(0, 4));
    const lastMonth = year < thisYear ? 12 : year > thisYear ? 0 : Number(today.slice(5, 7));
    return file(`stock-${year}-opening-closing.xlsx`, yearWorkbook(yearGrid(items, byItem, year), year, lastMonth, { title: `Stock ${year}: opening & closing 月结`, ...heading }));
  }
  return plain("Unknown kind.", 400);
}
