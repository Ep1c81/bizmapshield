// Vercel serverless bridge: keeps the CRM bearer secret off the public website.
const CRM_URL = "https://auralink-leads.vercel.app/api/integrations/shieldy";
const MAX_BODY_BYTES = 4096;
const allowedOrigin = "https://bizmapshield.vercel.app";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const secret = process.env.SHIELDY_INGEST_SECRET;
  if (!secret) return res.status(503).json({ error: "CRM connection not configured" });
  const origin = req.headers.origin;
  if (origin && origin !== allowedOrigin && !/^https:\/\/bizmapshield-[a-z0-9-]+\.vercel\.app$/.test(origin)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  const input = req.body;
  if (!input || typeof input !== "object" || Array.isArray(input) || JSON.stringify(input).length > MAX_BODY_BYTES) {
    return res.status(400).json({ error: "Invalid request" });
  }
  const fields = ["name", "business", "zone", "business_type", "plan", "phone"];
  const payload = Object.fromEntries(fields.map((field) => [field, typeof input[field] === "string" ? input[field].trim() : ""]));
  payload.consent = input.consent === true;
  payload.website_url = typeof input.website_url === "string" ? input.website_url : "";
  if (!payload.consent || !payload.name || !payload.business || !payload.zone || !payload.business_type) {
    return res.status(400).json({ error: "Missing required fields or consent" });
  }
  try {
    const response = await fetch(CRM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error("[shieldy-bridge] CRM responded", response.status);
      return res.status(502).json({ error: "CRM temporarily unavailable" });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[shieldy-bridge] CRM connection failed", error instanceof Error ? error.message : "unknown");
    return res.status(502).json({ error: "CRM temporarily unavailable" });
  }
}
