// Vercel serverless bridge: keeps the CRM bearer secret off the public website.
//
// Response contract (the widget only shows a success message for "created" or "existing"):
//   200 { status: "created" }   CRM confirmed a new lead row
//   200 { status: "existing" }  CRM already had a lead for this name + business (nothing overwritten)
//   200 { status: "skipped" }   Spam signals; nothing forwarded (bots get no hint)
//   400 { status: "invalid", field? }  Missing/invalid data or consent
//   429 { status: "rate_limited" }
//   502/503 { status: "failed" }  CRM unreachable, misconfigured or unconfirmed save
const CRM_URL = "https://auralink-leads.vercel.app/api/integrations/shieldy";
const MAX_BODY_BYTES = 4096;
const MIN_FILL_MS = 3000; // a person can't complete six fields faster than this
const allowedOrigin = "https://bizmapshield.vercel.app";

// Best-effort limit per warm instance (memory resets on cold starts). Use Vercel WAF rate limiting for a hard limit.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();
function rateLimited(key) {
  const now = Date.now();
  for (const [k, entry] of hits) if (now - entry.start > RATE_WINDOW_MS) hits.delete(k);
  const entry = hits.get(key) || { start: now, count: 0 };
  entry.count += 1;
  hits.set(key, entry);
  return entry.count > RATE_LIMIT;
}

// Costa Rican numbers are 8 digits (optionally prefixed +506); other countries need a leading "+".
// Returns E.164 (e.g. "+50688888888") or "" when the number is not usable for WhatsApp.
export function normalizePhone(raw) {
  const value = String(raw || "").trim();
  if (!/^\+?[\d\s().-]{8,20}$/.test(value)) return "";
  const digits = value.replace(/\D/g, "");
  if (/^[2-8]\d{7}$/.test(digits)) return "+506" + digits;
  if (/^506[2-8]\d{7}$/.test(digits)) return "+" + digits;
  if (value.startsWith("+") && /^[1-9]\d{7,14}$/.test(digits)) return "+" + digits;
  return "";
}

const json = (res, code, body) => res.status(code).json(body);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { status: "invalid", error: "Method not allowed" });
  }
  const secret = process.env.SHIELDY_INGEST_SECRET;
  if (!secret) return json(res, 503, { status: "failed", error: "CRM connection not configured" });
  // Browsers always send Origin on a cross-site or same-origin POST from fetch(); scripts posting directly usually don't.
  const origin = req.headers.origin;
  if (!origin || (origin !== allowedOrigin && !/^https:\/\/bizmapshield-[a-z0-9-]+\.vercel\.app$/.test(origin))) {
    return json(res, 403, { status: "invalid", error: "Origin not allowed" });
  }
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return json(res, 429, { status: "rate_limited" });

  const input = req.body;
  if (!input || typeof input !== "object" || Array.isArray(input) || JSON.stringify(input).length > MAX_BODY_BYTES) {
    return json(res, 400, { status: "invalid", error: "Invalid request" });
  }
  // Honeypot filled or form completed impossibly fast: answer like a normal request but forward nothing.
  const elapsed = Number(input.elapsed_ms);
  if ((typeof input.website_url === "string" && input.website_url.trim()) || !(elapsed >= MIN_FILL_MS)) {
    return json(res, 200, { status: "skipped" });
  }

  const fields = ["name", "business", "zone", "business_type", "plan"];
  const payload = Object.fromEntries(fields.map((field) => [field, typeof input[field] === "string" ? input[field].trim() : ""]));
  payload.phone = normalizePhone(input.phone);
  payload.consent = input.consent === true;
  payload.website_url = "";
  if (!payload.consent || !payload.name || !payload.business || !payload.zone || !payload.business_type) {
    return json(res, 400, { status: "invalid", error: "Missing required fields or consent" });
  }
  if (!payload.phone) return json(res, 400, { status: "invalid", field: "phone", error: "Invalid WhatsApp number" });

  try {
    const response = await fetch(CRM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error("[shieldy-bridge] CRM responded", response.status);
      return json(res, 502, { status: "failed", error: "CRM temporarily unavailable" });
    }
    // The CRM answers { ok: true, created: boolean } after a database write. Anything else (e.g. its own
    // honeypot reply, { ok: true } without "created") is not a confirmed save.
    const result = await response.json().catch(() => null);
    if (result && result.ok === true && typeof result.created === "boolean") {
      return json(res, 200, { status: result.created ? "created" : "existing" });
    }
    console.error("[shieldy-bridge] CRM response did not confirm the save");
    return json(res, 502, { status: "failed", error: "Save not confirmed" });
  } catch (error) {
    console.error("[shieldy-bridge] CRM connection failed", error instanceof Error ? error.name : "unknown");
    return json(res, 502, { status: "failed", error: "CRM temporarily unavailable" });
  }
}
