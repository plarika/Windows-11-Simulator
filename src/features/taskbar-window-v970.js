"use strict";
(function installTaskbarWindowV970(){
  const VERSION="9.7.0";
  const layer=document.getElementById("window-layer"),taskCenter=document.getElementById("task-center");
  if(!layer||!taskCenter)return;
  const installed=new WeakSet(),progressByWindow=new Map();
  let refreshPending=false,groupPanel=null;

  function realWindows(){
    return [...layer.children].filter(n=>n.classList?.contains("window"));
  }
  function desktopIndex(){return Number(state.currentDesktop)||0}
  function windowsForApp(appId,index=desktopIndex()){
    return realWindows().filter(w=>w.dataset.app===appId&&Number(w.dataset.desktop||0)===index);
  }
  function winById(id){return realWindows().find(w=>w.dataset.id===id)||null}
  function ensureState(){
    if(!state.windowManagerV97||typeof state.windowManagerV97!=="object")state.windowManagerV97={placements:{}};
    const s=state.windowManagerV97;
    if(!s.placements||typeof s.placements!=="object")s.placements={};
    return s;
  }
  function placementKey(win){
    const peers=windowsForApp(win.dataset.app,Number(win.dataset.desktop||0));
    const slot=Math.max(0,peers.indexOf(win));
    return [win.dataset.desktop||"0",win.dataset.app||"app",slot].join("|");
  }
  function rectOf(win){
    const number=(value,fallback)=>{
      const n=Number.parseFloat(String(value||""));
      return Number.isFinite(n)?n:fallback;
    };
    return {
      left:number(win.style.left,win.offsetLeft),
      top:number(win.style.top,win.offsetTop),
      width:number(win.style.width,win.offsetWidth),
      height:number(win.style.height,win.offsetHeight),
      updatedAt:Date.now()
    };
  }
  function savePlacement(win){
    if(!win?.isConnected||isMobile?.()||win.classList.contains("maximized")||win.classList.contains("wm-snapped"))return false;
    const r=rectOf(win);
    if(r.width<280||r.height<200)return false;
    const s=ensureState();s.placements[placementKey(win)]=r;
    const entries=Object.entries(s.placements);
    if(entries.length>60){
      entries.sort((a,b)=>(Number(b[1]?.updatedAt)||0)-(Number(a[1]?.updatedAt)||0));
      const keep=new Set(entries.slice(0,60).map(([k])=>k));
      for(const k of Object.keys(s.placements))if(!keep.has(k))delete s.placements[k];
    }
    saveState();return true;
  }
  function applyPlacement(win){
    if(isMobile?.())return false;
    const p=ensureState().placements[placementKey(win)];
    if(!p)return false;
    const width=Math.max(300,Math.min(Number(p.width)||700,innerWidth-12));
    const height=Math.max(220,Math.min(Number(p.height)||500,innerHeight-76));
    const left=Math.max(0,Math.min(Number(p.left)||0,innerWidth-width));
    const top=Math.max(0,Math.min(Number(p.top)||0,innerHeight-height-66));
    Object.assign(win.style,{left:left+"px",top:top+"px",width:width+"px",height:height+"px"});
    return true;
  }  function safePreview(win){
    const host=document.createElement("div");host.className="taskbar-group-preview-image-v970";
    const clone=win.cloneNode(true);
    clone.querySelectorAll("[id]").forEach(n=>n.removeAttribute("id"));
    clone.querySelectorAll("iframe,video,audio,canvas").forEach(n=>{
      const p=document.createElement("div");p.className="taskbar-group-media-v970";p.textContent="Pré-visualização";n.replaceWith(p);
    });
    clone.querySelectorAll("input,textarea,select,button,a,[contenteditable]").forEach(n=>{
      n.setAttribute("tabindex","-1");n.style.pointerEvents="none";n.removeAttribute("autofocus");
    });
    clone.classList.remove("focused","hidden","maximized");
    clone.classList.add("taskbar-group-preview-clone-v970");
    clone.style.left="0";clone.style.top="0";
    clone.style.width=(win.offsetWidth||700)+"px";clone.style.height=(win.offsetHeight||500)+"px";
    clone.style.transformOrigin="top left";
    host.appendChild(clone);
    requestAnimationFrame(()=>{
      if(!host.isConnected)return;
      const r=host.getBoundingClientRect();
      const scale=Math.min(r.width/(win.offsetWidth||700),r.height/(win.offsetHeight||500));
      clone.style.transform="scale("+Math.max(.08,scale)+")";
    });
    return host;
  }
  function ensureGroupPanel(){
    if(groupPanel?.isConnected)return groupPanel;
    groupPanel=document.createElement("section");
    groupPanel.id="taskbar-group-v970";
    groupPanel.className="taskbar-group-v970";
    document.getElementById("app").appendChild(groupPanel);
    groupPanel.addEventListener("pointerdown",e=>e.stopPropagation());
    return groupPanel;
  }
  function hideGroup(){groupPanel?.classList.remove("open")}
  function showGroup(appId,anchor){
    const wins=windowsForApp(appId);if(wins.length<2)return false;
    const panel=ensureGroupPanel(),app=APPS[appId]||{};
    panel.innerHTML='<header><div><strong>'+escapeHTML(app.name||appId)+'</strong><span>'+wins.length+' janelas</span></div>'+
      '<div class="taskbar-group-actions-v970"><button data-min-all>Minimizar todas</button><button data-restore-all>Restaurar todas</button><button data-close-all>Fechar todas</button></div></header>'+
      '<div class="taskbar-group-list-v970"></div>';
    const list=panel.querySelector(".taskbar-group-list-v970");
    for(const win of wins){
      const card=document.createElement("article");card.className="taskbar-group-card-v970"+(win.classList.contains("focused")?" active":"");
      const preview=safePreview(win);
      const title=win.querySelector(".win-title span:last-child")?.textContent||app.name||appId;
      card.innerHTML='<button data-focus><div data-preview></div><footer><strong>'+escapeHTML(title)+'</strong><span>'+(win.classList.contains("hidden")?"Minimizada":"Aberta")+'</span></footer></button>'+
        '<button data-close title="Fechar">×</button>';
      card.querySelector("[data-preview]").replaceWith(preview);
      card.querySelector("[data-focus]").onclick=()=>{win.classList.remove("hidden");focusWindow(win);hideGroup()};
      card.querySelector("[data-close]").onclick=e=>{e.stopPropagation();closeWindow(win);setTimeout(()=>{refreshGroups();showGroup(appId,anchor)},25)};
      list.appendChild(card);
    }
    panel.querySelector("[data-min-all]").onclick=()=>{wins.forEach(w=>minimizeWindow(w));hideGroup()};
    panel.querySelector("[data-restore-all]").onclick=()=>{wins.forEach(w=>w.classList.remove("hidden"));wins.forEach(w=>focusWindow(w));hideGroup()};
    panel.querySelector("[data-close-all]").onclick=()=>{[...wins].forEach(w=>closeWindow(w));hideGroup()};
    panel.classList.add("open");
    const r=anchor.getBoundingClientRect();
    const pw=panel.getBoundingClientRect().width||420;
    panel.style.left=Math.max(8,Math.min(innerWidth-pw-8,r.left+r.width/2-pw/2))+"px";
    panel.style.bottom=Math.max(62,innerHeight-r.top+8)+"px";
    return true;
  }  function taskButtons(){
    return [...taskCenter.querySelectorAll(".task-btn[data-window]")];
  }
  function repairTaskButtons(){
    if(typeof globalThis.createTaskButton!=="function")return 0;
    let repaired=0;
    for(const win of realWindows()){
      if(!win.dataset.id)continue;
      const exists=taskCenter.querySelector('.task-btn[data-window="'+CSS.escape(win.dataset.id)+'"]');
      if(exists)continue;
      createTaskButton(win);repaired++;
    }
    return repaired;
  }
  function refreshGroupsNow(){
      repairTaskButtons();
      const buttons=taskButtons();
      const byApp=new Map();
      for(const b of buttons){
        const w=winById(b.dataset.window||"");
        if(!w||Number(w.dataset.desktop||0)!==desktopIndex())continue;
        if(!byApp.has(w.dataset.app))byApp.set(w.dataset.app,[]);
        byApp.get(w.dataset.app).push(b);
      }
      const leadByButton=new Map(),hidden=new Set();
      for(const [appId,group] of byApp){
        if(group.length<2||appId==="explorer")continue;
        leadByButton.set(group[0],{appId,count:group.length});
        group.slice(1).forEach(b=>hidden.add(b));
      }
      for(const b of buttons){
        const lead=leadByButton.get(b);
        b.classList.toggle("taskbar-group-lead-v970",!!lead);
        b.classList.toggle("taskbar-group-hidden-v970",hidden.has(b));
        let badge=b.querySelector(".taskbar-group-badge-v970");
        if(lead){
          const count=String(lead.count);
          if(b.dataset.taskbarGroupCount!==count)b.dataset.taskbarGroupCount=count;
          if(b.dataset.taskbarGroupApp!==lead.appId)b.dataset.taskbarGroupApp=lead.appId;
          if(!badge){badge=document.createElement("span");badge.className="taskbar-group-badge-v970";b.appendChild(badge)}
          if(badge.textContent!==count)badge.textContent=count;
        }else{
          badge?.remove();
          if(b.hasAttribute("data-taskbar-group-count"))b.removeAttribute("data-taskbar-group-count");
          if(b.hasAttribute("data-taskbar-group-app"))b.removeAttribute("data-taskbar-group-app");
        }
      }
      refreshProgress();
  }
  function refreshGroups(){
    if(refreshPending)return;
    refreshPending=true;
    requestAnimationFrame(()=>{
      refreshPending=false;
      refreshGroupsNow();
    });
  }
  function refreshGroupsImmediate(){
    refreshPending=false;
    refreshGroupsNow();
    return true;
  }
  function syncButtonProgress(btn,desired){
    if(!btn)return;
    if(!desired){
      if(btn.classList.contains("task-progress-v970"))btn.classList.remove("task-progress-v970");
      if(btn.classList.contains("task-progress-paused-v970"))btn.classList.remove("task-progress-paused-v970");
      if(btn.style.getPropertyValue("--task-progress-v970"))btn.style.removeProperty("--task-progress-v970");
      if(btn.hasAttribute("data-task-progress"))btn.removeAttribute("data-task-progress");
      return;
    }
    const p=Math.max(0,Math.min(100,Number(desired.percent)||0)),value=p+"%";
    if(btn.style.getPropertyValue("--task-progress-v970")!==value)btn.style.setProperty("--task-progress-v970",value);
    btn.classList.toggle("task-progress-v970",true);
    btn.classList.toggle("task-progress-paused-v970",!!desired.paused);
    if(btn.dataset.taskProgress!==String(p))btn.dataset.taskProgress=String(p);
  }
  function refreshProgress(){
    const buttons=taskButtons(),desired=new Map();
    for(const btn of buttons){
      const win=winById(btn.dataset.window||"");if(!win)continue;
      const snap=progressByWindow.get(win.dataset.id);
      if(snap?.status==="running")desired.set(btn,{percent:snap.percent,paused:!!snap.paused});
    }
    const explorerLead=buttons.find(b=>b.classList.contains("explorer-task-group-lead-v930"));
    if(explorerLead){
      const active=windowsForApp("explorer").map(w=>progressByWindow.get(w.dataset.id)).filter(s=>s?.status==="running");
      if(active.length)desired.set(explorerLead,{
        percent:Math.round(active.reduce((n,s)=>n+(Number(s.percent)||0),0)/active.length),
        paused:active.some(s=>s.paused)
      });
    }
    buttons.forEach(btn=>syncButtonProgress(btn,desired.get(btn)||null));
  }  function installWindow(win){
    if(!win||installed.has(win))return;
    installed.add(win);win.dataset.taskbarWindowV970="1";
    setTimeout(()=>applyPlacement(win),0);
    win.addEventListener("explorer-operation-progress-v970",e=>{
      const snap=e.detail||{};
      progressByWindow.set(win.dataset.id,snap);refreshProgress();
      if(snap.status!=="running")setTimeout(()=>{
        const current=progressByWindow.get(win.dataset.id);
        if(current===snap||current?.id===snap.id)progressByWindow.delete(win.dataset.id);
        refreshProgress();
      },1200);
    });
    const cleanup=setInterval(()=>{
      if(win.isConnected)return;
      clearInterval(cleanup);progressByWindow.delete(win.dataset.id);refreshGroups();
    },1000);
  }

  taskCenter.addEventListener("click",e=>{
    const lead=e.target.closest(".task-btn.taskbar-group-lead-v970");
    if(!lead)return;
    e.preventDefault();e.stopImmediatePropagation();
    showGroup(lead.dataset.taskbarGroupApp,lead);
  },true);
  taskCenter.addEventListener("pointerover",e=>{
    const lead=e.target.closest(".task-btn.taskbar-group-lead-v970");
    if(!lead)return;
    e.stopPropagation();
  },true);
  document.addEventListener("pointerdown",e=>{
    if(!e.target.closest("#taskbar-group-v970,.taskbar-group-lead-v970"))hideGroup();
  },true);
  document.addEventListener("pointerup",()=>{
    realWindows().forEach(savePlacement);
  },true);

  const layerObs=new MutationObserver(records=>{
    for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&n.classList?.contains("window"))setTimeout(()=>installWindow(n),0);
    refreshGroups();
  });
  layerObs.observe(layer,{childList:true});
  const taskObs=new MutationObserver(refreshGroups);
  taskObs.observe(taskCenter,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});

  realWindows().forEach(installWindow);ensureState();refreshGroups();

  globalThis.Win11TaskbarWindowPro=Object.freeze({
    version:VERSION,refresh:refreshGroupsImmediate,showGroup,
    getGroups:()=>Object.fromEntries([...new Set(realWindows().map(w=>w.dataset.app))].map(app=>[app,windowsForApp(app).map(w=>w.dataset.id)])),
    getPlacement:win=>ensureState().placements[placementKey(win)]||null,
    savePlacement,applyPlacement,
    getProgress:()=>Object.fromEntries(progressByWindow),
    repairTaskButtons
  });
  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:30,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "taskbar-app-groups","taskbar-group-preview","taskbar-group-minimize-all",
      "taskbar-group-restore-all","taskbar-group-close-all","taskbar-operation-progress",
      "window-placement-persistence","window-placement-profile-state"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();