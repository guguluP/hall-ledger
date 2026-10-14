import { z } from "zod";
import { passwordIssue } from "@/lib/auth/password";
import { RESERVED_SLUGS } from "@/lib/auth/roles";

const Day = z.coerce.number().int().min(0).max(6);
const Time = z.string().trim().regex(/^([01]?\d|2[0-3])[:.][0-5]\d$/, "Use a 24-hour time");

function clockToMinutes(value: string) {
  const match = value.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  if (!match) return -1;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export const VacancyQuery = z
  .object({
    day: Day,
    start: Time,
    end: Time,
    labs: z.enum(["0", "1"]).default("0"),
  })
  .transform((query) => ({
    day: query.day,
    start: query.start.replace(".", ":"),
    end: query.end.replace(".", ":"),
    startMin: clockToMinutes(query.start),
    endMin: clockToMinutes(query.end),
    labs: query.labs === "1",
  }))
  .refine((query) => query.endMin > query.startMin, {
    message: "End must be after start",
    path: ["end"],
  });

export const SlotIn = z
  .object({
    section: z.string().trim().min(1).max(40),
    subject: z.string().trim().max(120).nullable(),
    room: z
      .string()
      .trim()
      .max(20)
      .regex(/^[A-Za-z0-9 -]+$/)
      .nullable(),
    type: z.string().max(20),
    dayOfWeek: Day,
    startMin: z.number().int().min(0).max(1439),
    endMin: z.number().int().min(1).max(1440),
  })
  .refine((slot) => slot.endMin > slot.startMin, { message: "End must be after start" });

export const DraftSlots = z.array(SlotIn).max(5000);

export const Signup = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).refine((value) => Buffer.byteLength(value) <= 72, "Password must be at most 72 bytes").refine((value) => !passwordIssue(value), (value) => ({ message: passwordIssue(value) || "Choose another password" })),
  name: z.string().trim().max(80),
});

export const LoginInput = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200),
});

export const Slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,40}$/, "Use 3–40 letters, numbers, or hyphens")
  .refine((value) => !RESERVED_SLUGS.has(value), "That address is reserved");

export const InstitutionInput = z.object({
  name: z.string().trim().min(2).max(80),
  slug: Slug,
});

export const RoomInput = z.object({
  name: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9 -]+$/),
  building: z.string().trim().max(40).optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(500),
  isLab: z.boolean().default(false),
});

export function zodFields(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
