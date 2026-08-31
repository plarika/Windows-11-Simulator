"use strict";
(function installExplorerContextV850(){
  const previousBuildExplorer=globalThis.buildExplorerV5;
  if(typeof previousBuildExplorer!=="function")throw new Error("Explorer must load before Explorer Context V8.5.");

  function pathOf(wrap){
    return globalThis.Win11ExplorerPro?.currentVirtualPath?.(wrap)
      || String(wrap.querySelector(".pathbar")?.textContent||"");
  }

  function nodeName(node){
    return node?.dataset?.v740Name
      || node?.querySelector?.(".file-name")?.textContent?.trim()
      || node?.querySelector?.(".fname span:nth-child(2)")?.textContent?.trim()
      || "";
  }

  function nodeType(wrap,node){
    const type=node?.dataset?.v740Type;
    if(type)return type;
    const path=pathOf(wrap),name=nodeName(node);
    if(path&&name&&state.files?.[path+"/"+name])return "folder";
    return "file";
  }

  function valueSize(value){
    if(value==null)return 0;
    if(typeof value==="string")return new Blob([value]).size;
    if(value instanceof Blob)return value.size;
    if(Number.isFinite(Number(value?.size)))return Number(value.size);
    try{return new Blob([JSON.stringify(value)]).size}catch{return 0}
  }

  function folderStats(root){
    const prefix=root+"/";
    const paths=Object.keys(state.files||{}).filter(p=>p===root||p.startsWith(prefix));
    let files=0,size=0;
    for(const p of paths)for(const value of Object.values(state.files[p]||{})){files++;size+=valueSize(value)}
    return {files,folders:Math.max(0,paths.length-(paths.includes(root)?1:0)),size};
  }

  function extensionOf(name){
    const i=String(name||"").lastIndexOf(".");
    return i>0?name.slice(i+1).toUpperCase():"";
  }

  function fileKind(name,type){
    if(type==="folder")return "Pasta de ficheiros";
    const ext=extensionOf(name);
    if(["PNG","JPG","JPEG","GIF","WEBP","SVG"].includes(ext))return "Imagem";
    if(["TXT","MD","LOG","JSON","CSV"].includes(ext))return "Documento de texto";
    if(["MP3","WAV","OGG","M4A"].includes(ext))return "Áudio";
    if(["MP4","WEBM","MOV","MKV"].includes(ext))return "Vídeo";
    return ext?"Ficheiro "+ext:"Ficheiro";
  }

  function selectedNodes(wrap){
    return [...wrap.querySelectorAll(".file.selected,.file-row.selected:not(.header)")];
  }

  function descriptor(wrap,node){
    const path=pathOf(wrap),name=nodeName(node),type=nodeType(wrap,node);
    if(!path||!name||path==="This PC")return null;
    return {path,name,type,node};
  }  function showModernMenu(x,y,quick,menu,more=[]){
    const host=document.querySelector("#context-menu");
    if(!host)return;
    host.innerHTML="";
    host.className="context-menu explorer-modern-menu-v850";

    if(quick.length){
      const row=document.createElement("div");
      row.className="explorer-context-quick-v850";
      for(const action of quick){
        const b=document.createElement("button");
        b.className="explorer-context-quick-action-v850";
        b.title=action.label;
        b.setAttribute("aria-label",action.label);
        b.innerHTML='<span aria-hidden="true">'+action.icon+'</span><small>'+escapeHTML(action.short||action.label)+'</small>';
        b.onclick=()=>{host.classList.remove("open");action.run()};
        row.appendChild(b);
      }
      host.appendChild(row);
      host.appendChild(document.createElement("hr"));
    }

    const add=(label,run,cls="")=>{
      const b=document.createElement("button");
      if(cls)b.className=cls;
      b.textContent=label;
      b.onclick=()=>{host.classList.remove("open");run()};
      host.appendChild(b);
    };
    for(const item of menu){
      if(item==="---"){host.appendChild(document.createElement("hr"));continue}
      add(item.label,item.run,item.className||"");
    }
    if(more.length){
      host.appendChild(document.createElement("hr"));
      add("Mostrar mais opções",()=>showClassicMore(x,y,more),"explorer-context-more-v850");
    }

    host.style.left=Math.min(x,innerWidth-250)+"px";
    host.style.top=Math.min(y,innerHeight-340)+"px";
    host.classList.add("open");
  }

  function showClassicMore(x,y,items){
    const host=document.querySelector("#context-menu");
    if(!host)return;
    host.innerHTML="";
    host.className="context-menu explorer-more-menu-v850";
    for(const item of items){
      if(item==="---"){host.appendChild(document.createElement("hr"));continue}
      const b=document.createElement("button");
      b.textContent=item.label;
      b.onclick=()=>{host.classList.remove("open");item.run()};
      host.appendChild(b);
    }
    host.style.left=Math.min(x,innerWidth-230)+"px";
    host.style.top=Math.min(y,innerHeight-330)+"px";
    host.classList.add("open");
  }

  function command(wrap,selector){
    const b=wrap.querySelector(selector);
    if(b&&!b.disabled){b.click();return true}
    return false;
  }  function showRichProperties(wrap,item){
    const nodes=selectedNodes(wrap);
    if(nodes.length!==1||!item){
      command(wrap,"[data-properties-v740]");
      return;
    }
    const full=item.path+"/"+item.name;
    const value=item.type==="file"?ensureFolder(item.path)[item.name]:null;
    const stats=item.type==="folder"?folderStats(full):null;
    const size=item.type==="folder"?stats.size:valueSize(value);
    const ext=extensionOf(item.name);
    const imported=!!value?.__realBlobId;
    const modified=Number(value?.lastModified)||0;
    let general='<dl class="explorer-properties-panel-v850 active" data-prop-panel="general">'+
      '<dt>Tipo</dt><dd>'+escapeHTML(fileKind(item.name,item.type))+'</dd>'+
      '<dt>Localização</dt><dd>'+escapeHTML(item.path)+'</dd>'+
      '<dt>Tamanho</dt><dd>'+escapeHTML(formatBytes(size))+'</dd>';
    if(stats)general+='<dt>Conteúdo</dt><dd>'+stats.files+' ficheiro(s), '+stats.folders+' pasta(s)</dd>';
    general+='<dt>Origem</dt><dd>'+(imported?"Conteúdo real importado":"Filesystem virtual do perfil")+'</dd></dl>';

    let details='<dl class="explorer-properties-panel-v850" data-prop-panel="details">'+
      '<dt>Caminho completo</dt><dd>'+escapeHTML(full)+'</dd>';
    if(ext)details+='<dt>Extensão</dt><dd>.'+escapeHTML(ext.toLowerCase())+'</dd>';
    if(modified)details+='<dt>Modificado</dt><dd>'+escapeHTML(new Date(modified).toLocaleString("pt-PT"))+'</dd>';
    details+='<dt>Atributos</dt><dd>Disponível · '+(item.type==="folder"?"Pasta":"Ficheiro")+'</dd>'+
      '<dt>Perfil</dt><dd>Estado local isolado</dd></dl>';

    const html='<div class="explorer-properties-v850">'+
      '<div class="explorer-properties-hero-v850"><div class="explorer-properties-icon-v850">'+(item.type==="folder"?"▣":"▤")+'</div>'+
      '<div><h3>'+escapeHTML(item.name)+'</h3><span>'+escapeHTML(fileKind(item.name,item.type))+'</span></div></div>'+
      '<div class="explorer-properties-tabs-v850"><button class="active" data-prop-tab="general">Geral</button><button data-prop-tab="details">Detalhes</button></div>'+
      general+details+'</div>';
    showSystemDialog("Propriedades",html,"OK",()=>{});
    const root=document.querySelector("#system-dialog-body .explorer-properties-v850");
    root?.querySelectorAll("[data-prop-tab]").forEach(tab=>{
      tab.onclick=()=>{
        const name=tab.dataset.propTab;
        root.querySelectorAll("[data-prop-tab]").forEach(x=>x.classList.toggle("active",x===tab));
        root.querySelectorAll("[data-prop-panel]").forEach(x=>x.classList.toggle("active",x.dataset.propPanel===name));
      };
    });
  }

  function openItem(wrap,item){
    if(!item)return;
    if(item.type==="folder"){
      wrap.dispatchEvent(new CustomEvent("navigate",{detail:item.path+"/"+item.name}));
      return;
    }
    openFile(item.path,item.name,ensureFolder(item.path)[item.name]);
  }

  function copyPath(item){
    const value=item.path+"/"+item.name;
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(value).then(()=>notify("Explorador","Caminho copiado.")).catch(()=>notify("Explorador",value));
    }else notify("Explorador",value);
  }

  function moreOptions(wrap,item){
    const items=[{label:"Abrir",run:()=>openItem(wrap,item)}];
    if(item?.type==="file"&&globalThis.Win11DesktopIntegration){
      items.push(
        {label:"Abrir com...",run:()=>Win11DesktopIntegration.showOpenWith(item.path,item.name,ensureFolder(item.path)[item.name])},
        {label:"Partilhar",run:()=>Win11DesktopIntegration.shareFile(item.path,item.name,ensureFolder(item.path)[item.name])},
        {label:"Imprimir",run:()=>Win11DesktopIntegration.printFile(item.path,item.name,ensureFolder(item.path)[item.name])}
      );
    }
    items.push("---",{label:"Copiar caminho",run:()=>copyPath(item)},{label:"Propriedades",run:()=>showRichProperties(wrap,item)});
    return items;
  }  function installContext(wrap,win){
    if(!wrap||wrap.dataset.explorerContextV850==="1")return;
    wrap.dataset.explorerContextV850="1";
    wrap.classList.add("explorer-context-v850");

    function onContextMenu(e){
      if(wrap.classList.contains("real-mount-mode"))return;
      const node=e.target.closest(".file,.file-row:not(.header)");
      if(!node||!wrap.contains(node))return;
      const item=descriptor(wrap,node);
      if(!item||item.type==="recycle")return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if(!node.classList.contains("selected"))node.click();
      const selected=selectedNodes(wrap);
      const single=selected.length===1;
      const quick=[
        {label:"Cortar",short:"Cortar",icon:"✂",run:()=>command(wrap,"[data-cut]")},
        {label:"Copiar",short:"Copiar",icon:"▣",run:()=>command(wrap,"[data-copy]")}
      ];
      if(single)quick.push({label:"Mudar nome",short:"Nome",icon:"✎",run:()=>command(wrap,"[data-rename]")});
      if(single&&item.type==="file"&&globalThis.Win11DesktopIntegration){
        quick.push({label:"Partilhar",short:"Partilhar",icon:"↗",run:()=>Win11DesktopIntegration.shareFile(item.path,item.name,ensureFolder(item.path)[item.name])});
      }
      quick.push({label:"Eliminar",short:"Eliminar",icon:"×",run:()=>command(wrap,"[data-delete]")});

      const menu=[];
      if(single){
        menu.push(
          {label:"Abrir",run:()=>openItem(wrap,item)},
          {label:"Adicionar ao Acesso rápido",run:()=>wrap.__explorerNavigationV820?.addQuickAccess?.(item.type==="folder"?item.path+"/"+item.name:item.path)}
        );
        if(item.type==="file"&&globalThis.Win11DesktopIntegration){
          menu.push({label:"Abrir com...",run:()=>Win11DesktopIntegration.showOpenWith(item.path,item.name,ensureFolder(item.path)[item.name])});
        }
        menu.push("---");
      }
      menu.push({label:"Propriedades",run:()=>showRichProperties(wrap,item)});

      showModernMenu(e.clientX,e.clientY,quick,menu,single?moreOptions(wrap,item):[]);
    }

    wrap.addEventListener("contextmenu",onContextMenu,true);

    const api=Object.freeze({
      showProperties:()=>showRichProperties(wrap,descriptor(wrap,selectedNodes(wrap)[0])),
      openMenuFor:(node,x=100,y=100)=>node?.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:x,clientY:y}))
    });
    wrap.__explorerContextV850=api;
    if(win)win.__explorerContextV850=api;

    const cleanup=setInterval(()=>{
      if(wrap.isConnected)return;
      clearInterval(cleanup);
      wrap.removeEventListener("contextmenu",onContextMenu,true);
    },1000);
  }

  globalThis.buildExplorerV5=function(wrap,win,startPath){
    previousBuildExplorer(wrap,win,startPath);
    installContext(wrap,win);
  };
  try{buildExplorerV5=globalThis.buildExplorerV5}catch{}

  globalThis.Win11ExplorerContext=Object.freeze({
    version:"8.5.0",installContext,showModernMenu,showClassicMore
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"8.5.0",step:18,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-modern-context-menu","explorer-context-quick-actions",
      "explorer-more-options","explorer-rich-properties","explorer-copy-path"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();