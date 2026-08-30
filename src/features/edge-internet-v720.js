"use strict";
/* Windows 11 Simulator V7.2 — Edge Internet Compatibility */
(function installEdgeInternetV720(){
  const GOOGLE_HOSTS=new Set(["google.com","www.google.com"]);
  const YOUTUBE_HOSTS=new Set(["youtube.com","www.youtube.com","m.youtube.com","youtu.be","www.youtu.be"]);
  const KNOWN_FRAME_BLOCKERS=new Set([
    "youtube.com","www.youtube.com","m.youtube.com",
    "accounts.google.com","mail.google.com",
    "facebook.com","www.facebook.com",
    "instagram.com","www.instagram.com",
    "x.com","www.x.com","twitter.com","www.twitter.com",
    "tiktok.com","www.tiktok.com"
  ]);

  function decodeMaybe(value){
    try{return decodeURIComponent(value)}catch{return value}
  }

  function parseTime(value){
    if(!value)return 0;
    const s=String(value).trim().toLowerCase();
    if(/^\d+$/.test(s))return Number(s);
    const h=Number((s.match(/(\d+)h/)||[])[1]||0);
    const m=Number((s.match(/(\d+)m/)||[])[1]||0);
    const sec=Number((s.match(/(\d+)s/)||[])[1]||0);
    return h*3600+m*60+sec;
  }

  function youtubeInfo(raw){
    try{
      const url=new URL(raw);
      const host=url.hostname.toLowerCase();
      if(!YOUTUBE_HOSTS.has(host))return null;

      let videoId="";
      let listId=url.searchParams.get("list")||"";
      let start=parseTime(url.searchParams.get("t")||url.searchParams.get("start")||"");

      if(host==="youtu.be"||host==="www.youtu.be"){
        videoId=url.pathname.split("/").filter(Boolean)[0]||"";
      }else if(url.pathname==="/watch"){
        videoId=url.searchParams.get("v")||"";
      }else{
        const parts=url.pathname.split("/").filter(Boolean);
        if(["shorts","embed","live"].includes(parts[0]))videoId=parts[1]||"";
        if(parts[0]==="playlist"&&!listId)listId=url.searchParams.get("list")||"";
      }

      const validId=/^[A-Za-z0-9_-]{6,20}$/.test(videoId)?videoId:"";
      const validList=/^[A-Za-z0-9_-]{8,80}$/.test(listId)?listId:"";
      const searchQuery=url.pathname==="/results"?(url.searchParams.get("search_query")||""):"";

      return {
        host,
        videoId:validId,
        listId:validList,
        start:Math.max(0,Math.floor(start||0)),
        searchQuery,
        isHome:!validId&&!validList&&!searchQuery&&(url.pathname==="/"||url.pathname===""),
        original:url.href
      };
    }catch{return null}
  }

  function ensureGoogleEmbed(raw){
    try{
      const url=new URL(raw);
      if(!GOOGLE_HOSTS.has(url.hostname.toLowerCase()))return raw;
      if(url.pathname==="/"||url.pathname==="/webhp"){
        url.pathname="/webhp";
        url.searchParams.set("igu","1");
        return url.href;
      }
      if(url.pathname==="/search"){
        url.searchParams.set("igu","1");
        return url.href;
      }
      return url.href;
    }catch{return raw}
  }

  function normalize(raw){
    const value=String(raw||"").trim();
    if(!value)return "edge://newtab";
    if(value==="edge://newtab"||value.startsWith("local:")||value.startsWith("edge://youtube"))return value;

    if(/^yt\s*:/i.test(value)){
      const q=value.replace(/^yt\s*:/i,"").trim();
      return q?"edge://youtube/search?q="+encodeURIComponent(q):"edge://youtube";
    }

    if(/^https?:\/\//i.test(value)){
      const yt=youtubeInfo(value);
      if(yt){
        if(yt.videoId){
          const p=new URLSearchParams({v:yt.videoId});
          if(yt.listId)p.set("list",yt.listId);
          if(yt.start)p.set("start",String(yt.start));
          return "edge://youtube/watch?"+p.toString();
        }
        if(yt.listId)return "edge://youtube/playlist?list="+encodeURIComponent(yt.listId);
        if(yt.searchQuery)return "edge://youtube/search?q="+encodeURIComponent(yt.searchQuery);
        return "edge://youtube";
      }
      return ensureGoogleEmbed(value);
    }

    if(!/\s/.test(value)&&/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)){
      return normalize("https://"+value);
    }

    return "https://www.google.com/search?igu=1&q="+encodeURIComponent(value);
  }

  function titleFor(url){
    if(url==="edge://newtab")return "Novo separador";
    if(url.startsWith("local:"))return "Pesquisa local";
    if(url==="edge://youtube")return "YouTube";
    if(url.startsWith("edge://youtube/watch"))return "YouTube · vídeo";
    if(url.startsWith("edge://youtube/playlist"))return "YouTube · playlist";
    if(url.startsWith("edge://youtube/search"))return "YouTube · pesquisa";
    try{
      const u=new URL(url);
      if(GOOGLE_HOSTS.has(u.hostname.toLowerCase()))return "Google";
      return u.hostname.replace(/^www\./,"");
    }catch{return "Microsoft Edge"}
  }

  function faviconFor(url){
    if(url==="edge://newtab")return "🌐";
    if(url.startsWith("local:"))return "🔎";
    if(url.startsWith("edge://youtube"))return "▶";
    try{
      const u=new URL(url);
      if(GOOGLE_HOSTS.has(u.hostname.toLowerCase()))return "G";
      if(u.hostname.includes("github.com"))return "◆";
      if(u.hostname.includes("wikipedia.org"))return "W";
      return "🌐";
    }catch{return "🌐"}
  }

  function externalUrlFor(edgeUrl){
    if(edgeUrl==="edge://youtube")return "https://www.youtube.com/";
    if(edgeUrl.startsWith("edge://youtube/search")){
      const q=new URL(edgeUrl).searchParams.get("q")||"";
      return "https://www.youtube.com/results?search_query="+encodeURIComponent(q);
    }
    if(edgeUrl.startsWith("edge://youtube/watch")){
      const u=new URL(edgeUrl);
      const id=u.searchParams.get("v")||"";
      const list=u.searchParams.get("list")||"";
      const start=u.searchParams.get("start")||"";
      let out="https://www.youtube.com/watch?v="+encodeURIComponent(id);
      if(list)out+="&list="+encodeURIComponent(list);
      if(start)out+="&t="+encodeURIComponent(start)+"s";
      return out;
    }
    if(edgeUrl.startsWith("edge://youtube/playlist")){
      const list=new URL(edgeUrl).searchParams.get("list")||"";
      return "https://www.youtube.com/playlist?list="+encodeURIComponent(list);
    }
    return edgeUrl;
  }

  function youtubeEmbedUrl(edgeUrl){
    const u=new URL(edgeUrl);
    const origin=location.origin;
    if(edgeUrl.startsWith("edge://youtube/watch")){
      const id=u.searchParams.get("v")||"";
      const list=u.searchParams.get("list")||"";
      const start=u.searchParams.get("start")||"";
      const params=new URLSearchParams({
        rel:"0",
        playsinline:"1",
        origin
      });
      if(list)params.set("list",list);
      if(start)params.set("start",start);
      return "https://www.youtube.com/embed/"+encodeURIComponent(id)+"?"+params.toString();
    }
    if(edgeUrl.startsWith("edge://youtube/playlist")){
      const list=u.searchParams.get("list")||"";
      const params=new URLSearchParams({
        list,
        rel:"0",
        playsinline:"1",
        origin
      });
      return "https://www.youtube.com/embed/videoseries?"+params.toString();
    }
    return "";
  }

  function knownFrameBlocker(url){
    try{return KNOWN_FRAME_BLOCKERS.has(new URL(url).hostname.toLowerCase())}
    catch{return false}
  }

  function buildEdgeV720(wrap){
    wrap.className="edge-real edge-v720";
    wrap.innerHTML=
      '<div class="edge-real-tabs"><div data-tabs class="edge-v720-tabs"></div><button class="edge-new-tab" data-new-tab title="Novo separador">＋</button></div>'+
      '<div class="edge-real-bar">'+
        '<button data-back title="Voltar">←</button>'+
        '<button data-forward title="Avançar">→</button>'+
        '<button data-reload title="Recarregar">↻</button>'+
        '<button data-home title="Página inicial">⌂</button>'+
        '<input class="edge-real-address" aria-label="Barra de endereço" placeholder="Pesquisar no Google ou introduzir URL">'+
        '<button data-go title="Ir">→</button>'+
        '<button data-external title="Abrir site real">↗</button>'+
      '</div>'+
      '<div class="edge-real-page"></div>';

    const tabsBox=wrap.querySelector("[data-tabs]");
    const address=wrap.querySelector(".edge-real-address");
    const page=wrap.querySelector(".edge-real-page");
    let seq=0,activeId=null,tabs=[];

    function current(){return tabs.find(t=>t.id===activeId)}

    function newTab(url="edge://newtab"){
      const normalized=normalize(url);
      const t={
        id:"tab-"+(++seq),
        url:normalized,
        history:[normalized],
        index:0,
        title:titleFor(normalized),
        favicon:faviconFor(normalized)
      };
      tabs.push(t);
      activeId=t.id;
      renderTabs();
      renderActive();
      return t;
    }

    function closeTab(id,e){
      e?.stopPropagation();
      const i=tabs.findIndex(t=>t.id===id);
      if(i<0)return;
      tabs.splice(i,1);
      if(!tabs.length){newTab();return}
      if(activeId===id)activeId=tabs[Math.max(0,i-1)]?.id||tabs[0].id;
      renderTabs();renderActive();
    }

    function renderTabs(){
      tabsBox.innerHTML="";
      tabs.forEach(t=>{
        const b=document.createElement("button");
        b.className="edge-real-tab"+(t.id===activeId?" active":"");
        b.dataset.tab=t.id;
        b.innerHTML=
          '<span class="tab-favicon">'+escapeHTML(t.favicon||"🌐")+'</span>'+
          '<span class="tab-label">'+escapeHTML(t.title)+'</span>'+
          '<span class="tab-close" role="button">×</span>';
        b.onclick=()=>{activeId=t.id;renderTabs();renderActive()};
        b.querySelector(".tab-close").onclick=e=>closeTab(t.id,e);
        tabsBox.appendChild(b);
      });
    }

    function push(t,url){
      t.history=t.history.slice(0,t.index+1);
      t.history.push(url);
      t.index=t.history.length-1;
      t.url=url;
      t.title=titleFor(url);
      t.favicon=faviconFor(url);
    }

    function navigate(raw,pushHistory=true){
      const t=current();
      if(!t)return;
      const url=normalize(raw);
      if(pushHistory)push(t,url);
      else{
        t.url=url;
        t.title=titleFor(url);
        t.favicon=faviconFor(url);
      }
      renderTabs();
      renderActive();
    }

    function openExternal(url=current()?.url){
      const target=externalUrlFor(url||"");
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

    function renderHome(){
      page.innerHTML=
        '<div class="edge-home edge-v720-home">'+
          '<div class="edge-v720-brand"><div class="edge-logo">🌐</div><h1>Microsoft Edge</h1><p>Internet real com compatibilidade para sites que bloqueiam incorporação.</p></div>'+
          '<div class="edge-search edge-v720-search"><input placeholder="Pesquisar no Google"><button>Pesquisar</button></div>'+
          '<div class="edge-v720-shortcuts">'+
            '<button data-edge-shortcut="https://www.google.com/webhp?igu=1"><span class="edge-shortcut-icon google">G</span><strong>Google</strong></button>'+
            '<button data-edge-shortcut="edge://youtube"><span class="edge-shortcut-icon youtube">▶</span><strong>YouTube</strong></button>'+
            '<button data-edge-shortcut="https://pt.wikipedia.org/"><span class="edge-shortcut-icon">W</span><strong>Wikipedia</strong></button>'+
            '<button data-edge-shortcut="https://github.com/"><span class="edge-shortcut-icon">◆</span><strong>GitHub</strong></button>'+
          '</div>'+
          '<div class="edge-cards edge-v720-cards">'+
            '<div class="edge-card"><strong>Google</strong><p>Pesquisa incorporada quando permitida pelo Google.</p></div>'+
            '<div class="edge-card"><strong>YouTube</strong><p>Links de vídeo e playlists usam o player oficial incorporado.</p></div>'+
            '<div class="edge-card"><strong>Sites incompatíveis</strong><p>Abra o site real externamente quando bloquear iframe.</p></div>'+
          '</div>'+
        '</div>';

      const input=page.querySelector(".edge-search input");
      const go=()=>navigate(input.value);
      page.querySelector(".edge-search button").onclick=go;
      input.onkeydown=e=>{if(e.key==="Enter")go()};
      page.querySelectorAll("[data-edge-shortcut]").forEach(b=>b.onclick=()=>navigate(b.dataset.edgeShortcut));
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

    function renderYouTubePortal(edgeUrl){
      const parsed=edgeUrl==="edge://youtube"?null:new URL(edgeUrl);
      const q=parsed?.searchParams.get("q")||"";
      page.innerHTML=
        '<div class="edge-youtube-portal">'+
          '<div class="edge-youtube-head"><span class="edge-youtube-logo">▶</span><strong>YouTube</strong><span>modo compatibilidade</span></div>'+
          '<div class="edge-youtube-search">'+
            '<input data-youtube-search placeholder="Pesquisar no YouTube" value="'+escapeHTML(q)+'">'+
            '<button class="sys-button primary" data-youtube-search-go>Pesquisar</button>'+
          '</div>'+
          '<div class="edge-youtube-linkbox">'+
            '<label>Abrir vídeo por URL</label>'+
            '<div><input data-youtube-url placeholder="https://youtu.be/..."><button class="sys-button" data-youtube-url-go>Abrir vídeo</button></div>'+
          '</div>'+
          (q?'<div class="edge-youtube-search-state"><strong>Pesquisa: '+escapeHTML(q)+'</strong><p>O site completo do YouTube bloqueia incorporação. Abra os resultados no YouTube real ou cole aqui o URL de um vídeo para reproduzi-lo dentro do Edge.</p><button class="sys-button primary" data-youtube-external-search>Abrir resultados no YouTube ↗</button></div>':
          '<div class="edge-youtube-info"><h2>YouTube dentro do Edge</h2><p>Vídeos e playlists específicas são reproduzidos pelo player oficial. Para navegar no site completo, utilize “Abrir YouTube real”.</p><div class="edge-youtube-actions"><button class="sys-button primary" data-youtube-external>Abrir YouTube real ↗</button><button class="sys-button" data-youtube-sample>Testar player oficial</button></div></div>')+
        '</div>';

      const searchInput=page.querySelector("[data-youtube-search]");
      const searchGo=()=>{
        const term=searchInput.value.trim();
        if(term)navigate("edge://youtube/search?q="+encodeURIComponent(term));
      };
      page.querySelector("[data-youtube-search-go]").onclick=searchGo;
      searchInput.onkeydown=e=>{if(e.key==="Enter")searchGo()};

      const urlInput=page.querySelector("[data-youtube-url]");
      const urlGo=()=>{
        const value=urlInput.value.trim();
        if(!value)return;
        const normalized=normalize(value);
        if(normalized.startsWith("edge://youtube/watch")||normalized.startsWith("edge://youtube/playlist"))navigate(normalized);
        else notify("YouTube","Cole um link de vídeo ou playlist válido do YouTube.");
      };
      page.querySelector("[data-youtube-url-go]").onclick=urlGo;
      urlInput.onkeydown=e=>{if(e.key==="Enter")urlGo()};

      page.querySelector("[data-youtube-external]")?.addEventListener("click",()=>openExternal("edge://youtube"));
      page.querySelector("[data-youtube-external-search]")?.addEventListener("click",()=>openExternal(edgeUrl));
      page.querySelector("[data-youtube-sample]")?.addEventListener("click",()=>navigate("https://www.youtube.com/watch?v=M7lc1UVf-VE"));
    }

    function renderYouTubePlayer(edgeUrl){
      const embed=youtubeEmbedUrl(edgeUrl);
      const isPlaylist=edgeUrl.startsWith("edge://youtube/playlist");
      page.innerHTML=
        '<div class="edge-youtube-player-shell">'+
          '<div class="edge-site-note edge-youtube-note"><span>▶ YouTube · player oficial incorporado</span><div><button data-youtube-home>YouTube</button><button data-ext>Abrir no YouTube ↗</button></div></div>'+
          '<div class="edge-youtube-frame-wrap"><iframe class="edge-tab-frame edge-youtube-frame" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>'+
          '<div class="edge-youtube-player-foot">'+(isPlaylist?"Playlist YouTube":"Vídeo YouTube")+' · se o proprietário tiver desativado incorporação, utilize “Abrir no YouTube”.</div>'+
        '</div>';
      const frame=page.querySelector("iframe");
      frame.src=embed;
      page.querySelector("[data-ext]").onclick=()=>openExternal(edgeUrl);
      page.querySelector("[data-youtube-home]").onclick=()=>navigate("edge://youtube");
    }

    function renderCompatibility(url,reason="Este site bloqueia a incorporação em aplicações Web."){
      const host=(()=>{try{return new URL(url).hostname}catch{return "site"}})();
      page.innerHTML=
        '<div class="edge-compat-page">'+
          '<div class="edge-compat-icon">🌐</div>'+
          '<h2>'+escapeHTML(host)+'</h2>'+
          '<p>'+escapeHTML(reason)+'</p>'+
          '<div class="edge-compat-actions">'+
            '<button class="sys-button primary" data-compat-open>Abrir site real ↗</button>'+
            '<button class="sys-button" data-compat-google>Pesquisar este endereço no Google</button>'+
          '</div>'+
          '<small>O simulador não contorna X-Frame-Options nem Content-Security-Policy do site.</small>'+
        '</div>';
      page.querySelector("[data-compat-open]").onclick=()=>openExternal(url);
      page.querySelector("[data-compat-google]").onclick=()=>navigate("site:"+host+" "+url);
    }

    function renderWeb(url){
      if(knownFrameBlocker(url)){
        renderCompatibility(url);
        return;
      }
      const shell=document.createElement("div");
      shell.className="edge-site-shell edge-v720-site";
      const note=document.createElement("div");
      note.className="edge-site-note";
      note.innerHTML='<span>🔒 HTTPS · conteúdo Web real incorporado</span><button data-ext>Abrir site real ↗</button>';
      const frame=document.createElement("iframe");
      frame.className="edge-tab-frame";
      frame.src=url;
      frame.referrerPolicy="strict-origin-when-cross-origin";
      frame.setAttribute("sandbox","allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads");
      shell.append(note,frame);
      page.appendChild(shell);
      note.querySelector("[data-ext]").onclick=()=>openExternal(url);
    }

    function renderActive(){
      const t=current();
      if(!t)return;
      address.value=t.url;
      page.innerHTML="";

      if(t.url==="edge://newtab"){renderHome();return}
      if(t.url.startsWith("local:")){renderLocal(t.url);return}
      if(t.url==="edge://youtube"||t.url.startsWith("edge://youtube/search")){renderYouTubePortal(t.url);return}
      if(t.url.startsWith("edge://youtube/watch")||t.url.startsWith("edge://youtube/playlist")){renderYouTubePlayer(t.url);return}
      renderWeb(t.url);
    }

    wrap.querySelector("[data-new-tab]").onclick=()=>newTab();
    wrap.querySelector("[data-go]").onclick=()=>navigate(address.value);
    wrap.querySelector("[data-home]").onclick=()=>navigate("edge://newtab");
    wrap.querySelector("[data-external]").onclick=()=>openExternal();
    wrap.querySelector("[data-reload]").onclick=()=>renderActive();
    wrap.querySelector("[data-back]").onclick=()=>{
      const t=current();
      if(t&&t.index>0){
        t.index--;
        t.url=t.history[t.index];
        t.title=titleFor(t.url);
        t.favicon=faviconFor(t.url);
        renderTabs();renderActive();
      }
    };
    wrap.querySelector("[data-forward]").onclick=()=>{
      const t=current();
      if(t&&t.index<t.history.length-1){
        t.index++;
        t.url=t.history[t.index];
        t.title=titleFor(t.url);
        t.favicon=faviconFor(t.url);
        renderTabs();renderActive();
      }
    };
    address.onkeydown=e=>{if(e.key==="Enter")navigate(address.value)};
    newTab();
  }

  globalThis.buildEdge=buildEdgeV720;

  globalThis.Win11EdgeInternet=Object.freeze({
    version:"7.6.0",
    normalize,
    youtubeInfo,
    youtubeEmbedUrl,
    externalUrlFor,
    ensureGoogleEmbed,
    knownFrameBlocker,
    buildEdge:buildEdgeV720
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"7.6.0",
    step:11,
    features:[
      "real-file-open","real-file-save","download-fallback",
      "real-clipboard-write","real-clipboard-read","clipboard-manual-paste-fallback",
      "explorer-real-import","explorer-real-folder-import","explorer-drag-drop","explorer-real-export",
      "photos-real-image-open","media-real-playback",
      "local-accounts","per-user-state","session-lock","session-signout","session-switch-user",
      "pbkdf2-credentials","broadcast-session-conflict","per-user-indexeddb-ownership",
      "real-microphone-recording","real-camera","real-screen-capture",
      "real-device-info","persistent-storage","screen-wake-lock","fullscreen",
      "profile-avatar","profile-rename","credential-change","profile-backup","profile-restore","account-delete","auto-lock",
      "file-associations","open-with","native-share","real-print","real-network-status","real-quick-settings",
      "real-folder-mounts","real-folder-readwrite","real-folder-create","real-folder-rename","real-folder-delete","real-folder-persist",
      "edge-google","edge-youtube-player","edge-youtube-playlists","edge-site-compatibility","edge-external-open"
    ]
  });
})();
