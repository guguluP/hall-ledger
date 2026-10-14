"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions/auth";

export const fieldClass =
  "h-11 w-full rounded-full border border-border bg-elevated px-4 text-[15px] text-fg outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

export function FormCard({
  action,
  submit,
  children,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submit: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <p className="text-[14px] text-danger">{state.error}</p>}
      {state?.ok && <p className="text-[14px] text-ok">{state.ok}</p>}
      {children}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Working…" : submit}
      </Button>
    </form>
  );
}
