import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkPublishAuth, extractSecret, safeEqual } from "@/lib/publish-auth";
import { clientIp, rateLimit, resetRateLimits } from "@/lib/rate-limit";
import {
  declaredTooLarge,
  DEFAULT_MAX_PUBLISH_BYTES,
  DEFAULT_MAX_UPLOAD_BYTES,
  formatBytes,
  maxPublishBytes,
  maxUploadBytes,
} from "@/lib/limits";
import { publicError } from "@/lib/http";
import { isStudentCacheExpired, STUDENTS_TTL_MS } from "@/lib/students";

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/timetable/publish", { method: "POST", headers });
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetRateLimits();
});

describe("publish auth", () => {
  it("fails closed in production when no secret is configured", () => {
    const out = checkPublishAuth(req(), { NODE_ENV: "production" });
    expect(out).toMatchObject({ ok: false, status: 503 });
  });

  it("allows unauthenticated publish outside production when no secret is set", () => {
    expect(checkPublishAuth(req(), { NODE_ENV: "development" })).toEqual({ ok: true });
    expect(checkPublishAuth(req(), { NODE_ENV: "test" })).toEqual({ ok: true });
  });

  it("accepts the secret in x-publish-secret or as a Bearer token", () => {
    const env = { PUBLISH_SECRET: "s3cret", NODE_ENV: "production" };
    expect(checkPublishAuth(req({ "x-publish-secret": "s3cret" }), env).ok).toBe(true);
    expect(checkPublishAuth(req({ authorization: "Bearer s3cret" }), env).ok).toBe(true);
    expect(checkPublishAuth(req({ authorization: "bearer s3cret" }), env).ok).toBe(true);
  });

  it("rejects a missing or wrong secret with 401", () => {
    const env = { PUBLISH_SECRET: "s3cret", NODE_ENV: "production" };
    expect(checkPublishAuth(req(), env)).toMatchObject({ ok: false, status: 401 });
    expect(checkPublishAuth(req({ "x-publish-secret": "nope" }), env)).toMatchObject({ ok: false, status: 401 });
    expect(checkPublishAuth(req({ "x-publish-secret": "s3cret-but-longer" }), env)).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("logs failed attempts without leaking the submitted value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = { PUBLISH_SECRET: "s3cret", NODE_ENV: "production" };
    checkPublishAuth(req({ "x-publish-secret": "guess-123", "x-forwarded-for": "203.0.113.9" }), env);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain("203.0.113.9");
    expect(line).not.toContain("guess-123");
    expect(line).not.toContain("s3cret");
  });

  it("compares secrets without throwing on different lengths", () => {
    expect(safeEqual("a", "a")).toBe(true);
    expect(safeEqual("a", "b")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
  });

  it("prefers the dedicated header over Authorization", () => {
    expect(extractSecret(req({ "x-publish-secret": "a", authorization: "Bearer b" }))).toBe("a");
    expect(extractSecret(req())).toBe("");
  });
});

describe("rate limiter", () => {
  it("allows up to the limit then blocks", () => {
    const opts = { limit: 2, windowMs: 1000 };
    expect(rateLimit("k", opts, 0).ok).toBe(true);
    expect(rateLimit("k", opts, 1).ok).toBe(true);
    const third = rateLimit("k", opts, 2);
    expect(third.ok).toBe(false);
    expect(third.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it("opens a fresh window after it expires", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("k", opts, 0).ok).toBe(true);
    expect(rateLimit("k", opts, 500).ok).toBe(false);
    expect(rateLimit("k", opts, 1001).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("a", opts, 0).ok).toBe(true);
    expect(rateLimit("b", opts, 0).ok).toBe(true);
    expect(rateLimit("a", opts, 1).ok).toBe(false);
  });

  it("finds the client IP from proxy headers", () => {
    expect(clientIp(req({ "x-nf-client-connection-ip": "198.51.100.1", "x-forwarded-for": "10.0.0.1" }))).toBe(
      "198.51.100.1",
    );
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(req())).toBe("unknown");
  });
});

describe("size limits", () => {
  it("defaults to 5 MB uploads and 10 MB publishes", () => {
    expect(maxUploadBytes({})).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    expect(maxPublishBytes({})).toBe(DEFAULT_MAX_PUBLISH_BYTES);
    expect(DEFAULT_MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
  });

  it("honours valid env overrides and ignores junk", () => {
    expect(maxUploadBytes({ UPLOAD_MAX_BYTES: "1000" })).toBe(1000);
    expect(maxUploadBytes({ UPLOAD_MAX_BYTES: "abc" })).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    expect(maxUploadBytes({ UPLOAD_MAX_BYTES: "-5" })).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    expect(maxUploadBytes({ UPLOAD_MAX_BYTES: "0" })).toBe(DEFAULT_MAX_UPLOAD_BYTES);
  });

  it("checks the declared Content-Length", () => {
    expect(declaredTooLarge(req({ "content-length": "2000" }), 1000)).toBe(true);
    expect(declaredTooLarge(req({ "content-length": "500" }), 1000)).toBe(false);
    expect(declaredTooLarge(req(), 1000)).toBe(false);
    expect(declaredTooLarge(req({ "content-length": "NaN" }), 1000)).toBe(false);
  });

  it("formats sizes for people", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(1536)).toBe("2 KB");
    expect(formatBytes(12)).toBe("12 B");
  });
});

describe("publicError", () => {
  it("hides raw exception text in production", () => {
    expect(publicError(new Error("ENOENT /var/task/secret/path"), "Publish failed", { NODE_ENV: "production" })).toBe(
      "Publish failed",
    );
  });

  it("shows the real message outside production", () => {
    expect(publicError(new Error("boom"), "Publish failed", { NODE_ENV: "development" })).toBe("boom");
    expect(publicError("not an error", "Publish failed", { NODE_ENV: "development" })).toBe("Publish failed");
  });
});

describe("student cache expiry", () => {
  it("expires after 24 hours", () => {
    const now = 10 * STUDENTS_TTL_MS;
    expect(isStudentCacheExpired(now - 1000, now)).toBe(false);
    expect(isStudentCacheExpired(now - STUDENTS_TTL_MS - 1, now)).toBe(true);
  });

  it("treats missing or invalid timestamps as expired", () => {
    expect(isStudentCacheExpired(undefined)).toBe(true);
    expect(isStudentCacheExpired("yesterday")).toBe(true);
    expect(isStudentCacheExpired(NaN)).toBe(true);
  });
});
