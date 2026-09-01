"use strict";
(function installShellIntentsV990(){
  const VERSION="9.9.0";
  const INTENT_HISTORY_LIMIT=60;
  const LIFECYCLE_HISTORY_LIMIT=100;
  const bus=globalThis.Win11SystemBus;
  if(!bus||!globalThis.Win11DefaultApps||!globalThis.Win11AppRegistry){
    throw new Error("Shell Intents V9.9.0 requires System Bus and Apps Defaults.");
  }

  const intentHistory=[];
  const lifecycleHistory=[];
  const windowState=new Map();

  const SETTINGS_ROUTES=Object.freeze({
    "":"system","system":"system","display":"system","sound":"system",
    "notifications":"system","powersleep":"system","about":"system",
    "storage":"storage","system-storage":"storage","system-health":"health","health":"health",
    "bluetooth":"bluetooth","bluetooth-devices":"bluetooth",
    "network":"network","network-wifi":"network","network-ethernet":"network",
    "personalization":"personalization","personalization-background":"personalization",
    "apps":"apps","appsfeatures":"apps","defaultapps":"apps",
    "explorer":"explorer","accounts":"accounts",
    "dateandtime":"time","regionlanguage":"time","time-language":"time",
    "gaming":"gaming","accessibility":"accessibility","easeofaccess":"accessibility",
    "privacy":"privacy","privacy-general":"privacy",
    "windowsupdate":"update","windowsupdate-action":"update"
  });

  const SHELL_FOLDERS=Object.freeze({
    "thispc":"This PC","mycomputerfolder":"This PC",
    "desktop":"C:/Desktop","personal":"C:/Documents","documents":"C:/Documents",
    "downloads":"C:/Downloads","mypictures":"C:/Pictures","pictures":"C:/Pictures",
    "mymusic":"C:/Music","music":"C:/Music","myvideo":"C:/Videos","videos":"C:/Videos",
    "onedrive":"C:/OneDrive","recycle":"Recycle Bin","recyclebin":"Recycle Bin",
    "recyclebinfolder":"Recycle Bin"
  });

  function clone(value){
    try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}
  }
  function trimQuoted(value){
    value=String(value??"").trim();
    if(value.length>=2&&((value[0]==='"'&&value.at(-1)==='"')||(value[0]==="'"&&value.at(-1)==="'")))value=value.slice(1,-1).trim();
    return value;
  }
  function inputValue(value){
    const raw=trimQuoted(value);
    if(!raw||raw.length>2048||raw.includes("\0"))throw new TypeError("Intent inválido.");
    return raw;
  }
  function normalizeVirtualPath(value){
    let path=inputValue(value).replaceAll("\\","/").replace(/\/+/g,"/");
    if(/^this pc$/i.test(path))return "This PC";
    if(/^recycle bin$/i.test(path))return "Recycle Bin";
    if(!/^C:\//i.test(path))throw new TypeError("Caminho virtual inválido.");
    path="C:/"+path.slice(3).replace(/^\/+|\/+$/g,"");
    if(path.split("/").some(part=>part===".."||part==="."))throw new TypeError("Segmentos relativos não são permitidos.");
    if(path.length>512)throw new TypeError("Caminho virtual demasiado longo.");
    return path;
  }
  function settingsPageFor(route){
    const key=String(route||"").toLowerCase().split(/[?#]/)[0];
    return SETTINGS_ROUTES[key]||null;
  }
  function shellPathFor(route){
    const key=String(route||"").toLowerCase().replace(/\s+/g,"").split(/[?#]/)[0];
    if(key==="appsfolder")return null;
    return SHELL_FOLDERS[key]||null;
  }
  function resolve(input){
    let raw;
    try{raw=inputValue(input)}catch{return {kind:"unknown"}}
    const lower=raw.toLowerCase();

    if(/^https?:\/\//i.test(raw)){
      try{
        const url=new URL(raw);
        if(!["http:","https:"].includes(url.protocol))return {kind:"unknown"};
        return {kind:"url",url:url.href,scheme:url.protocol.slice(0,-1)};
      }catch{return {kind:"unknown"}}
    }

    if(lower.startsWith("ms-settings:")){
      const route=raw.slice(raw.indexOf(":")+1);
      const page=settingsPageFor(route);
      return page?{kind:"settings",page,route:route.toLowerCase()}:{kind:"unknown"};
    }

    if(lower.startsWith("shell:")){
      const route=raw.slice(raw.indexOf(":")+1);
      if(String(route).toLowerCase().replace(/\s+/g,"")==="appsfolder")return {kind:"settings",page:"apps",route:"appsfolder"};
      const path=shellPathFor(route);
      return path?{kind:"folder",path,route:String(route).toLowerCase()}:{kind:"unknown"};
    }

    if(lower.startsWith("app:")){
      const appId=raw.slice(raw.indexOf(":")+1).trim().toLowerCase();
      return APPS?.[appId]?{kind:"app",appId}:{kind:"unknown"};
    }

    if(/^C:[\\/]/i.test(raw)||/^this pc$/i.test(raw)||/^recycle bin$/i.test(raw)){
      let path;
      try{path=normalizeVirtualPath(raw)}catch{return {kind:"unknown"}}
      if(path==="This PC"||path==="Recycle Bin"||Object.prototype.hasOwnProperty.call(state.files||{},path)){
        return {kind:"folder",path};
      }
      const slash=path.lastIndexOf("/");
      if(slash>2){
        const parent=path.slice(0,slash),name=path.slice(slash+1),folder=state.files?.[parent];
        if(folder&&Object.prototype.hasOwnProperty.call(folder,name))return {kind:"file",path,parent,name};
      }
      return {kind:"unknown"};
    }

    return {kind:"unknown"};
  }

  function canOpen(input){return resolve(input).kind!=="unknown"}

  function recordIntent(stage,intent,source,result={}){
    const entry={
      version:VERSION,time:Date.now(),stage:String(stage),
      source:String(source||"api").slice(0,64),kind:intent.kind,
      page:intent.kind==="settings"?intent.page:null,
      appId:result.appId||intent.appId||null,
      scheme:intent.kind==="url"?intent.scheme:null,
      folder:intent.kind==="folder"?(intent.path==="This PC"?"this-pc":intent.path==="Recycle Bin"?"recycle":"virtual-folder"):null,
      ok:stage==="opened"
    };
    intentHistory.unshift(entry);
    if(intentHistory.length>INTENT_HISTORY_LIMIT)intentHistory.length=INTENT_HISTORY_LIMIT;
    return entry;
  }
  function emitIntent(stage,intent,source,result={}){
    const entry=recordIntent(stage,intent,source,result);
    bus.emit("shell:intent-"+stage,entry);
    return entry;
  }
  function syncSettingsWindow(win,page){
    if(!win)return false;
    const wrap=win.querySelector(".settings-v4"),button=wrap?.querySelector('[data-settings="'+CSS.escape(page)+'"]');
    if(button){button.click();return true}
    const box=wrap?.querySelector("[data-settings-page]");
    if(box&&typeof globalThis.renderSettingsPageV5==="function"){
      state.settingsPage=page;saveState();
      wrap.querySelectorAll("[data-settings]").forEach(b=>b.classList.toggle("active",b.dataset.settings===page));
      const mobile=wrap.querySelector(".settings-mobile-nav");if(mobile)mobile.value=page;
      globalThis.renderSettingsPageV5(box,page);return true;
    }
    return false;
  }
  function openSettings(page,{source="api"}={}){
    if(!Object.values(SETTINGS_ROUTES).includes(page))throw new RangeError("Página de Definições não suportada.");
    state.settingsPage=page;saveState();
    const win=(globalThis.openApp||openApp)("settings");
    syncSettingsWindow(win,page);
    bus.emit("shell:settings-opened",{source:String(source).slice(0,64),page,windowId:win?.dataset?.id||null});
    return {kind:"settings",page,appId:"settings",windowId:win?.dataset?.id||null};
  }
  function openAppIntent(appId,{newWindow=false,initialPath,source="api"}={}){
    appId=String(appId||"").toLowerCase();
    if(!APPS?.[appId])throw new RangeError("Aplicação não suportada.");
    const fn=newWindow&&globalThis.openAppNewWindow?globalThis.openAppNewWindow:(globalThis.openApp||openApp);
    const win=fn(appId,initialPath);
    bus.emit("shell:app-opened",{source:String(source).slice(0,64),appId,windowId:win?.dataset?.id||null,newWindow:Boolean(newWindow)});
    return {kind:"app",appId,windowId:win?.dataset?.id||null};
  }
  function openFolder(path,{newWindow=false,source="api"}={}){
    path=normalizeVirtualPath(path);
    if(path==="Recycle Bin"){
      const result=openAppIntent("recycle",{newWindow,source});
      return {...result,kind:"folder",folder:"recycle"};
    }
    const fn=newWindow&&globalThis.openAppNewWindow?globalThis.openAppNewWindow:(globalThis.openApp||openApp);
    const win=fn("explorer",path);
    bus.emit("shell:folder-opened",{source:String(source).slice(0,64),windowId:win?.dataset?.id||null,newWindow:Boolean(newWindow),folder:path==="This PC"?"this-pc":"virtual-folder"});
    return {kind:"folder",appId:"explorer",windowId:win?.dataset?.id||null,path};
  }
  function openUrl(url,{source="api"}={}){
    const parsed=new URL(inputValue(url));
    if(!["http:","https:"].includes(parsed.protocol))throw new TypeError("Protocolo não suportado.");
    globalThis.Win11ProtocolRegistry.open(parsed.href);
    return {kind:"url",appId:globalThis.Win11ProtocolRegistry.get(parsed.protocol.slice(0,-1)),scheme:parsed.protocol.slice(0,-1)};
  }
  async function openFileIntent(intent,{source="api"}={}){
    const folder=state.files?.[intent.parent];
    if(!folder||!Object.prototype.hasOwnProperty.call(folder,intent.name))throw new Error("Ficheiro virtual não encontrado.");
    const appId=globalThis.Win11DefaultApps.forFile(intent.name);
    if(!appId)throw new Error("Não existe aplicação predefinida para este ficheiro.");
    if(typeof globalThis.openFile!=="function")throw new Error("Integração de ficheiros indisponível.");
    await globalThis.openFile(intent.parent,intent.name,folder[intent.name]);
    bus.emit("shell:file-opened",{source:String(source).slice(0,64),appId});
    return {kind:"file",appId};
  }
  function open(input,options={}){
    const intent=typeof input==="object"&&input?.kind?clone(input):resolve(input);
    const source=String(options.source||"api").slice(0,64);
    if(intent.kind==="unknown")throw new RangeError("Intent não suportado.");
    emitIntent("requested",intent,source);
    try{
      let result;
      if(intent.kind==="settings")result=openSettings(intent.page,{...options,source});
      else if(intent.kind==="app")result=openAppIntent(intent.appId,{...options,source});
      else if(intent.kind==="folder")result=openFolder(intent.path,{...options,source});
      else if(intent.kind==="url")result=openUrl(intent.url,{...options,source});
      else if(intent.kind==="file"){
        const promise=openFileIntent(intent,{...options,source});
        return promise.then(value=>{emitIntent("opened",intent,source,value);return value}).catch(error=>{
          bus.emit("shell:intent-failed",{source,kind:intent.kind,error:String(error?.message||error).slice(0,160)});
          throw error;
        });
      }else throw new RangeError("Intent não suportado.");
      emitIntent("opened",intent,source,result);
      return result;
    }catch(error){
      bus.emit("shell:intent-failed",{source,kind:intent.kind,error:String(error?.message||error).slice(0,160)});
      throw error;
    }
  }

  function publicRoutes(){
    return {
      settings:Object.keys(SETTINGS_ROUTES).filter(Boolean),
      shell:[...new Set(Object.keys(SHELL_FOLDERS).concat("appsfolder"))],
      schemes:["http","https","app","ms-settings","shell"]
    };
  }

  function windowSnapshot(win){
    return {
      windowId:win?.dataset?.id||null,
      appId:win?.dataset?.app||null,
      pid:Number(win?.dataset?.pid)||null,
      desktop:Number(win?.dataset?.desktop)||0,
      hidden:Boolean(win?.classList?.contains("hidden")),
      focused:Boolean(win?.classList?.contains("focused")),
      maximized:Boolean(win?.classList?.contains("maximized"))
    };
  }
  function lifecycleEvent(type,snapshot,extra={}){
    const event={version:VERSION,time:Date.now(),type,...snapshot,...extra};
    lifecycleHistory.unshift(event);
    if(lifecycleHistory.length>LIFECYCLE_HISTORY_LIMIT)lifecycleHistory.length=LIFECYCLE_HISTORY_LIMIT;
    bus.emit("app:"+type,event);
    return event;
  }
  function trackWindow(win,{initial=false}={}){
    if(!win?.matches?.(".window"))return;
    const next=windowSnapshot(win),previous=windowState.get(next.windowId);
    windowState.set(next.windowId,next);
    if(!previous){
      if(!initial){
        lifecycleEvent("launched",next);
        if(next.focused&&!next.hidden)lifecycleEvent("activated",next);
      }
      return;
    }
    if(previous.hidden!==next.hidden)lifecycleEvent(next.hidden?"minimized":"restored",next);
    if(!previous.focused&&next.focused&&!next.hidden)lifecycleEvent("activated",next);
    if(previous.maximized!==next.maximized)lifecycleEvent(next.maximized?"maximized":"unmaximized",next);
    if(previous.desktop!==next.desktop)lifecycleEvent("moved-desktop",next,{fromDesktop:previous.desktop});
  }
  function untrackWindow(win){
    const id=win?.dataset?.id;
    if(!id)return;
    const previous=windowState.get(id)||windowSnapshot(win);
    windowState.delete(id);
    lifecycleEvent("closed",previous);
  }

  const layer=document.querySelector("#window-layer");
  if(layer){
    layer.querySelectorAll(":scope > .window").forEach(win=>trackWindow(win,{initial:true}));
    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.type==="childList"){
          for(const node of record.addedNodes){
            if(node.nodeType!==1)continue;
            if(node.matches?.(".window"))trackWindow(node);
            node.querySelectorAll?.(".window").forEach(win=>trackWindow(win));
          }
          for(const node of record.removedNodes){
            if(node.nodeType!==1)continue;
            if(node.matches?.(".window"))untrackWindow(node);
            node.querySelectorAll?.(".window").forEach(win=>untrackWindow(win));
          }
        }else if(record.type==="attributes"&&record.target.matches?.(".window")){
          trackWindow(record.target);
        }
      }
    });
    observer.observe(layer,{childList:true,subtree:true,attributes:true,attributeFilter:["class","data-desktop"]});
  }

  globalThis.Win11Shell=Object.freeze({
    version:VERSION,resolve,canOpen,open,openSettings,openApp:openAppIntent,
    openFolder,openUrl,normalizeVirtualPath,routes:publicRoutes,
    getHistory:(limit=20)=>clone(intentHistory.slice(0,Math.max(0,Math.min(INTENT_HISTORY_LIMIT,Number(limit)||0)))),
    diagnostics:()=>Object.freeze({version:VERSION,historySize:intentHistory.length,routes:publicRoutes()})
  });

  globalThis.Win11AppLifecycle=Object.freeze({
    version:VERSION,
    snapshot:()=>[...document.querySelectorAll("#window-layer > .window")].map(windowSnapshot),
    getWindows:(appId=null)=>[...document.querySelectorAll("#window-layer > .window")]
      .map(windowSnapshot).filter(w=>!appId||w.appId===appId),
    getHistory:(limit=30,type=null)=>clone(lifecycleHistory.filter(e=>!type||e.type===type)
      .slice(0,Math.max(0,Math.min(LIFECYCLE_HISTORY_LIMIT,Number(limit)||0)))),
    getState:windowId=>clone(windowState.get(String(windowId))||null),
    diagnostics:()=>Object.freeze({
      version:VERSION,windows:document.querySelectorAll("#window-layer > .window").length,
      tracked:windowState.size,historySize:lifecycleHistory.length
    })
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:38,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "shell-intent-router","ms-settings-deep-links","shell-folder-intents",
      "virtual-path-intents","app-lifecycle-events","bounded-lifecycle-history",
      "run-intent-routing","terminal-intent-routing","powershell-intent-routing"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
