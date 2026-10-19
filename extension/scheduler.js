// Pure scheduling policy, shared by the service worker and deterministic tests.
class GeoXScheduler {
  constructor(state = {}) {
    this.state = { nextAt: 0, pausedUntil: 0, history: [], lease: null, remaining: null, resetAt: 0, ...state };
    this.tabs = new Map();
  }
  update(tab, candidates, now) {
    this.tabs.set(tab, { candidates, seen: now });
  }
  claim(tab, now, isCached) {
    const s = this.state;
    s.history = s.history.filter(t => t > now - 900000);
    if (s.resetAt && now >= s.resetAt) { s.remaining = null; s.resetAt = 0; }
    if (s.lease && now >= s.lease.until) s.lease = null;
    if (s.lease || now < s.nextAt || now < s.pausedUntil || s.history.length >= 30 || (s.remaining !== null && s.remaining <= 5)) return null;
    const choices = [];
    for (const [id, item] of this.tabs) {
      if (now - item.seen > 3000) { this.tabs.delete(id); continue; }
      for (const c of item.candidates) if (!isCached(c.handle)) choices.push({ ...c, tab: id });
    }
    choices.sort((a, b) => a.priority - b.priority || a.since - b.since || a.tab - b.tab);
    const choice = choices[0];
    if (!choice || choice.tab !== tab) return null;
    const token = `${now}:${tab}:${choice.handle}`;
    s.lease = { token, tab, handle: choice.handle, until: now + 25000 };
    s.nextAt = now + 10000;
    s.history.push(now);
    if (s.remaining !== null) s.remaining--;
    return s.lease;
  }
  observe(info, now) {
    const s = this.state;
    if (Number.isFinite(info.resetAt) && info.resetAt > now) {
      if (s.resetAt !== info.resetAt) s.remaining = null;
      s.resetAt = info.resetAt;
    }
    if (Number.isFinite(info.remaining) && info.remaining >= 0) {
      s.remaining = s.remaining === null ? info.remaining : Math.min(s.remaining, info.remaining);
      if (!s.resetAt) s.resetAt = now + 900000;
    }
    if (info.status === 429) s.pausedUntil = Math.max(s.pausedUntil, now + 60000, info.resetAt || now + 900000, info.retryAt || 0);
    else if (info.status < 200 || info.status >= 400 || info.error) s.pausedUntil = Math.max(s.pausedUntil, now + 60000);
  }
  complete(tab, token, info, now) {
    this.observe(info, now);
    if (this.state.lease?.tab === tab && this.state.lease.token === token) this.state.lease = null;
  }
}
if (typeof module !== 'undefined') module.exports = GeoXScheduler;
