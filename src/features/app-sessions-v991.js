"use strict";
(function installAppSessionsV991(){
  const VERSION="9.9.1";
  const HISTORY_LIMIT=80;
  const history=[];
  const bus=globalThis.Win11SystemBus;
  const lifecycle=globalThis.Win11AppLifecycle;
  const previousRenderSettingsPage=globalThis.renderSettingsPageV5;
  const baseOpenApp=globalThis.openApp||openApp;
  const baseOpenAppNewWindow=globalThis.openAppNewWindow;
  if(!bus||!lifecycle||typeof baseOpenApp!=="function"||typeof baseOpenAppNewWindow!=="function"){
    throw new Error("App Sessions V9.9.1 requires System Bus, App Lifecycle and window APIs.");
  }

  const SINGLE=new Set([
    "settings","taskmanager","recycle","camera","security","devicemanager","registry",
    "eventviewer","controlpanel","clock","store","windowstools","services","diskmgmt",
    "taskscheduler","systeminfo","resmon","optionalfeatures","backup","recovery",
    "onedrive","remotedesktop","soundrecorder","gethelp"
  ]);
  let rerenderPending=false;

  function clone(value){
    try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}
  }
  function appIdOf(value){
    const id=String(value||"").trim().toLowerCase();
    if(!APPS?.[id])throw new RangeError("Aplicação não suportada.");
    return id;
  }
  function policy(appId){
    const id=appIdOf(appId),mode=SINGLE.has(id)?"single":"multi";
    return Object.freeze({
      appId:id,mode,allowMultiple:mode==="multi",
      defaultActivation:"reuse",scope:"desktop"
    });
  }
  function windows(appId=null,{desktop=null}={}){
    const id=appId===null?null:appIdOf(appId);
    return [...document.querySelectorAll("#window-layer > .window")].filter(win=>{
      if(id&&win.dataset.app!==id)return false;
      return desktop===null||Number(win.dataset.desktop||0)===Number(desktop);
    });
  }
  function currentDesktop(){return Number(state.currentDesktop)||0}
  function findExisting(appId,desktop=currentDesktop()){
    const candidates=windows(appId,{desktop});
    return candidates.find(w=>w.classList.contains("focused")&&!w.classList.contains("hidden"))||
      candidates.find(w=>!w.classList.contains("hidden"))||candidates[0]||null;
  }

  function record(action,appId,win,source,extra={}){
    const entry={
      version:VERSION,time:Date.now(),action,
      appId:String(appId),windowId:win?.dataset?.id||null,
      desktop:Number(win?.dataset?.desktop??currentDesktop()),
      source:String(source||"api").slice(0,64),
      policy:policy(appId).mode,...extra
    };
    history.unshift(entry);
    if(history.length>HISTORY_LIMIT)history.length=HISTORY_LIMIT;
    bus.emit("app-session:"+action,entry);
    return entry;
  }
  function restoreAndFocus(win){
    if(!win?.isConnected)return null;
    const wasHidden=win.classList.contains("hidden");
    if(wasHidden)win.classList.remove("hidden");
    focusWindow(win);
    return win;
  }
  function navigateExisting(win,appId,initialPath){
    if(appId==="explorer"&&initialPath)win.dispatchEvent(new CustomEvent("navigate",{detail:initialPath}));
  }

  function activate(appId,{initialPath,source="api",newWindow=false}={}){
    const id=appIdOf(appId),p=policy(id),desktop=currentDesktop();
    if(newWindow&&p.allowMultiple){
      const win=baseOpenAppNewWindow(id,initialPath);
      record("opened-new",id,win,source,{requestedNewWindow:true});
      return win;
    }
    const existing=findExisting(id,desktop);
    if(existing){
      restoreAndFocus(existing);navigateExisting(existing,id,initialPath);
      record("reused",id,existing,source,{requestedNewWindow:Boolean(newWindow)});
      return existing;
    }
    const win=baseOpenApp(id,initialPath);
    record("launched",id,win,source,{requestedNewWindow:Boolean(newWindow)});
    return win;
  }
  function openNew(appId,initialPath,{source="openAppNewWindow"}={}){
    return activate(appId,{initialPath,source,newWindow:true});
  }
  function activateWindow(windowId,{source="api"}={}){
    const id=String(windowId||"");
    const win=document.querySelector('#window-layer > .window[data-id="'+CSS.escape(id)+'"]');
    if(!win)return null;
    restoreAndFocus(win);
    record("activated-window",win.dataset.app,win,source);
    return win;
  }

  function closeApp(appId,{all=false,desktop=currentDesktop(),source="api"}={}){
    const id=appIdOf(appId),list=windows(id,{desktop});
    if(!list.length)return 0;
    const targets=all?list:[findExisting(id,desktop)||list[0]];
    let count=0;
    for(const win of targets){
      if(!win?.isConnected)continue;
      closeWindow(win);count++;
    }
    bus.emit("app-session:closed",{version:VERSION,time:Date.now(),appId:id,count,desktop:Number(desktop),source:String(source).slice(0,64)});
    return count;
  }
  function snapshot({desktop=null}={}){
    const list=windows(null,{desktop}),groups=new Map();
    for(const win of list){
      const id=win.dataset.app||"unknown";
      if(!groups.has(id))groups.set(id,[]);
      groups.get(id).push(win);
    }
    return [...groups.entries()].map(([appId,wins])=>({
      appId,name:APPS?.[appId]?.name||appId,policy:policy(appId).mode,
      count:wins.length,visible:wins.filter(w=>!w.classList.contains("hidden")).length,
      focused:wins.some(w=>w.classList.contains("focused")&&!w.classList.contains("hidden")),
      desktops:[...new Set(wins.map(w=>Number(w.dataset.desktop||0)))].sort((a,b)=>a-b)
    })).sort((a,b)=>a.name.localeCompare(b.name,"pt"));
  }

  function diagnostics(){
    const all=snapshot(),single=Object.keys(APPS).filter(id=>policy(id).mode==="single").length;
    return Object.freeze({
      version:VERSION,runningApps:all.length,windows:all.reduce((n,x)=>n+x.count,0),
      singlePolicies:single,multiPolicies:Object.keys(APPS).length-single,
      historySize:history.length,historyLimit:HISTORY_LIMIT
    });
  }
  function renderSessions(box){
    box.querySelector("[data-app-sessions-v991]")?.remove();
    const rows=snapshot({desktop:currentDesktop()});
    const card=document.createElement("div");
    card.className="sys-card app-sessions-v991";
    card.dataset.appSessionsV991="";
    card.innerHTML='<div class="app-sessions-head-v991"><div><strong>Sessões de aplicações V9.9.1</strong>'+
      '<p>Políticas single/multi-instance e janelas no ambiente virtual atual.</p></div>'+
      '<span>'+rows.reduce((n,x)=>n+x.count,0)+' janela(s)</span></div>'+
      '<div class="app-sessions-list-v991">'+(rows.length?rows.map(item=>
        '<div class="app-session-row-v991" data-session-app="'+escapeHTML(item.appId)+'">'+
        '<span class="app-session-icon-v991">'+(APPS[item.appId]?.icon||"▣")+'</span>'+
        '<div><strong>'+escapeHTML(item.name)+'</strong><small>'+item.count+' janela(s) · '+
        (item.policy==="single"?"Instância única":"Múltiplas instâncias")+'</small></div>'+
        '<div class="app-session-actions-v991"><button class="sys-button" data-session-activate="'+escapeHTML(item.appId)+'">Ativar</button>'+
        '<button class="sys-button" data-session-close="'+escapeHTML(item.appId)+'">Fechar</button></div></div>'
      ).join(""):'<p class="app-sessions-empty-v991">Não existem aplicações abertas neste ambiente.</p>')+'</div>';

    (box.querySelector(".sys-grid")||box).appendChild(card);
    card.querySelectorAll("[data-session-activate]").forEach(btn=>btn.onclick=()=>{
      try{activate(btn.dataset.sessionActivate,{source:"settings-ui-v991"})}catch(error){notify("Sessões de aplicações",error?.message||"Não foi possível ativar a aplicação.")}
    });
    card.querySelectorAll("[data-session-close]").forEach(btn=>btn.onclick=()=>{
      try{closeApp(btn.dataset.sessionClose,{all:true,source:"settings-ui-v991"});renderSessions(box)}
      catch(error){notify("Sessões de aplicações",error?.message||"Não foi possível fechar a aplicação.")}
    });
    return card;
  }
  function scheduleRerender(){
    if(rerenderPending)return;rerenderPending=true;
    queueMicrotask(()=>{
      rerenderPending=false;
      if(state.settingsPage!=="apps")return;
      document.querySelectorAll('.window[data-app="settings"] [data-settings-page]').forEach(renderSessions);
    });
  }

  function openAppNewWindowV991(appId,initialPath){
    return openNew(appId,initialPath,{source:"openAppNewWindow-v991"});
  }
  globalThis.openAppNewWindow=openAppNewWindowV991;
  try{openAppNewWindow=openAppNewWindowV991}catch{}

  globalThis.renderSettingsPageV5=function(box,page){
    previousRenderSettingsPage(box,page);
    if(page==="apps")renderSessions(box);
  };
  try{renderSettingsPageV5=globalThis.renderSettingsPageV5}catch{}

  for(const topic of ["app:launched","app:activated","app:minimized","app:restored","app:closed","app:moved-desktop"]){
    bus.on(topic,scheduleRerender);
  }

  globalThis.Win11AppSessions=Object.freeze({
    version:VERSION,policy,activate,openNew,activateWindow,closeApp,snapshot,diagnostics,
    getHistory:(limit=20)=>clone(history.slice(0,Math.max(0,Math.min(HISTORY_LIMIT,Number(limit)||0)))),
    getWindows:(appId=null,options={})=>windows(appId,options).map(win=>lifecycle.getState(win.dataset.id)||{
      windowId:win.dataset.id,appId:win.dataset.app,desktop:Number(win.dataset.desktop||0)
    })
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:39,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "app-session-manager","single-instance-policies","multi-instance-policies",
      "session-activation","session-settings-ui","bounded-session-history"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
