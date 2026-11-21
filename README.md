# Ulam?

A mobile-first, offline meal-planning PWA. The current vertical slice is a clearly labeled development preview with two sample recipes; it is not the 600-recipe release catalog.

Requires Node.js 22.18 or newer and npm (tested with Node.js 24.4.1 and npm 11.4.2).

```powershell
npm ci
npm test
npm run check
npm run build
npm run test:browser
npm run preview
```

Open the preview URL, choose **Download for offline use**, and wait for **Ready offline**. Browse or search by dish and ingredient aliases, view a recipe and save it to a day, meal and serving count. Reopen the preview offline to use the cached shell, images and plan. Settings explains local storage, installation and download repair.

`npm run dev` builds and serves the same offline-capable preview; restart it after editing source. Testing against the built app avoids development-server behavior masquerading as offline support. Browser tests start their own production preview, use an isolated Chromium profile and require a local Chrome/Chromium executable. Set `CHROME_PATH` if automatic detection cannot find it. Screenshots and local test evidence are excluded from Git.

Builds validate fixture content and image hashes, emit immutable catalog and shell snapshot paths, and generate a service worker that verifies shell files. Catalog activation occurs only after verified downloads. Guest plans remain in separate IndexedDB stores. Updates wait for older clients to close, and old caches and snapshots are retained for now.

Deployment requires a static HTTPS origin at the site root (localhost works for development), correct JavaScript/service-worker and manifest MIME types, and an app-navigation fallback to `index.html`. Retain earlier `/assets/`, `/shell/` and `/catalog/` release files needed by existing clients. Serve `sw.js` and the catalog manifest with revalidation. This repository push does not deploy a hosted site.

Fixtures in `tests/fixtures` contain original AI-assisted development drafts and illustrations with provenance; no production editorial, kitchen or rights approval is claimed. Grocery generation and the remaining product loop are later work. Physical Android/iPhone tests remain deferred; Chromium emulation does not prove those platforms.

Agent instructions, the Obsidian vault and `docs/evidence/` are maintained locally and excluded from Git.
