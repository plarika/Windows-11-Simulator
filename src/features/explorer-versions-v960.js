"use strict";
(function installExplorerVersionsV960(){
  const VERSION="9.6.0";
  const MAX_PER_FILE=8,MAX_GLOBAL=80,MAX_SNAPSHOT_BYTES=131072,MAX_TOTAL_BYTES=1572864;
  function ensureState(){
    if(!state.explorerVersionsV96||typeof state.explorerVersionsV96!=="object"){
      state.explorerVersionsV96={schemaVersion:1,bindings:{},files:{}};
    }
    const s=state.explorerVersionsV96;
    s.schemaVersion=1;
    if(!s.bindings||typeof s.bindings!=="object")s.bindings={};
    if(!s.files||typeof s.files!=="object")s.files={};
    for(const r of Object.values(s.files))if(!Array.isArray(r.versions))r.versions=[];
    return s;
  }
  function keyOf(path,name){return JSON.stringify([String(path||""),String(name||"")])}
  function parseKey(key){try{return JSON.parse(key)}catch{return ["",""]}}
  function makeId(){return "fv-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9)}
  function makeVersionId(){return "ver-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8)}
  function bytes(value){return new Blob([String(value??"")]).size}
  function hash(value){
    const s=String(value??"");let h=2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
    return (h>>>0).toString(16);
  }  function eligible(value){
    if(typeof value!=="string"||value.startsWith("data:"))return null;
    const size=bytes(value);
    if(size>MAX_SNAPSHOT_BYTES)return null;
    return {content:value,size,hash:hash(value)};
  }
  function getRecord(path,name,create=false){
    const s=ensureState(),key=keyOf(path,name);
    let id=s.bindings[key],record=id?s.files[id]:null;
    if(!record&&create){
      id=makeId();record={id,versions:[]};s.files[id]=record;s.bindings[key]=id;
    }
    return record||null;
  }
  function prune(){
    const s=ensureState();
    for(const record of Object.values(s.files)){
      record.versions.sort((a,b)=>Number(a.at)-Number(b.at));
      if(record.versions.length>MAX_PER_FILE)record.versions.splice(0,record.versions.length-MAX_PER_FILE);
    }
    let all=[];
    for(const [id,record] of Object.entries(s.files))
      for(const v of record.versions)all.push({id,v});
    all.sort((a,b)=>Number(a.v.at)-Number(b.v.at));
    let total=all.reduce((n,x)=>n+(Number(x.v.size)||0),0);
    while(all.length>MAX_GLOBAL||total>MAX_TOTAL_BYTES){
      const x=all.shift();if(!x)break;
      const record=s.files[x.id],i=record?.versions.findIndex(v=>v.id===x.v.id)??-1;
      if(i>=0){total-=Number(record.versions[i].size)||0;record.versions.splice(i,1)}
    }
  }  function capture(path,name,{reason="Alteração",value}={}){
    const files=ensureFolder(path);
    if(!Object.prototype.hasOwnProperty.call(files,name))return {ok:false,reason:"missing"};
    const current=arguments[2]&&Object.prototype.hasOwnProperty.call(arguments[2],"value")?value:files[name];
    const snap=eligible(current);
    if(!snap)return {ok:false,reason:"unsupported"};
    const record=getRecord(path,name,true),latest=record.versions.at(-1);
    if(latest?.hash===snap.hash)return {ok:false,reason:"duplicate"};
    const meta=globalThis.Win11ExplorerFilesystem?.getMetadata?.(path,name,"file")||{};
    const version={id:makeVersionId(),at:Date.now(),reason:String(reason||"Alteração"),
      size:snap.size,hash:snap.hash,content:snap.content,modified:Number(meta.modified)||0};
    record.versions.push(version);prune();saveState();
    return {ok:true,id:version.id,size:version.size};
  }
  function beforeWrite(path,name,nextValue,reason="Antes de guardar"){
    const files=ensureFolder(path);
    if(!Object.prototype.hasOwnProperty.call(files,name)||files[name]===nextValue)return {ok:false,reason:"unchanged"};
    return capture(path,name,{reason,value:files[name]});
  }
  function list(path,name){
    const r=getRecord(path,name,false);
    return (r?.versions||[]).slice().sort((a,b)=>Number(b.at)-Number(a.at))
      .map(({content,...v})=>({...v}));
  }  function moveBinding(srcPath,srcName,dstPath,dstName){
    const s=ensureState(),oldKey=keyOf(srcPath,srcName),id=s.bindings[oldKey];
    if(!id)return false;
    delete s.bindings[oldKey];s.bindings[keyOf(dstPath,dstName)]=id;saveState();return true;
  }
  function moveTree(oldRoot,newRoot){
    const s=ensureState(),changes=[];
    for(const [key,id] of Object.entries(s.bindings)){
      const [path,name]=parseKey(key);
      if(path===oldRoot||path.startsWith(oldRoot+"/"))changes.push({key,id,path,name});
    }
    for(const x of changes){
      delete s.bindings[x.key];
      s.bindings[keyOf(newRoot+x.path.slice(oldRoot.length),x.name)]=x.id;
    }
    if(changes.length)saveState();
    return changes.length;
  }
  function detach(path,name){
    const s=ensureState(),key=keyOf(path,name),id=s.bindings[key]||"";
    if(id){delete s.bindings[key];saveState()}return id;
  }
  function attach(id,path,name){
    const s=ensureState();if(!id||!s.files[id])return false;
    s.bindings[keyOf(path,name)]=id;saveState();return true;
  }  function detachTree(root){
    const s=ensureState(),out=[];
    for(const [key,id] of Object.entries(s.bindings)){
      const [path,name]=parseKey(key);
      if(path===root||path.startsWith(root+"/")){
        out.push({relPath:path.slice(root.length),name,id});delete s.bindings[key];
      }
    }
    if(out.length)saveState();return out;
  }
  function attachTree(root,items){
    const s=ensureState();let count=0;
    for(const x of items||[]){
      if(!x?.id||!s.files[x.id])continue;
      s.bindings[keyOf(root+String(x.relPath||""),x.name)]=x.id;count++;
    }
    if(count)saveState();return count;
  }
  function purgeId(id){
    const s=ensureState();if(!id||!s.files[id])return false;
    delete s.files[id];
    for(const [key,value] of Object.entries(s.bindings))if(value===id)delete s.bindings[key];
    saveState();return true;
  }
  function purgePath(path,name){
    const s=ensureState(),id=s.bindings[keyOf(path,name)];
    return id?purgeId(id):false;
  }
  function purgeTree(root){
    const s=ensureState(),ids=new Set();
    for(const [key,id] of Object.entries(s.bindings)){
      const [path]=parseKey(key);if(path===root||path.startsWith(root+"/"))ids.add(id);
    }
    let count=0;for(const id of ids)if(purgeId(id))count++;return count;
  }  function refreshExplorers(){
    document.querySelectorAll('#window-layer > .window[data-app="explorer"]').forEach(win=>{
      const wrap=win.querySelector(".explorer-navigation-v820");
      wrap?.__explorerProV740?.refresh?.();
    });
  }
  function restore(path,name,versionId){
    const files=ensureFolder(path),record=getRecord(path,name,false);
    if(!record||!Object.prototype.hasOwnProperty.call(files,name))return {ok:false,reason:"missing"};
    const version=record.versions.find(v=>v.id===versionId);if(!version)return {ok:false,reason:"version-missing"};
    beforeWrite(path,name,version.content,"Antes de restaurar versão");
    files[name]=version.content;
    globalThis.Win11ExplorerFilesystem?.touch?.(path,name,{modified:Date.now()});
    saveState();globalThis.Win11SearchV920?.invalidate?.();refreshExplorers();
    notify("Versões anteriores",name+" restaurado para a versão selecionada.");
    return {ok:true};
  }
  function removeVersion(path,name,versionId){
    const record=getRecord(path,name,false);if(!record)return false;
    const i=record.versions.findIndex(v=>v.id===versionId);if(i<0)return false;
    record.versions.splice(i,1);saveState();return true;
  }
  function clearFile(path,name){
    const s=ensureState(),key=keyOf(path,name),id=s.bindings[key];if(!id)return false;
    delete s.bindings[key];delete s.files[id];saveState();return true;
  }  function show(path,name){
    const versions=list(path,name);
    let html='<div class="explorer-versions-v960"><div class="versions-head-v960"><strong>'+escapeHTML(name)+'</strong>'+
      '<span>'+versions.length+' versão'+(versions.length===1?"":"ões")+' '+(versions.length===1?"disponível":"disponíveis")+'</span></div>';
    if(!versions.length)html+='<p class="versions-empty-v960">Ainda não existem versões anteriores restauráveis para este ficheiro.</p>';
    else for(const v of versions)html+='<div class="version-row-v960" data-version-id="'+escapeHTML(v.id)+'">'+
      '<div><strong>'+escapeHTML(new Date(v.at).toLocaleString("pt-PT"))+'</strong><small>'+escapeHTML(v.reason)+" · "+escapeHTML(formatBytes(v.size))+'</small></div>'+
      '<div><button data-version-restore>Restaurar</button><button data-version-delete>Eliminar</button></div></div>';
    html+='</div>';
    showSystemDialog("Versões anteriores",html,"Fechar",()=>{});
    const body=document.querySelector("#system-dialog-body");
    body?.querySelectorAll(".version-row-v960").forEach(row=>{
      const id=row.dataset.versionId;
      row.querySelector("[data-version-restore]").onclick=()=>{if(restore(path,name,id)?.ok){document.querySelector("#system-dialog")?.classList.remove("open")}};
      row.querySelector("[data-version-delete]").onclick=()=>{if(removeVersion(path,name,id)){row.remove()}};
    });
    return versions.length;
  }
  globalThis.Win11ExplorerVersions=Object.freeze({
    version:VERSION,capture,beforeWrite,list,restore,show,removeVersion,clearFile,
    moveBinding,moveTree,detach,attach,detachTree,attachTree,purgeId,purgePath,purgeTree,
    limits:Object.freeze({perFile:MAX_PER_FILE,global:MAX_GLOBAL,snapshotBytes:MAX_SNAPSHOT_BYTES,totalBytes:MAX_TOTAL_BYTES})
  });  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:29,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-previous-versions","explorer-version-snapshots","explorer-version-restore",
      "explorer-version-bounded-storage","explorer-version-move-binding","explorer-version-recycle-binding",
      "notepad-version-capture","explorer-properties-previous-versions"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();