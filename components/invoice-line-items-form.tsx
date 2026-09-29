"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";

interface Row {
  id: number;
  description: string;
  quantity: string;
  unitPrice: string;
}

let nextId = 1;

export function InvoiceLineItemsForm() {
  const [rows, setRows] = useState<Row[]>([
    { id: nextId++, description: "", quantity: "1", unitPrice: "" },
  ]);

  function addRow() {
    setRows((r) => [...r, { id: nextId++, description: "", quantity: "1", unitPrice: "" }]);
  }

  function removeRow(id: number) {
    setRows((r) => (r.length > 1 ? r.filter((row) => row.id !== id) : r));
  }

  function update(id: number, field: keyof Row, value: string) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  const total = rows.reduce(
    (sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
    0,
  );

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <Input
              name="description"
              placeholder="Description"
              value={row.description}
              onChange={(e) => update(row.id, "description", e.target.value)}
              className="flex-[3]"
              required
            />
            <Input
              name="quantity"
              type="number"
              min="0"
              step="1"
              placeholder="Qty"
              value={row.quantity}
              onChange={(e) => update(row.id, "quantity", e.target.value)}
              className="flex-1"
              required
            />
            <Input
              name="unitPrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="Unit price"
              value={row.unitPrice}
              onChange={(e) => update(row.id, "unitPrice", e.target.value)}
              className="flex-1"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removeRow(row.id)}
              aria-label="Remove line item"
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="size-4" />
        Add line item
      </Button>

      <div className="flex justify-end text-sm text-muted-foreground">
        Total: <span className="ml-1 font-medium text-foreground">{total.toFixed(2)}</span>
      </div>
    </div>
  );
}
