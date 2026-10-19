const { test } = require('node:test');
const assert = require('node:assert/strict');
const Scheduler = require('../extension/scheduler.js');
const candidate = (handle, priority = 1) => ({ handle, priority, since: 0 });
const uncached = () => false;
test('one shared lease; profile priority; offscreen and stale queues are dropped', () => {
  const s = new Scheduler();
  s.update(1, [candidate('alice', 2)], 100);
  s.update(2, [candidate('bob', 0)], 100);
  assert.equal(s.claim(1, 100, uncached), null);
  const grant = s.claim(2, 100, uncached);
  assert.equal(grant.handle, 'bob');
  assert.equal(s.claim(1, 101, uncached), null);
  s.complete(2, grant.token, { status: 200 }, 200);
  assert.equal(s.claim(1, 300, uncached), null);
  s.update(1, [], 10200);
  assert.equal(s.claim(1, 10200, uncached), null);
});
test('429 cooldown and active leases survive service-worker/browser restart', () => {
  const s = new Scheduler();
  s.update(1, [candidate('alice')], 100);
  const grant = s.claim(1, 100, uncached);
  const restarted = new Scheduler(JSON.parse(JSON.stringify(s.state)));
  restarted.update(2, [candidate('alice')], 200);
  assert.equal(restarted.claim(2, 200, uncached), null);
  s.complete(1, grant.token, { status: 429, resetAt: 900000 }, 1000);
  const later = new Scheduler(JSON.parse(JSON.stringify(s.state)));
  later.update(2, [candidate('alice')], 20000);
  assert.equal(later.claim(2, 20000, uncached), null);
  later.update(2, [candidate('alice')], 900001);
  assert.ok(later.claim(2, 900001, uncached));
});
test('remaining allowance preserves five requests and resets after window', () => {
  const s = new Scheduler();
  s.observe({ status: 200, remaining: 6, resetAt: 900000 }, 100);
  s.update(1, [candidate('alice')], 100);
  const grant = s.claim(1, 100, uncached);
  s.complete(1, grant.token, { status: 200, remaining: 5, resetAt: 900000 }, 200);
  s.update(1, [candidate('bob')], 11000);
  assert.equal(s.claim(1, 11000, uncached), null);
  s.update(1, [candidate('bob')], 900001);
  assert.ok(s.claim(1, 900001, uncached));
});
test('fallback rolling budget caps automatic requests even without server headers', () => {
  const s = new Scheduler();
  for (let i = 0; i < 30; i++) {
    const now = i * 10000;
    s.update(1, [candidate('alice')], now);
    const grant = s.claim(1, now, uncached);
    assert.ok(grant);
    s.complete(1, grant.token, { status: 200 }, now + 1);
  }
  s.update(1, [candidate('alice')], 310000);
  assert.equal(s.claim(1, 310000, uncached), null);
  s.update(1, [candidate('alice')], 900001);
  assert.ok(s.claim(1, 900001, uncached));
});
test('cached accounts never obtain a grant', () => {
  const s = new Scheduler();
  s.update(1, [candidate('alice')], 100);
  assert.equal(s.claim(1, 100, () => true), null);
  assert.equal(s.state.history.length, 0);
});
