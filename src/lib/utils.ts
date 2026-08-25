import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(time: string): string {
  // "09:30" -> "9:30 AM" style optional; keep short for grid
  return time;
}

export function dayLabel(dayOfWeek: number): string {
  const days = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days[dayOfWeek] ?? String(dayOfWeek);
}
