import { DEFAULT_HEADERS, json, parseJsonBody, sanitize } from "./lib/http.js";
import { stripeRequest } from "./lib/stripe-api.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: DEFAULT_HEADERS };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const appUrl = sanitize(process.env.APP_URL) || "http://localhost:8888";
    const singlePriceId = sanitize(process.env.STRIPE_PRICE_ID_SINGLE_RESUME);
    const monthlyPriceId = sanitize(process.env.STRIPE_PRICE_ID_MONTHLY);
    const { mode, customerEmail } = parseJsonBody(event.body);
    const normalizedMode = sanitize(mode || "single");
    const safeEmail = sanitize(customerEmail).toLowerCase();
    const priceId = normalizedMode === "subscription" ? monthlyPriceId : singlePriceId;

    if (!safeEmail) {
      return json(400, { error: "customerEmail is required." });
    }

    if (!priceId) {
      return json(400, { error: "The selected price is not configured yet." });
    }

    const payload = await stripeRequest("/checkout/sessions", {
      method: "POST",
      form: {
        mode: normalizedMode === "subscription" ? "subscription" : "payment",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: `${appUrl}/?checkout=success&billing=${normalizedMode}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/?checkout=cancelled`,
        customer_email: safeEmail,
        client_reference_id: safeEmail,
        "metadata[plan_mode]": normalizedMode,
      },
    });

    return json(200, {
      url: payload.url,
      id: payload.id,
    });
  } catch (error) {
    return json(500, { error: error.message || "Unable to create checkout session." });
  }
}
