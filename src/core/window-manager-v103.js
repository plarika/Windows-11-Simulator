"use strict";
(function installWindowManagerV103(){
  const VERSION="10.3.0";
  const EVENT_LIMIT=120;
  const platform=globalThis.Win11Platform;
  const events=[];
  let started=false,sequence=0,observer=null,resizeHandler=null,reconcileTimer=0,lastReconcileAt=0;

  if(!platform||typeof platform.registerModule!=="function"){
    throw new Error("Window Manager V10.3 requires Platform V10.");
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
    const row={id:"wm-v103-"+(++sequence),version:VERSION,time:Date.now(),type:safeText(type,48),detail:clone(detail)};
    events.unshift(row);
    if(events.length>EVENT_LIMIT)events.length=EVENT_LIMIT;
    try{globalThis.Win11SystemBus?.emit?.("window-manager:"+row.type,{version:VERSION,...row.detail})}catch{}
    return clone(row);
  }
  function layer(){
    return document.getElementById("window-layer");
  }
  function desktops(){
    return typeof state!=="undefined"&&Array.isArray(state.desktops)&&state.desktops.length?state.desktops:["Ambiente 1"];
  }
  function currentDesktop(){
    return boundedInt(typeof state!=="undefined"?state.currentDesktop:0,0,Math.max(0,desktops().length-1),0);
  }
  function windows(){
    return [...(layer()?.children||[])].filter(node=>node.classList?.contains("window"));
  }
  function windowById(id){
    id=safeText(id,96);
    return windows().find(win=>String(win.dataset.id||"")===id)||null;
  }
  function windowSnapshot(win){
    const desktop=boundedInt(win?.dataset?.desktop,0,Math.max(0,desktops().length-1),0);
    return {
      id:safeText(win?.dataset?.id,96),
      appId:safeText(win?.dataset?.app,64),
      desktop,
      hidden:Boolean(win?.classList?.contains("hidden")),
      focused:Boolean(win?.classList?.contains("focused")),
      maximized:Boolean(win?.classList?.contains("maximized")),
      snapped:Boolean(win?.classList?.contains("wm-snapped")),
      snapLayout:safeText(win?.dataset?.wmSnapLayout,32),
      snapSlot:win?.dataset?.wmSnapSlot===undefined?null:boundedInt(win.dataset.wmSnapSlot,0,16,0),
      snapGroup:safeText(win?.dataset?.wmSnapGroup,96)
    };
  }
  function snapshot(){
    const rows=windows().map(windowSnapshot);
    return Object.freeze({
      version:VERSION,currentDesktop:currentDesktop(),desktopCount:desktops().length,
      windowCount:rows.length,visibleCount:rows.filter(x=>!x.hidden&&x.desktop===currentDesktop()).length,
      focusedId:rows.find(x=>x.focused)?.id||"",
      windows:Object.freeze(clone(rows))
    });
  }
  function integrity(){
    const rows=windows();
    const desktopCount=desktops().length;
    const ids=rows.map(win=>safeText(win.dataset.id,96)).filter(Boolean);
    const duplicateIds=ids.length-new Set(ids).size;
    const missingIds=rows.filter(win=>!safeText(win.dataset.id,96)).length;
    const invalidDesktop=rows.filter(win=>{
      const n=Number(win.dataset.desktop);
      return !Number.isInteger(n)||n<0||n>=desktopCount;
    }).length;
    const invalidSnap=rows.filter(win=>{
      if(!win.dataset.wmSnapLayout)return false;
      const layouts=globalThis.Win11WindowManager?.layouts||{};
      const slots=layouts[win.dataset.wmSnapLayout];
      const slot=Number(win.dataset.wmSnapSlot);
      return !Array.isArray(slots)||!Number.isInteger(slot)||slot<0||slot>=slots.length;
    }).length;
    const focused=rows.filter(win=>win.classList.contains("focused")&&!win.classList.contains("hidden")&&Number(win.dataset.desktop||0)===currentDesktop());
    return Object.freeze({
      ok:duplicateIds===0&&missingIds===0&&invalidDesktop===0&&invalidSnap===0&&focused.length<=1,
      duplicateIds:Math.max(0,duplicateIds),missingIds,invalidDesktop,invalidSnap,
      multipleFocused:Math.max(0,focused.length-1)
    });
  }
  function nextWindowId(){
    let id="";
    do{id="w-v103-"+Date.now().toString(36)+"-"+(++sequence).toString(36)}while(windowById(id));
    return id;
  }
  function repairIdentityAndDesktop(){
    const seen=new Set(),desktopCount=desktops().length;
    let repaired=0;
    for(const win of windows()){
      let id=safeText(win.dataset.id,96);
      if(!id||seen.has(id)){
        win.dataset.id=nextWindowId();id=win.dataset.id;repaired++;
      }
      seen.add(id);
      const n=Number(win.dataset.desktop);
      if(!Number.isInteger(n)||n<0||n>=desktopCount){
        win.dataset.desktop=String(currentDesktop());repaired++;
      }
      const visible=Number(win.dataset.desktop||0)===currentDesktop();
      win.style.visibility=visible?"":"hidden";
    }
    return repaired;
  }
  function repairFocus(){
    const candidates=windows().filter(win=>!win.classList.contains("hidden")&&Number(win.dataset.desktop||0)===currentDesktop());
    const focused=candidates.filter(win=>win.classList.contains("focused"));
    if(focused.length<=1)return 0;
    focused.sort((a,b)=>(Number(b.style.zIndex)||0)-(Number(a.style.zIndex)||0));
    focused.slice(1).forEach(win=>win.classList.remove("focused"));
    return focused.length-1;
  }
  function repairSnap(){
    let repaired=0;
    const layouts=globalThis.Win11WindowManager?.layouts||{};
    for(const win of windows()){
      if(!win.dataset.wmSnapLayout)continue;
      const slots=layouts[win.dataset.wmSnapLayout],slot=Number(win.dataset.wmSnapSlot);
      if(!Array.isArray(slots)||!Number.isInteger(slot)||slot<0||slot>=slots.length){
        try{globalThis.Win11WindowManager?.restoreFloating?.(win)}catch{}
        delete win.dataset.wmSnapLayout;delete win.dataset.wmSnapSlot;delete win.dataset.wmSnapGroup;
        win.classList.remove("wm-snapped");repaired++;
      }
    }
    try{globalThis.Win11WindowManager?.refreshSnapGroups?.()}catch{}
    return repaired;
  }
  function reconcile({source="api",placements=true}={}){
    if(!started&&source!=="module-start")return {ok:false,reason:"not-started"};
    try{
      const identityRepairs=repairIdentityAndDesktop();
      const focusRepairs=repairFocus();
      const snapRepairs=repairSnap();
      let placementsSaved=0;
      if(placements){
        for(const win of windows()){
          try{if(globalThis.Win11TaskbarWindowPro?.savePlacement?.(win))placementsSaved++}catch{}
        }
      }
      try{globalThis.Win11DesktopTaskbar?.reconcile?.({source:"wm-v103-"+safeText(source,32),desktop:false,start:false,taskbar:true})}catch{}
      lastReconcileAt=Date.now();
      const health=integrity();
      record("reconciled",{source:safeText(source,48),identityRepairs,focusRepairs,snapRepairs,placementsSaved,healthy:health.ok});
      return Object.freeze({ok:health.ok,identityRepairs,focusRepairs,snapRepairs,placementsSaved,integrity:health});
    }catch(error){
      record("reconcile-failed",{source:safeText(source,48),message:safeText(error?.message||error,180)});
      return {ok:false,reason:"exception"};
    }
  }
  function scheduleReconcile(source="scheduled",delay=60){
    clearTimeout(reconcileTimer);
    reconcileTimer=setTimeout(()=>reconcile({source}),boundedInt(delay,0,1000,60));
    return true;
  }
  function act(id,type){
    const win=windowById(id);
    if(!win)return false;
    if(type==="focus"){
      win.classList.remove("hidden");
      globalThis.focusWindow?.(win);
    }else if(type==="minimize"){
      globalThis.minimizeWindow?.(win);
    }else if(type==="maximize"){
      if(!win.classList.contains("maximized"))win.querySelector(".max")?.click();
    }else if(type==="restore"){
      if(win.classList.contains("hidden"))win.classList.remove("hidden");
      if(win.classList.contains("maximized")||win.classList.contains("wm-snapped"))globalThis.Win11WindowManager?.restoreFloating?.(win);
      globalThis.focusWindow?.(win);
    }else if(type==="close"){
      globalThis.closeWindow?.(win);
    }else return false;
    record("window-action",{windowId:safeText(id,96),action:type});
    scheduleReconcile("action-"+type,30);
    return true;
  }
  function snap(id,layout,slot,{assist=true}={}){
    const win=windowById(id);
    if(!win)return false;
    const ok=Boolean(globalThis.Win11WindowManager?.applyLayoutSlot?.(win,safeText(layout,32),boundedInt(slot,0,16,0),{assist:Boolean(assist)}));
    record("snap",{windowId:safeText(id,96),layout:safeText(layout,32),slot:boundedInt(slot,0,16,0),ok});
    if(ok)scheduleReconcile("snap",20);
    return ok;
  }
  function moveToDesktop(id,index){
    const win=windowById(id);
    if(!win)return false;
    index=boundedInt(index,0,Math.max(0,desktops().length-1),0);
    if(typeof globalThis.Win11WindowManager?.moveWindowToDesktop!=="function")return false;
    globalThis.Win11WindowManager.moveWindowToDesktop(win,index);
    const ok=Number(win.dataset.desktop||0)===index;
    record("move-desktop",{windowId:safeText(id,96),desktop:index,ok});
    scheduleReconcile("move-desktop",20);
    return ok;
  }
  function createDesktop(){
    if(typeof globalThis.Win11WindowManager?.createDesktop!=="function")return false;
    const before=desktops().length;
    globalThis.Win11WindowManager.createDesktop();
    const ok=desktops().length>before;
    record("desktop-created",{ok,count:desktops().length});
    scheduleReconcile("desktop-created",20);
    return ok;
  }
  function renameDesktop(index,name){
    index=boundedInt(index,0,Math.max(0,desktops().length-1),0);
    name=safeText(name,40);
    if(!name||typeof state==="undefined"||!Array.isArray(state.desktops)||state.desktops[index]===undefined)return false;
    state.desktops[index]=name;
    try{saveState()}catch{}
    try{globalThis.Win11WindowManager?.renderTaskView?.()}catch{}
    const ok=state.desktops[index]===name;
    record("desktop-renamed",{index,ok});
    scheduleReconcile("desktop-renamed",20);
    return ok;
  }
  function closeDesktop(index){
    if(desktops().length<=1)return false;
    index=boundedInt(index,0,desktops().length-1,0);
    const result=globalThis.Win11WindowManager?.closeDesktop?.(index);
    const ok=result!==false;
    record("desktop-closed",{index,ok,count:desktops().length});
    scheduleReconcile("desktop-closed",30);
    return ok;
  }
  function layouts(){
    const legacy=globalThis.Win11WindowManager?.layouts||{};
    return Object.freeze(Object.fromEntries(Object.entries(legacy).map(([name,slots])=>[
      name,Object.freeze((Array.isArray(slots)?slots:[]).map(slot=>Object.freeze({...slot})))
    ])));
  }
  function health(){
    const i=integrity(),s=snapshot();
    return Object.freeze({
      ok:i.ok,...i,
      windowCount:s.windowCount,visibleCount:s.visibleCount,
      desktopCount:s.desktopCount,currentDesktop:s.currentDesktop,
      snapLayoutCount:Object.keys(globalThis.Win11WindowManager?.layouts||{}).length,
      lastReconcileAt
    });
  }
  function diagnostics(){
    return Object.freeze({
      version:VERSION,started,lastReconcileAt,
      health:health(),eventCount:events.length,recentEvents:clone(events.slice(0,36))
    });
  }
  function bind(){
    const host=layer();
    if(!host)throw new Error("Window layer unavailable.");
    observer=new MutationObserver(()=>scheduleReconcile("mutation",35));
    observer.observe(host,{childList:true,subtree:false,attributes:true,attributeFilter:["class","data-desktop"]});
    resizeHandler=()=>scheduleReconcile("resize",100);
    addEventListener("resize",resizeHandler,{passive:true});
  }
  function unbind(){
    clearTimeout(reconcileTimer);
    observer?.disconnect();observer=null;
    if(resizeHandler)removeEventListener("resize",resizeHandler);
    resizeHandler=null;
  }
  function start(){
    if(started)return true;
    if(!layer()||!globalThis.Win11WindowManager)throw new Error("Window Manager compatibility layer unavailable.");
    started=true;bind();
    const result=reconcile({source:"module-start",placements:false});
    record("started",{healthy:Boolean(result.ok)});
    return result.ok;
  }
  function stop(){
    if(!started)return true;
    unbind();started=false;record("stopped",{});return true;
  }
  const api=Object.freeze({
    version:VERSION,snapshot,integrity,health,diagnostics,reconcile,scheduleReconcile,
    windowById,layouts,
    focus:id=>act(id,"focus"),minimize:id=>act(id,"minimize"),maximize:id=>act(id,"maximize"),
    restore:id=>act(id,"restore"),close:id=>act(id,"close"),
    snap,moveToDesktop,createDesktop,renameDesktop,closeDesktop,
    savePlacement:id=>{const win=windowById(id);return Boolean(win&&globalThis.Win11TaskbarWindowPro?.savePlacement?.(win))},
    applyPlacement:id=>{const win=windowById(id);return Boolean(win&&globalThis.Win11TaskbarWindowPro?.applyPlacement?.(win))},
    events:(limit=28)=>Object.freeze(clone(events.slice(0,boundedInt(limit,0,EVENT_LIMIT,28))))
  });
  globalThis.Win11WindowManagerV10=api;

  if(!platform.inspect("window-manager-v10")){
    platform.registerModule({
      id:"window-manager-v10",version:VERSION,layer:"shell",
      requires:["platform","desktop-taskbar","window-manager","taskbar-window"],
      provides:["window-lifecycle","snap-contract","virtual-desktop-contract","window-health","placement-contract"],
      start:()=>start(),stop:()=>stop(),health:()=>health()
    });
  }

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:49,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "window-manager-v103","window-lifecycle-contract","snap-layout-contract",
      "virtual-desktop-contract","window-placement-contract","window-self-reconcile"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
