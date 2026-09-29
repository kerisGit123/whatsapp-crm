import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireOrgId } from "@/lib/auth";
import { getContact } from "@/lib/db/contacts";
import { listMessagesForContact } from "@/lib/db/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { STAGE_LABEL, STAGE_STYLE, initials, type Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";
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
  const style = STAGE_STYLE[contact.stage as Stage] ?? STAGE_STYLE.lead;

  async function send(formData: FormData) {
    "use server";
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    await sendWhatsappMessageAction(id, body);
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col">
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <Link href="/contacts" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
        </Link>
        <Avatar>
          <AvatarFallback>{initials(contact.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="font-medium leading-tight">{contact.name}</div>
          <div className="text-sm text-muted-foreground">{contact.phone}</div>
        </div>
        <Badge className={style.badge}>
          <span className={`size-1.5 rounded-full ${style.dot}`} />
          {STAGE_LABEL[contact.stage as Stage] ?? contact.stage}
        </Badge>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-6">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet — send one below to start the conversation.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                m.direction === "outbound"
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-card ring-1 ring-foreground/10",
              )}
            >
              {m.body}
              <div
                className={cn(
                  "mt-1 text-[11px]",
                  m.direction === "outbound"
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground",
                )}
              >
                {m.createdAt.toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form action={send} className="flex gap-2 border-t p-4">
        <Input name="body" placeholder="Type a message..." className="flex-1" />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
