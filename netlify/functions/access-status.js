import { parseCookies, json, DEFAULT_HEADERS } from "./lib/http.js";
import { getSessionCookieName, verifySignedSession } from "./lib/app-session.js";
import { canGenerateWithEntitlement, getBillingProfileByEmail, isFirestoreConfigured } from "./lib/firebase-firestore.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: DEFAULT_HEADERS };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const cookies = parseCookies(event.headers.cookie || event.headers.Cookie);
    const session = verifySignedSession(cookies[getSessionCookieName()]);
    if (!session?.email) {
      return json(200, {
        authenticated: false,
        billingConfigured: isFirestoreConfigured(),
      });
    }

    const entitlement = isFirestoreConfigured()
      ? await canGenerateWithEntitlement(session.email)
      : { allowed: true, reason: "Session exists, but Firestore billing storage is not configured.", profile: null };
    const profile = isFirestoreConfigured() ? await getBillingProfileByEmail(session.email) : null;

    return json(200, {
      authenticated: true,
      billingConfigured: isFirestoreConfigured(),
      email: session.email,
      canGenerate: entitlement.allowed,
      reason: entitlement.reason,
      profile: profile
        ? {
            resumeCredits: Number(profile.resume_credits || 0),
            hasActiveSubscription: Boolean(profile.has_active_subscription),
            subscriptionStatus: profile.subscription_status || "",
          }
        : null,
    });
  } catch (error) {
    return json(500, { error: error.message || "Unable to load access status." });
  }
}
