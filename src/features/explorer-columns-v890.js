"use strict";
(function installExplorerColumnsV890(){
  const previousBuildExplorer=globalThis.buildExplorerV5;
  if(typeof previousBuildExplorer!=="function")throw new Error("Explorer must load before Explorer Columns V8.9.");

  function ensureColumnsState(){
    if(!state.explorerColumnsV89||typeof state.explorerColumnsV89!=="object"){
      state.explorerColumnsV89={
        sort:"name",direction:"asc",
        group:state.explorerViewsV86?.group==="type"?"type":"none",
        visible:{type:true,size:true,date:true},
        widths:{name:260,type:140,size:105,date:145}
      };
    }
    const s=state.explorerColumnsV89;
    if(!["name","type","size","date"].includes(s.sort))s.sort="name";
    if(!["asc","desc"].includes(s.direction))s.direction="asc";
    if(!["none","type","size","date"].includes(s.group))s.group="none";
    s.visible={type:s.visible?.type!==false,size:s.visible?.size!==false,date:s.visible?.date!==false};
    const w=s.widths||{};
    s.widths={
      name:Math.max(180,Math.min(520,Number(w.name)||260)),
      type:Math.max(90,Math.min(300,Number(w.type)||140)),
      size:Math.max(80,Math.min(220,Number(w.size)||105)),
      date:Math.max(110,Math.min(280,Number(w.date)||145))
    };
    return s;
  }

  function currentPath(wrap){
    return globalThis.Win11ExplorerPro?.currentVirtualPath?.(wrap)
      || String(wrap.querySelector(".pathbar")?.textContent||"");
  }

  function valueSize(value){
    if(value==null)return 0;
    if(typeof value==="string")return new Blob([value]).size;
    if(value instanceof Blob)return value.size;
    if(Number.isFinite(Number(value?.size)))return Number(value.size);
    try{return new Blob([JSON.stringify(value)]).size}catch{return 0}
  }

  function folderMeta(root){
    const prefix=root+"/";
    const paths=Object.keys(state.files||{}).filter(p=>p===root||p.startsWith(prefix));
    let size=0,modified=0,files=0;
    for(const p of paths){
      for(const value of Object.values(state.files[p]||{})){
        files++;size+=valueSize(value);
        modified=Math.max(modified,Number(value?.lastModified)||0);
      }
    }
    return {size,modified,files};
  }

  function itemMeta(wrap,node){
    const path=currentPath(wrap);
    const name=node.dataset.v740Name
      || node.querySelector(".file-name")?.textContent?.trim()
      || node.querySelector(".fname span:last-child")?.textContent?.trim()
      || "";
    const type=node.dataset.v740Type||"file";
    let size=0,modified=0;
    const fsMeta=globalThis.Win11ExplorerFilesystem?.getMetadata?.(path,name,type)||null;
    if(type==="folder"){
      const m=folderMeta(path+"/"+name);size=m.size;modified=Number(fsMeta?.modified)||m.modified;
    }else if(type==="file"){
      const value=ensureFolder(path)[name];
      size=valueSize(value);modified=Number(fsMeta?.modified)||Number(value?.lastModified)||0;
    }
    return {node,name,type,size,modified};
  }

  function typeRank(type){return type==="folder"?0:type==="file"?1:2}

  function compareMeta(a,b,key){
    if(key==="size")return a.size-b.size||a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"});
    if(key==="date")return a.modified-b.modified||a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"});
    if(key==="type")return typeRank(a.type)-typeRank(b.type)||a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"});
    return a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"});
  }  function groupInfo(meta,key){
    if(key==="type"){
      if(meta.type==="folder")return ["01-folder","Pastas"];
      if(meta.type==="recycle")return ["03-recycle","Reciclagem"];
      return ["02-file","Ficheiros"];
    }
    if(key==="size"){
      if(meta.type==="folder")return ["00-folder","Pastas"];
      if(meta.size<1024*1024)return ["01-small","Pequenos (< 1 MB)"];
      if(meta.size<10*1024*1024)return ["02-medium","Médios (1–10 MB)"];
      return ["03-large","Grandes (≥ 10 MB)"];
    }
    if(key==="date"){
      if(!meta.modified)return ["05-none","Sem data"];
      const now=new Date(),date=new Date(meta.modified);
      const startToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
      const age=startToday-new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime();
      if(age<=0)return ["01-today","Hoje"];
      if(age<=6*86400000)return ["02-week","Esta semana"];
      if(date.getFullYear()===now.getFullYear()&&date.getMonth()===now.getMonth())return ["03-month","Este mês"];
      return ["04-older","Mais antigos"];
    }
    return ["00-all","Itens"];
  }

  function installColumns(wrap,win){
    if(!wrap||wrap.dataset.explorerColumnsV890==="1")return;
    wrap.dataset.explorerColumnsV890="1";
    wrap.classList.add("explorer-columns-v890");
    const command=wrap.querySelector(".explorer-command");
    const filesHost=wrap.querySelector(".explorer-files");
    const sortButton=wrap.querySelector("[data-sort]");
    const groupButton=wrap.querySelector("[data-group-v860]");
    if(!command||!filesHost||!sortButton)return;
    const prefs=ensureColumnsState();
    let applying=false,applyTimer=0;

    if(wrap.__explorerViewsV860?.getGroup?.()!=="none"){
      wrap.__explorerViewsV860.setGroup("none");
    }

    const columnsButton=document.createElement("button");
    columnsButton.dataset.columnsV890="";
    columnsButton.innerHTML='<span class="cmd-icon">▥</span><span class="cmd-label">Colunas</span>';
    columnsButton.title="Escolher colunas";
    command.insertBefore(columnsButton,groupButton||sortButton);

    function grid(){return wrap.querySelector(".file-grid,.file-list,.thispc-grid")}
    function itemNodes(g=grid()){
      return g?[...g.children].filter(n=>n.matches(".file,.file-row:not(.header)")):[];
    }

    function columnTemplate(){
      const parts=['minmax('+prefs.widths.name+'px,1fr)'];
      if(prefs.visible.type)parts.push(prefs.widths.type+"px");
      if(prefs.visible.size)parts.push(prefs.widths.size+"px");
      if(prefs.visible.date)parts.push(prefs.widths.date+"px");
      return parts.join(" ");
    }

    function applyColumns(){
      const g=grid();
      if(!g||!g.classList.contains("file-list"))return;
      if(!g.querySelector(":scope > .file-row.header")){
        const h=document.createElement("div");
        h.className="file-row header";
        h.innerHTML="<div>Nome</div><div>Tipo</div><div>Tamanho</div><div>Data de modificação</div>";
        g.prepend(h);
      }
      const rows=[...g.querySelectorAll(":scope > .file-row")];
      const visible=[true,prefs.visible.type,prefs.visible.size,prefs.visible.date];
      const template=columnTemplate();
      for(const row of rows){
        row.style.gridTemplateColumns=template;
        [...row.children].slice(0,4).forEach((child,i)=>child.style.display=visible[i]?"":"none");
      }
      decorateHeader();
    }    function setColumnWidth(key,width,persist=true){
      if(!["name","type","size","date"].includes(key))return false;
      const min=key==="name"?180:key==="date"?110:key==="type"?90:80;
      const max=key==="name"?520:key==="date"?280:key==="type"?300:220;
      prefs.widths[key]=Math.max(min,Math.min(max,Math.round(Number(width)||prefs.widths[key])));
      applyColumns();
      if(persist)saveState();
      return prefs.widths[key];
    }

    function toggleColumn(key){
      if(!["type","size","date"].includes(key))return false;
      prefs.visible[key]=!prefs.visible[key];
      saveState();applyColumns();
      return prefs.visible[key];
    }

    function sortLabel(key){
      return {name:"Nome",type:"Tipo",size:"Tamanho",date:"Data de modificação"}[key]||key;
    }

    function setSort(key,direction=null){
      if(!["name","type","size","date"].includes(key))return false;
      if(direction&&["asc","desc"].includes(direction))prefs.direction=direction;
      else if(prefs.sort===key)prefs.direction=prefs.direction==="asc"?"desc":"asc";
      else prefs.direction="asc";
      prefs.sort=key;
      saveState();scheduleApply();
      return true;
    }

    function setGroup(key){
      if(!["none","type","size","date"].includes(key))return false;
      prefs.group=key;
      if(wrap.__explorerViewsV860?.getGroup?.()!=="none")wrap.__explorerViewsV860.setGroup("none");
      saveState();scheduleApply();
      return true;
    }

    function decorateHeader(){
      const g=grid();
      if(!g?.classList.contains("file-list"))return;
      const header=g.querySelector(":scope > .file-row.header");
      if(!header)return;
      const keys=["name","type","size","date"];
      [...header.children].slice(0,4).forEach((cell,index)=>{
        const key=keys[index];
        cell.dataset.columnV890=key;
        cell.classList.add("explorer-column-head-v890");
        cell.title="Ordenar por "+sortLabel(key);
        cell.onclick=e=>{
          if(e.target.closest(".explorer-column-resize-v890"))return;
          setSort(key);
        };
        let handle=cell.querySelector(".explorer-column-resize-v890");
        if(!handle){
          handle=document.createElement("span");
          handle.className="explorer-column-resize-v890";
          handle.dataset.resizeColumn=key;
          handle.setAttribute("aria-hidden","true");
          cell.appendChild(handle);
          let startX=0,startWidth=0,dragging=false;
          handle.onpointerdown=e=>{
            dragging=true;startX=e.clientX;startWidth=prefs.widths[key];
            handle.setPointerCapture?.(e.pointerId);e.preventDefault();e.stopPropagation();
          };
          handle.onpointermove=e=>{
            if(!dragging)return;
            setColumnWidth(key,startWidth+(e.clientX-startX),false);
          };
          handle.onpointerup=e=>{
            if(!dragging)return;
            dragging=false;handle.releasePointerCapture?.(e.pointerId);saveState();
          };
        }
        cell.classList.toggle("sorted-v890",prefs.sort===key);
        cell.dataset.direction=prefs.sort===key?prefs.direction:"";
      });
    }    function applySortAndGroup(){
      const g=grid();
      if(!g||g.classList.contains("thispc-grid")||wrap.classList.contains("real-mount-mode"))return;
      applying=true;
      g.querySelectorAll(":scope > .explorer-group-heading-v890").forEach(x=>x.remove());
      const metas=itemNodes(g).map(n=>itemMeta(wrap,n));
      metas.sort((a,b)=>compareMeta(a,b,prefs.sort)*(prefs.direction==="desc"?-1:1));
      if(prefs.group==="none"){
        metas.forEach(m=>g.appendChild(m.node));
      }else{
        const buckets=new Map();
        for(const meta of metas){
          const [key,label]=groupInfo(meta,prefs.group);
          if(!buckets.has(key))buckets.set(key,{label,items:[]});
          buckets.get(key).items.push(meta);
        }
        for(const [key,bucket] of [...buckets.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
          const h=document.createElement("div");
          h.className="explorer-group-heading-v890";
          h.dataset.groupV890=key;
          h.textContent=bucket.label+" ("+bucket.items.length+")";
          g.appendChild(h);
          bucket.items.forEach(m=>g.appendChild(m.node));
        }
      }
      applyColumns();
      setTimeout(()=>{applying=false},0);
    }

    function scheduleApply(){
      clearTimeout(applyTimer);
      applyTimer=setTimeout(()=>{if(!applying)applySortAndGroup()},15);
    }

    sortButton.onclick=e=>{
      const items=[];
      for(const key of ["name","type","size","date"]){
        items.push([sortLabel(key)+" ↑",()=>setSort(key,"asc")]);
        items.push([sortLabel(key)+" ↓",()=>setSort(key,"desc")]);
      }
      showContext(e.clientX,e.clientY,items);
    };

    if(groupButton){
      groupButton.onclick=e=>showContext(e.clientX,e.clientY,[
        ["Nenhum",()=>setGroup("none")],
        ["Tipo",()=>setGroup("type")],
        ["Tamanho",()=>setGroup("size")],
        ["Data de modificação",()=>setGroup("date")]
      ]);
    }

    columnsButton.onclick=e=>showContext(e.clientX,e.clientY,[
      [(prefs.visible.type?"✓ ":"")+"Tipo",()=>toggleColumn("type")],
      [(prefs.visible.size?"✓ ":"")+"Tamanho",()=>toggleColumn("size")],
      [(prefs.visible.date?"✓ ":"")+"Data de modificação",()=>toggleColumn("date")]
    ]);

    const observer=new MutationObserver(()=>{if(!applying)scheduleApply()});
    observer.observe(filesHost,{childList:true,subtree:true});

    const api=Object.freeze({
      setSort,setGroup,toggleColumn,setColumnWidth,
      getState:()=>JSON.parse(JSON.stringify(prefs)),
      refresh:()=>scheduleApply()
    });
    wrap.__explorerColumnsV890=api;
    if(win)win.__explorerColumnsV890=api;
    scheduleApply();

    const cleanup=setInterval(()=>{
      if(wrap.isConnected)return;
      clearInterval(cleanup);clearTimeout(applyTimer);observer.disconnect();
    },1000);
  }  globalThis.buildExplorerV5=function(wrap,win,startPath){
    previousBuildExplorer(wrap,win,startPath);
    installColumns(wrap,win);
  };
  try{buildExplorerV5=globalThis.buildExplorerV5}catch{}

  globalThis.Win11ExplorerColumns=Object.freeze({version:"8.9.0",installColumns});
  globalThis.Win11RealFunctions=Object.freeze({
    version:"8.9.0",step:22,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-sort-name","explorer-sort-type","explorer-sort-size","explorer-sort-date",
      "explorer-sort-direction","explorer-group-size","explorer-group-date",
      "explorer-configurable-columns","explorer-column-resize","explorer-columns-profile-state"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();