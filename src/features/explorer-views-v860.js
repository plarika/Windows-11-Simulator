"use strict";
(function installExplorerViewsV860(){
  const previousBuildExplorer=globalThis.buildExplorerV5;
  if(typeof previousBuildExplorer!=="function")throw new Error("Explorer must load before Explorer Views V8.6.");

  function ensureViewState(){
    if(!state.explorerViewsV86||typeof state.explorerViewsV86!=="object"){
      state.explorerViewsV86={mode:"medium",group:"none"};
    }
    if(!["large","medium","small","details"].includes(state.explorerViewsV86.mode))state.explorerViewsV86.mode="medium";
    if(!["none","type"].includes(state.explorerViewsV86.group))state.explorerViewsV86.group="none";
    return state.explorerViewsV86;
  }

  function itemType(node){
    return node.dataset.v740Type||"file";
  }

  function groupLabel(type){
    if(type==="folder")return "Pastas";
    if(type==="recycle")return "Reciclagem";
    return "Ficheiros";
  }

  function installViews(wrap,win){
    if(!wrap||wrap.dataset.explorerViewsV860==="1")return;
    wrap.dataset.explorerViewsV860="1";
    wrap.classList.add("explorer-views-v860");
    const command=wrap.querySelector(".explorer-command");
    const gridHost=wrap.querySelector(".explorer-files");
    if(!command||!gridHost)return;
    const prefs=ensureViewState();
    let suppressGroupingObserver=false;

    const viewButton=document.createElement("button");
    viewButton.dataset.viewV860="";
    viewButton.innerHTML='<span class="cmd-icon">▦</span><span class="cmd-label">Ver</span>';
    viewButton.title="Ver";
    const groupButton=document.createElement("button");
    groupButton.dataset.groupV860="";
    groupButton.innerHTML='<span class="cmd-icon">☷</span><span class="cmd-label">Agrupar</span>';
    groupButton.title="Agrupar por";
    const sort=wrap.querySelector("[data-sort]");
    command.insertBefore(viewButton,sort||null);
    command.insertBefore(groupButton,sort||null);

    function currentGrid(){
      return wrap.querySelector(".file-grid,.file-list,.thispc-grid");
    }

    function applyMode(mode,persist=true){
      if(!["large","medium","small","details"].includes(mode))return false;
      wrap.classList.remove("view-large-v860","view-medium-v860","view-small-v860","view-details-v860");
      wrap.classList.add("view-"+mode+"-v860");
      if(mode==="details")wrap.querySelector("[data-list]")?.click();
      else wrap.querySelector("[data-icons]")?.click();
      prefs.mode=mode;
      if(persist)saveState();
      setTimeout(applyGrouping,20);
      return true;
    }

    function applyGrouping(){
      const grid=currentGrid();
      if(!grid||grid.classList.contains("thispc-grid"))return;
      suppressGroupingObserver=true;
      grid.querySelectorAll(":scope > .explorer-group-heading-v860").forEach(x=>x.remove());
      if(prefs.group!=="type"||wrap.classList.contains("real-mount-mode")){
        grid.classList.remove("grouped-v860");
        setTimeout(()=>{suppressGroupingObserver=false},0);
        return;
      }
      grid.classList.add("grouped-v860");
      const nodes=[...grid.children].filter(n=>n.matches(".file,.file-row:not(.header)"));
      const order=["folder","file","recycle"];
      const buckets=new Map(order.map(k=>[k,[]]));
      for(const node of nodes){
        const type=itemType(node);
        (buckets.get(type)||buckets.get("file")).push(node);
      }
      for(const type of order){
        const list=buckets.get(type);
        if(!list?.length)continue;
        const h=document.createElement("div");
        h.className="explorer-group-heading-v860";
        h.dataset.groupType=type;
        h.textContent=groupLabel(type)+" ("+list.length+")";
        grid.appendChild(h);
        list.forEach(n=>grid.appendChild(n));
      }
      setTimeout(()=>{suppressGroupingObserver=false},0);
    }    function setGroup(group){
      if(!["none","type"].includes(group))return false;
      prefs.group=group;
      saveState();
      applyGrouping();
      return true;
    }

    viewButton.onclick=e=>{
      showContext(e.clientX,e.clientY,[
        ["Ícones grandes",()=>applyMode("large")],
        ["Ícones médios",()=>applyMode("medium")],
        ["Ícones pequenos",()=>applyMode("small")],
        ["Detalhes",()=>applyMode("details")]
      ]);
    };
    groupButton.onclick=e=>{
      showContext(e.clientX,e.clientY,[
        ["Nenhum",()=>setGroup("none")],
        ["Tipo",()=>setGroup("type")]
      ]);
    };

    const observer=new MutationObserver(()=>{if(!suppressGroupingObserver)setTimeout(applyGrouping,0)});
    observer.observe(gridHost,{childList:true,subtree:true});

    const api=Object.freeze({
      setView:applyMode,setGroup,
      getView:()=>prefs.mode,getGroup:()=>prefs.group,
      refresh:()=>{applyMode(prefs.mode,false);applyGrouping()}
    });
    wrap.__explorerViewsV860=api;
    if(win)win.__explorerViewsV860=api;

    applyMode(prefs.mode,false);
    setTimeout(applyGrouping,40);

    const cleanup=setInterval(()=>{
      if(wrap.isConnected)return;
      clearInterval(cleanup);
      observer.disconnect();
    },1000);
  }

  globalThis.buildExplorerV5=function(wrap,win,startPath){
    previousBuildExplorer(wrap,win,startPath);
    installViews(wrap,win);
  };
  try{buildExplorerV5=globalThis.buildExplorerV5}catch{}

  globalThis.Win11ExplorerViews=Object.freeze({
    version:"8.6.0",installViews
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"8.6.0",step:19,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-view-large","explorer-view-medium","explorer-view-small",
      "explorer-view-details","explorer-group-by-type","explorer-view-profile-state"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();