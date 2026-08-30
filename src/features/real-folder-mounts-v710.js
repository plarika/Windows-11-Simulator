"use strict";
/* Windows 11 Simulator V7.1 — Real Folder Mounts */
(function installRealFolderMountsV710(){
  const DB_NAME="win11-real-mounts-v710";
  const DB_VERSION=1;
  const STORE="mounts";
  const memoryMounts=new Map();
  let dbPromise=null;

  function currentOwnerId(){
    return globalThis.Win11SessionManager?.activeUserId||null;
  }

  function openDB(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE)){
          const store=db.createObjectStore(STORE,{keyPath:"id"});
          store.createIndex("ownerId","ownerId",{unique:false});
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error("Não foi possível abrir o armazenamento das pastas montadas."));
    });
    return dbPromise;
  }

  function normalizeSegments(value){
    return Array.from(value||[])
      .map(x=>String(x||"").trim())
      .filter(x=>x&&x!=="."&&x!==".."&&!/[\\/]/.test(x));
  }

  function safeEntryName(value){
    const name=String(value||"").trim();
    if(!name||name==="."||name===".."||/[\\/]/.test(name)){
      throw new Error("Nome inválido.");
    }
    return name;
  }

  function mountLabel(record){
    return String(record?.name||record?.handle?.name||"Pasta real");
  }

  async function putMount(record){
    memoryMounts.set(record.id,record);
    try{
      const db=await openDB();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,"readwrite");
        tx.objectStore(STORE).put(record);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error||new Error("Falha ao guardar a montagem."));
        tx.onabort=()=>reject(tx.error||new Error("Montagem não persistida."));
      });
      return {persisted:true};
    }catch(err){
      console.warn("[RealMounts] persistent handle storage unavailable",err);
      return {persisted:false,error:err};
    }
  }

  async function getPersistentMount(id){
    try{
      const db=await openDB();
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,"readonly");
        const req=tx.objectStore(STORE).get(id);
        req.onsuccess=()=>resolve(req.result||null);
        req.onerror=()=>reject(req.error||new Error("Falha ao ler a montagem."));
      });
    }catch{return null}
  }

  async function getMount(id){
    const owner=currentOwnerId();
    const mem=memoryMounts.get(id);
    if(mem&&mem.ownerId===owner)return mem;
    const record=await getPersistentMount(id);
    if(record?.ownerId===owner){
      memoryMounts.set(record.id,record);
      return record;
    }
    return null;
  }

  async function listMounts(ownerId=currentOwnerId()){
    if(!ownerId)return [];
    const merged=new Map();
    try{
      const db=await openDB();
      const rows=await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,"readonly");
        const index=tx.objectStore(STORE).index("ownerId");
        const req=index.getAll(IDBKeyRange.only(ownerId));
        req.onsuccess=()=>resolve(req.result||[]);
        req.onerror=()=>reject(req.error||new Error("Falha ao listar montagens."));
      });
      rows.forEach(r=>merged.set(r.id,r));
    }catch{}
    for(const r of memoryMounts.values()){
      if(r.ownerId===ownerId)merged.set(r.id,r);
    }
    return [...merged.values()].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  }

  async function deletePersistentMount(id){
    try{
      const db=await openDB();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,"readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error||new Error("Falha ao remover a montagem."));
      });
    }catch{}
  }

  async function forgetMount(id){
    const record=await getMount(id);
    if(!record)return false;
    memoryMounts.delete(id);
    await deletePersistentMount(id);
    return true;
  }

  async function purgeOwnerMounts(ownerId){
    if(!ownerId)return 0;
    const rows=await listMounts(ownerId);
    for(const row of rows){
      memoryMounts.delete(row.id);
      await deletePersistentMount(row.id);
    }
    return rows.length;
  }

  async function permissionState(handle,mode="readwrite"){
    if(!handle)return "denied";
    try{
      if(typeof handle.queryPermission==="function"){
        return await handle.queryPermission({mode});
      }
    }catch{}
    return "prompt";
  }

  async function ensurePermission(handle,{mode="readwrite",request=false}={}){
    let state=await permissionState(handle,mode);
    if(state==="granted")return state;
    if(request&&typeof handle?.requestPermission==="function"){
      try{state=await handle.requestPermission({mode})}catch{}
    }
    return state;
  }

  async function mountDirectory(){
    const ownerId=currentOwnerId();
    if(!ownerId)throw new Error("Inicie sessão antes de montar uma pasta.");
    if(typeof window.showDirectoryPicker!=="function"){
      throw new Error("Este navegador não suporta montagem direta de pastas. Utilize Importar pasta no Explorador.");
    }
    const handle=await window.showDirectoryPicker({mode:"readwrite"});
    const permission=await ensurePermission(handle,{mode:"readwrite",request:true});
    if(permission!=="granted")throw new Error("A pasta não recebeu autorização de leitura e escrita.");
    const record={
      id:"mount-"+Date.now()+"-"+Math.random().toString(36).slice(2),
      ownerId,
      name:handle.name||"Pasta real",
      handle,
      createdAt:Date.now(),
      lastUsedAt:Date.now()
    };
    const result=await putMount(record);
    return {...record,persisted:result.persisted};
  }

  async function resolveDirectory(rootHandle,segments,{create=false}={}){
    let dir=rootHandle;
    for(const segment of normalizeSegments(segments)){
      dir=await dir.getDirectoryHandle(segment,{create});
    }
    return dir;
  }

  async function listDirectory(rootHandle,segments=[]){
    const dir=await resolveDirectory(rootHandle,segments);
    const out=[];
    for await(const [name,handle] of dir.entries()){
      if(handle.kind==="directory"){
        out.push({name,kind:"directory",handle,size:null,type:"Pasta",lastModified:null});
      }else{
        try{
          const file=await handle.getFile();
          out.push({
            name,
            kind:"file",
            handle,
            size:file.size,
            type:file.type||"Ficheiro",
            lastModified:file.lastModified||null
          });
        }catch{
          out.push({name,kind:"file",handle,size:null,type:"Ficheiro",lastModified:null});
        }
      }
    }
    out.sort((a,b)=>{
      if(a.kind!==b.kind)return a.kind==="directory"?-1:1;
      return a.name.localeCompare(b.name,"pt-PT",{numeric:true,sensitivity:"base"});
    });
    return out;
  }

  async function createFolder(rootHandle,segments,name){
    const dir=await resolveDirectory(rootHandle,segments);
    const clean=safeEntryName(name);
    await dir.getDirectoryHandle(clean,{create:true});
    return clean;
  }

  async function createTextFile(rootHandle,segments,name,content=""){
    const dir=await resolveDirectory(rootHandle,segments);
    const clean=safeEntryName(name);
    const handle=await dir.getFileHandle(clean,{create:true});
    const writable=await handle.createWritable();
    try{await writable.write(String(content))}
    finally{await writable.close()}
    return handle;
  }

  async function entryExists(dir,name){
    for await(const [entryName] of dir.entries()){
      if(entryName===name)return true;
    }
    return false;
  }

  async function copyDirectoryContents(source,target){
    for await(const [name,entry] of source.entries()){
      if(entry.kind==="file"){
        const file=await entry.getFile();
        const out=await target.getFileHandle(name,{create:true});
        const writable=await out.createWritable();
        try{await writable.write(file)}
        finally{await writable.close()}
      }else if(entry.kind==="directory"){
        const next=await target.getDirectoryHandle(name,{create:true});
        await copyDirectoryContents(entry,next);
      }
    }
  }

  async function renameEntry(rootHandle,segments,oldName,newName,kind){
    const dir=await resolveDirectory(rootHandle,segments);
    oldName=safeEntryName(oldName);
    newName=safeEntryName(newName);
    if(oldName===newName)return true;
    if(await entryExists(dir,newName))throw new Error("Já existe um item com esse nome.");

    if(kind==="file"){
      const oldHandle=await dir.getFileHandle(oldName);
      const file=await oldHandle.getFile();
      const next=await dir.getFileHandle(newName,{create:true});
      const writable=await next.createWritable();
      try{await writable.write(file)}
      finally{await writable.close()}
      await dir.removeEntry(oldName);
      return true;
    }

    const oldDir=await dir.getDirectoryHandle(oldName);
    const nextDir=await dir.getDirectoryHandle(newName,{create:true});
    try{
      await copyDirectoryContents(oldDir,nextDir);
      await dir.removeEntry(oldName,{recursive:true});
      return true;
    }catch(err){
      try{await dir.removeEntry(newName,{recursive:true})}catch{}
      throw err;
    }
  }

  async function deleteEntry(rootHandle,segments,name,kind){
    const dir=await resolveDirectory(rootHandle,segments);
    await dir.removeEntry(safeEntryName(name),{recursive:kind==="directory"});
    return true;
  }

  async function mountedFile(record,segments,name){
    const dir=await resolveDirectory(record.handle,segments);
    const handle=await dir.getFileHandle(name);
    const file=await handle.getFile();
    return {handle,file};
  }

  async function openMountedFile(record,segments,name,appId=null){
    const {handle,file}=await mountedFile(record,segments,name);
    const chosen=appId||globalThis.Win11DesktopIntegration?.defaultAppFor?.(name)||null;
    const category=globalThis.Win11DesktopIntegration?.categoryOf?.(name,file,file.type)||"unknown";

    if(chosen==="notepad"||(!chosen&&category==="text")){
      globalThis.RealNotepadPending={
        name:file.name,
        text:await file.text(),
        handle,
        source:"mounted",
        mountId:record.id
      };
      if(globalThis.Win11DesktopIntegration?.openDocumentApp)Win11DesktopIntegration.openDocumentApp("notepad");
      else if(typeof makeWindow==="function")makeWindow("notepad");
      else openApp("notepad");
      return true;
    }

    if(chosen&&globalThis.Win11DesktopIntegration){
      return Win11DesktopIntegration.openWithApp(chosen,"RealMount:"+record.id,file.name,file);
    }

    return showMountedOpenWith(record,segments,name);
  }

  async function showMountedOpenWith(record,segments,name){
    const {handle,file}=await mountedFile(record,segments,name);
    const apps=globalThis.Win11DesktopIntegration?.candidateApps?.(name,file,file.type)||[];
    if(!apps.length){
      notify("Abrir com","Não existem aplicações compatíveis para este ficheiro.");
      return false;
    }
    const ext=Win11DesktopIntegration.extensionOf(name);
    const current=Win11DesktopIntegration.defaultAppFor(name);
    const body=
      '<div class="openwith-dialog mounted-openwith">'+
        '<p>Como pretende abrir <strong>'+escapeHTML(name)+'</strong>?</p>'+
        '<div class="openwith-list">'+apps.map((app,i)=>
          '<label class="openwith-app">'+
            '<input type="radio" name="mounted-openwith-app" value="'+app.id+'" '+((app.id===current||(!current&&i===0))?"checked":"")+'>'+
            '<span class="openwith-icon">'+app.icon+'</span>'+
            '<span><strong>'+escapeHTML(app.name)+'</strong><small>Pasta real montada</small></span>'+
          '</label>'
        ).join("")+'</div>'+
        (ext?'<label class="openwith-always"><input type="checkbox" data-mounted-openwith-always> Utilizar sempre para '+escapeHTML(ext)+'</label>':"")+
      '</div>';

    showSystemDialog("Abrir com",body,"Abrir",async()=>{
      const appId=$("#system-dialog-body input[name='mounted-openwith-app']:checked")?.value;
      if(!appId)return;
      if(ext&&$("#system-dialog-body [data-mounted-openwith-always]")?.checked){
        Win11DesktopIntegration.setDefaultApp(ext,appId);
      }
      try{
        if(appId==="notepad"){
          globalThis.RealNotepadPending={
            name:file.name,text:await file.text(),handle,source:"mounted",mountId:record.id
          };
          if(globalThis.Win11DesktopIntegration?.openDocumentApp)Win11DesktopIntegration.openDocumentApp("notepad");
          else if(typeof makeWindow==="function")makeWindow("notepad");
          else openApp("notepad");
        }else{
          await Win11DesktopIntegration.openWithApp(appId,"RealMount:"+record.id,file.name,file);
        }
      }catch(err){
        notify("Abrir com",err?.message||"Não foi possível abrir o ficheiro.");
      }
    });
    return true;
  }

  async function shareMountedFile(record,segments,name){
    const {file}=await mountedFile(record,segments,name);
    return Win11DesktopIntegration.shareFile("RealMount:"+record.id,name,file);
  }

  async function printMountedFile(record,segments,name){
    const {file}=await mountedFile(record,segments,name);
    return Win11DesktopIntegration.printFile("RealMount:"+record.id,name,file);
  }

  function permissionDescription(value){
    if(value==="granted")return "Acesso concedido";
    if(value==="denied")return "Acesso negado";
    return "Autorização necessária";
  }

  function installExplorerMounts(wrap,win){
    const command=wrap.querySelector(".explorer-command");
    const aside=wrap.querySelector("aside");
    const filesHost=wrap.querySelector(".explorer-files");
    const virtualGrid=wrap.querySelector(".file-grid,.file-list,.thispc-grid");
    const pathbar=wrap.querySelector(".pathbar");
    const search=wrap.querySelector(".explorer-search");
    if(!command||!aside||!filesHost||!virtualGrid||!pathbar||!search)return;

    const mountButton=document.createElement("button");
    mountButton.dataset.mountReal="";
    mountButton.textContent="🗂 Montar pasta";
    const flex=command.querySelector('span[style*="flex:1"]');
    command.insertBefore(mountButton,flex||command.firstChild);

    const mountNav=document.createElement("div");
    mountNav.className="real-mount-nav";
    mountNav.innerHTML='<small>Pastas reais</small><div data-mount-nav-list></div>';
    aside.appendChild(mountNav);

    const realView=document.createElement("div");
    realView.className="real-mount-view";
    realView.hidden=true;
    filesHost.appendChild(realView);

    let mounted=null;
    let query="";
    let renderToken=0;

    function isMountedMode(){return Boolean(mounted)}

    function exitMountedMode(){
      mounted=null;
      query="";
      wrap.classList.remove("real-mount-mode");
      realView.hidden=true;
      virtualGrid.style.display="";
      search.value="";
    }

    async function refreshMountNav(){
      const list=mountNav.querySelector("[data-mount-nav-list]");
      const mounts=await listMounts();
      list.innerHTML="";
      if(!mounts.length){
        list.innerHTML='<div class="real-mount-nav-empty">Nenhuma pasta montada</div>';
        return;
      }
      for(const record of mounts){
        const b=document.createElement("button");
        b.className="nav-item real-mount-nav-item";
        b.dataset.realMountId=record.id;
        b.innerHTML='<span>🗂</span><span>'+escapeHTML(mountLabel(record))+'</span>';
        b.onclick=()=>openMount(record.id,[]);
        list.appendChild(b);
      }
    }

    async function renderMounted(){
      const token=++renderToken;
      if(!mounted)return;
      const record=await getMount(mounted.id);
      if(token!==renderToken||!mounted)return;
      if(!record){
        notify("Explorador","A montagem já não está disponível.");
        exitMountedMode();
        await refreshMountNav();
        return;
      }
      mounted.record=record;
      wrap.classList.add("real-mount-mode");
      realView.hidden=false;
      virtualGrid.style.display="none";
      pathbar.textContent="Pasta real > "+mountLabel(record)+(mounted.segments.length?" > "+mounted.segments.join(" > "):"");

      const permission=await ensurePermission(record.handle,{mode:"readwrite",request:false});
      if(token!==renderToken||!mounted)return;

      if(permission!=="granted"){
        realView.innerHTML=
          '<div class="real-mount-permission">'+
            '<div class="real-mount-lock">🔐</div>'+
            '<h3>'+escapeHTML(mountLabel(record))+'</h3>'+
            '<p>'+escapeHTML(permissionDescription(permission))+'. O navegador exige nova autorização para aceder a esta pasta.</p>'+
            '<div><button class="sys-button primary" data-mount-authorize>Autorizar acesso</button> <button class="sys-button" data-mount-forget>Esquecer montagem</button></div>'+
          '</div>';
        realView.querySelector("[data-mount-authorize]").onclick=async()=>{
          const next=await ensurePermission(record.handle,{mode:"readwrite",request:true});
          if(next==="granted")renderMounted();
          else notify("Explorador","A autorização da pasta não foi concedida.");
        };
        realView.querySelector("[data-mount-forget]").onclick=async()=>{
          await forgetMount(record.id);
          exitMountedMode();
          await refreshMountNav();
          notify("Explorador","Montagem removida.");
        };
        return;
      }

      let entries;
      try{entries=await listDirectory(record.handle,mounted.segments)}
      catch(err){
        realView.innerHTML='<div class="real-mount-error"><strong>Não foi possível ler a pasta.</strong><p>'+escapeHTML(err?.message||"Erro de acesso")+'</p><button class="sys-button" data-mount-retry>Tentar novamente</button></div>';
        realView.querySelector("[data-mount-retry]").onclick=renderMounted;
        return;
      }

      if(query){
        const q=query.toLocaleLowerCase("pt-PT");
        entries=entries.filter(x=>x.name.toLocaleLowerCase("pt-PT").includes(q));
      }

      realView.innerHTML=
        '<div class="real-mount-toolbar">'+
          '<span class="real-mount-badge">Pasta real · leitura/escrita</span>'+
          '<button class="sys-button" data-mount-refresh>↻ Atualizar</button>'+
          '<button class="sys-button" data-mount-new-folder>＋ Pasta</button>'+
          '<button class="sys-button" data-mount-new-text>＋ Texto</button>'+
          '<span class="real-mount-spacer"></span>'+
          '<button class="sys-button" data-mount-forget>Desmontar</button>'+
        '</div>'+
        '<div class="real-mount-security-note">Alterações nesta vista afetam diretamente a pasta escolhida no dispositivo.</div>'+
        '<div class="real-mount-list"></div>';

      const list=realView.querySelector(".real-mount-list");
      for(const item of entries){
        const row=document.createElement("button");
        row.className="real-mount-row";
        row.dataset.kind=item.kind;
        row.dataset.name=item.name;
        const icon=item.kind==="directory"?"📁":(
          /.(png|jpe?g|webp|gif|bmp)$/i.test(item.name)?"🖼️":
          /.(mp3|wav|ogg|m4a|mp4|webm|mov)$/i.test(item.name)?"🎵":"📄"
        );
        row.innerHTML=
          '<span class="real-mount-item-icon">'+icon+'</span>'+
          '<span class="real-mount-item-name">'+escapeHTML(item.name)+'</span>'+
          '<span class="real-mount-item-type">'+escapeHTML(item.kind==="directory"?"Pasta":item.type||"Ficheiro")+'</span>'+
          '<span class="real-mount-item-size">'+(item.kind==="directory"?"":formatBytes(item.size||0))+'</span>';
        row.ondblclick=()=>{
          if(item.kind==="directory"){
            mounted.segments.push(item.name);
            query="";search.value="";
            renderMounted();
          }else{
            openMountedFile(record,mounted.segments,item.name).catch(err=>notify("Explorador",err?.message||"Não foi possível abrir o ficheiro."));
          }
        };
        row.oncontextmenu=e=>{
          e.preventDefault();
          const menu=[];
          if(item.kind==="directory"){
            menu.push(["Abrir",()=>{mounted.segments.push(item.name);renderMounted()}]);
          }else{
            menu.push(["Abrir",()=>openMountedFile(record,mounted.segments,item.name)]);
            menu.push(["Abrir com...",()=>showMountedOpenWith(record,mounted.segments,item.name)]);
            menu.push(["Partilhar",()=>shareMountedFile(record,mounted.segments,item.name)]);
            menu.push(["Imprimir",()=>printMountedFile(record,mounted.segments,item.name)]);
          }
          menu.push(["Mudar nome",async()=>{
            const next=prompt("Novo nome:",item.name);
            if(!next||next===item.name)return;
            try{
              await renameEntry(record.handle,mounted.segments,item.name,next,item.kind);
              notify("Explorador","Item renomeado na pasta real.");
              renderMounted();
            }catch(err){notify("Explorador",err?.message||"Não foi possível mudar o nome.")}
          }]);
          menu.push(["Eliminar",()=>{
            showSystemDialog(
              "Eliminar da pasta real",
              '<p>Eliminar <strong>'+escapeHTML(item.name)+'</strong> diretamente do dispositivo?</p><p>Esta ação não utiliza a Reciclagem virtual.</p>',
              "Eliminar",
              async()=>{
                try{
                  await deleteEntry(record.handle,mounted.segments,item.name,item.kind);
                  notify("Explorador","Item eliminado da pasta real.");
                  renderMounted();
                }catch(err){notify("Explorador",err?.message||"Não foi possível eliminar o item.")}
              }
            );
          }]);
          showContext(e.clientX,e.clientY,menu);
        };
        list.appendChild(row);
      }
      if(!entries.length){
        list.innerHTML='<div class="real-mount-empty">'+(query?"Nenhum resultado.":"Esta pasta real está vazia.")+'</div>';
      }

      realView.querySelector("[data-mount-refresh]").onclick=renderMounted;
      realView.querySelector("[data-mount-new-folder]").onclick=async()=>{
        const name=prompt("Nome da nova pasta:","Nova pasta");
        if(!name)return;
        try{
          await createFolder(record.handle,mounted.segments,name);
          notify("Explorador","Pasta criada no dispositivo.");
          renderMounted();
        }catch(err){notify("Explorador",err?.message||"Não foi possível criar a pasta.")}
      };
      realView.querySelector("[data-mount-new-text]").onclick=async()=>{
        const name=prompt("Nome do ficheiro:","Novo Documento de Texto.txt");
        if(!name)return;
        try{
          const final=/.[^./\\]+$/.test(name)?name:name+".txt";
          await createTextFile(record.handle,mounted.segments,final,"");
          notify("Explorador","Ficheiro criado no dispositivo.");
          renderMounted();
        }catch(err){notify("Explorador",err?.message||"Não foi possível criar o ficheiro.")}
      };
      realView.querySelector("[data-mount-forget]").onclick=async()=>{
        await forgetMount(record.id);
        exitMountedMode();
        await refreshMountNav();
        notify("Explorador","Pasta desmontada.");
      };
    }

    async function openMount(id,segments=[]){
      const record=await getMount(id);
      if(!record){notify("Explorador","A montagem não foi encontrada.");return}
      mounted={id:record.id,record,segments:normalizeSegments(segments)};
      query="";search.value="";
      renderMounted();
    }

    mountButton.onclick=async()=>{
      try{
        const record=await mountDirectory();
        await refreshMountNav();
        await openMount(record.id,[]);
        notify(
          "Explorador",
          record.persisted
            ? mountLabel(record)+" montada e guardada neste perfil."
            : mountLabel(record)+" montada apenas para esta sessão do navegador."
        );
      }catch(err){
        if(err?.name!=="AbortError")notify("Explorador",err?.message||"Não foi possível montar a pasta.");
      }
    };

    wrap.querySelectorAll("[data-path]").forEach(node=>{
      node.addEventListener("click",()=>{if(isMountedMode())exitMountedMode()},{capture:true});
    });

    ["[data-back]","[data-up]"].forEach(selector=>{
      wrap.querySelector(selector)?.addEventListener("click",e=>{
        if(!isMountedMode())return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if(mounted.segments.length){
          mounted.segments.pop();
          query="";search.value="";
          renderMounted();
        }else{
          exitMountedMode();
          wrap.querySelector('[data-path="This PC"]')?.click();
        }
      },{capture:true});
    });

    wrap.querySelector("[data-forward]")?.addEventListener("click",e=>{
      if(!isMountedMode())return;
      e.preventDefault();e.stopImmediatePropagation();
    },{capture:true});

    search.addEventListener("input",e=>{
      if(!isMountedMode())return;
      e.stopImmediatePropagation();
      query=e.target.value.trim();
      renderMounted();
    },{capture:true});

    wrap.addEventListener("open-real-mount",e=>{
      if(e.detail?.id)openMount(e.detail.id,e.detail.segments||[]);
    });

    win.addEventListener("navigate",()=>{
      if(isMountedMode())exitMountedMode();
    },{capture:true});

    refreshMountNav();
  }

  const previousBuildExplorer=globalThis.buildExplorerV5;
  if(typeof previousBuildExplorer==="function"){
    globalThis.buildExplorerV5=function(wrap,win,startPath){
      previousBuildExplorer(wrap,win,startPath);
      installExplorerMounts(wrap,win);
    };
    try{buildExplorerV5=globalThis.buildExplorerV5}catch{}
  }

  const previousRenderThisPC=globalThis.renderThisPCV5;
  if(typeof previousRenderThisPC==="function"){
    globalThis.renderThisPCV5=function(grid,nav){
      previousRenderThisPC(grid,nav);
      const wrap=grid.closest(".explorer-v4");
      if(!wrap)return;
      listMounts().then(async mounts=>{
        for(const record of mounts){
          if(!grid.isConnected)break;
          const card=document.createElement("div");
          card.className="drive-card real-drive-card";
          card.dataset.realMountCard=record.id;
          const permission=await ensurePermission(record.handle,{mode:"readwrite",request:false});
          card.innerHTML=
            '<div style="font-size:26px">🗂</div>'+
            '<strong>'+escapeHTML(mountLabel(record))+'</strong>'+
            '<div class="real-drive-meta">'+escapeHTML(permissionDescription(permission))+' · pasta real</div>'+
            '<div class="real-drive-bar"><i></i></div>';
          card.onclick=()=>wrap.dispatchEvent(new CustomEvent("open-real-mount",{detail:{id:record.id}}));
          grid.appendChild(card);
        }
      });
    };
    try{renderThisPCV5=globalThis.renderThisPCV5}catch{}
  }

  const previousSettings=globalThis.renderSettingsPageV5;
  if(typeof previousSettings==="function"){
    globalThis.renderSettingsPageV5=function(box,page){
      previousSettings(box,page);
      if(page!=="system"||box.querySelector("[data-real-mount-settings]"))return;
      const card=document.createElement("div");
      card.className="sys-card real-mount-settings";
      card.dataset.realMountSettings="";
      card.innerHTML=
        '<strong>🗂 Pastas reais montadas</strong>'+
        '<p data-real-mount-count>A verificar...</p>'+
        '<div class="real-mount-settings-actions">'+
          '<button class="sys-button primary" data-settings-mount>Montar pasta real</button>'+
          '<button class="sys-button" data-settings-open-explorer>Abrir Explorador</button>'+
        '</div>';
      (box.querySelector(".sys-grid")||box).appendChild(card);
      listMounts().then(rows=>{
        const p=card.querySelector("[data-real-mount-count]");
        if(p)p.textContent=rows.length
          ?rows.length+" pasta(s) real(is) associada(s) a este perfil."
          :"Nenhuma pasta real montada neste perfil.";
      });
      card.querySelector("[data-settings-mount]").onclick=async()=>{
        try{
          const record=await mountDirectory();
          notify("Explorador",mountLabel(record)+" montada.");
          openApp("explorer");
        }catch(err){
          if(err?.name!=="AbortError")notify("Explorador",err?.message||"Não foi possível montar a pasta.");
        }
      };
      card.querySelector("[data-settings-open-explorer]").onclick=()=>openApp("explorer");
    };
    try{globalThis.renderSettingsPageV5=renderSettingsPageV5}catch{}
  }

  globalThis.Win11RealMounts=Object.freeze({
    version:"7.8.1",
    supported:typeof window.showDirectoryPicker==="function",
    currentOwnerId,
    permissionState,
    ensurePermission,
    mountDirectory,
    listMounts,
    getMount,
    forgetMount,
    purgeOwnerMounts,
    resolveDirectory,
    listDirectory,
    createFolder,
    createTextFile,
    renameEntry,
    deleteEntry,
    mountedFile,
    openMountedFile,
    showMountedOpenWith,
    shareMountedFile,
    printMountedFile
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"7.8.1",
    step:10,
    features:[
      "real-file-open","real-file-save","download-fallback",
      "real-clipboard-write","real-clipboard-read","clipboard-manual-paste-fallback",
      "explorer-real-import","explorer-real-folder-import","explorer-drag-drop","explorer-real-export",
      "photos-real-image-open","media-real-playback",
      "local-accounts","per-user-state","session-lock","session-signout","session-switch-user",
      "pbkdf2-credentials","broadcast-session-conflict","per-user-indexeddb-ownership",
      "real-microphone-recording","real-camera","real-screen-capture",
      "real-device-info","persistent-storage","screen-wake-lock","fullscreen",
      "profile-avatar","profile-rename","credential-change","profile-backup","profile-restore","account-delete","auto-lock",
      "file-associations","open-with","native-share","real-print","real-network-status","real-quick-settings",
      "real-folder-mounts","real-folder-readwrite","real-folder-create","real-folder-rename","real-folder-delete","real-folder-persist"
    ]
  });
})();
