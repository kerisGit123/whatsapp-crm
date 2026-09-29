import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Users, FileText, MessageCircle } from "lucide-react";

const NAV = [
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/invoices", label: "Invoices", icon: FileText },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30">
        <div className="flex items-center gap-2 px-4 py-4">
          <MessageCircle className="size-5 text-primary" />
          <span className="font-semibold">WhatsApp CRM</span>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.map(({ href, label, icon: Icon }) => (
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
