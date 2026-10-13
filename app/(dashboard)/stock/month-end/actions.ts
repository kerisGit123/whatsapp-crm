"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { stockSettings } from "@/lib/db/schema";
import { requireManager } from "@/lib/auth";
import { getSettings, todayIso } from "@/lib/db/stock";

type Result = { ok: boolean; message: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const monthEnd = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);

async function setLock(orgId: string, lockedThrough: string | null) {
  await db.insert(stockSettings).values({ orgId, lockedThrough }).onConflictDoUpdate({ target: stockSettings.orgId, set: { lockedThrough } });
  revalidatePath("/stock", "layout");
}

/** Lock every month up to and including `month` (YYYY-MM): stock in and out on those dates is refused. */
export async function closeMonthAction(month: string): Promise<Result> {
  const orgId = await requireManager();
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, message: "Pick a month." };
  const end = monthEnd(month);
  if (end >= todayIso()) return { ok: false, message: `${monthName(end)} isn't over yet. Close it from the 1st of next month.` };
  const { lockedThrough } = await getSettings(orgId);
  if (lockedThrough && lockedThrough >= end) return { ok: true, message: `${monthName(end)} is already closed.` };
  await setLock(orgId, end);
  return { ok: true, message: `Closed up to ${monthName(end)}. Stock IN/OUT on or before ${end} is now locked.` };
}

/** Step back one month: the latest closed month opens again. */
export async function reopenMonthAction(): Promise<Result> {
  const orgId = await requireManager();
  const { lockedThrough } = await getSettings(orgId);
  if (!lockedThrough) return { ok: true, message: "No month is closed." };
  const y = Number(lockedThrough.slice(0, 4));
  const m = Number(lockedThrough.slice(5, 7));
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  await setLock(orgId, monthEnd(prev));
  return { ok: true, message: `${monthName(lockedThrough)} is open again. Close it again when the corrections are done.` };
}
