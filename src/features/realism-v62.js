"use strict";
/* Windows 11 Simulator V6.2 — Realism Layer */
(function installRealismLayer(){
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  function svg(body, viewBox="0 0 32 32"){
    return '<svg viewBox="'+viewBox+'" aria-hidden="true" focusable="false">'+body+'</svg>';
  }

  const icons = {
    explorer: () => svg('<path fill="#f6c344" d="M3 8.5A2.5 2.5 0 0 1 5.5 6H13l2.2 2.5H26.5A2.5 2.5 0 0 1 29 11v13.5A2.5 2.5 0 0 1 26.5 27h-21A2.5 2.5 0 0 1 3 24.5z"/><path fill="#ffd766" d="M3.4 12h25.2l-2 12.7A2.7 2.7 0 0 1 24 27H5.5A2.5 2.5 0 0 1 3 24.5z"/>'),
    edge: () => svg('<defs><linearGradient id="e1" x1="4" y1="4" x2="28" y2="28"><stop stop-color="#0ac5b5"/><stop offset=".52" stop-color="#0a8de6"/><stop offset="1" stop-color="#2158d8"/></linearGradient></defs><path fill="url(#e1)" d="M27.7 18.1c-.8 6.1-5.9 10.7-12.2 10.7C8.6 28.8 3 23.2 3 16.3 3 9.5 8.3 4 15.1 3.8c5.2-.2 9.7 2.8 11.6 7.2-3.3-2.6-8.5-3.1-12.2-1-2.5 1.4-4 3.5-4.4 5.8 2.8-2.5 7-3.2 10.5-1.8 2.1.8 4.1 2.3 7.1 4.1z"/><path fill="#fff" opacity=".8" d="M10.1 15.8c.5 4.2 3.8 6.8 7.8 6.8 3 0 5.8-1.5 7.3-3.8-2 .7-4.3.3-6-1-3-2.2-6.4-2.7-9.1-2z"/>'),
    settings: () => svg('<circle cx="16" cy="16" r="6" fill="#768391"/><path fill="#94a0ac" d="M14 2h4l.8 4a11 11 0 0 1 2.4 1l3.4-2.2 2.8 2.8-2.2 3.4c.5.8.8 1.6 1 2.4l4 .8v4l-4 .8a11 11 0 0 1-1 2.4l2.2 3.4-2.8 2.8-3.4-2.2c-.8.5-1.6.8-2.4 1l-.8 4h-4l-.8-4a11 11 0 0 1-2.4-1l-3.4 2.2-2.8-2.8 2.2-3.4a11 11 0 0 1-1-2.4l-4-.8v-4l4-.8c.2-.8.5-1.6 1-2.4L4.6 7.6l2.8-2.8L10.8 7c.8-.5 1.6-.8 2.4-1zM16 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>'),
    recycle: () => svg('<path fill="#e9f2f7" stroke="#5b8aa3" stroke-width="1.4" d="M8 9h16l-1.3 18H9.3z"/><path fill="#5b8aa3" d="M7 6h18v3H7zm5-3h8l1 3H11z"/><path stroke="#71a8c4" stroke-width="1.5" d="M13 12v11m6-11v11"/>'),
    notepad: () => svg('<rect x="5" y="3" width="22" height="26" rx="2.5" fill="#f7fbff" stroke="#4a93ca"/><path stroke="#4a93ca" stroke-width="1.6" d="M10 10h12M10 15h12M10 20h9M10 25h7"/><path fill="#7fc8f1" d="M8 2h3v4H8zm7 0h3v4h-3zm7 0h3v4h-3z"/>'),
    calc: () => svg('<rect x="5" y="3" width="22" height="26" rx="3" fill="#4a5563"/><rect x="8" y="6" width="16" height="6" rx="1.2" fill="#d9eef7"/><g fill="#eef2f5"><rect x="8" y="15" width="4" height="4" rx="1"/><rect x="14" y="15" width="4" height="4" rx="1"/><rect x="20" y="15" width="4" height="4" rx="1"/><rect x="8" y="21" width="4" height="4" rx="1"/><rect x="14" y="21" width="4" height="4" rx="1"/></g><rect x="20" y="21" width="4" height="4" rx="1" fill="#59b7e9"/>'),
    terminal: () => svg('<rect x="3" y="5" width="26" height="22" rx="3" fill="#17191d"/><path fill="none" stroke="#f3f5f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m8 11 4 4-4 4m7 1h8"/>'),
    taskmanager: () => svg('<rect x="4" y="4" width="24" height="24" rx="3" fill="#eaf5fb" stroke="#4396cb"/><path fill="none" stroke="#1678b8" stroke-width="2" d="M8 22v-5l4-3 3 2 4-7 5 3"/>'),
    security: () => svg('<path fill="#2088cf" d="M16 3 27 7v7c0 7.3-4.6 12.1-11 15C9.6 26.1 5 21.3 5 14V7z"/><path fill="#fff" d="m10.8 15.7 3.2 3.2 7.4-7.4 1.8 1.8-9.2 9.2-5-5z"/>'),
    paint: () => svg('<path fill="#f2c46d" d="M16 3C8.8 3 3 8.4 3 15c0 4.7 3 8.5 7.4 9.8 1.7.5 2.9-.2 3.2-1.4.3-1.2-.5-2.2-.2-3.1.4-1.1 1.7-1.2 3.1-1 6.9 1 12.5-1.9 12.5-7.2C29 6.8 23.1 3 16 3z"/><circle cx="9" cy="12" r="2" fill="#e84d5b"/><circle cx="14" cy="8" r="2" fill="#4f9be3"/><circle cx="20" cy="8.5" r="2" fill="#54b86a"/><circle cx="24" cy="13" r="2" fill="#8d67cf"/>'),
    photos: () => svg('<rect x="3" y="4" width="26" height="24" rx="3" fill="#3b87d0"/><circle cx="11" cy="11" r="3" fill="#ffd54f"/><path fill="#dff2ff" d="m5 25 7-8 4 4 4-5 7 9z"/>'),
    store: () => svg('<path fill="#f7f9fb" stroke="#3e7ca6" stroke-width="1.5" d="M5 10h22v18H5z"/><path fill="none" stroke="#3e7ca6" stroke-width="2" d="M11 10V8a5 5 0 0 1 10 0v2"/><path fill="#168ed4" d="M12 14h4v4h-4zm5 0h4v4h-4zm-5 5h4v4h-4zm5 0h4v4h-4z"/>'),
    clock: () => svg('<circle cx="16" cy="16" r="13" fill="#e9f5fb" stroke="#3990c7" stroke-width="2"/><path stroke="#2479ad" stroke-width="2" stroke-linecap="round" d="M16 8v9l6 3"/>'),
    powershell: () => svg('<rect x="3" y="5" width="26" height="22" rx="3" fill="#1d70b7"/><path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m8 11 6 5-6 5m8 1h8"/>'),
    default: () => svg('<rect x="4" y="4" width="24" height="24" rx="4" fill="#5d91b8"/><path fill="#fff" opacity=".92" d="M9 9h5v5H9zm9 0h5v5h-5zM9 18h5v5H9zm9 0h5v5h-5z"/>')
  };

  function iconFor(appId, extra=""){
    const fn=icons[appId]||icons.default;
    return '<span class="real-app-icon '+extra+'" data-real-icon="'+esc(appId)+'">'+fn()+'</span>';
  }

  function findAppIdByName(name){
    const match=Object.entries(APPS).find(([,a])=>a.name===name);
    return match ? match[0] : "default";
  }

  populateDesktop=function(){
    const d=$("#desktop-icons");d.innerHTML="";
    [
      ["explorer","Este PC","This PC"],
      ["explorer","Documentos","C:/Documents"],
      ["edge","Microsoft Edge",null],
      ["recycle","Reciclagem",null]
    ].forEach(([app,label,path])=>{
      const b=document.createElement("button");
      b.className="desktop-icon";
      b.dataset.app=app;
      b.innerHTML=iconFor(app)+'<span class="label">'+esc(label)+'</span>';
      const launch=()=>openApp(app,path||undefined);
      b.addEventListener("dblclick",launch);
      let last=0;
      b.addEventListener("click",()=>{
        $$(".desktop-icon").forEach(x=>x.classList.remove("selected"));
        b.classList.add("selected");
        const now=Date.now();
        if(now-last<420)launch();
        last=now;
      });
      d.appendChild(b);
    });
  };

  let startAllApps=false;
  function renderStartApps(showAll=false){
    const g=$("#start-grid");g.innerHTML="";
    const priority=["edge","explorer","notepad","calc","settings","store","photos","paint","terminal","taskmanager","security","clock","stickynotes","onedrive","mediaplayer","snipping","powershell","windowstools"];
    const pinned=priority.filter(k=>APPS[k]).slice(0,18);
    const keys=showAll
      ? Object.keys(APPS).sort((a,b)=>APPS[a].name.localeCompare(APPS[b].name,"pt"))
      : pinned;
    keys.forEach(k=>{
      const a=APPS[k];
      const b=document.createElement("button");
      b.className="start-app";
      b.dataset.app=k;
      b.innerHTML=iconFor(k)+'<span>'+esc(a.name)+'</span>';
      b.addEventListener("click",()=>{openApp(k);closeOverlays()});
      g.appendChild(b);
    });
    const title=$("#start-menu .section-head h3");
    const all=$("#all-apps-btn");
    if(title)title.textContent=showAll?"Todas as aplicações":"Afixadas";
    if(all)all.textContent=showAll?"‹ Voltar":"Todas as aplicações ›";
    const rec=$("#start-menu .start-recommended");
    if(rec)rec.style.display=showAll?"none":"";
  }

  populateStart=function(){
    startAllApps=false;
    renderStartApps(false);
  };

  const allAppsButton=$("#all-apps-btn");
  if(allAppsButton){
    allAppsButton.onclick=e=>{
      e.stopPropagation();
      startAllApps=!startAllApps;
      renderStartApps(startAllApps);
    };
  }

  createTaskButton=function(win){
    const a=APPS[win.dataset.app],b=document.createElement("button");
    b.className="task-btn running";
    b.dataset.window=win.dataset.id;
    b.dataset.app=win.dataset.app;
    b.innerHTML=iconFor(win.dataset.app,"task-icon");
    b.title=a.name;
    b.setAttribute("aria-label",a.name);
    b.addEventListener("click",()=>{
      if(win.classList.contains("hidden")){win.classList.remove("hidden");focusWindow(win)}
      else if(win.classList.contains("focused"))minimizeWindow(win);
      else focusWindow(win);
    });
    $("#task-center").appendChild(b);
    updateTaskbar();
  };

  function decorateWindow(win){
    if(!win || win.dataset.realismDecorated==="1")return;
    win.dataset.realismDecorated="1";
    win.classList.add("win-enter");
    const titleIcon=win.querySelector(".win-title span:first-child");
    if(titleIcon)titleIcon.outerHTML=iconFor(win.dataset.app||"default");
    const min=win.querySelector(".win-control.min"),max=win.querySelector(".win-control.max"),close=win.querySelector(".win-control.close");
    if(min){min.textContent="—";min.setAttribute("aria-label","Minimizar")}
    if(max){max.textContent="□";max.setAttribute("aria-label","Maximizar")}
    if(close){close.textContent="×";close.setAttribute("aria-label","Fechar")}
    setTimeout(()=>win.classList.remove("win-enter"),220);
  }

  function decorateSearch(root=document){
    root.querySelectorAll?.(".search-result").forEach(result=>{
      const slot=result.querySelector(".sr-icon");
      const strong=result.querySelector("strong");
      if(!slot||!strong||slot.dataset.realized==="1")return;
      slot.dataset.realized="1";
      const appId=findAppIdByName(strong.textContent.trim());
      if(appId!=="default")slot.innerHTML=iconFor(appId,"task-icon");
    });
  }

  function setupTray(){
    const quick=$("#quick-btn");
    if(quick){
      quick.innerHTML='<span class="win11-tray"><span class="tray-glyph" title="Rede">'+svg('<path fill="currentColor" d="M3 19a18 18 0 0 1 26 0l-2.3 2.2a14.8 14.8 0 0 0-21.4 0zM8 23a11 11 0 0 1 16 0l-2.3 2.2a7.8 7.8 0 0 0-11.4 0zM13 27a4.2 4.2 0 0 1 6 0l-3 3z"/>')+'</span><span class="tray-glyph" title="Volume">'+svg('<path fill="currentColor" d="M5 13h6l6-5v16l-6-5H5zm15-2a8 8 0 0 1 0 10l2 1.6a10.6 10.6 0 0 0 0-13.2z"/>')+'</span><span class="tray-glyph" title="Bateria 82%">'+svg('<rect x="4" y="9" width="22" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="27" y="13" width="2" height="6" rx="1" fill="currentColor"/><rect x="7" y="12" width="15" height="8" rx="1" fill="currentColor"/>')+'</span></span>';
      quick.setAttribute("aria-label","Rede, volume e bateria");
    }
    const search=$("#search-btn");
    if(search){
      search.innerHTML='<span class="tray-glyph">'+svg('<circle cx="14" cy="14" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m19.5 19.5 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>')+'</span>';
      search.setAttribute("aria-label","Pesquisar");
    }
    const taskview=$("#taskview-btn");
    if(taskview){
      taskview.innerHTML='<span class="tray-glyph">'+svg('<rect x="5" y="8" width="13" height="16" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="5" width="13" height="16" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/>')+'</span>';
      taskview.setAttribute("aria-label","Vista de tarefas");
    }
    const notify=$("#notify-btn");
    if(notify){
      notify.innerHTML='<span class="tray-glyph">'+svg('<path fill="currentColor" d="M16 3a6 6 0 0 0-6 6v3.5c0 3-1.1 5.2-3 7.5h18c-1.9-2.3-3-4.5-3-7.5V9a6 6 0 0 0-6-6zm-3 20a3 3 0 0 0 6 0z"/>')+'</span>';
    }
    const widgets=$("#widgets-btn");
    if(widgets)widgets.innerHTML='<span style="font-size:18px">☁</span><span><strong style="font-size:12px;font-weight:500">22°</strong><br><small style="font-size:9px">Parcialmente nublado</small></span>';
  }

  const observer=new MutationObserver(mutations=>{
    for(const m of mutations){
      for(const node of m.addedNodes){
        if(!(node instanceof Element))continue;
        if(node.matches?.(".window"))decorateWindow(node);
        node.querySelectorAll?.(".window").forEach(decorateWindow);
      }
    }
    decorateSearch(document);
  });
  observer.observe(document.body,{childList:true,subtree:true});

  populateDesktop();
  populateStart();
  setupTray();
  $$(".window").forEach(decorateWindow);
  decorateSearch(document);

  document.documentElement.dataset.simVersion="6.6.0";
  globalThis.Win11Realism={
    version:"6.6.0",
    iconFor,
    refresh(){populateDesktop();populateStart();setupTray();$$(".window").forEach(decorateWindow);decorateSearch(document)}
  };
})();


