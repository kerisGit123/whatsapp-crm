import { notFound } from "next/navigation";
import { asc, count, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { stockItems, workspaceMembers, workspaces } from "@/lib/db/schema";
import { isPlatformAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Platform admin: every workspace across the whole shop, with its team size and stock items. */
export default async function AdminPage() {
  if (!(await isPlatformAdmin())) notFound();

  const rows = await db.select().from(workspaces).where(isNull(workspaces.deletedAt)).orderBy(asc(workspaces.createdAt));
  const members = await db.select({ companyId: workspaceMembers.companyId, n: count() }).from(workspaceMembers).where(eq(workspaceMembers.status, "active")).groupBy(workspaceMembers.companyId);
  const items = await db.select({ companyId: stockItems.orgId, n: count() }).from(stockItems).groupBy(stockItems.orgId);
  const membersOf = new Map(members.map((m) => [m.companyId, m.n]));
  const itemsOf = new Map(items.map((i) => [i.companyId, i.n]));

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Admin</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {rows.length} workspace{rows.length === 1 ? "" : "s"}
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Workspace</th>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 font-medium">Stock items</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Id</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className="border-t">
                <td className="px-3 py-2">{w.name}</td>
                <td className="px-3 py-2">{membersOf.get(w.companyId) ?? 0}</td>
                <td className="px-3 py-2">{itemsOf.get(w.companyId) ?? 0}</td>
                <td className="px-3 py-2">{w.createdAt.toLocaleDateString()}</td>
                <td className="px-3 py-2 font-mono text-xs">{w.companyId}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
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
