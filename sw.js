const SHELL_CACHE="creditflex-shell-v2";
const RUNTIME_CACHE="creditflex-runtime-v1";
const APP_URLS=["/"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll(APP_URLS)).then(()=>self.skipWaiting()));
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
 event.respondWith((async()=>{
  const cache=await caches.open(sameOrigin?SHELL_CACHE:RUNTIME_CACHE);
  try{
   const response=await fetch(event.request);
   if(response&&response.ok)cache.put(event.request,response.clone()).catch(()=>{});
   return response;
  }catch(error){
   const cached=await cache.match(event.request);
   if(cached)return cached;
   if(sameOrigin&&event.request.mode==="navigate")return (await caches.open(SHELL_CACHE)).match("/");
   throw error;
  }
 })());
});