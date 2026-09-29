import Link from "next/link";
import { requireOrgId } from "@/lib/auth";
import { listContacts } from "@/lib/db/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { STAGE_LABEL, STAGE_STYLE, initials, type Stage } from "@/lib/stages";
import { createContactAction } from "./actions";

export default async function ContactsPage() {
  const orgId = await requireOrgId();
  const contacts = await listContacts(orgId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">Contacts</h1>
        <p className="text-sm text-muted-foreground">
          {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
        </p>
      </div>

      <Card className="p-4">
        <form action={createContactAction} className="flex gap-2">
          <Input name="name" placeholder="Name" required className="flex-1" />
          <Input name="phone" placeholder="+14155551234" required className="flex-1" />
          <Button type="submit">Add contact</Button>
        </form>
      </Card>

      {contacts.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No contacts yet — add one above to start a WhatsApp conversation.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {contacts.map((c) => {
            const style = STAGE_STYLE[c.stage as Stage] ?? STAGE_STYLE.lead;
            return (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{initials(c.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium leading-tight">{c.name}</div>
                    <div className="text-sm text-muted-foreground">{c.phone}</div>
                  </div>
                </div>
                <Badge className={style.badge}>
                  <span className={`size-1.5 rounded-full ${style.dot}`} />
                  {STAGE_LABEL[c.stage as Stage] ?? c.stage}
                </Badge>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
