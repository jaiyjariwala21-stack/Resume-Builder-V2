# Browser Extension Plan

This repo now includes a Chrome extension MVP in:

`extensions/chrome`

## What the Chrome MVP does

- captures the active job page text
- stores a default resume inside the extension
- stores the preferred provider and billing email
- opens Job Machine with the job payload prefilled
- can optionally open Job Machine with `autogen=1` so generation starts immediately

## How it works

1. The extension popup captures the active tab's text.
2. It packages:
   - source URL
   - captured page text
   - default resume
   - provider
   - billing email
3. It opens the live site with a URL payload.
4. The web app restores that payload and can auto-run generation.

This keeps provider keys and billing checks on the existing web app instead of duplicating sensitive logic in the extension.

## Load the Chrome extension locally

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select:

`extensions/chrome`

## Safari follow-up

Safari support should be built after the Chrome flow is validated.

Recommended path:

- reuse the same popup UX and payload contract
- wrap the extension in Safari's Web Extension tooling
- keep generation on the website so billing/session logic stays centralized

## MVP limitations

- capture quality depends on the job page structure
- very long job descriptions are trimmed before opening the site
- the extension triggers generation by opening the website flow, not by bypassing it
- Safari packaging is not included yet
