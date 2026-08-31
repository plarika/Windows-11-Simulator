"use strict";
(function installExplorerMultiWindowV930(){
  const VERSION="9.3.0";
  const MIME="application/x-win11-explorer-window-v930";
  const installed=new WeakSet();

  function realWindows(){return [...document.querySelectorAll('#window-layer > .window')]}
  function windowById(id){return realWindows().find(w=>w.dataset.id===id)||null}
  function explorerWindows(desktop=Number(state.currentDesktop)||0){
    return realWindows().filter(w=>w.dataset.app==="explorer"&&Number(w.dataset.desktop||0)===desktop);
  }
  function wrapOf(win){return win?.querySelector?.(".explorer-v5")||win?.querySelector?.(".explorer-navigation-v820")}
  function currentPath(win){
    const wrap=wrapOf(win);
    return globalThis.Win11ExplorerPro?.currentVirtualPath?.(wrap)
      ||wrap?.querySelector(".pathbar")?.textContent?.trim()
      ||"This PC";
  }
  function openNew(path,sourceWin=null){
    const dest=path||currentPath(sourceWin)||"This PC";
    if(typeof globalThis.openAppNewWindow==="function")return openAppNewWindow("explorer",dest);
    if(typeof globalThis.makeWindow==="function")return makeWindow("explorer",dest);
    notify("Explorador","Não foi possível criar uma nova janela.");
    return null;
  }

  function ensureGroupPanel(){
    let panel=document.getElementById("explorer-task-group-v930");
    if(panel)return panel;
    panel=document.createElement("div");
    panel.id="explorer-task-group-v930";
    panel.className="explorer-task-group-v930";
    document.body.appendChild(panel);
    return panel;
  }
  function hideGroup(){ensureGroupPanel().classList.remove("open")}
  function showGroup(anchor){
    const wins=explorerWindows();
    if(wins.length<2)return;
    const panel=ensureGroupPanel();
    panel.innerHTML='<header><strong>Explorador de Ficheiros</strong><span>'+wins.length+' janelas</span></header><div class="explorer-task-group-list-v930"></div>';
    const list=panel.querySelector(".explorer-task-group-list-v930");
    for(const win of wins){
      const card=document.createElement("div");
      card.className="explorer-task-window-v930"+(win.classList.contains("focused")?" active":"");
      const path=currentPath(win);
      card.innerHTML='<button data-focus-window><span class="explorer-task-window-icon-v930">▣</span><span><strong>'+
        escapeHTML(path==="This PC"?"Este PC":path.split("/").filter(Boolean).pop()||"Explorador")+
        '</strong><small>'+escapeHTML(path)+'</small></span></button><button data-close-window title="Fechar">×</button>';
      card.querySelector("[data-focus-window]").onclick=()=>{
        win.classList.remove("hidden");
        try{focusWindow(win)}catch{win.style.zIndex=String(Date.now())}
        hideGroup();
      };
      card.querySelector("[data-close-window]").onclick=e=>{
        e.stopPropagation();
        try{closeWindow(win)}catch{win.remove()}
        setTimeout(()=>{refreshTaskbarGroup();if(explorerWindows().length<2)hideGroup();else showGroup(anchor)},20);
      };
      list.appendChild(card);
    }
    panel.classList.add("open");
    const r=anchor.getBoundingClientRect();
    panel.style.left=Math.max(8,Math.min(innerWidth-panel.offsetWidth-8,r.left-120))+"px";
    panel.style.bottom=Math.max(62,innerHeight-r.top+8)+"px";
  }

  let taskRefreshPending=false;
  function refreshTaskbarGroup(){
    if(taskRefreshPending)return;
    taskRefreshPending=true;
    requestAnimationFrame(()=>{
      taskRefreshPending=false;
      const taskButtons=[...document.querySelectorAll('#task-center .task-btn[data-window]')];
      const explorerButtons=taskButtons.filter(b=>{
        const w=windowById(b.dataset.window||"");
        return w?.dataset.app==="explorer"&&Number(w.dataset.desktop||0)===(Number(state.currentDesktop)||0);
      });
      const lead=explorerButtons.length>1?explorerButtons[0]:null;
      const hidden=new Set(explorerButtons.length>1?explorerButtons.slice(1):[]);
      for(const b of taskButtons){
        b.classList.toggle("explorer-task-group-lead-v930",b===lead);
        b.classList.toggle("explorer-task-group-hidden-v930",hidden.has(b));
        if(b===lead){
          const count=String(explorerButtons.length);
          if(b.dataset.explorerGroupCount!==count)b.dataset.explorerGroupCount=count;
        }else if(b.hasAttribute("data-explorer-group-count"))b.removeAttribute("data-explorer-group-count");
      }
    });
  }  async function transferAcross(sourceWin,targetWin,items,destination,copy){
    const targetWrap=wrapOf(targetWin),sourceWrap=wrapOf(sourceWin);
    if(!targetWrap||targetWrap.classList.contains("real-mount-mode"))return false;
    if(!destination||destination==="This PC"||destination==="Recycle Bin")return false;
    const api=targetWrap.__explorerOperationsV900;
    if(!api?.transfer)return false;
    const result=await api.transfer(items,destination,copy?"copy":"move");
    targetWrap.__explorerProV740?.forceRender?.();
    if(!copy)sourceWrap?.__explorerProV740?.forceRender?.();
    targetWrap.__explorerFilesystemV910?.refresh?.();
    sourceWrap?.__explorerFilesystemV910?.refresh?.();
    return result;
  }

  function installWindow(win){
    if(!win||win.dataset.app!=="explorer"||installed.has(win))return;
    const wrap=wrapOf(win);if(!wrap)return;
    installed.add(win);win.dataset.explorerMultiWindowV930="1";wrap.classList.add("explorer-multiwindow-v930");

    const command=wrap.querySelector(".explorer-command");
    if(command&&!command.querySelector("[data-new-window-v930]")){
      const button=document.createElement("button");
      button.dataset.newWindowV930="";
      button.title="Nova janela (Ctrl+N)";
      button.innerHTML='<span class="cmd-icon">▣</span><span class="cmd-label">Nova janela</span>';
      const overflow=command.querySelector("[data-overflow-v880]");
      command.insertBefore(button,overflow||null);
      button.onclick=()=>openNew(currentPath(win),win);
    }

    const filesHost=wrap.querySelector(".explorer-files");
    if(filesHost){
      wrap.addEventListener("dragstart",e=>{
        const raw=e.dataTransfer?.getData("application/x-win11sim-v74");
        if(!raw)return;
        try{
          const data=JSON.parse(raw);
          e.dataTransfer.setData(MIME,JSON.stringify({version:1,sourceWindowId:win.dataset.id,items:data.items||[]}));
        }catch{}
      });

      filesHost.addEventListener("dragover",e=>{
        const raw=e.dataTransfer?.getData(MIME);if(!raw)return;
        try{
          const data=JSON.parse(raw);if(data.sourceWindowId===win.dataset.id)return;
          if(wrap.classList.contains("real-mount-mode"))return;
          e.preventDefault();e.stopPropagation();
          e.dataTransfer.dropEffect=e.ctrlKey?"copy":"move";
          const node=e.target.closest(".file,.file-row:not(.header)");
          (node||filesHost).classList.add("cross-window-drop-v930");
        }catch{}
      },true);
      filesHost.addEventListener("dragleave",e=>{
        if(!filesHost.contains(e.relatedTarget))filesHost.querySelectorAll(".cross-window-drop-v930").forEach(x=>x.classList.remove("cross-window-drop-v930"));
      },true);
      filesHost.addEventListener("drop",async e=>{
        const raw=e.dataTransfer?.getData(MIME);if(!raw)return;
        let data;try{data=JSON.parse(raw)}catch{return}
        if(data.sourceWindowId===win.dataset.id)return;
        if(wrap.classList.contains("real-mount-mode"))return;
        e.preventDefault();e.stopPropagation();
        filesHost.querySelectorAll(".cross-window-drop-v930").forEach(x=>x.classList.remove("cross-window-drop-v930"));
        const sourceWin=windowById(data.sourceWindowId||"");
        if(!sourceWin)return;
        const node=e.target.closest(".file,.file-row:not(.header)");
        let dest=currentPath(win);
        if(node?.dataset.v740Type==="folder")dest=dest+"/"+node.dataset.v740Name;
        const result=await transferAcross(sourceWin,win,data.items||[],dest,!!e.ctrlKey);
        if(result)notify("Explorador",(e.ctrlKey?"Cópia":"Movimento")+" entre janelas concluído.");
      },true);
    }

    const keyHandler=e=>{
      if(!win.classList.contains("focused"))return;
      const ctrl=e.ctrlKey||e.metaKey;
      if(ctrl&&!e.shiftKey&&e.key.toLowerCase()==="n"){
        e.preventDefault();e.stopImmediatePropagation();openNew(currentPath(win),win);
      }
    };
    document.addEventListener("keydown",keyHandler,true);
    const cleanup=setInterval(()=>{
      if(win.isConnected)return;
      clearInterval(cleanup);document.removeEventListener("keydown",keyHandler,true);refreshTaskbarGroup();
    },1000);
    refreshTaskbarGroup();
  }  const layer=document.getElementById("window-layer"),taskCenter=document.getElementById("task-center");
  if(layer){
    const obs=new MutationObserver(records=>{
      for(const rec of records)for(const n of rec.addedNodes){
        if(n.nodeType!==1)continue;
        if(n.matches?.('.window[data-app="explorer"]'))setTimeout(()=>installWindow(n),0);
        n.querySelectorAll?.('.window[data-app="explorer"]').forEach(w=>setTimeout(()=>installWindow(w),0));
      }
      refreshTaskbarGroup();
    });
    obs.observe(layer,{childList:true,subtree:false,attributes:true,attributeFilter:["class","style"]});
  }
  if(taskCenter){
    const obs=new MutationObserver(refreshTaskbarGroup);
    obs.observe(taskCenter,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});
    taskCenter.addEventListener("click",e=>{
      const b=e.target.closest(".task-btn.explorer-task-group-lead-v930");
      if(!b||explorerWindows().length<2)return;
      e.preventDefault();e.stopImmediatePropagation();showGroup(b);
    },true);
  }
  document.addEventListener("pointerdown",e=>{
    if(!e.target.closest("#explorer-task-group-v930,.explorer-task-group-lead-v930"))hideGroup();
  },true);
  document.addEventListener("keydown",e=>{
    if(e.metaKey&&e.shiftKey&&e.key.toLowerCase()==="e"){
      e.preventDefault();e.stopImmediatePropagation();openNew("This PC");
    }
  },true);

  explorerWindows().forEach(installWindow);
  refreshTaskbarGroup();

  globalThis.Win11ExplorerMultiWindow=Object.freeze({
    version:VERSION,open:openNew,getWindows:()=>explorerWindows().slice(),
    refreshTaskbar:refreshTaskbarGroup,transferAcross
  });
  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:26,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-multi-window","explorer-window-independent-tabs","explorer-ctrl-n-window",
      "explorer-cross-window-dragdrop","explorer-taskbar-group","explorer-window-snap-compatible"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();