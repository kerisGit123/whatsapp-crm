"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelInviteAction,
  createWorkspaceAction,
  inviteMemberAction,
  setMemberRoleAction,
  setMemberStatusAction,
  switchWorkspaceAction,
} from "@/lib/workspace-actions";
import { cn } from "@/lib/utils";

const field = "h-11 w-full rounded-lg border bg-background px-3 text-base";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace name, e.g. Company A" className={field} />
      {msg ? <p className="text-sm text-red-700">{msg}</p> : null}
      <button
        type="button"
        disabled={pending || !name.trim()}
        onClick={() =>
          start(async () => {
            const r = await createWorkspaceAction(name);
            if (r.ok) router.push("/stock");
            else setMsg(r.message);
          })
        }
        className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Creating..." : "Create workspace"}
      </button>
    </div>
  );
}

/** Sidebar: which workspace am I working in. */
export function WorkspaceSwitcher({ current, all }: { current: string; all: Array<{ companyId: string; name: string }> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (all.length <= 1) return <div className="truncate rounded-lg bg-muted px-3 py-2 text-sm font-medium">{all[0]?.name}</div>;
  return (
    <select
      value={current}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          await switchWorkspaceAction(e.target.value);
          router.refresh();
        })
      }
      className="h-10 w-full rounded-lg border bg-background px-2 text-sm"
      aria-label="Workspace"
    >
      {all.map((w) => (
        <option key={w.companyId} value={w.companyId}>
          {w.name}
        </option>
      ))}
    </select>
  );
}

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="font-medium">Invite someone</div>
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their Google email" inputMode="email" className={field} />
        <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
          <option value="staff">Staff</option>
          <option value="manager">Manager</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground">Staff record stock in and out and do stock takes. Managers also see prices and can change items, orders and rules.</p>
      {msg ? <p className={cn("rounded-lg p-2 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p> : null}
      <button
        type="button"
        disabled={pending || !email}
        onClick={() =>
          start(async () => {
            const r = await inviteMemberAction(email, role);
            setMsg({ ok: r.ok, text: r.message });
            if (r.ok) {
              setEmail("");
              router.refresh();
            }
          })
        }
        className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Inviting..." : "Send invite"}
      </button>
    </div>
  );
}

export function MemberControls({ memberId, role, status, isOwner }: { memberId: string; role: string; status: string; isOwner: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  if (isOwner) return <span className="text-xs text-muted-foreground">Owner</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={role}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            const r = await setMemberRoleAction(memberId, e.target.value);
            setMsg(r.ok ? "" : r.message);
            router.refresh();
          })
        }
        className="h-9 rounded-lg border bg-background px-2 text-sm"
      >
        <option value="staff">Staff</option>
        <option value="manager">Manager</option>
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await setMemberStatusAction(memberId, status === "active" ? "suspended" : "active");
            router.refresh();
          })
        }
        className="h-9 rounded-lg border px-3 text-sm"
      >
        {status === "active" ? "Suspend" : "Restore"}
      </button>
      {msg ? <span className="text-xs text-red-700">{msg}</span> : null}
    </div>
  );
}

export function CancelInvite({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await cancelInviteAction(inviteId);
          router.refresh();
        })
      }
      className="text-xs text-muted-foreground underline"
    >
      Cancel invite
    </button>
  );
}
