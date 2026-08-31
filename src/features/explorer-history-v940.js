"use strict";
(function installExplorerHistoryV940(){
  const VERSION="9.4.0",MAX=50;
  let suppress=0,busy=false;
  const listeners=new Set();

  function ensureHistoryState(){
    if(!state.explorerHistoryV94||typeof state.explorerHistoryV94!=="object"){
      state.explorerHistoryV94={undo:[],redo:[]};
    }
    const h=state.explorerHistoryV94;
    if(!Array.isArray(h.undo))h.undo=[];
    if(!Array.isArray(h.redo))h.redo=[];
    h.undo=h.undo.slice(-MAX);h.redo=h.redo.slice(-MAX);
    return h;
  }
  function cloneAction(a){return JSON.parse(JSON.stringify(a))}
  function labelFor(kind,count=1){
    const n=count>1?" ("+count+" itens)":"";
    return ({copy:"Copiar",move:"Mover",rename:"Mudar nome",delete:"Eliminar"}[kind]||"Operação")+n;
  }
  function notifyListeners(){
    const snap=getState();
    for(const fn of [...listeners]){try{fn(snap)}catch{}}
    refreshWindows();
  }
  function persist(){saveState();notifyListeners()}
  function push(action){
    if(suppress||!action)return false;
    const h=ensureHistoryState();
    const clean={id:"hist-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6),
      at:Date.now(),undoable:action.undoable!==false,...cloneAction(action)};
    clean.label=clean.label||labelFor(clean.kind,clean.items?.length||1);
    h.undo.push(clean);h.undo=h.undo.slice(-MAX);h.redo=[];
    persist();return true;
  }
  function recordTransfer({mode,items,reversible=true}={}){
    const list=(items||[]).filter(x=>x?.srcPath&&x?.srcName&&x?.dstPath&&x?.dstName&&["file","folder"].includes(x.type));
    if(!list.length)return false;
    return push({kind:mode==="move"?"move":"copy",items:list,undoable:reversible!==false,
      reason:reversible===false?"A operação substituiu conteúdo existente.":""});
  }
  function recordRename(entry){
    if(!entry?.path||!entry.oldName||!entry.newName)return false;
    return push({kind:"rename",items:[entry],undoable:true});
  }
  function recordDelete(items){
    const list=(items||[]).filter(x=>x?.path&&x?.name&&x?.trashName&&["file","folder"].includes(x.type));
    if(!list.length)return false;
    return push({kind:"delete",items:list,undoable:true});
  }
  function exists(path,name,type){
    if(type==="folder")return Object.prototype.hasOwnProperty.call(state.files||{},path+"/"+name);
    return Object.prototype.hasOwnProperty.call(ensureFolder(path),name);
  }
  function destinationFree(path,name,type){return !exists(path,name,type)}

  async function undoCopy(action){
    for(const x of [...action.items].reverse()){
      if(!exists(x.dstPath,x.dstName,x.type))return {ok:false,reason:"destination-changed"};
    }
    for(const x of [...action.items].reverse()){
      const ok=await Win11ExplorerPro.permanentlyDeleteVirtual(x.dstPath,x.dstName,x.type);
      if(!ok)return {ok:false,reason:"delete-failed"};
    }
    return {ok:true};
  }
  async function redoCopy(action){
    for(const x of action.items){
      if(!exists(x.srcPath,x.srcName,x.type)||!destinationFree(x.dstPath,x.dstName,x.type))return {ok:false,reason:"conflict"};
    }
    for(const x of action.items){
      const r=x.type==="folder"
        ?await Win11ExplorerPro.copyFolderAdvanced(x.srcPath+"/"+x.srcName,x.dstPath,false)
        :await Win11ExplorerPro.copyFileAdvanced(x.srcPath,x.srcName,x.dstPath,false);
      if(!r?.ok||r.name!==x.dstName)return {ok:false,reason:"copy-failed"};
    }
    return {ok:true};
  }  async function reverseMoveItems(items,reverse){
    const seq=reverse?[...items].reverse():items;
    for(const x of seq){
      const fromPath=reverse?x.dstPath:x.srcPath,fromName=reverse?x.dstName:x.srcName;
      const toPath=reverse?x.srcPath:x.dstPath,toName=reverse?x.srcName:x.dstName;
      if(!exists(fromPath,fromName,x.type)||!destinationFree(toPath,toName,x.type))return {ok:false,reason:"conflict"};
    }
    for(const x of seq){
      const fromPath=reverse?x.dstPath:x.srcPath,fromName=reverse?x.dstName:x.srcName;
      const toPath=reverse?x.srcPath:x.dstPath,toName=reverse?x.srcName:x.dstName;
      const r=x.type==="folder"
        ?await Win11ExplorerPro.copyFolderAdvanced(fromPath+"/"+fromName,toPath,true)
        :await Win11ExplorerPro.copyFileAdvanced(fromPath,fromName,toPath,true);
      if(!r?.ok||r.name!==toName)return {ok:false,reason:"move-failed"};
    }
    return {ok:true};
  }
  async function applyRename(x,reverse){
    const oldName=reverse?x.newName:x.oldName,newName=reverse?x.oldName:x.newName;
    if(!exists(x.path,oldName,x.type)||!destinationFree(x.path,newName,x.type))return {ok:false,reason:"conflict"};
    const ok=Win11ExplorerPro.renameVirtual?.(x.path,oldName,newName,x.type);
    return {ok:!!ok,reason:ok?"":"rename-failed"};
  }
  async function undoDelete(action){
    const bin=ensureFolder("Recycle Bin");
    for(const x of action.items){
      if(!bin[x.trashName]||!destinationFree(x.path,x.name,x.type))return {ok:false,reason:"conflict"};
    }
    for(const x of action.items){
      const ok=Win11ExplorerPro.restoreRecycleItem(x.trashName);
      if(!ok)return {ok:false,reason:"restore-failed"};
    }
    return {ok:true};
  }
  async function redoDelete(action){
    for(const x of action.items)if(!exists(x.path,x.name,x.type))return {ok:false,reason:"missing"};
    const next=[];
    for(const x of action.items){
      const trashName=x.type==="folder"
        ?Win11ExplorerPro.moveFolderToRecycle(x.path,x.name)
        :Win11ExplorerPro.moveFileToRecycle(x.path,x.name);
      if(!trashName)return {ok:false,reason:"recycle-failed"};
      next.push({...x,trashName});
    }
    action.items=next;
    return {ok:true};
  }

  async function execute(action,direction){
    if(!action?.undoable)return {ok:false,reason:action?.reason||"not-undoable"};
    const undo=direction==="undo";
    if(action.kind==="copy")return undo?undoCopy(action):redoCopy(action);
    if(action.kind==="move")return reverseMoveItems(action.items,undo);
    if(action.kind==="rename")return applyRename(action.items[0],undo);
    if(action.kind==="delete")return undo?undoDelete(action):redoDelete(action);
    return {ok:false,reason:"unsupported"};
  }

  async function step(direction){
    if(busy)return false;
    const h=ensureHistoryState(),from=direction==="undo"?h.undo:h.redo,to=direction==="undo"?h.redo:h.undo;
    const action=from[from.length-1];
    if(!action)return false;
    if(!action.undoable){notify("Explorador",action.reason||"Esta operação não pode ser desfeita.");return false}
    busy=true;suppress++;
    try{
      const result=await execute(action,direction);
      if(!result?.ok){
        notify("Explorador","Não foi possível "+(direction==="undo"?"desfazer":"refazer")+" a operação: o destino foi alterado.");
        return false;
      }
      from.pop();to.push(action);while(to.length>MAX)to.shift();
      saveState();
      notify("Explorador",(direction==="undo"?"Desfeito: ":"Refeito: ")+action.label);
      return true;
    }finally{
      suppress=Math.max(0,suppress-1);
      busy=false;
      notifyListeners();
    }
  }  function refreshWindows(){
    document.querySelectorAll('#window-layer > .window[data-app="explorer"]').forEach(win=>{
      const wrap=win.querySelector(".explorer-navigation-v820")||win.querySelector(".explorer-pro-v740");
      wrap?.__explorerProV740?.forceRender?.();
      wrap?.__explorerFilesystemV910?.refresh?.();
      wrap?.__explorerColumnsV890?.refresh?.();
      wrap?.__explorerCommandV880?.refresh?.();
    });
  }
  function getState(){
    const h=ensureHistoryState();
    return {undo:h.undo.map(cloneAction),redo:h.redo.map(cloneAction),busy};
  }
  function clear(){const h=ensureHistoryState();h.undo=[];h.redo=[];persist();return true}
  function subscribe(fn){if(typeof fn!=="function")return()=>{};listeners.add(fn);return()=>listeners.delete(fn)}

  function installWindow(win){
    if(!win||win.dataset.app!=="explorer"||win.dataset.explorerHistoryV940==="1")return;
    const wrap=win.querySelector(".explorer-navigation-v820")||win.querySelector(".explorer-pro-v740");
    if(!wrap||wrap.classList.contains("real-mount-mode"))return;
    win.dataset.explorerHistoryV940="1";wrap.classList.add("explorer-history-v940");
    const command=wrap.querySelector(".explorer-command");if(!command)return;
    const host=document.createElement("div");host.className="explorer-history-actions-v940";
    host.innerHTML='<button data-history-undo-v940 title="Desfazer (Ctrl+Z)">↶<span>Desfazer</span></button>'+
      '<button data-history-redo-v940 title="Refazer (Ctrl+Y)">↷<span>Refazer</span></button>'+
      '<button data-history-list-v940 title="Histórico">◷</button>';
    const overflow=command.querySelector("[data-overflow-v880]");
    command.insertBefore(host,overflow||null);
    const undoBtn=host.querySelector("[data-history-undo-v940]"),redoBtn=host.querySelector("[data-history-redo-v940]");
    function update(){
      const h=ensureHistoryState(),u=h.undo[h.undo.length-1],r=h.redo[h.redo.length-1];
      undoBtn.disabled=!u||!u.undoable||busy;redoBtn.disabled=!r||!r.undoable||busy;
      undoBtn.title=u?"Desfazer: "+u.label+" (Ctrl+Z)":"Nada para desfazer";
      redoBtn.title=r?"Refazer: "+r.label+" (Ctrl+Y)":"Nada para refazer";
    }
    undoBtn.onclick=()=>step("undo");redoBtn.onclick=()=>step("redo");
    host.querySelector("[data-history-list-v940]").onclick=e=>{
      const h=ensureHistoryState(),rows=h.undo.slice(-10).reverse();
      const menu=[];
      if(rows.length)for(const a of rows)menu.push([(a.undoable?"":"⚠ ")+a.label+" · "+new Date(a.at).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"}),()=>{}]);
      else menu.push(["Sem operações recentes",()=>{}]);
      menu.push("---");menu.push(["Limpar histórico",()=>clear()]);
      showContext(e.clientX,e.clientY,menu);
    };
    const unsub=subscribe(update);update();
    const key=e=>{
      if(!win.classList.contains("focused")||wrap.classList.contains("real-mount-mode"))return;
      const ctrl=e.ctrlKey||e.metaKey;if(!ctrl)return;
      const k=e.key.toLowerCase();
      if(k==="z"&&!e.shiftKey){e.preventDefault();e.stopImmediatePropagation();step("undo")}
      else if(k==="y"||(k==="z"&&e.shiftKey)){e.preventDefault();e.stopImmediatePropagation();step("redo")}
    };
    document.addEventListener("keydown",key,true);
    const timer=setInterval(()=>{if(win.isConnected)return;clearInterval(timer);unsub();document.removeEventListener("keydown",key,true)},1000);
    const api=Object.freeze({undo:()=>step("undo"),redo:()=>step("redo"),getState,clear});
    wrap.__explorerHistoryV940=api;win.__explorerHistoryV940=api;
  }

  const layer=document.getElementById("window-layer");
  if(layer){
    new MutationObserver(records=>{for(const rec of records)for(const n of rec.addedNodes)if(n.nodeType===1&&n.matches?.('.window[data-app="explorer"]'))setTimeout(()=>installWindow(n),0)})
      .observe(layer,{childList:true});
  }
  document.querySelectorAll('#window-layer > .window[data-app="explorer"]').forEach(installWindow);

  globalThis.Win11ExplorerHistory=Object.freeze({
    version:VERSION,recordTransfer,recordRename,recordDelete,
    undo:()=>step("undo"),redo:()=>step("redo"),getState,clear,
    isSuppressed:()=>suppress>0
  });
  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:27,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-undo","explorer-redo","explorer-operation-history","explorer-history-profile-state",
      "explorer-undo-copy","explorer-undo-move","explorer-undo-rename","explorer-undo-recycle"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();