import crypto from "node:crypto";
import { sanitize } from "./http.js";

const COOKIE_NAME = "jm_session";

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function getSecret() {
  return sanitize(process.env.APP_SESSION_SECRET);
}

function sign(payloadSegment, secret) {
  return crypto.createHmac("sha256", secret).update(payloadSegment).digest("base64url");
}

export function createSignedSession(payload, options = {}) {
  const secret = getSecret();
  if (!secret) {
    throw new Error("APP_SESSION_SECRET is not configured.");
  }

  const maxAge = Number(options.maxAgeSeconds || 60 * 60 * 24 * 30);
  const envelope = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAge,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(envelope));
  const signature = sign(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifySignedSession(token) {
  const secret = getSecret();
  if (!secret || !token || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, receivedSignature] = token.split(".");
  const expectedSignature = sign(encodedPayload, secret);

  if (!crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function buildSessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 30) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}
