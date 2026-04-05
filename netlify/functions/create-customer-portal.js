import { DEFAULT_HEADERS, json, parseCookies } from "./lib/http.js";
import { getSessionCookieName, verifySignedSession } from "./lib/app-session.js";
import { getBillingProfileByEmail } from "./lib/firebase-firestore.js";
import { stripeRequest } from "./lib/stripe-api.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: DEFAULT_HEADERS };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const cookies = parseCookies(event.headers.cookie || event.headers.Cookie);
    const session = verifySignedSession(cookies[getSessionCookieName()]);
    if (!session?.email) {
      return json(401, { error: "Sign in with a paid session first." });
    }

    const profile = await getBillingProfileByEmail(session.email);
    if (!profile?.stripe_customer_id) {
      return json(404, { error: "No billing customer found for this session." });
    }

    const appUrl = process.env.APP_URL || "http://localhost:8888";
    const portal = await stripeRequest("/billing_portal/sessions", {
      method: "POST",
      form: {
        customer: profile.stripe_customer_id,
        return_url: appUrl,
      },
    });

    return json(200, { url: portal.url });
  } catch (error) {
    return json(500, { error: error.message || "Unable to create billing portal session." });
  }
}
