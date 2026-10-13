import { auth, currentUser } from "@clerk/nextjs/server";

/** Roles inside one workspace (a Clerk organization).
 *  owner / manager = Clerk "org:admin"; staff = Clerk "org:member". */
export type WorkspaceRole = "manager" | "staff";

/** The tenant id every DB query must filter by: the active workspace (Clerk
 *  organization). Staff always work inside a workspace; there is no personal
 *  fallback. Never trust a client-supplied orgId — this is the only source. */
export async function requireOrgId(): Promise<string> {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!orgId) throw new Error("No workspace selected");
  return orgId;
}

export async function getRole(): Promise<WorkspaceRole> {
  const { orgRole } = await auth();
  return orgRole === "org:admin" ? "manager" : "staff";
}

/** Server-side gate for actions staff must not do (prices, deletes, settings). */
export async function requireManager(): Promise<string> {
  const orgId = await requireOrgId();
  if ((await getRole()) !== "manager") throw new Error("Managers only");
  return orgId;
}

/** Platform admin = whoever is listed in PLATFORM_ADMIN_EMAILS (comma-separated).
 *  This is the shop owner / developer, above all workspaces. */
export async function isPlatformAdmin(): Promise<boolean> {
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  const user = await currentUser();
  const emails = user?.emailAddresses.map((e) => e.emailAddress.toLowerCase()) ?? [];
  return emails.some((e) => allowed.includes(e));
}
