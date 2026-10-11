// @vitest-environment node
import express, { type RequestHandler } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getActivePlanByUserId: vi.fn(),
  listEntitlementsByUser: vi.fn(),
}));
vi.mock("./storage", () => ({ storage }));
vi.mock("./etl", () => ({ enqueueJob: vi.fn() }));
vi.mock("./upload", () => ({
  upload: { single: () => ((_req, _res, next) => next()) as RequestHandler },
}));
import { registerRoutes } from "./routes";

const companyPaths = [
  "/api/companies/1", "/api/companies/1/stats",
  "/api/companies/1/shipments-over-time", "/api/companies/1/top-partners",
  "/api/companies/1/top-origin-countries", "/api/companies/1/top-destination-ports",
  "/api/companies/1/top-hs-codes", "/api/companies/1/shipments",
];
const protectedRoutes = [
  ["POST", "/api/plans/quote"], ["POST", "/api/plans/subscribe"],
  ...companyPaths.map(path => ["GET", path]),
  ["GET", "/api/ingestions"], ["GET", "/api/ingestions/1"],
  ["GET", "/api/ingestions/1/errors"], ["POST", "/api/ingestions"],
  ["PATCH", "/api/ingestions/1"], ["POST", "/api/upload"],
];

describe("availability when session database reads fail", () => {
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    vi.resetAllMocks();
    storage.getUserById.mockResolvedValue({ id: 1, isAdmin: false });
    storage.getActivePlanByUserId.mockResolvedValue(null);
    storage.listEntitlementsByUser.mockResolvedValue([]);
    const app = express();
    app.use(express.json());
    // Synthetic session only: no live database, credentials, or account writes.
    app.use((req, _res, next) => {
      req.session = { userId: req.headers["x-test-session"] ? 1 : undefined } as typeof req.session;
      next();
    });
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  });

  async function request(path: string, method = "GET", signedIn = true, body?: object) {
    return fetch(origin + path, {
      method,
      headers: { ...(signedIn ? { "x-test-session": "1" } : {}), "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(1500),
    });
  }

  async function expectAvailableAfterFailure(path: string, method = "GET") {
    const failure = await request(path, method);
    expect(failure.status).toBe(500);
    expect(await failure.json()).toHaveProperty("message");
    const healthy = await request("/api/companies/search?q=", "GET", false);
    expect(healthy.status).toBe(200);
    expect(await healthy.json()).toMatchObject({ mode: "guest" });
  }

  it.each(protectedRoutes)("contains user lookup rejection: %s %s", async (method, path) => {
    storage.getUserById.mockRejectedValue(new Error("synthetic database unavailable"));
    await expectAvailableAfterFailure(path, method);
  });

  it.each(companyPaths)("contains plan lookup rejection: %s", async path => {
    storage.getActivePlanByUserId.mockRejectedValue(new Error("synthetic plan read failure"));
    await expectAvailableAfterFailure(path);
  });

  it.each(companyPaths)("contains entitlement lookup rejection: %s", async path => {
    storage.listEntitlementsByUser.mockRejectedValue(new Error("synthetic entitlement read failure"));
    await expectAvailableAfterFailure(path);
  });

  it.each(protectedRoutes)("still rejects missing sessions: %s %s", async (method, path) => {
    const response = await request(path.replace("companies/1", "companies/2147483647"), method, false);
    expect(response.status).toBe(401);
    expect(storage.getUserById).not.toHaveBeenCalled();
  });

  it("retains a successful authenticated quote", async () => {
    const response = await request("/api/plans/quote", "POST", true, {
      importerQuota: 1, exporterQuota: 0, ncmQuota: 0, billingCycle: "monthly",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("quote.monthlyTotal");
  });
});
