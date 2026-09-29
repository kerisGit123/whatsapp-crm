import { NextResponse } from "next/server";
import { isValidTwilioSignature } from "@/lib/twilio";
import { findOrgIdByWhatsappNumber } from "@/lib/db/whatsapp";
import { upsertContactByPhone } from "@/lib/db/contacts";
import { recordMessage } from "@/lib/db/whatsapp";

export const runtime = "nodejs";

/** Strips Twilio's "whatsapp:" channel prefix down to a bare E.164 number. */
function bareNumber(twilioAddress: string): string {
  return twilioAddress.replace(/^whatsapp:/, "");
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const signature = req.headers.get("X-Twilio-Signature");
  // Twilio signs the exact public URL it POSTed to — must match what Twilio Console has configured.
  const url = process.env.TWILIO_WEBHOOK_URL ?? req.url;
  if (!isValidTwilioSignature(signature, url, params)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const from = params.From ? bareNumber(params.From) : undefined;
  const to = params.To ? bareNumber(params.To) : undefined;
  const body = params.Body ?? "";
  const twilioSid = params.MessageSid;

  if (!from || !to || !twilioSid) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const orgId = await findOrgIdByWhatsappNumber(to);
  if (!orgId) {
    // No org owns this number — nothing to link the message to.
    return NextResponse.json({ error: "Unknown destination number" }, { status: 404 });
  }

  const contact = await upsertContactByPhone(orgId, from, from);

  await recordMessage({
    orgId,
    contactId: contact.id,
    direction: "inbound",
    body,
    twilioSid,
    status: "received",
  });

  // Empty TwiML response — we're not auto-replying.
  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
