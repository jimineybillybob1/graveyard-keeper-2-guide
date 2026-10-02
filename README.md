# The Keeper’s Ledger

A personal Graveyard Keeper II companion, designed for touch use on an iPad. This is a static website published with GitHub Pages. Cloudflare provides optional encrypted cloud saves using a private sync code. No email account is needed.

**[Open the guide](https://jimineybillybob1.github.io/graveyard-keeper-2-guide/)**

## Open the guide

Open `index.html` in a browser, or serve this directory with any static web server. All application code, game icons and the world map are included. Typography uses Google Fonts when available, with system fallbacks.

For a predictable save location, keep using the same browser and address. The published link works on iPad and PC. Each browser stores its own progress; cloud save/load or export/import transfers it between devices. Progress from the local preview at `http://127.0.0.1:4173/` must be exported there and imported on the published site.

## Included

- Six-day planner with 13 progress milestones and conditional reminders.
- Searchable catalogue of 609 item records, ingredient links, uses and favourites.
- 509 recipe variants, cooking filters and a combined direct-ingredient crafting list.
- Actual world map, 51 waypoint records, touch-sized clusters, zoom, layers and visited markers.
- 18 character overviews (later characters can be hidden).
- Concise walkthrough routes for all four story chapters, with links to detailed source guides.
- 31 fishing rows, covering locations, bait, stock, day/night odds and catches.
- 243 quest stages with linked prerequisites; 98 have structured checks or hand-ins.
- Notes, local progress saving, JSON export/import and same-browser tab updates.

## Content boundaries

Data is a 2 October 2026 snapshot attributed to GK2DB, which reports game build `4599483364566526977`. Sources and per-record links are visible in the guide. The interface and chapter summaries are original; factual tables, coordinates, sprites and map art are attributed in Sources & coverage.

The source flags 118 item records as having no known source. 34 records have no supplied sprite. Of 509 crafting variants, 64 currently have a yield matched to the workstation tables; the remaining yields are explicitly unknown. Input quantities are taken from recipe tables. The planner counts **craft operations**, not a requested quantity of output, so unknown yields never become invented quantities. Perk modifiers are displayed but not applied. It sums immediate ingredients, not recursive raw materials or player inventory.

The catalogue also includes source-listed gathering operations with no ingredient cost. Those entries are not evidence that materials can be created for free at an ordinary bench.

The chapter routes are concise guidance, not a reproduction of the source walkthroughs. Dialogue and detailed quest conditions remain available through the links. No save-file reading or automatic in-game progress detection is implemented. Week/day are set manually.

Story visibility hides later quest stages and character cards. Item names, the physical map and planner milestones can reveal game systems. Full story visibility can be enabled in Save & settings.

## Saving and cloud sync

Local progress is stored under `keeper-ledger-v1`. Export a backup before importing, clearing browser data, changing the serving address or moving to a new device. Import validates the schema and asks before replacing progress. A backup is a guide progress file, not a Graveyard Keeper game save.

Open **Save & sync**, create a private code and select **Save to cloud**. On another device, enter the same code, select **Use this code**, then **Load from cloud**. Save before switching devices; loading and uploading are deliberate actions. The guide checks for updates on reopening or reconnecting but does not silently replace progress. Keep the code somewhere private: anyone with it can access or delete its cloud save, and a lost code cannot be recovered. Pokémon guide codes are separate. See [CLOUD_SYNC.md](CLOUD_SYNC.md) for operation and recovery details.

## GitHub Pages deployment

GitHub Pages publishes the root of the `main` branch in [this repository](https://github.com/jimineybillybob1/graveyard-keeper-2-guide). Push updates to `main` to publish changes. The frontend needs no build step or secret. Cloud saves use a separately deployed Cloudflare Worker; its public endpoint is in sync-config.js. Navigation uses URL hashes, so repository subpaths and reloads work. `.nojekyll` is included. The game art and source-data attribution are retained in the guide; they are not covered by a new blanket open-source licence.

## Verification

Browser checks covered every section, iPad landscape (1194×834), iPad portrait (834×1194), and narrow mobile layouts; item search/details, favourites, crafting inputs, calendar gating, reload persistence, map clusters and visited markers were exercised. Tested in Chromium/Edge with iPad-sized viewports, not on physical iPad Safari.

Export/import round trips, malformed-file rejection, chapter visibility and the twins’ six-plate quest requirement also passed. Optional WebMCP item-search and milestone-update tools are feature-detected; a supported browser context was not available for native registration validation.

## Files

- `index.html`, `style.css`, `app.js`: website.
- `data.js`: structured factual snapshot; item IDs and quest IDs follow the source.
- `chapters.js`: concise chapter routes.
- `assets/`: locally stored map and game icons.

Unofficial fan project. Graveyard Keeper II and its assets belong to their respective owners, including Lazy Bear Games and tinyBuild. Source data and coordinates: https://gk2db.org/.
