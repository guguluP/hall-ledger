"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Toggle({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  className?: string;
}) {
  const [init, setInit] = useState(false);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-on={checked ? "true" : "false"}
      className={cn("t-toggle", init && "is-init", className)}
      onClick={() => {
        setInit(true);
        onChange(!checked);
      }}
    >
      <span className="t-toggle-thumb" />
    </button>
  );
}
