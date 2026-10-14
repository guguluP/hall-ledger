type HeaderLookup = (name: string) => string | null;

/** Client IP for rate limits. A caller-supplied X-Forwarded-For is ignored unless TRUST_PROXY=1. */
export function clientIpFrom(header: HeaderLookup): string {
  const netlify = header("x-nf-client-connection-ip")?.trim();
  if (netlify) return netlify.slice(0, 64);
  const configured = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (configured) {
    const value = header(configured)?.trim();
    if (value) return value.slice(0, 64);
  }
  if (process.env.TRUST_PROXY === "1") {
    const parts = (header("x-forwarded-for") || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last.slice(0, 64);
  }
  return "direct";
}
