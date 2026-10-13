"use client";

import { useState, useTransition } from "react";
import { deleteMovementAction } from "@/app/(dashboard)/stock/actions";

/** Two taps to remove a line (a manager can restore it from the database). */
export function RemoveMovement({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="text-xs text-muted-foreground underline">
        Remove
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await deleteMovementAction(id);
            if (!r.ok) setError(r.message);
            setConfirm(false);
          })
        }
        className="font-medium text-red-700 underline"
      >
        {pending ? "Removing..." : "Yes, remove"}
      </button>
      <button type="button" onClick={() => setConfirm(false)} className="text-muted-foreground underline">
        Keep
      </button>
      {error ? <span className="text-red-700">{error}</span> : null}
    </span>
  );
}
