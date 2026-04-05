# Monetization Plan

## Short answer

Yes, you can monetize this app using your own provider API keys, but the key must live only on the server. It should not be hashed for runtime use because the server has to recover the original secret value to call the provider API. Instead, store it as an encrypted secret in your hosting platform's environment variables or secret manager.

## Recommended production model

### Payments

- Use Stripe Checkout for the main monetization path.
- Offer:
  - pay-per-resume for one-off users
  - monthly subscription for repeat users

### AI key handling

- Store `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GOOGLE_API_KEY` in server-side environment variables.
- Route all model requests through your own backend.
- Never expose provider keys in the browser.

### Access control

To enforce entitlements safely, use persistent storage. Stateless alone is not enough for a real paid product because you need to record:

- who paid
- what they purchased
- how many credits remain
- whether a subscription is active
- whether a webhook has already been processed

## Minimum components needed for real billing

### Required

- Stripe account or PayPal business account
- server-side secret storage
- webhook endpoint
- persistent database

### Strongly recommended

- customer accounts or magic-link login
- usage logging
- rate limiting
- abuse detection
- receipt and billing email flow

## Best launch option

For a simple V1, use:

- Stripe Checkout
- one monthly subscription
- one pay-per-resume option
- Supabase or Neon for customer and entitlement records
- Netlify environment variables for provider keys

## What is already in this repo

- `generate-docs.js` now supports server-side provider keys.
- `parse-job.js` now supports server-side provider keys.
- `create-checkout-session.js` scaffolds Stripe Checkout session creation.

## What is still needed before charging real customers

- user accounts
- Stripe webhook handling
- persistent entitlement storage
- success-page verification
- generate request gating based on paid status
