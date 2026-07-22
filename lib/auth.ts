import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET as string;
const COOKIE_NAME = "token";

// ── Password helpers ──────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── JWT helpers (using Web Crypto so this works in Edge runtime too) ──────────

interface JWTPayload {
  sub: string; // userId
  email: string;
  iat: number;
  exp: number;
}

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signJWT(
  payload: Omit<JWTPayload, "iat" | "exp">,
  expiresInSeconds = ACCESS_TOKEN_TTL_SECONDS
): Promise<string> {
  const header = base64url(
    new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  );
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(
    new TextEncoder().encode(
      JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds })
    )
  );
  const key = await getKey(JWT_SECRET);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${body}`)
  );
  return `${header}.${body}.${base64url(sig)}`;
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return null;

    const key = await getKey(JWT_SECRET);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      Uint8Array.from(
        atob(sig.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0)
      ),
      new TextEncoder().encode(`${header}.${body}`)
    );
    if (!valid) return null;

    const payload: JWTPayload = JSON.parse(
      atob(body.replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// ── Request helper (Node.js route handlers) ───────────────────────────────────

export async function getUserFromRequest(
  req: NextRequest
): Promise<{ userId: string; email: string } | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyJWT(token);
  if (!payload) return null;
  return { userId: payload.sub, email: payload.email };
}

export { COOKIE_NAME };

// ── Refresh tokens ("remember me") ────────────────────────────────────────────
// Access JWT stays short-lived; a separate opaque refresh token (stored hashed
// in the RefreshToken collection) backs a 30-day sliding session for users who
// check "remember me" at login. Uses Web Crypto (not node:crypto) so this file
// stays importable from edge middleware (proxy.ts) without bundling issues.

export const REFRESH_COOKIE_NAME = "refresh_token";
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24; // 1 day
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function hashRefreshToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw)
  );
  return base64url(digest);
}

export function generateRefreshToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
