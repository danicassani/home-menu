import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
// Only build assets and public app icons enter Cache Storage. Supabase traffic never does.
export function pwa():Plugin{
 return {name:'home-menu-pwa',apply:'build',generateBundle(_options,bundle){
  const assets=Object.keys(bundle).filter(name=>/^assets\/.*\.(js|css)$/.test(name));
  const version=createHash('sha256').update(assets.join('|')).digest('hex').slice(0,16);
  this.emitFile({type:'asset',fileName:'sw.js',source:`
const CACHE='home-menu-shell-${version}';
const FILES=${JSON.stringify(['/',...assets.map(a=>'/'+a),'/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png','/icons/apple-touch-icon.png'])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('home-menu-shell-')&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/'))));return;
 }
 if(url.search||!FILES.includes(url.pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname,{ignoreVary:true}))||fetch(request)));
});
`});
 }};
}
