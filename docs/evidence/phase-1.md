# Phase 1: project establishment

Status: **complete for the requested establishment phase**. On 2026-11-22 the project owner deferred physical-device tests and requested browser DevTools-style emulation for now. This does not waive the later physical-device release and milestone gates in [[ROADMAP]] and [[OFFLINE-STRATEGY]].

## Scope and workflow

- Application root: `D:\ulam-app`; vault: `Ulam/`. Git is initialized on `main` and `origin` points to the project GitHub repository. Commit source, documentation and the lockfile; use branches and review changes before merging. `.gitignore` excludes dependencies, builds, temporary tests, npm cache and local Obsidian workspace state.
- Node.js 24.4.1 and npm 11.4.2 were used. Vite requires Node.js `^20.19.0 || >=22.12.0`. The root README documents install, development, check, build and preview commands. Build, test and release evidence belongs under `docs/evidence/`.
- The static React, Vite and TypeScript scaffold has strict TypeScript checking and no backend or remote runtime services. It is a starting screen, not an offline-ready app. No domain or guest data logic is implemented.
- `npm ci`, `npm run check` and `npm run build` passed in a separate clean copy of the application inputs; preview returned HTTP 200. A clean Git checkout is verified separately during publication. The static build produced 0.44 kB HTML, 0.82 kB CSS and 220.10 kB JS before gzip; these are baseline measurements, not budgets.

## Browser evaluation, 2026-11-22

- Headless Chrome with Pixel 7 emulation rendered the application heading at a 412 CSS-pixel viewport with no horizontal overflow. This is a basic layout check, not a full accessibility audit or physical-device validation.
- A disposable Dexie/IndexedDB browser spike upgraded a populated version 1 database to version 2 while preserving its record. An intentionally failed transaction rolled back both writes; a deliberately failed version 3 migration was reported and preserved existing version 2 data. No production guest data was involved. Blocked upgrades, quota failures and mobile browser differences remain later tests.
- A separate Workbox-generated service worker precached an isolated page, which reloaded successfully with the browser context set offline. This demonstrates basic precaching only; it does not validate Ulam's staged catalog, update safety, asset retention or interrupted setup. The temporary Workbox tooling's npm audit reported three moderate vulnerabilities; it is isolated and not part of the application dependency lockfile.
- Native IndexedDB and a custom service worker remain alternatives. See [[DECISIONS]] D-004 for the provisional recommendation and why the final architecture decision is deferred until milestone 1. See [Dexie blocked upgrades](https://dexie.org/docs/Dexie/Dexie.on.blocked) and [Workbox precaching](https://developer.chrome.com/docs/workbox/modules/workbox-precaching).
- The [device test log](device-test-log.md) records the available Android device and pending coverage. Supported OS and browser versions remain open.

## Later milestone and release work

The broader milestone 1 still requires an actual offline vertical slice, interrupted setup recovery, migration and update coverage, a final architecture decision and physical iOS and Android cold-launch evidence. The user has deferred physical tests for now; browser emulation is not evidence of device behavior. Full accessibility, quota and concurrent-tab testing also remain.
