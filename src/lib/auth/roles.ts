export const ROLES = ["VIEWER", "EDITOR", "ADMIN", "OWNER"] as const;
export type Role = (typeof ROLES)[number];

export const RANK: Record<Role, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export const RESERVED_SLUGS = new Set([
  "api",
  "login",
  "signup",
  "forgot",
  "reset",
  "auth",
  "invite",
  "account",
  "new",
  "_next",
  "samples",
]);
