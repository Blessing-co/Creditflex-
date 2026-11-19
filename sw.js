const SHELL_CACHE="creditflex-shell-v8";
const RUNTIME_CACHE="creditflex-runtime-v2";
const APP_URLS=["/","/styles.css","/app.js","/extras.js","/bulk.js","/legal.js","/vendor/supabase.js","/manifest.webmanifest","/icons/icon-192.png","/icons/apple-touch-icon.png"];
const WARM_URLS=[];
self.addEventListener("install",event=>{
 event.waitUntil((async()=>{
  const shell=await caches.open(SHELL_CACHE);
  await shell.addAll(APP_URLS);
  const runtime=await caches.open(RUNTIME_CACHE);
  await Promise.all(WARM_URLS.map(async url=>{
   try{const request=new Request(url,{mode:"no-cors"});const response=await fetch(request);if(response)await runtime.put(request,response);}catch(error){/* The normal online request will populate this cache later. */}
  }));
  await self.skipWaiting();
 })());
});
self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith("creditflex-")&&![SHELL_CACHE,RUNTIME_CACHE].includes(k)).map(k=>caches.delete(k)));await self.clients.claim();})());
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 const sameOrigin=url.origin===self.location.origin;
 const cacheableExternal=["cdn.jsdelivr.net","fonts.googleapis.com","fonts.gstatic.com"].includes(url.hostname);
 if(!sameOrigin&&!cacheableExternal)return;
 // Stale-while-revalidate: show the saved copy at once (fast on weak internet), refresh it quietly in the background.
 event.respondWith((async()=>{
  const cache=await caches.open(sameOrigin?SHELL_CACHE:RUNTIME_CACHE);
  const cached=await cache.match(event.request,{ignoreSearch:sameOrigin});
  const refresh=fetch(event.request).then(r=>{if(r&&(r.ok||r.type==="opaque"))cache.put(event.request,r.clone()).catch(()=>{});return r;});
  if(cached){refresh.catch(()=>{});return cached;}
  try{return await refresh;}catch(error){
   if(sameOrigin&&event.request.mode==="navigate"){const home=await cache.match("/");if(home)return home;}
   throw error;
  }
 })());
});
