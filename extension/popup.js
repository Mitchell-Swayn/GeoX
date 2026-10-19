async function updateCacheCount() {
  const entries = await chrome.storage.local.get(null);
  const count = Object.entries(entries).filter(([key, value]) => key.startsWith('country:') && value?.country).length;
  document.getElementById('cache-count').textContent = `${count.toLocaleString()} usernames cached`;
  const budget = entries.requestBudget || {};
  const now = Date.now();
  const recent = (budget.history || []).filter(t => t > now - 900000);
  const waitUntil = Math.max(budget.pausedUntil || 0, budget.remaining !== null && budget.remaining <= 5 ? budget.resetAt || 0 : 0, recent.length >= 30 ? recent[0] + 900000 : 0);
  document.getElementById('request-status').textContent = waitUntil > now
    ? `New lookups paused until ${new Date(waitUntil).toLocaleTimeString()}. Cached flags still work.`
    : 'Gentle lookups: one at a time across all tabs, at most 30 per 15 minutes.';
}
updateCacheCount();
chrome.storage.onChanged.addListener(updateCacheCount);
