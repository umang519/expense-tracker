import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";
import { clearTestDb, startTestDb, stopTestDb } from "./dbHelper";

vi.mock("next/cache", () => ({
  unstable_cache:
    <T extends (...args: never[]) => unknown>(fn: T) =>
    (...args: Parameters<T>) =>
      fn(...args),
  revalidateTag: vi.fn(),
}));

let resetPassword: typeof import("@/app/api/auth/reset-password/route");
let changePassword: typeof import("@/app/api/auth/change-password/route");
let refresh: typeof import("@/app/api/auth/refresh/route");
let auth: typeof import("@/lib/auth");
let User: typeof import("@/models/User").default;
let RefreshToken: typeof import("@/models/RefreshToken").default;

const CODE = "123456";
const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");

beforeAll(async () => {
  await startTestDb();
  const { connectDB } = await import("@/lib/db");
  await connectDB();
  resetPassword = await import("@/app/api/auth/reset-password/route");
  changePassword = await import("@/app/api/auth/change-password/route");
  refresh = await import("@/app/api/auth/refresh/route");
  auth = await import("@/lib/auth");
  User = (await import("@/models/User")).default;
  RefreshToken = (await import("@/models/RefreshToken")).default;
});

afterAll(async () => {
  await stopTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

function post(url: string, body: unknown, cookie = "") {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

// A "remember me" session on one device, as login would create it.
async function createSession(userId: string): Promise<string> {
  const raw = auth.generateRefreshToken();
  await RefreshToken.create({
    userId,
    tokenHash: await auth.hashRefreshToken(raw),
    expiresAt: new Date(Date.now() + auth.REFRESH_TOKEN_TTL_SECONDS * 1000),
  });
  return raw;
}

async function tryRefresh(rawToken: string): Promise<number> {
  const res = await refresh.POST(post("/api/auth/refresh", {}, `${auth.REFRESH_COOKIE_NAME}=${rawToken}`));
  return res.status;
}

describe("password reset revokes every session (B10)", () => {
  it("a stolen remember-me session stops working after the owner resets their password", async () => {
    const user = await User.create({
      email: "victim@test.dev",
      passwordHash: await auth.hashPassword("oldpassword1"),
      resetOtp: hashOtp(CODE),
      resetOtpExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    const stolen = await createSession(String(user._id));

    const res = await resetPassword.POST(
      post("/api/auth/reset-password", { email: "victim@test.dev", otp: CODE, newPassword: "newpassword1" })
    );
    expect(res.status).toBe(200);

    expect(await tryRefresh(stolen)).toBe(401);
    expect(await RefreshToken.countDocuments({ userId: user._id })).toBe(0);
  });

  it("doesn't touch other users' sessions", async () => {
    const user = await User.create({
      email: "victim@test.dev",
      passwordHash: await auth.hashPassword("oldpassword1"),
      resetOtp: hashOtp(CODE),
      resetOtpExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    const other = await User.create({ email: "other@test.dev", passwordHash: "x" });
    await createSession(String(user._id));
    const othersSession = await createSession(String(other._id));

    await resetPassword.POST(
      post("/api/auth/reset-password", { email: "victim@test.dev", otp: CODE, newPassword: "newpassword1" })
    );

    expect(await tryRefresh(othersSession)).toBe(200);
  });
});

describe("password change revokes other sessions, keeps this one (B10)", () => {
  async function setup() {
    const user = await User.create({ email: "me@test.dev", passwordHash: await auth.hashPassword("oldpassword1") });
    const userId = String(user._id);
    const access = await auth.signJWT({ sub: userId, email: "me@test.dev", role: "user" });
    return { user, userId, access };
  }

  it("signs out other devices but keeps the current device signed in", async () => {
    const { userId, access } = await setup();
    const thisDevice = await createSession(userId);
    const otherDevice = await createSession(userId);

    const res = await changePassword.POST(
      post(
        "/api/auth/change-password",
        { currentPassword: "oldpassword1", newPassword: "newpassword1" },
        `${auth.COOKIE_NAME}=${access}; ${auth.REFRESH_COOKIE_NAME}=${thisDevice}`
      )
    );
    expect(res.status).toBe(200);

    expect(await tryRefresh(otherDevice)).toBe(401);
    expect(await tryRefresh(thisDevice)).toBe(200);
  });

  it("revokes all remember-me sessions when the current device has none", async () => {
    const { userId, access } = await setup();
    const otherDevice = await createSession(userId);

    const res = await changePassword.POST(
      post(
        "/api/auth/change-password",
        { currentPassword: "oldpassword1", newPassword: "newpassword1" },
        `${auth.COOKIE_NAME}=${access}`
      )
    );
    expect(res.status).toBe(200);
    expect(await tryRefresh(otherDevice)).toBe(401);
  });

  it("revokes nothing when the current password is wrong", async () => {
    const { userId, access } = await setup();
    const otherDevice = await createSession(userId);

    const res = await changePassword.POST(
      post(
        "/api/auth/change-password",
        { currentPassword: "wrongpassword", newPassword: "newpassword1" },
        `${auth.COOKIE_NAME}=${access}`
      )
    );
    expect(res.status).toBe(400);
    expect(await tryRefresh(otherDevice)).toBe(200);
  });
});
