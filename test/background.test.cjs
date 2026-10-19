const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function worker(stored = {}) {
  let handler; const listeners = [];
  const context = vm.createContext({ chrome: {
    runtime: { onMessage: { addListener: h => handler = h } },
    tabs: { onRemoved: { addListener() {} } },
    storage: {
      local: { get: async () => structuredClone(stored), set: async updates => {
        await Promise.resolve();
        const changes = {};
        for (const [key, value] of Object.entries(updates)) { stored[key] = structuredClone(value); changes[key] = { newValue: stored[key] }; }
        listeners.forEach(l => l(changes, 'local'));
      } },
      onChanged: { addListener: h => listeners.push(h) }
    }
  }});
  context.importScripts = name => vm.runInContext(fs.readFileSync('extension/' + name, 'utf8'), context);
  vm.runInContext(fs.readFileSync('extension/background.js', 'utf8'), context);
  return (tab, message) => new Promise(resolve => handler(message, { tab: {id: tab}, url: 'https://x.com/home' }, resolve));
}
test('worker serializes simultaneous tabs and persists its lease before responding', async () => {
  const stored = {}, send = worker(stored);
  const message = {type: 'queue', candidates: [{handle: 'alice', priority: 1, since: Date.now()}]};
  const results = await Promise.all([send(1, message), send(2, message)]);
  assert.equal(results.filter(r => r.grant).length, 1);
  assert.equal(stored.requestBudget.history.length, 1);
  assert.equal(stored.requestBudget.lease.token, results[0].grant.token);
  await send(1, {type: 'complete', token: results[0].grant.token, info: {status: 429, resetAt: Date.now() + 900000}});
  const restarted = worker(stored);
  assert.equal((await restarted(3, message)).grant, null);
});
test('worker consults existing country cache and receives native rate limits', async () => {
  const stored = {'country:alice': {country: 'Australia', until: 0}}, send = worker(stored);
  const message = {type: 'queue', candidates: [{handle: 'alice', priority: 0, since: Date.now()}]};
  assert.equal((await send(1, message)).grant, null);
  await send(1, {type: 'observe', info: {status: 200, remaining: 5, resetAt: Date.now() + 900000}});
  message.candidates[0].handle = 'bob';
  assert.equal((await send(2, message)).grant, null);
});
