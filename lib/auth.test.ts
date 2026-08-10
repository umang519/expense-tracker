import { afterEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import {
  COOKIE_NAME,
  generateRefreshToken,
  getUserFromRequest,
  hashPassword,
  hashRefreshToken,
  isAdminEmail,
  signJWT,
  verifyJWT,
  verifyPassword,
} from "./auth";

function fakeRequest(cookies: Record<string, string>): NextRequest {
  return {
    cookies: {
      get: (name: string) =>
        name in cookies ? { name, value: cookies[name] } : undefined,
    },
  } as unknown as NextRequest;
}

describe("password hashing", () => {
  it("hashes and verifies a matching password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects a non-matching password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});

describe("JWT", () => {
  it("round-trips a valid token", async () => {
    const token = await signJWT({ sub: "user-1", email: "a@b.com", role: "user" });
    const payload = await verifyJWT(token);
    expect(payload).toMatchObject({ sub: "user-1", email: "a@b.com", role: "user" });
  });

  it("round-trips an admin role", async () => {
    const token = await signJWT({ sub: "user-1", email: "a@b.com", role: "admin" });
    const payload = await verifyJWT(token);
    expect(payload).toMatchObject({ role: "admin" });
  });

  it("rejects an expired token", async () => {
    const token = await signJWT({ sub: "user-1", email: "a@b.com", role: "user" }, -1);
    expect(await verifyJWT(token)).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const token = await signJWT({ sub: "user-1", email: "a@b.com", role: "user" });
    const [header, body] = token.split(".");
    const tampered = `${header}.${body}.tampered-signature`;
    expect(await verifyJWT(tampered)).toBeNull();
  });

  it("rejects a malformed token", async () => {
    expect(await verifyJWT("not-a-jwt")).toBeNull();
  });
});

describe("isAdminEmail", () => {
  const originalEnv = process.env.ADMIN_EMAILS;
  afterEach(() => {
    process.env.ADMIN_EMAILS = originalEnv;
  });

  it("matches an email in the allowlist, case-insensitively", () => {
    process.env.ADMIN_EMAILS = "owner@example.com, second@example.com";
    expect(isAdminEmail("Owner@Example.com")).toBe(true);
    expect(isAdminEmail("second@example.com")).toBe(true);
  });

  it("rejects an email not in the allowlist", () => {
    process.env.ADMIN_EMAILS = "owner@example.com";
    expect(isAdminEmail("stranger@example.com")).toBe(false);
  });

  it("rejects everything when the allowlist is unset", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("owner@example.com")).toBe(false);
  });
});

describe("refresh tokens", () => {
  it("hashes deterministically", async () => {
    const raw = "some-opaque-refresh-token";
    expect(await hashRefreshToken(raw)).toBe(await hashRefreshToken(raw));
  });

  it("hashes different inputs differently", async () => {
    expect(await hashRefreshToken("a")).not.toBe(await hashRefreshToken("b"));
  });

  it("generates unique, non-empty tokens", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });
});

describe("getUserFromRequest", () => {
  it("returns null when no cookie is present", async () => {
    expect(await getUserFromRequest(fakeRequest({}))).toBeNull();
  });

  it("returns null for an invalid token", async () => {
    expect(await getUserFromRequest(fakeRequest({ [COOKIE_NAME]: "garbage" }))).toBeNull();
  });

  it("returns the user for a valid token cookie", async () => {
    const token = await signJWT({ sub: "user-42", email: "u@example.com", role: "user" });
    const result = await getUserFromRequest(fakeRequest({ [COOKIE_NAME]: token }));
    expect(result).toEqual({ userId: "user-42", email: "u@example.com", role: "user" });
  });

  it('defaults role to "user" for a token issued before the role claim existed', async () => {
    // Casts around signJWT's type to simulate a validly-signed token from
    // before this claim existed — real old sessions are exactly this shape.
    const legacyPayload = { sub: "user-42", email: "u@example.com" } as Parameters<typeof signJWT>[0];
    const token = await signJWT(legacyPayload);
    const result = await getUserFromRequest(fakeRequest({ [COOKIE_NAME]: token }));
    expect(result?.role).toBe("user");
  });
});
