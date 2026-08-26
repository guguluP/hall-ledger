"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Banner = {
  id: string;
  title: string;
  detail?: string;
  tone?: "ok" | "warn" | "danger" | "muted";
  entering?: boolean;
  leaving?: boolean;
};

let _id = 0;

export function useToastStack() {
  const [items, setItems] = useState<Banner[]>([]);

  const push = useCallback(
    (title: string, detail?: string, tone: Banner["tone"] = "muted") => {
      const id = `t-${++_id}`;
      setItems((prev) => {
        const next = [
          { id, title, detail, tone, entering: true },
          ...prev.map((b) => ({ ...b, entering: false })),
        ].slice(0, 4);
        return next;
      });
      requestAnimationFrame(() => {
        setItems((prev) =>
          prev.map((b) => (b.id === id ? { ...b, entering: false } : b)),
        );
      });
      window.setTimeout(() => {
        setItems((prev) =>
          prev.map((b) => (b.id === id ? { ...b, leaving: true } : b)),
        );
        window.setTimeout(() => {
          setItems((prev) => prev.filter((b) => b.id !== id));
        }, 250);
      }, 4000);
    },
    [],
  );

  return { items, push };
}

export function ToastStack({
  items,
  className,
}: {
  items: Banner[];
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [spread, setSpread] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onEnter = () => setSpread(true);
    const onLeave = () => setSpread(false);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div
      ref={rootRef}
      className={cn("t-stack fixed bottom-20 right-4 z-50 w-72 md:bottom-6", className, spread && "is-spread")}
    >
      {items.map((b, i) => (
        <div
          key={b.id}
          data-depth={Math.min(i, 2)}
          className={cn(
            "t-stack-banner rounded-2xl border border-border bg-surface px-4 py-3 shadow-lg",
            b.entering && "is-enter",
            b.leaving && "is-leaving",
            b.tone === "ok" && "border-[rgba(48,209,88,0.35)]",
            b.tone === "warn" && "border-[rgba(255,214,10,0.35)]",
            b.tone === "danger" && "border-[rgba(255,69,58,0.35)]",
          )}
        >
          <p className="text-[14px] font-semibold tracking-tight text-fg">
            {b.title}
          </p>
          {b.detail && (
            <p className="mt-0.5 text-[12px] text-muted">{b.detail}</p>
          )}
        </div>
      ))}
    </div>
  );
}
