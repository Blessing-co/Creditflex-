const SHELL_CACHE="creditflex-shell-v13";
const RUNTIME_CACHE="creditflex-runtime-v2";
const APP_URLS=["/","/styles.css","/app.js","/quick.js","/social.js","/vendor/supabase.js","/manifest.webmanifest","/icons/icon-192.png","/icons/apple-touch-icon.png"];
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

self.addEventListener("push",event=>{
 let d={};try{d=event.data?event.data.json():{};}catch(e){d={title:"Creditflex",body:event.data?event.data.text():""};}
 event.waitUntil(self.registration.showNotification(d.title||"Creditflex",{body:d.body||"",icon:"/icons/icon-192.png",badge:"/icons/icon-192.png",tag:"creditflex-announcement",renotify:true,data:{url:d.url||"/"}}));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const all=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  for(const c of all){if("focus" in c){await c.focus();return;}}
  if(self.clients.openWindow)await self.clients.openWindow((event.notification.data&&event.notification.data.url)||"/");
 })());
});
