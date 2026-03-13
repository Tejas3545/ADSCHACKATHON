import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

function getRequiredAdminPassword() {
  const required = process.env.ADMIN_PASSWORD;
  if (!required) {
    throw new Error("Missing ADMIN_PASSWORD");
  }
  return required;
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || getRequiredAdminPassword();
}

function readCookie(req: Request, name: string) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createAdminSessionToken() {
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000;
  const payload = String(expiresAt);
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function verifyAdminSessionToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = signPayload(payload);
  if (!safeEqual(signature, expectedSignature)) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() < expiresAt;
}

export function assertAdmin(req: Request) {
  const required = getRequiredAdminPassword();

  const provided = req.headers.get("x-admin-password");
  if (provided && provided === required) {
    return true;
  }

  const sessionToken = readCookie(req, ADMIN_SESSION_COOKIE);
  if (!sessionToken) return false;

  return verifyAdminSessionToken(sessionToken);
}
