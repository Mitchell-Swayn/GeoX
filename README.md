# GeoX

A local Manifest V3 extension for Helium/Chrome. Adds country flag or continent globe emoji beside X post authors, profile names, and “You might like” / “Who to follow” recommendations using X's `AboutAccountQuery` account-based-in field. No country is inferred from bios or names. Continents and recognized broad regions use the appropriate globe emoji (🌍, 🌏, or 🌎); Antarctica uses 🇦🇶. Unknown or unavailable locations have no badge.

Load the `extension` directory at `chrome://extensions` with Developer mode → Load unpacked, then refresh X. Keep this directory in place while installed.

The extension runs only on x.com and twitter.com. It reuses X's own request authentication in page memory to make read-only requests to the same site. Credentials stay in page memory and are never logged or saved to disk. Public username/country results and lookup timestamps are saved in extension-local browser storage and shared between X tabs. Known countries remain cached across refreshes and browser restarts without automatic expiry; absent results are retried after 24 hours. Errors are not cached. Cached countries may become stale if an account changes country or username ownership. No data is sent to external services. A background service worker coordinates a single request queue across tabs. Automatic requests are at least 10 seconds apart and capped at 30 per rolling 15 minutes; these are conservative extension defaults, not a claim about X’s quota. Server allowance headers reserve the final five requests for browsing. Cooldowns, recent request history, and active request leases persist across reloads and browser restarts. Only names visible for at least 800 ms in a visible tab are queued, with the open profile ahead of post authors and recommendations. Offscreen requests are removed. X’s own AboutAccountQuery responses (fetch and XMLHttpRequest) populate the same cache; automatic lookups pause on About pages. The popup reports cached entries and pauses. Requests already in flight cannot be undone, and X can still rate-limit normal browsing.

X's internal API may change, and its account country can be approximate. The extension learns an updated AboutAccountQuery URL if X makes that request while the page is open. Requires a signed-in X session.

Implementation references: Chrome content-script documentation (https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) and endpoint/schema inspection of https://github.com/RhysSullivan/twitter-account-location-in-username/blob/main/pageScript.js. This extension is independently implemented.

## Development

Requires Node.js 20 or newer. No build step is needed for the extension.

```sh
npm ci
npm test
```

The `extension/` directory is the complete unpacked extension. `test/` contains synthetic test fixtures; no browser profile or account cache is included.

## Privacy and permissions

See [PRIVACY.md](PRIVACY.md). The only declared API permission is `storage`; content scripts are restricted to X and Twitter. No personal credentials or account setup are required in the source code.

## Publishing

Publish this Git repository to an empty GitHub repository. It uses a generic local commit identity to avoid including a personal name or email in commits. GitHub will still display the account that owns the repository and performs the push.

```sh
git remote add origin https://github.com/YOUR-ACCOUNT/geox.git
git push -u origin main
```

For a downloadable extension release, ZIP only the contents of `extension/` so `manifest.json` is at the ZIP root. Do not upload the entire local project directory or browser data. After source changes, reload GeoX at `chrome://extensions` and refresh X.

## License

[MIT](LICENSE).
