"use strict";
/* Windows 11 Simulator V7.5 — Desktop & Window Manager 2.0 */
(function installWindowManagerV750(){
  const previousPopulateDesktop=globalThis.populateDesktop;
  const previousRenderTaskView=globalThis.renderTaskView;
  const previousApplySnap=globalThis.applySnap;
  const layer=document.getElementById("window-layer");
  const taskCenter=document.getElementById("task-center");
  const desktop=document.getElementById("desktop");
  const desktopIcons=document.getElementById("desktop-icons");
  if(!layer||!taskCenter||!desktop||!desktopIcons)throw new Error("Window manager shell missing.");

  const LAYOUTS=Object.freeze({
    halves:[
      {x:0,y:0,w:.5,h:1},{x:.5,y:0,w:.5,h:1}
    ],
    thirds:[
      {x:0,y:0,w:1/3,h:1},{x:1/3,y:0,w:1/3,h:1},{x:2/3,y:0,w:1/3,h:1}
    ],
    mainleft:[
      {x:0,y:0,w:2/3,h:1},{x:2/3,y:0,w:1/3,h:1}
    ],
    mainright:[
      {x:0,y:0,w:1/3,h:1},{x:1/3,y:0,w:2/3,h:1}
    ],
    quarters:[
      {x:0,y:0,w:.5,h:.5},{x:.5,y:0,w:.5,h:.5},
      {x:0,y:.5,w:.5,h:.5},{x:.5,y:.5,w:.5,h:.5}
    ],
    focusleft:[
      {x:0,y:0,w:.5,h:1},{x:.5,y:0,w:.5,h:.5},{x:.5,y:.5,w:.5,h:.5}
    ]
  });

  let altSession=null;
  let edgeDrag=null;
  let edgeHint=null;
  let snapAssist=null;
  let taskbarPreview=null;
  let taskbarPreviewTimer=null;
  let desktopDrag=null;

  function wmState(){
    const current=state.windowManagerV75&&typeof state.windowManagerV75==="object"?state.windowManagerV75:{};
    current.desktopIconPositions=current.desktopIconPositions&&typeof current.desktopIconPositions==="object"?current.desktopIconPositions:{};
    current.snapAssist=current.snapAssist!==false;
    current.taskbarPreviews=current.taskbarPreviews!==false;
    state.windowManagerV75=current;
    return current;
  }

  function sameDesktopWindows(index=Number(state.currentDesktop)||0){
    return $$(".window").filter(w=>Number(w.dataset.desktop||0)===index);
  }

  function visibleDesktopWindows(index=Number(state.currentDesktop)||0){
    return sameDesktopWindows(index).filter(w=>!w.classList.contains("hidden"));
  }

  function rectToJSON(win){
    return JSON.stringify({
      left:win.style.left,top:win.style.top,width:win.style.width,height:win.style.height
    });
  }

  function availableRect(){
    const gap=6;
    return {left:gap,top:gap,width:Math.max(300,innerWidth-gap*2),height:Math.max(220,innerHeight-74-gap)};
  }

  function clearSnapMeta(win){
    delete win.dataset.wmSnapLayout;
    delete win.dataset.wmSnapSlot;
    delete win.dataset.wmSnapGroup;
    win.classList.remove("wm-snapped");
  }

  function restoreFloating(win,e=null){
    if(win.classList.contains("maximized")){
      win.classList.remove("maximized");
      const prev=JSON.parse(win.dataset.prev||"{}");
      Object.assign(win.style,prev);
    }
    if(!win.dataset.wmSnapLayout)return;
    const prev=JSON.parse(win.dataset.wmPrevRect||"{}");
    clearSnapMeta(win);
    if(prev.left||prev.width)Object.assign(win.style,prev);
    if(e){
      const w=Math.min(win.offsetWidth||700,innerWidth-12);
      const h=Math.min(win.offsetHeight||500,innerHeight-76);
      win.style.width=w+"px";win.style.height=h+"px";
      win.style.left=clamp(e.clientX-w*.5,0,Math.max(0,innerWidth-w))+"px";
      win.style.top=clamp(e.clientY-22,0,Math.max(0,innerHeight-h-66))+"px";
    }
    refreshSnapGroups();
  }

  function applyLayoutSlot(win,layoutName,slotIndex,{assist=true}={}){
    const slots=LAYOUTS[layoutName];
    const slot=slots?.[Number(slotIndex)];
    if(!slot||!win)return false;
    if(!win.dataset.wmPrevRect&&!win.classList.contains("maximized"))win.dataset.wmPrevRect=rectToJSON(win);
    win.classList.remove("maximized","hidden");
    const area=availableRect();
    const innerGap=5;
    const left=area.left+Math.round(area.width*slot.x)+(slot.x>0?innerGap:0);
    const top=area.top+Math.round(area.height*slot.y)+(slot.y>0?innerGap:0);
    const width=Math.round(area.width*slot.w)-(slot.x+slot.w<.999?innerGap:0)-(slot.x>0?innerGap:0);
    const height=Math.round(area.height*slot.h)-(slot.y+slot.h<.999?innerGap:0)-(slot.y>0?innerGap:0);
    Object.assign(win.style,{left:left+"px",top:top+"px",width:Math.max(300,width)+"px",height:Math.max(220,height)+"px"});
    win.dataset.wmSnapLayout=layoutName;
    win.dataset.wmSnapSlot=String(slotIndex);
    win.classList.add("wm-snapped");
    focusWindow(win);
    refreshSnapGroups();
    if(assist&&wmState().snapAssist)showSnapAssist(win,layoutName);
    return true;
  }

  function applySnapV750(win,type){
    const map={
      left:["halves",0],right:["halves",1],
      tl:["quarters",0],tr:["quarters",1],bl:["quarters",2],br:["quarters",3]
    };
    const target=map[type];
    if(target)return applyLayoutSlot(win,target[0],target[1]);
    return previousApplySnap?.(win,type);
  }

  globalThis.applySnap=applySnapV750;
  try{applySnap=applySnapV750}catch{}

  function groupKey(win){
    if(!win.dataset.wmSnapLayout)return "";
    return String(win.dataset.desktop||0)+":"+win.dataset.wmSnapLayout;
  }

  function refreshSnapGroups(){
    const groups=new Map();
    for(const win of $$(".window")){
      const key=groupKey(win);
      if(!key){delete win.dataset.wmSnapGroup;continue}
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(win);
    }
    for(const [key,wins] of groups){
      const uniqueSlots=new Set(wins.map(w=>w.dataset.wmSnapSlot));
      if(wins.length>=2&&uniqueSlots.size>=2){
        const id="snap-"+key.replace(/[^a-z0-9]+/gi,"-");
        wins.forEach(w=>w.dataset.wmSnapGroup=id);
      }else wins.forEach(w=>delete w.dataset.wmSnapGroup);
    }
    return groups;
  }

  function snapGroupMembers(win){
    const id=win?.dataset.wmSnapGroup;
    if(!id)return win?[win]:[];
    return $$(".window").filter(w=>w.dataset.wmSnapGroup===id);
  }

  function focusGroup(win){
    const members=snapGroupMembers(win);
    members.forEach(w=>w.classList.remove("hidden"));
    members.sort((a,b)=>Number(a.dataset.wmSnapSlot||0)-Number(b.dataset.wmSnapSlot||0));
    members.forEach(w=>focusWindow(w));
    if(win)focusWindow(win);
  }

  function ensureSnapAssist(){
    if(snapAssist?.isConnected)return snapAssist;
    snapAssist=document.createElement("div");
    snapAssist.className="wm-snap-assist";
    snapAssist.innerHTML='<div class="wm-assist-head"><strong>Snap Assist</strong><button data-close>✕</button></div><div class="wm-assist-grid"></div>';
    snapAssist.querySelector("[data-close]").onclick=()=>snapAssist.classList.remove("open");
    document.getElementById("app").appendChild(snapAssist);
    return snapAssist;
  }

  function previewPlaceholderFor(el){
    const p=document.createElement("div");
    p.className="wm-preview-media";
    p.textContent=el.tagName==="IFRAME"?"Conteúdo Web":el.tagName==="VIDEO"?"Vídeo":el.tagName==="AUDIO"?"Áudio":"Pré-visualização";
    return p;
  }

  function scrubPreview(root){
    root.querySelectorAll("[id]").forEach(n=>n.removeAttribute("id"));
    root.querySelectorAll("iframe,video,audio,canvas").forEach(n=>n.replaceWith(previewPlaceholderFor(n)));
    root.querySelectorAll("input,textarea,select,button,a,[contenteditable]").forEach(n=>{
      n.removeAttribute("autofocus");
      n.setAttribute("tabindex","-1");
      n.style.pointerEvents="none";
    });
    root.querySelectorAll("[draggable]").forEach(n=>n.removeAttribute("draggable"));
    return root;
  }

  function buildWindowPreview(win,host){
    host.innerHTML="";
    const viewport=document.createElement("div");
    viewport.className="wm-preview-viewport";
    const clone=scrubPreview(win.cloneNode(true));
    clone.classList.remove("focused","hidden","maximized");
    clone.classList.add("wm-preview-clone");
    clone.style.left="0";clone.style.top="0";
    clone.style.width=(win.offsetWidth||700)+"px";
    clone.style.height=(win.offsetHeight||500)+"px";
    clone.style.transformOrigin="top left";
    viewport.appendChild(clone);
    host.appendChild(viewport);
    requestAnimationFrame(()=>{
      const rect=viewport.getBoundingClientRect();
      const scale=Math.min(rect.width/(win.offsetWidth||700),rect.height/(win.offsetHeight||500));
      clone.style.transform="scale("+Math.max(.08,scale)+")";
    });
  }

  function showSnapAssist(source,layoutName){
    const slots=LAYOUTS[layoutName]||[];
    const used=new Set(
      sameDesktopWindows().filter(w=>w.dataset.wmSnapLayout===layoutName).map(w=>Number(w.dataset.wmSnapSlot))
    );
    const empty=slots.map((_,i)=>i).filter(i=>!used.has(i));
    const candidates=sameDesktopWindows().filter(w=>w!==source&&!w.dataset.wmSnapLayout);
    if(!empty.length||!candidates.length)return;
    const panel=ensureSnapAssist(),grid=panel.querySelector(".wm-assist-grid");
    grid.innerHTML="";
    candidates.slice(0,8).forEach((w,i)=>{
      const card=document.createElement("button");
      card.className="wm-assist-card";
      card.innerHTML='<div class="wm-assist-preview"></div><span>'+escapeHTML(APPS[w.dataset.app]?.name||w.dataset.app)+'</span>';
      buildWindowPreview(w,card.querySelector(".wm-assist-preview"));
      card.onclick=()=>{
        applyLayoutSlot(w,layoutName,empty[Math.min(i,empty.length-1)],{assist:false});
        panel.classList.remove("open");
        refreshSnapGroups();
      };
      grid.appendChild(card);
    });
    panel.classList.add("open");
  }

  function snapLayoutMarkup(){
    const names=[
      ["halves","Metades"],["mainleft","Principal à esquerda"],["mainright","Principal à direita"],
      ["thirds","Três colunas"],["quarters","Quatro janelas"],["focusleft","Uma + duas"]
    ];
    return names.map(([name,label])=>{
      const cells=LAYOUTS[name].map((slot,i)=>
        '<button class="wm-layout-cell" data-wm-layout="'+name+'" data-wm-slot="'+i+'" style="left:'+(slot.x*100)+'%;top:'+(slot.y*100)+'%;width:'+(slot.w*100)+'%;height:'+(slot.h*100)+'%" title="'+escapeHTML(label)+'"></button>'
      ).join("");
      return '<div class="wm-layout-choice" title="'+escapeHTML(label)+'"><div class="wm-layout-mini">'+cells+'</div></div>';
    }).join("");
  }

  function decorateWindow(win){
    if(win.dataset.wmV750==="1")return;
    win.dataset.wmV750="1";
    const snap=win.querySelector(".snap-menu");
    if(snap){
      snap.classList.add("wm-snap-menu");
      snap.innerHTML='<div class="wm-layout-grid">'+snapLayoutMarkup()+'</div>';
      snap.querySelectorAll("[data-wm-layout]").forEach(cell=>{
        cell.addEventListener("click",e=>{
          e.stopPropagation();
          applyLayoutSlot(win,cell.dataset.wmLayout,Number(cell.dataset.wmSlot));
          snap.classList.remove("open");
        });
      });
    }

    const head=win.querySelector(".win-head");
    if(head){
      head.addEventListener("pointerdown",e=>{
        if(e.button!==0||e.target.closest("button")||isMobile())return;
        if(win.classList.contains("maximized")||win.dataset.wmSnapLayout)restoreFloating(win,e);
        edgeDrag={win,pointerId:e.pointerId};
      },true);
    }
  }

  function decorateAllWindows(){
    $$(".window").forEach(decorateWindow);
  }

  function ensureEdgeHint(){
    if(edgeHint?.isConnected)return edgeHint;
    edgeHint=document.createElement("div");
    edgeHint.className="wm-edge-hint";
    edgeHint.innerHTML='<div data-zone="left"></div><div data-zone="center"></div><div data-zone="right"></div>';
    document.getElementById("app").appendChild(edgeHint);
    return edgeHint;
  }

  function edgeTarget(x,y){
    const corner=34,edge=12;
    if(y<=corner&&x<=corner)return ["quarters",0];
    if(y<=corner&&x>=innerWidth-corner)return ["quarters",1];
    if(y>=innerHeight-74-corner&&x<=corner)return ["quarters",2];
    if(y>=innerHeight-74-corner&&x>=innerWidth-corner)return ["quarters",3];
    if(x<=edge)return ["halves",0];
    if(x>=innerWidth-edge)return ["halves",1];
    if(y<=edge)return ["maximize",0];
    return null;
  }

  document.addEventListener("pointermove",e=>{
    if(!edgeDrag)return;
    const target=edgeTarget(e.clientX,e.clientY);
    const hint=ensureEdgeHint();
    hint.classList.toggle("open",Boolean(target));
    hint.dataset.target=target?target[0]+":"+target[1]:"";
  },true);

  document.addEventListener("pointerup",e=>{
    if(!edgeDrag)return;
    const {win}=edgeDrag;
    edgeDrag=null;
    const target=edgeTarget(e.clientX,e.clientY);
    ensureEdgeHint().classList.remove("open");
    if(!target)return;
    if(target[0]==="maximize"){
      if(!win.classList.contains("maximized"))toggleMaximize(win);
      clearSnapMeta(win);refreshSnapGroups();
    }else applyLayoutSlot(win,target[0],target[1]);
  },true);

  function windowCandidates(){
    return sameDesktopWindows()
      .filter(w=>w.style.visibility!=="hidden")
      .sort((a,b)=>(Number(b.style.zIndex)||0)-(Number(a.style.zIndex)||0));
  }

  function renderAltTab(){
    const box=document.getElementById("alt-box");
    box.innerHTML="";
    altSession.wins.forEach((w,i)=>{
      const card=document.createElement("button");
      card.className="alt-card wm-alt-card"+(i===altSession.index?" active":"");
      card.dataset.id=w.dataset.id;
      card.innerHTML='<div class="wm-alt-preview"></div><footer><span>'+escapeHTML(APPS[w.dataset.app]?.icon||"□")+'</span><strong>'+escapeHTML(APPS[w.dataset.app]?.name||w.dataset.app)+'</strong></footer>';
      buildWindowPreview(w,card.querySelector(".wm-alt-preview"));
      box.appendChild(card);
    });
  }

  function showAltTabV750(){
    const overlay=document.getElementById("alt-tab");
    const wins=windowCandidates();
    if(!wins.length)return;
    if(!overlay.classList.contains("open")||!altSession){
      altSession={wins,index:wins.length>1?1:0};
    }else{
      altSession.index=(altSession.index+1)%altSession.wins.length;
    }
    renderAltTab();
    overlay.classList.add("open");
  }

  function commitAltTabV750(){
    const overlay=document.getElementById("alt-tab");
    const win=altSession?.wins?.[altSession.index];
    if(win){
      win.classList.remove("hidden");
      focusWindow(win);
    }
    overlay.classList.remove("open");
    altSession=null;
  }

  globalThis.showAltTab=showAltTabV750;
  globalThis.commitAltTab=commitAltTabV750;
  try{showAltTab=showAltTabV750;commitAltTab=commitAltTabV750}catch{}

  function renameDesktop(index){
    const current=state.desktops[index];
    if(current===undefined)return;
    const next=prompt("Nome do ambiente:",current);
    const clean=String(next||"").trim().slice(0,40);
    if(!clean||clean===current)return;
    state.desktops[index]=clean;
    saveState();renderTaskViewV750();
  }

  function moveWindowToDesktop(win,target){
    if(!win||target<0||target>=state.desktops.length)return;
    win.dataset.desktop=String(target);
    if(target!==Number(state.currentDesktop))win.style.visibility="hidden";
    else win.style.visibility="";
    refreshSnapGroups();
    updateTaskbar();
    renderTaskViewV750();
  }

  function closeDesktopV750(index){
    if(state.desktops.length<=1){notify("Vista de tarefas","Tem de existir pelo menos um ambiente.");return false}
    const target=index>0?index-1:1;
    sameDesktopWindows(index).forEach(win=>win.dataset.desktop=String(target>index?target-1:target));
    $$(".window").forEach(win=>{
      const d=Number(win.dataset.desktop||0);
      if(d>index)win.dataset.desktop=String(d-1);
    });
    state.desktops.splice(index,1);
    let current=Number(state.currentDesktop)||0;
    if(current===index)current=Math.min(index,state.desktops.length-1);
    else if(current>index)current--;
    state.currentDesktop=current;
    saveState();
    $$(".window").forEach(w=>w.style.visibility=Number(w.dataset.desktop||0)===current?"":"hidden");
    updateTaskbar();populateDesktopV750();renderTaskViewV750();refreshSnapGroups();
    return true;
  }

  function createDesktopV750(){
    state.desktops=Array.isArray(state.desktops)&&state.desktops.length?state.desktops:["Ambiente 1"];
    state.desktops.push("Ambiente "+(state.desktops.length+1));
    saveState();
    switchDesktop(state.desktops.length-1);
  }

  function taskWindowCard(win){
    const card=document.createElement("article");
    card.className="task-window-card wm-task-window-card";
    card.draggable=true;
    card.dataset.windowId=win.dataset.id;
    card.innerHTML=
      '<div class="wm-task-preview"></div>'+
      '<footer><strong><span>'+escapeHTML(APPS[win.dataset.app]?.icon||"□")+'</span>'+escapeHTML(APPS[win.dataset.app]?.name||win.dataset.app)+'</strong><button data-close title="Fechar">✕</button></footer>';
    buildWindowPreview(win,card.querySelector(".wm-task-preview"));
    card.onclick=e=>{
      if(e.target.closest("button"))return;
      document.getElementById("task-view").classList.remove("open");
      win.classList.remove("hidden");focusWindow(win);syncOverlayButtons();
    };
    card.querySelector("[data-close]").onclick=e=>{e.stopPropagation();closeWindow(win);renderTaskViewV750()};
    card.oncontextmenu=e=>{
      e.preventDefault();
      const menu=state.desktops.map((name,i)=>["Mover para "+name,()=>moveWindowToDesktop(win,i)]);
      showContext(e.clientX,e.clientY,menu);
    };
    card.ondragstart=e=>{
      e.dataTransfer.setData("application/x-win11-window",win.dataset.id);
      e.dataTransfer.effectAllowed="move";
    };
    return card;
  }

  function renderTaskViewV750(){
    const strip=document.getElementById("desktop-strip"),wins=document.getElementById("task-windows");
    strip.innerHTML="";wins.innerHTML="";
    state.desktops=Array.isArray(state.desktops)&&state.desktops.length?state.desktops:["Ambiente 1"];
    state.desktops.forEach((name,i)=>{
      const desktopWins=sameDesktopWindows(i);
      const card=document.createElement("div");
      card.className="desktop-card wm-desktop-card"+(i===Number(state.currentDesktop)?" active":"");
      card.dataset.desktopIndex=String(i);
      card.innerHTML=
        '<div class="desktop-preview wm-desktop-preview"></div>'+
        '<footer><button class="wm-desktop-name" data-switch>'+escapeHTML(name)+'</button><span>'+desktopWins.length+'</span><button data-rename title="Mudar nome">✎</button>'+(state.desktops.length>1?'<button data-close title="Fechar ambiente">✕</button>':"")+'</footer>';
      const preview=card.querySelector(".wm-desktop-preview");
      desktopWins.slice(0,6).forEach((w,j)=>{
        const mini=document.createElement("i");
        mini.className="desktop-miniwin";
        const usableW=Math.max(1,innerWidth),usableH=Math.max(1,innerHeight-70);
        mini.style.left=Math.max(1,Math.min(86,w.offsetLeft/usableW*100))+"%";
        mini.style.top=Math.max(1,Math.min(72,w.offsetTop/usableH*100))+"%";
        mini.style.width=Math.max(18,Math.min(58,w.offsetWidth/usableW*100))+"%";
        mini.style.height=Math.max(18,Math.min(64,w.offsetHeight/usableH*100))+"%";
        mini.title=APPS[w.dataset.app]?.name||w.dataset.app;
        preview.appendChild(mini);
      });
      card.querySelector("[data-switch]").onclick=()=>switchDesktop(i);
      card.querySelector("[data-rename]").onclick=e=>{e.stopPropagation();renameDesktop(i)};
      card.querySelector("[data-close]")?.addEventListener("click",e=>{e.stopPropagation();closeDesktopV750(i)});
      card.ondragover=e=>{if(e.dataTransfer.types.includes("application/x-win11-window")){e.preventDefault();card.classList.add("drop-target")}};
      card.ondragleave=()=>card.classList.remove("drop-target");
      card.ondrop=e=>{
        e.preventDefault();card.classList.remove("drop-target");
        const id=e.dataTransfer.getData("application/x-win11-window");
        const win=document.querySelector('.window[data-id="'+CSS.escape(id)+'"]');
        if(win)moveWindowToDesktop(win,i);
      };
      strip.appendChild(card);
    });
    const current=Number(state.currentDesktop)||0;
    sameDesktopWindows(current).forEach(w=>wins.appendChild(taskWindowCard(w)));
    if(!wins.children.length)wins.innerHTML='<div class="wm-task-empty">Nenhuma janela neste ambiente.</div>';
  }

  globalThis.renderTaskView=renderTaskViewV750;
  try{renderTaskView=renderTaskViewV750}catch{}

  function desktopItemList(){
    const icon=kind=>globalThis.desktopIconSvg?globalThis.desktopIconSvg(kind):"";
    const system=[
      {id:"system-thispc",label:"Este PC",icon:icon("thispc"),launch:()=>openApp("explorer","This PC"),system:true},
      {id:"system-documents",label:"Documentos",icon:icon("folder"),launch:()=>openApp("explorer","C:/Documents"),system:true},
      {id:"system-edge",label:"Microsoft Edge",icon:icon("edge"),launch:()=>openApp("edge"),system:true},
      {id:"system-recycle",label:"Reciclagem",icon:icon("recycle"),launch:()=>openApp("recycle"),system:true},
      {id:"system-settings",label:"Definições",icon:icon("settings"),launch:()=>openApp("settings"),system:true}
    ];
    const folders=(globalThis.vfsImmediateFolders?globalThis.vfsImmediateFolders("C:/Desktop"):[])
      .map(name=>({id:"folder:"+name,label:name,icon:icon("folder"),name,type:"folder",launch:()=>openApp("explorer","C:/Desktop/"+name)}));
    const files=Object.entries(ensureFolder("C:/Desktop")).map(([name,value])=>({
      id:"file:"+name,label:name,
      icon:/\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name)?icon("image"):/\.(mp3|wav|ogg|m4a|mp4|webm)$/i.test(name)?icon("media"):icon("text"),
      name,value,type:"file",launch:()=>openFile("C:/Desktop",name,value)
    }));
    return [...system,...folders,...files];
  }

  function defaultIconPos(index){
    const rows=Math.max(1,Math.floor((innerHeight-110)/92));
    const col=Math.floor(index/rows),row=index%rows;
    return {x:10+col*92,y:8+row*92};
  }

  function iconPosition(item,index){
    const store=wmState().desktopIconPositions;
    const pos=store[item.id]||defaultIconPos(index);
    return {
      x:clamp(Number(pos.x)||0,0,Math.max(0,desktopIcons.clientWidth-86)),
      y:clamp(Number(pos.y)||0,0,Math.max(0,desktopIcons.clientHeight-86))
    };
  }

  function saveIconPos(item,x,y){
    wmState().desktopIconPositions[item.id]={x:Math.round(x),y:Math.round(y)};
    saveState();
  }

  function desktopContext(item,e){
    if(item.system){
      showContext(e.clientX,e.clientY,[["Abrir",item.launch],["Propriedades",()=>notify("Ambiente de Trabalho",item.label+" · atalho do sistema")]]);
      return;
    }
    const menu=[["Abrir",item.launch],["Mudar nome",()=>{
      const next=String(prompt("Novo nome:",item.name)||"").trim().replace(/[\\/:*?"<>|]/g,"_");
      if(!next||next===item.name)return;
      if(item.type==="file"){
        const f=ensureFolder("C:/Desktop");if(next in f)return notify("Ambiente de Trabalho","Esse nome já existe.");
        f[next]=f[item.name];delete f[item.name];
      }else{
        const old="C:/Desktop/"+item.name,neu="C:/Desktop/"+next;if(state.files[neu])return notify("Ambiente de Trabalho","Essa pasta já existe.");
        const paths=Object.keys(state.files).filter(p=>p===old||p.startsWith(old+"/")).sort((a,b)=>a.length-b.length);
        paths.forEach(p=>state.files[neu+p.slice(old.length)]=state.files[p]);
        paths.sort((a,b)=>b.length-a.length).forEach(p=>delete state.files[p]);
      }
      delete wmState().desktopIconPositions[item.id];saveState();populateDesktopV750();
    }],["Eliminar",async()=>{
      if(item.type==="file")Win11ExplorerPro?.moveFileToRecycle("C:/Desktop",item.name);
      else Win11ExplorerPro?.moveFolderToRecycle("C:/Desktop",item.name);
      delete wmState().desktopIconPositions[item.id];saveState();populateDesktopV750();
    }]];
    showContext(e.clientX,e.clientY,menu);
  }

  function populateDesktopV750(){
    desktopIcons.innerHTML="";
    desktopIcons.classList.add("desktop-v750");
    const items=desktopItemList();
    items.forEach((item,index)=>{
      const b=document.createElement("button");
      b.className="desktop-icon wm-desktop-icon";
      b.dataset.desktopItem=item.id;
      b.innerHTML='<span class="icon desktop-icon-art">'+item.icon+'</span><span class="label">'+escapeHTML(item.label)+'</span>';
      const pos=iconPosition(item,index);
      b.style.left=pos.x+"px";b.style.top=pos.y+"px";
      let down=null,moved=false,lastClick=0;
      b.addEventListener("pointerdown",e=>{
        if(e.button!==0||isMobile())return;
        down={x:e.clientX,y:e.clientY,left:b.offsetLeft,top:b.offsetTop,pointerId:e.pointerId};
        moved=false;b.setPointerCapture?.(e.pointerId);
      });
      b.addEventListener("pointermove",e=>{
        if(!down)return;
        const dx=e.clientX-down.x,dy=e.clientY-down.y;
        if(Math.hypot(dx,dy)>4)moved=true;
        if(!moved)return;
        b.style.left=clamp(down.left+dx,0,Math.max(0,desktopIcons.clientWidth-b.offsetWidth))+"px";
        b.style.top=clamp(down.top+dy,0,Math.max(0,desktopIcons.clientHeight-b.offsetHeight))+"px";
      });
      b.addEventListener("pointerup",()=>{
        if(down&&moved)saveIconPos(item,b.offsetLeft,b.offsetTop);
        down=null;
      });
      b.onclick=e=>{
        if(moved)return;
        $$(".desktop-icon").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");
        const now=Date.now();if(now-lastClick<420)item.launch();lastClick=now;
      };
      b.ondblclick=e=>{e.preventDefault();item.launch()};
      b.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();desktopContext(item,e)};
      desktopIcons.appendChild(b);
    });
  }

  globalThis.populateDesktop=populateDesktopV750;
  try{populateDesktop=populateDesktopV750}catch{}

  desktop.addEventListener("contextmenu",e=>{
    if(e.target.closest(".desktop-icon"))return;
    e.preventDefault();e.stopImmediatePropagation();
    showContext(e.clientX,e.clientY,[
      ["Ver",()=>notify("Ambiente de Trabalho","Ícones do ambiente de trabalho ativados.")],
      ["Ordenar automaticamente",()=>{
        const store=wmState().desktopIconPositions;Object.keys(store).forEach(k=>delete store[k]);saveState();populateDesktopV750();
      }],
      ["Atualizar",()=>populateDesktopV750()],
      "---",
      ["Nova pasta",()=>{
        let name="Nova pasta",i=2;while(state.files["C:/Desktop/"+name])name="Nova pasta ("+i+++ ")";
        ensureFolder("C:/Desktop/"+name);saveState();populateDesktopV750();
      }],
      ["Novo documento de texto",()=>{
        const files=ensureFolder("C:/Desktop");let name="Novo Documento de Texto.txt",i=2;
        while(name in files)name="Novo Documento de Texto ("+i+++ ").txt";
        files[name]="";saveState();populateDesktopV750();
      }],
      "---",
      ["Definições de visualização",()=>openApp("settings")],
      ["Personalizar",()=>openApp("settings")]
    ]);
  },true);

  function ensureTaskbarPreview(){
    if(taskbarPreview?.isConnected)return taskbarPreview;
    taskbarPreview=document.createElement("div");
    taskbarPreview.className="wm-taskbar-preview";
    document.getElementById("app").appendChild(taskbarPreview);
    taskbarPreview.addEventListener("pointerenter",()=>clearTimeout(taskbarPreviewTimer));
    taskbarPreview.addEventListener("pointerleave",()=>scheduleHideTaskbarPreview());
    return taskbarPreview;
  }

  function scheduleHideTaskbarPreview(){
    clearTimeout(taskbarPreviewTimer);
    taskbarPreviewTimer=setTimeout(()=>taskbarPreview?.classList.remove("open"),220);
  }

  function showTaskbarWindowPreview(button){
    if(!wmState().taskbarPreviews)return;
    const win=document.querySelector('.window[data-id="'+CSS.escape(button.dataset.window||"")+'"]');
    if(!win)return;
    const panel=ensureTaskbarPreview();
    const members=snapGroupMembers(win);
    panel.innerHTML="";
    members.forEach(member=>{
      const card=document.createElement("button");
      card.className="wm-taskbar-preview-card";
      card.innerHTML='<div class="wm-taskbar-preview-image"></div><footer><span>'+escapeHTML(APPS[member.dataset.app]?.name||member.dataset.app)+'</span><i>✕</i></footer>';
      buildWindowPreview(member,card.querySelector(".wm-taskbar-preview-image"));
      card.onclick=e=>{if(e.target.tagName==="I"){closeWindow(member);panel.classList.remove("open");return}focusGroup(member);panel.classList.remove("open")};
      panel.appendChild(card);
    });
    const r=button.getBoundingClientRect();
    panel.style.left=clamp(r.left+r.width/2-panel.offsetWidth/2,8,Math.max(8,innerWidth-panel.offsetWidth-8))+"px";
    panel.classList.add("open");
  }

  taskCenter.addEventListener("pointerover",e=>{
    const b=e.target.closest('.task-btn.running[data-window]');
    if(!b)return;
    clearTimeout(taskbarPreviewTimer);
    showTaskbarWindowPreview(b);
  });
  taskCenter.addEventListener("pointerout",e=>{
    if(e.target.closest('.task-btn.running[data-window]'))scheduleHideTaskbarPreview();
  });

  document.addEventListener("keydown",e=>{
    if(!(e.metaKey&&e.ctrlKey))return;
    if(e.key.toLowerCase()==="d"){
      e.preventDefault();e.stopImmediatePropagation();createDesktopV750();
    }
    if(e.key==="F4"){
      e.preventDefault();e.stopImmediatePropagation();closeDesktopV750(Number(state.currentDesktop)||0);
    }
  },true);

  const observer=new MutationObserver(records=>{
    if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.(".window")||n.querySelector?.(".window"))))){
      setTimeout(()=>{decorateAllWindows();refreshSnapGroups()},0);
    }
  });
  observer.observe(layer,{childList:true});

  addEventListener("resize",()=>{
    refreshSnapGroups();
    populateDesktopV750();
    $$(".window.wm-snapped").forEach(win=>applyLayoutSlot(win,win.dataset.wmSnapLayout,Number(win.dataset.wmSnapSlot),{assist:false}));
  });

  wmState();
  decorateAllWindows();
  refreshSnapGroups();
  populateDesktopV750();

  globalThis.Win11WindowManager=Object.freeze({
    version:"7.8.1",
    layouts:LAYOUTS,
    applyLayoutSlot,
    restoreFloating,
    refreshSnapGroups,
    snapGroupMembers,
    focusGroup,
    renameDesktop,
    moveWindowToDesktop,
    closeDesktop:closeDesktopV750,
    createDesktop:createDesktopV750,
    renderTaskView:renderTaskViewV750,
    populateDesktop:populateDesktopV750
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"7.8.1",
    step:14,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "snap-layouts-v2","snap-assist","snap-groups","edge-drag-snap",
      "alt-tab-live-previews","taskbar-window-previews",
      "virtual-desktop-rename","virtual-desktop-close","virtual-desktop-window-move",
      "desktop-real-files","desktop-icon-positioning","desktop-context-menu-v2"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
