"use strict";
/* Windows 11 Simulator V7.3 — Edge Advanced */
(function installEdgeAdvancedV730(){
  const BASE=globalThis.Win11EdgeInternet;
  const SEARCH=globalThis.Win11EdgeSearch;
  if(!BASE||!SEARCH)throw new Error("Edge Internet and Edge Search must load before Edge Advanced.");
  const OUVIR_MUSICA_URL=BASE.OUVIR_MUSICA_URL||"https://www.ouvirmusica.com.br/";
  const OUVIR_MUSICA_HOSTS=BASE.OUVIR_MUSICA_HOSTS||new Set(["ouvirmusica.com.br","www.ouvirmusica.com.br"]);
  const YOUTUBE_HOSTS=BASE.YOUTUBE_HOSTS||new Set(["youtube.com","www.youtube.com","m.youtube.com","youtu.be","www.youtu.be"]);

  const INTERNAL_PAGES=new Set([
    "edge://newtab","edge://favorites","edge://history","edge://downloads","edge://settings","edge://youtube","edge://google"
  ]);

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function makeId(prefix){
    return prefix+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
  }

  function ensureEdgeState(){
    const current=state.edgeBrowser&&typeof state.edgeBrowser==="object"?state.edgeBrowser:{};
    current.version=1;
    current.favorites=Array.isArray(current.favorites)?current.favorites.slice(0,200):[];
    current.history=Array.isArray(current.history)?current.history.slice(0,300):[];
    current.downloads=Array.isArray(current.downloads)?current.downloads.slice(0,120):[];
    current.tabs=Array.isArray(current.tabs)?current.tabs.slice(0,24):[];
    current.activeId=typeof current.activeId==="string"?current.activeId:null;
    current.closedTabs=Array.isArray(current.closedTabs)?current.closedTabs.slice(0,20):[];
    current.restoreTabs=current.restoreTabs!==false;
    current.showFavoritesBar=current.showFavoritesBar!==false;
    current.startupPage=normalize(typeof current.startupPage==="string"?current.startupPage:"edge://newtab");
    state.edgeBrowser=current;
    return current;
  }

  const edgeState=new Proxy({},{
    get(_target,prop){return ensureEdgeState()[prop]},
    set(_target,prop,value){ensureEdgeState()[prop]=value;return true},
    ownKeys(){return Reflect.ownKeys(ensureEdgeState())},
    getOwnPropertyDescriptor(){return {enumerable:true,configurable:true}}
  });

  function saveBrowser(tabs,activeId){
    const target=ensureEdgeState();
    target.tabs=clone((tabs||[]).slice(0,24));
    target.activeId=activeId||null;
    saveState();
  }

  function normalize(raw){
    const value=String(raw||"").trim();
    if(!value)return "edge://newtab";
    if(value.startsWith("edge://youtube"))return BASE.normalize(value);
    if(value.startsWith("edge://google"))return value;
    if(value==="edge://ouvirmusica")return OUVIR_MUSICA_URL;
    if(INTERNAL_PAGES.has(value))return value;
    const likelyUrl=/^https?:\/\//i.test(value)||(!/\s/.test(value)&&/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(value));
    if(!likelyUrl&&!/^yt\s*:/i.test(value)&&SEARCH.providerStatus().google.configured){
      return SEARCH.googleRoute(value);
    }
    return BASE.normalize(value);
  }

  function titleFor(url){
    if(url==="edge://newtab")return "Novo separador";
    if(url==="edge://favorites")return "Favoritos";
    if(url==="edge://history")return "Histórico";
    if(url==="edge://downloads")return "Downloads";
    if(url==="edge://settings")return "Definições";
    if(String(url||"").startsWith("edge://google"))return "Google";
    if(String(url||"").startsWith("edge://youtube"))return "YouTube";
    if(url.startsWith("local:"))return "Pesquisa local";
    try{
      const u=new URL(url);
      const host=u.hostname.toLowerCase();
      if(BASE.isGoogleHost?.(host)||u.hostname.includes("google."))return "Google";
      if(YOUTUBE_HOSTS.has(host))return "YouTube";
      if(OUVIR_MUSICA_HOSTS.has(host))return "Ouvir Música";
      return u.hostname.replace(/^www\./,"");
    }catch{return "Microsoft Edge"}
  }

  function faviconFor(url){
    if(url==="edge://favorites")return "★";
    if(url==="edge://history")return "🕘";
    if(url==="edge://downloads")return "↓";
    if(url==="edge://settings")return "⚙";
    if(url==="edge://newtab")return "🌐";
    if(String(url||"").startsWith("edge://google"))return "G";
    if(String(url||"").startsWith("edge://youtube"))return "▶";
    if(url.startsWith("local:"))return "🔎";
    try{
      const u=new URL(url);
      const host=u.hostname.toLowerCase();
      if(BASE.isGoogleHost?.(host)||u.hostname.includes("google."))return "G";
      if(YOUTUBE_HOSTS.has(host))return "▶";
      if(OUVIR_MUSICA_HOSTS.has(host))return "♪";
      if(u.hostname.includes("github.com"))return "◆";
      if(u.hostname.includes("wikipedia.org"))return "W";
      return "🌐";
    }catch{return "🌐"}
  }

  function sanitizeTab(raw){
    const url=normalize(raw?.url||"edge://newtab");
    const history=Array.isArray(raw?.history)&&raw.history.length
      ?raw.history.map(normalize).slice(-60)
      :[url];
    const index=Math.max(0,Math.min(Number(raw?.index)||history.length-1,history.length-1));
    return {
      id:typeof raw?.id==="string"?raw.id:makeId("edge-tab"),
      url:history[index]||url,
      history,
      index,
      title:titleFor(history[index]||url),
      favicon:faviconFor(history[index]||url),
      pinned:Boolean(raw?.pinned)
    };
  }

  function addHistory(url,title){
    if(!url||url==="edge://newtab")return;
    const item={
      id:makeId("hist"),
      url,
      title:title||titleFor(url),
      visitedAt:Date.now()
    };
    edgeState.history.unshift(item);
    edgeState.history=edgeState.history.slice(0,300);
  }

  function isFavorite(url){
    return edgeState.favorites.some(f=>f.url===url);
  }

  function toggleFavorite(url,title){
    if(!url||url==="edge://newtab")return false;
    const i=edgeState.favorites.findIndex(f=>f.url===url);
    if(i>=0){
      edgeState.favorites.splice(i,1);
      saveState();
      return false;
    }
    edgeState.favorites.unshift({
      id:makeId("fav"),
      url,
      title:title||titleFor(url),
      createdAt:Date.now()
    });
    edgeState.favorites=edgeState.favorites.slice(0,200);
    saveState();
    return true;
  }

  function removeFavorite(id){
    const i=edgeState.favorites.findIndex(f=>f.id===id);
    if(i>=0){
      edgeState.favorites.splice(i,1);
      saveState();
      return true;
    }
    return false;
  }

  function clearHistory(){
    edgeState.history=[];
    saveState();
  }

  function clearDownloads(){
    edgeState.downloads=[];
    saveState();
  }

  function inferDownloadName(url,headerName=""){
    if(headerName)return headerName;
    try{
      const u=new URL(url);
      const name=decodeURIComponent(u.pathname.split("/").filter(Boolean).pop()||"download");
      return name||"download";
    }catch{return "download"}
  }

  async function saveBlob(blob,name){
    if(typeof window.showSaveFilePicker==="function"){
      try{
        const handle=await window.showSaveFilePicker({suggestedName:name});
        const writable=await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return "saved";
      }catch(err){
        if(err?.name==="AbortError")throw err;
      }
    }
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=name;
    a.rel="noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1800);
    return "download";
  }

  function recordDownload(info={}){
    const item={
      id:info.id||makeId("download"),
      name:info.name||inferDownloadName(info.url||""),
      url:info.url||"",
      status:info.status||"completed",
      size:Number(info.size)||0,
      startedAt:Number(info.startedAt)||Date.now(),
      finishedAt:info.finishedAt===undefined?Date.now():info.finishedAt,
      error:info.error||""
    };
    edgeState.downloads.unshift(item);
    edgeState.downloads=edgeState.downloads.slice(0,120);
    saveState();
    return item;
  }

  async function downloadUrl(url,onUpdate=()=>{}){
    const normalized=normalize(url);
    if(!/^https?:\/\//i.test(normalized)){
      throw new Error("Indique um URL HTTP ou HTTPS.");
    }
    const item=recordDownload({
      url:normalized,
      name:inferDownloadName(normalized),
      status:"downloading",
      finishedAt:null
    });
    onUpdate(item);

    try{
      const response=await fetch(normalized,{mode:"cors",credentials:"omit",cache:"no-store"});
      if(!response.ok)throw new Error("HTTP "+response.status);
      const blob=await response.blob();
      item.size=blob.size;
      item.name=inferDownloadName(normalized);
      await saveBlob(blob,item.name);
      item.status="completed";
      item.finishedAt=Date.now();
      saveState();
      onUpdate(item);
      return item;
    }catch(err){
      if(err?.name==="AbortError"){
        item.status="cancelled";
        item.error="Cancelado pelo utilizador";
      }else{
        item.status="failed";
        item.error=err?.message||"Falha no download";
      }
      item.finishedAt=Date.now();
      saveState();
      onUpdate(item);
      throw err;
    }
  }

  function buildEdgeV730(wrap){
    wrap.className="edge-real edge-v720 edge-v730";
    wrap.tabIndex=0;
    wrap.innerHTML=
      '<div class="edge-real-tabs">'+
        '<div data-tabs class="edge-v720-tabs edge-v730-tabs"></div>'+
        '<button class="edge-new-tab" data-new-tab title="Novo separador (Ctrl+T)">＋</button>'+
      '</div>'+
      '<div class="edge-real-bar edge-v730-bar">'+
        '<button data-back title="Voltar">←</button>'+
        '<button data-forward title="Avançar">→</button>'+
        '<button data-reload title="Recarregar (Ctrl+R)">↻</button>'+
        '<button data-home title="Página inicial">⌂</button>'+
        '<input class="edge-real-address" aria-label="Barra de endereço" placeholder="Pesquisar no Google ou introduzir URL">'+
        '<button data-favorite title="Adicionar aos favoritos">☆</button>'+
        '<button data-go title="Ir">→</button>'+
        '<button data-downloads title="Downloads">↓</button>'+
        '<button data-history title="Histórico">🕘</button>'+
        '<button data-menu title="Definições e mais">⋯</button>'+
      '</div>'+
      '<div class="edge-favorites-bar" data-favorites-bar></div>'+
      '<div class="edge-real-page"></div>';

    const tabsBox=wrap.querySelector("[data-tabs]");
    const address=wrap.querySelector(".edge-real-address");
    const page=wrap.querySelector(".edge-real-page");
    const favoritesBar=wrap.querySelector("[data-favorites-bar]");
    let tabs=[];
    let activeId=null;
    let cleanupTimer=null;

    function current(){return tabs.find(t=>t.id===activeId)}

    function persist(){
      saveBrowser(tabs,activeId);
      renderFavoriteButton();
      renderFavoritesBar();
    }

    function makeTab(url="edge://newtab",opts={}){
      const normalized=normalize(url);
      return {
        id:makeId("edge-tab"),
        url:normalized,
        history:[normalized],
        index:0,
        title:titleFor(normalized),
        favicon:faviconFor(normalized),
        pinned:Boolean(opts.pinned)
      };
    }

    function restoreState(){
      if(edgeState.restoreTabs&&edgeState.tabs.length){
        tabs=edgeState.tabs.map(sanitizeTab);
        tabs.sort((a,b)=>Number(b.pinned)-Number(a.pinned));
        activeId=tabs.some(t=>t.id===edgeState.activeId)?edgeState.activeId:tabs[0]?.id||null;
      }
      if(!tabs.length){
        const start=normalize(edgeState.startupPage||"edge://newtab");
        const t=makeTab(start);
        tabs=[t];
        activeId=t.id;
      }
    }

    function newTab(url="edge://newtab",opts={}){
      const t=makeTab(url,opts);
      if(t.pinned){
        const i=tabs.findIndex(x=>!x.pinned);
        if(i<0)tabs.push(t); else tabs.splice(i,0,t);
      }else tabs.push(t);
      activeId=t.id;
      persist();
      renderTabs();
      renderActive();
      return t;
    }

    function closeTab(id,{remember=true}={}){
      const index=tabs.findIndex(t=>t.id===id);
      if(index<0)return false;
      const [removed]=tabs.splice(index,1);
      if(remember){
        edgeState.closedTabs.unshift(clone(removed));
        edgeState.closedTabs=edgeState.closedTabs.slice(0,20);
      }
      if(!tabs.length){
        const t=makeTab("edge://newtab");
        tabs=[t];
        activeId=t.id;
      }else if(activeId===id){
        activeId=tabs[Math.max(0,index-1)]?.id||tabs[0].id;
      }
      persist();
      renderTabs();
      renderActive();
      return true;
    }

    function reopenClosedTab(){
      const raw=edgeState.closedTabs.shift();
      if(!raw){notify("Microsoft Edge","Não existem separadores fechados para reabrir.");return false}
      const t=sanitizeTab(raw);
      t.id=makeId("edge-tab");
      tabs.push(t);
      activeId=t.id;
      persist();
      renderTabs();
      renderActive();
      return true;
    }

    function duplicateTab(id){
      const source=tabs.find(t=>t.id===id);
      if(!source)return false;
      const copy=sanitizeTab(clone(source));
      copy.id=makeId("edge-tab");
      copy.pinned=false;
      const i=tabs.findIndex(t=>t.id===id);
      tabs.splice(i+1,0,copy);
      activeId=copy.id;
      persist();renderTabs();renderActive();
      return true;
    }

    function setPinned(id,value){
      const t=tabs.find(x=>x.id===id);
      if(!t)return false;
      t.pinned=Boolean(value);
      tabs.sort((a,b)=>Number(b.pinned)-Number(a.pinned));
      persist();renderTabs();
      return true;
    }

    function closeOthers(id){
      const keep=tabs.find(t=>t.id===id);
      if(!keep)return;
      const removed=tabs.filter(t=>t.id!==id&&!t.pinned);
      removed.forEach(t=>edgeState.closedTabs.unshift(clone(t)));
      tabs=tabs.filter(t=>t.id===id||t.pinned);
      activeId=id;
      edgeState.closedTabs=edgeState.closedTabs.slice(0,20);
      persist();renderTabs();renderActive();
    }

    function closeRight(id){
      const index=tabs.findIndex(t=>t.id===id);
      if(index<0)return;
      const keep=tabs.slice(0,index+1);
      const right=tabs.slice(index+1);
      const pinnedRight=right.filter(t=>t.pinned);
      const removed=right.filter(t=>!t.pinned);
      removed.forEach(t=>edgeState.closedTabs.unshift(clone(t)));
      tabs=[...keep,...pinnedRight];
      if(!tabs.some(t=>t.id===activeId))activeId=id;
      edgeState.closedTabs=edgeState.closedTabs.slice(0,20);
      persist();renderTabs();renderActive();
    }

    function tabContext(t,e){
      e.preventDefault();
      e.stopPropagation();
      showContext(e.clientX,e.clientY,[
        ["Novo separador",()=>newTab()],
        ["Recarregar",()=>{activeId=t.id;renderActive()}],
        ["Duplicar",()=>duplicateTab(t.id)],
        [t.pinned?"Desafixar separador":"Fixar separador",()=>setPinned(t.id,!t.pinned)],
        ["Fechar",()=>closeTab(t.id)],
        ["Fechar outros",()=>closeOthers(t.id)],
        ["Fechar separadores à direita",()=>closeRight(t.id)],
        ["Reabrir separador fechado",()=>reopenClosedTab()]
      ]);
    }

    function renderTabs(){
      tabsBox.innerHTML="";
      tabs.forEach(t=>{
        const b=document.createElement("button");
        b.className="edge-real-tab"+(t.id===activeId?" active":"")+(t.pinned?" pinned":"");
        b.dataset.tab=t.id;
        b.title=t.title;
        b.innerHTML=
          '<span class="tab-favicon">'+escapeHTML(t.favicon||"🌐")+'</span>'+
          '<span class="tab-label">'+escapeHTML(t.title)+'</span>'+
          (t.pinned?"":'<span class="tab-close" role="button">×</span>');
        b.onclick=()=>{activeId=t.id;persist();renderTabs();renderActive()};
        b.oncontextmenu=e=>tabContext(t,e);
        b.querySelector(".tab-close")?.addEventListener("click",e=>{e.stopPropagation();closeTab(t.id)});
        tabsBox.appendChild(b);
      });
    }

    function push(t,url){
      t.history=t.history.slice(0,t.index+1);
      t.history.push(url);
      t.history=t.history.slice(-60);
      t.index=t.history.length-1;
      t.url=url;
      t.title=titleFor(url);
      t.favicon=faviconFor(url);
    }

    function navigate(raw,{pushHistory=true,recordHistory=true}={}){
      const t=current();
      if(!t)return;
      const url=normalize(raw);
      if(pushHistory)push(t,url);
      else{
        t.url=url;
        t.title=titleFor(url);
        t.favicon=faviconFor(url);
      }
      if(recordHistory)addHistory(url,t.title);
      persist();
      renderTabs();
      renderActive();
    }
    wrap.__edgeV730=Object.freeze({
      navigate:(url,options={})=>{navigate(url,options);return true},
      newTab:(url,options={})=>clone(newTab(url,options)),
      getCurrent:()=>clone(current()||null),
      render:()=>{renderTabs();renderActive();return true}
    });

    function openExternal(url=current()?.url){
      const target=BASE.externalUrlFor(url||"");
      if(!/^https?:\/\//i.test(target||"")){
        notify("Microsoft Edge","Este separador não contém um endereço Web externo.");
        return false;
      }
      const opened=window.open(target,"_blank","noopener,noreferrer");
      if(!opened){
        notify("Microsoft Edge","O browser bloqueou a nova janela. Autorize pop-ups para abrir o site real.");
        return false;
      }
      return true;
    }

    function renderFavoriteButton(){
      const b=wrap.querySelector("[data-favorite]");
      const t=current();
      if(!b||!t)return;
      const fav=isFavorite(t.url);
      b.textContent=fav?"★":"☆";
      b.classList.toggle("active",fav);
      b.title=fav?"Remover dos favoritos":"Adicionar aos favoritos";
    }

    function renderFavoritesBar(){
      favoritesBar.hidden=!edgeState.showFavoritesBar;
      favoritesBar.innerHTML="";
      if(!edgeState.showFavoritesBar)return;
      const items=edgeState.favorites.slice(0,10);
      if(!items.length){
        favoritesBar.innerHTML='<span class="edge-favorites-empty">Adicione favoritos com ☆</span>';
        return;
      }
      items.forEach(f=>{
        const b=document.createElement("button");
        b.className="edge-favorite-chip";
        b.title=f.url;
        b.innerHTML='<span>'+escapeHTML(faviconFor(f.url))+'</span><span>'+escapeHTML(f.title)+'</span>';
        b.onclick=()=>navigate(f.url);
        favoritesBar.appendChild(b);
      });
    }

    function renderHome(){
      page.innerHTML=
        '<div class="edge-home edge-v720-home edge-v730-home">'+
          '<div class="edge-v720-brand"><div class="edge-logo">🌐</div><h1>Microsoft Edge</h1><p>Google, YouTube, Ouvir Música, favoritos, histórico e sessão persistente.</p></div>'+
          '<div class="edge-search edge-v720-search"><input placeholder="Pesquisar no Google"><button>Pesquisar</button></div>'+
          '<div class="edge-v720-shortcuts">'+
            '<button data-edge-shortcut="https://www.google.com/webhp?igu=1&newwindow=0"><span class="edge-shortcut-icon google">G</span><strong>Google</strong></button>'+
            '<button data-edge-shortcut="edge://youtube"><span class="edge-shortcut-icon youtube">▶</span><strong>YouTube</strong></button>'+
            '<button data-edge-shortcut="'+OUVIR_MUSICA_URL+'"><span class="edge-shortcut-icon ouvir">♪</span><strong>Ouvir Música</strong></button>'+
            '<button data-edge-shortcut="edge://favorites"><span class="edge-shortcut-icon">★</span><strong>Favoritos</strong></button>'+
            '<button data-edge-shortcut="edge://history"><span class="edge-shortcut-icon">🕘</span><strong>Histórico</strong></button>'+
          '</div>'+
          '<div class="edge-v730-dashboard">'+
            '<button data-edge-dashboard="edge://downloads"><span>↓</span><strong>Downloads</strong><small>'+edgeState.downloads.length+' item(ns)</small></button>'+
            '<button data-edge-dashboard="edge://settings"><span>⚙</span><strong>Definições</strong><small>Arranque e barra de favoritos</small></button>'+
            '<button data-edge-dashboard="edge://youtube"><span>▶</span><strong>YouTube</strong><small>Player interno para vídeos e playlists</small></button>'+
            '<button data-edge-dashboard="'+OUVIR_MUSICA_URL+'"><span>♪</span><strong>Ouvir Música</strong><small>Músicas e playlists no site real</small></button>'+
          '</div>'+
        '</div>';
      const input=page.querySelector(".edge-search input");
      const go=()=>navigate(input.value);
      page.querySelector(".edge-search button").onclick=go;
      input.onkeydown=e=>{if(e.key==="Enter")go()};
      page.querySelectorAll("[data-edge-shortcut]").forEach(b=>b.onclick=()=>navigate(b.dataset.edgeShortcut));
      page.querySelectorAll("[data-edge-dashboard]").forEach(b=>b.onclick=()=>navigate(b.dataset.edgeDashboard));
    }

    function renderFavoritesPage(){
      const rows=edgeState.favorites;
      page.innerHTML=
        '<div class="edge-internal-page edge-favorites-page">'+
          '<div class="edge-internal-head"><div><h2>Favoritos</h2><p>'+rows.length+' favorito(s) guardado(s) neste perfil.</p></div>'+
          '<button class="sys-button" data-favorites-bar-toggle>'+(edgeState.showFavoritesBar?"Ocultar barra":"Mostrar barra")+'</button></div>'+
          '<div class="edge-internal-list" data-favorite-list></div>'+
        '</div>';
      const list=page.querySelector("[data-favorite-list]");
      if(!rows.length){
        list.innerHTML='<div class="edge-empty-state">Ainda não existem favoritos.</div>';
      }else rows.forEach(f=>{
        const row=document.createElement("div");
        row.className="edge-internal-row";
        row.innerHTML=
          '<button class="edge-internal-main"><span class="edge-row-icon">'+escapeHTML(faviconFor(f.url))+'</span><span><strong>'+escapeHTML(f.title)+'</strong><small>'+escapeHTML(f.url)+'</small></span></button>'+
          '<button class="edge-row-action" title="Remover">×</button>';
        row.querySelector(".edge-internal-main").onclick=()=>navigate(f.url);
        row.querySelector(".edge-row-action").onclick=()=>{removeFavorite(f.id);renderFavoritesPage();renderFavoritesBar();renderFavoriteButton()};
        list.appendChild(row);
      });
      page.querySelector("[data-favorites-bar-toggle]").onclick=()=>{
        edgeState.showFavoritesBar=!edgeState.showFavoritesBar;
        saveState();renderFavoritesBar();renderFavoritesPage();
      };
    }

    function renderHistoryPage(){
      const rows=edgeState.history;
      page.innerHTML=
        '<div class="edge-internal-page edge-history-page">'+
          '<div class="edge-internal-head"><div><h2>Histórico</h2><p>Histórico de navegação deste perfil.</p></div><button class="sys-button" data-clear-history>Limpar histórico</button></div>'+
          '<div class="edge-internal-search"><input placeholder="Pesquisar histórico" data-history-search></div>'+
          '<div class="edge-internal-list" data-history-list></div>'+
        '</div>';
      const list=page.querySelector("[data-history-list]");
      const input=page.querySelector("[data-history-search]");
      const draw=()=>{
        const q=input.value.trim().toLocaleLowerCase("pt-PT");
        const filtered=rows.filter(h=>!q||h.title.toLocaleLowerCase("pt-PT").includes(q)||h.url.toLocaleLowerCase("pt-PT").includes(q));
        list.innerHTML="";
        if(!filtered.length){list.innerHTML='<div class="edge-empty-state">Nenhum resultado no histórico.</div>';return}
        filtered.forEach(h=>{
          const row=document.createElement("button");
          row.className="edge-history-row";
          row.innerHTML=
            '<span class="edge-row-icon">'+escapeHTML(faviconFor(h.url))+'</span>'+
            '<span class="edge-history-main"><strong>'+escapeHTML(h.title)+'</strong><small>'+escapeHTML(h.url)+'</small></span>'+
            '<time>'+escapeHTML(new Date(h.visitedAt).toLocaleString("pt-PT"))+'</time>';
          row.onclick=()=>navigate(h.url);
          list.appendChild(row);
        });
      };
      input.oninput=draw;
      page.querySelector("[data-clear-history]").onclick=()=>{
        showSystemDialog("Limpar histórico","<p>Eliminar todo o histórico de navegação deste perfil?</p>","Limpar",()=>{clearHistory();renderHistoryPage()});
      };
      draw();
    }

    function downloadStatusLabel(item){
      if(item.status==="downloading")return "A transferir";
      if(item.status==="failed")return "Falhou";
      if(item.status==="cancelled")return "Cancelado";
      return "Concluído";
    }

    function renderDownloadsPage(){
      page.innerHTML=
        '<div class="edge-internal-page edge-downloads-page">'+
          '<div class="edge-internal-head"><div><h2>Downloads</h2><p>Downloads iniciados pelo Edge do simulador.</p></div><button class="sys-button" data-clear-downloads>Limpar lista</button></div>'+
          '<div class="edge-download-add"><input data-download-url placeholder="https://exemplo.com/ficheiro.zip"><button class="sys-button primary" data-download-go>Transferir URL</button></div>'+
          '<div class="edge-download-note">Downloads diretos dependem de CORS do servidor. Se o site bloquear o pedido, abra o URL no site real.</div>'+
          '<div class="edge-internal-list" data-download-list></div>'+
        '</div>';
      const list=page.querySelector("[data-download-list]");
      const draw=()=>{
        list.innerHTML="";
        if(!edgeState.downloads.length){list.innerHTML='<div class="edge-empty-state">Nenhum download registado.</div>';return}
        edgeState.downloads.forEach(d=>{
          const row=document.createElement("div");
          row.className="edge-download-row "+d.status;
          row.innerHTML=
            '<span class="edge-row-icon">↓</span>'+
            '<span class="edge-download-main"><strong>'+escapeHTML(d.name)+'</strong><small>'+escapeHTML(d.url||"")+'</small><em>'+escapeHTML(downloadStatusLabel(d))+(d.size?" · "+formatBytes(d.size):"")+(d.error?" · "+escapeHTML(d.error):"")+'</em></span>'+
            (/^https?:\/\//i.test(d.url||"")?'<button class="edge-row-action" data-open-download title="Abrir URL">↗</button>':"");
          row.querySelector("[data-open-download]")?.addEventListener("click",()=>window.open(d.url,"_blank","noopener,noreferrer"));
          list.appendChild(row);
        });
      };
      page.querySelector("[data-download-go]").onclick=async()=>{
        const input=page.querySelector("[data-download-url]");
        const value=input.value.trim();
        if(!value)return;
        const btn=page.querySelector("[data-download-go]");
        btn.disabled=true;
        try{
          await downloadUrl(value,draw);
          notify("Microsoft Edge","Download concluído.");
          input.value="";
        }catch(err){
          if(err?.name!=="AbortError")notify("Microsoft Edge","Download falhou: "+(err?.message||"erro"));
        }finally{
          if(btn.isConnected)btn.disabled=false;
          draw();
        }
      };
      page.querySelector("[data-download-url]").onkeydown=e=>{if(e.key==="Enter")page.querySelector("[data-download-go]").click()};
      page.querySelector("[data-clear-downloads]").onclick=()=>{clearDownloads();draw()};
      draw();
    }

    function renderSettingsPage(){
      const searchStatus=SEARCH.providerStatus();
      const googleCx=SEARCH.getGoogleCx();
      page.innerHTML=
        '<div class="edge-internal-page edge-settings-page">'+
          '<div class="edge-internal-head"><div><h2>Definições do Edge</h2><p>Preferências guardadas apenas neste perfil.</p></div></div>'+
          '<div class="edge-settings-cards">'+
            '<label class="edge-setting-row"><span><strong>Restaurar separadores</strong><small>Reabrir a sessão do Edge depois de refresh.</small></span><input type="checkbox" data-setting-restore '+(edgeState.restoreTabs?"checked":"")+'></label>'+
            '<label class="edge-setting-row"><span><strong>Barra de favoritos</strong><small>Mostrar favoritos por baixo da barra de endereço.</small></span><input type="checkbox" data-setting-favbar '+(edgeState.showFavoritesBar?"checked":"")+'></label>'+
            '<label class="edge-setting-row vertical"><span><strong>Página ao iniciar</strong><small>Utilizada quando não existe sessão anterior.</small></span><select data-setting-startup>'+
              '<option value="edge://newtab" '+(edgeState.startupPage==="edge://newtab"?"selected":"")+'>Novo separador</option>'+
              '<option value="edge://google" '+((edgeState.startupPage.startsWith("edge://google")||edgeState.startupPage.includes("google."))?"selected":"")+'>Google</option>'+
              '<option value="edge://youtube" '+(edgeState.startupPage.startsWith("edge://youtube")?"selected":"")+'>YouTube</option>'+
              '<option value="'+OUVIR_MUSICA_URL+'" '+(edgeState.startupPage.includes("ouvirmusica.com.br")?"selected":"")+'>Ouvir Música</option>'+
            '</select></label>'+
          '</div>'+
          '<section class="edge-search-provider-settings-v997">'+
            '<div class="edge-search-provider-head-v997"><div><h3>Pesquisa oficial</h3><p>Configure os providers oficiais usados dentro do Edge.</p></div>'+
              '<span class="edge-provider-summary-v997">'+(searchStatus.google.configured&&searchStatus.youtube.configured?"Pronto":"Configuração necessária")+'</span></div>'+
            '<label class="edge-setting-row vertical"><span><strong>Google Programmable Search Engine ID (cx)</strong><small>Não é segredo. Crie um Programmable Search Engine e cole aqui o ID cx.</small></span>'+
              '<input data-setting-google-cx value="'+escapeHTML(googleCx)+'" placeholder="Ex.: 012345678901234567890:abc_def-gh"></label>'+
            '<label class="edge-setting-row vertical"><span><strong>Abrir resultados Google</strong><small>Por defeito abre numa nova tab simulada do Edge. A barra de compatibilidade mantém sempre disponível “Abrir site completo”.</small></span>'+
              '<select data-setting-google-mode><option value="embed" '+(searchStatus.google.resultMode==="embed"?"selected":"")+'>Nova tab do Edge — recomendado</option><option value="external" '+(searchStatus.google.resultMode==="external"?"selected":"")+'>Browser real</option></select></label>'+
            '<label class="edge-setting-row vertical"><span><strong>YouTube Data API v3 — API key</strong><small>A chave fica apenas nesta sessão do browser. Restrinja-a por HTTP referrer e à YouTube Data API v3.</small></span>'+
              '<input type="password" autocomplete="off" data-setting-youtube-key placeholder="'+(searchStatus.youtube.configured?"Chave configurada nesta sessão":"Cole a API key oficial")+'"></label>'+
            '<div class="edge-provider-status-v997">'+
              '<span>Google <strong>'+(searchStatus.google.configured?"Configurado":"Por configurar")+'</strong></span>'+
              '<span>YouTube <strong>'+(searchStatus.youtube.configured?"Configurado":"Por configurar")+'</strong></span>'+
              '<span>Região <strong>'+escapeHTML(searchStatus.regionCode)+'</strong></span>'+
            '</div>'+
            '<div class="edge-settings-actions"><button class="sys-button primary" data-save-search-providers>Guardar pesquisa</button><button class="sys-button" data-clear-youtube-key>Limpar chave YouTube</button></div>'+
          '</section>'+
          '<div class="edge-settings-actions"><button class="sys-button" data-reset-edge-session>Repor separadores guardados</button><button class="sys-button" data-clear-edge-data>Limpar histórico e downloads</button></div>'+
        '</div>';
      page.querySelector("[data-setting-restore]").onchange=e=>{edgeState.restoreTabs=e.target.checked;saveState()};
      page.querySelector("[data-setting-favbar]").onchange=e=>{edgeState.showFavoritesBar=e.target.checked;saveState();renderFavoritesBar()};
      page.querySelector("[data-setting-startup]").onchange=e=>{edgeState.startupPage=e.target.value;saveState()};
      page.querySelector("[data-save-search-providers]").onclick=()=>{
        const cx=String(page.querySelector("[data-setting-google-cx]")?.value||"").trim();
        const mode=page.querySelector("[data-setting-google-mode]")?.value;
        const youtubeValue=String(page.querySelector("[data-setting-youtube-key]")?.value||"").trim();
        if(cx&&!/^[A-Za-z0-9:_-]{6,120}$/.test(cx)){notify("Microsoft Edge","ID cx inválido.");return}
        if(youtubeValue&&!/^[A-Za-z0-9_-]{20,120}$/.test(youtubeValue)){notify("Microsoft Edge","Chave YouTube inválida.");return}
        SEARCH.setGoogleCx(cx);
        SEARCH.setGoogleResultMode(mode);
        if(youtubeValue)SEARCH.setYouTubeApiKey(youtubeValue);
        notify("Microsoft Edge","Configuração de pesquisa atualizada.");
        renderSettingsPage();
      };
      page.querySelector("[data-clear-youtube-key]").onclick=()=>{
        SEARCH.clearYouTubeApiKey();
        notify("Microsoft Edge","Chave YouTube removida desta sessão.");
        renderSettingsPage();
      };
      page.querySelector("[data-reset-edge-session]").onclick=()=>{
        edgeState.tabs=[];edgeState.activeId=null;edgeState.closedTabs=[];saveState();
        notify("Microsoft Edge","Sessão guardada reposta. Será aplicada no próximo arranque do Edge.");
      };
      page.querySelector("[data-clear-edge-data]").onclick=()=>{
        edgeState.history=[];edgeState.downloads=[];saveState();
        notify("Microsoft Edge","Histórico e downloads limpos.");
      };
    }

    function renderLocal(url){
      const q=url.slice(6).trim();
      const rs=collectSearchResults(q);
      page.innerHTML='<div class="edge-v720-local"><h2>Resultados locais para “'+escapeHTML(q)+'”</h2><div class="search-results"></div></div>';
      const box=page.querySelector(".search-results");
      rs.forEach(r=>{
        const b=document.createElement("button");
        b.className="search-result";
        b.innerHTML='<span class="sr-icon">'+r.icon+'</span><span><strong>'+escapeHTML(r.name)+'</strong><small>'+escapeHTML(r.detail)+'</small></span>';
        b.onclick=()=>launchSearchResult(r);
        box.appendChild(b);
      });
    }

    function renderGoogle(url){
      let parsed=null;
      try{parsed=new URL(url)}catch{}
      const query=String(parsed?.searchParams?.get("q")||"").trim();
      const status=SEARCH.providerStatus();
      const shell=document.createElement("div");
      shell.className="edge-google-v997";
      shell.innerHTML=
        '<div class="edge-google-head-v997">'+
          '<div class="edge-google-brand-v997"><span>G</span><div><strong>Google</strong><small>Programmable Search oficial</small></div></div>'+
          '<button class="sys-button" data-google-settings-v997>Configurar</button>'+
        '</div>'+
        '<div class="edge-google-search-v997"><input data-google-query-v997 placeholder="Pesquisar no Google"><button class="sys-button primary" data-google-go-v997>Pesquisar</button></div>'+
        '<div class="edge-google-mode-v997">'+
          '<span>Resultados: <strong>'+(status.google.resultMode==="external"?"browser real":"nova tab do Edge")+'</strong></span>'+
          '<small>Sites externos podem proibir incorporação. A tab do Edge mantém uma barra própria com “Abrir site completo”.</small>'+
        '</div>'+
        '<div data-google-content-v997></div>';
      page.appendChild(shell);
      const input=shell.querySelector("[data-google-query-v997]");
      const content=shell.querySelector("[data-google-content-v997]");
      input.value=query;
      const run=()=>{
        const value=input.value.trim();
        if(value)navigate(SEARCH.googleRoute(value));
      };
      shell.querySelector("[data-google-go-v997]").onclick=run;
      input.onkeydown=e=>{if(e.key==="Enter")run()};
      shell.querySelector("[data-google-settings-v997]").onclick=()=>navigate("edge://settings");

      if(!status.google.configured){
        content.className="edge-search-setup-v997";
        content.innerHTML=
          '<div class="edge-search-setup-icon-v997">G</div>'+
          '<h2>Ativar Google oficial</h2>'+
          '<p>Crie um Google Programmable Search Engine e introduza o respetivo ID <strong>cx</strong> nas Definições do Edge.</p>'+
          '<div class="edge-search-setup-actions-v997">'+
            '<button class="sys-button primary" data-google-setup-v997>Abrir Definições</button>'+
            (query?'<button class="sys-button" data-google-classic-v997>Abrir esta pesquisa no Google ↗</button>':'')+
          '</div>';
        content.querySelector("[data-google-setup-v997]").onclick=()=>navigate("edge://settings");
        content.querySelector("[data-google-classic-v997]")?.addEventListener("click",()=>openExternal(SEARCH.googleExternalUrl(query)));
        return;
      }
      if(!query){
        content.className="edge-google-welcome-v997";
        content.innerHTML='<div class="edge-google-logo-v997">G</div><h2>Pesquisa Google</h2><p>Os resultados são renderizados pelo Google Programmable Search dentro do Edge.</p>';
        return;
      }

      content.className="edge-google-results-v997";
      content.innerHTML='<div class="edge-search-loading-v997"><span></span><strong>A pesquisar no Google…</strong></div>';
      const expected=current()?.url;
      SEARCH.renderGoogleResults(content,query,{
        onResult:href=>{
          if(SEARCH.getGoogleResultMode()==="embed"){
            newTab(href);
          }else{
            addHistory(href,titleFor(href));
            saveState();
            openExternal(href);
          }
        }
      }).catch(err=>{
        if(!content.isConnected||current()?.url!==expected)return;
        content.className="edge-search-error-v997";
        content.innerHTML='<strong>Não foi possível carregar a pesquisa Google.</strong><p>'+escapeHTML(err?.message||"Erro do provider Google.")+'</p><button class="sys-button" data-google-error-settings-v997>Ver configuração</button>';
        content.querySelector("[data-google-error-settings-v997]").onclick=()=>navigate("edge://settings");
      });
    }

    function youtubeRouteForInput(raw){
      const value=String(raw||"").trim();
      if(!value)return "edge://youtube";
      const id=BASE.safeYouTubeVideoId?.(value);
      if(id)return "edge://youtube/watch?v="+id;
      const normalized=BASE.normalize(value);
      if(String(normalized||"").startsWith("edge://youtube"))return normalized;
      return SEARCH.youtubeRoute(value);
    }

    function renderYouTube(url){
      let parsed=null;
      try{parsed=new URL(url)}catch{}
      const query=String(parsed?.searchParams?.get("query")||"").trim();
      const pageToken=String(parsed?.searchParams?.get("pageToken")||"").trim();
      const searchStatus=SEARCH.providerStatus();
      const embed=BASE.youtubeEmbedFor?.(url)||null;
      const external=BASE.externalUrlFor(url);
      const shell=document.createElement("div");
      shell.className="edge-youtube-v996";
      shell.innerHTML=
        '<div class="edge-youtube-head-v996">'+
          '<div class="edge-youtube-brand-v996"><span>▶</span><div><strong>YouTube</strong><small>Player incorporado oficial</small></div></div>'+
          '<div class="edge-youtube-actions-v996">'+
            '<button class="sys-button" data-youtube-home-v996>Início</button>'+
            '<button class="sys-button" data-youtube-external-v996>YouTube completo ↗</button>'+
          '</div>'+
        '</div>'+
        '<div class="edge-youtube-open-v996">'+
          '<input data-youtube-input-v996 placeholder="Pesquisar vídeos ou colar URL, Shorts, playlist ou ID">'+
          '<button class="sys-button primary" data-youtube-open-v996>Pesquisar / Abrir</button>'+
        '</div>'+
        '<div data-youtube-content-v996></div>';
      page.appendChild(shell);

      const input=shell.querySelector("[data-youtube-input-v996]");
      const content=shell.querySelector("[data-youtube-content-v996]");
      if(query)input.value=query;
      else if(embed)input.value=external;

      const openInput=()=>{
        const value=input.value.trim();
        if(!value)return;
        navigate(youtubeRouteForInput(value));
      };
      shell.querySelector("[data-youtube-open-v996]").onclick=openInput;
      input.onkeydown=e=>{if(e.key==="Enter")openInput()};
      shell.querySelector("[data-youtube-home-v996]").onclick=()=>navigate("edge://youtube");
      shell.querySelector("[data-youtube-external-v996]").onclick=()=>openExternal(url);

      if(embed){
        content.className="edge-youtube-player-shell-v996";
        const frame=document.createElement("iframe");
        frame.className="edge-youtube-player-v996";
        frame.src=embed;
        frame.title="YouTube video player";
        frame.referrerPolicy="strict-origin-when-cross-origin";
        frame.setAttribute("allow","accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
        frame.setAttribute("sandbox","allow-scripts allow-same-origin allow-presentation allow-popups");
        frame.setAttribute("allowfullscreen","");
        content.appendChild(frame);
        const note=document.createElement("div");
        note.className="edge-youtube-note-v996";
        note.textContent="O vídeo é reproduzido através do player incorporado oficial do YouTube.";
        content.appendChild(note);
        return;
      }

      if(query){
        if(!searchStatus.youtube.configured){
          content.className="edge-search-setup-v997";
          content.innerHTML=
            '<div class="edge-search-setup-icon-v997 youtube">▶</div>'+
            '<h2>Ativar pesquisa oficial do YouTube</h2>'+
            '<p>Configure uma chave da YouTube Data API v3 nas Definições do Edge. A pesquisa devolve apenas vídeos incorporáveis e reproduzíveis fora de youtube.com.</p>'+
            '<div class="edge-search-setup-actions-v997">'+
              '<button class="sys-button primary" data-youtube-setup-v997>Abrir Definições</button>'+
              '<button class="sys-button" data-youtube-fallback-v997>Pesquisar no YouTube completo ↗</button>'+
            '</div>';
          content.querySelector("[data-youtube-setup-v997]").onclick=()=>navigate("edge://settings");
          content.querySelector("[data-youtube-fallback-v997]").onclick=()=>openExternal(url);
          return;
        }

        content.className="edge-youtube-search-v997";
        content.innerHTML='<div class="edge-search-loading-v997"><span></span><strong>A pesquisar vídeos no YouTube…</strong></div>';
        const expected=current()?.url;
        SEARCH.youtubeSearch(query,{pageToken}).then(result=>{
          if(!content.isConnected||current()?.url!==expected)return;
          content.innerHTML="";
          const head=document.createElement("div");
          head.className="edge-youtube-results-head-v997";
          head.innerHTML='<div><strong>Vídeos</strong><small>'+escapeHTML(result.query)+'</small></div><span>'+result.items.length+' resultado(s)</span>';
          const grid=document.createElement("div");
          grid.className="edge-youtube-results-grid-v997";
          for(const item of result.items){
            const card=document.createElement("button");
            card.className="edge-youtube-result-v997";
            card.dataset.videoId=item.videoId;
            const media=document.createElement("span");
            media.className="edge-youtube-thumb-v997";
            if(item.thumbnail){
              const img=document.createElement("img");
              img.src=item.thumbnail;img.alt="";img.loading="lazy";img.referrerPolicy="no-referrer";
              media.appendChild(img);
            }else{
              media.textContent="▶";
            }
            const meta=document.createElement("span");
            meta.className="edge-youtube-result-meta-v997";
            const title=document.createElement("strong");
            title.textContent=item.title;
            const date=document.createElement("small");
            date.textContent=item.publishedAt?new Date(item.publishedAt).toLocaleDateString("pt-PT"):"Vídeo";
            meta.append(title,date);
            card.append(media,meta);
            card.onclick=()=>navigate("edge://youtube/watch?v="+encodeURIComponent(item.videoId));
            grid.appendChild(card);
          }
          const pager=document.createElement("div");
          pager.className="edge-youtube-pager-v997";
          if(result.prevPageToken){
            const prev=document.createElement("button");prev.className="sys-button";prev.textContent="← Anterior";
            prev.onclick=()=>navigate(SEARCH.youtubeRoute(query,{pageToken:result.prevPageToken}));
            pager.appendChild(prev);
          }
          if(result.nextPageToken){
            const next=document.createElement("button");next.className="sys-button";next.textContent="Mais vídeos →";
            next.onclick=()=>navigate(SEARCH.youtubeRoute(query,{pageToken:result.nextPageToken}));
            pager.appendChild(next);
          }
          content.append(head,grid,pager);
        }).catch(err=>{
          if(!content.isConnected||current()?.url!==expected)return;
          content.className="edge-search-error-v997";
          content.innerHTML='<strong>Não foi possível pesquisar no YouTube.</strong><p>'+escapeHTML(err?.message||"Erro da YouTube Data API.")+'</p><div><button class="sys-button" data-youtube-error-settings-v997>Ver configuração</button><button class="sys-button" data-youtube-error-external-v997>Abrir YouTube ↗</button></div>';
          content.querySelector("[data-youtube-error-settings-v997]").onclick=()=>navigate("edge://settings");
          content.querySelector("[data-youtube-error-external-v997]").onclick=()=>openExternal(url);
        });
        return;
      }

      content.className="edge-youtube-welcome-v996";
      content.innerHTML=
        '<div class="edge-youtube-logo-v996">▶</div>'+
        '<h2>YouTube dentro do Edge</h2>'+
        '<p>'+(searchStatus.youtube.configured
          ?'Pesquise acima. Os resultados vêm da YouTube Data API v3 e mostram apenas vídeos que podem ser incorporados e reproduzidos fora de youtube.com.'
          :'Pode abrir links diretamente. Para pesquisar vídeos aqui dentro, configure a YouTube Data API v3 nas Definições do Edge.')+'</p>'+
        '<div class="edge-youtube-welcome-actions-v996">'+
          (!searchStatus.youtube.configured?'<button class="sys-button primary" data-youtube-settings-v997>Configurar pesquisa</button>':'')+
          '<button class="sys-button" data-youtube-demo-v996>Testar player</button>'+
        '</div>'+
        '<small>Sem contas, comentários, subscrições ou resultados de canais — apenas pesquisa e reprodução de vídeos.</small>';
      content.querySelector("[data-youtube-settings-v997]")?.addEventListener("click",()=>navigate("edge://settings"));
      content.querySelector("[data-youtube-demo-v996]").onclick=()=>navigate("edge://youtube/watch?v=M7lc1UVf-VE");
    }

    function renderCompatibility(url,reason="Este site bloqueia a incorporação em aplicações Web."){
      let host="site";
      try{host=new URL(url).hostname}catch{}
      page.innerHTML=
        '<div class="edge-compat-page">'+
          '<div class="edge-compat-icon">🌐</div><h2>'+escapeHTML(host)+'</h2><p>'+escapeHTML(reason)+'</p>'+
          '<div class="edge-compat-actions"><button class="sys-button primary" data-compat-open>Abrir site real ↗</button><button class="sys-button" data-compat-google>Pesquisar no Google</button></div>'+
          '<small>O simulador não contorna X-Frame-Options nem Content-Security-Policy.</small>'+
        '</div>';
      page.querySelector("[data-compat-open]").onclick=()=>openExternal(url);
      page.querySelector("[data-compat-google]").onclick=()=>navigate("site:"+host+" "+url);
    }

    function renderWeb(url){
      if(BASE.knownFrameBlocker(url)){renderCompatibility(url);return}
      const shell=document.createElement("div");
      shell.className="edge-site-shell edge-v720-site";
      const isGoogle=(()=>{try{return Boolean(BASE.isGoogleHost?.(new URL(url).hostname))}catch{return false}})();
      const note=document.createElement("div");
      note.className="edge-site-note";
      note.innerHTML=isGoogle
        ?'<span>G Google · navegação no mesmo conteúdo quando permitida</span><button data-ext>Abrir Google completo ↗</button>'
        :'<span>🔒 HTTPS · se o site bloquear a incorporação, use “Abrir site completo”</span><button data-ext>Abrir site completo ↗</button>';
      const frame=document.createElement("iframe");
      frame.className="edge-tab-frame";
      frame.src=url;
      frame.referrerPolicy="strict-origin-when-cross-origin";
      if(OUVIR_MUSICA_HOSTS.has(new URL(url).hostname.toLowerCase()))frame.setAttribute("allow","autoplay; encrypted-media");
      frame.setAttribute("sandbox","allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-storage-access-by-user-activation");
      shell.append(note,frame);
      page.appendChild(shell);
      note.querySelector("[data-ext]").onclick=()=>openExternal(url);
    }

    function renderActive(){
      const t=current();
      if(!t)return;
      address.value=t.url;
      page.innerHTML="";
      renderFavoriteButton();
      renderFavoritesBar();

      if(t.url==="edge://newtab"){renderHome();return}
      if(t.url==="edge://favorites"){renderFavoritesPage();return}
      if(t.url==="edge://history"){renderHistoryPage();return}
      if(t.url==="edge://downloads"){renderDownloadsPage();return}
      if(t.url==="edge://settings"){renderSettingsPage();return}
      if(t.url.startsWith("edge://google")){renderGoogle(t.url);return}
      if(t.url.startsWith("local:")){renderLocal(t.url);return}
      if(t.url.startsWith("edge://youtube")){renderYouTube(t.url);return}
      renderWeb(t.url);
    }

    function focusAddress(){
      address.focus();
      address.select();
    }

    function cycleTab(direction=1){
      if(tabs.length<2)return;
      const index=tabs.findIndex(t=>t.id===activeId);
      const next=(index+direction+tabs.length)%tabs.length;
      activeId=tabs[next].id;
      persist();renderTabs();renderActive();
    }

    function onKeyDown(e){
      const win=wrap.closest(".window");
      if(!win?.classList.contains("focused"))return;
      const ctrl=e.ctrlKey||e.metaKey;
      if(!ctrl)return;
      const key=e.key.toLowerCase();
      if(key==="t"&&!e.shiftKey){e.preventDefault();newTab();return}
      if(key==="w"&&!e.shiftKey){e.preventDefault();closeTab(activeId);return}
      if(key==="t"&&e.shiftKey){e.preventDefault();reopenClosedTab();return}
      if(key==="l"){e.preventDefault();focusAddress();return}
      if(key==="r"){e.preventDefault();renderActive();return}
      if(key==="tab"){e.preventDefault();cycleTab(e.shiftKey?-1:1);return}
    }

    wrap.querySelector("[data-new-tab]").onclick=()=>newTab();
    wrap.querySelector("[data-go]").onclick=()=>navigate(address.value);
    wrap.querySelector("[data-home]").onclick=()=>navigate("edge://newtab");
    wrap.querySelector("[data-favorite]").onclick=()=>{
      const t=current();
      if(!t)return;
      const added=toggleFavorite(t.url,t.title);
      notify("Microsoft Edge",added?"Adicionado aos favoritos.":"Removido dos favoritos.");
      renderFavoriteButton();renderFavoritesBar();
    };
    wrap.querySelector("[data-downloads]").onclick=()=>navigate("edge://downloads");
    wrap.querySelector("[data-history]").onclick=()=>navigate("edge://history");
    wrap.querySelector("[data-menu]").onclick=e=>showContext(e.clientX,e.clientY,[
      ["Novo separador",()=>newTab()],
      ["Favoritos",()=>navigate("edge://favorites")],
      ["Histórico",()=>navigate("edge://history")],
      ["Downloads",()=>navigate("edge://downloads")],
      ["Definições",()=>navigate("edge://settings")],
      ["Reabrir separador fechado",()=>reopenClosedTab()],
      ["Abrir site atual no browser real",()=>openExternal()]
    ]);
    wrap.querySelector("[data-reload]").onclick=()=>renderActive();
    wrap.querySelector("[data-back]").onclick=()=>{
      const t=current();
      if(t&&t.index>0){
        t.index--;
        t.url=t.history[t.index];
        t.title=titleFor(t.url);t.favicon=faviconFor(t.url);
        addHistory(t.url,t.title);persist();renderTabs();renderActive();
      }
    };
    wrap.querySelector("[data-forward]").onclick=()=>{
      const t=current();
      if(t&&t.index<t.history.length-1){
        t.index++;
        t.url=t.history[t.index];
        t.title=titleFor(t.url);t.favicon=faviconFor(t.url);
        addHistory(t.url,t.title);persist();renderTabs();renderActive();
      }
    };
    address.onkeydown=e=>{if(e.key==="Enter")navigate(address.value)};

    document.addEventListener("keydown",onKeyDown,true);
    cleanupTimer=setInterval(()=>{
      if(wrap.isConnected)return;
      clearInterval(cleanupTimer);
      document.removeEventListener("keydown",onKeyDown,true);
    },900);

    restoreState();
    persist();
    renderTabs();
    renderActive();
  }

  globalThis.buildEdge=buildEdgeV730;

  globalThis.Win11EdgeAdvanced=Object.freeze({
    version:"9.9.7",
    ensureEdgeState,
    normalize,
    addHistory,
    toggleFavorite,
    clearHistory,
    clearDownloads,
    recordDownload,
    downloadUrl,
    buildEdge:buildEdgeV730
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"8.1.0",
    step:12,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "edge-favorites","edge-history","edge-downloads","edge-persistent-tabs",
      "edge-pinned-tabs","edge-reopen-closed-tab","edge-tab-context-menu","edge-keyboard-shortcuts",
      "edge-google-same-frame","edge-google-regional","edge-youtube-embed",
      "edge-youtube-shortlinks","edge-youtube-playlists","edge-youtube-internal-page",
      "edge-google-programmable-search","edge-youtube-data-api-search",
      "edge-search-provider-settings","edge-search-result-routing"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
