import { auth } from "@clerk/nextjs/server";

/** The tenant id every DB query must filter by: the active org, or the
 *  user's personal workspace when they're not in one. Never trust a
 *  client-supplied orgId — this is the only source of truth. */
export async function requireOrgId(): Promise<string> {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return orgId ?? userId;
}
