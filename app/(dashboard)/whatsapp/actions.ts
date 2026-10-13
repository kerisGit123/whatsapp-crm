"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { whatsappNumbers } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth";

type Result = { ok: boolean; message: string };

/** "+60 12-345 6789" / "0123456789" -> "+60123456789" (Malaysia when there is no country code). */
const e164 = (raw: string) => {
  const v = raw.replace(/[^\d+]/g, "");
  const full = v.startsWith("+") ? v : v.startsWith("00") ? `+${v.slice(2)}` : v.startsWith("0") ? `+60${v.slice(1)}` : `+${v}`;
  return /^\+\d{8,15}$/.test(full) ? full : null;
};

/** Tell the app which Twilio WhatsApp number belongs to this workspace (incoming messages are matched by it). */
export async function addWhatsappNumberAction(phone: string, label: string): Promise<Result> {
  const orgId = await requireOwner();
  const number = e164(phone);
  if (!number) return { ok: false, message: "That does not look like a phone number. Use the Twilio WhatsApp number, e.g. +14155238886." };
  const [taken] = await db.select({ orgId: whatsappNumbers.orgId }).from(whatsappNumbers).where(eq(whatsappNumbers.phoneNumber, number));
  if (taken) return { ok: false, message: taken.orgId === orgId ? "That number is already added." : "That number belongs to another workspace." };
  await db.insert(whatsappNumbers).values({ orgId, phoneNumber: number, label: label.trim().slice(0, 60) || null });
  revalidatePath("/whatsapp");
  return { ok: true, message: `Added ${number}.` };
}

export async function removeWhatsappNumberAction(id: string): Promise<Result> {
  const orgId = await requireOwner();
  await db.delete(whatsappNumbers).where(and(eq(whatsappNumbers.orgId, orgId), eq(whatsappNumbers.id, id)));
  revalidatePath("/whatsapp");
  return { ok: true, message: "Removed." };
}
