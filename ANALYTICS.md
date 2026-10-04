# Analytics (GA4) — BizMapShield

Property: `G-H999LY10ZN`. All tracking lives in [`assets/analytics.js`](assets/analytics.js), which every page loads in `<head>`.

## Events sent

| Event | When | Key params |
|---|---|---|
| `generate_lead` | Any click on a WhatsApp (`wa.me`), `tel:` or `mailto:` link, anywhere on any page, plus the hero "Diagnóstico gratis" form submit | `method` (`whatsapp` / `phone` / `email`), `cta_location` (`hero_diagnostico`, `pricing`, `navbar`, `faq`, `final-cta`, `floating`, `footer`, `card`…), `link_text` |
| `view_pricing` | "Ver precios" link under the hero form | `cta_location` |
| `faq_open` | A FAQ question is expanded | `faq_question` |
| `roi_metric` | A KPI toggle in the ROI chart is clicked | `metric` |
| `save_contact` | "Guardar contacto" on `card.html` | `cta_location` |
| `roi_calculator` | First time a visitor releases a revenue-calculator slider (once per page view) | `daily_customers`, `avg_ticket` |
| `ba_toggle` | The "Sin / Con BizMapShield" switch is flipped | `state` (`on` / `off`) |
| `qr_demo_open` | "Toca aquí / O ábrelo aquí" link under the hero QR demo | `cta_location` (`hero_qr`) |

The calculator's WhatsApp button is a normal `generate_lead` with `cta_location: roi_calculator`.

New contact links are tracked automatically. Add `data-cta="some_name"` to a link (or a parent) to name its location.

> The old events (`click_whatsapp`, `click_call`) are no longer sent. They were never marked as key events, which is why GA4 showed **0 key events**.

## Required GA4 admin setup (one-time, ~5 min)

Without these steps, GA4 still shows 0 key events, whatever the code does.

1. **Mark the lead as a key event.** Admin → Data display → Events → wait until `generate_lead` appears (up to 24 h after the first click), then toggle **Mark as key event**. You can also create it ahead of time: Admin → Key events → *New key event* → `generate_lead`.
2. **Define internal traffic.** Admin → Data streams → (web stream) → Configure tag settings → Show more → *Define internal traffic*. Add a rule `traffic_type = internal` for your office/home IP. The code also sets `traffic_type=internal` for any browser flagged with `?internal=1` (see below), and that works even on mobile data.
3. **Activate the filter.** Admin → Data collection and modification → Data filters → *Internal Traffic* → set to **Active** (it ships as *Testing*). Also activate the **Developer Traffic** filter.
4. **Exclude unwanted referrals.** Data stream → Configure tag settings → *List unwanted referrals* → add `vercel.com`, `vercel.app`, `github.com`, `localhost`. This stops your own dashboard-to-site clicks from appearing as "referral" sessions.
5. (Optional) **Hostname check.** Explore → filter by *Hostname*. Only `bizmapshield.com` (and `www.`) should be real traffic.

## Keeping internal and dev traffic out

- **Dev and preview hosts never send data.** `localhost`, `127.0.0.1`, LAN IPs, `file://`, `*.vercel.app`, `*.netlify.app`, `*.pages.dev`, `*.ngrok.app` and `*.local` are all blocked in `analytics.js`. On those hosts events are printed to the browser console as `[analytics:dev] …` instead, so you can still check that every button fires.
- **Your own browsers on the live site:** open `https://bizmapshield.com/?internal=1` once on each phone or laptop you use. The flag is stored in localStorage. Those visits are sent with `traffic_type=internal` (dropped by the filter) and `debug_mode` (visible in Admin → DebugView), so you can test the live site without polluting reports. `?internal=0` removes the flag. Clearing site data also removes it, so set it again afterwards.

## How to verify tracking

1. Open the live site with `?internal=1`.
2. GA4 → Admin → **DebugView**: click a WhatsApp button and confirm `generate_lead` shows up with `method` and `cta_location`.
3. With an ad blocker on, nothing is sent. That's expected; some visitors will always be invisible to GA4.
