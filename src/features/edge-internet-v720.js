"use strict";
/* Windows 11 Simulator V7.2 — Edge Internet Compatibility */
(function installEdgeInternetV720(){
  const GOOGLE_HOSTS=new Set(["google.com","www.google.com"]);
  const YOUTUBE_HOSTS=new Set(["youtube.com","www.youtube.com","m.youtube.com","youtu.be","www.youtu.be"]);
  const YOUTUBE_EMBED_HOST="www.youtube-nocookie.com";
  const OUVIR_MUSICA_URL="https://www.ouvirmusica.com.br/";
  const OUVIR_MUSICA_HOSTS=new Set(["ouvirmusica.com.br","www.ouvirmusica.com.br"]);
  const KNOWN_FRAME_BLOCKERS=new Set([
    "accounts.google.com","mail.google.com",
    "facebook.com","www.facebook.com",
    "instagram.com","www.instagram.com",
    "x.com","www.x.com","twitter.com","www.twitter.com",
    "tiktok.com","www.tiktok.com"
  ]);

  function decodeMaybe(value){
    try{return decodeURIComponent(value)}catch{return value}
  }

  function isGoogleHost(host){
    const value=String(host||"").toLowerCase();
    if(GOOGLE_HOSTS.has(value))return true;
    return /^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(value);
  }

  function safeYouTubeVideoId(value){
    const id=String(value||"").trim();
    return /^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
  }

  function safeYouTubePlaylistId(value){
    const id=String(value||"").trim();
    return /^[A-Za-z0-9_-]{10,100}$/.test(id)?id:null;
  }

  function youtubeInternalFor(raw){
    const value=String(raw||"").trim();
    if(value.startsWith("edge://youtube"))return value;
    try{
      const url=new URL(value);
      const host=url.hostname.toLowerCase();
      if(!YOUTUBE_HOSTS.has(host))return null;
      let videoId=null;
      if(host==="youtu.be"||host==="www.youtu.be"){
        videoId=safeYouTubeVideoId(url.pathname.split("/").filter(Boolean)[0]);
      }else if(url.pathname==="/watch"){
        videoId=safeYouTubeVideoId(url.searchParams.get("v"));
      }else{
        const parts=url.pathname.split("/").filter(Boolean);
        if(parts[0]==="shorts"||parts[0]==="embed")videoId=safeYouTubeVideoId(parts[1]);
      }
      const list=safeYouTubePlaylistId(url.searchParams.get("list"));
      if(videoId){
        const params=new URLSearchParams({v:videoId});
        if(list)params.set("list",list);
        return "edge://youtube/watch?"+params.toString();
      }
      if(list)return "edge://youtube/playlist?list="+encodeURIComponent(list);
      if(url.pathname==="/results"){
        const q=String(url.searchParams.get("search_query")||"").trim();
        return q?"edge://youtube?query="+encodeURIComponent(q):"edge://youtube";
      }
      if(url.pathname==="/"||url.pathname==="")return "edge://youtube";
      return null;
    }catch{return null}
  }

  function youtubeEmbedFor(edgeUrl){
    const value=String(edgeUrl||"");
    if(!value.startsWith("edge://youtube"))return null;
    try{
      const url=new URL(value);
      const videoId=safeYouTubeVideoId(url.searchParams.get("v"));
      const list=safeYouTubePlaylistId(url.searchParams.get("list"));
      if(videoId){
        const embed=new URL("https://"+YOUTUBE_EMBED_HOST+"/embed/"+videoId);
        embed.searchParams.set("rel","0");
        embed.searchParams.set("playsinline","1");
        if(list)embed.searchParams.set("list",list);
        return embed.href;
      }
      if(url.pathname==="/playlist"&&list){
        const embed=new URL("https://"+YOUTUBE_EMBED_HOST+"/embed/videoseries");
        embed.searchParams.set("list",list);
        embed.searchParams.set("rel","0");
        return embed.href;
      }
    }catch{}
    return null;
  }

  function ensureGoogleEmbed(raw){
    try{
      const url=new URL(raw);
      if(!isGoogleHost(url.hostname))return raw;
      if(url.pathname==="/"||url.pathname==="/webhp"){
        url.pathname="/webhp";
        url.searchParams.set("igu","1");
        url.searchParams.set("newwindow","0");
        return url.href;
      }
      if(url.pathname==="/search"){
        url.searchParams.set("igu","1");
        url.searchParams.set("newwindow","0");
        return url.href;
      }
      return url.href;
    }catch{return raw}
  }

  function normalize(raw){
    const value=String(raw||"").trim();
    if(!value)return "edge://newtab";
    if(value.startsWith("edge://youtube"))return value;
    if(value==="edge://ouvirmusica")return OUVIR_MUSICA_URL;
    if(value==="edge://newtab"||value.startsWith("local:"))return value;

    if(/^yt\s*:/i.test(value)){
      const q=value.replace(/^yt\s*:/i,"").trim();
      const id=safeYouTubeVideoId(q);
      return id?"edge://youtube/watch?v="+id:"edge://youtube?query="+encodeURIComponent(q);
    }

    if(/^https?:\/\//i.test(value)){
      const youtube=youtubeInternalFor(value);
      if(youtube)return youtube;
      try{
        const url=new URL(value);
        if(OUVIR_MUSICA_HOSTS.has(url.hostname.toLowerCase())){
          url.protocol="https:";
          url.hostname="www.ouvirmusica.com.br";
          return url.href;
        }
      }catch{}
      return ensureGoogleEmbed(value);
    }

    if(!/\s/.test(value)&&/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)){
      return normalize("https://"+value);
    }

    return "https://www.google.com/search?igu=1&newwindow=0&q="+encodeURIComponent(value);
  }

  function titleFor(url){
    if(url==="edge://newtab")return "Novo separador";
    if(String(url||"").startsWith("edge://youtube"))return "YouTube";
    if(url.startsWith("local:"))return "Pesquisa local";
    try{
      const u=new URL(url);
      const host=u.hostname.toLowerCase();
      if(isGoogleHost(host))return "Google";
      if(YOUTUBE_HOSTS.has(host))return "YouTube";
      if(OUVIR_MUSICA_HOSTS.has(host))return "Ouvir Música";
      return u.hostname.replace(/^www\./,"");
    }catch{return "Microsoft Edge"}
  }

  function faviconFor(url){
    if(url==="edge://newtab")return "🌐";
    if(String(url||"").startsWith("edge://youtube"))return "▶";
    if(url.startsWith("local:"))return "🔎";
    try{
      const u=new URL(url);
      const host=u.hostname.toLowerCase();
      if(isGoogleHost(host))return "G";
      if(YOUTUBE_HOSTS.has(host))return "▶";
      if(OUVIR_MUSICA_HOSTS.has(host))return "♪";
      if(u.hostname.includes("github.com"))return "◆";
      if(u.hostname.includes("wikipedia.org"))return "W";
      return "🌐";
    }catch{return "🌐"}
  }

  function externalUrlFor(edgeUrl){
    const value=String(edgeUrl||"");
    if(edgeUrl==="edge://ouvirmusica")return OUVIR_MUSICA_URL;
    if(value.startsWith("edge://youtube")){
      try{
        const url=new URL(value);
        const videoId=safeYouTubeVideoId(url.searchParams.get("v"));
        const list=safeYouTubePlaylistId(url.searchParams.get("list"));
        const query=String(url.searchParams.get("query")||"").trim();
        if(videoId){
          const external=new URL("https://www.youtube.com/watch");
          external.searchParams.set("v",videoId);
          if(list)external.searchParams.set("list",list);
          return external.href;
        }
        if(url.pathname==="/playlist"&&list){
          return "https://www.youtube.com/playlist?list="+encodeURIComponent(list);
        }
        if(query)return "https://www.youtube.com/results?search_query="+encodeURIComponent(query);
      }catch{}
      return "https://www.youtube.com/";
    }
    try{
      const url=new URL(edgeUrl);
      if(isGoogleHost(url.hostname)){
        url.searchParams.delete("igu");
        url.searchParams.set("newwindow","1");
        return url.href;
      }
    }catch{}
    return edgeUrl;
  }

  function knownFrameBlocker(url){
    try{
      const host=new URL(url).hostname.toLowerCase();
      if(YOUTUBE_HOSTS.has(host))return true;
      return KNOWN_FRAME_BLOCKERS.has(host);
    }catch{return false}
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
            '<button data-edge-shortcut="'+OUVIR_MUSICA_URL+'"><span class="edge-shortcut-icon ouvir">♪</span><strong>Ouvir Música</strong></button>'+
            '<button data-edge-shortcut="https://pt.wikipedia.org/"><span class="edge-shortcut-icon">W</span><strong>Wikipedia</strong></button>'+
            '<button data-edge-shortcut="https://github.com/"><span class="edge-shortcut-icon">◆</span><strong>GitHub</strong></button>'+
          '</div>'+
          '<div class="edge-cards edge-v720-cards">'+
            '<div class="edge-card"><strong>Google</strong><p>Pesquisa incorporada quando permitida pelo Google.</p></div>'+
            '<div class="edge-card"><strong>Ouvir Música</strong><p>Músicas, artistas e playlists no site real incorporado.</p></div>'+
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
      const isGoogle=(()=>{try{return GOOGLE_HOSTS.has(new URL(url).hostname.toLowerCase())}catch{return false}})();
      const note=document.createElement("div");
      note.className="edge-site-note";
      note.innerHTML=isGoogle
        ?'<span>G Google · resultados abrem numa nova aba</span><button data-ext>Abrir Google completo ↗</button>'
        :'<span>🔒 HTTPS · conteúdo Web real incorporado</span><button data-ext>Abrir site real ↗</button>';
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

      if(t.url==="edge://newtab"){renderHome();return}
      if(t.url.startsWith("local:")){renderLocal(t.url);return}
      if(t.url.startsWith("edge://youtube")){
        const embed=youtubeEmbedFor(t.url);
        if(embed){
          const shell=document.createElement("div");
          shell.className="edge-site-shell edge-v720-site";
          const frame=document.createElement("iframe");
          frame.className="edge-tab-frame";
          frame.src=embed;
          frame.title="YouTube video player";
          frame.referrerPolicy="strict-origin-when-cross-origin";
          frame.setAttribute("allow","autoplay; encrypted-media; picture-in-picture");
          frame.setAttribute("sandbox","allow-scripts allow-same-origin allow-presentation allow-popups");
          frame.setAttribute("allowfullscreen","");
          shell.appendChild(frame);
          page.appendChild(shell);
        }else{
          renderCompatibility(externalUrlFor(t.url),"O site completo do YouTube não permite incorporação; use um link direto de vídeo ou playlist.");
        }
        return
      }
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
    version:"9.9.6",
    OUVIR_MUSICA_URL,
    OUVIR_MUSICA_HOSTS,
    YOUTUBE_HOSTS,
    YOUTUBE_EMBED_HOST,
    normalize,
    externalUrlFor,
    ensureGoogleEmbed,
    isGoogleHost,
    youtubeInternalFor,
    youtubeEmbedFor,
    safeYouTubeVideoId,
    safeYouTubePlaylistId,
    knownFrameBlocker,
    buildEdge:buildEdgeV720
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"8.1.0",
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
      "edge-google","edge-google-new-window-results","edge-ouvir-musica","edge-music-iframe","edge-site-compatibility","edge-external-open"
    ]
  });
})();
