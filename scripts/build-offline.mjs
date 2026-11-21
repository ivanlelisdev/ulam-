import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fixtureCatalog } from '../tests/fixtures/catalog.ts';
import { validateCatalog } from '../src/data/schema.ts';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const releaseId = 'dev-slice-' + hash(Buffer.from(JSON.stringify(fixtureCatalog))).slice(0, 12);
const dir = `dist/catalog/${releaseId}`;
await mkdir(dir, {recursive:true});
const catalog = structuredClone(fixtureCatalog);
catalog.releaseId = releaseId;
for (const image of catalog.images) {
  const source = image.path;
  const name = source.split('/').at(-1);
  const bytes = await readFile(source);
  if (hash(bytes) !== image.sha256 || bytes.length !== image.byteLength) throw new Error(`Fixture image checksum mismatch: ${source}`);
  image.path = `catalog/${releaseId}/${name}`;
  await copyFile(source, `dist/${image.path}`);
}
const bytes = Buffer.from(JSON.stringify(validateCatalog(catalog)));
await writeFile(`${dir}/catalog.json`, bytes);
await writeFile('dist/catalog/manifest.json', JSON.stringify({shellVersion:1,releaseId,catalog:{path:`catalog/${releaseId}/catalog.json`,sha256:hash(bytes),bytes:bytes.length},images:catalog.images.map(image=>({path:image.path,sha256:image.sha256,bytes:image.byteLength}))}));
await mkdir('dist/icons',{recursive:true});
for (const [name,background] of [['icon','#faf7ef'],['maskable','#205c43']]) {
  await writeFile(`dist/icons/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="64" fill="${background}"/><text x="256" y="340" font-size="300" font-family="Georgia,serif" text-anchor="middle" fill="${name==='icon'?'#205c43':'#ffffff'}">u?</text></svg>`);
}
await writeFile('dist/manifest.webmanifest', JSON.stringify({id:'/',name:'Ulam?',short_name:'Ulam?',start_url:'/',scope:'/',display:'standalone',background_color:'#faf7ef',theme_color:'#205c43',icons:[{src:'/icons/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'},{src:'/icons/maskable.svg',sizes:'any',type:'image/svg+xml',purpose:'maskable'}]}));
const { readdir } = await import('node:fs/promises');
const files = ['/index.html','/manifest.webmanifest','/icons/icon.svg','/icons/maskable.svg', ...(await readdir('dist/assets')).filter(name=>/\.(js|css)$/.test(name)).map(name=>`/assets/${name}`)];
const shellBytes = await Promise.all(files.map(path=>readFile(`dist${path}`)));
const version = hash(Buffer.concat(shellBytes)).slice(0,16);
const entries = [];
for (const [index,path] of files.entries()) {
  const url = `/shell/${version}${path}`;
  await mkdir(`dist${url.slice(0,url.lastIndexOf('/'))}`,{recursive:true});
  await writeFile(`dist${url}`,shellBytes[index]);
  entries.push({path,url,sha256:hash(shellBytes[index])});
}
const worker = (await readFile('scripts/service-worker.js','utf8')).replace('__VERSION__',version).replace('__FILES__',JSON.stringify(entries));
await writeFile('dist/sw.js',worker);
console.log(`Offline shell: ${files.length} files; development catalog: ${catalog.recipes.length} fixtures`);
