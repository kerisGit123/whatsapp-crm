import twilio from "twilio";

export const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

/** Validates Twilio's X-Twilio-Signature against the exact URL + form body
 *  Twilio signed. Must run before the payload is trusted. */
export function isValidTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!signature) return false;
  return twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN!, signature, url, params);
}

export async function sendWhatsappMessage(to: string, body: string) {
  return twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM!,
    to: `whatsapp:${to}`,
    body,
  });
}
