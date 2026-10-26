# Shieldy → Auralink Leads CRM integration (draft)

## Required Vercel configuration

1. In **auralink-leads** Vercel project, add environment variable `SHIELDY_INGEST_SECRET` with a newly generated long random value (32+ bytes).
2. In **bizmapshield** Vercel project, add **the same** `SHIELDY_INGEST_SECRET` as a server-side environment variable (do not prefix with `NEXT_PUBLIC_` or `VITE_`).
3. Merge/deploy the CRM PR first, then merge/deploy the BizMapShield PR.
4. Redeploy both projects after changing environment variables.
5. Submit a test lead via Shieldy and verify it appears on the CRM's root `leads` dashboard with `metadata.source = "shieldy"`, and that WhatsApp still opens.

The public site sends POST `/api/shieldy-lead` to its same-origin Vercel serverless function. The serverless function forwards to `https://auralink-leads.vercel.app/api/integrations/shieldy` with a server-only bearer secret. Supabase service role credentials remain in the CRM project only.

**Limitations:** No automated rate limiting or bot challenge is configured yet; add rate limiting before high-volume promotion. The CRM's existing dashboards/API routes have separate authentication risks and should be secured independently. The optional phone field may be empty, so follow-up can still depend on the user's WhatsApp message. The form only claims a CRM save when the endpoint confirms it.
