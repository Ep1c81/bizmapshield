(() => {
  'use strict';
  if (document.getElementById('shieldy-root')) return;
  const WA = '50663889598';
  const root = document.createElement('div');
  root.id = 'shieldy-root';
  root.dataset.cta = 'shieldy'; // names the location of WhatsApp clicks in assets/analytics.js
  root.innerHTML = `<aside id="shieldy-panel" role="dialog" aria-label="Asistente Shieldy" hidden>
<div id="shieldy-head"><span class="robot" aria-hidden="true">🤖</span><div><strong>Shieldy 🛡️</strong><small>Asistente de BizMapShield</small></div><button id="shieldy-close" aria-label="Cerrar conversación" type="button">×</button></div>
<div id="shieldy-messages" role="log" aria-live="polite"></div>
<div id="shieldy-actions"></div>
<form id="shieldy-form" hidden>
<label for="sh-name">Tu nombre</label><input id="sh-name" name="nombre" required maxlength="80" autocomplete="name">
<label for="sh-business">Nombre del negocio</label><input id="sh-business" name="negocio" required maxlength="100">
<label for="sh-zone">Zona del negocio</label><input id="sh-zone" name="zona" required maxlength="80" placeholder="Ej. Santa Ana">
<label for="sh-type">Tipo de negocio</label><select id="sh-type" name="tipo" required><option value="">Seleccioná una opción</option><option>Barbería o salón</option><option>Restaurante o cafetería</option><option>Clínica</option><option>Tienda</option><option>Servicios</option><option>Otro</option></select>
<label for="sh-plan">Plan de interés</label><select id="sh-plan" name="plan"><option>No estoy seguro</option><option>Básico</option><option>Pro</option><option>Premium</option></select>
<label for="sh-phone">WhatsApp de contacto</label><input id="sh-phone" name="telefono" type="tel" inputmode="tel" required maxlength="20" autocomplete="tel" placeholder="Ej. 8888-8888" aria-describedby="sh-phone-help"><small id="sh-phone-help">Número de Costa Rica de 8 dígitos, o con código de país (+…) si es de otro país.</small>
<label for="sh-consent"><input id="sh-consent" type="checkbox" name="consentimiento" required> Autorizo a BizMapShield a guardar estos datos y contactarme sobre el diagnóstico solicitado.</label>
<input name="website_url" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px" aria-label="Dejar vacío">
<small>Usamos estos datos solo para contactarte sobre el diagnóstico. Ver <a href="/legal.html#privacidad" target="_blank" rel="noopener">Política de Privacidad</a>.</small>
<button type="submit">Solicitar diagnóstico gratuito</button>
</form>
</aside>
<button id="shieldy-open" type="button" aria-label="Abrir asistente Shieldy" aria-expanded="false" aria-controls="shieldy-panel">🤖</button>`;
  document.body.appendChild(root);

  const panel = root.querySelector('#shieldy-panel');
  const open = root.querySelector('#shieldy-open');
  const close = root.querySelector('#shieldy-close');
  const log = root.querySelector('#shieldy-messages');
  const actions = root.querySelector('#shieldy-actions');
  const form = root.querySelector('#shieldy-form');
  let greeted = false;
  let formShownAt = 0;

  // Analytics is best-effort (assets/analytics.js may be blocked). Never pass personal data here.
  const track = (name, params) => {
    try { if (typeof window.bmsTrack === 'function') window.bmsTrack(name, params); } catch (e) { /* ignore */ }
  };
  const tagWhatsApp = href => {
    try { return typeof window.bmsTagWhatsApp === 'function' ? window.bmsTagWhatsApp(href) : href; } catch (e) { return href; }
  };
  // Mirrors normalizePhone() in api/shieldy-lead.js, which is the authority.
  const validPhone = raw => {
    const value = String(raw || '').trim();
    if (!/^\+?[\d\s().-]{8,20}$/.test(value)) return false;
    const digits = value.replace(/\D/g, '');
    return /^(506)?[2-8]\d{7}$/.test(digits) || (value.startsWith('+') && /^[1-9]\d{7,14}$/.test(digits));
  };

  function say(t, who = 'bot') {
    const p = document.createElement('p');
    p.className = who;
    p.textContent = t;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function choices(items) {
    actions.replaceChildren();
    items.forEach(([label, fn, primary]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (primary) b.className = 'primary';
      b.addEventListener('click', () => { say(label, 'user'); fn(); });
      actions.appendChild(b);
    });
  }

  function menu() {
    form.hidden = true;
    choices([
      ['¿Cómo funciona?', () => answer('funciona')],
      ['Ver precios', () => answer('precios')],
      ['¿Necesito instalar una app?', () => answer('app')],
      ['¿Las reseñas son auténticas?', () => answer('reseñas')],
      ['Solicitar diagnóstico gratuito', lead, true],
      ['Hablar por WhatsApp', whatsapp, true]
    ]);
  }

  const answers = {
    funciona: 'Colocamos un stand o tarjeta NFC con QR. Tus clientes lo tocan o escanean y llegan a la página oficial de reseñas de tu negocio en Google. Cada persona decide libremente si deja una opinión y qué calificación dar.',
    precios: 'Básico: ₡19.900 pago único. Pro: ₡19.900 inicial + ₡9.900 al mes. Premium: ₡39.900 inicial + ₡39.900 al mes. Te ayudamos a elegir según las necesidades de tu negocio.',
    app: 'No necesitás instalar ninguna aplicación. El cliente puede acercar su teléfono al NFC o escanear el código QR.',
    reseñas: 'Sí. Solo invitamos a clientes reales a compartir opiniones voluntarias. No compramos reseñas ni garantizamos cinco estrellas o posiciones en Google Maps.'
  };

  function answer(k) {
    say(answers[k]);
    say('Si querés, puedo ayudarte a revisar tu perfil de Google sin compromiso. 😊');
    choices([
      ['Solicitar diagnóstico gratuito', lead, true],
      ['Hablar por WhatsApp', whatsapp],
      ['← Más preguntas', menu]
    ]);
  }

  // A real link the visitor taps: opening WhatsApp from script after an awaited request is blocked by
  // popup blockers (notably iOS Safari), and a detached link is invisible to the analytics click listener.
  function waButton(message, label, primary) {
    const a = document.createElement('a');
    a.href = tagWhatsApp('https://wa.me/' + WA + '?text=' + encodeURIComponent(message));
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'shieldy-wa' + (primary ? ' primary' : '');
    a.textContent = label;
    return a;
  }

  function whatsapp() {
    say('Te preparé un mensaje. Al abrir WhatsApp, revisalo y tocá Enviar para que lo recibamos.');
    choices([['← Más preguntas', menu]]);
    actions.prepend(waButton('¡Hola! Vengo de Shieldy en la web de BizMapShield y quiero más información.', 'Abrir WhatsApp ↗', true));
  }

  function lead() {
    say('¡Con mucho gusto! Completá estos datos para solicitar tu diagnóstico gratuito.');
    form.hidden = false;
    formShownAt = Date.now();
    track('diagnosis_started', { source: 'shieldy' });
    choices([['← Volver a preguntas', menu]]);
    root.querySelector('#sh-name').focus();
  }

  const phoneInput = root.querySelector('#sh-phone');
  phoneInput.addEventListener('input', () => phoneInput.setCustomValidity(''));

  const outcomes = {
    created: 'Listo, registramos tu solicitud de diagnóstico. Te escribiremos al WhatsApp que indicaste.',
    existing: 'Ya teníamos una solicitud registrada con este nombre y negocio, así que no la duplicamos. Si querés agregar algo o cambiar tu número, escribinos por WhatsApp.',
    invalid: 'Revisá los datos: necesitamos tu nombre, negocio, zona, tipo de negocio, un WhatsApp válido y tu autorización.',
    failed: 'No pudimos registrar tu solicitud en este momento. Para que no se pierda, envianos los datos por WhatsApp.'
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    phoneInput.setCustomValidity(validPhone(phoneInput.value) ? '' : 'Ingresá un número de WhatsApp válido, por ejemplo 8888-8888.');
    if (!form.reportValidity()) return;
    const d = new FormData(form), v = k => String(d.get(k) || '').trim();
    const msg = '¡Hola! Quiero un diagnóstico gratuito de BizMapShield.\nNombre: ' + v('nombre') + '\nNegocio: ' + v('negocio') + '\nZona: ' + v('zona') + '\nTipo: ' + v('tipo') + '\nPlan: ' + v('plan') + '\nWhatsApp: ' + v('telefono') + '\nEnviado desde Shieldy.';
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Registrando solicitud…';
    track('diagnosis_submitted', { source: 'shieldy' });
    let status = 'failed', reason = 'network';
    try {
      const response = await fetch('/api/shieldy-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: v('nombre'), business: v('negocio'), zone: v('zona'), business_type: v('tipo'), plan: v('plan'), phone: v('telefono'), website_url: v('website_url'), consent: d.get('consentimiento') === 'on', elapsed_ms: Date.now() - formShownAt }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined
      });
      const body = await response.json().catch(() => ({}));
      reason = body.status || 'http_' + response.status;
      if (body.status === 'created' || body.status === 'existing' || body.status === 'invalid') status = body.status;
    } catch (error) {
      reason = error && error.name === 'TimeoutError' ? 'timeout' : 'network';
    }
    submit.disabled = false;
    submit.textContent = 'Solicitar diagnóstico gratuito';
    say(outcomes[status]);
    if (status === 'invalid') {
      track('shieldy_lead_failed', { reason: 'invalid' });
      return; // keep the form open so the visitor can fix it
    }
    const saved = status === 'created' || status === 'existing';
    if (saved) track('shieldy_lead_saved', { status: status });
    else track('shieldy_lead_failed', { reason: reason });
    form.hidden = true;
    choices([['← Volver al inicio', menu]]);
    actions.prepend(waButton(msg, saved ? 'También escribir por WhatsApp ↗' : 'Enviar por WhatsApp ↗', !saved));
    if (!saved) say('Al abrir WhatsApp, revisá el mensaje y tocá Enviar para que lo recibamos.');
  });

  function toggle(show) {
    panel.hidden = !show;
    open.setAttribute('aria-expanded', String(show));
    if (show) {
      if (!greeted) {
        say('¡Pura vida! 👋 Soy Shieldy, tu asistente virtual de BizMapShield. ¿En qué te puedo ayudar?');
        menu();
        greeted = true;
      }
      close.focus();
    } else open.focus();
  }

  open.addEventListener('click', () => toggle(panel.hidden));
  close.addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) toggle(false); });
})();
