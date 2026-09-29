import Link from "next/link";
import { requireOrgId } from "@/lib/auth";
import { listContacts } from "@/lib/db/contacts";
import { Button } from "@/components/ui/button";
import { createContactAction } from "./actions";

export default async function ContactsPage() {
  const orgId = await requireOrgId();
  const contacts = await listContacts(orgId);

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-4">Contacts</h1>
        <form action={createContactAction} className="flex gap-2">
          <input
            name="name"
            placeholder="Name"
            required
            className="border rounded px-3 py-2 flex-1"
          />
          <input
            name="phone"
            placeholder="+14155551234"
            required
            className="border rounded px-3 py-2 flex-1"
          />
          <Button type="submit">Add</Button>
        </form>
      </div>

      <ul className="divide-y border rounded">
        {contacts.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">No contacts yet.</li>
        )}
        {contacts.map((c) => (
          <li key={c.id} className="p-4 flex items-center justify-between">
            <div>
              <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                {c.name}
              </Link>
              <div className="text-sm text-muted-foreground">{c.phone}</div>
            </div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {c.stage}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
