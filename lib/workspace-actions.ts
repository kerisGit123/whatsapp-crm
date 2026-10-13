"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { workspaceInvites, workspaceMembers, workspaces } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth";
import { WORKSPACE_COOKIE, myWorkspaces } from "@/lib/workspace";

type Result = { ok: boolean; message: string };
const ROLES = ["manager", "staff"] as const;

const setCookie = async (companyId: string) =>
  (await cookies()).set(WORKSPACE_COOKIE, companyId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });

/** Start a workspace (a shop / company); you become its owner. */
export async function createWorkspaceAction(name: string): Promise<Result & { companyId?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "Sign in first." };
  const clean = name.trim().slice(0, 80);
  if (!clean) return { ok: false, message: "Give the workspace a name." };
  const user = await currentUser();
  const companyId = `ws_${crypto.randomUUID()}`;
  await db.insert(workspaces).values({ companyId, name: clean, ownerId: userId });
  await db.insert(workspaceMembers).values({
    companyId,
    userId,
    email: user?.emailAddresses[0]?.emailAddress.toLowerCase() ?? "",
    name: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
    role: "owner",
  });
  await setCookie(companyId);
  revalidatePath("/", "layout");
  return { ok: true, message: "Workspace created.", companyId };
}

/** Switch the workspace in use (only to one you belong to). */
export async function switchWorkspaceAction(companyId: string): Promise<Result> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "Sign in first." };
  if (!(await myWorkspaces(userId)).some((w) => w.companyId === companyId)) return { ok: false, message: "You are not in that workspace." };
  await setCookie(companyId);
  revalidatePath("/", "layout");
  return { ok: true, message: "Switched." };
}

export async function inviteMemberAction(email: string, role: string): Promise<Result> {
  const companyId = await requireOwner();
  const { userId } = await auth();
  const mail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return { ok: false, message: "That does not look like an email. Use their Google email." };
  if (!ROLES.includes(role as (typeof ROLES)[number])) return { ok: false, message: "Pick manager or staff." };
  const [existing] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.companyId, companyId), eq(workspaceMembers.email, mail)));
  if (existing) return { ok: false, message: "They are already in this workspace." };
  await db
    .insert(workspaceInvites)
    .values({ companyId, email: mail, role, invitedBy: userId ?? "" })
    .onConflictDoUpdate({ target: [workspaceInvites.companyId, workspaceInvites.email], set: { role, claimedAt: null, claimedByUserId: null } });
  revalidatePath("/members");
  return { ok: true, message: `Invited ${mail}. When they sign in with that Google email they will join.` };
}

export async function cancelInviteAction(inviteId: string): Promise<Result> {
  const companyId = await requireOwner();
  await db.delete(workspaceInvites).where(and(eq(workspaceInvites.companyId, companyId), eq(workspaceInvites.id, inviteId)));
  revalidatePath("/members");
  return { ok: true, message: "Invite removed." };
}

export async function setMemberRoleAction(memberId: string, role: string): Promise<Result> {
  const companyId = await requireOwner();
  if (!ROLES.includes(role as (typeof ROLES)[number])) return { ok: false, message: "Pick manager or staff." };
  const [m] = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.companyId, companyId), eq(workspaceMembers.id, memberId)));
  if (!m) return { ok: false, message: "Member not found." };
  if (m.role === "owner") return { ok: false, message: "The owner's role can't be changed." };
  await db.update(workspaceMembers).set({ role }).where(eq(workspaceMembers.id, memberId));
  revalidatePath("/members");
  return { ok: true, message: "Saved." };
}

/** Suspend or restore someone without deleting their history. */
export async function setMemberStatusAction(memberId: string, status: "active" | "suspended"): Promise<Result> {
  const companyId = await requireOwner();
  const [m] = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.companyId, companyId), eq(workspaceMembers.id, memberId)));
  if (!m) return { ok: false, message: "Member not found." };
  if (m.role === "owner") return { ok: false, message: "The owner can't be suspended." };
  await db.update(workspaceMembers).set({ status }).where(eq(workspaceMembers.id, memberId));
  revalidatePath("/members");
  return { ok: true, message: status === "suspended" ? "Suspended: they can't open this workspace." : "Active again." };
}
