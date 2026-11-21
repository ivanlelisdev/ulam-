const SHELL_CACHE = 'ulam-shell-__VERSION__';
const SHELL_FILES = __FILES__;
const CATALOG_CACHE = 'ulam-catalog-v1';
async function matches(response, checksum) {
  if (!response?.ok) return false;
  const bytes = await response.clone().arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2,'0')).join('') === checksum;
}
async function readShell(path) {
  const entry = SHELL_FILES.find(file => file.path === path);
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(path);
  if (await matches(cached, entry.sha256)) return cached;
  const response = await fetch(entry.url, {cache:'no-store'});
  if (!await matches(response,entry.sha256)) throw new Error('Shell verification failed');
  await cache.put(path,response.clone());
  return response;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {for (const entry of SHELL_FILES) await readShell(entry.path);})());
});
// Wait for old clients to close before activating an update.
// shortcut: retain old shell caches, add client-aware cleanup during release hardening.
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data === 'CHECK_SHELL' || event.data === 'REPAIR_SHELL') event.waitUntil((async () => {
    try {
      if (event.data === 'REPAIR_SHELL') for (const entry of SHELL_FILES) await readShell(entry.path);
      const cache = await caches.open(SHELL_CACHE);
      const present = await Promise.all(SHELL_FILES.map(async entry => matches(await cache.match(entry.path),entry.sha256)));
      event.ports[0]?.postMessage(present.every(Boolean));
    } catch { event.ports[0]?.postMessage(false); }
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' && !url.pathname.startsWith('/catalog/')) {
    event.respondWith(readShell('/index.html'));
  } else if (SHELL_FILES.some(file => file.path === url.pathname)) {
    event.respondWith(readShell(url.pathname));
  } else if (/^\/catalog\/dev-[a-z0-9-]+\//.test(url.pathname)) {
    event.respondWith(caches.open(CATALOG_CACHE).then(async cache => await cache.match(event.request) || fetch(event.request)));
  }
});
