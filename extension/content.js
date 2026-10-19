(() => {
  'use strict';
  if (window.__geoxStarted) return;
  window.__geoxStarted = true;
  const nativeFetch = window.fetch.bind(window);
  const cache = new Map();
  const pending = new Map();
  const visibleSince = new Map();
  const replies = new Map();
  let requestId = 0;
  function request(data) {
    return new Promise(resolve => {
      const id = ++requestId;
      const timeout = setTimeout(() => { replies.delete(id); resolve({}); }, 5000);
      replies.set(id, response => { clearTimeout(timeout); resolve(response || {}); });
      window.postMessage({ type: "geox:request", id, request: data }, location.origin);
    });
  }
  const xhrInfo = new WeakMap();
  let cacheReady = false;
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.type === 'geox:reply') {
      replies.get(event.data.id)?.(event.data.response); replies.delete(event.data.id); return;
    }
    if (event.data?.type !== 'geox:cache:loaded' || !Array.isArray(event.data.entries)) return;
    for (const [handle, entry] of event.data.entries) {
      if (!/^[a-z0-9_]{1,15}$/.test(handle)) continue;
      if (entry === null) { cache.delete(handle); continue; }
      if (!entry || !(entry.country === null || typeof entry.country === 'string') || !Number.isFinite(entry.until)) continue;
      if (!cache.has(handle) || (entry.checkedAt || 0) >= (cache.get(handle).checkedAt || 0)) cache.set(handle, entry);
      if (entry.until === 0 || entry.until > Date.now()) pending.delete(handle);
    }
    if (event.data.ready) cacheReady = true;
    schedule();
  });
  window.postMessage({ type: 'geox:cache:load' }, location.origin);
  // Retry the handshake in case the two execution worlds start in a different order.
  const cacheLoadTimer = setInterval(() => {
    if (cacheReady) clearInterval(cacheLoadTimer);
    else window.postMessage({ type: 'geox:cache:load' }, location.origin);
  }, 1000);
  let auth = null, endpoint = '/i/api/graphql/XRqGa7EeokUU5kppkh13EA/AboutAccountQuery';
  let running = false, timer;
  const allowedHeaders = ['authorization', 'x-csrf-token', 'x-twitter-auth-type', 'x-twitter-active-user', 'x-twitter-client-language'];
  function capture(url, headers) {
    try {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin || !u.pathname.startsWith('/i/api/')) return;
      const h = new Headers(headers);
      if (h.has('authorization') && h.has('x-csrf-token')) {
        auth = Object.fromEntries(allowedHeaders.filter(k => h.has(k)).map(k => [k, h.get(k)]));
        pump();
      }
      if (/^\/i\/api\/graphql\/[\w-]+\/AboutAccountQuery$/.test(u.pathname)) endpoint = u.pathname;
    } catch { /* Non-API requests are ignored. */ }
  }
  function aboutHandle(url) {
    try {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin || !/^\/i\/api\/graphql\/[\w-]+\/AboutAccountQuery$/.test(u.pathname)) return null;
      const handle = JSON.parse(u.searchParams.get('variables')).screenName?.toLowerCase();
      return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
    } catch { return null; }
  }
  function rateInfo(status, getHeader) {
    const number = name => { const value = getHeader(name); return value === null || value === '' ? null : Number(value); };
    const retry = getHeader('retry-after');
    return { status, remaining: number('x-rate-limit-remaining'), resetAt: number('x-rate-limit-reset') * 1000,
      retryAt: retry ? (Number.isFinite(Number(retry)) ? Date.now() + Number(retry) * 1000 : Date.parse(retry)) : 0 };
  }
  function saveResult(handle, json) {
    const result = json?.data?.user_result_by_screen_name?.result;
    if (!result || json.errors?.length) return false;
    const country = result.about_profile?.account_based_in;
    const entry = { country: typeof country === 'string' && country ? country : null, checkedAt: Date.now(), until: country ? 0 : Date.now() + 86400000 };
    pending.delete(handle); cache.set(handle, entry);
    window.postMessage({ type: 'geox:cache:save', handle, entry }, location.origin);
    schedule();
    return true;
  }
  window.fetch = function(input, init) {
    const url = input instanceof Request ? input.url : input;
    const handle = aboutHandle(url);
    if (handle) request({ type: 'native-start' });
    capture(url, init?.headers || (input instanceof Request ? input.headers : undefined));
    const response = nativeFetch(input, init);
    if (handle) response.then(async r => {
      const info = rateInfo(r.status, name => r.headers.get(name));
      if (r.ok) { try { info.error = !saveResult(handle, await r.clone().json()); } catch { info.error = true; } }
      request({ type: 'observe', info });
    }).catch(() => request({ type: 'observe', info: { status: 0 } }));
    return response;
  };
  const open = XMLHttpRequest.prototype.open;
  const setHeader = XMLHttpRequest.prototype.setRequestHeader;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    xhrInfo.set(this, { url, headers: new Headers() });
    return open.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(k, v) {
    xhrInfo.get(this)?.headers.set(k, v);
    return setHeader.call(this, k, v);
  };
  XMLHttpRequest.prototype.send = function(...args) {
    const info = xhrInfo.get(this);
    const handle = aboutHandle(info?.url);
    if (handle) {
      request({ type: 'native-start' });
      this.addEventListener('loadend', () => {
        const rate = rateInfo(this.status, name => this.getResponseHeader(name));
        if (this.status >= 200 && this.status < 300) {
          try { rate.error = !saveResult(handle, this.responseType === 'json' ? this.response : JSON.parse(this.responseText)); }
          catch { rate.error = true; }
        }
        request({ type: 'observe', info: rate });
      }, { once: true });
    }
    if (info) capture(info.url, info.headers);
    return send.apply(this, args);
  };
  function plainText(node) {
    return [...node.childNodes].filter(n => n.nodeType !== 1 || !n.classList.contains('geox-flag')).map(n => n.textContent).join('').trim();
  }
  function handleFor(node) {
    for (const a of node.querySelectorAll('a[href]')) {
      const match = new URL(a.href, location.href).pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
      if (match && !['home','explore','notifications','messages','settings','search','i'].includes(match[1].toLowerCase())) return match[1].toLowerCase();
    }
    const text = [...node.querySelectorAll('span')].find(s => /^@[A-Za-z0-9_]{1,15}$/.test(plainText(s)));
    return text ? plainText(text).slice(1).toLowerCase() : null;
  }
  function scan() {
    pending.clear();
    const visible = new Set();
    for (const node of document.querySelectorAll('[data-testid="User-Name"], [data-testid="UserName"], [data-testid="UserCell"]')) {
      // Some recommendation layouts already contain a supported name block.
      if (node.matches('[data-testid="UserCell"]') && node.querySelector('[data-testid="User-Name"], [data-testid="UserName"]')) continue;
      const handle = handleFor(node);
      const old = node.querySelector('.geox-flag');
      if (old && old.dataset.handle !== handle) old.remove();
      if (!handle) continue;
      const entry = cache.get(handle);
      if (entry && (entry.until === 0 || entry.until > Date.now())) {
        const flag = GeoXCountries.flag(entry.country);
        const existing = node.querySelector('.geox-flag');
        const title = `X reports account based in ${entry.country}`;
        if (existing && (!flag || existing.textContent !== flag || existing.title !== title)) existing.remove();
        if (flag && !node.querySelector('.geox-flag')) {
          const target = [...node.querySelectorAll('span')].find(s => plainText(s).toLowerCase() === '@' + handle)
            || node.querySelector('a[role="link"]') || node.firstElementChild;
          if (!target) continue;
          const badge = document.createElement('span');
          badge.className = 'geox-flag'; badge.dataset.handle = handle;
          badge.textContent = flag; badge.title = `X reports account based in ${entry.country}`;
          badge.setAttribute('aria-label', badge.title);
          target.append(badge);
        }
      } else {
        const rect = node.getBoundingClientRect();
        if (document.visibilityState !== 'hidden' && rect.bottom >= 0 && rect.top <= innerHeight) {
          visible.add(handle);
          if (!visibleSince.has(handle)) visibleSince.set(handle, Date.now());
          const profile = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})(?:\/about)?\/?$/)?.[1]?.toLowerCase();
          const priority = handle === profile ? 0 : node.matches('[data-testid="UserCell"]') ? 2 : 1;
          if (Date.now() - visibleSince.get(handle) >= 800 && !location.pathname.endsWith('/about')) {
            const candidate = { handle, priority, since: visibleSince.get(handle) };
            if (!pending.has(handle) || pending.get(handle).priority > priority) pending.set(handle, candidate);
          }
        }
      }
    }
    for (const handle of visibleSince.keys()) if (!visible.has(handle)) visibleSince.delete(handle);
    pump();
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(scan, 150); }
  async function pump() {
    if (running || !cacheReady) return;
    running = true;
    try {
      const { grant } = await request({ type: 'queue', candidates: auth && document.visibilityState !== 'hidden' ? [...pending.values()] : [] });
      if (!grant) return;
      const entry = cache.get(grant.handle);
      if (!pending.has(grant.handle) || document.visibilityState === 'hidden' || (entry && (entry.until === 0 || entry.until > Date.now()))) {
        await request({ type: 'complete', token: grant.token, info: { status: 204 } }); return;
      }
      let info = { status: 0 };
      try {
        const response = await nativeFetch(`${endpoint}?variables=${encodeURIComponent(JSON.stringify({ screenName: grant.handle }))}`, {
          credentials: 'same-origin', headers: { ...auth, 'x-twitter-client-language': 'en' }, signal: AbortSignal.timeout(15000)
        });
        info = rateInfo(response.status, name => response.headers.get(name));
        if (response.ok) info.error = !saveResult(grant.handle, await response.json());
      } catch { info.error = true; }
      await request({ type: 'complete', token: grant.token, info });
    } finally { running = false; }
  }
  function start() {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href'] });
    window.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('visibilitychange', scan);
    setInterval(scan, 1000);
    scan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
