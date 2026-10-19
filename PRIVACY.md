# Privacy

GeoX runs on x.com and twitter.com. It makes read-only requests to X using the signed-in session. Authentication headers remain in page memory; GeoX does not write them to browser storage or send them to another service.

The extension stores usernames, X-reported account locations, lookup timestamps, and request scheduling state in extension-local browser storage. This cache is shared between X tabs in the same browser profile. Known locations remain cached without automatic expiry; missing results are retried after 24 hours. Locations may be approximate or stale.

GeoX has no analytics, telemetry, remote backend, or external location service. It uses X's account information rather than inferring location from names or biographies. Development dependencies are used only for tests and are not included in the extension.

Removing the extension removes its extension-local data. Do not include browser profiles, storage exports, session cookies, request captures, or screenshots containing account information in issues or pull requests. Tests use synthetic fixtures rather than exported browsing data.
