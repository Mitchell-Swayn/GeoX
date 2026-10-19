importScripts('scheduler.js');
let scheduler;
const countries = new Map();
let chain = Promise.resolve();
const ready = chrome.storage.local.get(null).then(data => {
  scheduler = new GeoXScheduler(data.requestBudget);
  for (const [key, value] of Object.entries(data)) if (key.startsWith('country:')) countries.set(key.slice(8), value);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  for (const [key, change] of Object.entries(changes)) if (key.startsWith('country:')) {
    if (change.newValue) countries.set(key.slice(8), change.newValue); else countries.delete(key.slice(8));
  }
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!sender.tab || !/^https:\/\/(x|twitter)\.com\//.test(sender.url || '')) return;
  chain = chain.catch(() => {}).then(async () => {
    await ready;
    const now = Date.now(), tab = sender.tab.id;
    const before = JSON.stringify(scheduler.state);
    if (message.type === 'queue') {
      const candidates = (Array.isArray(message.candidates) ? message.candidates : []).slice(0, 100)
        .filter(c => /^[a-z0-9_]{1,15}$/.test(c.handle) && Number.isFinite(c.since) && [0, 1, 2].includes(c.priority));
      scheduler.update(tab, candidates, now);
      const grant = scheduler.claim(tab, now, handle => {
        const e = countries.get(handle);
        return e && (e.until === 0 || e.until > now);
      });
      if (grant || before !== JSON.stringify(scheduler.state)) await chrome.storage.local.set({ requestBudget: scheduler.state });
      reply({ grant });
    } else if (message.type === 'complete' || message.type === 'observe') {
      const info = message.info || {};
      if (message.type === 'complete') scheduler.complete(tab, message.token, info, now);
      else scheduler.observe(info, now);
      await chrome.storage.local.set({ requestBudget: scheduler.state });
      reply({ ok: true });
    } else if (message.type === 'native-start') {
      // Give X's own request time to populate the cache before scheduling ours.
      scheduler.state.nextAt = Math.max(scheduler.state.nextAt, now + 20000);
      await chrome.storage.local.set({ requestBudget: scheduler.state });
      reply({ ok: true });
    } else reply({});
  }).catch(() => reply({ error: true }));
  return true;
});
chrome.tabs.onRemoved.addListener(tab => { scheduler?.tabs.delete(tab); });
