import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { whatsappNumbers } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth";
import { AddNumberForm, RemoveNumber } from "@/components/whatsapp-number-form";

export const dynamic = "force-dynamic";

/** Connect this workspace to its Twilio WhatsApp number. Owner only. */
export default async function WhatsappSetupPage() {
  const orgId = await requireOwner();
  const numbers = await db.select().from(whatsappNumbers).where(eq(whatsappNumbers.orgId, orgId));
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const twilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <h1 className="text-xl font-semibold">WhatsApp setup</h1>
      <p className="text-sm text-muted-foreground">
        Messages sent to your WhatsApp number show up under Contacts. Add the number here so the app knows they are yours.
      </p>

      <section className="space-y-1 rounded-lg border p-3 text-sm">
        <div className="font-medium">Twilio</div>
        <div className={twilioConfigured ? "text-green-700" : "text-amber-700"}>
          {twilioConfigured ? "Twilio keys are set on the server." : "Twilio keys are not set yet (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)."}
        </div>
        <div className="text-muted-foreground">
          In the Twilio console, set the WhatsApp sender&apos;s &quot;When a message comes in&quot; URL to:
        </div>
        <code className="block select-all break-all rounded bg-muted px-2 py-1 text-xs">{base ? `${base}/api/whatsapp/webhook` : "https://<your address>/api/whatsapp/webhook"}</code>
      </section>

      <AddNumberForm />

      {numbers.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {numbers.map((n) => (
            <li key={n.id} className="flex items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{n.phoneNumber}</span>
              <span className="text-xs text-muted-foreground">{n.label}</span>
              <RemoveNumber id={n.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No number added yet.</p>
      )}
    </div>
  );
}
