import { DEFAULT_HEADERS, json, sanitize } from "./lib/http.js";
import { adjustCredits, upsertBillingProfile } from "./lib/firebase-firestore.js";
import { verifyStripeSignature } from "./lib/stripe-api.js";

async function handleEvent(event) {
  const data = event.data?.object || {};
  const customerEmail = sanitize(
    data.customer_details?.email || data.customer_email || data.email,
  ).toLowerCase();

  if (event.type === "checkout.session.completed") {
    if (!customerEmail) {
      return;
    }

    await upsertBillingProfile({
      email: customerEmail,
      stripeCustomerId: sanitize(data.customer),
      stripeSubscriptionId: data.mode === "subscription" ? sanitize(data.subscription) : "",
      subscriptionStatus: data.mode === "subscription" ? "active" : "paid",
      hasActiveSubscription: data.mode === "subscription",
      resumeCredits: data.mode === "subscription" ? 0 : 1,
      lastCheckoutSessionId: sanitize(data.id),
    });
    return;
  }

  if (event.type === "invoice.paid") {
    const subscriptionId = sanitize(data.subscription);
    if (!subscriptionId || !customerEmail) {
      return;
    }

    await upsertBillingProfile({
      email: customerEmail,
      stripeCustomerId: sanitize(data.customer),
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: "active",
      hasActiveSubscription: true,
      resumeCredits: 0,
      lastCheckoutSessionId: "",
    });
    return;
  }

  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
    if (!customerEmail) {
      return;
    }

    const status = sanitize(data.status);
    await upsertBillingProfile({
      email: customerEmail,
      stripeCustomerId: sanitize(data.customer),
      stripeSubscriptionId: sanitize(data.id),
      subscriptionStatus: status,
      hasActiveSubscription: status === "active" || status === "trialing",
      resumeCredits: 0,
      lastCheckoutSessionId: "",
    });
    return;
  }

  if (event.type === "charge.refunded" && customerEmail) {
    await adjustCredits(customerEmail, -1);
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
    const webhookSecret = sanitize(process.env.STRIPE_WEBHOOK_SECRET);
    const signature = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
    const rawBody = event.body || "";

    if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
      return json(400, { error: "Invalid Stripe signature." });
    }

    const stripeEvent = JSON.parse(rawBody);
    await handleEvent(stripeEvent);

    return json(200, { received: true });
  } catch (error) {
    return json(500, { error: error.message || "Unable to process Stripe webhook." });
  }
}
