# Job Machine

Job Machine is a stateless web app for tailoring a resume to a specific job description using the user's own API key. It combines browser-side resume parsing, lightweight ATS-style matching, serverless multi-provider AI generation, and an optional Firebase-backed account mode in a Netlify-friendly deployment model.

The app still supports guest mode with no mandatory signup. Users can upload a PDF or DOCX resume, paste or scrape a job description, choose an LLM provider, generate a tailored resume and cover letter, edit the results inline, and export the final documents as PDFs. If they choose to create an account, they can also save resumes, generated drafts, and view billing history tied to their email.

## Why This Project Exists

Most resume tools either:

- focus only on writing assistance
- focus only on ATS scoring
- require creating an account and storing sensitive data
- lock users into a single AI provider

Job Machine is intended to be a privacy-first alternative for people who already have an API key and want a fast, deployment-light workflow:

- no database required
- no backend infrastructure beyond Netlify Functions
- no API key storage
- no mandatory signup
- optional account-based saved history
- support for OpenAI, Anthropic, and Google Gemini

## Product Goals

This V1 is built around a few practical goals:

- make resume tailoring fast enough to feel iterative
- keep user data ephemeral
- avoid inventing experience or achievements
- help users see job/resume fit before generating new documents
- stay simple enough to deploy and maintain cheaply

## What The App Does

### Resume input

Users can either:

- upload a `.pdf`
- upload a `.docx`
- paste resume text manually

Parsing happens in the browser:

- PDFs are parsed with `pdf.js`
- DOCX files are parsed with `mammoth.js`

The extracted text is dropped into an editable textarea and also split into basic resume sections:

- Summary
- Experience
- Skills
- Education

Those section fields are editable and can be recomposed into the main resume body.

### Job input

Users can either:

- paste a job URL
- paste the raw job description manually

If a URL is provided, the app attempts to fetch the posting using the `scrape-job` Netlify Function. If scraping is blocked or fails, the user can continue by pasting the job description directly.

### Match scoring

Before generation, the app analyzes overlap between the resume and the job description. It computes:

- a match score from `0` to `100`
- overlapping skills and keywords
- missing keywords
- suggested improvements

This is not meant to be a perfect ATS emulator. It is a useful V1 heuristic to help users quickly identify obvious alignment gaps.

### AI generation

The app sends:

- the resume text
- the job description
- the parsed job summary
- the keyword match result
- the selected provider
- the user-supplied API key

to the `generate-docs` function. That function routes to the selected LLM provider and asks for:

- a tailored resume
- a cover letter

The prompt explicitly instructs the model:

- not to fabricate experience
- not to invent metrics
- not to invent employers, titles, or dates
- to only rephrase, reorder, condense, and emphasize existing facts

### Output and export

The generated resume and cover letter are shown in editable textareas. Users can modify them before exporting.

Export is handled in the browser using `jsPDF`.

### Optional account mode

Users can optionally create an account with Firebase Auth. When signed in, they can:

- save resume snapshots
- save generated drafts
- view billing history that matches their signed-in email

Guest mode remains available, and paid generation continues to rely on server-side billing checks plus provider secrets stored in Netlify environment variables.

## Tech Stack

### Frontend

- HTML
- CSS
- vanilla JavaScript
- `pdf.js`
- `mammoth.js`
- `jsPDF`

### Hosting and backend

- Netlify
- Netlify Functions

### AI providers

- OpenAI
- Anthropic
- Google Gemini

## Project Structure

```text
.
├── README.md
├── .env.example
├── index.html
├── styles.css
├── script.js
├── package.json
├── .gitignore
├── netlify.toml
├── robots.txt
├── sitemap.xml
├── docs
│   ├── firebase-firestore-setup.md
│   └── monetization-plan.md
├── scripts
│   └── run-ats-samples.js
└── netlify
    └── functions
        ├── access-status.js
        ├── create-checkout-session.js
        ├── create-customer-portal.js
        ├── finalize-access.js
        ├── generate-docs.js
        ├── parse-job.js
        ├── scrape-job.js
        ├── stripe-webhook.js
        └── lib
```

## File-by-File Overview

### `index.html`

Defines the full single-page layout:

- hero/header
- job input section
- resume upload/editor section
- AI settings section
- match score panel
- output tabs
- PDF download actions

It also loads the browser libraries from CDNs and imports `script.js`.

### `styles.css`

Contains the visual system for the app:

- warm editorial color palette
- panel layout
- responsive grid
- button styles
- score ring styling
- mobile layout adjustments

### `script.js`

Holds the entire browser-side application flow:

- file upload handling
- PDF parsing
- DOCX parsing
- textarea syncing
- section extraction
- keyword extraction
- local match-scoring logic
- ATS-oriented keyword and phrase coverage scoring
- job scraping request
- job parsing request
- multi-provider document generation request
- PDF export
- tab switching
- status messaging
- sample-data loading for demo/testing

### `netlify/functions/scrape-job.js`

Responsible for:

- validating incoming URLs
- blocking localhost and private/internal hosts
- fetching HTML
- stripping scripts/styles/markup
- returning readable text

This is the app's scraping layer.

### `netlify/functions/parse-job.js`

Responsible for:

- accepting raw job text
- routing to the selected LLM provider
- asking the provider to return structured JSON
- normalizing the output shape

The expected parsed structure is:

```json
{
  "title": "",
  "company": "",
  "responsibilities": [],
  "skills": [],
  "keywords": []
}
```

### `netlify/functions/generate-docs.js`

Responsible for:

- accepting resume + job input
- routing the request to the chosen provider
- prompting for a tailored resume and cover letter
- enforcing factuality constraints in the prompt
- supporting either a user-supplied provider key or a server-side environment key
- returning normalized JSON output

The expected result is:

```json
{
  "resume": "",
  "coverLetter": ""
}
```

### `netlify.toml`

Configures:

- static publish directory
- functions directory
- function bundling
- a redirect so `/api/*` can route to Netlify Functions if desired

### `netlify/functions/create-checkout-session.js`

Provides a starter Stripe Checkout session endpoint for:

- one-time pay-per-resume purchases
- monthly subscriptions

This is now part of a fuller paid-access foundation and is meant to work with Stripe plus Firestore-backed entitlements.

### `.env.example`

Documents the environment variables needed for:

- provider API keys
- Stripe billing
- signed app sessions
- Firebase Firestore service-account access
- production app URL

### `robots.txt` and `sitemap.xml`

Provide the baseline files needed for search engine discovery and indexing.

### `docs/monetization-plan.md`

Explains the recommended architecture for using your own API keys safely and monetizing the app with a real billing stack.

### `docs/firebase-firestore-setup.md`

Documents the Firestore collection shape and environment variables for a Firebase-free-tier-friendly billing backend.

### `scripts/run-ats-samples.js`

Generates three sample resumes and scores them with the same ATS-style heuristic used by the app so you can quickly demo or regression-test scoring changes.

### `package.json`

Provides a light project manifest and helpful scripts for local development and deployment preparation.

## Architecture

The app is intentionally simple.

```text
Browser UI
  -> parse resume locally
  -> compute local match score
  -> call Netlify Functions when needed

Netlify Functions
  -> scrape-job: optional job scraping
  -> parse-job: structured job extraction via selected model
  -> generate-docs: tailored resume + cover letter via selected model

External Providers
  -> OpenAI API
  -> Anthropic API
  -> Google Gemini API
```

### Stateless architecture

No database is used in V1.

Nothing in the app currently stores:

- resumes
- job descriptions
- cover letters
- API keys
- user profiles

This keeps the system cheap, easier to reason about, and easier to host.

## Security Model

This project is intentionally conservative about sensitive data.

### API keys

- API keys are entered by the user each session
- keys are passed only in the request body
- keys are not stored in local storage
- keys are not persisted server-side
- functions are written to avoid logging sensitive request data
- server-managed provider keys can be stored in environment variables instead of being passed from the browser

### Scraping safety

The scraping function validates URLs and blocks obvious SSRF targets:

- `localhost`
- `.local`
- `.internal`
- common private IPv4 ranges

Only `http` and `https` URLs are allowed.

### Response headers

Functions include:

- CORS headers
- content type headers
- `Cache-Control: no-store`

### Known security limitations

This is still a V1. A production hardening pass should also consider:

- DNS rebinding mitigation
- stricter outbound host allow/deny rules
- HTML parsing with a more robust sanitizer
- rate limiting
- abuse prevention
- analytics/privacy review

## Supported Providers

### OpenAI

Current implementation calls the Responses API and expects structured JSON output.

### Anthropic

Current implementation calls the Messages API and expects JSON-only text output.

### Google Gemini

Current implementation calls the Gemini generateContent endpoint and requests JSON output.

## Important Provider Notes

Model names and API behavior can change over time. If a provider deprecates an endpoint or model, update the relevant function:

- [netlify/functions/parse-job.js](/Users/jay/Downloads/Resume builder/netlify/functions/parse-job.js)
- [netlify/functions/generate-docs.js](/Users/jay/Downloads/Resume builder/netlify/functions/generate-docs.js)

For production use, you should periodically verify:

- API endpoint stability
- model availability
- authentication format
- JSON output support
- token limits

## Owner-Managed API Keys

The app now supports two usage patterns:

### User-managed key mode

The end user pastes their own provider key into the form for the current request only.

### Owner-managed key mode

You configure one or more of these environment variables in Netlify:

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
```

In that mode:

- the browser can leave the API key field blank
- your function uses the server-side key
- the secret never needs to be exposed to the client

This is the correct pattern for a paid SaaS product.

## Monetization

This repository now includes a starter Stripe Checkout function:

- [create-checkout-session.js](/Users/jay/Downloads/Resume builder/netlify/functions/create-checkout-session.js)

You can configure these variables:

```bash
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_ID_SINGLE_RESUME_2=...
STRIPE_PRICE_ID_MONTHLY=...
APP_SESSION_SECRET=...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
APP_URL=https://your-production-domain.com
```

### Important limitation

This starter billing flow now includes Stripe checkout, signed paid-session cookies, webhook handling, and Firestore-backed entitlement checks. Before charging real customers at scale, you should still add:

- webhook processing
- persistent entitlement storage
- request gating based on credits or subscription state
- rate limiting and abuse monitoring

For the recommended production design, see:

- [monetization-plan.md](/Users/jay/Downloads/Resume builder/docs/monetization-plan.md)

## SEO Baseline

The app now includes basic SEO setup:

- page title and meta description
- Open Graph and Twitter tags
- canonical URL placeholder
- SoftwareApplication schema markup
- `robots.txt`
- `sitemap.xml`

Before launch, replace the placeholder domain in:

- [index.html](/Users/jay/Downloads/Resume builder/index.html)
- [robots.txt](/Users/jay/Downloads/Resume builder/robots.txt)
- [sitemap.xml](/Users/jay/Downloads/Resume builder/sitemap.xml)

## Local Development

### Prerequisites

Install:

- Node.js 18 or newer
- npm
- Netlify CLI

You can use `npx` instead of a global install if you prefer.

### Install dependencies

This project has a very small local dependency surface. To prepare the workspace:

```bash
npm install
```

### Start local development

Use Netlify Dev so the static site and functions run together:

```bash
npm run dev
```

If you do not want to use the package script:

```bash
npx netlify dev
```

### What to test locally

Run a full happy-path test:

1. Open the local site.
2. Paste a job description.
3. Paste a resume or upload a file.
4. Click `Analyze match`.
5. Enter a real provider API key.
6. Click `Generate documents`.
7. Review the resume and cover letter.
8. Export both PDFs.

Then run a fallback test:

1. Paste a job URL from a site likely to resist scraping.
2. Trigger `Fetch job`.
3. Confirm the app handles failure gracefully.
4. Paste the job description manually.
5. Continue the rest of the flow.

## Deployment To Netlify

### Option 1: Deploy from GitHub

1. Create a new GitHub repository.
2. Push this project.
3. In Netlify, choose `Add new site`.
4. Import the GitHub repository.
5. Netlify should detect the site automatically from `netlify.toml`.
6. Deploy.

### Option 2: Netlify CLI deploy

If you prefer CLI deployment:

```bash
npm run deploy
```

For a production deploy:

```bash
npm run deploy:prod
```

### Build settings

The current config is:

- publish directory: `.`
- functions directory: `netlify/functions`

No framework-specific build step is required in this version.

## User Flow

The intended user journey is:

1. Paste a job description or job URL.
2. Upload or paste a resume.
3. Review the parsed resume text.
4. Adjust the structured sections if needed.
5. Select an AI provider.
6. Enter a temporary API key.
7. Analyze match quality.
8. Generate the tailored resume and cover letter.
9. Edit the result inline.
10. Download PDFs.

## Match Scoring Details

The current scoring engine is heuristic and lightweight.

It:

- tokenizes resume text
- extracts frequent terms from the job description
- combines extracted job keywords with parsed skills and keywords
- measures overlap against resume terms
- computes a percentage score

This is intentionally simple for V1. It gives users useful directional feedback without requiring a heavy backend pipeline.

### Limitations of the current scorer

- it is not a real ATS parser
- it does not understand semantic equivalence deeply
- it may miss synonyms
- it may overweight repeated job terms
- it is not tuned by role category or industry

Future versions could improve this with:

- embeddings
- phrase-level matching
- ontology-based skill mapping
- seniority detection
- more precise resume section parsing

## Resume Editing Model

The editor currently supports:

- freeform resume text editing
- light section extraction
- section-level editing
- rebuilding the main resume text from sections

This is deliberately simpler than a true block editor or Notion-style editor, but it creates a path toward richer editing later.

## PDF Export Notes

PDF export is handled entirely in the browser with `jsPDF`.

This keeps the architecture simple, but there are tradeoffs:

- typography is basic
- page-break handling is minimal
- layout styling is text-oriented, not template-driven

For V2, better export options could include:

- resume templates
- improved pagination
- typographic control
- print stylesheet support
- HTML-to-PDF export flow

## Known Constraints

### Scraping limitations

Some job boards block scraping aggressively. Common examples include:

- LinkedIn
- Workday
- Greenhouse pages with anti-bot protection

This is expected. Manual paste is the fallback path.

### Parsing limitations

Resume section extraction is heuristic. Resumes with unusual formatting may not split cleanly into:

- Summary
- Experience
- Skills
- Education

### Output quality limitations

The system prompt discourages fabrication, but LLM behavior can still vary. Users should always review outputs carefully before submitting applications.

## Recommended Next Improvements

If you continue this project, these are the highest-value next steps.

### Product improvements

- richer resume templates
- job dashboard for comparing multiple roles
- revision history in the browser
- stronger match explanations
- optional generated interview prep notes

### UX improvements

- loading skeletons and clearer inline errors
- autosave to browser session storage
- drag-and-drop section reordering
- richer visual edit controls
- better empty states

### Engineering improvements

- package-managed frontend dependencies instead of CDN-only loading
- test coverage for utility logic and function handlers
- shared provider adapter utilities
- schema validation with a library like `zod`
- stronger sanitization and SSRF protections
- structured logging without sensitive data

### AI improvements

- compare outputs across providers
- configurable prompt style
- tone selection
- cost estimation
- resume bullet refinement tools
- stronger keyword targeting rules

## Suggested Testing Checklist

Before shipping publicly, verify:

- PDF upload parsing works
- DOCX upload parsing works
- manual paste flow works
- scrape failure fallback works
- OpenAI generation works
- Anthropic generation works
- Gemini generation works
- PDF export works
- mobile layout remains usable
- no sensitive data is logged during requests

## Troubleshooting

### The page loads but buttons do nothing

Make sure you are running through Netlify Dev, not just opening `index.html` directly in a browser. The functions are required for scraping, parsing, and generation.

### Resume upload fails

Try pasting the resume text manually. Some PDFs have difficult text extraction depending on how they were generated.

### Job scraping fails

This often happens because the site blocks automated requests. Paste the job description manually instead.

### Generation fails

Check:

- provider selection
- API key validity
- model/provider quota
- network access in your deploy environment

### JSON parse errors from a provider

Some provider outputs may occasionally drift from strict JSON. If that happens often, harden the response parsing logic or add stricter schema-enforcement and retries.

## Development Notes

This project is intentionally framework-free in V1. That keeps it easy to deploy and understand, but if the app grows, a migration to a component-based framework may be worthwhile for:

- state management
- reusable UI components
- form validation
- routing
- testability

That said, the current setup is a good fit for:

- validating the product idea
- deploying quickly
- keeping infra minimal
- reducing complexity early

## Maintainer Notes

If you revisit this app later, the most likely maintenance hotspots are:

- provider endpoint changes
- model name deprecations
- stricter scraping defenses on job sites
- browser parsing quirks for PDFs
- PDF formatting expectations from users

## License

No license file has been added yet. If you plan to publish the repository publicly, add an explicit license before launch.

## Summary

Job Machine is a practical V1 resume tailoring app:

- stateless
- private by default
- easy to host
- multi-provider
- deployable on Netlify

It gives users a complete workflow from raw resume and job posting to tailored application documents without requiring a traditional backend or permanent data storage.
