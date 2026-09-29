import { notFound } from "next/navigation";
import { requireOrgId } from "@/lib/auth";
import { getContact } from "@/lib/db/contacts";
import { listMessagesForContact } from "@/lib/db/whatsapp";
import { Button } from "@/components/ui/button";
import { sendWhatsappMessageAction } from "../actions";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await requireOrgId();
  const contact = await getContact(orgId, id);
  if (!contact) notFound();

  const messages = await listMessagesForContact(orgId, id);

  async function send(formData: FormData) {
    "use server";
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    await sendWhatsappMessageAction(id, body);
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{contact.name}</h1>
        <p className="text-sm text-muted-foreground">{contact.phone}</p>
      </div>

      <div className="border rounded divide-y">
        {messages.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">No messages yet.</div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-3 text-sm ${m.direction === "outbound" ? "bg-muted/50" : ""}`}
          >
            <div className="text-xs text-muted-foreground mb-1">
              {m.direction} · {m.createdAt.toLocaleString()}
            </div>
            {m.body}
          </div>
        ))}
      </div>

      <form action={send} className="flex gap-2">
        <input
          name="body"
          placeholder="Type a message..."
          className="border rounded px-3 py-2 flex-1"
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
