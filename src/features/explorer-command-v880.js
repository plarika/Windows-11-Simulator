"use strict";
(function installExplorerCommandV880(){
  const previousBuildExplorer=globalThis.buildExplorerV5;
  if(typeof previousBuildExplorer!=="function")throw new Error("Explorer must load before Explorer Command V8.8.");

  function ensureCommandState(){
    if(!state.explorerCommandV88||typeof state.explorerCommandV88!=="object"){
      state.explorerCommandV88={checkboxes:false};
    }
    state.explorerCommandV88.checkboxes=!!state.explorerCommandV88.checkboxes;
    return state.explorerCommandV88;
  }

  function installCommand(wrap,win){
    if(!wrap||wrap.dataset.explorerCommandV880==="1")return;
    wrap.dataset.explorerCommandV880="1";
    wrap.classList.add("explorer-command-v880");
    const command=wrap.querySelector(".explorer-command");
    const filesHost=wrap.querySelector(".explorer-files");
    if(!command||!filesHost)return;
    const prefs=ensureCommandState();

    const selectButton=document.createElement("button");
    selectButton.dataset.selectV880="";
    selectButton.innerHTML='<span class="cmd-icon">☑</span><span class="cmd-label">Selecionar</span>';
    selectButton.title="Selecionar";
    const overflow=document.createElement("button");
    overflow.dataset.overflowV880="";
    overflow.className="explorer-command-overflow-v880";
    overflow.innerHTML='<span class="cmd-icon">•••</span><span class="cmd-label">Mais</span>';
    overflow.title="Mais opções";
    const spacer=[...command.children].find(x=>x.tagName==="SPAN"&&String(x.getAttribute("style")||"").includes("flex"));
    command.insertBefore(selectButton,spacer||null);
    command.appendChild(overflow);

    const pill=document.createElement("span");
    pill.className="explorer-selection-pill-v880";
    pill.hidden=true;
    command.appendChild(pill);

    function itemNodes(){
      return [...wrap.querySelectorAll(".file,.file-row:not(.header)")];
    }

    function selectedNodes(){
      return itemNodes().filter(x=>x.classList.contains("selected"));
    }

    function updateSelectionState(){
      const selected=selectedNodes();
      pill.hidden=!selected.length;
      pill.textContent=selected.length+" selecionado"+(selected.length===1?"":"s");
      wrap.classList.toggle("has-selection-v880",selected.length>0);
      for(const node of itemNodes()){
        const cb=node.querySelector(".explorer-select-checkbox-v880");
        if(cb)cb.checked=node.classList.contains("selected");
      }
    }

    function decorateCheckboxes(){
      if(wrap.classList.contains("real-mount-mode"))return;
      for(const node of itemNodes()){
        if(node.querySelector(".explorer-select-checkbox-v880"))continue;
        const cb=document.createElement("input");
        cb.type="checkbox";
        cb.className="explorer-select-checkbox-v880";
        cb.tabIndex=-1;
        cb.setAttribute("aria-label","Selecionar "+(node.dataset.v740Name||"item"));
        cb.checked=node.classList.contains("selected");
        cb.onclick=e=>e.stopPropagation();
        cb.onchange=e=>{
          e.stopPropagation();
          const selected=node.classList.contains("selected");
          if(cb.checked!==selected){
            node.dispatchEvent(new MouseEvent("click",{bubbles:true,ctrlKey:true}));
          }
          updateSelectionState();
        };
        node.appendChild(cb);
      }
      updateSelectionState();
    }

    function setCheckboxes(enabled,persist=true){
      prefs.checkboxes=!!enabled;
      wrap.classList.toggle("checkbox-selection-v880",prefs.checkboxes);
      if(prefs.checkboxes)decorateCheckboxes();
      if(persist)saveState();
      return prefs.checkboxes;
    }    function selectAll(){
      if(wrap.classList.contains("real-mount-mode"))return false;
      focusWindow(win);
      document.dispatchEvent(new KeyboardEvent("keydown",{key:"a",ctrlKey:true,bubbles:true}));
      setTimeout(updateSelectionState,20);
      return true;
    }

    function clearSelection(){
      if(wrap.classList.contains("real-mount-mode"))return false;
      focusWindow(win);
      document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
      setTimeout(updateSelectionState,20);
      return true;
    }

    selectButton.onclick=e=>{
      showContext(e.clientX,e.clientY,[
        [prefs.checkboxes?"Ocultar caixas de seleção":"Mostrar caixas de seleção",()=>setCheckboxes(!prefs.checkboxes)],
        ["Selecionar tudo",selectAll],
        ["Desmarcar tudo",clearSelection]
      ]);
    };

    overflow.onclick=e=>{
      const menu=[
        ["Propriedades",()=>wrap.querySelector("[data-properties-v740]")?.click()],
        ["Painel de detalhes",()=>wrap.__explorerDetailsV840?.toggle?.()],
        ["Ordenar",()=>wrap.querySelector("[data-sort]")?.click()],
        ["Ver: Ícones médios",()=>wrap.__explorerViewsV860?.setView?.("medium")],
        ["Ver: Detalhes",()=>wrap.__explorerViewsV860?.setView?.("details")],
        ["Alternar agrupamento",()=>{
          const api=wrap.__explorerViewsV860;
          if(api)api.setGroup(api.getGroup()==="type"?"none":"type");
        }],
        ["Modo compacto lateral",()=>wrap.__explorerSidebarV870?.toggleCompact?.()]
      ];
      showContext(e.clientX,e.clientY,menu);
    };

    function applyResponsive(width){
      const w=Number(width)||wrap.getBoundingClientRect().width;
      wrap.classList.toggle("command-compact-v880",w<760);
      wrap.classList.toggle("command-tight-v880",w<610);
    }

    let resizeObserver=null;
    if("ResizeObserver" in window){
      resizeObserver=new ResizeObserver(entries=>{
        const width=entries[0]?.contentRect?.width;
        applyResponsive(width);
      });
      resizeObserver.observe(wrap);
    }else{
      window.addEventListener("resize",()=>applyResponsive(),{passive:true});
    }

    let selectionTimer=0;
    const observer=new MutationObserver(()=>{
      clearTimeout(selectionTimer);
      selectionTimer=setTimeout(()=>{
        if(prefs.checkboxes)decorateCheckboxes();
        updateSelectionState();
      },0);
    });
    observer.observe(filesHost,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});    setCheckboxes(prefs.checkboxes,false);
    applyResponsive();
    updateSelectionState();

    const api=Object.freeze({
      setCheckboxes,toggleCheckboxes:()=>setCheckboxes(!prefs.checkboxes),
      selectAll,clearSelection,
      getState:()=>({...prefs}),
      getSelectedCount:()=>selectedNodes().length,
      refresh:()=>{if(prefs.checkboxes)decorateCheckboxes();updateSelectionState();applyResponsive()}
    });
    wrap.__explorerCommandV880=api;
    if(win)win.__explorerCommandV880=api;

    const cleanup=setInterval(()=>{
      if(wrap.isConnected)return;
      clearInterval(cleanup);
      clearTimeout(selectionTimer);
      observer.disconnect();
      resizeObserver?.disconnect();
    },1000);
  }

  globalThis.buildExplorerV5=function(wrap,win,startPath){
    previousBuildExplorer(wrap,win,startPath);
    installCommand(wrap,win);
  };
  try{buildExplorerV5=globalThis.buildExplorerV5}catch{}

  globalThis.Win11ExplorerCommand=Object.freeze({version:"8.8.0",installCommand});
  globalThis.Win11RealFunctions=Object.freeze({
    version:"8.8.0",step:21,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-adaptive-command-bar","explorer-command-overflow",
      "explorer-checkbox-selection","explorer-selection-indicator",
      "explorer-selection-profile-state","explorer-selection-mount-guard"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();