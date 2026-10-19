const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const countryScript = fs.readFileSync('extension/countries.js', 'utf8');
const contentScript = fs.readFileSync('extension/content.js', 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));
const Scheduler = require('../extension/scheduler.js');
const cacheScript = fs.readFileSync('extension/cache.js', 'utf8');
function attachCache(w, stored = {}) {
  const listeners = [];
  const scheduler = new Scheduler();
  w.postMessage = data => w.setTimeout(() => w.dispatchEvent(new w.MessageEvent('message', { data, origin: w.location.origin, source: w })), 0);
  w.chrome = { runtime: { sendMessage: async message => {
    const now = Date.now();
    if (message.type === 'queue') {
      scheduler.update(1, message.candidates, now);
      return { grant: scheduler.claim(1, now, h => { const e = stored['country:' + h]; return e && (e.until === 0 || e.until > now); }) };
    }
    if (message.type === 'complete') {
      scheduler.complete(1, message.token, message.info, now);
      // UI tests skip spacing; scheduler tests verify actual time budgets.
      scheduler.state.nextAt = 0;
    } else if (message.type === 'observe') scheduler.observe(message.info, now);
    else if (message.type === 'native-start') scheduler.state.nextAt = now + 20000;
    return {};
  }}, storage: {
    local: {
      get: async () => ({ ...stored }),
      set: async updates => {
        const changes = {};
        for (const [key, value] of Object.entries(updates)) { changes[key] = { oldValue: stored[key], newValue: value }; stored[key] = value; }
        for (const listener of listeners) listener(changes, 'local');
      }
    },
    onChanged: { addListener: listener => listeners.push(listener) }
  }};
  w.eval(cacheScript);
  return stored;
}
test('maps countries and explicit regions without guessing locations', () => {
  const dom = new JSDOM('', { runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.eval(countryScript);
  for (const [name, flag] of [['United States','🇺🇸'],['Australia','🇦🇺'],['India','🇮🇳'],['Türkiye','🇹🇷'],['Europe','🌍'],['South Asia','🌏'],['North America','🌎'],['Southeast Asia','🌏'],['Sub-Saharan Africa','🌍'],['  south   asia  ','🌏'],['Oceania','🌏'],['Antarctica','🇦🇶'],['Unknown',null],['Sydney',null],[null,null]]) assert.equal(dom.window.GeoXCountries.flag(name), flag);
  dom.window.close();
});
test('renders posts and profiles, deduplicates, updates recycled authors, confines auth to same origin', async () => {
  const dom = new JSDOM('<div data-testid="User-Name"><a href="/alice" role="link"><span>Alice</span></a><span>@alice</span></div><div data-testid="UserName"><span>Alice</span><span>@alice</span></div>', { url: 'https://x.com/home', runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.document.body.insertAdjacentHTML('beforeend', '<div data-testid="UserCell"><a href="/alice"><img alt="Alice"></a><a href="/alice"><span>Alice</span></a><a href="/alice"><span>@Alice</span></a><button>Follow</button></div><div data-testid="UserCell"><div data-testid="User-Name"><a href="/alice"><span>@alice</span></a></div><button>Follow</button></div>');
  const w = dom.window, calls = [];
  w.Headers = Headers; w.Request = Request; w.AbortSignal = AbortSignal;
  w.fetch = async (url, init) => {
    if (String(url).includes('AboutAccountQuery')) {
      calls.push({url, init});
      const name = JSON.parse(new URL(url, w.location.href).searchParams.get('variables')).screenName;
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({ data: { user_result_by_screen_name: { result: { about_profile: { account_based_in: name === 'alice' ? 'Australia' : 'Japan' } } } } }) };
    }
    return { ok: true };
  };
  attachCache(w); w.eval(countryScript); w.eval(contentScript);
  await w.fetch('https://example.com/i/api/graphql/foo', { headers: { authorization: 'untrusted', 'x-csrf-token': 'bad' } });
  await wait(50); assert.equal(calls.length, 0);
  await w.fetch('/i/api/graphql/foo', { headers: { authorization: 'test', 'x-csrf-token': 'test' } });
  await wait(1250);
  assert.equal(w.document.querySelectorAll('.geox-flag').length, 4);
  for (const card of w.document.querySelectorAll('[data-testid="UserCell"]')) {
    assert.equal(card.querySelectorAll('.geox-flag').length, 1);
    assert.match(card.querySelector('.geox-flag').parentElement.textContent, /@alice/i);
    assert.equal(card.querySelector('button').textContent, 'Follow');
  }
  assert.equal(calls.length, 1);
  assert.equal(w.document.querySelector('.geox-flag').textContent, '🇦🇺');
  const post = w.document.querySelector('[data-testid="User-Name"]');
  post.querySelector('a').href = '/bob'; post.querySelector('a span').textContent = 'Bob';
  post.querySelector(':scope > span').firstChild.textContent = '@bob';
  await wait(2500);
  assert.equal(post.querySelector('.geox-flag').textContent, '🇯🇵');
  assert.equal(calls.length, 2);
  assert.equal(w.document.querySelector('[data-testid="UserName"] .geox-flag').textContent, '🇦🇺');
  const profileBadge = w.document.querySelector('[data-testid="UserName"] .geox-flag');
  w.document.body.append(w.document.createElement('div'));
  await wait(400);
  assert.equal(w.document.querySelector('[data-testid="UserName"] .geox-flag'), profileBadge);
  dom.window.close();
});
test('rate limits stop lookups without displaying a guessed flag', async () => {
  const dom = new JSDOM('<div data-testid="User-Name"><a href="/alice">Alice</a></div><div data-testid="User-Name"><a href="/bob">Bob</a></div>', { url: 'https://x.com/home', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; let lookups = 0;
  w.Headers = Headers; w.Request = Request; w.AbortSignal = AbortSignal;
  w.fetch = async url => {
    if (String(url).includes('AboutAccountQuery')) lookups++;
    return { ok: false, status: 429, headers: new Headers() };
  };
  attachCache(w); w.eval(countryScript); w.eval(contentScript);
  await w.fetch('/i/api/graphql/foo', { headers: { authorization: 'test', 'x-csrf-token': 'test' } });
  await wait(1600);
  assert.equal(lookups, 1);
  assert.equal(w.document.querySelectorAll('.geox-flag').length, 0);
  w.close();
});

test('persistent cache survives a new page, without authentication or additional lookups', async () => {
  const stored = {};
  let lookups = 0;
  async function page(authenticate) {
    const dom = new JSDOM('<div data-testid="UserName"><span>@Alice</span></div>', { url: 'https://x.com/alice', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    w.Headers = Headers; w.Request = Request; w.AbortSignal = AbortSignal;
    w.fetch = async url => {
      if (String(url).includes('AboutAccountQuery')) lookups++;
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({ data: { user_result_by_screen_name: { result: { about_profile: { account_based_in: 'Australia' } } } } }) };
    };
    attachCache(w, stored); w.eval(countryScript); w.eval(contentScript);
    if (authenticate) await w.fetch('/i/api/graphql/foo', { headers: { authorization: 'secret-test', 'x-csrf-token': 'secret-test' } });
    await wait(1250);
    assert.equal(w.document.querySelector('.geox-flag')?.textContent, '🇦🇺');
    w.close();
  }
  await page(true);
  assert.equal(lookups, 1);
  assert.equal(stored['country:alice'].until, 0);
  assert.equal(stored['country:alice'].country, 'Australia');
  assert.equal(JSON.stringify(stored).includes('secret-test'), false);
  await page(false);
  assert.equal(lookups, 1);
});

test('reuses X native About responses and avoids a second request', async () => {
  const dom = new JSDOM('<div data-testid="UserName"><span>@alice</span></div>', { url: 'https://x.com/alice/about', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, stored = {}; let calls = 0;
  w.Headers = Headers; w.Request = Request; w.AbortSignal = AbortSignal;
  w.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ data: { user_result_by_screen_name: { result: { about_profile: { account_based_in: 'Japan' } } } } }), { status: 200, headers: { 'x-rate-limit-remaining': '10' } });
  };
  attachCache(w, stored); w.eval(countryScript); w.eval(contentScript);
  const result = await w.fetch('/i/api/graphql/observed/AboutAccountQuery?variables=' + encodeURIComponent(JSON.stringify({screenName: 'alice'})), {headers: {authorization: 'test', 'x-csrf-token': 'test'}});
  assert.equal((await result.json()).data.user_result_by_screen_name.result.about_profile.account_based_in, 'Japan');
  await wait(1400);
  assert.equal(stored['country:alice'].country, 'Japan');
  assert.equal(calls, 1);
  assert.equal(w.document.querySelector('.geox-flag').textContent, '🇯🇵');
  w.close();
});

test('cached regions render immediately and badges follow updated native locations', async () => {
  const dom = new JSDOM('<div data-testid="UserName"><span>@example_user</span></div>', { url: 'https://x.com/example_user/about', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.Headers = Headers; w.Request = Request; w.AbortSignal = AbortSignal;
  w.fetch = async () => new Response(JSON.stringify({ data: { user_result_by_screen_name: { result: { about_profile: { account_based_in: 'Europe' } } } } }));
  attachCache(w, { 'country:example_user': { country: 'South Asia', checkedAt: 1, until: 0 } });
  w.eval(countryScript); w.eval(contentScript);
  await wait(400);
  assert.equal(w.document.querySelector('.geox-flag')?.textContent, '🌏');
  await w.fetch('/i/api/graphql/observed/AboutAccountQuery?variables=' + encodeURIComponent(JSON.stringify({ screenName: 'example_user' })));
  await wait(400);
  assert.equal(w.document.querySelectorAll('.geox-flag').length, 1);
  assert.equal(w.document.querySelector('.geox-flag').textContent, '🌍');
  assert.equal(w.document.querySelector('.geox-flag').title, 'X reports account based in Europe');
  w.close();
});
