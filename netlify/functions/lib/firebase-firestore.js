import crypto from "node:crypto";
import { sanitize } from "./http.js";

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getFirebaseConfig() {
  return {
    projectId: sanitize(process.env.FIREBASE_PROJECT_ID),
    clientEmail: sanitize(process.env.FIREBASE_CLIENT_EMAIL),
    privateKey: sanitize(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, "\n"),
  };
}

export function isFirestoreConfigured() {
  const { projectId, clientEmail, privateKey } = getFirebaseConfig();
  return Boolean(projectId && clientEmail && privateKey);
}

function encodeDocId(value) {
  return encodeURIComponent(sanitize(value).toLowerCase());
}

function firestoreBaseUrl(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function toFirestoreDocument(profile) {
  return {
    fields: {
      email: { stringValue: sanitize(profile.email).toLowerCase() },
      stripeCustomerId: { stringValue: sanitize(profile.stripeCustomerId) },
      stripeSubscriptionId: { stringValue: sanitize(profile.stripeSubscriptionId) },
      subscriptionStatus: { stringValue: sanitize(profile.subscriptionStatus) },
      hasActiveSubscription: { booleanValue: Boolean(profile.hasActiveSubscription) },
      resumeCredits: { integerValue: String(Number(profile.resumeCredits || 0)) },
      lastCheckoutSessionId: { stringValue: sanitize(profile.lastCheckoutSessionId) },
      updatedAt: { timestampValue: new Date().toISOString() },
    },
  };
}

function fromFirestoreDocument(document) {
  if (!document?.fields) {
    return null;
  }

  const fields = document.fields;
  return {
    email: fields.email?.stringValue || "",
    stripe_customer_id: fields.stripeCustomerId?.stringValue || "",
    stripe_subscription_id: fields.stripeSubscriptionId?.stringValue || "",
    subscription_status: fields.subscriptionStatus?.stringValue || "",
    has_active_subscription: Boolean(fields.hasActiveSubscription?.booleanValue),
    resume_credits: Number(fields.resumeCredits?.integerValue || 0),
    last_checkout_session_id: fields.lastCheckoutSessionId?.stringValue || "",
    updated_at: fields.updatedAt?.timestampValue || "",
  };
}

async function getGoogleAccessToken() {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const { clientEmail, privateKey } = getFirebaseConfig();
  if (!clientEmail || !privateKey) {
    throw new Error("Firebase service account is not configured.");
  }

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: clientEmail,
    scope: FIRESTORE_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claimSet));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${encodedHeader}.${encodedClaims}`);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");
  const assertion = `${encodedHeader}.${encodedClaims}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || "Unable to obtain Google access token.");
  }

  cachedAccessToken = payload.access_token;
  cachedAccessTokenExpiresAt = Date.now() + (Number(payload.expires_in || 3600) * 1000);
  return cachedAccessToken;
}

async function firestoreRequest(path, options = {}) {
  const { projectId } = getFirebaseConfig();
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID is not configured.");
  }

  const accessToken = await getGoogleAccessToken();
  const response = await fetch(`${firestoreBaseUrl(projectId)}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body,
  });

  if (response.status === 404) {
    return null;
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Firestore request failed for ${path}.`);
  }

  return payload;
}

export async function getBillingProfileByEmail(email) {
  const safeEmail = sanitize(email).toLowerCase();
  if (!safeEmail) {
    return null;
  }

  const payload = await firestoreRequest(`/billingProfiles/${encodeDocId(safeEmail)}`);
  return fromFirestoreDocument(payload);
}

export async function upsertBillingProfile(profile) {
  const safeEmail = sanitize(profile.email).toLowerCase();
  if (!safeEmail) {
    throw new Error("email is required.");
  }

  const payload = await firestoreRequest(`/billingProfiles/${encodeDocId(safeEmail)}`, {
    method: "PATCH",
    body: JSON.stringify(toFirestoreDocument({
      email: safeEmail,
      stripeCustomerId: profile.stripeCustomerId,
      stripeSubscriptionId: profile.stripeSubscriptionId,
      subscriptionStatus: profile.subscriptionStatus,
      hasActiveSubscription: profile.hasActiveSubscription,
      resumeCredits: profile.resumeCredits,
      lastCheckoutSessionId: profile.lastCheckoutSessionId,
    })),
  });

  return fromFirestoreDocument(payload);
}

export async function adjustCredits(email, delta) {
  const existing = await getBillingProfileByEmail(email);
  const currentCredits = Number(existing?.resume_credits || 0);
  return upsertBillingProfile({
    email,
    stripeCustomerId: existing?.stripe_customer_id,
    stripeSubscriptionId: existing?.stripe_subscription_id,
    subscriptionStatus: existing?.subscription_status,
    hasActiveSubscription: existing?.has_active_subscription,
    resumeCredits: Math.max(0, currentCredits + Number(delta || 0)),
    lastCheckoutSessionId: existing?.last_checkout_session_id,
  });
}

export async function canGenerateWithEntitlement(email) {
  const profile = await getBillingProfileByEmail(email);
  if (!profile) {
    return { allowed: false, reason: "No billing profile found.", profile: null };
  }

  if (profile.has_active_subscription) {
    return { allowed: true, reason: "Active subscription.", profile };
  }

  if (Number(profile.resume_credits || 0) > 0) {
    return { allowed: true, reason: "Resume credits available.", profile };
  }

  return { allowed: false, reason: "No active subscription or resume credits.", profile };
}

export async function consumeResumeCredit(email) {
  const profile = await getBillingProfileByEmail(email);
  if (!profile) {
    throw new Error("No billing profile found.");
  }

  if (profile.has_active_subscription) {
    return profile;
  }

  const credits = Number(profile.resume_credits || 0);
  if (credits < 1) {
    throw new Error("No resume credits remaining.");
  }

  return upsertBillingProfile({
    email,
    stripeCustomerId: profile.stripe_customer_id,
    stripeSubscriptionId: profile.stripe_subscription_id,
    subscriptionStatus: profile.subscription_status,
    hasActiveSubscription: profile.has_active_subscription,
    resumeCredits: credits - 1,
    lastCheckoutSessionId: profile.last_checkout_session_id,
  });
}
