import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { Users, FileText, MessageCircle, ShieldCheck, Package, UserCog, Phone } from "lucide-react";
import { isPlatformAdmin } from "@/lib/auth";
import { activeWorkspace, claimInvites, myWorkspaces } from "@/lib/workspace";
import { WorkspaceSwitcher } from "@/components/workspace-forms";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Everything lives inside a workspace. A first sign-in claims any invite for this Google email.
  let current = await activeWorkspace(userId);
  if (!current) {
    await claimInvites(userId);
    current = await activeWorkspace(userId);
  }
  if (!current) redirect("/onboarding");

  const all = await myWorkspaces(userId);
  const admin = await isPlatformAdmin();
  const nav = [
    { href: "/stock", label: "Stock", icon: Package },
    { href: "/contacts", label: "Contacts", icon: Users },
    ...(current.role !== "staff" ? [{ href: "/invoices", label: "Invoices", icon: FileText }] : []),
    ...(current.role === "owner" ? [{ href: "/members", label: "Team", icon: UserCog }, { href: "/whatsapp", label: "WhatsApp setup", icon: Phone }] : []),
    ...(admin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30">
        <div className="flex items-center gap-2 px-4 py-4">
          <MessageCircle className="size-5 text-primary" />
          <span className="font-semibold">Shop</span>
        </div>
        <div className="px-2 pb-2">
          <WorkspaceSwitcher current={current.companyId} all={all.map((w) => ({ companyId: w.companyId, name: w.name }))} />
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground">
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 border-t px-4 py-3">
          <UserButton />
          <span className="text-sm text-muted-foreground">{current.role === "owner" ? "Owner" : current.role === "manager" ? "Manager" : "Staff"}</span>
        </div>
      </aside>
      <div className="flex-1 bg-background">{children}</div>
    </div>
  );
}
