const DEFAULT_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(body),
  };
}

function sanitize(input) {
  return String(input || "").replace(/\u0000/g, "").trim();
}

function formBody(values) {
  return new URLSearchParams(values).toString();
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: DEFAULT_HEADERS };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const stripeKey = sanitize(process.env.STRIPE_SECRET_KEY);
    const appUrl = sanitize(process.env.APP_URL) || "http://localhost:8888";
    const singlePriceId = sanitize(process.env.STRIPE_PRICE_ID_SINGLE_RESUME);
    const monthlyPriceId = sanitize(process.env.STRIPE_PRICE_ID_MONTHLY);

    if (!stripeKey) {
      return json(400, { error: "Stripe is not configured yet." });
    }

    const { mode, customerEmail } = JSON.parse(event.body || "{}");
    const normalizedMode = sanitize(mode || "single");
    const priceId = normalizedMode === "subscription" ? monthlyPriceId : singlePriceId;

    if (!priceId) {
      return json(400, { error: "The selected price is not configured yet." });
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody({
        mode: normalizedMode === "subscription" ? "subscription" : "payment",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/?checkout=cancelled`,
        ...(sanitize(customerEmail) ? { customer_email: sanitize(customerEmail) } : {}),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      return json(response.status, { error: payload.error?.message || "Unable to create Stripe checkout session." });
    }

    return json(200, {
      url: payload.url,
      id: payload.id,
    });
  } catch (error) {
    return json(500, { error: error.message || "Unable to create checkout session." });
  }
}
