import { DEFAULT_HEADERS, json, sanitize } from "./lib/http.js";
import { adjustCredits, upsertBillingHistoryEntry, upsertBillingProfile } from "./lib/firebase-firestore.js";
import { verifyStripeSignature } from "./lib/stripe-api.js";

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

    await upsertBillingHistoryEntry({
      id: `checkout_${sanitize(data.id)}`,
      email: customerEmail,
      kind: data.mode === "subscription" ? "subscription_checkout" : "single_checkout",
      status: "paid",
      planMode: data.mode === "subscription" ? "subscription" : "single",
      amountMinor: Number(data.amount_total || 0),
      currency: sanitize(data.currency || "USD"),
      amountLabel: formatAmountLabel(data.amount_total, data.currency),
      stripeCustomerId: sanitize(data.customer),
      stripeSubscriptionId: data.mode === "subscription" ? sanitize(data.subscription) : "",
      checkoutSessionId: sanitize(data.id),
      source: "stripe-webhook",
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

    await upsertBillingHistoryEntry({
      id: `invoice_${sanitize(data.id)}`,
      email: customerEmail,
      kind: "invoice_paid",
      status: "paid",
      planMode: "subscription",
      amountMinor: Number(data.amount_paid || 0),
      currency: sanitize(data.currency || "USD"),
      amountLabel: formatAmountLabel(data.amount_paid, data.currency),
      stripeCustomerId: sanitize(data.customer),
      stripeSubscriptionId: subscriptionId,
      checkoutSessionId: "",
      source: "stripe-webhook",
      createdAt: data.status_transitions?.paid_at
        ? new Date(Number(data.status_transitions.paid_at) * 1000).toISOString()
        : undefined,
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

    await upsertBillingHistoryEntry({
      id: `subscription_${sanitize(data.id)}_${status}`,
      email: customerEmail,
      kind: "subscription_status",
      status,
      planMode: "subscription",
      amountMinor: 0,
      currency: "",
      amountLabel: "",
      stripeCustomerId: sanitize(data.customer),
      stripeSubscriptionId: sanitize(data.id),
      checkoutSessionId: "",
      source: "stripe-webhook",
    });
    return;
  }

  if (event.type === "charge.refunded" && customerEmail) {
    await adjustCredits(customerEmail, -1);

    await upsertBillingHistoryEntry({
      id: `refund_${sanitize(data.id)}`,
      email: customerEmail,
      kind: "refund",
      status: "refunded",
      planMode: "",
      amountMinor: Number(data.amount_refunded || data.amount || 0),
      currency: sanitize(data.currency || "USD"),
      amountLabel: formatAmountLabel(data.amount_refunded || data.amount, data.currency),
      stripeCustomerId: sanitize(data.customer),
      stripeSubscriptionId: "",
      checkoutSessionId: "",
      source: "stripe-webhook",
      createdAt: data.created ? new Date(Number(data.created) * 1000).toISOString() : undefined,
    });
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
