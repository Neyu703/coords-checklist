const CACHE="coords-v2";
const SHELL=["./","index.html","vendor/base-css/base.css","style.css","app.js","data.json","manifest.webmanifest","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

// network first so a deploy shows up on the next open; cache is the offline/slow-network fallback
const NETWORK_TIMEOUT_MS=4000;

const fromNetwork=req=>Promise.race([
  fetch(req,{cache:"no-cache"}),
  new Promise((_,reject)=>setTimeout(()=>reject(new Error("timeout")),NETWORK_TIMEOUT_MS))
]);

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET"||new URL(req.url).origin!==location.origin)return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const res=await fromNetwork(req);
      if(res.ok)cache.put(req,res.clone());
      return res;
    }catch(err){
      return (await cache.match(req,{ignoreSearch:true}))||(await cache.match("index.html"))||Response.error();
    }
  })());
});
