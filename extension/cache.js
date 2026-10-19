// Isolated-world bridge: only public username/country results cross into storage.
(() => {
  const prefix = 'country:';
  const valid = (handle, entry) => /^[a-z0-9_]{1,15}$/.test(handle)
    && entry && (entry.country === null || (typeof entry.country === 'string' && entry.country.length > 0 && entry.country.length <= 100))
    && Number.isFinite(entry.checkedAt) && Number.isFinite(entry.until);
  function publish(entries, ready = false) {
    window.postMessage({ type: 'geox:cache:loaded', entries, ready }, location.origin);
  }
  window.addEventListener('message', async event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    try {
      if (message?.type === 'geox:request' && ['queue', 'complete', 'observe', 'native-start'].includes(message.request?.type)) {
        const response = await chrome.runtime.sendMessage(message.request);
        window.postMessage({ type: 'geox:reply', id: message.id, response }, location.origin);
      } else if (message?.type === 'geox:cache:load') {
        const stored = await chrome.storage.local.get(null);
        const entries = Object.entries(stored).filter(([key, entry]) => key.startsWith(prefix) && valid(key.slice(prefix.length), entry))
          .map(([key, entry]) => [key.slice(prefix.length), entry]);
        publish(entries, true);
      } else if (message?.type === 'geox:cache:save' && valid(message.handle, message.entry)) {
        await chrome.storage.local.set({ [prefix + message.handle]: message.entry });
      }
    } catch {
      // Let the page work with memory caching if browser storage is unavailable.
      if (message?.type === 'geox:cache:load') publish([], true);
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const entries = Object.entries(changes).filter(([key]) => key.startsWith(prefix))
      .map(([key, change]) => [key.slice(prefix.length), change.newValue || null]);
    if (entries.length) publish(entries);
  });
})();
