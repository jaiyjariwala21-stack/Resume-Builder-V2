# Firebase Firestore Setup

This project is designed to use Firebase's free tier in a storage-only role:

- Netlify Functions handle billing and generation
- Firestore stores billing state, billing history, and optional saved user content
- Stripe handles payments
- Firebase Auth handles optional sign-in for saved resumes and history

## Why this design

It avoids Firebase Functions so you can stay aligned with a free-tier-first MVP.

## Required Firebase environment variables

Add these to Netlify:

```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Use a Firebase service account with Firestore access. Store the private key exactly as an environment variable and preserve line breaks as `\n`.

## Firestore collections

The server-side billing layer uses:

- `billingProfiles`
- `billingHistory`

The optional account layer uses:

- `users`
- `savedResumes`

Each `billingProfiles` document id is the lowercased customer email. Example:

`billingProfiles/user@example.com`

## Document shape

```json
{
  "email": "user@example.com",
  "stripeCustomerId": "cus_123",
  "stripeSubscriptionId": "sub_123",
  "subscriptionStatus": "active",
  "hasActiveSubscription": true,
  "resumeCredits": 3,
  "lastCheckoutSessionId": "cs_test_123",
  "updatedAt": "2026-04-05T12:00:00.000Z"
}
```

## Suggested Firestore rules

If you want optional client-side accounts for saved resumes and billing history, use rules shaped like this:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /billingProfiles/{document=**} {
      allow read, write: if false;
    }

    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /savedResumes/{documentId} {
      allow create: if request.auth != null
        && request.resource.data.ownerUid == request.auth.uid;
      allow read, update, delete: if request.auth != null
        && resource.data.ownerUid == request.auth.uid;
    }

    match /billingHistory/{documentId} {
      allow read: if request.auth != null
        && resource.data.email == request.auth.token.email;
      allow write: if false;
    }
  }
}
```

If you do not want optional accounts yet, you can keep client access locked down entirely and let only Netlify Functions write billing data with the service account.

## Free-tier planning

Keep the model lean:

- one read for access status
- one read before generation
- one write to decrement a credit when needed

That fits much better within the Spark quota than logging every intermediate event as its own document.
