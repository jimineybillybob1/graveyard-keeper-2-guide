# Cloud saves

In **Save & sync**, create a code on the device holding your progress and choose **Save to cloud**. Keep the code privately. On another device, enter it, choose **Use this code**, then **Load from cloud**. Use the same published guide address on each device.

Local changes save automatically. Cloud uploads and downloads are manual. Returning to the guide or reconnecting checks for updates but never silently uploads or replaces local progress. If both copies changed, compare them and choose which to keep. This synchronizes the guide's calendar, milestones, technology unlock marks, purchased inspiration levels, quests, favourites, catches, visited places, crafting list, notes and spoiler setting—not the game's own save files.

## Recovery

Loading a different cloud copy first keeps a local recovery backup. Five local backups and eight previous uploaded cloud versions are available under **Recovery & cloud storage**. Restoring history changes this device first; choose Save to cloud to share the restored copy. File export remains available independently.

**Forget on this device** removes the remembered code without deleting local progress or the cloud copy. **Delete cloud copy & history** permanently removes the cloud record and its recovery versions, leaving local progress intact. Copies on other devices remain. Clearing browser storage also removes the remembered code and local recovery backups. There is no email account or lost-code recovery.

## Security and storage

Codes contain 120 random bits, displayed in six groups. Browser Web Crypto uses HKDF-SHA-256 with distinct labels to derive the storage locator, authorization token and AES-256-GCM key. The private code and encryption key are never sent to the Worker. The Worker receives ciphertext and a separate bearer authorization token; it stores a hash of that token. The public endpoint is not a secret. Keep the code private: it grants access, including deletion. The code is remembered in browser local storage for convenience, so a person with access to that browser can retrieve it.

Each save lives in a dedicated SQLite-backed Durable Object. Transactional revision checks reject simultaneous stale writes with HTTP 409. Timestamps are informational. Requests are limited to 768 KiB and production browser origins are restricted to the guide's GitHub Pages origin. Origin restrictions supplement authentication; they do not replace it. Encrypted saves remain until deleted. This service has no account-recovery, sharing or automatic merge feature.

## Maintenance

The static frontend is published from main on GitHub Pages. Deploy the service separately from `sync-worker/` using Node 22 or newer: `npm ci`, `npx wrangler login` if needed, then `npm run deploy`. Wrangler uses the signed-in Cloudflare account; no account token belongs in the repository. Configuration declares the `LedgerSave` SQLite Durable Object and allowed origin. `sync-config.js` contains the resulting public Worker URL. Do not rename the Worker or binding without planning a storage migration.

For local service testing use `npm run dev -- --port 8787 --var ALLOWED_ORIGINS:http://127.0.0.1:4173`. Point a local frontend at that endpoint only for testing; do not publish it. The production service intentionally does not allow the local preview origin.

Verification covers encryption round trips, wrong-code rejection, authorization, simultaneous writes, history retention, stale deletion, two independent browser contexts, conflict detection, recovery backups, and iPad-sized layouts in Chromium. Physical iPad Safari has not been tested.
