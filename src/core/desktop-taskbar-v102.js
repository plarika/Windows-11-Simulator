"use strict";
(function installDesktopTaskbarV102(){
  const VERSION="10.2.0";
  const EVENT_LIMIT=96,RECONCILE_LIMIT=48;
  const platform=globalThis.Win11Platform;
  const events=[];
  let started=false,sequence=0,reconcileTimer=0,lastReconcileAt=0;
  let resizeHandler=null,visibilityHandler=null,busOff=null;

  if(!platform||typeof platform.registerModule!=="function"){
    throw new Error("Desktop / Taskbar V10.2 requires Platform V10.");
  }

  function clone(value){
    if(value===undefined)return null;
    try{return structuredClone(value)}
    catch{
      try{return JSON.parse(JSON.stringify(value))}
      catch{return null}
    }
  }
  function safeText(value,max=120){
    return String(value??"").trim().slice(0,max);
  }
  function boundedInt(value,min,max,fallback=0){
    const n=Math.trunc(Number(value));
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
  }
  function record(type,detail={}){
    const row={
      id:"shell-v102-"+(++sequence),version:VERSION,time:Date.now(),
      type:safeText(type,48),detail:clone(detail)
    };
    events.unshift(row);
    if(events.length>EVENT_LIMIT)events.length=EVENT_LIMIT;
    try{globalThis.Win11SystemBus?.emit?.("desktop-taskbar:"+row.type,{version:VERSION,...row.detail})}catch{}
    return clone(row);
  }
  function requiredElements(){
    return {
      app:document.getElementById("app"),
      desktop:document.getElementById("desktop"),
      desktopIcons:document.getElementById("desktop-icons"),
      taskbar:document.getElementById("taskbar"),
      taskCenter:document.getElementById("task-center"),
      startMenu:document.getElementById("start-menu")
    };
  }
  function missingElements(){
    return Object.entries(requiredElements()).filter(([,node])=>!node).map(([key])=>key);
  }
  function validDesktopIndex(){
    const hasState=typeof state!=="undefined"&&state&&typeof state==="object";
    const desktops=hasState&&Array.isArray(state.desktops)&&state.desktops.length?state.desktops:["Ambiente 1"];
    const current=boundedInt(hasState?state.currentDesktop:0,0,Math.max(0,desktops.length-1),0);
    return {count:desktops.length,current};
  }
  function taskbarSnapshot(){
    const taskSystem=globalThis.Win11TaskbarSystem?.state||null;
    const groups=globalThis.Win11TaskbarWindowPro?.getGroups?.()||{};
    const taskCenter=document.getElementById("task-center");
    return {
      buttonCount:taskCenter?.querySelectorAll(".task-btn[data-window]").length||0,
      groupCount:Object.keys(groups).length,
      autoHide:Boolean(taskSystem?.autoHide),
      showDesktop:Boolean(taskSystem?.showDesktop),
      showSeconds:Boolean(taskSystem?.showSeconds),
      desktopShowing:Boolean(taskSystem?.desktopShowing)
    };
  }
  function startSnapshot(){
    let data=null;
    try{data=globalThis.Win11StartSearch?.state||null}catch{}
    return {
      pinnedCount:Array.isArray(data?.pinned)?data.pinned.length:0,
      recentAppCount:Array.isArray(data?.recentApps)?data.recentApps.length:0,
      searchHistoryCount:Array.isArray(data?.searchHistory)?data.searchHistory.length:0
    };
  }
  function snapshot(){
    const desktop=validDesktopIndex();
    const iconCount=document.querySelectorAll("#desktop-icons .desktop-icon").length;
    return Object.freeze({
      version:VERSION,
      desktop:Object.freeze({current:desktop.current,count:desktop.count,iconCount}),
      taskbar:Object.freeze(taskbarSnapshot()),
      start:Object.freeze(startSnapshot())
    });
  }
  function integrity(){
    const missing=missingElements();
    const desktop=validDesktopIndex();
    const taskCenter=document.getElementById("task-center");
    const windowIds=new Set(
      [...document.querySelectorAll("#window-layer > .window[data-id]")]
        .map(win=>String(win.dataset.id||"")).filter(Boolean)
    );
    const taskButtons=[...(taskCenter?.querySelectorAll(".task-btn[data-window]")||[])];
    const orphanButtons=taskButtons.filter(btn=>!windowIds.has(String(btn.dataset.window||""))).length;
    const duplicateButtons=taskButtons.length-new Set(taskButtons.map(btn=>String(btn.dataset.window||""))).size;
    return Object.freeze({
      ok:missing.length===0&&orphanButtons===0&&duplicateButtons===0,
      missingElements:missing,
      desktopIndexValid:desktop.current>=0&&desktop.current<desktop.count,
      orphanTaskButtons:orphanButtons,
      duplicateTaskButtons:Math.max(0,duplicateButtons)
    });
  }

  function refreshDesktop(){
    if(typeof globalThis.populateDesktop!=="function")return false;
    globalThis.populateDesktop();
    return true;
  }
  function refreshStart(){
    const start=globalThis.Win11StartSearch;
    if(!start||typeof start.renderStart!=="function")return false;
    start.renderStart(false);
    try{globalThis.renderRecommended?.()}catch{}
    return true;
  }
  function pruneTaskButtons(){
    const taskCenter=document.getElementById("task-center");
    if(!taskCenter)return 0;
    const windows=new Set(
      [...document.querySelectorAll("#window-layer > .window[data-id]")]
        .map(win=>String(win.dataset.id||"")).filter(Boolean)
    );
    const seen=new Set();
    let removed=0;
    for(const btn of [...taskCenter.querySelectorAll(".task-btn[data-window]")]){
      const id=String(btn.dataset.window||"");
      if(!id||!windows.has(id)||seen.has(id)){
        btn.remove();removed++;continue;
      }
      seen.add(id);
    }
    return removed;
  }
  function refreshTaskbar(){
    let repairs=0,removed=0;
    try{removed=pruneTaskButtons()}catch{}
    try{globalThis.Win11TaskbarSystem?.apply?.()}catch{}
    try{repairs=boundedInt(globalThis.Win11TaskbarWindowPro?.repairTaskButtons?.(),0,500,0)}catch{}
    try{globalThis.Win11TaskbarWindowPro?.refresh?.()}catch{}
    try{globalThis.updateTaskbar?.()}catch{}
    return {repairs,removed};
  }
  function reconcile({source="api",desktop=true,start=true,taskbar=true}={}){
    if(!started&&source!=="module-start")return {ok:false,reason:"not-started"};
    const before=integrity();
    const desktopInfo=validDesktopIndex();
    if(typeof state!=="undefined"&&state&&typeof state==="object"){
      if(!Array.isArray(state.desktops)||!state.desktops.length)state.desktops=["Ambiente 1"];
      state.currentDesktop=desktopInfo.current;
    }
    let desktopRefreshed=false,startRefreshed=false,taskbarRepairs=0,taskbarRemoved=0;
    try{
      if(desktop)desktopRefreshed=refreshDesktop();
      if(start)startRefreshed=refreshStart();
      if(taskbar){
        const taskbarResult=refreshTaskbar();
        taskbarRepairs=taskbarResult.repairs;
        taskbarRemoved=taskbarResult.removed;
      }
      const nodes=requiredElements();
      if(nodes.app)nodes.app.dataset.desktopTaskbar="10.2.0";
      if(nodes.desktop)nodes.desktop.dataset.desktopSurface="10.2.0";
      if(nodes.taskbar)nodes.taskbar.dataset.taskbarSurface="10.2.0";
      lastReconcileAt=Date.now();
      const after=integrity();
      record("reconciled",{
        source:safeText(source,48),desktopRefreshed,startRefreshed,taskbarRepairs,taskbarRemoved,
        beforeOk:before.ok,afterOk:after.ok
      });
      return Object.freeze({ok:after.ok,desktopRefreshed,startRefreshed,taskbarRepairs,taskbarRemoved,integrity:after});
    }catch(error){
      record("reconcile-failed",{source:safeText(source,48),message:safeText(error?.message||error,180)});
      return {ok:false,reason:"exception"};
    }
  }
  function scheduleReconcile(source="scheduled",delay=80){
    clearTimeout(reconcileTimer);
    reconcileTimer=setTimeout(()=>reconcile({source}),boundedInt(delay,0,1000,80));
    return true;
  }
  function pinStart(appId){
    const id=safeText(appId,64);
    const ok=Boolean(globalThis.Win11StartSearch?.pin?.(id));
    record("start-pin",{appId:id,ok});
    return ok;
  }
  function unpinStart(appId){
    const id=safeText(appId,64);
    const ok=Boolean(globalThis.Win11StartSearch?.unpin?.(id));
    record("start-unpin",{appId:id,ok});
    return ok;
  }
  function isPinnedStart(appId){
    return Boolean(globalThis.Win11StartSearch?.isPinned?.(safeText(appId,64)));
  }
  function showDesktop(){
    const ok=Boolean(globalThis.Win11TaskbarSystem?.showDesktop?.());
    record("show-desktop",{ok});
    return ok;
  }
  function revealTaskbar(){
    const ok=globalThis.Win11TaskbarSystem?.reveal?.();
    record("taskbar-reveal",{ok:ok!==false});
    return ok!==false;
  }
  function health(){
    const i=integrity(),s=snapshot();
    return Object.freeze({
      ok:i.ok,
      missingElements:i.missingElements,
      desktopIndexValid:i.desktopIndexValid,
      orphanTaskButtons:i.orphanTaskButtons,
      duplicateTaskButtons:i.duplicateTaskButtons,
      desktopCount:s.desktop.count,
      iconCount:s.desktop.iconCount,
      taskbarButtonCount:s.taskbar.buttonCount,
      pinnedCount:s.start.pinnedCount,
      lastReconcileAt
    });
  }
  function diagnostics(){
    return Object.freeze({
      version:VERSION,started,lastReconcileAt,
      health:health(),
      eventCount:events.length,
      recentEvents:clone(events.slice(0,32))
    });
  }
  function bind(){
    resizeHandler=()=>scheduleReconcile("resize",120);
    visibilityHandler=()=>{if(document.visibilityState==="visible")scheduleReconcile("visibility",40)};
    addEventListener("resize",resizeHandler,{passive:true});
    document.addEventListener("visibilitychange",visibilityHandler);
    try{
      busOff=globalThis.Win11SystemBus?.on?.("settings:taskbar:changed",()=>scheduleReconcile("settings-taskbar",30))||null;
    }catch{busOff=null}
  }
  function unbind(){
    clearTimeout(reconcileTimer);
    if(resizeHandler)removeEventListener("resize",resizeHandler);
    if(visibilityHandler)document.removeEventListener("visibilitychange",visibilityHandler);
    try{busOff?.()}catch{}
    resizeHandler=null;visibilityHandler=null;busOff=null;
  }
  function start(){
    if(started)return true;
    const missing=missingElements();
    if(missing.length)throw new Error("Desktop / Taskbar surfaces missing: "+missing.join(", "));
    started=true;
    bind();
    const result=reconcile({source:"module-start"});
    record("started",{healthy:Boolean(result.ok)});
    return result.ok;
  }
  function stop(){
    if(!started)return true;
    unbind();
    started=false;
    record("stopped",{});
    return true;
  }

  const api=Object.freeze({
    version:VERSION,reconcile,scheduleReconcile,snapshot,integrity,health,diagnostics,
    pinStart,unpinStart,isPinnedStart,showDesktop,revealTaskbar,
    events:(limit=24)=>Object.freeze(clone(events.slice(0,boundedInt(limit,0,EVENT_LIMIT,24))))
  });
  globalThis.Win11DesktopTaskbar=api;
  if(!platform.inspect("desktop-taskbar")){
    platform.registerModule({
      id:"desktop-taskbar",version:VERSION,layer:"shell",
      requires:["platform","system-bus","settings-core","desktop-integration","start-search","taskbar-system","taskbar-window"],
      provides:["desktop-surface","taskbar-surface","start-pins","shell-reconcile","shell-health"],
      start:()=>start(),
      stop:()=>stop(),
      health:()=>health()
    });
  }

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:48,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "desktop-taskbar-v102","desktop-surface-contract","taskbar-surface-contract",
      "start-pins-contract","shell-self-reconcile","shell-integrity-health"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
