// Content script: the Fine Print slide-out — the extension's ONLY surface.
//
// A fixed panel on the right; while it's open the page is SQUISHED, not covered:
//   1. html gets margin-right = panel width + gutter, so normal-flow and sticky
//      content reflows into the remaining width (verified on realestate.com.au and
//      domain.com.au listing pages, 2026-11-06 — no horizontal scroll)
//   2. position:fixed elements reaching into the panel's area are positioned
//      against the window, not <html>, so they're shifted left individually
//      (REA's floating "Ask AI" button; Domain's edge-to-edge sticky header that
//      slides in on scroll). Re-scanned on DOM changes and scroll; restored on close.
//
// Auto-opens on listing pages; the toolbar icon toggles it anywhere. The panel is
// an iframe of the extension's own page in a closed shadow root, so the page can
// neither read nor restyle it. Plain script (content scripts can't be ES modules).

(() => {
  if (window.top !== window) return;
  if (window.__finePrint) return; // already injected (manifest + toolbar re-inject)

  const PANEL_W = 420;
  const GUTTER = 16;
  const SQUISH = PANEL_W + GUTTER * 2; // 452px reserved on the right
  const PANEL_URL = chrome.runtime.getURL('panel.html'); // built by Vite into dist/
  const EXT_ORIGIN = new URL(PANEL_URL).origin;
  const listingKey = location.origin + location.pathname;

  const isListing = () =>
    (location.hostname.endsWith('realestate.com.au') && location.pathname.startsWith('/property-')) ||
    (location.hostname.endsWith('domain.com.au') && /-\d{7,}\/?$/.test(location.pathname));

  // ---------------------------------------------------------------- squish
  const squishStyle = document.createElement('style');
  squishStyle.textContent = `html { margin-right: ${SQUISH}px !important; transition: margin-right .25s ease; }`;

  const shifted = new Set();
  function shiftFixed() {
    const limit = window.innerWidth - SQUISH;
    for (const el of document.querySelectorAll('body *')) {
      if (shifted.has(el) || el === host) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= limit) continue;
      el.dataset.fpRight = el.style.getPropertyValue('right');
      el.dataset.fpMaxWidth = el.style.getPropertyValue('max-width');
      if (cs.right !== 'auto') el.style.setProperty('right', `calc(${cs.right} + ${SQUISH}px)`, 'important');
      else el.style.setProperty('max-width', `${Math.max(0, Math.round(limit - r.left))}px`, 'important');
      shifted.add(el);
    }
  }
  function unshiftFixed() {
    for (const el of shifted) {
      el.style.removeProperty('right');
      el.style.removeProperty('max-width');
      if (el.dataset.fpRight) el.style.setProperty('right', el.dataset.fpRight);
      if (el.dataset.fpMaxWidth) el.style.setProperty('max-width', el.dataset.fpMaxWidth);
      delete el.dataset.fpRight;
      delete el.dataset.fpMaxWidth;
    }
    shifted.clear();
  }

  let rescanTimer = null;
  const rescanSoon = () => {
    if (rescanTimer) return;
    rescanTimer = setTimeout(() => {
      rescanTimer = null;
      if (isOpen) shiftFixed();
    }, 200);
  };
  const observer = new MutationObserver(rescanSoon);

  // ---------------------------------------------------------------- panel
  const host = document.createElement('div');
  host.id = 'fine-print-root';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .wrap { position: fixed; top: ${GUTTER}px; right: ${GUTTER}px; bottom: ${GUTTER}px; width: ${PANEL_W}px; z-index: 2147483646;
              display: flex; flex-direction: column; gap: 8px; font-family: Geist, -apple-system, system-ui, sans-serif;
              transition: transform .25s ease, opacity .25s ease; }
      .wrap.closed { transform: translateX(${PANEL_W + GUTTER}px); opacity: 0; pointer-events: none; }
      iframe { flex: 1; width: 100%; border: 1px solid #e2ddd2; border-radius: 22px; background: #fbfaf6;
               box-shadow: 0 24px 60px rgba(60,48,28,.16), 0 1px 2px rgba(60,48,28,.08); }
      .shortlist { height: 46px; flex-shrink: 0; border: none; border-radius: 14px; background: #2f64d9; color: #fff;
                   font: 600 14px Geist, -apple-system, system-ui, sans-serif; cursor: pointer;
                   box-shadow: 0 10px 24px rgba(47,100,217,.28), inset 0 1px 0 rgba(255,255,255,.18);
                   display: flex; align-items: center; justify-content: center; gap: 10px; }
      .shortlist.done { background: #1e1d1b; box-shadow: none; }
      .pill { position: fixed; right: ${GUTTER}px; bottom: ${GUTTER}px; z-index: 2147483646; display: none; align-items: center; gap: 8px;
              padding: 10px 14px; border-radius: 999px; border: 1px solid #e2ddd2; background: #fbfaf6; color: #1e1d1b;
              font: 600 13px Geist, -apple-system, system-ui, sans-serif; cursor: pointer; box-shadow: 0 10px 30px rgba(60,48,28,.18); }
      .pill.show { display: flex; }
      .mark { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 6px; background: #1e1d1b; color: #fbfaf6; font-size: 11px; }
    </style>
    <div class="wrap closed">
      <iframe title="Fine Print" allow="clipboard-write"></iframe>
      <button class="shortlist"><svg width="14" height="14" viewBox="0 0 13 13" fill="none"><path d="M3 1.5h7v10l-3.5-2.5L3 11.5z" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg><span>Shortlist this property</span></button>
    </div>
    <button class="pill"><span class="mark">F</span> Fine Print</button>`;
  document.documentElement.append(host);

  const wrap = shadow.querySelector('.wrap');
  const frame = shadow.querySelector('iframe');
  const pill = shadow.querySelector('.pill');
  const shortlistBtn = shadow.querySelector('.shortlist');
  const label = shortlistBtn.querySelector('span');
  let isOpen = false;

  function open() {
    if (isOpen) return;
    isOpen = true;
    if (!frame.src) frame.src = PANEL_URL; // lazy: no agent page until first open
    document.head.append(squishStyle);
    shiftFixed();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('scroll', rescanSoon, { passive: true });
    window.addEventListener('resize', rescanSoon);
    wrap.classList.remove('closed');
    pill.classList.remove('show');
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    observer.disconnect();
    window.removeEventListener('scroll', rescanSoon);
    window.removeEventListener('resize', rescanSoon);
    squishStyle.remove();
    unshiftFixed();
    wrap.classList.add('closed');
    pill.classList.add('show');
  }

  pill.addEventListener('click', open);
  // the panel's ✕ asks to close; only trust our own extension origin
  window.addEventListener('message', (e) => {
    if (e.origin === EXT_ORIGIN && e.data?.type === 'fineprint:close') close();
  });
  // toolbar icon
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type !== 'fineprint:toggle') return;
    isOpen ? close() : open();
    reply({ open: isOpen });
  });

  // ---------------------------------------------------------------- shortlist
  const paint = (on) => {
    shortlistBtn.classList.toggle('done', on);
    label.textContent = on ? 'Shortlisted ✓' : 'Shortlist this property';
  };
  chrome.storage.local.get('shortlist').then(({ shortlist = {} }) => paint(Boolean(shortlist[listingKey])));
  shortlistBtn.addEventListener('click', async () => {
    const { shortlist = {} } = await chrome.storage.local.get('shortlist');
    if (shortlist[listingKey]) delete shortlist[listingKey];
    else shortlist[listingKey] = { url: listingKey, title: document.title, heading: document.querySelector('h1')?.innerText ?? null, added_at: Date.now() };
    await chrome.storage.local.set({ shortlist });
    paint(Boolean(shortlist[listingKey]));
  });

  window.__finePrint = { open, close };
  // Auto-open on listings: the read is there before the investor asks.
  if (isListing()) setTimeout(open, 400);
  else pill.classList.add('show');
})();
