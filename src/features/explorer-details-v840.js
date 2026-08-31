"use strict";
(function installExplorerDetailsV840(){
  const previousBuildExplorer=globalThis.buildExplorerV5;
  if(typeof previousBuildExplorer!=="function")throw new Error("Explorer must load before Explorer Details V8.4.");

  function virtualValueSize(value){
    if(value==null)return 0;
    if(typeof value==="string")return new Blob([value]).size;
    if(value instanceof Blob)return value.size;
    if(value?.size&&Number.isFinite(Number(value.size)))return Number(value.size);
    try{return new Blob([JSON.stringify(value)]).size}catch{return 0}
  }

  function folderStats(root){
    const prefix=root+"/";
    const paths=Object.keys(state.files||{}).filter(p=>p===root||p.startsWith(prefix));
    let files=0,size=0;
    for(const p of paths){
      for(const value of Object.values(state.files[p]||{})){files++;size+=virtualValueSize(value)}
    }
    return {files,folders:Math.max(0,paths.length-(paths.includes(root)?1:0)),size};
  }

  function classify(name,type,value){
    if(type==="folder")return "Pasta";
    const lower=String(name||"").toLowerCase();
    if(/\.(png|jpg|jpeg|gif|webp|svg)$/.test(lower))return "Imagem";
    if(/\.(txt|md|json|js|css|html|log|csv)$/.test(lower))return "Documento de texto";
    if(/\.(mp3|wav|ogg|m4a)$/.test(lower))return "Áudio";
    if(/\.(mp4|webm|mov|mkv)$/.test(lower))return "Vídeo";
    return "Ficheiro";
  }

  function currentPath(wrap){
    return globalThis.Win11ExplorerPro?.currentVirtualPath?.(wrap)
      || String(wrap.querySelector(".pathbar")?.textContent||"This PC");
  }

  function selectedDescriptor(wrap){
    if(wrap.classList.contains("real-mount-mode"))return {mounted:true};
    const node=wrap.querySelector(".file.selected,.file-row.selected:not(.header)");
    if(!node)return null;
    const path=currentPath(wrap);
    const name=node.dataset.v740Name||node.querySelector(".file-name")?.textContent?.trim()||"";
    const type=node.dataset.v740Type||"file";
    if(!name||path==="This PC")return null;
    return {path,name,type,node};
  }  function previewMarkup(item){
    if(!item)return '<div class="explorer-detail-empty-v840"><strong>Nenhum item selecionado</strong><span>Selecione um ficheiro ou pasta para ver detalhes.</span></div>';
    if(item.mounted)return '<div class="explorer-detail-empty-v840"><strong>Pasta real montada</strong><span>A pré-visualização automática de conteúdo real está desativada por privacidade.</span></div>';
    if(item.type==="folder"){
      const full=item.path+"/"+item.name;
      const s=folderStats(full);
      return '<div class="explorer-detail-hero-v840 folder" aria-hidden="true">▣</div>'+
        '<h3>'+escapeHTML(item.name)+'</h3>'+
        '<div class="explorer-detail-type-v840">Pasta</div>'+
        '<dl><dt>Localização</dt><dd>'+escapeHTML(item.path)+'</dd>'+
        '<dt>Ficheiros</dt><dd>'+s.files+'</dd><dt>Pastas</dt><dd>'+s.folders+'</dd>'+
        '<dt>Tamanho</dt><dd>'+escapeHTML(formatBytes(s.size))+'</dd></dl>';
    }
    const value=ensureFolder(item.path)[item.name];
    const kind=classify(item.name,item.type,value);
    let preview='<div class="explorer-detail-hero-v840" aria-hidden="true">▤</div>';
    if(typeof value==="string"&&value.startsWith("data:image/")){
      preview='<div class="explorer-detail-image-v840"><img src="'+escapeHTML(value)+'" alt=""></div>';
    }else if(typeof value==="string"&&["Documento de texto","Ficheiro"].includes(kind)){
      const text=value.slice(0,1200);
      if(text.trim())preview='<pre class="explorer-detail-text-v840">'+escapeHTML(text)+'</pre>';
    }else if(value?.__realBlobId){
      preview='<div class="explorer-detail-real-v840">Conteúdo importado · pré-visualização automática desativada</div>';
    }
    return preview+'<h3>'+escapeHTML(item.name)+'</h3>'+
      '<div class="explorer-detail-type-v840">'+escapeHTML(kind)+'</div>'+
      '<dl><dt>Localização</dt><dd>'+escapeHTML(item.path)+'</dd>'+
      '<dt>Tamanho</dt><dd>'+escapeHTML(formatBytes(virtualValueSize(value)))+'</dd></dl>';
  }

  function installDetails(wrap,win){
    if(!wrap||wrap.dataset.explorerDetailsV840==="1")return;
    wrap.dataset.explorerDetailsV840="1";
    wrap.classList.add("explorer-details-v840");
    const command=wrap.querySelector(".explorer-command");
    const files=wrap.querySelector(".explorer-files");
    if(!command||!files)return;

    const button=document.createElement("button");
    button.dataset.detailsV840="";
    button.className="explorer-details-toggle-v840";
    button.innerHTML='<span class="cmd-icon">◧</span><span class="cmd-label">Detalhes</span>';
    button.title="Painel de detalhes";
    const sort=wrap.querySelector("[data-sort]");
    command.insertBefore(button,sort||null);

    const pane=document.createElement("aside");
    pane.className="explorer-details-pane-v840";
    pane.setAttribute("aria-label","Painel de detalhes");
    pane.innerHTML='<div class="explorer-details-head-v840"><strong>Detalhes</strong><button data-close-details aria-label="Fechar">×</button></div><div class="explorer-details-content-v840"></div>';
    files.parentNode.insertBefore(pane,files.nextSibling);
    const content=pane.querySelector(".explorer-details-content-v840");    function renderDetails(){
      const selected=selectedDescriptor(wrap);
      content.innerHTML=previewMarkup(selected);
    }

    function setOpen(open){
      wrap.classList.toggle("details-open-v840",!!open);
      button.classList.toggle("active",!!open);
      button.setAttribute("aria-pressed",open?"true":"false");
      if(open)renderDetails();
    }

    button.onclick=()=>setOpen(!wrap.classList.contains("details-open-v840"));
    pane.querySelector("[data-close-details]").onclick=()=>setOpen(false);

    const gridHost=wrap.querySelector(".explorer-files");
    gridHost.addEventListener("click",()=>{if(wrap.classList.contains("details-open-v840"))setTimeout(renderDetails,0)},true);
    gridHost.addEventListener("keydown",()=>{if(wrap.classList.contains("details-open-v840"))setTimeout(renderDetails,0)},true);

    const observer=new MutationObserver(()=>{
      if(wrap.classList.contains("details-open-v840"))setTimeout(renderDetails,0);
    });
    observer.observe(gridHost,{childList:true,subtree:true,attributes:true,attributeFilter:["class","aria-selected"]});

    const cleanup=setInterval(()=>{
      if(wrap.isConnected)return;
      clearInterval(cleanup);
      observer.disconnect();
    },1000);

    const api=Object.freeze({
      open:()=>setOpen(true),close:()=>setOpen(false),toggle:()=>setOpen(!wrap.classList.contains("details-open-v840")),
      refresh:renderDetails,isOpen:()=>wrap.classList.contains("details-open-v840")
    });
    wrap.__explorerDetailsV840=api;
    if(win)win.__explorerDetailsV840=api;
  }

  const previousThisPC=globalThis.renderThisPCV5;
  if(typeof previousThisPC==="function"){
    globalThis.renderThisPCV5=function(grid,nav){
      previousThisPC(grid,nav);
      grid.classList.add("thispc-v840");
      const folders=[
        ["Ambiente de Trabalho","C:/Desktop"],["Documentos","C:/Documents"],["Transferências","C:/Downloads"],
        ["Imagens","C:/Pictures"],["Música","C:/Music"],["Vídeos","C:/Videos"]
      ];
      const section=document.createElement("section");
      section.className="thispc-folders-v840";
      section.innerHTML='<h3>Pastas</h3><div class="thispc-folder-grid-v840"></div>';
      const host=section.querySelector(".thispc-folder-grid-v840");
      for(const [name,path] of folders){
        const s=folderStats(path);
        const card=document.createElement("button");
        card.className="thispc-folder-card-v840";
        card.innerHTML='<span class="thispc-folder-icon-v840" aria-hidden="true">▣</span><span><strong>'+escapeHTML(name)+'</strong><small>'+s.files+' ficheiro(s) · '+formatBytes(s.size)+'</small></span>';
        card.onclick=()=>nav(path);
        host.appendChild(card);
      }
      grid.insertBefore(section,grid.firstChild);
      const summary=document.createElement("div");
      summary.className="thispc-storage-summary-v840";
      const storage=globalThis.Win11Storage?.snapshot?.();
      if(storage){
        const files=storage.categories.reduce((n,c)=>n+(c.key==="apps"?0:c.files),0);
        summary.innerHTML='<strong>Armazenamento virtual</strong><span>'+files+' ficheiro(s) · '+Win11Storage.formatBytes(storage.used)+' de '+Win11Storage.formatBytes(storage.capacity)+' utilizados no perfil</span>';
      }else{
        const all=folderStats("C:");
        summary.innerHTML='<strong>Armazenamento virtual</strong><span>'+all.files+' ficheiro(s) · '+formatBytes(all.size)+' utilizados no perfil</span>';
      }
      grid.appendChild(summary);
    };
    try{renderThisPCV5=globalThis.renderThisPCV5}catch{}
  }  globalThis.buildExplorerV5=function(wrap,win,startPath){
    previousBuildExplorer(wrap,win,startPath);
    installDetails(wrap,win);
  };
  try{buildExplorerV5=globalThis.buildExplorerV5}catch{}

  globalThis.Win11ExplorerDetails=Object.freeze({
    version:"8.4.0",virtualValueSize,folderStats,classify,installDetails
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"8.4.0",step:17,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-details-pane","explorer-text-preview","explorer-image-preview",
      "explorer-folder-summary","explorer-thispc-folders","explorer-storage-summary",
      "explorer-real-content-preview-privacy"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();