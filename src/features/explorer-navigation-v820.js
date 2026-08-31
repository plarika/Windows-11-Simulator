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
    if(!tabBar||!pathbar||!address)return;    let seq=0;
    let activeId=null;
    let suppressPathRecord=false;
    let pathTimer=0,suppressTimer=0;
    const initial=normalizePath(currentPath(wrap)||startPath)||"This PC";
    const tabs=[makeTab(initial)];

    function makeTab(path){
      const p=normalizePath(path)||"This PC";
      return {id:"explorer-tab-"+(++seq),path:p,history:[p],index:0,title:titleForPath(p)};
    }
    activeId=tabs[0].id;

    function activeTab(){return tabs.find(t=>t.id===activeId)||tabs[0]}

    function isMountedMode(){
      return wrap.classList.contains("real-mount-mode");
    }

    function notifyMounted(){
      notify("Explorador","Os separadores virtuais ficam em pausa enquanto está aberta uma pasta real montada.");
    }

    function renderTabs(){
      tabBar.innerHTML="";
      for(const tab of tabs){
        const button=document.createElement("button");
        button.className="explorer-tab-v820"+(tab.id===activeId?" active":"");
        button.dataset.explorerTabId=tab.id;
        button.title=tab.path;        const marker=tab.id===activeId?' data-explorer-tab-title':"";
        button.innerHTML='<span class="explorer-tab-folder" aria-hidden="true">▣</span>'+
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
    }

    function dispatchPath(path){
      suppressPathRecord=true;
      win.dispatchEvent(new CustomEvent("navigate",{detail:path}));
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
      dispatchPath(tab.path);
      return tab;
    }

    function closeTab(id){
      if(isMountedMode()){notifyMounted();return}
      const index=tabs.findIndex(t=>t.id===id);
      if(index<0)return;
      if(tabs.length===1){
        try{closeWindow(win)}catch{win?.remove?.()}
        return;
      }
      const wasActive=id===activeId;
      tabs.splice(index,1);
      if(wasActive){
        activeId=tabs[Math.min(index,tabs.length-1)].id;
        renderTabs();
        dispatchPath(activeTab().path);
      }else renderTabs();
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
      newTab,closeTab,switchTab,go,back:()=>travel(-1),forward:()=>travel(1),
      getTabs:()=>tabs.map(t=>({...t,history:t.history.slice()})),
      getActiveId:()=>activeId
    });
    wrap.__explorerNavigationV820=navigationApi;
    if(win)win.__explorerNavigationV820=navigationApi;
    renderTabs();
    input.value=initial;
  }

  globalThis.buildExplorerV5=function(wrap,win,startPath){
    previousBuildExplorer(wrap,win,startPath);
    installNavigation(wrap,win,startPath);
  };
  try{buildExplorerV5=globalThis.buildExplorerV5}catch{}

  globalThis.Win11ExplorerNavigation=Object.freeze({
    version:"8.2.0",normalizePath,pathExists,titleForPath,installNavigation
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"8.2.0",step:14,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-tabs","explorer-tab-history","explorer-editable-address",
      "explorer-ctrl-t","explorer-ctrl-w","explorer-ctrl-tab","explorer-alt-history",
      "explorer-safe-address-validation"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();