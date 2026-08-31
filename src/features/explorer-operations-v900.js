"use strict";
(function installExplorerOperationsV900(){
  const activeByWrap=new WeakMap();
  const lastByWrap=new WeakMap();

  function own(obj,key){return Object.prototype.hasOwnProperty.call(obj,key)}
  function tick(ms=24){return new Promise(resolve=>setTimeout(resolve,ms))}

  function measureValue(value){
    if(value?.size!==undefined&&Number.isFinite(Number(value.size)))return Number(value.size)||0;
    try{return fileSize(value)}catch{
      try{return new Blob([JSON.stringify(value)]).size}catch{return 0}
    }
  }

  function measureItem(item){
    if(item.type==="file")return measureValue(ensureFolder(item.path)[item.name]);
    if(item.type!=="folder")return 0;
    const root=item.path+"/"+item.name;
    let size=0;
    for(const path of Object.keys(state.files||{})){
      if(path!==root&&!path.startsWith(root+"/"))continue;
      for(const value of Object.values(state.files[path]||{}))size+=measureValue(value);
    }
    return size;
  }

  function conflictType(item,destination){
    if(item.type==="folder")return own(state.files,destination+"/"+item.name)?"folder":"";
    if(item.type==="file")return own(ensureFolder(destination),item.name)?"file":"";
    return "";
  }

  function ensureConflictHost(){
    let host=document.querySelector("#explorer-conflict-v900");
    if(host)return host;
    host=document.createElement("div");
    host.id="explorer-conflict-v900";
    host.className="explorer-conflict-v900";
    document.body.appendChild(host);
    return host;
  }

  function askConflict(item,destination,move){
    const host=ensureConflictHost();
    return new Promise(resolve=>{
      host.innerHTML='<div class="explorer-conflict-box-v900">'+
        '<div class="explorer-conflict-head-v900"><strong>Já existe um item com este nome</strong></div>'+
        '<div class="explorer-conflict-body-v900">'+
          '<div class="explorer-conflict-icon-v900" aria-hidden="true">'+(item.type==="folder"?"▣":"▤")+'</div>'+
          '<div><strong>'+escapeHTML(item.name)+'</strong><p>Destino: '+escapeHTML(destination)+'</p>'+
          '<p>Escolha o que pretende fazer nesta operação de '+(move?"movimento":"cópia")+'.</p></div>'+
        '</div>'+
        '<label class="explorer-conflict-all-v900"><input type="checkbox" data-conflict-all> Fazer o mesmo para os conflitos seguintes</label>'+
        '<div class="explorer-conflict-actions-v900">'+
          '<button data-conflict-skip>Ignorar</button>'+
          '<button data-conflict-keep>Manter ambos</button>'+
          '<button data-conflict-replace class="primary">Substituir</button>'+
          '<button data-conflict-cancel>Cancelar operação</button>'+
        '</div></div>';
      host.classList.add("open");
      const finish=policy=>{
        const applyAll=!!host.querySelector("[data-conflict-all]")?.checked;
        host.classList.remove("open");
        resolve({policy,applyAll});
      };
      host.querySelector("[data-conflict-skip]").onclick=()=>finish("skip");
      host.querySelector("[data-conflict-keep]").onclick=()=>finish("keep");
      host.querySelector("[data-conflict-replace]").onclick=()=>finish("replace");
      host.querySelector("[data-conflict-cancel]").onclick=()=>finish("cancel");
    });
  }

  function centerFor(wrap){
    let center=wrap.querySelector(".explorer-operation-center-v900");
    if(center)return center;
    center=document.createElement("div");
    center.className="explorer-operation-center-v900";
    wrap.querySelector("main")?.appendChild(center);
    return center;
  }  function opSnapshot(op){
    return {
      id:op.id,mode:op.mode,status:op.status,total:op.total,processed:op.processed,
      succeeded:op.succeeded,skipped:op.skipped,failed:op.failed.length,
      cancelled:op.cancelled,paused:op.paused,current:op.current,percent:op.total?Math.round(op.processed/op.total*100):100
    };
  }

  function renderOperation(op){
    const center=centerFor(op.wrap);
    let card=center.querySelector('[data-operation-id="'+op.id+'"]');
    if(!card){
      card=document.createElement("section");
      card.className="explorer-operation-card-v900";
      card.dataset.operationId=op.id;
      center.appendChild(card);
    }
    const percent=op.total?Math.min(100,Math.round(op.processed/op.total*100)):100;
    const verb=op.mode==="move"?"A mover":"A copiar";
    const done=op.status!=="running";
    const title=done
      ?(op.cancelled?"Operação cancelada":op.failed.length?"Operação concluída com avisos":"Operação concluída")
      :verb+" "+op.total+" item"+(op.total===1?"":"s");
    card.dataset.operationStatus=op.status;
    card.innerHTML='<div class="explorer-operation-head-v900"><strong>'+title+'</strong><span>'+percent+'%</span></div>'+
      '<div class="explorer-operation-current-v900">'+escapeHTML(op.current||"A preparar…")+'</div>'+
      '<div class="explorer-operation-progress-v900"><i style="width:'+percent+'%"></i></div>'+
      '<div class="explorer-operation-meta-v900"><span>'+op.processed+' de '+op.total+'</span><span>'+op.succeeded+' concluído(s)'+(op.skipped?" · "+op.skipped+" ignorado(s)":"")+'</span></div>'+
      '<div class="explorer-operation-actions-v900">'+
        (!done?'<button data-operation-pause>'+(op.paused?"Retomar":"Pausar")+'</button><button data-operation-cancel>Cancelar</button>':'<button data-operation-close>Fechar</button>')+
      '</div>';
    card.querySelector("[data-operation-pause]")?.addEventListener("click",()=>{
      op.paused=!op.paused;renderOperation(op);
    });
    card.querySelector("[data-operation-cancel]")?.addEventListener("click",()=>{
      op.cancelled=true;op.paused=false;renderOperation(op);
    });
    card.querySelector("[data-operation-close]")?.addEventListener("click",()=>card.remove());
  }

  async function waitWhilePaused(op){
    while(op.paused&&!op.cancelled)await tick(60);
  }

  async function replaceExisting(item,destination){
    const type=conflictType(item,destination);
    if(!type)return true;
    try{return await Win11ExplorerPro.permanentlyDeleteVirtual(destination,item.name,type)}
    catch{return false}
  }

  async function performItem(item,destination,move,policy){
    if(move&&item.path===destination)return {ok:false,reason:"same"};
    if(!move&&item.path===destination)policy="keep";
    const conflict=conflictType(item,destination);
    let replaced=false;
    if(conflict){
      if(policy==="skip")return {ok:false,skipped:true,reason:"conflict"};
      if(policy==="replace"){
        const removed=await replaceExisting(item,destination);
        if(!removed)return {ok:false,reason:"replace-failed"};
        replaced=true;
      }
    }
    try{
      const out=item.type==="folder"
        ?await Win11ExplorerPro.copyFolderAdvanced(item.path+"/"+item.name,destination,move)
        :await Win11ExplorerPro.copyFileAdvanced(item.path,item.name,destination,move);
      return {...out,replaced};
    }catch(err){
      return {ok:false,reason:err?.message||"error",replaced};
    }
  }  async function transfer(wrap,win,items,destination,mode="copy",options={}){
    if(!wrap||wrap.classList.contains("real-mount-mode")||!destination||destination==="This PC"||destination==="Recycle Bin"){
      return {ok:false,reason:"invalid-destination",done:0,remaining:[...(items||[])]};
    }
    if(activeByWrap.get(wrap)){
      notify("Explorador","Já existe uma operação de ficheiros em curso nesta janela.");
      return {ok:false,reason:"busy",done:0,remaining:[...(items||[])]};
    }
    const list=(Array.isArray(items)?items:[]).filter(x=>x&&["file","folder"].includes(x.type));
    const move=mode==="move";
    const op={
      id:"op-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7),
      wrap,win,mode:move?"move":"copy",status:"running",total:list.length,processed:0,
      succeeded:0,skipped:0,failed:[],cancelled:false,paused:false,current:"",
      conflictPolicy:["replace","skip","keep"].includes(options.conflictPolicy)?options.conflictPolicy:null
    };
    activeByWrap.set(wrap,op);
    renderOperation(op);
    const remaining=[],historyItems=[];
    let historyReversible=true;
    let index=0;
    try{
      for(;index<list.length;index++){
        const item=list[index];
        await waitWhilePaused(op);
        if(op.cancelled)break;
        op.current=item.name;renderOperation(op);
        let policy=op.conflictPolicy;
        const conflict=conflictType(item,destination);
        if(conflict&&!policy&&!(item.path===destination&&!move)){
          const answer=await askConflict(item,destination,move);
          if(answer.policy==="cancel"){
            op.cancelled=true;remaining.push(item);break;
          }
          policy=answer.policy;
          if(answer.applyAll)op.conflictPolicy=policy;
        }
        const result=await performItem(item,destination,move,policy||"keep");
        op.processed++;
        if(result?.ok){
          op.succeeded++;
          historyItems.push({srcPath:item.path,srcName:item.name,dstPath:destination,dstName:result.name,type:item.type});
          if(result.replaced)historyReversible=false;
        }
        else if(result?.skipped){op.skipped++;if(move)remaining.push(item)}
        else {op.failed.push({item,reason:result?.reason||"error"});if(move)remaining.push(item)}
        renderOperation(op);
        await tick();
      }
      if(op.cancelled){
        for(let i=index+(remaining.includes(list[index])?1:0);i<list.length;i++)remaining.push(list[i]);
      }
      op.status=op.cancelled?"cancelled":op.failed.length?"completed-with-errors":"completed";
      op.current=op.cancelled?"Interrompida pelo utilizador":op.failed.length?"Alguns itens não foram concluídos":"Concluída";
      renderOperation(op);
      const snapshot=opSnapshot(op);
      lastByWrap.set(wrap,snapshot);
      if(historyItems.length)globalThis.Win11ExplorerHistory?.recordTransfer?.({mode:op.mode,items:historyItems,reversible:historyReversible});
      return {
        ok:!op.cancelled&&!op.failed.length,
        done:op.succeeded,skipped:op.skipped,failed:op.failed,
        cancelled:op.cancelled,remaining,last:snapshot
      };
    }finally{
      activeByWrap.delete(wrap);
    }
  }

  async function handlePaste(ctx){
    const {wrap,win,destination,batch,clipboardKey}=ctx||{};
    if(!batch?.items?.length||wrap?.classList.contains("real-mount-mode"))return false;
    const moving=batch.mode==="cut";
    const result=await transfer(wrap,win,batch.items,destination,moving?"move":"copy");
    if(result?.reason==="busy")return true;
    if(moving){
      state[clipboardKey]=result.remaining?.length?{...batch,items:result.remaining}:null;
    }
    saveState();
    wrap.__explorerProV740?.forceRender?.();
    wrap.__explorerColumnsV890?.refresh?.();
    wrap.__explorerCommandV880?.refresh?.();
    const summary=result.cancelled
      ?"Operação cancelada. "+result.done+" item(ns) concluído(s)."
      :result.done+" item(ns) "+(moving?"movido(s)":"copiado(s)")+(result.skipped?" · "+result.skipped+" ignorado(s).":".");
    notify("Explorador",summary);
    return true;
  }  function installWindowApi(wrap,win){
    if(!wrap||wrap.dataset.explorerOperationsV900==="1")return;
    wrap.dataset.explorerOperationsV900="1";
    wrap.classList.add("explorer-operations-v900");
    const api=Object.freeze({
      transfer:(items,destination,mode="copy",options={})=>transfer(wrap,win,items,destination,mode,options),
      pause:()=>{const op=activeByWrap.get(wrap);if(!op)return false;op.paused=true;renderOperation(op);return true},
      resume:()=>{const op=activeByWrap.get(wrap);if(!op)return false;op.paused=false;renderOperation(op);return true},
      cancel:()=>{const op=activeByWrap.get(wrap);if(!op)return false;op.cancelled=true;op.paused=false;renderOperation(op);return true},
      getActive:()=>{const op=activeByWrap.get(wrap);return op?opSnapshot(op):null},
      getLast:()=>lastByWrap.get(wrap)||null
    });
    wrap.__explorerOperationsV900=api;
    if(win)win.__explorerOperationsV900=api;
  }

  const previousBuildExplorer=globalThis.buildExplorerV5;
  if(typeof previousBuildExplorer==="function"){
    globalThis.buildExplorerV5=function(wrap,win,startPath){
      previousBuildExplorer(wrap,win,startPath);
      installWindowApi(wrap,win);
    };
    try{buildExplorerV5=globalThis.buildExplorerV5}catch{}
  }

  globalThis.Win11ExplorerOperations=Object.freeze({
    version:"9.0.0",handlePaste,
    transfer:(wrap,win,items,destination,mode="copy",options={})=>transfer(wrap,win,items,destination,mode,options)
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"9.0.0",step:23,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-file-operation-progress","explorer-file-operation-pause",
      "explorer-file-operation-cancel","explorer-conflict-replace","explorer-conflict-skip",
      "explorer-conflict-keep-both","explorer-conflict-apply-all","explorer-same-folder-copy"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();