# Ulam?

A mobile-first, offline meal-planning PWA. Phase 4 completes the local product loop in a clearly labeled development preview with two sample recipes; it is not the 600-recipe release catalog.

Requires Node.js 22.18 or newer and npm (tested with Node.js 24.4.1 and npm 11.4.2).

```powershell
npm ci
npm test
npm run check
npm run build
npm run test:browser
npm run preview
```

Open the preview URL, choose **Download for offline use**, and wait for **Ready offline**. Browse and filter by dish, aliases or ingredients; plan a Monday-based week; accept local suggestions; save and preview reusable templates; shop from scaled groceries; create or remix recipes; and cook step by step with a saved timer. Settings stores default portions and explains local storage, installation and download repair. All of these flows work offline after setup.

Planned meals and cooking sessions keep their recipe snapshots, so later edits and archiving preserve saved content. Template application previews replacements and skips unavailable recipes; all accepted writes commit together. Grocery quantities use exact rational arithmetic, merge compatible canonical ingredients and forms, and preserve checks only for unchanged quantities. Mass and volume never merge; volume uses 5 ml teaspoons, 15 ml tablespoons and 240 ml cups. Local ingredient labels and unknown units stay separate. Timers show expiry inside the app when reopened; no background notification is promised.

`npm run dev` builds and serves the same offline-capable preview; restart it after editing source. Testing against the built app avoids development-server behavior masquerading as offline support. Browser tests start their own production preview, use an isolated Chromium profile and require a local Chrome/Chromium executable. Set `CHROME_PATH` if automatic detection cannot find it. Screenshots and local test evidence are excluded from Git.

Builds validate fixture content and image hashes, emit immutable catalog and shell snapshot paths, and generate a service worker that verifies shell files. Catalog activation occurs only after verified downloads. IndexedDB schema 3 adds local recipes, drafts, preferences, templates, shopping progress and cooking sessions; it upgrades existing schema 2 plans with pinned content. Failed migrations and multi-record writes roll back. Guest data stays separate from disposable download caches. Updates wait for older clients to close, and old caches and snapshots are retained for now.

Deployment requires a static HTTPS origin at the site root (localhost works for development), correct JavaScript/service-worker and manifest MIME types, and an app-navigation fallback to `index.html`. Retain earlier `/assets/`, `/shell/` and `/catalog/` release files needed by existing clients. Serve `sw.js` and the catalog manifest with revalidation. This repository push does not deploy a hosted site.

Fixtures in `tests/fixtures` contain original AI-assisted development drafts and illustrations with provenance; no production editorial, kitchen or rights approval is claimed. Release catalog production, full-catalog update hardening and release validation remain later phases. Physical Android/iPhone and manual assistive-technology tests remain deferred; Chromium emulation and automated accessibility checks do not prove those platforms. Clearing browser site data removes guest work; there is no cloud backup.

Agent instructions, the Obsidian vault and `docs/evidence/` are maintained locally and excluded from Git.
