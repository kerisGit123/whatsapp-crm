export const STAGES = ["lead", "contacted", "qualified", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  lead: "Lead",
  contacted: "Contacted",
  qualified: "Qualified",
  won: "Won",
  lost: "Lost",
};

/** Tailwind classes per stage — dot + badge tint, consistent in light and dark. */
export const STAGE_STYLE: Record<Stage, { dot: string; badge: string }> = {
  lead: { dot: "bg-sky-500", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  contacted: { dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  qualified: { dot: "bg-violet-500", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  won: { dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  lost: { dot: "bg-zinc-400", badge: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400" },
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
