// CRM data layer against the dev DB with a throwaway workspace id (deleted at the end):
// an incoming WhatsApp message finds its workspace by number, creates the contact, and
// opens the 24 h reply window; another workspace sees nothing.
//   node --env-file=.env.local --import tsx scripts/crm-smoke.mts
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { contacts, whatsappMessages, whatsappNumbers } from "../lib/db/schema";
import { listContacts, upsertContactByPhone } from "../lib/db/contacts";
import { findOrgIdByWhatsappNumber, isWithinServiceWindow, listMessagesForContact, recordMessage } from "../lib/db/whatsapp";

const org = `ws_crmtest_${Date.now()}`;
const number = `+1555${String(Date.now()).slice(-7)}`;
let failed = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
};
try {
  await db.insert(whatsappNumbers).values({ orgId: org, phoneNumber: number, label: "test" });
  check("number resolves to its workspace", (await findOrgIdByWhatsappNumber(number)) === org);
  check("unknown number resolves to nothing", (await findOrgIdByWhatsappNumber("+10000000000")) === undefined);
  const contact = await upsertContactByPhone(org, "+60123456789", "+60123456789");
  const again = await upsertContactByPhone(org, "+60123456789", "+60123456789");
  check("same phone is one contact", contact.id === again.id && (await listContacts(org)).length === 1);
  check("no reply window before a message", !(await isWithinServiceWindow(org, contact.id)));
  await recordMessage({ orgId: org, contactId: contact.id, direction: "inbound", body: "hi", twilioSid: `SM${Date.now()}`, status: "received" });
  check("inbound message opens the 24 h window", await isWithinServiceWindow(org, contact.id));
  check("message listed for the contact", (await listMessagesForContact(org, contact.id)).length === 1);
  check("other workspace sees no contacts", (await listContacts("ws_other")).length === 0);
} finally {
  await db.delete(whatsappMessages).where(eq(whatsappMessages.orgId, org));
  await db.delete(contacts).where(eq(contacts.orgId, org));
  await db.delete(whatsappNumbers).where(eq(whatsappNumbers.orgId, org));
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
