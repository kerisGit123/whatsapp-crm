import { requireOrgId } from "@/lib/auth";
import { listContacts } from "@/lib/db/contacts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceLineItemsForm } from "@/components/invoice-line-items-form";
import { createInvoiceAction } from "../actions";

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export default async function NewInvoicePage() {
  const orgId = await requireOrgId();
  const contacts = await listContacts(orgId);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-xl font-semibold">New invoice</h1>

      {contacts.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Add a contact first before creating an invoice.
        </Card>
      ) : (
        <Card className="space-y-6 p-6">
          <form action={createInvoiceAction} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="contactId">
                Contact
              </label>
              <select
                id="contactId"
                name="contactId"
                required
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.phone}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="dueDate">
                Due date
              </label>
              <Input id="dueDate" name="dueDate" type="date" defaultValue={defaultDueDate()} />
            </div>

            <input type="hidden" name="currency" value="USD" />

            <InvoiceLineItemsForm />

            <Button type="submit">Create invoice</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
