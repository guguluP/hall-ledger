"use client";

import { cn } from "@/lib/utils";

export function SuccessCheck({
  show,
  className,
  size = 48,
}: {
  show: boolean;
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn("t-success-check", className)}
      data-state={show ? "in" : "out"}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="24"
          cy="24"
          r="22"
          stroke="var(--color-ok)"
          strokeWidth="2.5"
          opacity="0.35"
        />
        <path
          d="M14 25.5L21 32.5L34 16"
          stroke="var(--color-ok)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
