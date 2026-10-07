import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { POST as publish } from "@/app/api/timetable/publish/route";
import { POST as upload } from "@/app/api/timetable/upload/route";
import { GET as vacancy } from "@/app/api/vacancy/route";
import { GET as health } from "@/app/api/health/route";
import { GET as grid } from "@/app/api/timetable/grid/route";
import { resetRateLimits } from "@/lib/rate-limit";

const BASE = "http://localhost";

function publishReq(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${BASE}/api/timetable/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function uploadReq(file?: File, headers: Record<string, string> = {}) {
  const form = new FormData();
  if (file) form.append("file", file);
  return new NextRequest(`${BASE}/api/timetable/upload`, { method: "POST", body: form, headers });
}

beforeEach(() => {
  resetRateLimits();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/timetable/publish", () => {
  it("is disabled in production when PUBLISH_SECRET is not set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLISH_SECRET", "");
    const res = await publish(publishReq({ parse: { allSlots: [] } }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/PUBLISH_SECRET/);
  });

  it("returns 401 without the secret and 401 with a wrong one", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLISH_SECRET", "s3cret");
    expect((await publish(publishReq({ parse: {} }))).status).toBe(401);
    expect((await publish(publishReq({ parse: {} }, { "x-publish-secret": "wrong" }))).status).toBe(401);
  });

  it("returns 400 for a missing payload once authorised", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLISH_SECRET", "s3cret");
    const headers = { "x-publish-secret": "s3cret" };
    const res = await publish(publishReq({}, headers));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Missing parse payload/);
  });

  it("returns 400 for a body that is not JSON", async () => {
    vi.stubEnv("PUBLISH_SECRET", "s3cret");
    const res = await publish(publishReq("{not json", { "x-publish-secret": "s3cret" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the parse has nothing to publish", async () => {
    vi.stubEnv("PUBLISH_SECRET", "s3cret");
    const res = await publish(publishReq({ parse: { allSlots: [] } }, { "x-publish-secret": "s3cret" }));
    expect(res.status).toBe(400);
  });

  it("rejects an oversized payload with 413", async () => {
    vi.stubEnv("PUBLISH_SECRET", "s3cret");
    vi.stubEnv("PUBLISH_MAX_BYTES", "100");
    const res = await publish(
      publishReq({ parse: {} }, { "x-publish-secret": "s3cret", "content-length": "5000" }),
    );
    expect(res.status).toBe(413);
  });

  it("rate limits repeated attempts", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLISH_SECRET", "s3cret");
    const headers = { "x-publish-secret": "s3cret", "x-forwarded-for": "198.51.100.77" };
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await publish(publishReq({}, headers))).status;
    expect(last).toBe(429);
  });
});

describe("POST /api/timetable/upload", () => {
  it("returns 400 when no file is sent", async () => {
    const res = await upload(uploadReq());
    expect(res.status).toBe(400);
  });

  it("rejects unsupported file types", async () => {
    const res = await upload(uploadReq(new File(["x"], "malware.exe")));
    expect(res.status).toBe(400);
  });

  it("rejects empty files", async () => {
    const res = await upload(uploadReq(new File([], "empty.csv")));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/empty/i);
  });

  it("rejects files over the size cap with 413", async () => {
    vi.stubEnv("UPLOAD_MAX_BYTES", "100");
    const res = await upload(uploadReq(new File(["x".repeat(500)], "big.csv")));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/too large/i);
  });

  it("rejects an oversized declared Content-Length before reading the body", async () => {
    vi.stubEnv("UPLOAD_MAX_BYTES", "100");
    const res = await upload(uploadReq(new File(["x"], "a.csv"), { "content-length": "999999" }));
    expect(res.status).toBe(413);
  });

  it("parses the bundled CSV template", async () => {
    const csv = readFileSync(path.join(process.cwd(), "public/samples/timetable-template.csv"));
    const res = await upload(uploadReq(new File([csv], "timetable-template.csv")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fileName).toBe("timetable-template.csv");
    expect(data.parse.allSlots.length).toBeGreaterThan(0);
    expect(data.parse.summary.totalSlots).toBe(data.parse.allSlots.length);
    expect(Array.isArray(data.parse.hardConflicts)).toBe(true);
  });

  it("rate limits bursts from one client", async () => {
    const headers = { "x-forwarded-for": "198.51.100.88" };
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await upload(uploadReq(undefined, headers))).status;
    expect(last).toBe(429);
  });
});

describe("GET /api/vacancy", () => {
  it("returns 400 for an unreadable time window", async () => {
    const res = await vacancy(new NextRequest(`${BASE}/api/vacancy?day=1&start=zzz&end=12:30`));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a window longer than 12 hours", async () => {
    const res = await vacancy(new NextRequest(`${BASE}/api/vacancy?day=1&start=00:00&end=13:00`));
    expect(res.status).toBe(400);
  });

  it("answers a normal search from the seed", async () => {
    const res = await vacancy(new NextRequest(`${BASE}/api/vacancy?day=1&start=10:30&end=11:30`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.rooms)).toBe(true);
    expect(data.total).toBeGreaterThan(0);
    expect(data.start).toBe("10:30");
  });
});

describe("GET /api/health", () => {
  it("reports on the timetable store, not the database", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.slots).toBeGreaterThan(0);
    expect(["seed", "upload"]).toContain(data.store);
    expect(data).not.toHaveProperty("prisma");
    expect(data).not.toHaveProperty("error");
  });
});

describe("GET /api/timetable/grid", () => {
  it("serves the seed timetable", async () => {
    const data = await (await grid()).json();
    expect(data.slots.length).toBeGreaterThan(0);
    expect(data.rooms.length).toBeGreaterThan(0);
  });
});
