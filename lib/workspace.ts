import { cookies } from "next/headers";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { workspaceInvites, workspaceMembers, workspaces } from "@/lib/db/schema";

export type MemberRole = "owner" | "manager" | "staff";
export const WORKSPACE_COOKIE = "ws";

export type Membership = { companyId: string; name: string; role: MemberRole };

/** Turn any invite sent to this person's Google email into a membership (first sign-in). */
export async function claimInvites(userId: string) {
  const user = await currentUser();
  const emails = (user?.emailAddresses ?? []).map((e) => e.emailAddress.toLowerCase());
  if (!emails.length) return;
  const open = await db
    .select()
    .from(workspaceInvites)
    .where(and(inArray(workspaceInvites.email, emails), isNull(workspaceInvites.claimedAt)));
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  for (const invite of open) {
    await db
      .insert(workspaceMembers)
      .values({ companyId: invite.companyId, userId, email: invite.email, name, role: invite.role })
      .onConflictDoNothing();
    await db.update(workspaceInvites).set({ claimedByUserId: userId, claimedAt: new Date() }).where(eq(workspaceInvites.id, invite.id));
  }
}

/** Every workspace this person can work in (active memberships of live workspaces). */
export async function myWorkspaces(userId: string): Promise<Membership[]> {
  const rows = await db
    .select({ companyId: workspaceMembers.companyId, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.companyId, workspaceMembers.companyId))
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.status, "active"), isNull(workspaces.deletedAt)))
    .orderBy(asc(workspaces.name));
  return rows.map((r) => ({ companyId: r.companyId, name: r.name, role: (r.role as MemberRole) ?? "staff" }));
}

/** The workspace in use: the one in the cookie if the person still belongs to it, else their first. */
export async function activeWorkspace(userId: string): Promise<Membership | null> {
  const list = await myWorkspaces(userId);
  if (!list.length) return null;
  const wanted = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  return list.find((w) => w.companyId === wanted) ?? list[0];
}

export async function currentUserId() {
  const { userId } = await auth();
  return userId;
}
