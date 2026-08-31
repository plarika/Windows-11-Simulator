"use strict";
/* Windows 11 Simulator V8.1 — Start, Search & Taskbar Experience */
(function installStartSearchTaskbarV810(){
  if(globalThis.Win11StartSearch?.version==="8.1.0")return;
  const VERSION="8.1.0";
  const DEFAULT_PINNED=[
    "edge","explorer","notepad","calc","settings","store",
    "photos","paint","terminal","taskmanager","security","clock",
    "stickynotes","onedrive","mediaplayer","snipping","powershell","windowstools"
  ];
  const SETTINGS_INDEX=[
    {name:"Sistema",page:"system",terms:"ecrã som armazenamento energia dispositivo"},
    {name:"Bluetooth e dispositivos",page:"devices",terms:"bluetooth câmara microfone dispositivos"},
    {name:"Rede e Internet",page:"network",terms:"rede internet wifi online ligação"},
    {name:"Personalização",page:"personalization",terms:"tema wallpaper fundo cores barra tarefas"},
    {name:"Aplicações",page:"apps",terms:"apps aplicações predefinidas instalar pwa"},
    {name:"Contas",page:"accounts",terms:"contas utilizadores perfil pin palavra passe"},
    {name:"Privacidade e segurança",page:"privacy",terms:"privacidade segurança permissões proteção"},
    {name:"Windows Update",page:"system",terms:"update atualização versão service worker"}
  ];
  let startAllApps=false;
  let searchActiveIndex=0;
  const esc=s=>typeof globalThis.escapeHTML==="function"?escapeHTML(String(s??"")):String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  function ensureState(){
    if(!state.startSearchV81||typeof state.startSearchV81!=="object")state.startSearchV81={};
    const s=state.startSearchV81;
    if(!Array.isArray(s.pinned))s.pinned=DEFAULT_PINNED.filter(id=>APPS[id]);
    s.pinned=s.pinned.filter((id,i,a)=>APPS[id]&&a.indexOf(id)===i).slice(0,24);
    if(!Array.isArray(s.recentApps))s.recentApps=[];
    s.recentApps=s.recentApps.filter((id,i,a)=>APPS[id]&&a.indexOf(id)===i).slice(0,10);
    if(!Array.isArray(s.searchHistory))s.searchHistory=[];
    s.searchHistory=s.searchHistory.filter(Boolean).slice(0,8);
    return s;
  }
  function normalize(v){
    return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  }
  function appIcon(id,cls="start-icon-v81"){
    try{
      const html=globalThis.Win11Realism?.iconFor?.(id,cls);
      if(html)return html;
    }catch{}
    if(typeof globalThis.desktopIconSvg==="function"){
      const kind=id==="explorer"?"folder":id==="settings"?"settings":id==="edge"?"edge":"file";
      return '<span class="'+cls+'">'+desktopIconSvg(kind)+'</span>';
    }
    return '<span class="'+cls+'">'+esc(APPS[id]?.name?.slice(0,1)||"?")+'</span>';
  }
  function fileIcon(name,cls="search-file-icon-v81"){
    const lower=String(name).toLowerCase();
    const kind=/\.(png|jpe?g|webp|gif)$/.test(lower)?"image":/\.(mp3|wav|ogg|mp4|webm)$/.test(lower)?"media":"text";
    return typeof globalThis.desktopIconSvg==="function"?'<span class="'+cls+'">'+desktopIconSvg(kind)+'</span>':'<span class="'+cls+'">F</span>';
  }

  function rememberApp(id){
    if(!APPS[id])return;
    const s=ensureState();
    s.recentApps=[id,...s.recentApps.filter(x=>x!==id)].slice(0,10);
    saveState();
  }
  function rememberQuery(q){
    q=String(q||"").trim();
    if(q.length<2)return;
    const s=ensureState();
    s.searchHistory=[q,...s.searchHistory.filter(x=>normalize(x)!==normalize(q))].slice(0,8);
    saveState();
  }
  function isPinned(id){return ensureState().pinned.includes(id)}
  function pin(id){
    if(!APPS[id])return false;
    const s=ensureState();
    if(!s.pinned.includes(id))s.pinned.push(id);
    s.pinned=s.pinned.slice(0,24);saveState();renderStartAppsV810(startAllApps);return true;
  }
  function unpin(id){
    const s=ensureState();s.pinned=s.pinned.filter(x=>x!==id);saveState();renderStartAppsV810(startAllApps);return true;
  }
  function reorderPinned(source,target){
    const s=ensureState(),a=s.pinned,i=a.indexOf(source),j=a.indexOf(target);
    if(i<0||j<0||i===j)return false;
    a.splice(i,1);a.splice(j,0,source);saveState();renderStartAppsV810(false);return true;
  }
  const baseOpenApp=globalThis.openApp||openApp;
  function openAppV810(id,path){
    rememberApp(id);
    return baseOpenApp(id,path);
  }
  globalThis.openApp=openAppV810;
  try{openApp=openAppV810}catch{}

  function appContext(id,x,y){
    showContext(x,y,[
      ["Abrir",()=>openAppV810(id)],
      [isPinned(id)?"Remover do Iniciar":"Afixar no Iniciar",()=>isPinned(id)?unpin(id):pin(id)],
      "---",
      ["Definições da aplicação",()=>{state.settingsPage="apps";saveState();openAppV810("settings")}]
    ]);
  }
  function makePinnedButton(id){
    const app=APPS[id],b=document.createElement("button");
    b.className="start-app start-app-v81";b.dataset.app=id;b.draggable=true;
    b.innerHTML=appIcon(id)+'<span>'+esc(app.name)+'</span>';
    b.onclick=()=>{openAppV810(id);closeOverlays()};
    b.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();appContext(id,e.clientX,e.clientY)};
    b.ondragstart=e=>{e.dataTransfer.setData("application/x-win11-start-app",id);e.dataTransfer.effectAllowed="move";b.classList.add("dragging")};
    b.ondragend=()=>b.classList.remove("dragging");
    b.ondragover=e=>{if(e.dataTransfer.types.includes("application/x-win11-start-app"))e.preventDefault()};
    b.ondrop=e=>{e.preventDefault();const source=e.dataTransfer.getData("application/x-win11-start-app");reorderPinned(source,id)};
    return b;
  }
  function makeAllAppButton(id){
    const app=APPS[id],b=document.createElement("button");
    b.className="start-allapp-v81";b.dataset.app=id;
    b.innerHTML=appIcon(id,"allapp-icon-v81")+'<span>'+esc(app.name)+'</span><i>›</i>';
    b.onclick=()=>{openAppV810(id);closeOverlays()};
    b.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();appContext(id,e.clientX,e.clientY)};
    return b;
  }

  function setStartSectionsVisible(visible){
    const menu=document.getElementById("start-menu");
    menu?.querySelectorAll(":scope > .section-head,:scope > .start-grid,:scope > .start-recommended").forEach(el=>el.hidden=!visible);
  }
  function ensureStartSearchHost(){
    const menu=document.getElementById("start-menu");if(!menu)return null;
    let host=menu.querySelector("#start-search-results-v81");
    if(!host){
      host=document.createElement("div");host.id="start-search-results-v81";host.className="start-search-results-v81";host.hidden=true;
      menu.querySelector(".searchbox")?.insertAdjacentElement("afterend",host);
    }
    return host;
  }
  function renderStartAppsV810(showAll=false){
    const g=document.getElementById("start-grid");if(!g)return;
    startAllApps=Boolean(showAll);setStartSectionsVisible(true);
    const host=ensureStartSearchHost();if(host){host.hidden=true;host.innerHTML=""}
    g.innerHTML="";g.className="start-grid start-grid-v81"+(startAllApps?" all-apps-v81":"");
    const title=document.querySelector("#start-menu .section-head h3"),all=document.getElementById("all-apps-btn");
    const rec=document.querySelector("#start-menu .start-recommended");
    if(startAllApps){
      if(title)title.textContent="Todas as aplicações";if(all)all.textContent="‹ Voltar";if(rec)rec.hidden=true;
      let letter="";
      Object.keys(APPS).sort((a,b)=>APPS[a].name.localeCompare(APPS[b].name,"pt-PT")).forEach(id=>{
        const next=normalize(APPS[id].name).charAt(0).toUpperCase()||"#";
        if(next!==letter){letter=next;const h=document.createElement("div");h.className="allapps-letter-v81";h.textContent=letter;g.appendChild(h)}
        g.appendChild(makeAllAppButton(id));
      });
    }else{
      if(title)title.textContent="Afixadas";if(all)all.textContent="Todas as aplicações ›";if(rec)rec.hidden=false;
      ensureState().pinned.forEach(id=>g.appendChild(makePinnedButton(id)));renderRecommendedV810();
    }
  }

  function fileValue(path,name){return (state.files?.[path]||{})[name]}
  function openFileResult(r){
    if(r?.kind==="folder"){
      openAppV810("explorer",r.path+"/"+r.name);
      return;
    }
    const value=fileValue(r.path,r.name);
    try{
      touchRecent(r.path+"/"+r.name);
      const shortcut=globalThis.Win11ExplorerFilesystem?.shortcutTarget?.(value);
      if(shortcut){
        if(shortcut.type==="folder")return openAppV810("explorer",shortcut.path+"/"+shortcut.name);
        const target=(state.files?.[shortcut.path]||{})[shortcut.name];
        if(target!==undefined&&typeof globalThis.openFile==="function")return openFile(shortcut.path,shortcut.name,target);
        notify("Pesquisa","O destino deste atalho já não existe.");
        return;
      }
      if(typeof globalThis.openFile==="function")return openFile(r.path,r.name,value);
    }catch{}
    openAppV810("explorer",r.path);
  }
  function recentFileEntries(limit=6){
    return (state.recents||[]).map(full=>{
      const parts=String(full).split("/"),name=parts.pop(),path=parts.join("/");
      return name&&Object.prototype.hasOwnProperty.call(state.files?.[path]||{},name)?{type:"file",path,name,detail:path}:null;
    }).filter(Boolean).slice(0,limit);
  }
  function renderRecommendedV810(){
    const box=document.getElementById("recommended-list");if(!box)return;
    box.innerHTML="";const files=recentFileEntries(4);
    const apps=ensureState().recentApps.filter(id=>APPS[id]).slice(0,2).map(id=>({type:"app",id,name:APPS[id].name,detail:"Utilizada recentemente"}));
    [...files,...apps].slice(0,6).forEach(r=>{
      const b=document.createElement("button");b.className="recommended-item recommended-v81";
      b.innerHTML=(r.type==="app"?appIcon(r.id,"ri-icon-v81"):fileIcon(r.name,"ri-icon-v81"))+
        '<span><strong>'+esc(r.name)+'</strong><small>'+esc(r.detail||"")+'</small></span>';
      b.onclick=()=>{r.type==="app"?openAppV810(r.id):openFileResult(r);closeOverlays()};
      b.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();showContext(e.clientX,e.clientY,r.type==="app"?
        [[isPinned(r.id)?"Remover do Iniciar":"Afixar no Iniciar",()=>isPinned(r.id)?unpin(r.id):pin(r.id)]]:
        [["Abrir",()=>openFileResult(r)],["Abrir localização",()=>openAppV810("explorer",r.path)],["Remover da lista",()=>{state.recents=(state.recents||[]).filter(x=>x!==r.path+"/"+r.name);saveState();renderRecommendedV810()}]])};
      box.appendChild(b);
    });
    if(!box.children.length)box.innerHTML='<div class="start-empty-v81">As aplicações e ficheiros recentes aparecem aqui.</div>';
  }

  function score(query,text){
    const q=normalize(query),t=normalize(text);if(!q||!t)return 0;
    if(t===q)return 100;if(t.startsWith(q))return 82;if(t.includes(q))return 62;
    const tokens=q.split(/\s+/).filter(Boolean);if(tokens.every(x=>t.includes(x)))return 48;
    return 0;
  }
  function collectSearchResultsV810(query){
    const q=String(query||"").trim();if(!q)return [];
    if(globalThis.Win11SearchV920?.collect)return Win11SearchV920.collect(q,36);
    const out=[];
    Object.entries(APPS).forEach(([id,a])=>{
      const s=score(q,a.name+" "+id);if(s)out.push({type:"app",id,name:a.name,detail:"Aplicação",score:s+10});
    });
    SETTINGS_INDEX.forEach(item=>{
      const s=score(q,item.name+" "+item.terms);if(s)out.push({type:"setting",name:item.name,page:item.page,detail:"Definição",score:s+6});
    });
    const showHidden=!!globalThis.Win11ExplorerFilesystem?.getState?.().showHidden;
    Object.entries(state.files||{}).forEach(([path,files])=>Object.entries(files||{}).forEach(([name,value])=>{
      const meta=globalThis.Win11ExplorerFilesystem?.getMetadata?.(path,name,"file");
      if(meta?.hidden&&!showHidden)return;
      const content=typeof value==="string"&&!value.startsWith("data:")?value.slice(0,4000):"";
      const shortcut=globalThis.Win11ExplorerFilesystem?.shortcutTarget?.(value);
      const shortcutText=shortcut?(shortcut.path+" "+shortcut.name):"";
      const s=Math.max(score(q,name)+8,score(q,content),score(q,path),score(q,shortcutText));
      if(s)out.push({type:"file",path,name,detail:path,score:s});
    }));
    const rank={app:0,setting:1,file:2};
    return out.sort((a,b)=>b.score-a.score||(rank[a.type]-rank[b.type])||a.name.localeCompare(b.name,"pt-PT")).slice(0,36);
  }
  function resultIcon(r){
    if(r.type==="app")return appIcon(r.id,"search-icon-v81");
    if(r.type==="setting")return appIcon("settings","search-icon-v81");
    if(r.kind==="folder"&&typeof globalThis.desktopIconSvg==="function")return '<span class="search-icon-v81">'+desktopIconSvg("folder")+'</span>';
    return fileIcon(r.name,"search-icon-v81");
  }

  function launchSearchResultV810(r){
    if(!r)return false;
    const q=document.getElementById("global-search")?.value||document.getElementById("start-search")?.value||"";
    rememberQuery(q);
    if(r.type==="app")openAppV810(r.id);
    else if(r.type==="setting"){state.settingsPage=r.page;saveState();openAppV810("settings")}
    else if(r.type==="file")openFileResult(r);
    closeOverlays();return true;
  }
  function locationAction(r){
    if(r.type!=="file")return null;
    return ["Abrir localização",()=>{openAppV810("explorer",r.path);closeOverlays()}];
  }
  function renderSearchPreview(r,panel){
    if(!panel)return;
    if(!r){panel.innerHTML='<div class="search-preview-empty-v81">Selecione um resultado.</div>';return}
    panel.innerHTML='<div class="search-preview-icon-v81">'+resultIcon(r)+'</div>'+
      '<h3>'+esc(r.name)+'</h3><p>'+esc(r.detail||"")+'</p><div class="search-preview-actions-v81"></div>';
    const actions=panel.querySelector(".search-preview-actions-v81");
    const open=document.createElement("button");open.className="primary";open.textContent="Abrir";open.onclick=()=>launchSearchResultV810(r);actions.appendChild(open);
    const loc=locationAction(r);if(loc){const b=document.createElement("button");b.textContent=loc[0];b.onclick=loc[1];actions.appendChild(b)}
    if(r.type==="app"){const b=document.createElement("button");b.textContent=isPinned(r.id)?"Remover do Iniciar":"Afixar no Iniciar";b.onclick=()=>{isPinned(r.id)?unpin(r.id):pin(r.id);renderSearchPreview(r,panel)};actions.appendChild(b)}
  }

  function searchGroupLabel(type){return type==="app"?"Aplicações":type==="setting"?"Definições":"Documentos e ficheiros"}
  function resultButton(r,index,preview){
    const b=document.createElement("button");b.className="search-result search-result-v81"+(index===searchActiveIndex?" active":"");
    b.dataset.searchIndex=String(index);b.dataset.type=r.type;
    b.innerHTML=resultIcon(r)+'<span><strong>'+esc(r.name)+'</strong><small>'+esc(r.detail||"")+'</small></span><i>›</i>';
    b.onclick=()=>launchSearchResultV810(r);
    b.onpointerenter=()=>{searchActiveIndex=index;document.querySelectorAll(".search-result-v81").forEach(x=>x.classList.toggle("active",Number(x.dataset.searchIndex)===index));renderSearchPreview(r,preview)};
    return b;
  }
  function emptySearchResults(){
    const recentApps=ensureState().recentApps.filter(id=>APPS[id]).slice(0,4).map(id=>({type:"app",id,name:APPS[id].name,detail:"Aplicação recente"}));
    return [...recentApps,...recentFileEntries(4)].slice(0,8);
  }
  function renderGlobalSearchV810(query){
    const box=document.getElementById("search-results");if(!box)return;
    const results=String(query||"").trim()?collectSearchResultsV810(query):emptySearchResults();
    searchActiveIndex=0;box.innerHTML="";
    globalThis.Win11SearchV920?.renderControls?.(box,query);
    const layout=document.createElement("div");layout.className="search-layout-v81";
    const list=document.createElement("div");list.className="search-list-v81";
    const preview=document.createElement("aside");preview.className="search-preview-v81";
    layout.append(list,preview);box.appendChild(layout);
    if(!results.length){list.innerHTML='<div class="search-empty search-empty-v81">Nenhum resultado encontrado.</div>';renderSearchPreview(null,preview);return}
    let lastType=null;
    results.forEach((r,i)=>{
      if(r.type!==lastType){lastType=r.type;const h=document.createElement("div");h.className="search-group-v81";h.textContent=searchGroupLabel(r.type);list.appendChild(h)}
      list.appendChild(resultButton(r,i,preview));
    });
    renderSearchPreview(results[0],preview);
  }

  function renderStartSearch(query){
    const q=String(query||"").trim(),host=ensureStartSearchHost();if(!host)return;
    if(!q){host.hidden=true;host.innerHTML="";setStartSectionsVisible(true);renderStartAppsV810(false);return}
    setStartSectionsVisible(false);host.hidden=false;host.innerHTML="";
    const results=collectSearchResultsV810(q).slice(0,10);
    const head=document.createElement("div");head.className="start-search-head-v81";head.innerHTML='<strong>Melhor correspondência</strong><button data-open-full-search>Ver todos</button>';host.appendChild(head);
    head.querySelector("button").onclick=()=>{openGlobalSearchV810(q)};
    if(!results.length){host.insertAdjacentHTML("beforeend",'<div class="start-empty-v81">Nenhum resultado encontrado.</div>');return}
    results.forEach((r,i)=>{
      const b=document.createElement("button");b.className="start-search-result-v81"+(i===0?" active":"");b.dataset.startSearchIndex=String(i);
      b.innerHTML=resultIcon(r)+'<span><strong>'+esc(r.name)+'</strong><small>'+esc(r.detail||"")+'</small></span>';
      b.onclick=()=>launchSearchResultV810(r);host.appendChild(b);
    });
  }
  function openGlobalSearchV810(query=""){
    closeOverlays("search");overlays.search.classList.add("open");syncOverlayButtons();
    const input=document.getElementById("global-search");input.value=String(query||"");renderGlobalSearchV810(input.value);setTimeout(()=>input.focus(),0);
  }

  function moveSearchSelection(delta){
    const buttons=[...document.querySelectorAll("#search-results .search-result-v81")];if(!buttons.length)return;
    searchActiveIndex=(searchActiveIndex+delta+buttons.length)%buttons.length;
    buttons.forEach((b,i)=>b.classList.toggle("active",i===searchActiveIndex));
    buttons[searchActiveIndex].scrollIntoView({block:"nearest"});
    const r=String(document.getElementById("global-search")?.value||"").trim()?collectSearchResultsV810(document.getElementById("global-search").value):emptySearchResults();
    renderSearchPreview(r[searchActiveIndex],document.querySelector("#search-results .search-preview-v81"));
  }
  function jumpItems(appId){
    if(appId==="explorer")return [
      ["Nova janela",()=>globalThis.Win11ExplorerMultiWindow?.open?.("This PC")],
      ["Documentos",()=>openAppV810("explorer","C:/Documents")],
      ["Ambiente de Trabalho",()=>openAppV810("explorer","C:/Desktop")],
      ["Imagens",()=>openAppV810("explorer","C:/Pictures")]
    ];
    if(appId==="notepad")return recentFileEntries(6).filter(r=>/\.txt$/i.test(r.name)).slice(0,4).map(r=>[r.name,()=>openFileResult(r)]);
    if(appId==="photos")return recentFileEntries(8).filter(r=>/\.(png|jpe?g|webp|gif)$/i.test(r.name)).slice(0,4).map(r=>[r.name,()=>openFileResult(r)]);
    return [];
  }
  function showTaskbarJumpList(button,e){
    const win=document.querySelector('.window[data-id="'+CSS.escape(button.dataset.window||"")+'"]');
    const appId=button.dataset.app||win?.dataset.app;if(!appId||!APPS[appId])return;
    const items=[[APPS[appId].name,()=>openAppV810(appId)]];
    const jumps=jumpItems(appId);if(jumps.length)items.push("---",...jumps);
    items.push("---",[isPinned(appId)?"Remover do Iniciar":"Afixar no Iniciar",()=>isPinned(appId)?unpin(appId):pin(appId)]);
    if(win)items.push(["Fechar janela",()=>closeWindow(win)]);
    showContext(e.clientX,e.clientY,items);
  }

  function bindEvents(){
    const all=document.getElementById("all-apps-btn");
    if(all)all.onclick=e=>{e.stopPropagation();renderStartAppsV810(!startAllApps)};
    const startInput=document.getElementById("start-search");
    startInput?.addEventListener("input",e=>{e.stopImmediatePropagation();renderStartSearch(e.target.value)},true);
    startInput?.addEventListener("keydown",e=>{
      if(e.key==="Enter"&&e.currentTarget.value.trim()){
        e.preventDefault();e.stopImmediatePropagation();document.querySelector("#start-search-results-v81 .start-search-result-v81")?.click();
      }else if(e.key==="Escape"&&e.currentTarget.value){e.preventDefault();e.stopImmediatePropagation();e.currentTarget.value="";renderStartSearch("")}
    },true);
    const globalInput=document.getElementById("global-search");
    globalInput?.addEventListener("input",e=>{e.stopImmediatePropagation();renderGlobalSearchV810(e.target.value)},true);
    globalInput?.addEventListener("keydown",e=>{
      if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();e.stopImmediatePropagation();moveSearchSelection(e.key==="ArrowDown"?1:-1)}
      else if(e.key==="Enter"){e.preventDefault();e.stopImmediatePropagation();document.querySelector('#search-results .search-result-v81[data-search-index="'+searchActiveIndex+'"]')?.click()}
    },true);
    document.getElementById("search-btn")?.addEventListener("click",()=>setTimeout(()=>{if(overlays.search.classList.contains("open"))renderGlobalSearchV810("")},0));
    document.getElementById("task-center")?.addEventListener("contextmenu",e=>{
      const b=e.target.closest(".task-btn.running[data-window]");if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();showTaskbarJumpList(b,e);
    },true);
  }

  globalThis.populateStart=renderStartAppsV810;
  globalThis.renderRecommended=renderRecommendedV810;
  globalThis.collectSearchResults=collectSearchResultsV810;
  globalThis.renderGlobalSearch=renderGlobalSearchV810;
  globalThis.launchSearchResult=launchSearchResultV810;
  globalThis.openGlobalSearch=openGlobalSearchV810;
  try{
    populateStart=renderStartAppsV810;renderRecommended=renderRecommendedV810;
    collectSearchResults=collectSearchResultsV810;renderGlobalSearch=renderGlobalSearchV810;
    launchSearchResult=launchSearchResultV810;openGlobalSearch=openGlobalSearchV810;
  }catch{}
  ensureState();bindEvents();renderStartAppsV810(false);renderRecommendedV810();

  globalThis.Win11StartSearch=Object.freeze({
    version:VERSION,
    renderStart:renderStartAppsV810,
    renderSearch:renderGlobalSearchV810,
    collect:collectSearchResultsV810,
    pin,unpin,isPinned,reorderPinned,
    openSearch:openGlobalSearchV810,
    get state(){return JSON.parse(JSON.stringify(ensureState()))}
  });
  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:20,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "start-menu-v3","per-user-start-pins","start-pin-drag-reorder","all-apps-alphabetical",
      "smart-recommended","search-v3","categorized-search","search-preview-actions",
      "search-keyboard-navigation","taskbar-jump-lists","recent-app-tracking"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
