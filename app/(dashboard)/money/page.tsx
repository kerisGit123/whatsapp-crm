import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { todayIso } from "@/lib/db/stock";
import { dueRepeatingBills, listExpenses, listIncomes, monthlyTotals } from "@/lib/db/money";
import { expenseCategory, expenseGroup } from "@/lib/money/expense-categories";
import { incomeCategoryLabel } from "@/lib/money/income-categories";
import { DueBill, ExpenseForm, IncomeForm, RemoveRow } from "@/components/money-forms";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const rm = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shift = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

/** Money out (expenses) and money in (everything that is not a rent receipt) for one month. Managers only. */
export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ tab?: string; month?: string }> }) {
  const { tab = "out", month: m } = await searchParams;
  const orgId = await requireManager();
  const today = todayIso();
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : today.slice(0, 7);
  const [outRows, inRows, totals, due] = await Promise.all([listExpenses(orgId, month), listIncomes(orgId, month), monthlyTotals(orgId, 12), dueRepeatingBills(orgId, today)]);
  const outTotal = outRows.reduce((s, e) => s + e.amount, 0);
  const inTotal = inRows.reduce((s, i) => s + i.amount, 0);
  const byGroup = new Map<string, number>();
  for (const e of outRows) byGroup.set(expenseGroup(e.category).label, (byGroup.get(expenseGroup(e.category).label) ?? 0) + e.amount);
  const tabHref = (t: string) => `/money?tab=${t}&month=${month}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Money</h1>
        <Link href={`/money?tab=${tab}&month=${shift(month, -1)}`} className="rounded-lg border px-3 py-2 text-sm">
          ←
        </Link>
        <span className="text-sm font-medium">{month}</span>
        <Link href={`/money?tab=${tab}&month=${shift(month, 1)}`} className="rounded-lg border px-3 py-2 text-sm">
          →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg border p-3">
          <div className="text-muted-foreground">Money in</div>
          <div className="text-lg font-semibold text-green-700">{rm(inTotal)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-muted-foreground">Money out</div>
          <div className="text-lg font-semibold text-red-700">{rm(outTotal)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-muted-foreground">Left</div>
          <div className={cn("text-lg font-semibold", inTotal - outTotal < 0 && "text-red-700")}>{rm(inTotal - outTotal)}</div>
        </div>
      </div>

      {due.length > 0 ? (
        <section>
          <h2 className="mb-1 text-sm font-medium">Bills that repeat and are due</h2>
          <ul className="divide-y rounded-lg border">
            {due.map(({ expense, nextDate }) => (
              <DueBill key={expense.id} id={expense.id} name={expense.name} nextDate={nextDate} amount={expense.amount} every={expense.repeatEvery} />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex gap-2">
        {[
          { v: "out", label: "Money out" },
          { v: "in", label: "Money in" },
        ].map((t) => (
          <Link key={t.v} href={tabHref(t.v)} className={cn("rounded-full border px-4 py-1.5 text-sm", tab === t.v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "in" ? (
        <>
          <IncomeForm />
          {inRows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No money in this month.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {inRows.map((r) => (
                <li key={r.id} className="flex items-start gap-3 p-3">
                  <div className="w-20 shrink-0 text-xs text-muted-foreground">{r.incomeDate}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{[incomeCategoryLabel(r.category), r.receivedFrom].filter(Boolean).join(" · ")}</div>
                    <RemoveRow id={r.id} kind="income" />
                  </div>
                  <div className="shrink-0 font-medium text-green-700">{rm(r.amount)}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <ExpenseForm />
          {byGroup.size > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {[...byGroup.entries()].sort(([, a], [, b]) => b - a).map(([label, total]) => (
                <span key={label} className="rounded-full bg-muted px-3 py-1">
                  {label} {rm(total)}
                </span>
              ))}
            </div>
          ) : null}
          {outRows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No expenses this month.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {outRows.map((e) => (
                <li key={e.id} className="flex items-start gap-3 p-3">
                  <div className="w-20 shrink-0 text-xs text-muted-foreground">{e.expenseDate}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[expenseCategory(e.category).label, e.paidTo, e.repeatEvery !== "NONE" ? `repeats ${e.repeatEvery.toLowerCase().replace("_", " ")}` : ""].filter(Boolean).join(" · ")}
                    </div>
                    <RemoveRow id={e.id} kind="expense" />
                  </div>
                  <div className="shrink-0 font-medium">{rm(e.amount)}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {totals.length > 1 ? (
        <section>
          <h2 className="mb-1 text-sm font-medium">Month by month</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-right text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Month</th>
                  <th className="px-3 py-2 font-medium">In</th>
                  <th className="px-3 py-2 font-medium">Out</th>
                  <th className="px-3 py-2 font-medium">Left</th>
                </tr>
              </thead>
              <tbody>
                {[...totals].reverse().map((t) => (
                  <tr key={t.month} className="border-t text-right">
                    <td className="px-3 py-2 text-left">{t.month}</td>
                    <td className="px-3 py-2">{rm(t.in)}</td>
                    <td className="px-3 py-2">{rm(t.out)}</td>
                    <td className={cn("px-3 py-2", t.in - t.out < 0 && "text-red-700")}>{rm(t.in - t.out)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
