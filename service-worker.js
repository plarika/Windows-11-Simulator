"use strict";
const CACHE_NAME="win11-simulator-v6.6.0";
const PRECACHE=[
  "./",
  "./index.html",
  "./favicon.svg?v=6.6.0",
  "./manifest.webmanifest?v=6.6.0",
  "./styles/base.css?v=6.6.0",
  "./styles/system-v4.css?v=6.6.0",
  "./styles/system-suite-v5.css?v=6.6.0",
  "./styles/realism-v62.css?v=6.6.0",
  "./styles/app-realism-v63.css?v=6.6.0",
  "./styles/real-files-v640.css?v=6.6.0",
  "./styles/real-clipboard-v650.css?v=6.6.0",
  "./styles/real-content-v660.css?v=6.6.0",
  "./styles/real-platform-v660.css?v=6.6.0",
  "./src/core/runtime.js?v=6.6.0",
  "./src/features/system-v4.js?v=6.6.0",
  "./src/apps/v5-runtime.js?v=6.6.0",
  "./src/apps/explorer-v5.js?v=6.6.0",
  "./src/apps/settings-v5.js?v=6.6.0",
  "./src/apps/windows-tools.js?v=6.6.0",
  "./src/apps/services.js?v=6.6.0",
  "./src/apps/disk-management.js?v=6.6.0",
  "./src/apps/task-scheduler.js?v=6.6.0",
  "./src/apps/system-info.js?v=6.6.0",
  "./src/apps/resource-monitor.js?v=6.6.0",
  "./src/apps/powershell.js?v=6.6.0",
  "./src/apps/optional-features.js?v=6.6.0",
  "./src/apps/backup-recovery.js?v=6.6.0",
  "./src/apps/sticky-notes.js?v=6.6.0",
  "./src/apps/onedrive.js?v=6.6.0",
  "./src/apps/remote-desktop.js?v=6.6.0",
  "./src/apps/sound-recorder.js?v=6.6.0",
  "./src/apps/get-help.js?v=6.6.0",
  "./src/apps/shell-integration.js?v=6.6.0",
  "./src/apps/search-v5.js?v=6.6.0",
  "./src/features/realism-v62.js?v=6.6.0",
  "./src/features/app-realism-v63.js?v=6.6.0",
  "./src/features/real-files-v640.js?v=6.6.0",
  "./src/features/real-clipboard-v650.js?v=6.6.0",
  "./src/features/real-content-v660.js?v=6.6.0",
  "./src/features/real-platform-v660.js?v=6.6.0",
  "./src/core/boot.js?v=6.6.0",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(PRECACHE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(req.mode==="navigate"){
    event.respondWith(
      fetch(req)
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put("./index.html",copy));
          return res;
        })
        .catch(()=>caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached=>{
      if(cached)return cached;
      return fetch(req).then(res=>{
        if(res&&res.ok){
          const copy=res.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(req,copy));
        }
        return res;
      });
    })
  );
});
