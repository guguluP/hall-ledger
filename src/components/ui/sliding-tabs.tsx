"use client";

import { useEffect, useRef } from "react";
import { syncTabsPill } from "@/lib/transitions";
import { cn } from "@/lib/utils";

export type TabItem = { value: string | number; label: string };

export function SlidingTabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string | number;
  onChange: (value: string | number) => void;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    syncTabsPill(rootRef.current, false);
    const onResize = () => syncTabsPill(rootRef.current, false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    syncTabsPill(rootRef.current, true);
  }, [value, items]);

  return (
    <div
      ref={rootRef}
      role="tablist"
      className={cn("t-tabs", className)}
    >
      <span className="t-tabs-pill" aria-hidden="true" />
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={String(item.value)}
            type="button"
            role="tab"
            className="t-tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
