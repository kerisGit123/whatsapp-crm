import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">WhatsApp CRM</span>
        <Show when="signed-out">
          <div className="flex gap-2">
            <SignInButton>
              <Button variant="outline">Sign in</Button>
            </SignInButton>
            <SignUpButton>
              <Button>Sign up</Button>
            </SignUpButton>
          </div>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </header>

      <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">WhatsApp CRM</h1>
        <p className="text-muted-foreground">
          Contacts, WhatsApp conversations, and invoices in one place.
        </p>
        {userId && (
          <Link href="/contacts" className={cn(buttonVariants(), "mt-2")}>
            Go to contacts
          </Link>
        )}
      </main>
    </div>
  );
}
