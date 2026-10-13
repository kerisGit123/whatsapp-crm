import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { activeWorkspace, claimInvites } from "@/lib/workspace";

/** Roles inside one workspace: owner and manager can do everything; staff cannot
 *  change prices, items, rules, orders or remove records. */
export type WorkspaceRole = "manager" | "staff";

/** The tenant id every DB query must filter by: the workspace the signed-in person is
 *  working in. Never trust a client-supplied id: this is the only source. */
export async function requireOrgId(): Promise<string> {
  return (await requireWorkspace()).companyId;
}

async function requireWorkspace() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  let workspace = await activeWorkspace(userId);
  if (!workspace) {
    // First sign-in: an invite sent to their Google email becomes a membership.
    await claimInvites(userId);
    workspace = await activeWorkspace(userId);
  }
  if (!workspace) redirect("/onboarding");
  return workspace;
}

export async function getRole(): Promise<WorkspaceRole> {
  const w = await requireWorkspace();
  return w.role === "staff" ? "staff" : "manager";
}

/** Server-side gate for actions staff must not do (prices, deletes, settings). */
export async function requireManager(): Promise<string> {
  const w = await requireWorkspace();
  if (w.role === "staff") throw new Error("Managers only");
  return w.companyId;
}

/** Only the owner manages people and the workspace itself. */
export async function requireOwner(): Promise<string> {
  const w = await requireWorkspace();
  if (w.role !== "owner") throw new Error("Owner only");
  return w.companyId;
}

/** Platform admin = whoever is listed in PLATFORM_ADMIN_EMAILS (comma-separated):
 *  the shop owner / developer, above all workspaces. */
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
