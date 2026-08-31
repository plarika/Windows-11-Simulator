"use strict";
/* Windows 11 Simulator V7.4 — Explorer Pro */
(function installExplorerProV740(){
  const previousBuildExplorer=globalThis.buildExplorerV5;
  if(typeof previousBuildExplorer!=="function")throw new Error("Explorer V5 must load before Explorer Pro V7.4.");

  const CLIPBOARD_KEY="fileClipboardV74";
  const FILTER_RE=/\b(?:type|ext|name|size):/i;

  function own(obj,key){return Object.prototype.hasOwnProperty.call(obj,key)}
  function cleanName(value){return String(value||"").trim().replace(/[\\/:*?"<>|]/g,"_")}
  function cloneSafe(value){try{return structuredClone(value)}catch{try{return JSON.parse(JSON.stringify(value))}catch{return String(value)}}}

  function currentVirtualPath(wrap){
    if(wrap.classList.contains("real-mount-mode"))return null;
    const crumbs=[...wrap.querySelectorAll(".pathbar .crumb")].map(x=>x.textContent.trim()).filter(Boolean);
    if(crumbs.length){
      if(crumbs.length===1&&crumbs[0]==="Este PC")return "This PC";
      if(crumbs[0]==="Este PC")return "C:/"+crumbs.slice(1).join("/");
      return crumbs.join("/");
    }
    const raw=wrap.querySelector(".pathbar")?.textContent.trim()||"";
    if(raw.startsWith("Pasta real"))return null;
    return raw||"This PC";
  }

  function nodeName(node){
    return node.querySelector(".file-name")?.textContent.trim()||
      node.querySelector(".fname span:last-child")?.textContent.trim()||
      "";
  }

  function itemType(path,name){
    if(path==="Recycle Bin")return "recycle";
    if(path==="This PC"||!path)return "system";
    if(own(state.files,path+"/"+name))return "folder";
    if(own(ensureFolder(path),name))return "file";
    return "unknown";
  }

  function itemValue(path,name,type){
    if(type==="file")return ensureFolder(path)[name];
    if(type==="recycle")return ensureFolder("Recycle Bin")[name];
    return null;
  }

  function visibleNodes(grid){
    return [...grid.children].filter(node=>
      !node.classList.contains("header")&&
      !node.hidden&&
      node.matches(".file,.file-row")
    );
  }

  function allItemNodes(grid){
    return [...grid.children].filter(node=>
      !node.classList.contains("header")&&node.matches(".file,.file-row")
    );
  }

  function uniqueFileName(folder,name){
    const files=ensureFolder(folder);
    if(!own(files,name))return name;
    const dot=name.lastIndexOf(".");
    const stem=dot>0?name.slice(0,dot):name;
    const ext=dot>0?name.slice(dot):"";
    let i=2,candidate;
    do{candidate=stem+" ("+i+++ ")"+ext}while(own(files,candidate));
    return candidate;
  }

  function uniqueFolderName(parent,name){
    let candidate=name,i=2;
    while(own(state.files,parent+"/"+candidate))candidate=name+" ("+i+++ ")";
    return candidate;
  }

  async function cloneVirtualValue(value){
    if(value?.__realBlobId&&globalThis.RealContentBridge?.getRecord&&globalThis.RealContentBridge?.putBlob){
      const record=await RealContentBridge.getRecord(value);
      if(record){
        const file=new File(
          [record.blob],
          value.name||record.name||"ficheiro",
          {type:value.type||record.type||record.blob.type||"application/octet-stream",lastModified:Number(value.lastModified||record.lastModified)||Date.now()}
        );
        return await RealContentBridge.putBlob(file);
      }
    }
    return cloneSafe(value);
  }

  async function copyFileAdvanced(srcPath,name,dstPath,move=false){
    if(!srcPath||!dstPath||(move&&srcPath===dstPath))return {ok:false,reason:"same"};
    const src=ensureFolder(srcPath);
    if(!own(src,name))return {ok:false,reason:"missing"};
    const target=uniqueFileName(dstPath,name);
    ensureFolder(dstPath)[target]=move?src[name]:await cloneVirtualValue(src[name]);
    globalThis.Win11ExplorerFilesystem?.onTransfer?.({srcPath,srcName:name,dstPath,dstName:target,type:"file",move});
    if(move)delete src[name];
    return {ok:true,name:target};
  }

  async function copyFolderAdvanced(srcFolder,dstParent,move=false){
    if(!srcFolder||!dstParent)return {ok:false,reason:"missing"};
    if(dstParent===srcFolder||dstParent.startsWith(srcFolder+"/"))return {ok:false,reason:"descendant"};
    if(!own(state.files,srcFolder))return {ok:false,reason:"missing"};
    const base=srcFolder.split("/").pop();
    const targetName=uniqueFolderName(dstParent,base);
    const targetRoot=dstParent+"/"+targetName;
    const paths=Object.keys(state.files)
      .filter(p=>p===srcFolder||p.startsWith(srcFolder+"/"))
      .sort((a,b)=>a.length-b.length);

    if(move){
      for(const p of paths){
        const rel=p.slice(srcFolder.length);
        state.files[targetRoot+rel]=state.files[p];
      }
      [...paths].sort((a,b)=>b.length-a.length).forEach(p=>delete state.files[p]);
    }else{
      for(const p of paths){
        const rel=p.slice(srcFolder.length);
        const out={};
        for(const [name,value] of Object.entries(state.files[p]||{}))out[name]=await cloneVirtualValue(value);
        state.files[targetRoot+rel]=out;
      }
    }
    globalThis.Win11ExplorerFilesystem?.onTransfer?.({
      srcPath:srcFolder.slice(0,srcFolder.lastIndexOf("/")),
      srcName:base,dstPath:dstParent,dstName:targetName,type:"folder",move
    });
    return {ok:true,name:targetName};
  }

  function folderSnapshot(root){
    const paths=Object.keys(state.files)
      .filter(p=>p===root||p.startsWith(root+"/"))
      .sort((a,b)=>a.length-b.length);
    return paths.map(p=>({rel:p.slice(root.length),files:state.files[p]}));
  }

  function uniqueTrashName(name){
    const bin=ensureFolder("Recycle Bin");
    if(!own(bin,name))return name;
    let i=2,candidate;
    do{candidate=name+" ("+i+++ ")"}while(own(bin,candidate));
    return candidate;
  }

  function moveFileToRecycle(path,name){
    const files=ensureFolder(path),bin=ensureFolder("Recycle Bin");
    if(!own(files,name))return false;
    const trashName=uniqueTrashName(name);
    bin[trashName]={content:files[name],originalPath:path,deletedAt:Date.now(),kind:"file"};
    delete files[name];
    return true;
  }

  function moveFolderToRecycle(parent,name){
    const root=parent+"/"+name;
    if(!own(state.files,root))return false;
    const tree=folderSnapshot(root);
    const trashName=uniqueTrashName(name);
    ensureFolder("Recycle Bin")[trashName]={
      content:{__virtualFolderTrash:true,rootName:name,tree},
      originalPath:parent,
      deletedAt:Date.now(),
      kind:"folder"
    };
    [...tree].sort((a,b)=>b.rel.length-a.rel.length).forEach(entry=>delete state.files[root+entry.rel]);
    return true;
  }

  async function cleanupValueIfUnreferenced(value){
    if(!value?.__realBlobId||!globalThis.RealContentBridge?.cleanupVirtualValue)return;
    const id=value.__realBlobId;
    let references=0;
    const scan=v=>{
      if(v?.__realBlobId===id)references++;
      if(v?.__virtualFolderTrash&&Array.isArray(v.tree)){
        for(const t of v.tree)for(const x of Object.values(t.files||{}))scan(x);
      }
    };
    for(const files of Object.values(state.files||{}))for(const v of Object.values(files||{}))scan(v);
    if(references===0)await RealContentBridge.cleanupVirtualValue(value);
  }

  async function permanentlyDeleteVirtual(path,name,type){
    if(type==="file"){
      const files=ensureFolder(path);
      if(!own(files,name))return false;
      const value=files[name];
      delete files[name];
      globalThis.Win11ExplorerFilesystem?.onDelete?.({path,name,type:"file"});
      await cleanupValueIfUnreferenced(value);
      return true;
    }
    if(type==="folder"){
      const root=path+"/"+name;
      const tree=folderSnapshot(root);
      [...tree].sort((a,b)=>b.rel.length-a.rel.length).forEach(entry=>delete state.files[root+entry.rel]);
      globalThis.Win11ExplorerFilesystem?.onDelete?.({path,name,type:"folder"});
      for(const entry of tree)for(const value of Object.values(entry.files||{}))await cleanupValueIfUnreferenced(value);
      return true;
    }
    if(type==="recycle"){
      const bin=ensureFolder("Recycle Bin");
      const entry=bin[name];
      if(!entry)return false;
      delete bin[name];
      if(entry.content?.__virtualFolderTrash){
        for(const t of entry.content.tree||[])for(const value of Object.values(t.files||{}))await cleanupValueIfUnreferenced(value);
      }else await cleanupValueIfUnreferenced(entry.content);
      return true;
    }
    return false;
  }

  function restoreRecycleItem(name){
    const bin=ensureFolder("Recycle Bin"),entry=bin[name];
    if(!entry)return false;
    const pack=entry.content;
    if(pack?.__virtualFolderTrash){
      const parent=entry.originalPath||"C:/Desktop";
      const rootName=uniqueFolderName(parent,pack.rootName||name);
      const root=parent+"/"+rootName;
      for(const t of pack.tree||[])state.files[root+(t.rel||"")]=t.files||{};
      delete bin[name];
      return true;
    }
    const parent=entry.originalPath||"C:/Desktop";
    const target=uniqueFileName(parent,name);
    ensureFolder(parent)[target]=pack;
    delete bin[name];
    return true;
  }

  function measureValue(value){
    if(value?.size!==undefined&&Number.isFinite(Number(value.size)))return Number(value.size)||0;
    try{return fileSize(value)}catch{return typeof value==="string"?new Blob([value]).size:0}
  }

  function measureFolder(root){
    let files=0,folders=0,size=0;
    const paths=Object.keys(state.files).filter(p=>p===root||p.startsWith(root+"/"));
    folders=Math.max(0,paths.length-1);
    for(const p of paths){
      for(const value of Object.values(state.files[p]||{})){files++;size+=measureValue(value)}
    }
    return {files,folders,size};
  }

  function parseSize(value){
    const m=String(value||"").trim().match(/^([<>]=?)?\s*([0-9.]+)\s*(b|kb|mb|gb)?$/i);
    if(!m)return null;
    const unit=(m[3]||"b").toLowerCase();
    const mult={b:1,kb:1024,mb:1024**2,gb:1024**3}[unit]||1;
    return {op:m[1]||"=",bytes:Number(m[2])*mult};
  }

  function compareSize(size,rule){
    if(!rule)return true;
    if(rule.op===">")return size>rule.bytes;
    if(rule.op===">=")return size>=rule.bytes;
    if(rule.op==="<")return size<rule.bytes;
    if(rule.op==="<=")return size<=rule.bytes;
    return Math.abs(size-rule.bytes)<1;
  }

  function classify(name,type,value){
    if(type==="folder")return "folder";
    const ext=(name.split(".").pop()||"").toLowerCase();
    if(["png","jpg","jpeg","webp","gif","bmp","svg"].includes(ext))return "image";
    if(["mp3","wav","ogg","m4a","aac","flac"].includes(ext))return "audio";
    if(["mp4","webm","mov","mkv","avi"].includes(ext))return "video";
    if(["txt","md","log","csv","json","xml","html","css","js","mjs"].includes(ext))return "document";
    if(value?.type?.startsWith("image/"))return "image";
    if(value?.type?.startsWith("audio/"))return "audio";
    if(value?.type?.startsWith("video/"))return "video";
    return "file";
  }

  function parseFilter(raw){
    const tokens=String(raw||"").trim().match(/(?:[^\s"]+|"[^"]*")+/g)||[];
    const filter={text:[]};
    for(const token0 of tokens){
      const token=token0.replace(/^"|"$/g,"");
      const i=token.indexOf(":");
      if(i>0){
        const key=token.slice(0,i).toLowerCase(),value=token.slice(i+1);
        if(["type","ext","name","size"].includes(key)){filter[key]=value;continue}
      }
      filter.text.push(token.toLowerCase());
    }
    return filter;
  }

  function matchesFilter(path,node,filter){
    const name=node.dataset.v740Name||nodeName(node);
    const type=node.dataset.v740Type||itemType(path,name);
    const value=itemValue(path,name,type);
    const lower=name.toLowerCase();
    if(filter.name&&!lower.includes(filter.name.toLowerCase()))return false;
    if(filter.ext){
      const wanted=filter.ext.toLowerCase().replace(/^\./,"");
      if(!lower.endsWith("."+wanted))return false;
    }
    if(filter.type&&classify(name,type,value)!==filter.type.toLowerCase())return false;
    if(filter.size&&!compareSize(type==="folder"?measureFolder(path+"/"+name).size:measureValue(value),parseSize(filter.size)))return false;
    if(filter.text.length&&!filter.text.every(x=>lower.includes(x)))return false;
    return true;
  }

  function installExplorerPro(wrap,win,startPath){
    if(wrap.dataset.explorerProV740==="1")return;
    wrap.dataset.explorerProV740="1";
    wrap.classList.add("explorer-pro-v740");

    const grid=wrap.querySelector(".file-grid,.file-list,.thispc-grid");
    const search=wrap.querySelector(".explorer-search");
    const filesHost=wrap.querySelector(".explorer-files");
    const command=wrap.querySelector(".explorer-command");
    if(!grid||!search||!command)return;

    let selectedNames=new Set();
    let anchorName="";
    let advancedQuery="";
    let decorating=false;
    let selectionBox=null;
    let dragStart=null;
    let thumbnailUrls=new Map();

    const originalSearchHandler=search.oninput;
    const originalCopy=wrap.querySelector("[data-copy]")?.onclick;
    const originalCut=wrap.querySelector("[data-cut]")?.onclick;
    const originalPaste=wrap.querySelector("[data-paste]")?.onclick;
    const originalRename=wrap.querySelector("[data-rename]")?.onclick;
    const originalDelete=wrap.querySelector("[data-delete]")?.onclick;

    search.placeholder="Pesquisar · type:image · ext:png · name:relatório · size:>1mb";

    const propertiesButton=document.createElement("button");
    propertiesButton.dataset.propertiesV740="";
    propertiesButton.innerHTML='<span class="cmd-icon">ⓘ</span><span class="cmd-label">Propriedades</span>';
    propertiesButton.title="Propriedades (Alt+Enter)";
    const spacer=[...command.children].find(x=>x.tagName==="SPAN"&&String(x.getAttribute("style")||"").includes("flex"));
    command.insertBefore(propertiesButton,spacer||wrap.querySelector("[data-sort]"));

    function path(){return currentVirtualPath(wrap)}

    function getNodes(){return allItemNodes(grid)}

    function selectedItems(){
      const p=path();
      if(!p||p==="This PC")return [];
      return getNodes()
        .filter(n=>selectedNames.has(n.dataset.v740Name||nodeName(n)))
        .map(n=>({
          path:p,
          name:n.dataset.v740Name||nodeName(n),
          type:n.dataset.v740Type||itemType(p,n.dataset.v740Name||nodeName(n))
        }))
        .filter(x=>x.name&&["file","folder","recycle"].includes(x.type));
    }

    function revokeDetachedThumbs(){
      for(const [node,url] of [...thumbnailUrls]){
        if(node.isConnected)continue;
        URL.revokeObjectURL(url);
        thumbnailUrls.delete(node);
      }
    }

    async function installThumbnail(node,p,name,type){
      if(type!=="file"||node.querySelector(".explorer-pro-thumb"))return;
      const value=ensureFolder(p)[name];
      const kind=classify(name,type,value);
      if(kind!=="image")return;
      let src="";
      if(typeof value==="string"&&value.startsWith("data:image/"))src=value;
      else if(value?.__realBlobId&&globalThis.RealContentBridge?.getRecord){
        try{
          const record=await RealContentBridge.getRecord(value);
          if(!record||!node.isConnected||node.dataset.v740Name!==name)return;
          src=URL.createObjectURL(record.blob);
          thumbnailUrls.set(node,src);
        }catch{return}
      }
      if(!src)return;
      const img=document.createElement("img");
      img.className="explorer-pro-thumb";
      img.alt="";
      img.src=src;
      const icon=node.querySelector(".icon")||node.querySelector(".fname span:first-child");
      if(icon){icon.textContent="";icon.appendChild(img)}
    }

    function syncSelectionClasses(){
      for(const node of getNodes()){
        const name=node.dataset.v740Name||nodeName(node);
        node.classList.toggle("selected",selectedNames.has(name));
        node.setAttribute("aria-selected",selectedNames.has(name)?"true":"false");
      }
      updateStatus();
      updateCommandState();
    }

    function clearSelection(){
      selectedNames.clear();anchorName="";syncSelectionClasses();
    }

    function selectNode(node,event={}){
      const nodes=visibleNodes(grid);
      const name=node.dataset.v740Name||nodeName(node);
      if(!name)return;
      if(event.shiftKey&&anchorName){
        const a=nodes.findIndex(n=>(n.dataset.v740Name||nodeName(n))===anchorName);
        const b=nodes.indexOf(node);
        if(a>=0&&b>=0){
          if(!event.ctrlKey)selectedNames.clear();
          const [lo,hi]=a<b?[a,b]:[b,a];
          for(let i=lo;i<=hi;i++)selectedNames.add(nodes[i].dataset.v740Name||nodeName(nodes[i]));
        }
      }else if(event.ctrlKey||event.metaKey){
        if(selectedNames.has(name))selectedNames.delete(name);else selectedNames.add(name);
        anchorName=name;
      }else{
        selectedNames.clear();selectedNames.add(name);anchorName=name;
      }
      syncSelectionClasses();
    }

    function updateStatus(){
      const status=filesHost.querySelector(".explorer-status");
      if(!status)return;
      const total=getNodes().length;
      const shown=getNodes().filter(n=>!n.hidden).length;
      const chosen=selectedItems();
      const totalSize=chosen.reduce((sum,item)=>{
        if(item.type==="file")return sum+measureValue(ensureFolder(item.path)[item.name]);
        if(item.type==="folder")return sum+measureFolder(item.path+"/"+item.name).size;
        return sum;
      },0);
      const left=status.children[0],right=status.children[1];
      if(left)left.textContent=advancedQuery?shown+" de "+total+" itens":total+" item"+(total===1?"":"s");
      if(right)right.textContent=chosen.length
        ?chosen.length+" selecionado"+(chosen.length===1?"":"s")+(totalSize?" · "+formatBytes(totalSize):"")
        :"Windows 11 Simulator";
    }

    function updateCommandState(){
      const p=path(),count=selectedItems().length;
      const mounted=wrap.classList.contains("real-mount-mode");
      for(const selector of ["[data-copy]","[data-cut]","[data-rename]","[data-delete]","[data-properties-v740]"]){
        const b=wrap.querySelector(selector);
        if(b)b.disabled=mounted||p==="This PC"||(selector==="[data-rename]"?count!==1:count===0);
      }
      const paste=wrap.querySelector("[data-paste]");
      if(paste)paste.disabled=mounted||!p||p==="This PC"||p==="Recycle Bin"||(!state[CLIPBOARD_KEY]&&!state.fileClipboard);
    }

    function decorateNode(node,p){
      if(node.classList.contains("header"))return;
      const name=node.dataset.v910Name||nodeName(node);
      if(!name)return;
      node.dataset.v910Name=name;
      const type=itemType(p,name);
      node.dataset.v740Name=name;
      node.dataset.v740Type=type;
      node.setAttribute("role","option");
      node.setAttribute("aria-selected",selectedNames.has(name)?"true":"false");
      node.classList.toggle("selected",selectedNames.has(name));

      if(!node.dataset.v740Bound){
        node.dataset.v740Bound="1";
        const baseContext=node.oncontextmenu;
        const baseDouble=node.ondblclick;
        const baseDrop=node.ondrop;

        node.onclick=e=>{
          if(wrap.classList.contains("real-mount-mode"))return;
          selectNode(node,e);
        };

        node.ondblclick=e=>{
          if(e.button&&e.button!==0)return;
          if(baseDouble)baseDouble.call(node,e);
        };

        node.oncontextmenu=e=>{
          if(wrap.classList.contains("real-mount-mode"))return baseContext?.call(node,e);
          e.preventDefault();
          const thisName=node.dataset.v740Name||nodeName(node);
          if(!selectedNames.has(thisName)){
            selectedNames.clear();selectedNames.add(thisName);anchorName=thisName;syncSelectionClasses();
          }
          const items=selectedItems();
          if(items.length===1&&items[0].type!=="recycle"&&baseContext){
            baseContext.call(node,e);
            return;
          }
          const menu=[];
          if(items.some(x=>x.type==="recycle")){
            menu.push(["Restaurar",()=>restoreSelectedRecycle()]);
            menu.push(["Eliminar permanentemente",()=>confirmPermanentDelete()]);
          }else{
            menu.push(["Copiar",()=>copySelection("copy")]);
            menu.push(["Cortar",()=>copySelection("cut")]);
            menu.push(["Eliminar",()=>deleteSelection(false)]);
            menu.push(["Eliminar permanentemente",()=>confirmPermanentDelete()]);
          }
          menu.push(["Propriedades",()=>showSelectedProperties()]);
          showContext(e.clientX,e.clientY,menu);
        };

        node.draggable=type!=="recycle";
        node.ondragstart=e=>{
          if(wrap.classList.contains("real-mount-mode"))return;
          const thisName=node.dataset.v740Name||nodeName(node);
          if(!selectedNames.has(thisName)){
            selectedNames.clear();selectedNames.add(thisName);anchorName=thisName;syncSelectionClasses();
          }
          const items=selectedItems().filter(x=>x.type!=="recycle");
          const payload=JSON.stringify({version:1,items});
          e.dataTransfer.setData("application/x-win11sim-v74",payload);
          e.dataTransfer.setData("text/plain",payload);
          e.dataTransfer.effectAllowed="copyMove";
          node.classList.add("dragging");
        };
        node.ondragend=()=>node.classList.remove("dragging");

        if(type==="folder"){
          node.ondragover=e=>{
            if(wrap.classList.contains("real-mount-mode"))return baseDrop?undefined:undefined;
            e.preventDefault();
            e.dataTransfer.dropEffect=e.ctrlKey?"copy":"move";
            node.classList.add("drop-target");
          };
          node.ondragleave=()=>node.classList.remove("drop-target");
          node.ondrop=async e=>{
            node.classList.remove("drop-target");
            if(wrap.classList.contains("real-mount-mode"))return baseDrop?.call(node,e);
            const raw=e.dataTransfer.getData("application/x-win11sim-v74");
            if(!raw)return baseDrop?.call(node,e);
            e.preventDefault();
            try{
              const data=JSON.parse(raw);
              const dest=path()+"/"+(node.dataset.v740Name||nodeName(node));
              await transferItems(data.items||[],dest,!e.ctrlKey);
            }catch(err){notify("Explorador",err?.message||"Não foi possível mover os itens.")}
          };
        }
      }

      if(type==="file"){
        const rowMeta=node.querySelectorAll(".meta");
        if(rowMeta.length>=2&&!node.querySelector(".explorer-pro-date")){
          const value=ensureFolder(p)[name];
          const date=document.createElement("div");
          date.className="meta explorer-pro-date";
          const ts=Number(value?.lastModified)||0;
          date.textContent=ts?new Date(ts).toLocaleDateString("pt-PT"):"—";
          node.appendChild(date);
        }
        installThumbnail(node,p,name,type);
      }
    }

    function decorate(){
      if(decorating)return;
      decorating=true;
      revokeDetachedThumbs();
      const p=path();
      if(!p||p==="This PC"||wrap.classList.contains("real-mount-mode")){
        updateCommandState();decorating=false;return;
      }
      for(const node of getNodes())decorateNode(node,p);
      globalThis.Win11ExplorerFilesystem?.refreshAll?.();
      for(const name of [...selectedNames]){
        if(!getNodes().some(n=>(n.dataset.v740Name||nodeName(n))===name))selectedNames.delete(name);
      }
      if(advancedQuery)applyAdvancedFilter();
      syncSelectionClasses();
      decorating=false;
    }

    function forceRender(){
      if(wrap.classList.contains("real-mount-mode"))return;
      const active=wrap.querySelector("[data-list]")?.classList.contains("active")?"[data-list]":"[data-icons]";
      wrap.querySelector(active)?.click();
      setTimeout(decorate,0);
    }

    const integrationApi=Object.freeze({
      refresh:()=>setTimeout(decorate,0),
      forceRender
    });
    wrap.__explorerProV740=integrationApi;
    if(win)win.__explorerProV740=integrationApi;

    function copySelection(mode){
      const items=selectedItems().filter(x=>x.type!=="recycle");
      if(!items.length)return false;
      state[CLIPBOARD_KEY]={version:1,mode,items:cloneSafe(items),createdAt:Date.now()};
      state.fileClipboard=null;
      saveState();
      updateCommandState();
      notify("Explorador",items.length+" item"+(items.length===1?"":"s")+" "+(mode==="cut"?"pronto para mover.":"copiado para a área de transferência de ficheiros."));
      return true;
    }

    async function transferItems(items,destination,move){
      if(!destination||destination==="This PC"||destination==="Recycle Bin")return false;
      let done=0;
      const failed=[];
      for(const item of items){
        let result;
        try{
          result=item.type==="folder"
            ?await copyFolderAdvanced(item.path+"/"+item.name,destination,move)
            :await copyFileAdvanced(item.path,item.name,destination,move);
        }catch(err){result={ok:false,reason:err?.message||"error"}}
        if(result?.ok)done++;else failed.push(item);
      }
      if(done){
        saveState();
        selectedNames.clear();
        forceRender();
      }
      notify("Explorador",done+" item"+(done===1?"":"s")+" "+(move?"movido":"copiado")+(failed.length?" · "+failed.length+" não concluído(s).":"."));
      return {done,failed};
    }

    async function pasteSelection(){
      const p=path();
      if(!p||p==="This PC"||p==="Recycle Bin")return;
      const batch=state[CLIPBOARD_KEY];
      if(batch?.items?.length&&globalThis.Win11ExplorerOperations?.handlePaste){
        const handled=await Win11ExplorerOperations.handlePaste({
          wrap,win,destination:p,batch,clipboardKey:CLIPBOARD_KEY
        });
        if(handled){updateCommandState();setTimeout(decorate,0);return}
      }
      if(batch?.items?.length){
        const moving=batch.mode==="cut";
        const result=await transferItems(batch.items,p,moving);
        if(moving){
          if(result.failed.length)state[CLIPBOARD_KEY]={...batch,items:result.failed};
          else state[CLIPBOARD_KEY]=null;
          saveState();
        }
        updateCommandState();
        return;
      }
      if(originalPaste)originalPaste();
      setTimeout(decorate,0);
    }

    async function deleteSelection(permanent=false){
      const items=selectedItems();
      if(!items.length)return;
      let done=0;
      for(const item of items){
        try{
          let ok=false;
          if(permanent)ok=await permanentlyDeleteVirtual(item.path,item.name,item.type);
          else if(item.type==="file")ok=moveFileToRecycle(item.path,item.name);
          else if(item.type==="folder")ok=moveFolderToRecycle(item.path,item.name);
          else if(item.type==="recycle")ok=await permanentlyDeleteVirtual(item.path,item.name,item.type);
          if(ok)done++;
        }catch{}
      }
      selectedNames.clear();
      saveState();
      forceRender();
      notify("Explorador",done+" item"+(done===1?"":"s")+" "+(permanent?"eliminado permanentemente.":"movido para a Reciclagem."));
    }

    function confirmPermanentDelete(){
      const items=selectedItems();
      if(!items.length)return;
      showSystemDialog(
        "Eliminar permanentemente",
        "<p>Eliminar permanentemente <strong>"+items.length+" item"+(items.length===1?"":"s")+"</strong>?</p><p>Esta ação não pode ser anulada.</p>",
        "Eliminar",
        ()=>deleteSelection(true)
      );
    }

    function restoreSelectedRecycle(){
      const items=selectedItems().filter(x=>x.type==="recycle");
      let done=0;
      for(const item of items)if(restoreRecycleItem(item.name))done++;
      selectedNames.clear();
      saveState();
      forceRender();
      notify("Reciclagem",done+" item"+(done===1?"":"s")+" restaurado"+(done===1?"":"s")+".");
    }

    function renameSelection(){
      const items=selectedItems();
      if(items.length!==1||items[0].type==="recycle")return;
      const item=items[0],nextRaw=prompt("Novo nome:",item.name),next=cleanName(nextRaw);
      if(!next||next===item.name)return;
      if(item.type==="file"){
        const files=ensureFolder(item.path);
        if(own(files,next))return notify("Explorador","Esse nome já existe.");
        files[next]=files[item.name];delete files[item.name];
      }else{
        const oldRoot=item.path+"/"+item.name,newRoot=item.path+"/"+next;
        if(own(state.files,newRoot))return notify("Explorador","Essa pasta já existe.");
        const paths=Object.keys(state.files).filter(p=>p===oldRoot||p.startsWith(oldRoot+"/")).sort((a,b)=>a.length-b.length);
        for(const p of paths)state.files[newRoot+p.slice(oldRoot.length)]=state.files[p];
        [...paths].sort((a,b)=>b.length-a.length).forEach(p=>delete state.files[p]);
      }
      globalThis.Win11ExplorerFilesystem?.onRename?.({path:item.path,oldName:item.name,newName:next,type:item.type});
      selectedNames.clear();selectedNames.add(next);anchorName=next;
      saveState();forceRender();
    }

    function itemPropertyData(item){
      if(item.type==="file"){
        const value=ensureFolder(item.path)[item.name];
        return {files:1,folders:0,size:measureValue(value),type:classify(item.name,item.type,value),modified:Number(value?.lastModified)||0};
      }
      if(item.type==="folder")return {...measureFolder(item.path+"/"+item.name),type:"folder",modified:0};
      if(item.type==="recycle"){
        const entry=ensureFolder("Recycle Bin")[item.name];
        if(entry?.content?.__virtualFolderTrash){
          let files=0,folders=Math.max(0,(entry.content.tree||[]).length-1),size=0;
          for(const t of entry.content.tree||[])for(const v of Object.values(t.files||{})){files++;size+=measureValue(v)}
          return {files,folders,size,type:"folder",modified:Number(entry.deletedAt)||0};
        }
        return {files:1,folders:0,size:measureValue(entry?.content),type:"recycle",modified:Number(entry?.deletedAt)||0};
      }
      return {files:0,folders:0,size:0,type:item.type,modified:0};
    }

    function showSelectedProperties(){
      const items=selectedItems();
      if(!items.length)return;
      const data=items.map(item=>({item,...itemPropertyData(item)}));
      const size=data.reduce((n,x)=>n+x.size,0);
      const fileCount=data.reduce((n,x)=>n+x.files,0);
      const folderCount=data.reduce((n,x)=>n+x.folders+(x.item.type==="folder"?1:0),0);
      let html='<div class="explorer-pro-properties">';
      if(items.length===1){
        const x=data[0],item=x.item;
        html+='<div class="explorer-pro-prop-icon">'+(item.type==="folder"?"📁":item.type==="recycle"?"🗑️":"📄")+'</div>';
        html+='<h3>'+escapeHTML(item.name)+'</h3>';
        html+='<dl>'+
          '<dt>Tipo</dt><dd>'+escapeHTML(x.type==="folder"?"Pasta":x.type)+'</dd>'+
          '<dt>Localização</dt><dd>'+escapeHTML(item.path)+'</dd>'+
          '<dt>Tamanho</dt><dd>'+escapeHTML(formatBytes(x.size))+'</dd>'+
          (x.modified?'<dt>Modificado</dt><dd>'+escapeHTML(new Date(x.modified).toLocaleString("pt-PT"))+'</dd>':"")+
          (item.type==="folder"?'<dt>Conteúdo</dt><dd>'+x.files+' ficheiro(s), '+Math.max(0,folderCount-1)+' pasta(s)</dd>':"")+
        '</dl>';
      }else{
        html+='<div class="explorer-pro-prop-icon">▦</div><h3>'+items.length+' itens selecionados</h3>'+
          '<dl><dt>Localização</dt><dd>'+escapeHTML(items[0].path)+'</dd>'+
          '<dt>Ficheiros</dt><dd>'+fileCount+'</dd><dt>Pastas</dt><dd>'+folderCount+'</dd>'+
          '<dt>Tamanho total</dt><dd>'+escapeHTML(formatBytes(size))+'</dd></dl>';
      }
      html+='</div>';
      showSystemDialog("Propriedades",html,"OK",()=>{});
    }

    function applyAdvancedFilter(){
      if(!advancedQuery)return;
      const p=path();
      if(!p||p==="This PC"||p==="Recycle Bin")return;
      const filter=parseFilter(advancedQuery);
      for(const node of getNodes())node.hidden=!matchesFilter(p,node,filter);
      updateStatus();
    }

    search.addEventListener("input",e=>{
      if(wrap.classList.contains("real-mount-mode"))return;
      const value=e.target.value.trim();
      if(FILTER_RE.test(value)){
        e.stopImmediatePropagation();
        advancedQuery=value;
        if(originalSearchHandler)originalSearchHandler({target:{value:""}});
        search.value=value;
        setTimeout(()=>{decorate();applyAdvancedFilter()},0);
      }else{
        advancedQuery="";
        setTimeout(decorate,0);
      }
    },true);

    function onKeyDown(e){
      if(!win.classList.contains("focused")||wrap.classList.contains("real-mount-mode"))return;
      const target=e.target;
      const editable=target?.matches?.("input,textarea,select,[contenteditable=true]");
      const ctrl=e.ctrlKey||e.metaKey;
      const key=e.key.toLowerCase();

      if(ctrl&&key==="a"&&!editable){
        e.preventDefault();
        selectedNames=new Set(visibleNodes(grid).map(n=>n.dataset.v740Name||nodeName(n)).filter(Boolean));
        anchorName=[...selectedNames][0]||"";
        syncSelectionClasses();return;
      }
      if(ctrl&&key==="c"&&!editable){e.preventDefault();copySelection("copy");return}
      if(ctrl&&key==="x"&&!editable){e.preventDefault();copySelection("cut");return}
      if(ctrl&&key==="v"&&!editable){e.preventDefault();pasteSelection();return}
      if(e.key==="Delete"&&!editable){
        e.preventDefault();
        if(e.shiftKey)confirmPermanentDelete();else deleteSelection(false);
        return;
      }
      if(e.key==="F2"&&!editable){e.preventDefault();renameSelection();return}
      if(e.altKey&&e.key==="Enter"&&!editable){e.preventDefault();showSelectedProperties();return}
      if(e.key==="Escape"&&!editable&&selectedNames.size){clearSelection();return}
    }
    document.addEventListener("keydown",onKeyDown,true);

    wrap.querySelector("[data-copy]").onclick=()=>copySelection("copy")||originalCopy?.();
    wrap.querySelector("[data-cut]").onclick=()=>copySelection("cut")||originalCut?.();
    wrap.querySelector("[data-paste]").onclick=pasteSelection;
    wrap.querySelector("[data-rename]").onclick=()=>selectedItems().length?renameSelection():originalRename?.();
    wrap.querySelector("[data-delete]").onclick=()=>selectedItems().length?deleteSelection(false):originalDelete?.();
    propertiesButton.onclick=showSelectedProperties;

    grid.addEventListener("pointerdown",e=>{
      if(e.button!==0||e.target!==grid||wrap.classList.contains("real-mount-mode"))return;
      clearSelection();
      const rect=grid.getBoundingClientRect();
      dragStart={x:e.clientX-rect.left+grid.scrollLeft,y:e.clientY-rect.top+grid.scrollTop};
      selectionBox=document.createElement("div");
      selectionBox.className="explorer-selection-box";
      selectionBox.style.left=dragStart.x+"px";
      selectionBox.style.top=dragStart.y+"px";
      grid.appendChild(selectionBox);
      grid.setPointerCapture?.(e.pointerId);
    });
    grid.addEventListener("pointermove",e=>{
      if(!dragStart||!selectionBox)return;
      const rect=grid.getBoundingClientRect();
      const x=e.clientX-rect.left+grid.scrollLeft,y=e.clientY-rect.top+grid.scrollTop;
      const left=Math.min(x,dragStart.x),top=Math.min(y,dragStart.y),right=Math.max(x,dragStart.x),bottom=Math.max(y,dragStart.y);
      Object.assign(selectionBox.style,{left:left+"px",top:top+"px",width:(right-left)+"px",height:(bottom-top)+"px"});
      selectedNames.clear();
      for(const node of visibleNodes(grid)){
        const r=node.getBoundingClientRect();
        const nl=r.left-rect.left+grid.scrollLeft,nt=r.top-rect.top+grid.scrollTop,nr=nl+r.width,nb=nt+r.height;
        if(!(nr<left||nl>right||nb<top||nt>bottom))selectedNames.add(node.dataset.v740Name||nodeName(node));
      }
      syncSelectionClasses();
    });
    const finishSelection=()=>{
      if(selectionBox)selectionBox.remove();
      selectionBox=null;dragStart=null;
    };
    grid.addEventListener("pointerup",finishSelection);
    grid.addEventListener("pointercancel",finishSelection);

    const observer=new MutationObserver(()=>setTimeout(decorate,0));
    observer.observe(grid,{childList:true});

    const pathbar=wrap.querySelector(".pathbar");
    let lastPath=path();
    const pathObserver=new MutationObserver(()=>{
      const next=path();
      if(next!==lastPath){selectedNames.clear();anchorName="";advancedQuery="";lastPath=next}
      setTimeout(decorate,0);
    });
    if(pathbar)pathObserver.observe(pathbar,{childList:true,subtree:true,characterData:true});

    const mountObserver=new MutationObserver(()=>{
      if(wrap.classList.contains("real-mount-mode")){selectedNames.clear();updateCommandState()}
      else setTimeout(decorate,0);
    });
    mountObserver.observe(wrap,{attributes:true,attributeFilter:["class"]});

    const cleanup=setInterval(()=>{
      if(wrap.isConnected)return;
      clearInterval(cleanup);
      observer.disconnect();pathObserver.disconnect();mountObserver.disconnect();
      document.removeEventListener("keydown",onKeyDown,true);
      for(const url of thumbnailUrls.values())URL.revokeObjectURL(url);
      thumbnailUrls.clear();
    },1000);

    decorate();
  }

  globalThis.buildExplorerV5=function(wrap,win,startPath){
    previousBuildExplorer(wrap,win,startPath);
    installExplorerPro(wrap,win,startPath);
  };
  try{buildExplorerV5=globalThis.buildExplorerV5}catch{}

  globalThis.Win11ExplorerPro=Object.freeze({
    version:"9.1.0",
    currentVirtualPath,
    itemType,
    copyFileAdvanced,
    copyFolderAdvanced,
    moveFileToRecycle,
    moveFolderToRecycle,
    restoreRecycleItem,
    permanentlyDeleteVirtual,
    parseFilter
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"9.1.0",
    step:13,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-multiselect","explorer-range-select","explorer-selection-box",
      "explorer-batch-copy","explorer-batch-cut","explorer-batch-paste","explorer-batch-delete",
      "explorer-shift-delete","explorer-folder-recycle","explorer-advanced-properties",
      "explorer-search-filters","explorer-image-thumbnails","explorer-multi-dragdrop",
      "explorer-safe-realblob-copy"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
