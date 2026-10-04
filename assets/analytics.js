/* BizMapShield analytics (GA4). Loaded synchronously in <head> on every page.
 *
 * - Never sends data from local/dev/preview hosts (localhost, file://, *.vercel.app, ...).
 *   On those hosts events are logged to the console instead, so tracking can still be tested.
 * - Visit any page with ?internal=1 once to tag your own browser as internal traffic
 *   (traffic_type=internal, excluded by the GA4 "Internal Traffic" data filter). ?internal=0 undoes it.
 * - Every WhatsApp / phone / email link is tracked automatically as a `generate_lead` event
 *   (mark it as a key event in GA4). Add data-cta="..." to a link to name where it sits on the page.
 *
 * See ANALYTICS.md for the GA4 admin setup this relies on.
 */
(function () {
  var GA_ID = 'G-H999LY10ZN';

  var host = location.hostname;
  var isDevHost =
    location.protocol === 'file:' ||
    host === '' ||
    host === 'localhost' ||
    /^127\.|^0\.0\.0\.0$|^192\.168\.|^10\.|^\[?::1\]?$/.test(host) ||
    /\.local$|\.vercel\.app$|\.ngrok(-free)?\.(app|io)$|\.netlify\.app$|\.pages\.dev$/.test(host);

  // Internal-traffic flag, persisted per browser
  var store = null;
  try { store = window.localStorage; } catch (e) {}
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { params = { has: function () { return false; } }; }
  if (store && params.has('internal')) {
    try {
      if (params.get('internal') === '0') store.removeItem('bms_internal');
      else store.setItem('bms_internal', '1');
    } catch (e) {}
  }
  var isInternal = false;
  try { isInternal = !!store && store.getItem('bms_internal') === '1'; } catch (e) {}

  var enabled = !isDevHost;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };

  if (enabled) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);

    var config = {};
    // Internal visits still reach DebugView (debug_mode) but are dropped from reports by the data filter
    if (isInternal) { config.traffic_type = 'internal'; config.debug_mode = true; }
    gtag('js', new Date());
    gtag('config', GA_ID, config);
  }

  function track(name, eventParams) {
    eventParams = eventParams || {};
    if (!enabled) {
      if (window.console) console.info('[analytics:dev] ' + name, eventParams);
      return;
    }
    eventParams.transport_type = 'beacon'; // survives the page switching to WhatsApp / the dialer
    gtag('event', name, eventParams);
  }
  window.bmsTrack = track;

  function contactMethod(href) {
    if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\//i.test(href)) return 'whatsapp';
    if (/^tel:/i.test(href)) return 'phone';
    if (/^mailto:/i.test(href)) return 'email';
    return null;
  }

  function ctaLocation(el) {
    var tagged = el.closest('[data-cta]');
    if (tagged) return tagged.getAttribute('data-cta');
    var region = el.closest('section, nav, footer, header');
    if (!region) return 'page';
    return region.id || (region.className.split(' ')[0]) || region.tagName.toLowerCase();
  }

  // One delegated listener covers every contact link, including ones added later
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    var method = contactMethod(link.getAttribute('href'));
    if (method) {
      track('generate_lead', {
        method: method,
        cta_location: ctaLocation(link),
        link_text: (link.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100)
      });
      return;
    }
    if (link.hasAttribute('data-track')) {
      track(link.getAttribute('data-track'), { cta_location: ctaLocation(link) });
    }
  }, true);
})();
