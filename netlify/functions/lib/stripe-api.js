import crypto from "node:crypto";
import { formBody, sanitize } from "./http.js";

const API_BASE = "https://api.stripe.com/v1";

function getStripeSecretKey() {
  return sanitize(process.env.STRIPE_SECRET_KEY);
}

export async function stripeRequest(path, options = {}) {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(options.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(options.headers || {}),
    },
    body: options.form ? formBody(options.form) : options.body,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || `Stripe request failed for ${path}.`);
  }

  return payload;
}

export function verifyStripeSignature(rawBody, signatureHeader, secret) {
  const safeSecret = sanitize(secret);
  if (!safeSecret || !signatureHeader || !rawBody) {
    return false;
  }

  const attributes = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );

  const timestamp = attributes.t;
  const v1 = attributes.v1;
  if (!timestamp || !v1) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", safeSecret).update(signedPayload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}
