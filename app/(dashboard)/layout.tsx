import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { OrganizationList, OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Users, FileText, MessageCircle, ShieldCheck } from "lucide-react";
import { isPlatformAdmin } from "@/lib/auth";

const NAV = [
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/invoices", label: "Invoices", icon: FileText },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = await auth();

  // Everything lives inside a workspace. Until one is chosen, show the picker.
  if (!orgId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-muted-foreground">Choose your workspace to continue</p>
        <OrganizationList hidePersonal afterSelectOrganizationUrl="/contacts" afterCreateOrganizationUrl="/contacts" />
      </div>
    );
  }

  const admin = await isPlatformAdmin();
  const nav = admin ? [...NAV, { href: "/admin", label: "Admin", icon: ShieldCheck }] : NAV;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30">
        <div className="flex items-center gap-2 px-4 py-4">
          <MessageCircle className="size-5 text-primary" />
          <span className="font-semibold">Shop</span>
        </div>
        <div className="px-2 pb-2">
          <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/contacts" />
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 border-t px-4 py-3">
          <UserButton />
          <span className="text-sm text-muted-foreground">Account</span>
        </div>
      </aside>
      <div className="flex-1 bg-background">{children}</div>
    </div>
  );
}
