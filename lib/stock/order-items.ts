import { cartonsAndUnits, lastPaidPerUnit, priceChangePct, stockStatus, unitPrice, type StockItem, type StockMovement, type StockRule } from "./rules";
import { onOrderUnits, type StockOrder } from "./orders";
import type { OrderItem } from "@/components/stock/order-form";

/** Items for the order form, with what the rules suggest ordering right now. */
export function orderFormItems(items: StockItem[], byItem: Map<string, StockMovement[]>, movements: StockMovement[], orders: StockOrder[], rule: StockRule, today: string) {
  const onOrder = onOrderUnits(orders, movements);
  const list: OrderItem[] = [];
  const suggested: Array<{ itemId: string; cartons: string }> = [];

  for (const item of items.filter((i) => i.status !== "DISCONTINUED")) {
    const own = byItem.get(item.id) ?? [];
    const s = stockStatus(item, own, rule, today, onOrder.get(item.id) ?? 0);
    list.push({
      id: item.id,
      name: item.name,
      specification: item.specification,
      supplier: item.supplier,
      cartonPrice: item.cartonPrice,
      unitsPerCarton: item.unitsPerCarton,
      unit: item.unit,
      onHandText: cartonsAndUnits(s.balance, item),
      suggested: s.suggestedCartons,
      priceChangePct: priceChangePct(unitPrice(item), lastPaidPerUnit(own)),
    });
    if (s.flag === "ORDER" && s.suggestedCartons > 0) suggested.push({ itemId: item.id, cartons: String(s.suggestedCartons) });
  }
  return { list, suggested };
}
