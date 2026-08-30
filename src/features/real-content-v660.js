"use strict";
/* Windows 11 Simulator V6.6 — Real Content & Device Integration */
(function installRealContentV660(){
  const DB_NAME="Win11SimulatorRealFiles";
  const DB_VERSION=1;
  const STORE="blobs";
  let dbPromise=null;

  function openDB(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!("indexedDB" in window)){
        reject(new Error("IndexedDB indisponível."));
        return;
      }
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE)){
          db.createObjectStore(STORE,{keyPath:"id"});
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error("Falha ao abrir IndexedDB."));
    });
    return dbPromise;
  }

  function currentOwnerId(){return globalThis.Win11SessionManager?.activeUserId||null}

  async function putBlob(file){
    const db=await openDB();
    const id="real-"+Date.now()+"-"+Math.random().toString(36).slice(2);
    const record={
      id,
      ownerId:currentOwnerId(),
      blob:file instanceof Blob?file:new Blob([file]),
      name:file.name||"ficheiro",
      type:file.type||"application/octet-stream",
      size:Number(file.size)||0,
      lastModified:Number(file.lastModified)||Date.now()
    };
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error("Falha ao guardar ficheiro real."));
      tx.onabort=()=>reject(tx.error||new Error("Operação cancelada."));
    });
    return {
      __realBlobId:id,
      name:record.name,
      type:record.type,
      size:record.size,
      lastModified:record.lastModified
    };
  }

  async function getRecord(ref){
    if(!ref?.__realBlobId)return null;
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readonly");
      const req=tx.objectStore(STORE).get(ref.__realBlobId);
      req.onsuccess=()=>{
        const record=req.result||null;
        if(!record){resolve(null);return}
        const owner=currentOwnerId();
        if(record.ownerId&&record.ownerId!==owner){resolve(null);return}
        resolve(record);
      };
      req.onerror=()=>reject(req.error||new Error("Falha ao ler ficheiro real."));
    });
  }

  async function deleteRecord(ref){
    if(!ref?.__realBlobId)return false;
    const record=await getRecord(ref);
    if(!record)return false;
    const db=await openDB();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).delete(ref.__realBlobId);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error("Falha ao remover ficheiro real."));
    });
    return true;
  }

  async function claimLegacyBlobs(ownerId){
    if(!ownerId)return 0;
    const db=await openDB();
    let count=0;
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      const store=tx.objectStore(STORE);
      const req=store.openCursor();
      req.onsuccess=()=>{
        const cursor=req.result;
        if(!cursor)return;
        const record=cursor.value;
        if(!record.ownerId){record.ownerId=ownerId;cursor.update(record);count++}
        cursor.continue();
      };
      req.onerror=()=>reject(req.error||new Error("Falha ao migrar ficheiros reais."));
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error("Falha ao migrar ficheiros reais."));
    });
    return count;
  }

  async function purgeOwnerBlobs(ownerId){
    if(!ownerId)return 0;
    const db=await openDB();
    let count=0;
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      const store=tx.objectStore(STORE);
      const req=store.openCursor();
      req.onsuccess=()=>{
        const cursor=req.result;
        if(!cursor)return;
        if(cursor.value?.ownerId===ownerId){cursor.delete();count++}
        cursor.continue();
      };
      req.onerror=()=>reject(req.error||new Error("Falha ao limpar ficheiros do utilizador."));
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error("Falha ao limpar ficheiros do utilizador."));
    });
    return count;
  }

  function uniqueName(folder,name){
    const files=ensureFolder(folder);
    if(!(name in files))return name;
    const dot=name.lastIndexOf(".");
    const stem=dot>0?name.slice(0,dot):name;
    const ext=dot>0?name.slice(dot):"";
    let i=2;
    let next=stem+" ("+i+")"+ext;
    while(next in files)next=stem+" ("+(++i)+")"+ext;
    return next;
  }

  async function importFileToVirtual(file,folder){
    if(!(file instanceof Blob))throw new TypeError("Ficheiro inválido.");
    if(!folder||folder==="This PC"||folder==="Recycle Bin")folder="C:/Downloads";
    const name=uniqueName(folder,file.name||"ficheiro");
    const ref=await putBlob(file);
    ref.name=name;
    ensureFolder(folder)[name]=ref;
    touchRecent(folder+"/"+name);
    saveState();
    return {folder,name,ref};
  }

  async function importFiles(files,folder){
    const imported=[];
    for(const file of Array.from(files||[])){
      try{
        imported.push(await importFileToVirtual(file,folder));
      }catch(err){
        console.error("[RealContent] import failed",err);
      }
    }
    return imported;
  }

  async function chooseFiles(options={}){
    const multiple=options.multiple!==false;
    const accept=options.accept||"*/*";
    if(typeof window.showOpenFilePicker==="function"){
      try{
        const types=options.nativeAccept?[{
          description:options.description||"Ficheiros",
          accept:options.nativeAccept
        }]:undefined;
        const handles=await window.showOpenFilePicker({multiple,types});
        const files=[];
        for(const handle of handles)files.push(await handle.getFile());
        return files;
      }catch(err){
        if(err?.name==="AbortError")throw err;
      }
    }
    return new Promise((resolve,reject)=>{
      const input=document.createElement("input");
      input.type="file";
      input.multiple=multiple;
      input.accept=accept;
      input.hidden=true;
      input.onchange=()=>{
        const files=Array.from(input.files||[]);
        input.remove();
        if(!files.length){
          reject(new DOMException("Seleção cancelada.","AbortError"));
          return;
        }
        resolve(files);
      };
      input.addEventListener("cancel",()=>{
        input.remove();
        reject(new DOMException("Seleção cancelada.","AbortError"));
      },{once:true});
      document.body.appendChild(input);
      input.click();
    });
  }

  async function chooseDirectoryFiles(){
    if(typeof window.showDirectoryPicker==="function"){
      try{
        const dir=await window.showDirectoryPicker({mode:"read"});
        const files=[];
        async function walk(handle,prefix=""){
          for await(const [name,entry] of handle.entries()){
            if(entry.kind==="file"){
              const file=await entry.getFile();
              Object.defineProperty(file,"_relativePath",{value:prefix+name,configurable:true});
              files.push(file);
            }else if(entry.kind==="directory"){
              await walk(entry,prefix+name+"/");
            }
          }
        }
        await walk(dir);
        return {name:dir.name||"Pasta",files};
      }catch(err){
        if(err?.name==="AbortError")throw err;
      }
    }

    return new Promise((resolve,reject)=>{
      const input=document.createElement("input");
      input.type="file";
      input.multiple=true;
      input.setAttribute("webkitdirectory","");
      input.hidden=true;
      input.onchange=()=>{
        const files=Array.from(input.files||[]);
        const first=files[0]?.webkitRelativePath||"";
        const folderName=first.split("/")[0]||"Pasta";
        input.remove();
        if(!files.length){
          reject(new DOMException("Seleção cancelada.","AbortError"));
          return;
        }
        files.forEach(file=>{
          if(file.webkitRelativePath){
            Object.defineProperty(file,"_relativePath",{value:file.webkitRelativePath.split("/").slice(1).join("/"),configurable:true});
          }
        });
        resolve({name:folderName,files});
      };
      input.addEventListener("cancel",()=>{
        input.remove();
        reject(new DOMException("Seleção cancelada.","AbortError"));
      },{once:true});
      document.body.appendChild(input);
      input.click();
    });
  }

  async function importDirectoryToVirtual(result,parentFolder){
    if(!result?.files?.length)return {count:0,root:null};
    if(!parentFolder||parentFolder==="This PC"||parentFolder==="Recycle Bin")parentFolder="C:/Downloads";
    const rootName=uniqueFolderName(parentFolder,result.name||"Pasta importada");
    const rootPath=parentFolder+"/"+rootName;
    ensureFolder(rootPath);
    let count=0;
    for(const file of result.files){
      const rel=String(file._relativePath||file.name||"ficheiro").replace(/\\/g,"/");
      const parts=rel.split("/").filter(Boolean);
      const name=parts.pop()||file.name||"ficheiro";
      const folder=rootPath+(parts.length?"/"+parts.join("/"):"");
      ensureFolder(folder);
      await importFileToVirtual(new File([file],name,{type:file.type,lastModified:file.lastModified}),folder);
      count++;
    }
    saveState();
    return {count,root:rootPath};
  }

  function uniqueFolderName(parent,name){
    let candidate=name||"Pasta importada";
    if(!state.files[parent+"/"+candidate])return candidate;
    let i=2;
    while(state.files[parent+"/"+candidate+" ("+i+")"])i++;
    return candidate+" ("+i+")";
  }

  function explorerCurrentPath(wrap){
    const crumbs=Array.from(wrap.querySelectorAll(".pathbar .crumb")).map(x=>x.textContent.trim()).filter(Boolean);
    if(crumbs.length){
      if(crumbs.length===1&&crumbs[0]==="Este PC")return "This PC";
      if(crumbs[0]==="Este PC")return "C:/"+crumbs.slice(1).join("/");
      return crumbs.join("/");
    }
    const text=wrap.querySelector(".pathbar")?.textContent.trim();
    return text||"C:/Downloads";
  }

  function refreshExplorer(win,path){
    if(win&&path)win.dispatchEvent(new CustomEvent("navigate",{detail:path}));
  }

  async function exportVirtualValue(name,value){
    let blob;
    if(value?.__realBlobId){
      const rec=await getRecord(value);
      if(!rec)throw new Error("Ficheiro real importado não encontrado.");
      blob=rec.blob;
    }else if(typeof value==="string"&&value.startsWith("data:")){
      const response=await fetch(value);
      blob=await response.blob();
    }else if(typeof value==="string"){
      blob=new Blob([value],{type:"text/plain;charset=utf-8"});
    }else{
      blob=new Blob([JSON.stringify(value,null,2)],{type:"application/json"});
    }

    if(typeof window.showSaveFilePicker==="function"){
      try{
        const handle=await window.showSaveFilePicker({suggestedName:name});
        const writable=await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return "saved";
      }catch(err){
        if(err?.name==="AbortError")throw err;
      }
    }
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=name;
    a.rel="noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    return "download";
  }

  function selectedExplorerFile(wrap){
    const el=wrap.querySelector(".file.selected,.file-row.selected");
    if(!el?.dataset.name)return null;
    const path=explorerCurrentPath(wrap);
    if(path==="This PC")return null;
    const value=ensureFolder(path)[el.dataset.name];
    if(value===undefined)return null;
    return {path,name:el.dataset.name,value};
  }

  const previousExplorer=globalThis.buildExplorerV5;
  globalThis.buildExplorerV5=function(wrap,win,startPath){
    previousExplorer(wrap,win,startPath);

    const command=wrap.querySelector(".explorer-command");
    const filesArea=wrap.querySelector(".explorer-files");
    if(!command||!filesArea)return;

    const realGroup=document.createElement("div");
    realGroup.className="real-explorer-command-group";
    realGroup.innerHTML=
      '<button data-import-files title="Importar ficheiros reais">⇧ <span class="cmd-label">Importar ficheiros</span></button>'+
      '<button data-import-folder title="Importar uma pasta autorizada">▣ <span class="cmd-label">Importar pasta</span></button>'+
      '<button data-export-file title="Guardar o ficheiro selecionado no dispositivo">⇩ <span class="cmd-label">Exportar</span></button>';
    command.appendChild(realGroup);

    const drop=document.createElement("div");
    drop.className="real-explorer-drop";
    drop.innerHTML='<strong>Largue ficheiros aqui</strong><small>Serão importados para a pasta virtual atual</small>';
    filesArea.appendChild(drop);

    async function importChosen(){
      try{
        const files=await chooseFiles({multiple:true});
        const path=explorerCurrentPath(wrap);
        const imported=await importFiles(files,path);
        refreshExplorer(win,path==="This PC"?"C:/Downloads":path);
        notify("Explorador",imported.length+" ficheiro(s) importado(s) do dispositivo.");
      }catch(err){
        if(err?.name!=="AbortError")notify("Explorador","Não foi possível importar os ficheiros.");
      }
    }

    async function importFolder(){
      try{
        const result=await chooseDirectoryFiles();
        const path=explorerCurrentPath(wrap);
        const imported=await importDirectoryToVirtual(result,path);
        refreshExplorer(win,path==="This PC"?"C:/Downloads":path);
        notify("Explorador",imported.count+" ficheiro(s) importado(s) da pasta "+(result.name||"selecionada")+".");
      }catch(err){
        if(err?.name!=="AbortError")notify("Explorador","Não foi possível importar a pasta.");
      }
    }

    async function exportSelected(){
      const selected=selectedExplorerFile(wrap);
      if(!selected){
        notify("Explorador","Selecione primeiro um ficheiro.");
        return;
      }
      try{
        const mode=await exportVirtualValue(selected.name,selected.value);
        notify("Explorador",mode==="saved"?selected.name+" guardado no dispositivo.":selected.name+" transferido para o dispositivo.");
      }catch(err){
        if(err?.name!=="AbortError")notify("Explorador","Não foi possível exportar o ficheiro.");
      }
    }

    realGroup.querySelector("[data-import-files]").onclick=importChosen;
    realGroup.querySelector("[data-import-folder]").onclick=importFolder;
    realGroup.querySelector("[data-export-file]").onclick=exportSelected;

    let dragDepth=0;
    filesArea.addEventListener("dragenter",e=>{
      if(!e.dataTransfer?.types?.includes("Files"))return;
      e.preventDefault();
      dragDepth++;
      drop.classList.add("visible");
    });
    filesArea.addEventListener("dragover",e=>{
      if(!e.dataTransfer?.types?.includes("Files"))return;
      e.preventDefault();
      e.dataTransfer.dropEffect="copy";
      drop.classList.add("visible");
    });
    filesArea.addEventListener("dragleave",()=>{
      dragDepth=Math.max(0,dragDepth-1);
      if(!dragDepth)drop.classList.remove("visible");
    });
    filesArea.addEventListener("drop",async e=>{
      e.preventDefault();
      dragDepth=0;
      drop.classList.remove("visible");
      const dropped=Array.from(e.dataTransfer?.files||[]);
      if(!dropped.length)return;
      const path=explorerCurrentPath(wrap);
      const imported=await importFiles(dropped,path);
      refreshExplorer(win,path==="This PC"?"C:/Downloads":path);
      notify("Explorador",imported.length+" ficheiro(s) importado(s) por arrastar e largar.");
    });
  };

  let activePhotoUrl=null;
  let activeMediaUrl=null;
  function replacePhotoUrl(blob){
    if(activePhotoUrl)URL.revokeObjectURL(activePhotoUrl);
    activePhotoUrl=URL.createObjectURL(blob);
    return activePhotoUrl;
  }
  function replaceMediaUrl(blob){
    if(activeMediaUrl)URL.revokeObjectURL(activeMediaUrl);
    activeMediaUrl=URL.createObjectURL(blob);
    return activeMediaUrl;
  }

  async function cleanupVirtualValue(value){
    if(value?.__realBlobId){
      try{await deleteRecord(value)}catch(err){console.warn("[RealContent] blob cleanup failed",err)}
    }
  }

  async function cleanupVirtualFolder(folder){
    const paths=Object.keys(state.files).filter(p=>p===folder||p.startsWith(folder+"/"));
    const refs=[];
    for(const p of paths){
      for(const value of Object.values(state.files[p]||{})){
        if(value?.__realBlobId)refs.push(value);
      }
    }
    for(const ref of refs)await cleanupVirtualValue(ref);
    return refs.length;
  }

  globalThis.RealContentBridge=Object.freeze({
    version:"6.7.4",
    putBlob,
    getRecord,
    deleteRecord,
    claimLegacyBlobs,
    purgeOwnerBlobs,
    cleanupVirtualValue,
    cleanupVirtualFolder,
    importFileToVirtual,
    importFiles,
    chooseFiles,
    chooseDirectoryFiles,
    importDirectoryToVirtual,
    exportVirtualValue,
    explorerCurrentPath
  });

  const previousOpenFile=globalThis.openFile;
  globalThis.openFile=async function(path,name,value){
    if(value?.__realBlobId){
      try{
        const rec=await getRecord(value);
        if(!rec)throw new Error("Conteúdo não encontrado.");
        const type=rec.type||"";
        if(type.startsWith("image/")){
          globalThis.RealPhotosPending={name,blob:rec.blob};
          openApp("photos");
          return;
        }
        if(type.startsWith("audio/")||type.startsWith("video/")){
          globalThis.RealMediaPending={name,blob:rec.blob,type};
          openApp("mediaplayer");
          return;
        }
        if(type.startsWith("text/")||/\.(txt|md|log|csv|json|js|css|html)$/i.test(name)){
          state.notepadText=await rec.blob.text();
          saveState();
          openApp("notepad");
          return;
        }
        notify("Explorador","Tipo de ficheiro importado sem visualizador interno. Use Exportar para o abrir no dispositivo.");
        return;
      }catch{
        notify("Explorador","Não foi possível abrir o ficheiro importado.");
        return;
      }
    }
    return previousOpenFile(path,name,value);
  };

  const previousPhotos=globalThis.buildPhotos;
  globalThis.buildPhotos=function(wrap){
    wrap.className="photos real-photos";
    wrap.innerHTML=
      '<div class="real-app-header"><div><h2>Fotografias</h2><small>Imagens virtuais e do dispositivo</small></div>'+
      '<button class="sys-button primary" data-open-real-photo>Abrir imagem do dispositivo</button></div>'+
      '<div class="real-photo-viewer" data-real-photo-viewer></div>'+
      '<h3>Galeria virtual</h3><div class="photo-grid" data-photo-grid></div>';

    const viewer=wrap.querySelector("[data-real-photo-viewer]");
    const grid=wrap.querySelector("[data-photo-grid]");

    function showBlob(name,blob){
      const url=replacePhotoUrl(blob);
      viewer.innerHTML="";
      const img=document.createElement("img");
      img.src=url;
      img.alt=name;
      const label=document.createElement("div");
      label.className="real-photo-caption";
      label.textContent=name;
      viewer.append(img,label);
      viewer.classList.add("has-image");
    }

    if(globalThis.RealPhotosPending?.blob){
      showBlob(RealPhotosPending.name,RealPhotosPending.blob);
      globalThis.RealPhotosPending=null;
    }else{
      viewer.innerHTML='<div class="real-photo-empty">Selecione uma imagem real ou escolha uma da galeria virtual.</div>';
    }

    const pics=ensureFolder("C:/Pictures");
    Object.entries(pics).forEach(([name,value])=>{
      if(typeof value==="string"&&value.startsWith("data:image/")){
        const card=document.createElement("button");
        card.className="photo-card";
        const img=document.createElement("img");
        img.src=value;
        img.alt=name;
        const label=document.createElement("div");
        label.textContent=name;
        card.append(img,label);
        card.onclick=async()=>{
          const blob=await (await fetch(value)).blob();
          showBlob(name,blob);
        };
        grid.appendChild(card);
      }else if(value?.__realBlobId&&String(value.type||"").startsWith("image/")){
        const card=document.createElement("button");
        card.className="photo-card real-imported-photo";
        card.innerHTML='<div class="real-photo-placeholder">🖼</div><div>'+escapeHTML(name)+'</div>';
        card.onclick=async()=>{
          const rec=await getRecord(value);
          if(rec)showBlob(name,rec.blob);
        };
        grid.appendChild(card);
      }
    });
    if(!grid.children.length)grid.innerHTML='<p>A galeria virtual está vazia.</p>';

    wrap.querySelector("[data-open-real-photo]").onclick=async()=>{
      try{
        const [file]=await chooseFiles({multiple:false,accept:"image/*"});
        if(file)showBlob(file.name,file);
      }catch(err){
        if(err?.name!=="AbortError")notify("Fotografias","Não foi possível abrir a imagem.");
      }
    };
  };

  globalThis.buildMediaPlayer=function(wrap){
    wrap.className="media-v4 real-media-player";
    wrap.innerHTML=
      '<aside><div class="nav-item active">Em reprodução</div><div class="nav-item">Biblioteca virtual</div></aside>'+
      '<main class="media-main">'+
      '<div class="real-app-header"><div><h2>Media Player</h2><small>Áudio e vídeo do dispositivo</small></div>'+
      '<button class="sys-button primary" data-open-media>Abrir multimédia</button></div>'+
      '<div class="real-media-stage" data-media-stage><div class="album-art">♫</div></div>'+
      '<div class="real-media-meta"><strong data-track>Nenhum ficheiro selecionado</strong><small data-media-type>Escolha áudio ou vídeo</small></div>'+
      '</main>';

    const stage=wrap.querySelector("[data-media-stage]");
    const track=wrap.querySelector("[data-track]");
    const typeLabel=wrap.querySelector("[data-media-type]");

    function playBlob(name,blob,type){
      const url=replaceMediaUrl(blob);
      stage.innerHTML="";
      const media=document.createElement(type.startsWith("video/")?"video":"audio");
      media.src=url;
      media.controls=true;
      media.autoplay=false;
      media.preload="metadata";
      if(media.tagName==="VIDEO"){
        media.playsInline=true;
        media.className="real-video";
      }else{
        media.className="real-audio";
      }
      stage.appendChild(media);
      track.textContent=name;
      typeLabel.textContent=type.startsWith("video/")?"Vídeo real":"Áudio real";
    }

    if(globalThis.RealMediaPending?.blob){
      const p=RealMediaPending;
      playBlob(p.name,p.blob,p.type||p.blob.type||"audio/*");
      globalThis.RealMediaPending=null;
    }

    wrap.querySelector("[data-open-media]").onclick=async()=>{
      try{
        const [file]=await chooseFiles({multiple:false,accept:"audio/*,video/*"});
        if(file)playBlob(file.name,file,file.type||"audio/*");
      }catch(err){
        if(err?.name!=="AbortError")notify("Media Player","Não foi possível abrir o ficheiro multimédia.");
      }
    };
  };

  globalThis.Win11RealFunctions=Object.freeze({
    version:"6.7.4",
    step:5,
    features:[
      "real-file-open","real-file-save","download-fallback",
      "real-clipboard-write","real-clipboard-read","clipboard-manual-paste-fallback",
      "explorer-real-import","explorer-real-folder-import","explorer-drag-drop","explorer-real-export",
      "photos-real-image-open","media-real-playback"
    ]
  });
})();
