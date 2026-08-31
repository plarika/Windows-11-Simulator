"use strict";
const CACHE_NAME="win11-simulator-v8.6.0";
const PRECACHE=[
  "./",
  "./index.html",
  "./favicon.svg?v=8.1.0",
  "./manifest.webmanifest?v=8.1.0",
  "./styles/base.css?v=8.1.0",
  "./styles/system-v4.css?v=8.1.0",
  "./styles/system-suite-v5.css?v=8.1.0",
  "./styles/realism-v62.css?v=8.1.0",
  "./styles/app-realism-v63.css?v=8.1.0",
  "./styles/real-files-v640.css?v=8.1.0",
  "./styles/real-clipboard-v650.css?v=8.1.0",
  "./styles/real-content-v660.css?v=8.1.0",
  "./styles/real-platform-v660.css?v=8.1.0",
  "./styles/local-accounts-v670.css?v=8.1.0",
  "./styles/real-device-tools-v680.css?v=8.1.0",
  "./styles/desktop-integration-v700.css?v=8.1.0",
  "./styles/real-folder-mounts-v710.css?v=8.1.0",
  "./styles/edge-internet-v720.css?v=8.1.2",
  "./styles/edge-advanced-v730.css?v=8.1.0",
  "./styles/explorer-pro-v740.css?v=8.1.0",
  "./styles/explorer-navigation-v820.css?v=8.3.0",
  "./styles/explorer-details-v840.css?v=8.4.0",
  "./styles/explorer-context-v850.css?v=8.5.0",
  "./styles/explorer-views-v860.css?v=8.6.0",
  "./styles/window-manager-v750.css?v=8.1.0",
  "./styles/real-device-integration-v760.css?v=8.1.0",
  "./styles/notifications-background-v770.css?v=8.1.0",
  "./styles/settings-security-v780.css?v=8.1.0",
  "./styles/shell-icons-v781.css?v=8.1.0",
  "./styles/system-tray-quick-v790.css?v=8.1.0",
  "./styles/windows-experience-v800.css?v=8.1.0",
  "./styles/start-search-taskbar-v810.css?v=8.1.0",
  "./src/core/runtime.js?v=8.1.0",
  "./src/features/system-v4.js?v=8.1.0",
  "./src/apps/v5-runtime.js?v=8.1.0",
  "./src/apps/explorer-v5.js?v=8.1.0",
  "./src/apps/settings-v5.js?v=8.1.0",
  "./src/apps/windows-tools.js?v=8.1.0",
  "./src/apps/services.js?v=8.1.0",
  "./src/apps/disk-management.js?v=8.1.0",
  "./src/apps/task-scheduler.js?v=8.1.0",
  "./src/apps/system-info.js?v=8.1.0",
  "./src/apps/resource-monitor.js?v=8.1.0",
  "./src/apps/powershell.js?v=8.1.0",
  "./src/apps/optional-features.js?v=8.1.0",
  "./src/apps/backup-recovery.js?v=8.1.0",
  "./src/apps/sticky-notes.js?v=8.1.0",
  "./src/apps/onedrive.js?v=8.1.0",
  "./src/apps/remote-desktop.js?v=8.1.0",
  "./src/apps/sound-recorder.js?v=8.1.0",
  "./src/apps/get-help.js?v=8.1.0",
  "./src/apps/shell-integration.js?v=8.1.0",
  "./src/apps/search-v5.js?v=8.1.0",
  "./src/features/realism-v62.js?v=8.1.0",
  "./src/features/app-realism-v63.js?v=8.1.0",
  "./src/features/real-files-v640.js?v=8.1.0",
  "./src/features/real-clipboard-v650.js?v=8.1.0",
  "./src/features/real-content-v660.js?v=8.1.0",
  "./src/features/real-platform-v660.js?v=8.1.0",
  "./src/features/local-accounts-v670.js?v=8.1.0",
  "./src/features/real-device-tools-v680.js?v=8.1.0",
  "./src/features/desktop-integration-v700.js?v=8.1.0",
  "./src/features/real-folder-mounts-v710.js?v=8.1.0",
  "./src/features/edge-internet-v720.js?v=8.1.2",
  "./src/features/edge-advanced-v730.js?v=8.1.2",
  "./src/features/explorer-pro-v740.js?v=8.2.1",
  "./src/features/explorer-navigation-v820.js?v=8.3.0",
  "./src/features/explorer-details-v840.js?v=8.4.0",
  "./src/features/explorer-context-v850.js?v=8.5.0",
  "./src/features/explorer-views-v860.js?v=8.6.0",
  "./src/features/window-manager-v750.js?v=8.1.0",
  "./src/features/real-device-integration-v760.js?v=8.1.0",
  "./src/features/notifications-background-v770.js?v=8.1.0",
  "./src/features/settings-security-v780.js?v=8.1.0",
  "./src/features/system-tray-quick-v790.js?v=8.1.0",
  "./src/features/windows-experience-v800.js?v=8.1.0",
  "./src/features/start-search-taskbar-v810.js?v=8.1.0",
  "./src/workers/auth-crypto-v673.js?v=8.1.0",
  "./src/core/boot.js?v=8.1.0",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(PRECACHE))
  );
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
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
