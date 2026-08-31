"use strict";
(function installExplorerFilesystemV910(){
  const previousBuildExplorer=globalThis.buildExplorerV5;
  if(typeof previousBuildExplorer!=="function")throw new Error("Explorer must load before Explorer Filesystem V9.1.");

  function ensureFsState(){
    if(!state.explorerFilesystemV91||typeof state.explorerFilesystemV91!=="object"){
      state.explorerFilesystemV91={schemaVersion:1,showHidden:false,showExtensions:true,metadata:{}};
    }
    const s=state.explorerFilesystemV91;
    s.schemaVersion=1;
    s.showHidden=!!s.showHidden;
    s.showExtensions=s.showExtensions!==false;
    if(!s.metadata||typeof s.metadata!=="object")s.metadata={};
    return s;
  }

  function effectiveFsPrefs(){
    const legacy=ensureFsState();
    try{
      const p=globalThis.Win11SettingsStore?.get?.("explorer");
      if(p)return {...legacy,showHidden:!!p.showHidden,showExtensions:!!p.showExtensions};
    }catch{}
    return legacy;
  }
  function writeExplorerSetting(key,value){
    const path="explorer."+key;
    try{
      if(globalThis.Win11SettingsStore?.validate?.(path,value)){
        Win11SettingsStore.set(path,value,{source:"explorer-filesystem-v910-compat"});
        refreshAll();return true;
      }
    }catch{}
    const s=ensureFsState();s[key]=value;saveState();refreshAll();return true;
  }

  function fullPath(path,name){return String(path||"").replace(/\/$/,"")+"/"+String(name||"")}
  function cleanMeta(meta,fallback=Date.now()){
    const created=Number(meta?.created)||Number(meta?.modified)||fallback;
    const modified=Number(meta?.modified)||created;
    return {created,modified,hidden:!!meta?.hidden};
  }
  function ensureMeta(path,name,type="file",value=null,persist=false){
    const s=ensureFsState(),key=fullPath(path,name);
    if(!s.metadata[key]){
      const ts=Number(value?.lastModified)||Number(value?.createdAt)||Date.now();
      s.metadata[key]=cleanMeta({created:ts,modified:ts,hidden:String(name).startsWith(".")},ts);
      if(persist)saveState();
    }else s.metadata[key]=cleanMeta(s.metadata[key]);
    return s.metadata[key];
  }
  function getMetadata(path,name,type="file"){
    const value=type==="file"?ensureFolder(path)[name]:null;
    return {...ensureMeta(path,name,type,value,false)};
  }
  function touch(path,name,patch={}){
    const type=Object.prototype.hasOwnProperty.call(ensureFolder(path),name)?"file":"folder";
    const m=ensureMeta(path,name,type,type==="file"?ensureFolder(path)[name]:null,false);
    Object.assign(m,patch);
    if(!("modified" in patch))m.modified=Date.now();
    m.hidden=!!m.hidden;
    saveState();globalThis.Win11SearchV920?.invalidate?.();refreshAll();
    return {...m};
  }
  function removeMetaTree(root){
    const s=ensureFsState();
    for(const key of Object.keys(s.metadata))if(key===root||key.startsWith(root+"/"))delete s.metadata[key];
  }
  function moveMetaTree(oldRoot,newRoot,copy=false){
    const s=ensureFsState(),now=Date.now();
    const entries=Object.entries(s.metadata).filter(([k])=>k===oldRoot||k.startsWith(oldRoot+"/"));
    for(const [key,meta] of entries){
      const next=newRoot+key.slice(oldRoot.length);
      s.metadata[next]={...cleanMeta(meta),created:copy?now:cleanMeta(meta).created,modified:cleanMeta(meta).modified};
      if(!copy)delete s.metadata[key];
    }
  }
  function onTransfer({srcPath,srcName,dstPath,dstName,type,move}={}){
    if(!srcPath||!srcName||!dstPath||!dstName)return false;
    const oldRoot=fullPath(srcPath,srcName),newRoot=fullPath(dstPath,dstName);
    ensureMeta(srcPath,srcName,type,type==="file"?ensureFolder(srcPath)[srcName]:null,false);
    moveMetaTree(oldRoot,newRoot,!move);
    saveState();globalThis.Win11SearchV920?.invalidate?.();return true;
  }
  function onRename({path,oldName,newName,type}={}){
    if(!path||!oldName||!newName)return false;
    ensureMeta(path,oldName,type,type==="file"?ensureFolder(path)[newName]:null,false);
    moveMetaTree(fullPath(path,oldName),fullPath(path,newName),false);
    const m=ensureFsState().metadata[fullPath(path,newName)];
    if(m)m.modified=Date.now();
    saveState();globalThis.Win11SearchV920?.invalidate?.();return true;
  }
  function onDelete({path,name,type}={}){
    if(!path||!name)return false;
    removeMetaTree(fullPath(path,name));saveState();globalThis.Win11SearchV920?.invalidate?.();return true;
  }  function uniqueShortcutName(path,targetName){
    const base=String(targetName||"Atalho").replace(/\.lnk$/i,"");
    const files=ensureFolder(path);
    let name=base+" - Atalho.lnk",i=2;
    while(Object.prototype.hasOwnProperty.call(files,name))name=base+" - Atalho ("+(i++)+").lnk";
    return name;
  }
  function createShortcut(path,target){
    if(!path||!target?.path||!target?.name||!["file","folder"].includes(target.type))return null;
    const name=uniqueShortcutName(path,target.name),now=Date.now();
    ensureFolder(path)[name]={
      __virtualShortcutV91:true,
      targetPath:target.path,targetName:target.name,targetType:target.type,
      createdAt:now,lastModified:now
    };
    ensureFsState().metadata[fullPath(path,name)]={created:now,modified:now,hidden:false};
    saveState();globalThis.Win11SearchV920?.invalidate?.();
    document.querySelectorAll('.window[data-app="explorer"]').forEach(w=>w.__explorerProV740?.forceRender?.());
    setTimeout(refreshAll,50);
    return {path,name};
  }
  function shortcutTarget(value){
    return value?.__virtualShortcutV91?{path:value.targetPath,name:value.targetName,type:value.targetType}:null;
  }
  function openShortcut(wrap,path,name){
    const value=ensureFolder(path)[name],target=shortcutTarget(value);
    if(!target)return false;
    if(target.type==="folder"){
      const dest=fullPath(target.path,target.name);
      if(!Object.prototype.hasOwnProperty.call(state.files||{},dest)){
        notify("Explorador","O destino deste atalho já não existe.");return true;
      }
      wrap.__explorerNavigationV820?.go?.(dest)||wrap.dispatchEvent(new CustomEvent("navigate",{detail:dest}));
      return true;
    }
    if(!Object.prototype.hasOwnProperty.call(ensureFolder(target.path),target.name)){
      notify("Explorador","O destino deste atalho já não existe.");return true;
    }
    openFile(target.path,target.name,ensureFolder(target.path)[target.name]);
    return true;
  }

  function selectedItem(wrap){
    const nodes=[...wrap.querySelectorAll(".file.selected,.file-row.selected:not(.header)")];
    if(nodes.length!==1)return null;
    const n=nodes[0],name=n.dataset.v740Name;
    if(!name)return null;
    return {path:globalThis.Win11ExplorerPro?.currentVirtualPath?.(wrap)||wrap.querySelector(".pathbar")?.textContent||"",name,type:n.dataset.v740Type||"file"};
  }
  function displayName(name,type,showExtensions){
    if(type!=="file"||showExtensions)return name;
    const dot=name.lastIndexOf(".");
    return dot>0?name.slice(0,dot):name;
  }
  function labelNode(node){return node.querySelector(".file-name")||node.querySelector(".fname span:last-child")}
  function refreshWrap(wrap){
    const prefs=effectiveFsPrefs();
    if(!wrap||wrap.classList.contains("real-mount-mode"))return;
    const metaCountBefore=Object.keys(prefs.metadata).length;
    const path=globalThis.Win11ExplorerPro?.currentVirtualPath?.(wrap)||String(wrap.querySelector(".pathbar")?.textContent||"");
    if(!path||path==="This PC"||path==="Recycle Bin")return;
    for(const node of wrap.querySelectorAll(".file,.file-row:not(.header)")){
      const label=labelNode(node);
      const canonical=node.dataset.v740Name||node.dataset.v910Name||label?.textContent?.trim()||"";
      if(!canonical)continue;
      node.dataset.v910Name=canonical;
      if(!node.dataset.v740Name)continue;
      const name=node.dataset.v740Name;
      const type=node.dataset.v740Type||"file";
      const value=type==="file"?ensureFolder(path)[name]:null;
      const meta=ensureMeta(path,name,type,value,false);
      node.classList.toggle("filesystem-hidden-v910",meta.hidden&&!prefs.showHidden);
      node.classList.toggle("filesystem-hidden-visible-v910",meta.hidden&&prefs.showHidden);
      if(label)label.textContent=displayName(name,type,prefs.showExtensions);
      const shortcut=shortcutTarget(value);
      node.classList.toggle("filesystem-shortcut-v910",!!shortcut);
      if(shortcut&&!node.querySelector(".filesystem-shortcut-badge-v910")){
        const badge=document.createElement("span");badge.className="filesystem-shortcut-badge-v910";badge.textContent="↗";node.appendChild(badge);
      }
    }
    if(Object.keys(prefs.metadata).length!==metaCountBefore)saveState();
  }
  function refreshAll(){
    document.querySelectorAll('.window[data-app="explorer"],.window[data-app="recycle"]').forEach(w=>refreshWrap(w));
  }  function installFilesystem(wrap,win){
    if(!wrap||wrap.dataset.explorerFilesystemV910==="1")return;
    wrap.dataset.explorerFilesystemV910="1";wrap.classList.add("explorer-filesystem-v910");
    const command=wrap.querySelector(".explorer-command"),filesHost=wrap.querySelector(".explorer-files");
    if(!command||!filesHost)return;
    ensureFsState();

    const button=document.createElement("button");
    button.dataset.filesystemV910="";
    button.innerHTML='<span class="cmd-icon">⚙</span><span class="cmd-label">Ficheiros</span>';
    button.title="Opções de ficheiros";
    const overflow=wrap.querySelector("[data-overflow-v880]");
    command.insertBefore(button,overflow||null);

    button.onclick=e=>{
      const s=effectiveFsPrefs(),item=selectedItem(wrap),menu=[
        [s.showHidden?"Ocultar itens ocultos":"Mostrar itens ocultos",()=>writeExplorerSetting("showHidden",!s.showHidden)],
        [s.showExtensions?"Ocultar extensões":"Mostrar extensões",()=>writeExplorerSetting("showExtensions",!s.showExtensions)]
      ];
      if(item){
        const m=getMetadata(item.path,item.name,item.type);
        menu.push("---");
        menu.push([m.hidden?"Remover atributo Oculto":"Marcar como oculto",()=>{touch(item.path,item.name,{hidden:!m.hidden});refreshWrap(wrap)}]);
        menu.push(["Criar atalho aqui",()=>{const out=createShortcut(item.path,item);if(out)notify("Explorador",out.name+" criado.")}]);
      }
      showContext(e.clientX,e.clientY,menu);
    };

    filesHost.addEventListener("dblclick",e=>{
      if(wrap.classList.contains("real-mount-mode"))return;
      const node=e.target.closest(".file,.file-row:not(.header)");
      if(!node)return;
      const path=globalThis.Win11ExplorerPro?.currentVirtualPath?.(wrap)||String(wrap.querySelector(".pathbar")?.textContent||"");
      const name=node.dataset.v740Name;
      if(name&&shortcutTarget(ensureFolder(path)[name])){
        e.preventDefault();e.stopImmediatePropagation();openShortcut(wrap,path,name);
      }
    },true);

    let decorating=false,timer=0;
    const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(decorating)return;decorating=true;refreshWrap(wrap);decorating=false},20)};
    const observer=new MutationObserver(schedule);
    observer.observe(filesHost,{childList:true,subtree:true});
    const pathbar=wrap.querySelector(".pathbar");
    const pathObserver=new MutationObserver(schedule);
    if(pathbar)pathObserver.observe(pathbar,{childList:true,subtree:true,characterData:true});
    schedule();

    const api=Object.freeze({
      getState:()=>JSON.parse(JSON.stringify(effectiveFsPrefs())),
      getMetadata,setHidden:(path,name,hidden)=>touch(path,name,{hidden:!!hidden}),
      setShowHidden:v=>writeExplorerSetting("showHidden",!!v),
      setShowExtensions:v=>writeExplorerSetting("showExtensions",!!v),
      createShortcut:(target,path=target?.path)=>createShortcut(path,target),
      openShortcut:(path,name)=>openShortcut(wrap,path,name),
      refresh:()=>refreshWrap(wrap)
    });
    wrap.__explorerFilesystemV910=api;if(win)win.__explorerFilesystemV910=api;

    const cleanup=setInterval(()=>{if(wrap.isConnected)return;clearInterval(cleanup);clearTimeout(timer);observer.disconnect();pathObserver.disconnect()},1000);
  }

  globalThis.buildExplorerV5=function(wrap,win,startPath){previousBuildExplorer(wrap,win,startPath);installFilesystem(wrap,win)};
  try{buildExplorerV5=globalThis.buildExplorerV5}catch{}

  globalThis.Win11ExplorerFilesystem=Object.freeze({
    version:"9.1.0",getMetadata,touch,onTransfer,onRename,onDelete,createShortcut,shortcutTarget,refreshAll,
    getState:()=>JSON.parse(JSON.stringify(effectiveFsPrefs()))
  });
  globalThis.Win11RealFunctions=Object.freeze({
    version:"9.1.0",step:24,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-file-metadata","explorer-hidden-files","explorer-extension-visibility",
      "explorer-virtual-shortcuts","explorer-shortcut-resolution","explorer-metadata-transfer"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();