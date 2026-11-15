const SHELL_CACHE="creditflex-shell-v3";
const RUNTIME_CACHE="creditflex-runtime-v2";
const APP_URLS=["/"];
const WARM_URLS=["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"];
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