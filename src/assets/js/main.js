/* BodyPower.com — site behaviour. No dependencies. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------------
     Consent + analytics (GA4 / GTM are consent-aware: brief §8, §10)
     ------------------------------------------------------------------ */
  const CONSENT_KEY = 'bp-consent';
  window.dataLayer = window.dataLayer || [];

  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  const consent = () => storage.get(CONSENT_KEY);

  let gtmLoaded = false;
  function loadGTM() {
    const id = document.body.dataset.gtm;
    if (!id || gtmLoaded) return;
    gtmLoaded = true;
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);
  }

  function applyConsent(value) {
    window.dataLayer.push({
      event: 'consent_update',
      analytics_storage: value,
      ad_storage: 'denied', // advertising pixels need separate approval (brief §8)
    });
    // GTM (the existing container) loads only after analytics consent.
    if (value === 'granted') loadGTM();
  }

  function track(name, params = {}) {
    if (consent() !== 'granted') return;
    window.dataLayer.push({ event: name, page_path: location.pathname, ...params });
  }
  window.bpTrack = track;

  const banner = $('#cookie-banner');
  function showBanner() { if (banner) banner.hidden = false; }
  function hideBanner() { if (banner) banner.hidden = true; }

  if (!consent()) showBanner();
  else applyConsent(consent());

  $$('[data-consent]').forEach((btn) => btn.addEventListener('click', () => {
    const v = btn.dataset.consent;
    storage.set(CONSENT_KEY, v);
    applyConsent(v);
    hideBanner();
  }));
  $$('[data-cookie-settings]').forEach((btn) => btn.addEventListener('click', () => {
    showBanner();
    $('[data-consent="granted"]', banner)?.focus();
  }));

  // Outbound / CTA click tracking: any element with data-track
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-track]');
    if (!el) return;
    track(el.dataset.track, {
      link_url: el.href || null,
      link_location: el.dataset.trackLocation || null,
      link_text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 80),
    });
  });

  /* ------------------------------------------------------------------
     Ticket checkout pop-up (Ticket Tailor, embedded)
     Any <a data-ticket-widget> opens the "Select tickets" checkout over the
     page. The link's own href is the fallback if JS or the frame fails.
     ------------------------------------------------------------------ */
  const widgetCfg = (document.body.dataset.ticketWidget || '').split('|');
  if (widgetCfg.length === 3 && widgetCfg[0]) {
    const [boxOffice, eventId, domain] = widgetCfg;
    const checkoutUrl = `https://${domain}/events/${boxOffice}/${eventId}/book?ref=widget&widget=true`;
    let overlay = null;
    let opener = null;
    let loadTimer = null;

    const build = (fallbackHref) => {
      overlay = document.createElement('div');
      overlay.className = 'checkout';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Buy BodyPower Games tickets');
      overlay.innerHTML = `
        <div class="checkout__backdrop" data-checkout-close></div>
        <div class="checkout__panel">
          <button type="button" class="checkout__close" data-checkout-close aria-label="Close ticket checkout">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
          <div class="checkout__status" role="status">
            <span class="spinner" aria-hidden="true"></span>
            <span>Loading ticket checkout…</span>
          </div>
          <div class="checkout__fallback" hidden>
            <p>The ticket checkout is taking a while to load.</p>
            <a class="btn btn--primary" href="${fallbackHref}" target="_blank" rel="noopener">Open tickets in a new tab</a>
          </div>
          <iframe class="checkout__frame" title="BodyPower Games ticket checkout" allow="payment; fullscreen" tabindex="0"></iframe>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target.closest('[data-checkout-close]')) closeCheckout(); });
      const frame = $('.checkout__frame', overlay);
      frame.addEventListener('load', () => {
        if (!frame.getAttribute('src')) return;
        clearTimeout(loadTimer);
        overlay.classList.add('is-ready');
      });
    };

    const bgEls = () => [$('#main'), $('.site-footer'), $('#site-header'), $('#drawer')].filter(Boolean);

    function openCheckout(trigger) {
      opener = trigger;
      if (!overlay) build(trigger.href || checkoutUrl);
      // close the mobile menu first so only one overlay is open
      if (drawer && !drawer.hidden) closeDrawer({ restoreFocus: false });
      overlay.classList.remove('is-ready');
      $('.checkout__fallback', overlay).hidden = true;
      $('.checkout__status', overlay).hidden = false;
      overlay.hidden = false;
      $('.checkout__frame', overlay).src = checkoutUrl;
      document.body.classList.add('is-locked');
      bgEls().forEach((el) => (el.inert = true));
      $('.checkout__close', overlay).focus();
      clearTimeout(loadTimer);
      loadTimer = setTimeout(() => {
        if (overlay.classList.contains('is-ready')) return;
        $('.checkout__status', overlay).hidden = true;
        $('.checkout__fallback', overlay).hidden = false;
      }, 12000);
    }

    function closeCheckout() {
      if (!overlay || overlay.hidden) return;
      clearTimeout(loadTimer);
      overlay.hidden = true;
      $('.checkout__frame', overlay).removeAttribute('src'); // stop the session / free memory
      document.body.classList.remove('is-locked');
      bgEls().forEach((el) => (el.inert = false));
      if (opener && document.contains(opener)) opener.focus();
    }

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-ticket-widget]');
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // let "open in new tab" work
      e.preventDefault();
      openCheckout(a);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay && !overlay.hidden) closeCheckout();
    });
    // Ticket Tailor tells the host page when its own close control is used
    window.addEventListener('message', (e) => {
      let host = '';
      try { host = new URL(e.origin).hostname; } catch { return; }
      if (!/(^|\.)tickettailor\.com$|(^|\.)bodypower\.com$/.test(host)) return;
      if (e.data && e.data.type === 'tt-checkout-close') closeCheckout();
    });
  }

  /* ------------------------------------------------------------------
     Header: solid on scroll
     ------------------------------------------------------------------ */
  const header = $('#site-header');
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      header?.classList.toggle('is-scrolled', window.scrollY > 24);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------------
     Mobile drawer (Esc to close, focus contained, background inert)
     ------------------------------------------------------------------ */
  const toggle = $('.menu-toggle');
  const drawer = $('#drawer');
  const inertTargets = () => [$('#main'), $('.site-footer'), $('.topbar')].filter(Boolean);

  function openDrawer() {
    drawer.hidden = false;
    drawer.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('is-locked', 'drawer-open');
    inertTargets().forEach((el) => (el.inert = true));
    $('a', drawer)?.focus();
  }
  function closeDrawer({ restoreFocus = true } = {}) {
    drawer.hidden = true;
    drawer.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('is-locked', 'drawer-open');
    inertTargets().forEach((el) => (el.inert = false));
    if (restoreFocus) toggle.focus();
  }
  if (toggle && drawer) {
    toggle.addEventListener('click', () => (drawer.hidden ? openDrawer() : closeDrawer()));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
    });
    drawer.addEventListener('click', (e) => {
      if (e.target.closest('a')) closeDrawer({ restoreFocus: false });
    });
    window.matchMedia('(min-width: 1140px)').addEventListener('change', (m) => {
      if (m.matches && !drawer.hidden) closeDrawer({ restoreFocus: false });
    });
  }

  /* ------------------------------------------------------------------
     Scroll reveal (content is fully visible without JS / reduced motion)
     ------------------------------------------------------------------ */
  const revealEls = $$('[data-reveal]');
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------
     Shop category filter
     ------------------------------------------------------------------ */
  const filterBar = $('[data-filter-bar]');
  if (filterBar) {
    const items = $$('[data-category]');
    const status = $('[data-filter-status]');
    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      const cat = btn.dataset.filter;
      $$('button[data-filter]', filterBar).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      let shown = 0;
      items.forEach((item) => {
        const match = cat === 'all' || item.dataset.category === cat;
        item.hidden = !match;
        if (match) shown += 1;
      });
      if (status) status.textContent = `Showing ${shown} ${shown === 1 ? 'item' : 'items'}${cat === 'all' ? '' : ` in ${btn.textContent.trim()}`}`;
      track('shop_filter', { category: cat });
    });
  }

  /* ------------------------------------------------------------------
     Partnership enquiry form (brief §7)
     ------------------------------------------------------------------ */
  const form = $('#partner-form');
  if (form) initForm(form);

  function initForm(form) {
    const params = new URLSearchParams(location.search);
    const category = $('#f-category', form);
    const pre = params.get('category');
    if (pre && category.querySelector(`option[value="${CSS.escape(pre)}"]`)) category.value = pre;

    $('#f-source', form).value = params.get('from') || document.referrer || 'direct';

    const message = $('#f-message', form);
    const counter = $('#f-message-count', form);
    const max = Number(message.getAttribute('maxlength'));
    const updateCount = () => {
      const left = max - message.value.length;
      counter.textContent = `${message.value.length} / ${max} characters`;
      counter.classList.toggle('is-near', left < 150);
    };
    message.addEventListener('input', updateCount);
    updateCount();

    const rules = {
      'f-name': (v) => (v.trim().length >= 2 ? '' : 'Enter your full name.'),
      'f-email': (v) => {
        if (!v.trim()) return 'Enter your business email address.';
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter an email address in the format name@company.com.';
      },
      'f-category': (v) => (v ? '' : 'Choose the type of enquiry.'),
      'f-message': (v) => (v.trim().length >= 20 ? '' : 'Tell us a little more about your proposal (at least 20 characters).'),
      'f-privacy': (_, el) => (el.checked ? '' : 'Confirm you have read the privacy notice to continue.'),
    };

    function validateField(id) {
      const el = $('#' + id, form);
      const field = el.closest('.field');
      const msg = rules[id](el.value, el);
      const errEl = $('#' + id + '-error', form);
      field.classList.toggle('is-invalid', !!msg);
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (errEl) errEl.lastChild.textContent = msg;
      return msg;
    }

    // validate on blur; re-validate on input once a field has shown an error
    Object.keys(rules).forEach((id) => {
      const el = $('#' + id, form);
      el.addEventListener('blur', () => { if (el.value || el.type === 'checkbox') validateField(id); });
      el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
        if (el.closest('.field').classList.contains('is-invalid')) validateField(id);
      });
    });

    const summary = $('#form-errors', form);
    const success = $('#form-success');
    const submit = $('button[type="submit"]', form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errors = Object.keys(rules)
        .map((id) => ({ id, msg: validateField(id) }))
        .filter((x) => x.msg);

      if (errors.length) {
        summary.hidden = false;
        $('ul', summary).innerHTML = errors
          .map((x) => `<li><a href="#${x.id}">${x.msg}</a></li>`)
          .join('');
        summary.focus();
        return;
      }
      summary.hidden = true;

      // Honeypot: silently drop bot submissions
      if ($('#f-website', form).value) return;

      const data = Object.fromEntries(new FormData(form).entries());
      data.submitted_at = new Date().toISOString();
      data.page = location.pathname;

      submit.setAttribute('aria-busy', 'true');
      submit.disabled = true;
      const label = submit.innerHTML;
      submit.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending…';

      const endpoint = form.dataset.endpoint;
      try {
        if (endpoint) {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(data),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } else {
          // Demo mode: no endpoint configured yet (see build.py CONFIG.form_endpoint)
          await new Promise((r) => setTimeout(r, 700));
          console.info('[BodyPower] Demo submission — not sent anywhere:', data);
        }
        track('generate_lead', { enquiry_category: data.category });
        form.hidden = true;
        success.hidden = false;
        $('[data-success-category]', success).textContent =
          category.options[category.selectedIndex].text;
        success.focus();
      } catch (err) {
        summary.hidden = false;
        $('ul', summary).innerHTML =
          '<li>We couldn\'t send your enquiry just now. Please check your connection and try again.</li>';
        summary.focus();
      } finally {
        submit.removeAttribute('aria-busy');
        submit.disabled = false;
        submit.innerHTML = label;
      }
    });
  }

  /* ------------------------------------------------------------------
     Motion control (WCAG 2.2.2): any moving band can be paused; the choice is remembered
     ------------------------------------------------------------------ */
  const root = document.documentElement;
  if (storage.get('bp-motion') === 'paused') root.classList.add('motion-paused');
  $$('[data-motion-toggle]').forEach((btn) => {
    const label = $('span', btn);
    const sync = () => {
      const paused = root.classList.contains('motion-paused');
      btn.setAttribute('aria-pressed', String(paused));
      if (label) label.textContent = paused ? 'Play motion' : 'Pause motion';
    };
    sync();
    btn.addEventListener('click', () => {
      root.classList.toggle('motion-paused');
      storage.set('bp-motion', root.classList.contains('motion-paused') ? 'paused' : 'playing');
      sync();
    });
  });

  /* ------------------------------------------------------------------
     Countdown to BodyPower Games
     ------------------------------------------------------------------ */
  $$('[data-countdown]').forEach((el) => {
    const target = new Date(el.dataset.countdown).getTime();
    if (Number.isNaN(target)) return;
    const out = { d: $('[data-cd="d"]', el), h: $('[data-cd="h"]', el), m: $('[data-cd="m"]', el), s: $('[data-cd="s"]', el) };
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const tick = () => {
      const left = Math.floor((target - Date.now()) / 1000);
      if (left <= 0) { el.classList.add('is-live'); return false; }
      out.d.textContent = pad(Math.floor(left / 86400), 2);
      out.h.textContent = pad(Math.floor((left % 86400) / 3600));
      out.m.textContent = pad(Math.floor((left % 3600) / 60));
      out.s.textContent = pad(left % 60);
      return true;
    };
    if (tick()) {
      const iv = setInterval(() => { if (!tick()) clearInterval(iv); }, 1000);
    }
  });

  /* ------------------------------------------------------------------
     Carousels (native scroll-snap + prev/next buttons)
     ------------------------------------------------------------------ */
  $$('[data-carousel]').forEach((car) => {
    const track = $('.carousel__track', car);
    const prev = $('[data-carousel-prev]', car);
    const next = $('[data-carousel-next]', car);
    if (!track || !prev || !next) return;
    const step = () => (track.querySelector('li')?.getBoundingClientRect().width || 280) + 16;
    const sync = () => {
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    };
    const go = (dir) => track.scrollBy({ left: dir * step(), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    window.addEventListener('resize', sync);
    sync();
  });

  /* ------------------------------------------------------------------
     Mobile ticket bar: appears once the visitor has scrolled past the hero fold
     ------------------------------------------------------------------ */
  const ticketBar = $('.ticket-bar');
  if (ticketBar) {
    const sync = () => {
      const show = window.scrollY > 380;
      ticketBar.classList.toggle('is-visible', show);
      document.body.classList.toggle('has-ticket-bar', show);
    };
    window.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  /* ------------------------------------------------------------------
     Hero parallax (off for reduced motion and when motion is paused)
     ------------------------------------------------------------------ */
  const heroEl = $('.hero');
  if (heroEl && $('.hero__bg img', heroEl) && !reducedMotion.matches) {
    let queued = false;
    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (root.classList.contains('motion-paused')) return;
        const y = Math.min(window.scrollY, heroEl.offsetHeight);
        heroEl.style.setProperty('--py', (y * 0.16).toFixed(1));
      });
    }, { passive: true });
  }
})();
