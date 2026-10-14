export function safeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/account";
  if (value.includes("\\") || value.includes("%5c") || value.includes("%5C")) return "/account";
  return value;
}
