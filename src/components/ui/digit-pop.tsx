"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Animated digit group — replays pop-in when `value` changes */
export function DigitPop({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  const text = String(value);
  const [animating, setAnimating] = useState(true);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setAnimating(false);
    const id = requestAnimationFrame(() => {
      setKey((k) => k + 1);
      setAnimating(true);
    });
    return () => cancelAnimationFrame(id);
  }, [text]);

  return (
    <span
      key={key}
      className={cn("t-digit-group", animating && "is-animating", className)}
    >
      {text.split("").map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className="t-digit"
          data-stagger={i > 0 ? Math.min(i, 3) : undefined}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}
