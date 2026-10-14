import { describe, expect, it } from "vitest";
import { hashPassword, passwordIssue, verifyPassword } from "@/lib/auth/password";
import { tokenLifetimeMs } from "@/lib/auth/tokens";
import { assertCsrf, assertMutation, assertOrigin } from "@/lib/auth/csrf";
import { assertBodyLimit, assertFileSize } from "@/lib/api-error";
import { DraftSlots } from "@/lib/schemas";
import { HttpError } from "@/lib/http-error";
import { applyDemoRoomRules } from "@/lib/rooms";

describe("password, tokens, and guards", () => {
  it("hashes with cost 12 and enforces the 72-byte limit", async () => {
    expect(passwordIssue("x".repeat(73))).toMatch(/72 bytes/);
    expect(passwordIssue("password123")).toMatch(/common/);
    const hash = await hashPassword("correct-horse");
    expect(hash.startsWith("$2a$12$") || hash.startsWith("$2b$12$")).toBe(true);
    expect(await verifyPassword("correct-horse", hash)).toBe(true);
    expect(await verifyPassword("wrong-horse", hash)).toBe(false);
  });

  it("sets token lifetimes", () => {
    expect(tokenLifetimeMs("EMAIL_VERIFY")).toBe(24 * 60 * 60 * 1000);
    expect(tokenLifetimeMs("PASSWORD_RESET")).toBe(60 * 60 * 1000);
  });

  it("blocks a missing origin, a bad CSRF token, a 1.1 MB upload, and 5001 slots", () => {
    const app = "http://localhost:3000/api";
    expect(() => assertOrigin(new Request(app, { method: "POST" }))).toThrow(HttpError);
    expect(() =>
      assertCsrf(new Request(app, { method: "POST", headers: { origin: "http://localhost:3000", cookie: "hl_csrf=abc" } })),
    ).toThrow(HttpError);
    const ok = new Request(app, {
      method: "POST",
      headers: { origin: "http://localhost:3000", cookie: "hl_csrf=abc", "x-csrf-token": "abc" },
    });
    expect(() => assertMutation(ok)).not.toThrow();
    expect(() => assertFileSize(Math.ceil(1.1 * 1024 * 1024))).toThrow(HttpError);
    expect(() => assertBodyLimit(new Request(app, { headers: { "content-length": String(47 * 1024 * 1024) } }))).toThrow(HttpError);
    const tooMany = Array.from({ length: 5001 }, () => ({
      section: "SECTION-A",
      subject: "Math",
      room: "316",
      type: "PP",
      dayOfWeek: 1,
      startMin: 600,
      endMin: 660,
    }));
    expect(DraftSlots.safeParse(tooMany).success).toBe(false);
  });

  it("keeps demo room rules out of the parser path", () => {
    const rules = { prefix: "ME-", padLowMax: 4, meRange: [101, 104] as [number, number] };
    expect(applyDemoRoomRules("101", rules)).toBe("ME-101");
    expect(applyDemoRoomRules("3", rules)).toBe("ME-03");
    expect(applyDemoRoomRules("316", rules)).toBe("316");
  });
});
