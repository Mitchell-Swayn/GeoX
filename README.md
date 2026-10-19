# GeoX

<img width="479" height="136" alt="image" src="https://github.com/user-attachments/assets/b46fb5b1-040c-4da7-820c-e3ac256cb5e7" />

GeoX is a Manifest V3 browser extension for Helium and Chrome. It shows a country flag or region emoji beside account names on X, based on the "Account based in" location that X reports for each account.

Badges appear beside:

- post authors
- profile names
- suggested accounts, such as "You might like" and "Who to follow"

GeoX never guesses a location from names, bios or posts. If X does not report a location, no badge is shown.

## Installation

Install GeoX as an unpacked extension.

1. Get the source code using one of these options:

   - Download the ZIP from the [GeoX repository](https://github.com/Mitchell-Swayn/GeoX) (**Code** → **Download ZIP**) and extract it.
   - Clone the repository:

     ```sh
     git clone https://github.com/Mitchell-Swayn/GeoX.git
     ```

2. Open `chrome://extensions` in Helium or Chrome.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose the `extension/` folder inside the project. Do not choose the project root.
5. Sign in to X at [x.com](https://x.com), then refresh any open X tabs.

Keep the folder in place after installing. The browser loads the extension from that folder.

To update, download or pull the latest version, select the reload button on the GeoX card at `chrome://extensions`, and refresh X.

## Badges

| Location reported by X | Badge |
| --- | --- |
| A country or territory | That country's flag, such as 🇯🇵 |
| Africa, Europe or the Middle East, including recognized subregions | 🌍 |
| Asia or Oceania, including recognized subregions | 🌏 |
| The Americas, including subregions and the Caribbean | 🌎 |
| Antarctica | 🇦🇶 |
| Unknown, unavailable or still loading | No badge |

Recognized broad regions use a globe. GeoX never turns a region into a national flag. Hover over a badge to see the location text X reports.

## How it works

GeoX runs only on `x.com` and `twitter.com`. It uses X's `AboutAccountQuery` endpoint to look up the location of names that are visible on the page. These requests are read-only and use the session you are already signed in with.

To keep lookups slow and predictable, GeoX:

- queues only names that have been visible in an active tab for at least 800 ms
- looks up the open profile first, then post authors, then suggested accounts
- runs one lookup at a time across all X tabs, at least 10 seconds apart
- makes no more than 30 automatic lookups in any 15-minute window
- leaves the final five requests of X's reported allowance for normal browsing
- pauses after errors and rate-limit responses
- drops names that scroll off screen before they are looked up
- pauses automatic lookups on About pages, and saves the results of X's own About requests

These limits are cautious defaults chosen by GeoX. They are not X's published limits.

Results are cached locally and shared between tabs:

- Known locations stay cached across refreshes and browser restarts, with no automatic expiry.
- Accounts with no reported location are checked again after 24 hours.
- Failed lookups are not cached.

The toolbar popup shows how many usernames are cached and when new lookups are paused.

## Privacy

- The only browser permission GeoX requests is `storage`.
- GeoX connects only to X. It has no analytics, telemetry, backend or external location service.
- Authentication headers stay in page memory. GeoX does not log them, save them or send them anywhere else.
- Browser storage holds usernames, reported locations, lookup times and request scheduling state. This data stays in the browser profile.
- Removing the extension removes its stored data.

See [PRIVACY.md](PRIVACY.md) for the full privacy statement.

## Limitations

- GeoX requires a signed-in X session.
- GeoX uses an internal X API. If X changes it, lookups can stop working. If X sends an updated `AboutAccountQuery` request while a page is open, GeoX switches to that request.
- X's reported location can be approximate.
- Cached locations can become outdated if an account changes its location or a username passes to a new owner.
- Lookups that are already running cannot be cancelled. X can still rate-limit your normal browsing.

## Troubleshooting

**No badges appear**
Check that you are signed in to X, that GeoX is enabled at `chrome://extensions`, and that you loaded the `extension/` folder. Refresh the X tab after installing or reloading the extension.

**Some names have no badge**
The lookup may still be queued. With the default limits, a busy timeline can take several minutes to fill in. Some accounts have no location reported by X, and these have no badge until X reports a recognized location.

**The popup says lookups are paused**
GeoX has hit its own limit, X's reported allowance, or an error. It continues automatically after the time shown, and cached badges keep working in the meantime.

**Flags show as letter pairs**
Flag emoji rendering depends on your system and fonts. If flag emoji are unsupported, a country badge may appear as a two-letter code.

## Development

Requires Node.js 20 or newer. The extension has no build step: `extension/` is the complete unpacked extension.

```sh
npm ci
npm test
```

Tests use jsdom and synthetic fixtures. They do not use browser profiles or real account data. GitHub Actions runs the tests on every push and pull request.

| Path | Contents |
| --- | --- |
| `extension/manifest.json` | Extension manifest |
| `extension/content.js` | Finds names on the page, requests lookups and shows badges |
| `extension/cache.js` | Bridge between the page and extension storage |
| `extension/background.js` | Service worker that coordinates lookups across tabs |
| `extension/scheduler.js` | Request scheduling and rate-limit rules |
| `extension/countries.js` | Turns location names into flags and region emoji |
| `extension/popup.html`, `extension/popup.js` | Toolbar popup |
| `test/` | Node test suite |

After changing the source, select reload on the GeoX card at `chrome://extensions`, then refresh X.

To share a packaged build, make a ZIP of the contents of `extension/`, so that `manifest.json` is at the top level of the ZIP.

When reporting an issue, do not attach browser profiles, storage exports, cookies, request captures or screenshots that show account information.

## Acknowledgements

GeoX is an independent implementation. These sources were used as references:

- Chrome's [content scripts documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- The endpoint and response format in [`pageScript.js`](https://github.com/RhysSullivan/twitter-account-location-in-username/blob/main/pageScript.js) from twitter-account-location-in-username

## License

GeoX is released under the [MIT License](LICENSE).
