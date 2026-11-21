import { z } from 'zod';
import { activateCatalog, getActiveCatalog, type UlamDatabase } from './data/database';
import { validateCatalog } from './data/schema';

export const ASSET_CACHE = 'ulam-catalog-v1';
async function shellReady(repair = false): Promise<boolean> {
  const controller = navigator.serviceWorker.controller;
  if (!controller) return false;
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); resolve(false); }, repair ? 30000 : 3000);
    channel.port1.onmessage = event => { clearTimeout(timeout); channel.port1.close(); resolve(event.data === true); };
    controller.postMessage(repair ? 'REPAIR_SHELL' : 'CHECK_SHELL', [channel.port2]);
  });
}
const file = z.object({ path: z.string().regex(/^catalog\/[a-z0-9-]+\/[a-z0-9.-]+$/), sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive() }).strict();
const manifestSchema = z.object({ shellVersion: z.literal(1), releaseId: z.string().regex(/^dev-slice-[a-f0-9]{12}$/), catalog: file, images: z.array(file).min(1) }).strict();
type Asset = z.infer<typeof file>;
export async function verified(response: Response, asset: Asset): Promise<boolean> {
  if (!response.ok) return false;
  const bytes = await response.clone().arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
  return bytes.byteLength === asset.bytes && hash === asset.sha256;
}
async function getAsset(cache: Cache, asset: Asset): Promise<Response> {
  const cached = await cache.match(`/${asset.path}`);
  if (cached && await verified(cached, asset)) return cached;
  await cache.delete(`/${asset.path}`);
  const response = await fetch(`/${asset.path}`, { cache: 'no-store' });
  if (!await verified(response, asset)) throw new Error('A downloaded file failed verification. Please retry.');
  await cache.put(`/${asset.path}`, response.clone());
  return response;
}
export async function prepareOffline(db: UlamDatabase, progress: (message: string) => void) {
  if (!await shellReady() && !await shellReady(true)) throw new Error('The app shell needs repair. Reconnect and reload the app, then retry.');
  const response = await fetch('/catalog/manifest.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not download the recipe manifest. Please retry online.');
  const manifest = manifestSchema.parse(await response.json());
  if (manifest.catalog.path !== `catalog/${manifest.releaseId}/catalog.json` || manifest.images.some(image => !image.path.startsWith(`catalog/${manifest.releaseId}/`))) throw new Error('Catalog manifest has incompatible release paths.');
  const cache = await caches.open(ASSET_CACHE);
  const size = Math.ceil((manifest.catalog.bytes + manifest.images.reduce((sum,image) => sum + image.bytes,0)) / 1024);
  progress(`Downloading catalog · ${size} KB total…`);
  const catalogResponse = await getAsset(cache, manifest.catalog);
  const catalog = validateCatalog(await catalogResponse.json());
  if (catalog.releaseId !== manifest.releaseId || catalog.images.length !== manifest.images.length) throw new Error('Catalog and manifest do not match.');
  for (const [index, image] of catalog.images.entries()) {
    const asset = manifest.images.find(item => item.path === image.path);
    if (!asset || asset.sha256 !== image.sha256 || asset.bytes !== image.byteLength) throw new Error('Image manifest does not match catalog.');
    progress(`Downloading images ${index + 1} of ${catalog.images.length} · ${size} KB total…`);
    await getAsset(cache, asset);
  }
  await activateCatalog(db, catalog);
  return catalog;
}
export async function isReady(db: UlamDatabase): Promise<boolean> {
  if (!await shellReady()) return false;
  const catalog = await getActiveCatalog(db);
  if (!catalog) return false;
  const cache = await caches.open(ASSET_CACHE);
  for (const image of catalog.images) {
    const response = await cache.match(`/${image.path}`);
    if (!response || !await verified(response, { path: image.path, sha256: image.sha256, bytes: image.byteLength })) return false;
  }
  return true;
}
