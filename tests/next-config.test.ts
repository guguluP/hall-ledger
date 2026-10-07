import { afterEach, describe, expect, it, vi } from "vitest";

async function loadHeaders(nodeEnv: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  const mod = await import("../next.config");
  const rules = await mod.default.headers!();
  expect(rules).toHaveLength(1);
  expect(rules[0].source).toBe("/:path*");
  return Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("security headers", () => {
  it("sends the full set on every route in production", async () => {
    const h = await loadHeaders("production");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Strict-Transport-Security"]).toContain("max-age=");
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Content-Security-Policy"]).toBeTruthy();
  });

  it("locks the production CSP to same-origin with no eval and no framing", async () => {
    const csp = (await loadHeaders("production"))["Content-Security-Policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/ws:|wss:/);
    expect(csp).not.toMatch(/\*/);
  });

  it("only loosens the CSP for dev tooling in development", async () => {
    const csp = (await loadHeaders("development"))["Content-Security-Policy"];
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
  });

  it("keeps the existing redirects", async () => {
    vi.resetModules();
    const mod = await import("../next.config");
    const redirects = await mod.default.redirects!();
    expect(redirects.map((r) => r.source).sort()).toEqual(["/grid", "/students/upload"]);
  });
});
