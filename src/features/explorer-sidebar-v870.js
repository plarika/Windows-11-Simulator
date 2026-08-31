"use strict";
(function installExplorerSidebarV870(){
  const previousBuildExplorer=globalThis.buildExplorerV5;
  if(typeof previousBuildExplorer!=="function")throw new Error("Explorer must load before Explorer Sidebar V8.7.");

  function ensureSidebarState(){
    if(!state.explorerSidebarV87||typeof state.explorerSidebarV87!=="object"){
      state.explorerSidebarV87={width:220,compact:false,quickCollapsed:false,placesCollapsed:false};
    }
    const s=state.explorerSidebarV87;
    s.width=Math.max(168,Math.min(320,Number(s.width)||220));
    s.compact=!!s.compact;
    s.quickCollapsed=!!s.quickCollapsed;
    s.placesCollapsed=!!s.placesCollapsed;
    return s;
  }

  function installSidebar(wrap,win){
    if(!wrap||wrap.dataset.explorerSidebarV870==="1")return;
    wrap.dataset.explorerSidebarV870="1";
    wrap.classList.add("explorer-sidebar-v870");
    const aside=wrap.querySelector("aside");
    if(!aside)return;
    const prefs=ensureSidebarState();
    aside.classList.add("explorer-sidebar-shell-v870");
    aside.setAttribute("role","tree");
    aside.style.setProperty("--explorer-sidebar-width",prefs.width+"px");
    wrap.style.setProperty("--explorer-sidebar-width",prefs.width+"px");

    const quick=aside.querySelector(".explorer-quick-access-v830");
    if(quick){
      quick.dataset.sidebarSection="quick";
      let title=quick.querySelector(".explorer-quick-title-v830");
      if(title){
        const b=document.createElement("button");
        b.className="explorer-sidebar-heading-v870";
        b.dataset.sidebarToggle="quick";
        b.innerHTML='<span>Acesso rápido</span><span aria-hidden="true">⌄</span>';
        title.replaceWith(b);
      }
    }

    const directItems=[...aside.children].filter(x=>x.classList?.contains("nav-item"));
    let places=aside.querySelector(".explorer-sidebar-places-v870");
    if(!places){
      places=document.createElement("section");
      places.className="explorer-sidebar-section-v870 explorer-sidebar-places-v870";
      places.dataset.sidebarSection="places";
      const heading=document.createElement("button");
      heading.className="explorer-sidebar-heading-v870";
      heading.dataset.sidebarToggle="places";
      heading.innerHTML='<span>Este PC</span><span aria-hidden="true">⌄</span>';
      const body=document.createElement("div");
      body.className="explorer-sidebar-section-body-v870";
      places.append(heading,body);
      aside.appendChild(places);
      directItems.forEach(x=>body.appendChild(x));
    }

    const compact=document.createElement("button");
    compact.className="explorer-sidebar-compact-v870";
    compact.dataset.sidebarCompact="";
    compact.title="Alternar barra lateral compacta";
    compact.setAttribute("aria-label","Alternar barra lateral compacta");
    compact.textContent="≡";
    aside.insertBefore(compact,aside.firstChild);

    const resize=document.createElement("div");
    resize.className="explorer-sidebar-resize-v870";
    resize.setAttribute("role","separator");
    resize.setAttribute("aria-orientation","vertical");
    resize.tabIndex=0;
    aside.appendChild(resize);    function decorateItems(){
      const labels={
        "This PC":["▦","Este PC"],"C:/Desktop":["▤","Ambiente de Trabalho"],
        "C:/Documents":["▤","Documentos"],"C:/Downloads":["↓","Transferências"],
        "C:/OneDrive":["☁","OneDrive"],"C:/Pictures":["▧","Imagens"],
        "C:/Music":["♪","Música"],"C:/Videos":["▶","Vídeos"],"Recycle Bin":["♲","Reciclagem"]
      };
      const items=[...aside.querySelectorAll(".nav-item,.explorer-quick-item-v830")];
      items.forEach((item,index)=>{
        if(item.classList.contains("nav-item")&&!item.dataset.sidebarDecorated){
          const data=labels[item.dataset.path];
          if(data){
            item.innerHTML='<span class="explorer-sidebar-icon-v870" aria-hidden="true">'+data[0]+'</span><span class="explorer-sidebar-label-v870">'+escapeHTML(data[1])+'</span>';
          }
          item.dataset.sidebarDecorated="1";
        }else if(item.classList.contains("explorer-quick-item-v830")){
          const spans=item.querySelectorAll("span");
          spans[0]?.classList.add("explorer-sidebar-icon-v870");
          spans[1]?.classList.add("explorer-sidebar-label-v870");
        }
        item.setAttribute("role","treeitem");
        item.tabIndex=index===0?0:-1;
        if(!item.title)item.title=item.dataset.path||item.textContent.trim();
      });
    }

    function applyState(persist=false){
      aside.style.setProperty("--explorer-sidebar-width",prefs.width+"px");
    wrap.style.setProperty("--explorer-sidebar-width",prefs.width+"px");
      wrap.classList.toggle("sidebar-compact-v870",prefs.compact);
      aside.querySelector('[data-sidebar-section="quick"]')?.classList.toggle("collapsed-v870",prefs.quickCollapsed);
      aside.querySelector('[data-sidebar-section="places"]')?.classList.toggle("collapsed-v870",prefs.placesCollapsed);
      aside.querySelectorAll("[data-sidebar-toggle]").forEach(b=>{
        const key=b.dataset.sidebarToggle;
        const collapsed=key==="quick"?prefs.quickCollapsed:prefs.placesCollapsed;
        b.setAttribute("aria-expanded",collapsed?"false":"true");
        b.querySelector("span:last-child").textContent=collapsed?"›":"⌄";
      });
      compact.classList.toggle("active",prefs.compact);
      if(persist)saveState();
      decorateItems();
    }

    function toggleSection(name){
      if(name==="quick")prefs.quickCollapsed=!prefs.quickCollapsed;
      else if(name==="places")prefs.placesCollapsed=!prefs.placesCollapsed;
      else return false;
      applyState(true);
      return true;
    }

    function setWidth(width){
      prefs.width=Math.max(168,Math.min(320,Math.round(Number(width)||220)));
      applyState(true);
      return prefs.width;
    }

    function toggleCompact(){
      prefs.compact=!prefs.compact;
      applyState(true);
      return prefs.compact;
    }

    aside.querySelectorAll("[data-sidebar-toggle]").forEach(b=>b.onclick=()=>toggleSection(b.dataset.sidebarToggle));
    compact.onclick=toggleCompact;

    let dragging=false;
    resize.onpointerdown=e=>{
      dragging=true;
      resize.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };
    resize.onpointermove=e=>{
      if(!dragging)return;
      const rect=wrap.getBoundingClientRect();
      prefs.width=Math.max(168,Math.min(320,e.clientX-rect.left));
      aside.style.setProperty("--explorer-sidebar-width",Math.round(prefs.width)+"px");
      wrap.style.setProperty("--explorer-sidebar-width",Math.round(prefs.width)+"px");
    };
    resize.onpointerup=e=>{
      if(!dragging)return;
      dragging=false;
      resize.releasePointerCapture?.(e.pointerId);
      prefs.width=Math.round(prefs.width);
      saveState();
    };
    resize.onkeydown=e=>{
      if(e.key==="ArrowLeft"){e.preventDefault();setWidth(prefs.width-12)}
      if(e.key==="ArrowRight"){e.preventDefault();setWidth(prefs.width+12)}
    };    aside.addEventListener("keydown",e=>{
      const items=[...aside.querySelectorAll('[role="treeitem"]')].filter(x=>x.offsetParent!==null);
      const current=e.target.closest?.('[role="treeitem"]');
      if(!current||!items.length)return;
      const index=items.indexOf(current);
      let next=-1;
      if(e.key==="ArrowDown")next=Math.min(items.length-1,index+1);
      if(e.key==="ArrowUp")next=Math.max(0,index-1);
      if(e.key==="Home")next=0;
      if(e.key==="End")next=items.length-1;
      if(next>=0){
        e.preventDefault();
        items.forEach(x=>x.tabIndex=-1);
        items[next].tabIndex=0;
        items[next].focus();
      }
      if(e.key==="Enter"||e.key===" "){e.preventDefault();current.click()}
    });

    const observer=new MutationObserver(()=>decorateItems());
    observer.observe(aside,{childList:true,subtree:true});
    applyState(false);

    const api=Object.freeze({
      setWidth,toggleCompact,toggleSection,
      getState:()=>({...prefs})
    });
    wrap.__explorerSidebarV870=api;
    if(win)win.__explorerSidebarV870=api;

    const cleanup=setInterval(()=>{
      if(wrap.isConnected)return;
      clearInterval(cleanup);
      observer.disconnect();
    },1000);
  }

  globalThis.buildExplorerV5=function(wrap,win,startPath){
    previousBuildExplorer(wrap,win,startPath);
    installSidebar(wrap,win);
  };
  try{buildExplorerV5=globalThis.buildExplorerV5}catch{}

  globalThis.Win11ExplorerSidebar=Object.freeze({version:"8.7.0",installSidebar});
  globalThis.Win11RealFunctions=Object.freeze({
    version:"8.7.0",step:20,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-sidebar-sections","explorer-sidebar-resize","explorer-sidebar-compact",
      "explorer-sidebar-keyboard","explorer-sidebar-profile-state"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();