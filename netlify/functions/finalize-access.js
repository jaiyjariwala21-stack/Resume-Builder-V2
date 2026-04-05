import { buildSessionCookie, createSignedSession } from "./lib/app-session.js";
import { json, DEFAULT_HEADERS, parseJsonBody, sanitize } from "./lib/http.js";
import { upsertBillingHistoryEntry, upsertBillingProfile } from "./lib/firebase-firestore.js";
import { stripeRequest } from "./lib/stripe-api.js";

function formatAmountLabel(amountMinor, currency) {
  const safeCurrency = sanitize(currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: safeCurrency,
    }).format(Number(amountMinor || 0) / 100);
  } catch {
    return `${safeCurrency} ${(Number(amountMinor || 0) / 100).toFixed(2)}`;
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: DEFAULT_HEADERS };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const { sessionId } = parseJsonBody(event.body);
    const safeSessionId = sanitize(sessionId);
    if (!safeSessionId) {
      return json(400, { error: "sessionId is required." });
    }

    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(safeSessionId)}`);
    const customerEmail = sanitize(session.customer_details?.email || session.customer_email).toLowerCase();
    if (!customerEmail) {
      return json(400, { error: "Checkout session does not include a customer email." });
    }

    const isSubscription = session.mode === "subscription";
    const paymentComplete = session.payment_status === "paid" || session.status === "complete";

    if (!paymentComplete) {
      return json(402, { error: "Checkout session is not complete yet." });
    }

    await upsertBillingProfile({
      email: customerEmail,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: isSubscription ? session.subscription : "",
      subscriptionStatus: isSubscription ? "active" : "paid",
      hasActiveSubscription: isSubscription,
      resumeCredits: isSubscription ? 0 : 1,
      lastCheckoutSessionId: session.id,
    });

    await upsertBillingHistoryEntry({
      id: `checkout_${session.id}`,
      email: customerEmail,
      kind: isSubscription ? "subscription_checkout" : "single_checkout",
      status: "paid",
      planMode: isSubscription ? "subscription" : "single",
      amountMinor: Number(session.amount_total || 0),
      currency: sanitize(session.currency || "USD"),
      amountLabel: formatAmountLabel(session.amount_total, session.currency),
      stripeCustomerId: sanitize(session.customer),
      stripeSubscriptionId: isSubscription ? sanitize(session.subscription) : "",
      checkoutSessionId: sanitize(session.id),
      source: "finalize-access",
    });

    const token = createSignedSession({
      email: customerEmail,
      stripeCustomerId: sanitize(session.customer),
      subscription: isSubscription,
    });

    return json(200, {
      email: customerEmail,
      message: isSubscription ? "Subscription access activated." : "Resume credit unlocked.",
    }, {
      "Set-Cookie": buildSessionCookie(token),
    });
  } catch (error) {
    return json(500, { error: error.message || "Unable to finalize access." });
  }
}
