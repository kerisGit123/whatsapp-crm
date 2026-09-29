import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="mx-auto max-w-xl p-10 text-center space-y-4">
      <h1 className="text-2xl font-semibold">WhatsApp CRM</h1>
      <p className="text-muted-foreground">Contacts, conversations, and invoices in one place.</p>
      {userId && (
        <Link href="/contacts" className={cn(buttonVariants())}>
          Go to contacts
        </Link>
      )}
    </div>
  );
}
