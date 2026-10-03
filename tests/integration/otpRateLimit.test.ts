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

let verifyEmail: typeof import("@/app/api/auth/verify-email/route");
let resetPassword: typeof import("@/app/api/auth/reset-password/route");
let emailChangeConfirm: typeof import("@/app/api/auth/email-change/confirm/route");
let signJWT: typeof import("@/lib/auth").signJWT;
let User: typeof import("@/models/User").default;

const CODE = "123456";
const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");
const inFifteen = () => new Date(Date.now() + 15 * 60 * 1000);

beforeAll(async () => {
  await startTestDb();
  const { connectDB } = await import("@/lib/db");
  await connectDB();
  verifyEmail = await import("@/app/api/auth/verify-email/route");
  resetPassword = await import("@/app/api/auth/reset-password/route");
  emailChangeConfirm = await import("@/app/api/auth/email-change/confirm/route");
  signJWT = (await import("@/lib/auth")).signJWT;
  User = (await import("@/models/User")).default;
});

afterAll(async () => {
  await stopTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

// Each request comes from a different IP — the attacker rotating addresses
// that a per-IP limit alone can't stop.
let ipCounter = 0;
function post(url: string, body: unknown, cookie = "") {
  ipCounter++;
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.0.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("OTP brute-force protection (B4)", () => {
  it("verify-email: blocks the 6th guess per account, even from rotating IPs", async () => {
    await User.create({
      email: "new@test.dev",
      passwordHash: "x",
      isEmailVerified: false,
      verifyOtp: hashOtp(CODE),
      verifyOtpExpiresAt: inFifteen(),
    });

    for (let i = 0; i < 5; i++) {
      const res = await verifyEmail.POST(post("/api/auth/verify-email", { email: "new@test.dev", otp: "000000" }));
      expect(res.status).toBe(400);
    }
    // Even the correct code is refused once the account is locked out.
    const blocked = await verifyEmail.POST(post("/api/auth/verify-email", { email: "new@test.dev", otp: CODE }));
    expect(blocked.status).toBe(429);
  });

  it("verify-email: one account's lockout doesn't affect another", async () => {
    await User.create({ email: "a@test.dev", passwordHash: "x", verifyOtp: hashOtp("111111"), verifyOtpExpiresAt: inFifteen() });
    await User.create({ email: "b@test.dev", passwordHash: "x", verifyOtp: hashOtp(CODE), verifyOtpExpiresAt: inFifteen() });

    for (let i = 0; i < 6; i++) {
      await verifyEmail.POST(post("/api/auth/verify-email", { email: "a@test.dev", otp: "000000" }));
    }
    const ok = await verifyEmail.POST(post("/api/auth/verify-email", { email: "b@test.dev", otp: CODE }));
    expect(ok.status).toBe(200);
  });

  it("reset-password: blocks the 6th guess per account, even from rotating IPs", async () => {
    await User.create({
      email: "reset@test.dev",
      passwordHash: "x",
      isEmailVerified: true,
      resetOtp: hashOtp(CODE),
      resetOtpExpiresAt: inFifteen(),
    });

    for (let i = 0; i < 5; i++) {
      const res = await resetPassword.POST(
        post("/api/auth/reset-password", { email: "reset@test.dev", otp: "000000", newPassword: "newpassword1" })
      );
      expect(res.status).toBe(400);
    }
    const blocked = await resetPassword.POST(
      post("/api/auth/reset-password", { email: "reset@test.dev", otp: CODE, newPassword: "newpassword1" })
    );
    expect(blocked.status).toBe(429);
  });

  it("email-change/confirm: blocks the 6th guess per signed-in user", async () => {
    const user = await User.create({
      email: "old@test.dev",
      passwordHash: "x",
      isEmailVerified: true,
      pendingEmail: "new-address@test.dev",
      emailOtp: hashOtp(CODE),
      emailOtpExpiresAt: inFifteen(),
    });
    const cookie = `token=${await signJWT({ sub: String(user._id), email: user.email, role: "user" })}`;

    for (let i = 0; i < 5; i++) {
      const res = await emailChangeConfirm.POST(post("/api/auth/email-change/confirm", { otp: "000000" }, cookie));
      expect(res.status).toBe(400);
    }
    const blocked = await emailChangeConfirm.POST(post("/api/auth/email-change/confirm", { otp: CODE }, cookie));
    expect(blocked.status).toBe(429);
    expect((await User.findById(user._id))?.email).toBe("old@test.dev");
  });

  it("a correct code within the limit still works", async () => {
    await User.create({ email: "ok@test.dev", passwordHash: "x", verifyOtp: hashOtp(CODE), verifyOtpExpiresAt: inFifteen() });
    await verifyEmail.POST(post("/api/auth/verify-email", { email: "ok@test.dev", otp: "000000" }));
    const res = await verifyEmail.POST(post("/api/auth/verify-email", { email: "ok@test.dev", otp: CODE }));
    expect(res.status).toBe(200);
    expect((await User.findOne({ email: "ok@test.dev" }))?.isEmailVerified).toBe(true);
  });
});
