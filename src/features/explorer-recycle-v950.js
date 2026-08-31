"use strict";
(function installExplorerRecycleV950(){
  const VERSION="9.5.0";
  const installed=new WeakSet();

  function bin(){return ensureFolder("Recycle Bin")}
  function wrapOf(win){return win?.querySelector?.(".explorer-navigation-v820")||win?.querySelector?.(".explorer-pro-v740")}
  function currentPath(win){
    const wrap=wrapOf(win);
    return globalThis.Win11ExplorerPro?.currentVirtualPath?.(wrap)||wrap?.querySelector(".pathbar")?.textContent?.trim()||"";
  }
  function entryType(entry){return entry?.content?.__virtualFolderTrash?"folder":"file"}
  function desiredName(trashName,entry){
    return entry?.originalName||(entry?.content?.__virtualFolderTrash?entry.content.rootName:trashName)||trashName;
  }
  function destination(entry){
    let path=entry?.originalPath||"C:/Desktop";
    if(path!=="C:"&&!Object.prototype.hasOwnProperty.call(state.files||{},path)&&path!=="C:/Desktop")path="C:/Desktop";
    return path;
  }
  function hasConflict(trashName,entry){
    const path=destination(entry),name=desiredName(trashName,entry),type=entryType(entry);
    return type==="folder"
      ?Object.prototype.hasOwnProperty.call(state.files||{},path+"/"+name)
      :Object.prototype.hasOwnProperty.call(ensureFolder(path),name);
  }
  function valueSize(value){
    if(value==null)return 0;
    if(typeof value==="string")return new Blob([value]).size;
    if(value instanceof Blob)return value.size;
    if(Number.isFinite(Number(value?.size)))return Number(value.size);
    try{return new Blob([JSON.stringify(value)]).size}catch{return 0}
  }
  function entrySize(entry){
    if(entry?.content?.__virtualFolderTrash){
      let total=0;
      for(const t of entry.content.tree||[])for(const v of Object.values(t.files||{}))total+=valueSize(v);
      return total;
    }
    return valueSize(entry?.content);
  }
  function formatDate(ts){
    const n=Number(ts)||0;
    return n?new Date(n).toLocaleString("pt-PT",{dateStyle:"short",timeStyle:"short"}):"Data desconhecida";
  }
  function summary(){
    const entries=Object.entries(bin());
    return {count:entries.length,size:entries.reduce((n,[,e])=>n+entrySize(e),0)};
  }

  function ensureConflictDialog(){
    let host=document.getElementById("explorer-recycle-conflict-v950");
    if(host)return host;
    host=document.createElement("div");
    host.id="explorer-recycle-conflict-v950";
    host.className="explorer-recycle-conflict-v950";
    host.innerHTML='<div class="recycle-conflict-card-v950" role="dialog" aria-modal="true" aria-labelledby="recycle-conflict-title-v950">'+
      '<h3 id="recycle-conflict-title-v950">Já existe um item com o mesmo nome</h3>'+
      '<p data-recycle-conflict-text></p>'+
      '<label><input type="checkbox" data-recycle-conflict-all> Fazer o mesmo para os conflitos seguintes</label>'+
      '<div class="recycle-conflict-actions-v950">'+
      '<button data-recycle-keep>Manter ambos</button><button data-recycle-skip>Ignorar</button>'+
      '<button data-recycle-replace>Substituir</button><button data-recycle-cancel>Cancelar</button></div></div>';
    document.body.appendChild(host);
    return host;
  }
  function askConflict(trashName,entry){
    const host=ensureConflictDialog();
    host.querySelector("[data-recycle-conflict-text]").textContent=
      "Destino: "+destination(entry)+"/"+desiredName(trashName,entry);
    host.querySelector("[data-recycle-conflict-all]").checked=false;
    host.classList.add("open");
    return new Promise(resolve=>{
      let settled=false;
      const finish=policy=>{
        if(settled)return;settled=true;
        const applyAll=host.querySelector("[data-recycle-conflict-all]").checked;
        host.classList.remove("open");
        resolve({policy,applyAll});
      };
      host.querySelector("[data-recycle-keep]").onclick=()=>finish("keep");
      host.querySelector("[data-recycle-skip]").onclick=()=>finish("skip");
      host.querySelector("[data-recycle-replace]").onclick=()=>finish("replace");
      host.querySelector("[data-recycle-cancel]").onclick=()=>finish("cancel");
    });
  }  function allExplorerWindows(){
    return [...document.querySelectorAll('#window-layer > .window[data-app="explorer"]')];
  }
  function refreshAll(){
    for(const win of allExplorerWindows()){
      const wrap=wrapOf(win);
      wrap?.__explorerProV740?.forceRender?.();
      setTimeout(()=>decorateWindow(win),35);
    }
  }
  function selectedTrashNames(win){
    return (wrapOf(win)?.__explorerProV740?.getSelectedItems?.()||[])
      .filter(x=>x.type==="recycle"&&bin()[x.name]).map(x=>x.name);
  }
  async function restoreNames(names,win=null){
    const wanted=[...new Set((names||[]).filter(n=>bin()[n]))];
    if(!wanted.length)return {done:0,skipped:0,cancelled:false,replaced:0};
    let sticky="",done=0,skipped=0,replaced=0,cancelled=false;
    const changed=[];
    for(const trashName of wanted){
      const entry=bin()[trashName];if(!entry)continue;
      let policy="keep";
      if(hasConflict(trashName,entry)){
        if(sticky)policy=sticky;
        else{
          const decision=await askConflict(trashName,entry);
          if(decision.policy==="cancel"){cancelled=true;break}
          policy=decision.policy;
          if(decision.applyAll)sticky=policy;
        }
      }
      if(policy==="skip"){skipped++;continue}
      const result=Win11ExplorerPro.restoreRecycleItemAdvanced(trashName,policy);
      if(result?.ok){
        done++;changed.push(trashName);
        if(result.replacedTrashName)replaced++;
      }else if(result?.skipped)skipped++;
    }
    if(changed.length){
      Win11ExplorerHistory?.invalidateRecycleItems?.(changed,"O item foi restaurado manualmente da Reciclagem.");
      saveState();Win11SearchV920?.invalidate?.();refreshAll();
    }
    if(win)setTimeout(()=>decorateWindow(win),50);
    if(done||skipped||cancelled){
      notify("Reciclagem",done+" restaurado"+(done===1?"":"s")+
        (skipped?" · "+skipped+" ignorado"+(skipped===1?"":"s"):"")+
        (replaced?" · "+replaced+" "+(replaced===1?"substituição":"substituições"):"")+
        (cancelled?" · operação cancelada":""));
    }
    return {done,skipped,replaced,cancelled};
  }
  async function restoreSelected(win){
    return restoreNames(selectedTrashNames(win),win);
  }
  async function restoreAll(win){
    return restoreNames(Object.keys(bin()),win);
  }
  async function emptyNow(win){
    const names=Object.keys(bin());let done=0;
    if(!names.length)return {done:0};
    Win11ExplorerHistory?.invalidateRecycleItems?.(names,"O item foi eliminado permanentemente da Reciclagem.");
    for(const name of names){
      try{if(await Win11ExplorerPro.permanentlyDeleteVirtual("Recycle Bin",name,"recycle"))done++}catch{}
    }
    saveState();Win11SearchV920?.invalidate?.();refreshAll();
    if(win)setTimeout(()=>decorateWindow(win),50);
    notify("Reciclagem",done+" item"+(done===1?"":"s")+" eliminado"+(done===1?"":"s")+" permanentemente.");
    return {done};
  }
  function confirmEmpty(win){
    const s=summary();if(!s.count)return false;
    showSystemDialog("Esvaziar Reciclagem",
      '<div class="recycle-empty-confirm-v950"><strong>'+s.count+' item'+(s.count===1?"":"s")+'</strong>'+
      '<p>Esta ação elimina permanentemente o conteúdo da Reciclagem e não pode ser desfeita.</p>'+
      '<p>Tamanho aproximado: '+escapeHTML(formatBytes(s.size))+'</p></div>',
      "Esvaziar",()=>{emptyNow(win)});
    return true;
  }  function ensureToolbar(win){
    const wrap=wrapOf(win),command=wrap?.querySelector(".explorer-command");
    if(!wrap||!command)return null;
    let host=command.querySelector(".explorer-recycle-actions-v950");
    if(host)return host;
    host=document.createElement("div");
    host.className="explorer-recycle-actions-v950";
    host.innerHTML='<button data-recycle-restore-selected title="Restaurar selecionados">↶ <span>Restaurar</span></button>'+
      '<button data-recycle-restore-all title="Restaurar tudo">↶↶ <span>Restaurar tudo</span></button>'+
      '<button data-recycle-empty title="Esvaziar Reciclagem">⌫ <span>Esvaziar</span></button>';
    const overflow=command.querySelector("[data-overflow-v880]");
    command.insertBefore(host,overflow||null);
    host.querySelector("[data-recycle-restore-selected]").onclick=()=>restoreSelected(win);
    host.querySelector("[data-recycle-restore-all]").onclick=()=>restoreAll(win);
    host.querySelector("[data-recycle-empty]").onclick=()=>confirmEmpty(win);
    return host;
  }
  function ensureBanner(win){
    const wrap=wrapOf(win),files=wrap?.querySelector(".explorer-files");
    if(!files)return null;
    let banner=files.querySelector(".explorer-recycle-banner-v950");
    if(banner)return banner;
    banner=document.createElement("div");
    banner.className="explorer-recycle-banner-v950";
    files.prepend(banner);
    return banner;
  }
  function decorateItems(win){
    const wrap=wrapOf(win);if(!wrap||currentPath(win)!=="Recycle Bin")return;
    for(const node of wrap.querySelectorAll(".file,.file-row:not(.header)")){
      const trashName=node.dataset.v740Name||node.dataset.v910Name||
        node.querySelector(".file-name")?.textContent?.trim()||
        node.querySelector(".fname span:last-child")?.textContent?.trim()||"";
      if(!trashName)continue;
      const entry=bin()[trashName];if(!entry)continue;
      node.classList.add("recycle-item-v950");
      node.title=(entry.originalName||trashName)+"\nLocal original: "+(entry.originalPath||"C:/Desktop")+"\nEliminado: "+formatDate(entry.deletedAt);
      let meta=node.querySelector(".recycle-meta-v950");
      if(!meta){meta=document.createElement("div");meta.className="recycle-meta-v950";node.appendChild(meta)}
      const metaHtml='<span>'+escapeHTML(entry.originalPath||"C:/Desktop")+'</span><span>'+escapeHTML(formatDate(entry.deletedAt))+'</span>';
      if(meta.innerHTML!==metaHtml)meta.innerHTML=metaHtml;
    }
  }
  function updateUi(win){
    const wrap=wrapOf(win),active=currentPath(win)==="Recycle Bin";
    const toolbar=ensureToolbar(win),banner=ensureBanner(win);
    if(toolbar)toolbar.hidden=!active;
    if(banner)banner.hidden=!active;
    if(!active)return;
    const s=summary(),selected=selectedTrashNames(win).length;
    if(banner){
      const bannerHtml='<div><strong>Reciclagem</strong><span>'+s.count+' item'+(s.count===1?"":"s")+' · '+escapeHTML(formatBytes(s.size))+'</span></div>'+
        '<small>Os itens permanecem aqui até serem restaurados ou eliminados permanentemente.</small>';
      if(banner.innerHTML!==bannerHtml)banner.innerHTML=bannerHtml;
    }
    if(toolbar){
      toolbar.querySelector("[data-recycle-restore-selected]").disabled=selected===0;
      toolbar.querySelector("[data-recycle-restore-all]").disabled=s.count===0;
      toolbar.querySelector("[data-recycle-empty]").disabled=s.count===0;
    }
    decorateItems(win);
  }
  function decorateWindow(win){
    if(!win?.isConnected)return;
    updateUi(win);
  }  function installWindow(win){
    if(!win||win.dataset.app!=="explorer"||installed.has(win))return;
    const wrap=wrapOf(win);if(!wrap)return;
    installed.add(win);win.dataset.explorerRecycleV950="1";wrap.classList.add("explorer-recycle-v950");
    ensureToolbar(win);ensureBanner(win);
    let timer=0;
    const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>decorateWindow(win),25)};
    const pathbar=wrap.querySelector(".pathbar"),files=wrap.querySelector(".explorer-files");
    const pathObs=new MutationObserver(schedule),filesObs=new MutationObserver(schedule);
    if(pathbar)pathObs.observe(pathbar,{childList:true,subtree:true,characterData:true});
    if(files)filesObs.observe(files,{childList:true,subtree:true});
    const onClick=()=>setTimeout(()=>decorateWindow(win),0);
    const onNavigate=()=>{schedule();setTimeout(()=>decorateWindow(win),70)};
    wrap.addEventListener("click",onClick,false);
    win.addEventListener("navigate",onNavigate,true);
    schedule();
    const cleanup=setInterval(()=>{
      if(win.isConnected)return;
      clearInterval(cleanup);clearTimeout(timer);pathObs.disconnect();filesObs.disconnect();
      wrap.removeEventListener("click",onClick,false);
      win.removeEventListener("navigate",onNavigate,true);
    },1000);
    const api=Object.freeze({
      restoreSelected:()=>restoreSelected(win),restoreAll:()=>restoreAll(win),
      empty:()=>emptyNow(win),confirmEmpty:()=>confirmEmpty(win),
      getSummary:summary,getSelected:()=>selectedTrashNames(win).slice(),
      refresh:()=>{decorateWindow(win);setTimeout(()=>decorateWindow(win),70)}
    });
    wrap.__explorerRecycleV950=api;win.__explorerRecycleV950=api;
  }

  const layer=document.getElementById("window-layer");
  if(layer)new MutationObserver(records=>{
    for(const rec of records)for(const n of rec.addedNodes)
      if(n.nodeType===1&&n.matches?.('.window[data-app="explorer"]'))setTimeout(()=>installWindow(n),0);
  }).observe(layer,{childList:true});
  allExplorerWindows().forEach(installWindow);

  globalThis.Win11ExplorerRecycle=Object.freeze({
    version:VERSION,restoreNames,restoreSelected,restoreAll,empty:emptyNow,
    getSummary:summary,getItems:()=>Object.entries(bin()).map(([trashName,entry])=>({
      trashName,originalName:entry.originalName||trashName,originalPath:entry.originalPath||"C:/Desktop",
      deletedAt:Number(entry.deletedAt)||0,type:entryType(entry),size:entrySize(entry)
    }))
  });
  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:28,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "recycle-bin-pro","recycle-restore-selected","recycle-restore-all","recycle-empty-confirmation",
      "recycle-original-location","recycle-deleted-date","recycle-conflict-keep-both",
      "recycle-conflict-skip","recycle-conflict-replace","recycle-history-invalidation"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();