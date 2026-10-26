# Shieldy → Auralink Leads CRM integration (draft)

## Required Vercel configuration

1. In **auralink-leads** Vercel project, add environment variable `SHIELDY_INGEST_SECRET` with a newly generated long random value (32+ bytes).
2. In **bizmapshield** Vercel project, add **the same** `SHIELDY_INGEST_SECRET` as a server-side environment variable (do not prefix with `NEXT_PUBLIC_` or `VITE_`).
3. Merge/deploy the CRM PR first, then merge/deploy the BizMapShield PR.
4. Redeploy both projects after changing environment variables.
5. Submit a test lead via Shieldy and verify it appears on the CRM's root `leads` dashboard with `metadata.source = "shieldy"`, and that WhatsApp still opens.

The public site sends POST `/api/shieldy-lead` to its same-origin Vercel serverless function. The serverless function forwards to `https://auralink-leads.vercel.app/api/integrations/shieldy` with a server-only bearer secret. Supabase service role credentials remain in the CRM project only.

## What the visitor sees

`/api/shieldy-lead` answers with an explicit `status`, and the widget only shows a success message for the first two:

| `status` | Meaning | Widget message |
|---|---|---|
| `created` | CRM returned `{ ok: true, created: true }` | Solicitud registrada; optional WhatsApp button |
| `existing` | CRM returned `{ ok: true, created: false }` (same name + business already stored; **nothing is updated**) | "Ya teníamos una solicitud…"; optional WhatsApp button |
| `invalid` | Missing field, no consent, or WhatsApp number not valid | Form stays open to fix |
| `skipped` | Honeypot filled or form completed in under 3 s; nothing forwarded | Treated as not saved: WhatsApp fallback |
| `rate_limited` / `failed` | Too many attempts, CRM down, misconfigured, or reply without `created` | WhatsApp fallback button |

WhatsApp is a button the visitor taps (not opened by script), so it is never popup-blocked and is tracked as `generate_lead` with `cta_location: shieldy`. Opening WhatsApp does not mean a message was sent.

A WhatsApp number is required and normalized to E.164 (`+506XXXXXXXX` for 8-digit Costa Rican numbers; other countries must start with `+`).

## Limitations / follow-ups

- **Rate limiting is best-effort** (5 requests per IP per 10 min, per warm serverless instance). Add a Vercel WAF rate-limit rule on `/api/shieldy-lead` before high-volume promotion.
- **Duplicates are not updated.** The CRM upserts with `ignoreDuplicates` on `(name, company)`, so a returning visitor's new phone or plan is dropped. Suggested CRM change (separate PR in `auralink-leads`, not made here): on conflict, update `phone` and append to `metadata`, and return `{ ok: true, status: "created" | "updated" | "duplicate" }`.
- The CRM's honeypot reply is `{ ok: true }` without `created`; the bridge treats it as unconfirmed. Suggested CRM change: return `{ ok: false, status: "skipped" }` for clarity.
- The CRM's existing dashboards/API routes have separate authentication risks and should be secured independently.
