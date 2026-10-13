import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaceInvites, workspaceMembers } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth";
import { CancelInvite, InviteForm, MemberControls } from "@/components/workspace-forms";

export const dynamic = "force-dynamic";

/** The team of this workspace: invite by Google email, set roles, suspend. Owner only. */
export default async function MembersPage() {
  const companyId = await requireOwner();
  const [members, invites] = await Promise.all([
    db.select().from(workspaceMembers).where(eq(workspaceMembers.companyId, companyId)).orderBy(asc(workspaceMembers.joinedAt)),
    db.select().from(workspaceInvites).where(and(eq(workspaceInvites.companyId, companyId), isNull(workspaceInvites.claimedAt))),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Team</h1>
      <InviteForm />
      <ul className="divide-y rounded-lg border">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{m.name || m.email || m.userId}</div>
              <div className="truncate text-xs text-muted-foreground">
                {m.email}
                {m.status === "suspended" ? " · suspended" : ""}
              </div>
            </div>
            <MemberControls memberId={m.id} role={m.role} status={m.status} isOwner={m.role === "owner"} />
          </li>
        ))}
      </ul>
      {invites.length > 0 ? (
        <div>
          <h2 className="mb-1 text-sm font-medium">Waiting to join</h2>
          <ul className="divide-y rounded-lg border">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{i.email}</span>
                <span className="text-xs text-muted-foreground">{i.role}</span>
                <CancelInvite inviteId={i.id} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
