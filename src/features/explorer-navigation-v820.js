"use strict";
(function installExplorerNavigationV820(){
  const previousBuildExplorer=globalThis.buildExplorerV5;
  if(typeof previousBuildExplorer!=="function")throw new Error("Explorer V5 must load before Explorer Navigation V8.2.");

  const aliases=new Map([
    ["este pc","This PC"],["this pc","This PC"],["reciclagem","Recycle Bin"],
    ["documentos","C:/Documents"],["downloads","C:/Downloads"],["transferências","C:/Downloads"],
    ["ambiente de trabalho","C:/Desktop"],["desktop","C:/Desktop"],["onedrive","C:/OneDrive"],
    ["imagens","C:/Pictures"],["pictures","C:/Pictures"],["música","C:/Music"],["music","C:/Music"],
    ["vídeos","C:/Videos"],["videos","C:/Videos"]
  ]);

  function normalizePath(raw){
    let value=String(raw||"").trim();
    if(!value)return "";
    const alias=aliases.get(value.toLocaleLowerCase("pt-PT"));
    if(alias)return alias;
    value=value.replace(/\\/g,"/").replace(/\/{2,}/g,"/");
    if(/^c:\/?$/i.test(value))return "C:/Documents";
    if(/^c:\//i.test(value))value="C:/"+value.slice(3);
    if(value.length>3)value=value.replace(/\/$/,"");
    return value;
  }  const systemFolders=new Set([
    "C:/Desktop","C:/Documents","C:/Downloads","C:/OneDrive",
    "C:/Pictures","C:/Music","C:/Videos"
  ]);

  function pathExists(path){
    const p=normalizePath(path);
    if(p==="This PC"||p==="Recycle Bin"||systemFolders.has(p))return true;
    if(!/^C:\//i.test(p))return false;
    if(Object.prototype.hasOwnProperty.call(state.files||{},p))return true;
    return Object.keys(state.files||{}).some(x=>x.startsWith(p+"/"));
  }

  function titleForPath(path){
    const p=normalizePath(path)||"This PC";
    if(p==="This PC")return "Este PC";
    if(p==="Recycle Bin")return "Reciclagem";
    return p.split("/").filter(Boolean).pop()||"Explorador";
  }

  function ensureNavigationState(){
    if(!state.explorerNavigationV83||typeof state.explorerNavigationV83!=="object"){
      const legacy=state.explorerNavigationV821&&typeof state.explorerNavigationV821==="object"
        ?state.explorerNavigationV821:{};
      state.explorerNavigationV83={
        lastSession:legacy.lastSession||null,
        closedTabs:Array.isArray(legacy.closedTabs)?legacy.closedTabs:[],
        quickAccess:["C:/Desktop","C:/Documents","C:/Downloads"]
      };
    }
    const s=state.explorerNavigationV83;
    if(!Array.isArray(s.closedTabs))s.closedTabs=[];
    if(!s.windowSessions||typeof s.windowSessions!=="object")s.windowSessions={};
    const sessionEntries=Object.entries(s.windowSessions);
    if(sessionEntries.length>16){
      const keep=new Set(sessionEntries.sort((a,b)=>(Number(b[1]?.updatedAt)||0)-(Number(a[1]?.updatedAt)||0)).slice(0,16).map(([k])=>k));
      for(const key of Object.keys(s.windowSessions))if(!keep.has(key))delete s.windowSessions[key];
    }
    if(!Array.isArray(s.quickAccess))s.quickAccess=["C:/Desktop","C:/Documents","C:/Downloads"];
    s.quickAccess=[...new Set(s.quickAccess.map(normalizePath).filter(p=>p&&pathExists(p)))].slice(0,12);
    return s;
  }

  function sanitizeHistory(history,fallback){
    const clean=(Array.isArray(history)?history:[])
      .map(normalizePath).filter(p=>p&&pathExists(p)).slice(-80);
    const safe=normalizePath(fallback);
    if(!clean.length)clean.push(pathExists(safe)?safe:"This PC");
    return clean;
  }

  function currentPath(wrap){
    try{
      const p=globalThis.Win11ExplorerPro?.currentVirtualPath?.(wrap);
      if(p)return normalizePath(p);
    }catch{}
    return normalizePath(wrap.querySelector(".pathbar")?.textContent)||"This PC";
  }

  function installNavigation(wrap,win,startPath){
    if(!wrap||wrap.dataset.explorerNavigationV820==="1")return;
    wrap.dataset.explorerNavigationV820="1";
    wrap.classList.add("explorer-navigation-v820");
    const tabBar=wrap.querySelector(".explorer-tabs");
    const pathbar=wrap.querySelector(".pathbar");
    const address=wrap.querySelector(".explorer-address");
    const aside=wrap.querySelector("aside");
    if(!tabBar||!pathbar||!address)return;    let seq=0;
    let activeId=null;
    let suppressPathRecord=false;
    let pathTimer=0,suppressTimer=0,draggedTabId=null;
    const initial=normalizePath(currentPath(wrap)||startPath)||"This PC";
    const navState=ensureNavigationState();
    const desktopIndex=Number(win?.dataset?.desktop||state.currentDesktop||0);
    const explorerWindows=[...document.querySelectorAll('#window-layer > .window[data-app="explorer"]')]
      .filter(w=>Number(w.dataset.desktop||0)===desktopIndex);
    const isPrimaryWindow=explorerWindows[0]===win;
    const sessionKey=isPrimaryWindow
      ?"desktop:"+desktopIndex+":primary"
      :"desktop:"+desktopIndex+":"+(win?.dataset?.id||Math.random().toString(36).slice(2));
    if(win)win.dataset.explorerSessionV930=sessionKey;
    if(!navState.windowSessions[sessionKey]||typeof navState.windowSessions[sessionKey]!=="object"){
      navState.windowSessions[sessionKey]={
        lastSession:isPrimaryWindow?(navState.lastSession||null):null,
        closedTabs:isPrimaryWindow&&Array.isArray(navState.closedTabs)?navState.closedTabs.slice():[],
        updatedAt:Date.now()
      };
    }
    const windowSession=navState.windowSessions[sessionKey];
    if(!Array.isArray(windowSession.closedTabs))windowSession.closedTabs=[];
    let tabs=[];
    let restoredSession=false;

    function makeTab(path,snapshot=null){
      const fallback=normalizePath(path)||"This PC";
      const history=sanitizeHistory(snapshot?.history,fallback);
      let index=Number.isInteger(snapshot?.index)?snapshot.index:history.length-1;
      index=Math.max(0,Math.min(index,history.length-1));
      let current=normalizePath(snapshot?.path);
      if(!pathExists(current))current=history[index]||fallback;
      const matched=history.lastIndexOf(current);
      if(matched>=0)index=matched;
      else{history.push(current);index=history.length-1}
      return {id:"explorer-tab-"+(++seq),path:current,history:history.slice(-80),index,title:titleForPath(current),pinned:!!snapshot?.pinned};
    }

    if(startPath==="This PC"&&win?.dataset?.explorerExplicitStart!=="1"&&windowSession.lastSession?.tabs?.length){
      tabs=windowSession.lastSession.tabs.slice(0,12).map(s=>makeTab(s?.path||"This PC",s));
      const activeIndex=Math.max(0,Math.min(Number(windowSession.lastSession.activeIndex)||0,tabs.length-1));
      activeId=tabs[activeIndex]?.id||tabs[0]?.id||null;
      restoredSession=tabs.length>0;
    }
    if(!tabs.length){tabs=[makeTab(initial)];activeId=tabs[0].id}
    tabs=[...tabs.filter(t=>t.pinned),...tabs.filter(t=>!t.pinned)];

    function activeTab(){return tabs.find(t=>t.id===activeId)||tabs[0]}

    function snapshotTab(tab){
      if(!tab)return null;
      return {
        path:normalizePath(tab.path)||"This PC",
        history:sanitizeHistory(tab.history,tab.path),
        index:Number.isInteger(tab.index)?tab.index:0,
        pinned:!!tab.pinned
      };
    }

    function persistSession(){
      if(isMountedMode())return;
      const activeIndex=Math.max(0,tabs.findIndex(t=>t.id===activeId));
      windowSession.lastSession={tabs:tabs.map(snapshotTab).filter(Boolean).slice(0,12),activeIndex};
      windowSession.closedTabs=windowSession.closedTabs.slice(-20);
      windowSession.updatedAt=Date.now();
      if(isPrimaryWindow){
        navState.lastSession=windowSession.lastSession;
        navState.closedTabs=windowSession.closedTabs.slice();
      }
      saveState();
    }

    function pushClosed(tab){
      const snap=snapshotTab(tab);
      if(!snap)return;
      windowSession.closedTabs.push(snap);
      windowSession.closedTabs=windowSession.closedTabs.slice(-20);
      if(isPrimaryWindow)navState.closedTabs=windowSession.closedTabs.slice();
    }

    function isMountedMode(){
      return wrap.classList.contains("real-mount-mode");
    }

    function notifyMounted(){
      notify("Explorador","Os separadores virtuais ficam em pausa enquanto está aberta uma pasta real montada.");
    }

    function normalizeTabOrder(){
      tabs=[...tabs.filter(t=>t.pinned),...tabs.filter(t=>!t.pinned)];
    }

    function togglePinTab(id){
      const tab=tabs.find(t=>t.id===id);
      if(!tab||isMountedMode())return false;
      tab.pinned=!tab.pinned;
      normalizeTabOrder();
      renderTabs();
      persistSession();
      return tab.pinned;
    }

    function reorderTab(sourceId,targetId){
      if(sourceId===targetId||isMountedMode())return false;
      const source=tabs.find(t=>t.id===sourceId),target=tabs.find(t=>t.id===targetId);
      if(!source||!target||source.pinned!==target.pinned)return false;
      const from=tabs.indexOf(source),to=tabs.indexOf(target);
      tabs.splice(from,1);
      const nextTarget=tabs.indexOf(target);
      tabs.splice(nextTarget<0?tabs.length:nextTarget,0,source);
      normalizeTabOrder();
      renderTabs();
      persistSession();
      return true;
    }

    function renderTabs(){
      tabBar.innerHTML="";
      for(const tab of tabs){
        const button=document.createElement("button");
        button.className="explorer-tab-v820"+(tab.id===activeId?" active":"")+(tab.pinned?" pinned":"");
        button.dataset.explorerTabId=tab.id;
        button.dataset.pinned=tab.pinned?"1":"0";
        button.draggable=true;
        button.title=(tab.pinned?"Fixado · ":"")+tab.path;
        const marker=tab.id===activeId?' data-explorer-tab-title':"";
        button.innerHTML='<span class="explorer-tab-folder" aria-hidden="true">'+(tab.pinned?"●":"▣")+'</span>'+
          '<span class="explorer-tab-label"'+marker+'>'+escapeHTML(tab.title)+'</span>'+
          '<span class="explorer-tab-close" role="button" aria-label="Fechar separador">×</span>';
        button.onclick=e=>{
          if(e.target.closest(".explorer-tab-close"))return;
          switchTab(tab.id);
        };
        button.querySelector(".explorer-tab-close").onclick=e=>{
          e.stopPropagation();
          closeTab(tab.id);
        };
        button.onauxclick=e=>{if(e.button===1){e.preventDefault();closeTab(tab.id)}};
        button.ondragstart=e=>{
          draggedTabId=tab.id;
          button.classList.add("dragging");
          try{e.dataTransfer.setData("application/x-win11-explorer-tab",tab.id);e.dataTransfer.effectAllowed="move"}catch{}
        };
        button.ondragend=()=>{draggedTabId=null;button.classList.remove("dragging");tabBar.querySelectorAll(".drag-over").forEach(x=>x.classList.remove("drag-over"))};
        button.ondragover=e=>{
          const source=tabs.find(t=>t.id===draggedTabId);
          if(!source||source.pinned!==tab.pinned)return;
          e.preventDefault();e.dataTransfer.dropEffect="move";button.classList.add("drag-over");
        };
        button.ondragleave=()=>button.classList.remove("drag-over");
        button.ondrop=e=>{
          e.preventDefault();button.classList.remove("drag-over");
          const sourceId=draggedTabId||e.dataTransfer?.getData("application/x-win11-explorer-tab");
          reorderTab(sourceId,tab.id);
        };
        button.oncontextmenu=e=>{
          e.preventDefault();
          const inQuick=navState.quickAccess.includes(tab.path);
          const menu=[
            ["Novo separador",()=>newTab("This PC")],
            ["Duplicar separador",()=>duplicateTab(tab.id)],
            [tab.pinned?"Desafixar separador":"Fixar separador",()=>togglePinTab(tab.id)],
            [inQuick?"Remover do Acesso rápido":"Adicionar ao Acesso rápido",()=>inQuick?removeQuickAccess(tab.path):addQuickAccess(tab.path)]
          ];
          if(navState.closedTabs.length)menu.push(["Reabrir separador fechado",()=>reopenClosedTab()]);
          menu.push(
            ["Fechar separador",()=>closeTab(tab.id)],
            ["Fechar outros separadores",()=>closeOtherTabs(tab.id)],
            ["Fechar separadores à direita",()=>closeTabsToRight(tab.id)]
          );
          showContext(e.clientX,e.clientY,menu);
        };
        tabBar.appendChild(button);
      }
      const add=document.createElement("button");
      add.className="explorer-tab-new-v820";
      add.dataset.newExplorerTab="1";
      add.title="Novo separador";
      add.setAttribute("aria-label","Novo separador");
      add.textContent="＋";
      add.onclick=()=>newTab("This PC");
      tabBar.appendChild(add);
      renderQuickAccess();
    }

    function renderQuickAccess(){
      if(!aside)return;
      let host=aside.querySelector(".explorer-quick-access-v830");
      if(!host){
        host=document.createElement("section");
        host.className="explorer-quick-access-v830";
        host.innerHTML='<div class="explorer-quick-title-v830">Acesso rápido</div><div data-quick-access-items></div>';
        aside.insertBefore(host,aside.firstChild);
      }
      const items=host.querySelector("[data-quick-access-items]");
      items.innerHTML="";
      for(const path of navState.quickAccess){
        const row=document.createElement("button");
        row.className="nav-item explorer-quick-item-v830";
        row.dataset.path=path;
        row.title=path;
        row.innerHTML='<span aria-hidden="true">☆</span><span>'+escapeHTML(titleForPath(path))+'</span>';
        row.classList.toggle("active",activeTab()?.path===path);
        row.onclick=()=>go(path);
        row.oncontextmenu=e=>{
          e.preventDefault();
          showContext(e.clientX,e.clientY,[["Remover do Acesso rápido",()=>removeQuickAccess(path)]]);
        };
        items.appendChild(row);
      }
    }

    function addQuickAccess(path){
      const p=normalizePath(path);
      if(!p||!pathExists(p)||p==="This PC"||p==="Recycle Bin")return false;
      if(navState.quickAccess.includes(p))return true;
      if(navState.quickAccess.length>=12){
        notify("Explorador","O Acesso rápido já tem 12 localizações.");
        return false;
      }
      navState.quickAccess.push(p);
      renderQuickAccess();
      persistSession();
      return true;
    }

    function removeQuickAccess(path){
      const p=normalizePath(path);
      const before=navState.quickAccess.length;
      navState.quickAccess=navState.quickAccess.filter(x=>x!==p);
      if(navState.quickAccess.length===before)return false;
      renderQuickAccess();
      persistSession();
      return true;
    }

    function dispatchPath(path){
      suppressPathRecord=true;
      win.dispatchEvent(new CustomEvent("navigate",{detail:path}));
      wrap.__explorerProV740?.refresh?.();
      wrap.__explorerRecycleV950?.refresh?.();
      clearTimeout(suppressTimer);
      suppressTimer=setTimeout(()=>{suppressPathRecord=false;syncFromPathbar()},60);
    }    function recordPath(path){
      const tab=activeTab();
      const p=normalizePath(path);
      if(!tab||!p||p===tab.path)return;
      tab.history=tab.history.slice(0,tab.index+1);
      tab.history.push(p);
      tab.history=tab.history.slice(-80);
      tab.index=tab.history.length-1;
      tab.path=p;
      tab.title=titleForPath(p);
      renderTabs();
      persistSession();
    }

    function go(path,{record=true}={}){
      if(isMountedMode()){notifyMounted();return false}
      const p=normalizePath(path);
      if(!pathExists(p)){
        notify("Explorador","O caminho não existe no sistema de ficheiros virtual.");
        return false;
      }
      const tab=activeTab();
      if(record&&tab&&p!==tab.path){
        tab.history=tab.history.slice(0,tab.index+1);
        tab.history.push(p);
        tab.history=tab.history.slice(-80);
        tab.index=tab.history.length-1;
      }
      if(tab){tab.path=p;tab.title=titleForPath(p)}
      renderTabs();
      persistSession();
      dispatchPath(p);
      return true;
    }

    function switchTab(id){
      if(isMountedMode()){notifyMounted();return}
      if(id===activeId)return;
      const tab=tabs.find(t=>t.id===id);
      if(!tab)return;
      activeId=id;
      renderTabs();
      persistSession();
      dispatchPath(tab.path);
    }    function newTab(path="This PC"){
      if(isMountedMode()){notifyMounted();return null}
      if(tabs.length>=12){
        notify("Explorador","Máximo de 12 separadores por janela.");
        return null;
      }
      const tab=makeTab(path);
      tabs.push(tab);
      activeId=tab.id;
      renderTabs();
      persistSession();
      dispatchPath(tab.path);
      return tab;
    }

    function duplicateTab(id=activeId){
      if(isMountedMode()){notifyMounted();return null}
      if(tabs.length>=12){notify("Explorador","Máximo de 12 separadores por janela.");return null}
      const source=tabs.find(t=>t.id===id)||activeTab();
      if(!source)return null;
      const copy=makeTab(source.path,snapshotTab(source));
      const index=Math.max(0,tabs.findIndex(t=>t.id===source.id));
      tabs.splice(index+1,0,copy);
      normalizeTabOrder();
      activeId=copy.id;
      renderTabs();
      persistSession();
      dispatchPath(copy.path);
      return copy;
    }

    function reopenClosedTab(){
      if(isMountedMode()){notifyMounted();return null}
      if(tabs.length>=12||!windowSession.closedTabs.length)return null;
      const snap=windowSession.closedTabs.pop();
      if(isPrimaryWindow)navState.closedTabs=windowSession.closedTabs.slice();
      const tab=makeTab(snap?.path||"This PC",snap);
      tabs.push(tab);
      normalizeTabOrder();
      activeId=tab.id;
      renderTabs();
      persistSession();
      dispatchPath(tab.path);
      return tab;
    }

    function closeOtherTabs(id){
      if(isMountedMode()){notifyMounted();return}
      const keep=tabs.find(t=>t.id===id);
      if(!keep)return;
      const doomed=tabs.filter(t=>t.id!==id&&!t.pinned);
      doomed.forEach(pushClosed);
      tabs=tabs.filter(t=>t.id===id||t.pinned);
      normalizeTabOrder();
      activeId=keep.id;
      renderTabs();persistSession();dispatchPath(keep.path);
    }

    function closeTabsToRight(id){
      if(isMountedMode()){notifyMounted();return}
      const index=tabs.findIndex(t=>t.id===id);
      if(index<0||index===tabs.length-1)return;
      const doomed=tabs.slice(index+1).filter(t=>!t.pinned);
      if(!doomed.length)return;
      doomed.forEach(pushClosed);
      const doomedIds=new Set(doomed.map(t=>t.id));
      tabs=tabs.filter(t=>!doomedIds.has(t.id));
      normalizeTabOrder();
      if(!tabs.some(t=>t.id===activeId))activeId=id;
      renderTabs();persistSession();dispatchPath(activeTab().path);
    }

    function closeTab(id){
      if(isMountedMode()){notifyMounted();return}
      const index=tabs.findIndex(t=>t.id===id);
      if(index<0)return;
      const closing=tabs[index];
      pushClosed(closing);
      if(tabs.length===1){
        persistSession();
        try{closeWindow(win)}catch{win?.remove?.()}
        return;
      }
      const wasActive=id===activeId;
      tabs.splice(index,1);
      if(wasActive)activeId=tabs[Math.min(index,tabs.length-1)].id;
      renderTabs();
      persistSession();
      if(wasActive)dispatchPath(activeTab().path);
    }

    function travel(delta){
      if(isMountedMode()){notifyMounted();return}
      const tab=activeTab();
      if(!tab)return;
      const next=tab.index+delta;
      if(next<0||next>=tab.history.length)return;
      tab.index=next;
      tab.path=tab.history[next];
      tab.title=titleForPath(tab.path);
      renderTabs();
      persistSession();
      dispatchPath(tab.path);
    }    function cycle(delta){
      if(tabs.length<2||isMountedMode())return;
      const index=tabs.findIndex(t=>t.id===activeId);
      const next=(index+delta+tabs.length)%tabs.length;
      switchTab(tabs[next].id);
    }

    const shell=document.createElement("div");
    shell.className="explorer-location-shell-v820";
    pathbar.parentNode.insertBefore(shell,pathbar);
    shell.appendChild(pathbar);
    const input=document.createElement("input");
    input.className="explorer-location-input-v820";
    input.setAttribute("aria-label","Caminho");
    input.autocomplete="off";
    shell.appendChild(input);

    function startAddressEdit(){
      if(isMountedMode()){notifyMounted();return}
      shell.classList.add("editing");
      input.value=activeTab()?.path||currentPath(wrap);
      input.focus();
      input.select();
    }

    function finishAddressEdit(commit){
      if(commit){
        const value=normalizePath(input.value);
        if(!go(value,{record:true})){input.focus();input.select();return}
      }
      shell.classList.remove("editing");
    }

    input.onkeydown=e=>{
      if(e.key==="Enter"){e.preventDefault();finishAddressEdit(true)}
      else if(e.key==="Escape"){e.preventDefault();finishAddressEdit(false)}
    };
    input.onblur=()=>setTimeout(()=>{if(document.activeElement!==input)shell.classList.remove("editing")},0);
    pathbar.addEventListener("dblclick",e=>{if(e.target===pathbar||e.target.closest(".crumb"))startAddressEdit()});    const back=wrap.querySelector("[data-back]");
    const forward=wrap.querySelector("[data-forward]");
    if(back)back.onclick=()=>travel(-1);
    if(forward)forward.onclick=()=>travel(1);

    function onKeyDown(e){
      const focused=win?.classList?.contains("focused");
      if(!focused)return;
      const ctrl=e.ctrlKey||e.metaKey;
      if(ctrl&&e.key.toLowerCase()==="l"){
        e.preventDefault();startAddressEdit();return;
      }
      if(ctrl&&e.shiftKey&&e.key.toLowerCase()==="t"){
        e.preventDefault();reopenClosedTab();return;
      }
      if(ctrl&&e.key.toLowerCase()==="t"&&!e.shiftKey){
        e.preventDefault();newTab("This PC");return;
      }
      if(ctrl&&e.key.toLowerCase()==="w"&&!e.shiftKey){
        e.preventDefault();closeTab(activeId);return;
      }
      if(ctrl&&e.key==="Tab"){
        e.preventDefault();cycle(e.shiftKey?-1:1);return;
      }
      if(e.altKey&&e.key==="ArrowLeft"){
        e.preventDefault();travel(-1);return;
      }
      if(e.altKey&&e.key==="ArrowRight"){
        e.preventDefault();travel(1);
      }
    }
    document.addEventListener("keydown",onKeyDown,true);

    function syncFromPathbar(){
      if(suppressPathRecord||isMountedMode())return;
      const p=currentPath(wrap);
      if(!p)return;
      recordPath(p);
      if(!shell.classList.contains("editing"))input.value=p;
    }    const observer=new MutationObserver(()=>{
      clearTimeout(pathTimer);
      pathTimer=setTimeout(syncFromPathbar,0);
    });
    observer.observe(pathbar,{childList:true,subtree:true,characterData:true});

    const cleanup=setInterval(()=>{
      if(wrap.isConnected)return;
      clearInterval(cleanup);
      clearTimeout(pathTimer);
      clearTimeout(suppressTimer);
      observer.disconnect();
      document.removeEventListener("keydown",onKeyDown,true);
    },1000);

    const navigationApi=Object.freeze({
      newTab,closeTab,duplicateTab,reopenClosedTab,closeOtherTabs,closeTabsToRight,
      togglePinTab,reorderTab,addQuickAccess,removeQuickAccess,
      switchTab,go,back:()=>travel(-1),forward:()=>travel(1),
      getTabs:()=>tabs.map(t=>({...t,history:t.history.slice()})),
      getActiveId:()=>activeId,
      getClosedTabs:()=>windowSession.closedTabs.map(x=>({...x,history:[...(x.history||[])]})),
      getSessionKey:()=>sessionKey,
      getQuickAccess:()=>navState.quickAccess.slice()
    });
    wrap.__explorerNavigationV820=navigationApi;
    if(win)win.__explorerNavigationV820=navigationApi;
    renderTabs();
    input.value=activeTab()?.path||initial;
    if(restoredSession&&activeTab()?.path!==initial)dispatchPath(activeTab().path);
    else persistSession();
  }

  globalThis.buildExplorerV5=function(wrap,win,startPath){
    previousBuildExplorer(wrap,win,startPath);
    installNavigation(wrap,win,startPath);
  };
  try{buildExplorerV5=globalThis.buildExplorerV5}catch{}

  globalThis.Win11ExplorerNavigation=Object.freeze({
    version:"9.3.0",normalizePath,pathExists,titleForPath,installNavigation
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"9.3.0",step:16,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-tabs","explorer-tab-history","explorer-editable-address",
      "explorer-ctrl-t","explorer-ctrl-w","explorer-ctrl-tab","explorer-alt-history",
      "explorer-safe-address-validation","explorer-tab-session-restore",
      "explorer-reopen-closed-tab","explorer-duplicate-tab","explorer-tab-context-menu",
      "explorer-tab-drag-reorder","explorer-pinned-tabs","explorer-quick-access",
      "explorer-quick-access-profile-state","explorer-pinned-tab-protection"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();