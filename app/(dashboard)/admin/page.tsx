import { notFound } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { isPlatformAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Platform admin: every workspace and its members, across the whole shop. */
export default async function AdminPage() {
  if (!(await isPlatformAdmin())) notFound();

  const client = await clerkClient();
  const { data: orgs, totalCount } = await client.organizations.getOrganizationList({
    limit: 100,
    includeMembersCount: true,
    orderBy: "-created_at",
  });

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Admin</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {totalCount} workspace{totalCount === 1 ? "" : "s"}
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Workspace</th>
              <th className="px-3 py-2 font-medium">Members</th>
              <th className="px-3 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-3 py-2">{o.name}</td>
                <td className="px-3 py-2">{o.membersCount ?? "-"}</td>
                <td className="px-3 py-2">{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {orgs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  No workspaces yet
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
