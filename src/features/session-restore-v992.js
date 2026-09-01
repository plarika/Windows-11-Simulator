"use strict";
(function installSessionRestoreV992(){
  const VERSION="9.9.3";
  const SCHEMA_VERSION=2;
  const MAX_WINDOWS=24;
  const MAX_PER_APP_DESKTOP=4;
  const MAX_AGE_MS=30*24*60*60*1000;
  const bus=globalThis.Win11SystemBus;
  const sessions=globalThis.Win11AppSessions;
  const previousRenderSettingsPage=globalThis.renderSettingsPageV5;
  if(!bus||!sessions||typeof previousRenderSettingsPage!=="function"){
    throw new Error("Session Restore V9.9.2 requires System Bus, App Sessions and Settings.");
  }

  const SAFE_EXPLORER_PATHS=new Set([
    "This PC","C:/Desktop","C:/Documents","C:/Downloads","C:/Pictures",
    "C:/Music","C:/Videos","C:/OneDrive","Recycle Bin"
  ]);
  let captureTimer=0;
  let restoring=false;
  let rerenderPending=false;
  let lastRestoreFingerprint="";
  let lastRestoreCompletedAt=0;
  const DUPLICATE_RESTORE_MS=2200;

  function clone(value){
    try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}
  }
  function blankState(enabled=false){
    return {schemaVersion:SCHEMA_VERSION,enabled:Boolean(enabled),savedAt:0,sessions:[],lastRestoreAt:0,lastRestored:0};
  }
  function ensureState(){
    const raw=state.appSessionRestoreV992;
    if(!raw||typeof raw!=="object"||Array.isArray(raw))state.appSessionRestoreV992=blankState(false);
    const s=state.appSessionRestoreV992;
    s.schemaVersion=SCHEMA_VERSION;
    s.enabled=Boolean(s.enabled);
    s.savedAt=Number.isFinite(Number(s.savedAt))?Math.max(0,Number(s.savedAt)):0;
    s.lastRestoreAt=Number.isFinite(Number(s.lastRestoreAt))?Math.max(0,Number(s.lastRestoreAt)):0;
    s.lastRestored=Number.isFinite(Number(s.lastRestored))?Math.max(0,Math.trunc(Number(s.lastRestored))):0;
    s.sessions=Array.isArray(s.sessions)?s.sessions.slice(0,MAX_WINDOWS):[];
    return s;
  }

  function validDesktop(value){
    const max=Math.max(0,(Array.isArray(state.desktops)?state.desktops.length:1)-1);
    return Math.max(0,Math.min(max,Math.trunc(Number(value)||0)));
  }
  function finite(value,fallback=0){
    const n=Number.parseFloat(String(value??""));
    return Number.isFinite(n)?n:fallback;
  }
  function bound(value,min,max){
    if(max<min)return Math.max(0,max);
    return Math.max(min,Math.min(max,value));
  }
  function parsedRect(raw){
    try{
      const value=typeof raw==="string"?JSON.parse(raw):raw;
      return value&&typeof value==="object"&&!Array.isArray(value)?value:null;
    }catch{return null}
  }
  function sanitizeRect(value){
    if(!value||typeof value!=="object"||Array.isArray(value))return null;
    const viewportW=bound(Math.round(finite(value.viewportW,innerWidth||1280)),320,10000);
    const viewportH=bound(Math.round(finite(value.viewportH,innerHeight||720)),240,10000);
    const maxW=Math.max(300,viewportW-12),maxH=Math.max(220,viewportH-76);
    const width=bound(Math.round(finite(value.width,700)),300,maxW);
    const height=bound(Math.round(finite(value.height,500)),220,maxH);
    const left=bound(Math.round(finite(value.left,0)),0,Math.max(0,viewportW-width));
    const top=bound(Math.round(finite(value.top,0)),0,Math.max(0,viewportH-height-66));
    return {left,top,width,height,viewportW,viewportH};
  }
  function safeRectOf(win){
    if(!win)return null;
    let source=null;
    if(win.classList.contains("maximized"))source=parsedRect(win.dataset.prev);
    else if(win.dataset.wmSnapLayout)source=parsedRect(win.dataset.wmPrevRect);
    const raw={
      left:finite(source?.left,finite(win.style.left,win.offsetLeft)),
      top:finite(source?.top,finite(win.style.top,win.offsetTop)),
      width:finite(source?.width,finite(win.style.width,win.offsetWidth||700)),
      height:finite(source?.height,finite(win.style.height,win.offsetHeight||500)),
      viewportW:innerWidth||1280,viewportH:innerHeight||720
    };
    return sanitizeRect(raw);
  }
  function applyRect(win,rect){
    rect=sanitizeRect(rect);
    if(!win||!rect||globalThis.isMobile?.())return false;
    const viewportW=Math.max(320,innerWidth||rect.viewportW);
    const viewportH=Math.max(240,innerHeight||rect.viewportH);
    const sx=viewportW/Math.max(1,rect.viewportW),sy=viewportH/Math.max(1,rect.viewportH);
    const maxW=Math.max(300,viewportW-12),maxH=Math.max(220,viewportH-76);
    const width=bound(Math.round(rect.width*sx),300,maxW);
    const height=bound(Math.round(rect.height*sy),220,maxH);
    const left=bound(Math.round(rect.left*sx),0,Math.max(0,viewportW-width));
    const top=bound(Math.round(rect.top*sy),0,Math.max(0,viewportH-height-66));
    Object.assign(win.style,{left:left+"px",top:top+"px",width:width+"px",height:height+"px"});
    return true;
  }
  function sanitizeSnap(value){
    if(!value||typeof value!=="object"||Array.isArray(value))return null;
    const layout=String(value.layout||"");
    const slot=Math.trunc(Number(value.slot));
    const slots=globalThis.Win11WindowManager?.layouts?.[layout];
    return Array.isArray(slots)&&Number.isInteger(slot)&&slot>=0&&slot<slots.length?{layout,slot}:null;
  }
  function safeSnapOf(win){
    return sanitizeSnap({layout:win?.dataset?.wmSnapLayout,slot:win?.dataset?.wmSnapSlot});
  }
  function fingerprint(entries){
    return JSON.stringify(entries.map(entry=>({
      appId:entry.appId,desktop:entry.desktop,hidden:entry.hidden,maximized:entry.maximized,
      focused:entry.focused,order:entry.order,hint:entry.hint||null,rect:entry.rect||null,snap:entry.snap||null
    })));
  }
  function safeExplorerHint(win){
    try{
      const wrap=win.querySelector(".win-body > [data-explorer-pro-v740], .win-body > .explorer-pro-v740, .win-body > .explorer-v4, .win-body > .explorer-real");
      if(!wrap||wrap.classList.contains("real-mount-mode"))return null;
      const path=globalThis.Win11ExplorerPro?.currentVirtualPath?.(wrap);
      return SAFE_EXPLORER_PATHS.has(path)?path:null;
    }catch{return null}
  }
  function safeEntry(win,order){
    const appId=String(win?.dataset?.app||"").toLowerCase();
    if(!APPS?.[appId])return null;
    const snap=safeSnapOf(win),entry={
      appId,desktop:validDesktop(win.dataset.desktop),
      hidden:Boolean(win.classList.contains("hidden")),
      maximized:Boolean(win.classList.contains("maximized"))&&!snap,
      focused:Boolean(win.classList.contains("focused")&&!win.classList.contains("hidden")),
      order:Math.max(0,Math.trunc(Number(order)||0))
    };
    const rect=safeRectOf(win);
    if(rect)entry.rect=rect;
    if(snap)entry.snap=snap;
    if(appId==="explorer"){
      const hint=safeExplorerHint(win);
      if(hint)entry.hint=hint;
    }
    return entry;
  }
  function sanitizeEntry(value,index=0){
    if(!value||typeof value!=="object"||Array.isArray(value))return null;
    const appId=String(value.appId||"").toLowerCase();
    if(!APPS?.[appId])return null;
    const snap=sanitizeSnap(value.snap),entry={
      appId,desktop:validDesktop(value.desktop),
      hidden:Boolean(value.hidden),maximized:Boolean(value.maximized)&&!snap,
      focused:Boolean(value.focused),order:Math.max(0,Math.trunc(Number(value.order)||index))
    };
    const rect=sanitizeRect(value.rect);
    if(rect)entry.rect=rect;
    if(snap)entry.snap=snap;
    if(appId==="explorer"&&SAFE_EXPLORER_PATHS.has(value.hint))entry.hint=value.hint;
    return entry;
  }
  function sanitizedSnapshot(){
    const s=ensureState(),seen=new Map(),out=[];
    for(let i=0;i<s.sessions.length&&out.length<MAX_WINDOWS;i++){
      const entry=sanitizeEntry(s.sessions[i],i);
      if(!entry)continue;
      const key=entry.desktop+"|"+entry.appId;
      const count=seen.get(key)||0;
      const limit=sessions.policy(entry.appId).mode==="single"?1:MAX_PER_APP_DESKTOP;
      if(count>=limit)continue;
      seen.set(key,count+1);out.push(entry);
    }
    return out.sort((a,b)=>a.order-b.order);
  }

  function buildSnapshot(){
    const wins=[...document.querySelectorAll("#window-layer > .window")];
    wins.sort((a,b)=>(Number(a.style.zIndex)||0)-(Number(b.style.zIndex)||0));
    const seen=new Map(),out=[];
    for(let i=0;i<wins.length&&out.length<MAX_WINDOWS;i++){
      const entry=safeEntry(wins[i],i);
      if(!entry)continue;
      const key=entry.desktop+"|"+entry.appId;
      const count=seen.get(key)||0;
      const limit=sessions.policy(entry.appId).mode==="single"?1:MAX_PER_APP_DESKTOP;
      if(count>=limit)continue;
      seen.set(key,count+1);out.push(entry);
    }
    return out;
  }
  function capture({source="api",force=false}={}){
    const s=ensureState();
    if(!s.enabled||restoring)return {captured:false,count:s.sessions.length,reason:restoring?"restoring":"disabled"};
    const next=buildSnapshot(),changed=JSON.stringify(next)!==JSON.stringify(s.sessions);
    if(changed||force){
      s.sessions=next;s.savedAt=Date.now();saveState();
      if(lastRestoreCompletedAt&&Date.now()-lastRestoreCompletedAt<DUPLICATE_RESTORE_MS){
        lastRestoreFingerprint=fingerprint(next);
      }
      bus.emit("session-restore:captured",{version:VERSION,source:String(source).slice(0,64),count:next.length,changed});
      scheduleSettingsRerender();
    }
    return {captured:true,count:next.length,changed};
  }
  function scheduleCapture(source="lifecycle"){
    if(restoring||!ensureState().enabled)return;
    clearTimeout(captureTimer);
    captureTimer=setTimeout(()=>capture({source}),180);
  }
  function clearSnapshot({source="api"}={}){
    clearTimeout(captureTimer);
    const s=ensureState();s.sessions=[];s.savedAt=0;s.lastRestoreAt=0;s.lastRestored=0;lastRestoreFingerprint="";lastRestoreCompletedAt=0;saveState();
    bus.emit("session-restore:cleared",{version:VERSION,source:String(source).slice(0,64)});
    scheduleSettingsRerender();return true;
  }
  function setEnabled(value,{source="api"}={}){
    const s=ensureState(),next=Boolean(value);
    if(s.enabled===next)return next;
    s.enabled=next;
    if(!next){s.sessions=[];s.savedAt=0;s.lastRestoreAt=0;s.lastRestored=0;lastRestoreFingerprint="";lastRestoreCompletedAt=0;saveState()}
    else{saveState();capture({source:String(source).slice(0,64),force:true})}
    bus.emit("session-restore:enabled",{version:VERSION,source:String(source).slice(0,64),enabled:next});
    scheduleSettingsRerender();return next;
  }

  function windowsFor(appId,desktop){
    return [...document.querySelectorAll("#window-layer > .window")].filter(win=>
      win.dataset.app===appId&&Number(win.dataset.desktop||0)===Number(desktop)
    );
  }
  function applyRestoredState(win,entry){
    if(!win)return false;
    try{
      if(win.classList.contains("maximized")||win.dataset.wmSnapLayout){
        globalThis.Win11WindowManager?.restoreFloating?.(win);
      }
    }catch{}
    if(entry.rect)applyRect(win,entry.rect);
    if(entry.snap){
      const applied=globalThis.Win11WindowManager?.applyLayoutSlot?.(
        win,entry.snap.layout,entry.snap.slot,{assist:false}
      );
      if(!applied&&entry.rect)applyRect(win,entry.rect);
    }else if(entry.maximized&&!win.classList.contains("maximized")){
      win.querySelector(".max")?.click();
    }
    if(entry.hidden)win.classList.add("hidden");else win.classList.remove("hidden");
    return true;
  }
  function refreshDesktopVisibility(index){
    state.currentDesktop=validDesktop(index);
    document.querySelectorAll("#window-layer > .window").forEach(win=>{
      win.style.visibility=Number(win.dataset.desktop||0)===state.currentDesktop?"":"hidden";
    });
    try{updateTaskbar()}catch{}
    try{populateDesktop()}catch{}
    try{renderTaskView()}catch{}
  }
  async function restore({source="api",force=false}={}){
    const s=ensureState();
    if(restoring)return {restored:false,count:0,reason:"busy"};
    if(!s.enabled&&!force)return {restored:false,count:0,reason:"disabled"};
    if(globalThis.Win11SessionManager?.isLocked)return {restored:false,count:0,reason:"locked"};
    const desired=sanitizedSnapshot();
    if(!desired.length)return {restored:false,count:0,reason:"empty"};
    if(s.savedAt&&Date.now()-s.savedAt>MAX_AGE_MS)return {restored:false,count:0,reason:"stale"};
    const restoreFingerprint=fingerprint(desired);
    if(!force&&restoreFingerprint===lastRestoreFingerprint&&Date.now()-lastRestoreCompletedAt<DUPLICATE_RESTORE_MS){
      bus.emit("session-restore:skipped",{
        version:VERSION,source:String(source).slice(0,64),reason:"duplicate"
      });
      return {restored:false,count:0,reason:"duplicate"};
    }

    restoring=true;clearTimeout(captureTimer);
    const originalDesktop=validDesktop(state.currentDesktop);
    let restoredCount=0,focusedWindow=null;
    const used=new Map(),restoredWindows=[];
    try{
      for(const entry of desired){
        state.currentDesktop=entry.desktop;
        const key=entry.desktop+"|"+entry.appId;
        const index=used.get(key)||0;
        const existing=windowsFor(entry.appId,entry.desktop);
        let win=existing[index]||null;
        if(!win){
          const hint=entry.appId==="explorer"?entry.hint:undefined;
          win=sessions.openNew(entry.appId,hint,{source:"session-restore-v993"});
        }
        used.set(key,index+1);
        applyRestoredState(win,entry);
        restoredWindows.push({entry,win});
        if(entry.focused&&entry.desktop===originalDesktop&&!entry.hidden)focusedWindow=win;
        restoredCount++;
        await Promise.resolve();
      }
      refreshDesktopVisibility(originalDesktop);
      const ordered=restoredWindows
        .filter(x=>x.entry.desktop===originalDesktop&&!x.entry.hidden&&x.win?.isConnected)
        .sort((a,b)=>a.entry.order-b.entry.order);
      for(const item of ordered)focusWindow(item.win);
      if(focusedWindow?.isConnected){focusedWindow.classList.remove("hidden");focusWindow(focusedWindow)}
      lastRestoreFingerprint=restoreFingerprint;
      lastRestoreCompletedAt=Date.now();
      s.lastRestoreAt=lastRestoreCompletedAt;s.lastRestored=restoredCount;saveState();
      bus.emit("session-restore:restored",{
        version:VERSION,source:String(source).slice(0,64),count:restoredCount,
        geometry:true,schemaVersion:SCHEMA_VERSION
      });
      return {restored:true,count:restoredCount,source:String(source).slice(0,64),geometry:true};
    }finally{
      restoring=false;
      setTimeout(()=>capture({source:"post-restore-v993",force:true}),80);
      scheduleSettingsRerender();
    }
  }

  function snapshotInfo(){
    const s=ensureState(),entries=sanitizedSnapshot();
    return {
      version:VERSION,schemaVersion:SCHEMA_VERSION,enabled:s.enabled,savedAt:s.savedAt,lastRestoreAt:s.lastRestoreAt,
      lastRestored:s.lastRestored,count:entries.length,maxWindows:MAX_WINDOWS,
      geometryCount:entries.filter(x=>x.rect).length,snapCount:entries.filter(x=>x.snap).length,
      stale:Boolean(s.savedAt&&Date.now()-s.savedAt>MAX_AGE_MS),
      apps:[...new Set(entries.map(x=>x.appId))].sort()
    };
  }
  function renderCard(box){
    box.querySelector("[data-session-restore-v992]")?.remove();
    const info=snapshotInfo(),card=document.createElement("div");
    card.className="sys-card session-restore-v992";card.dataset.sessionRestoreV992="";
    const saved=info.savedAt?new Date(info.savedAt).toLocaleString("pt-PT"):"Ainda não existe snapshot";
    card.innerHTML='<div class="session-restore-head-v992"><div><strong>Reabrir aplicações após iniciar sessão</strong>'+
      '<p>Guarda apps/janelas, posição, tamanho, Snap e foco. Não guarda conteúdo interno, URLs nem nomes de ficheiros.</p></div>'+
      '<button class="toggle '+(info.enabled?"on":"")+'" data-session-restore-toggle-v992 aria-pressed="'+String(info.enabled)+'"></button></div>'+
      '<div class="session-restore-meta-v992"><span><strong>'+info.count+'</strong> janela(s) guardadas</span>'+
      '<span>'+info.geometryCount+' com geometria · '+info.snapCount+' em Snap</span>'+
      '<span>'+escapeHTML(saved)+'</span></div>'+
      '<div class="session-restore-actions-v992"><button class="sys-button" data-session-restore-save-v992 '+(info.enabled?"":"disabled")+
      '>Guardar agora</button><button class="sys-button" data-session-restore-now-v992 '+(info.count?"":"disabled")+
      '>Restaurar agora</button><button class="sys-button" data-session-restore-clear-v992 '+(info.count?"":"disabled")+
      '>Limpar snapshot</button></div>'+
      '<small class="session-restore-note-v992">Schema 2 · geometria ajustada ao viewport atual · limite: '+MAX_WINDOWS+' janelas · snapshots com mais de 30 dias não são restaurados automaticamente.</small>';
    (box.querySelector(".sys-grid")||box).appendChild(card);
    card.querySelector("[data-session-restore-toggle-v992]").onclick=()=>{setEnabled(!ensureState().enabled,{source:"settings-ui-v993"});renderCard(box)};
    card.querySelector("[data-session-restore-save-v992]").onclick=()=>{if(!ensureState().enabled)return;const r=capture({source:"settings-ui-v993-save",force:true});notify("Sessões",r.count+" janela(s) guardadas.");renderCard(box)};
    card.querySelector("[data-session-restore-now-v992]").onclick=async()=>{const r=await restore({source:"settings-ui-v993-restore",force:true});notify("Sessões",r.restored?r.count+" janela(s) reconciliadas.":"Nada para restaurar.");renderCard(box)};
    card.querySelector("[data-session-restore-clear-v992]").onclick=()=>{clearSnapshot({source:"settings-ui-v993-clear"});notify("Sessões","Snapshot de aplicações limpo.");renderCard(box)};
    return card;
  }

  function scheduleSettingsRerender(){
    if(rerenderPending)return;rerenderPending=true;
    queueMicrotask(()=>{
      rerenderPending=false;
      if(state.settingsPage!=="accounts")return;
      document.querySelectorAll('.window[data-app="settings"] [data-settings-page]').forEach(renderCard);
    });
  }

  globalThis.renderSettingsPageV5=function(box,page){
    previousRenderSettingsPage(box,page);
    if(page==="accounts")renderCard(box);
  };
  try{renderSettingsPageV5=globalThis.renderSettingsPageV5}catch{}

  for(const topic of [
    "app:launched","app:activated","app:minimized","app:restored","app:maximized",
    "app:unmaximized","app:moved-desktop","app:closed"
  ])bus.on(topic,()=>scheduleCapture(topic));

  window.addEventListener("win11-session-saving",event=>capture({source:"session-saving-"+String(event.detail?.reason||"unknown"),force:true}));
  window.addEventListener("win11-session-start",event=>{
    setTimeout(()=>restore({source:"session-start-"+String(event.detail?.reason||"login")}).catch(()=>{}),60);
  });
  window.addEventListener("pagehide",()=>capture({source:"pagehide-v993",force:true}));

  ensureState();

  globalThis.Win11SessionRestore=Object.freeze({
    version:VERSION,schemaVersion:SCHEMA_VERSION,capture,restore,setEnabled,clearSnapshot,snapshotInfo,
    get state(){return Object.freeze(clone(ensureState()))},
    limits:Object.freeze({
      maxWindows:MAX_WINDOWS,maxPerAppDesktop:MAX_PER_APP_DESKTOP,
      maxAgeMs:MAX_AGE_MS,duplicateRestoreMs:DUPLICATE_RESTORE_MS
    }),
    safeExplorerPaths:Object.freeze([...SAFE_EXPLORER_PATHS])
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:41,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "session-restore","restartable-apps","per-profile-session-snapshot",
      "safe-session-metadata","bounded-session-snapshot","session-start-restore",
      "session-saving-hook","accounts-session-restore-ui",
      "session-snapshot-schema-2","window-geometry-session-restore",
      "viewport-aware-restore","snap-session-restore",
      "focus-order-restore","duplicate-restore-guard"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
