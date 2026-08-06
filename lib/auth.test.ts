import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import {
  COOKIE_NAME,
  generateRefreshToken,
  getUserFromRequest,
  hashPassword,
  hashRefreshToken,
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
    const token = await signJWT({ sub: "user-1", email: "a@b.com" });
    const payload = await verifyJWT(token);
    expect(payload).toMatchObject({ sub: "user-1", email: "a@b.com" });
  });

  it("rejects an expired token", async () => {
    const token = await signJWT({ sub: "user-1", email: "a@b.com" }, -1);
    expect(await verifyJWT(token)).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const token = await signJWT({ sub: "user-1", email: "a@b.com" });
    const [header, body] = token.split(".");
    const tampered = `${header}.${body}.tampered-signature`;
    expect(await verifyJWT(tampered)).toBeNull();
  });

  it("rejects a malformed token", async () => {
    expect(await verifyJWT("not-a-jwt")).toBeNull();
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
    const token = await signJWT({ sub: "user-42", email: "u@example.com" });
    const result = await getUserFromRequest(fakeRequest({ [COOKIE_NAME]: token }));
    expect(result).toEqual({ userId: "user-42", email: "u@example.com" });
  });
});
