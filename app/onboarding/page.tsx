import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { claimInvites, myWorkspaces } from "@/lib/workspace";
import { CreateWorkspaceForm } from "@/components/workspace-forms";

export const dynamic = "force-dynamic";

/** Signed in but in no workspace yet: start one, or wait to be invited. */
export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  await claimInvites(userId);
  if ((await myWorkspaces(userId)).length > 0) redirect("/stock");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Welcome</h1>
        <UserButton />
      </div>
      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-medium">Start a new workspace</h2>
        <p className="text-sm text-muted-foreground">One workspace per shop or company. You will be its owner and can invite your team.</p>
        <CreateWorkspaceForm />
      </section>
      <section className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <h2 className="mb-1 font-medium text-foreground">Joining a team?</h2>
        Ask the owner to invite the Google email you signed in with, then reload this page.
      </section>
    </div>
  );
}
