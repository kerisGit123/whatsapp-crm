// Move contacts, invoices, messages and WhatsApp numbers from an old org id (a Clerk personal
// "user_..." id) into a workspace id ("ws_...").
//   node --env-file=.env.local --import tsx scripts/move-crm-to-workspace.mts --from user_xxx --to ws_xxx [--apply]
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { contacts, invoices, whatsappMessages, whatsappNumbers } from "../lib/db/schema";

const arg = (n: string) => process.argv[process.argv.indexOf(`--${n}`) + 1];
const from = arg("from");
const to = arg("to");
const apply = process.argv.includes("--apply");
if (!from || !to) {
  console.error("Usage: --from <old org id> --to <workspace id> [--apply]");
  process.exit(2);
}
const tables = [
  ["contacts", contacts],
  ["invoices", invoices],
  ["messages", whatsappMessages],
  ["numbers", whatsappNumbers],
] as const;
for (const [name, t] of tables) {
  const rows = await db.select({ id: t.id }).from(t).where(eq(t.orgId, from));
  console.log(`${name}: ${rows.length} to move`);
  if (apply && rows.length) await db.update(t).set({ orgId: to }).where(eq(t.orgId, from));
}
console.log(apply ? "Moved." : "Dry run only. Add --apply to move them.");
