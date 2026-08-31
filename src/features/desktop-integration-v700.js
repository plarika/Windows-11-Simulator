"use strict";
/* Windows 11 Simulator V7.0 — Desktop Integration */
(function installDesktopIntegrationV700(){
  const DEFAULT_ASSOCIATIONS={
    ".txt":"notepad",".md":"notepad",".log":"notepad",".json":"notepad",
    ".csv":"notepad",".js":"notepad",".css":"notepad",".html":"notepad",".htm":"notepad",
    ".png":"photos",".jpg":"photos",".jpeg":"photos",".webp":"photos",".gif":"photos",".bmp":"photos",
    ".mp3":"mediaplayer",".wav":"mediaplayer",".ogg":"mediaplayer",".m4a":"mediaplayer",
    ".mp4":"mediaplayer",".webm":"mediaplayer",".mov":"mediaplayer"
  };

  const APP_META={
    notepad:{name:"Bloco de Notas",icon:"📝",categories:["text"]},
    photos:{name:"Fotografias",icon:"🖼️",categories:["image"]},
    paint:{name:"Pintar",icon:"🖌️",categories:["image"]},
    mediaplayer:{name:"Media Player",icon:"▶️",categories:["audio","video"]}
  };

  const TYPE_ROWS=[
    [".txt","Ficheiros de texto"],
    [".md","Markdown"],
    [".json","JSON"],
    [".html","HTML"],
    [".png","Imagem PNG"],
    [".jpg","Imagem JPEG"],
    [".webp","Imagem WebP"],
    [".mp3","Áudio MP3"],
    [".wav","Áudio WAV"],
    [".mp4","Vídeo MP4"],
    [".webm","Vídeo WebM"]
  ];

  function ensureAssociations(){
    state.fileAssociations=state.fileAssociations&&typeof state.fileAssociations==="object"
      ?state.fileAssociations:{};
    let changed=false;
    for(const [ext,appId] of Object.entries(DEFAULT_ASSOCIATIONS)){
      if(!state.fileAssociations[ext]){state.fileAssociations[ext]=appId;changed=true}
    }
    if(changed)saveState();
  }
  ensureAssociations();

  function extensionOf(name){
    const clean=String(name||"").toLowerCase().split(/[?#]/)[0];
    const i=clean.lastIndexOf(".");
    return i>0?clean.slice(i):"";
  }

  function categoryOf(name,value=null,mime=""){
    const type=String(mime||value?.type||"").toLowerCase();
    if(type.startsWith("image/"))return "image";
    if(type.startsWith("audio/"))return "audio";
    if(type.startsWith("video/"))return "video";
    if(type.startsWith("text/"))return "text";
    const ext=extensionOf(name);
    if([".png",".jpg",".jpeg",".webp",".gif",".bmp",".svg"].includes(ext))return "image";
    if([".mp3",".wav",".ogg",".m4a",".aac",".flac"].includes(ext))return "audio";
    if([".mp4",".webm",".mov",".mkv",".avi"].includes(ext))return "video";
    if([".txt",".md",".log",".json",".csv",".js",".css",".html",".htm",".xml",".ini"].includes(ext))return "text";
    if(typeof value==="string"&&value.startsWith("data:image/"))return "image";
    return "unknown";
  }

  function candidateApps(name,value,mime=""){
    if(globalThis.Win11AppRegistry?.candidatesForFile)return Win11AppRegistry.candidatesForFile(name,value,mime);
    const cat=categoryOf(name,value,mime);
    return Object.entries(APP_META)
      .filter(([,m])=>m.categories.includes(cat))
      .map(([id,m])=>({id,...m}));
  }

  function defaultAppFor(name){
    if(globalThis.Win11DefaultApps?.forFile)return Win11DefaultApps.forFile(name);
    ensureAssociations();
    return state.fileAssociations[extensionOf(name)]||null;
  }

  function setDefaultApp(ext,appId){
    if(globalThis.Win11DefaultApps?.setForFile)return Win11DefaultApps.setForFile(ext,appId);
    ext=String(ext||"").toLowerCase();
    if(!ext.startsWith("."))throw new Error("Extensão inválida.");
    if(!APP_META[appId])throw new Error("Aplicação inválida.");
    state.fileAssociations[ext]=appId;
    saveState();
    return true;
  }

  async function materializeFile(path,name,value){
    if(value instanceof Blob){
      return {
        name,
        blob:value,
        type:value.type||"application/octet-stream",
        text:async()=>value.text(),
        source:"direct-blob"
      };
    }
    if(value?.__realBlobId){
      const rec=await RealContentBridge.getRecord(value);
      if(!rec)throw new Error("O conteúdo do ficheiro não está disponível nesta sessão.");
      return {
        name,
        blob:rec.blob,
        type:rec.type||rec.blob.type||"application/octet-stream",
        text:async()=>rec.blob.text(),
        source:"indexeddb"
      };
    }
    if(typeof value==="string"&&value.startsWith("data:")){
      const response=await fetch(value);
      const blob=await response.blob();
      return {
        name,
        blob,
        type:blob.type||"application/octet-stream",
        text:async()=>blob.text(),
        source:"data-url"
      };
    }
    if(typeof value==="string"){
      const blob=new Blob([value],{type:"text/plain;charset=utf-8"});
      return {name,blob,type:"text/plain",text:async()=>value,source:"virtual"};
    }
    const text=typeof value==="object"&&value!==null
      ?String(value.content??JSON.stringify(value,null,2))
      :String(value??"");
    const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
    return {name,blob,type:"text/plain",text:async()=>text,source:"virtual"};
  }

  function openDocumentApp(appId,initialPath){
    const existing=$$(".window").find(w=>w.dataset.app===appId&&Number(w.dataset.desktop||0)===(Number(state.currentDesktop)||0));
    if(existing&&typeof makeWindow==="function")return makeWindow(appId,initialPath);
    return openApp(appId,initialPath);
  }

  async function openWithApp(appId,path,name,value){
    const item=await materializeFile(path,name,value);
    const category=categoryOf(name,value,item.type);

    if(appId==="notepad"){
      if(category!=="text"&&category!=="unknown")throw new Error("O Bloco de Notas não é adequado para este tipo de ficheiro.");
      state.notepadText=await item.text();
      state.notepadFile={path,name};
      saveState();
      openDocumentApp("notepad");
      return true;
    }

    if(appId==="photos"){
      if(category!=="image")throw new Error("Fotografias só pode abrir imagens.");
      globalThis.RealPhotosPending={name,blob:item.blob};
      openDocumentApp("photos");
      return true;
    }

    if(appId==="paint"){
      if(category!=="image")throw new Error("Pintar só pode abrir imagens.");
      const bitmap=await createImageBitmap(item.blob);
      openApp("paint");
      await new Promise(r=>setTimeout(r,40));
      const wins=$$(".window").filter(w=>w.dataset.app==="paint"&&!w.classList.contains("hidden"));
      const win=wins[wins.length-1];
      const canvas=win?.querySelector("canvas");
      if(!canvas){try{bitmap.close()}catch{};throw new Error("Não foi possível abrir o canvas do Pintar.")}
      const ctx=canvas.getContext("2d");
      ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
      const scale=Math.min(canvas.width/bitmap.width,canvas.height/bitmap.height);
      const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
      const x=Math.round((canvas.width-w)/2),y=Math.round((canvas.height-h)/2);
      ctx.drawImage(bitmap,x,y,w,h);
      try{bitmap.close()}catch{}
      win.dataset.openedFile=name;
      return true;
    }

    if(appId==="mediaplayer"){
      if(!["audio","video"].includes(category))throw new Error("Media Player só pode abrir áudio ou vídeo.");
      globalThis.RealMediaPending={name,blob:item.blob,type:item.type};
      openDocumentApp("mediaplayer");
      return true;
    }

    if(appId==="edge"&&globalThis.Win11DefaultApps?.openEdgeFile){
      return Win11DefaultApps.openEdgeFile(path,name,value,item);
    }

    throw new Error("Aplicação não suportada.");
  }

  const previousOpenFile=globalThis.openFile;
  globalThis.openFile=async function(path,name,value){
    const appId=defaultAppFor(name);
    if(appId){
      try{
        await openWithApp(appId,path,name,value);
        return;
      }catch(err){
        console.warn("[DesktopIntegration] default app fallback",err);
      }
    }
    return previousOpenFile(path,name,value);
  };

  async function showOpenWith(path,name,value){
    let mime="";
    if(value?.__realBlobId){
      try{mime=(await RealContentBridge.getRecord(value))?.type||""}catch{}
    }
    const apps=candidateApps(name,value,mime);
    if(!apps.length){
      notify("Abrir com","Não existem aplicações compatíveis instaladas para este tipo de ficheiro.");
      return;
    }
    const ext=extensionOf(name);
    const current=defaultAppFor(name);
    const body=
      '<div class="openwith-dialog">'+
        '<p>Como pretende abrir <strong>'+escapeHTML(name)+'</strong>?</p>'+
        '<div class="openwith-list">'+apps.map((app,i)=>
          '<label class="openwith-app">'+
            '<input type="radio" name="openwith-app" value="'+app.id+'" '+((app.id===current||(!current&&i===0))?"checked":"")+'>'+
            '<span class="openwith-icon">'+app.icon+'</span>'+
            '<span><strong>'+escapeHTML(app.name)+'</strong><small>'+escapeHTML(ext||"Ficheiro")+'</small></span>'+
          '</label>'
        ).join("")+'</div>'+
        (ext?'<label class="openwith-always"><input type="checkbox" data-openwith-always> Utilizar sempre esta aplicação para '+escapeHTML(ext)+'</label>':"")+
      '</div>';

    showSystemDialog("Abrir com",body,"Abrir",async()=>{
      const selected=$("#system-dialog-body input[name='openwith-app']:checked")?.value;
      if(!selected)return;
      if(ext&&$("#system-dialog-body [data-openwith-always]")?.checked)setDefaultApp(ext,selected);
      try{await openWithApp(selected,path,name,value)}
      catch(err){notify("Abrir com",err?.message||"Não foi possível abrir o ficheiro.")}
    });
  }

  async function shareFile(path,name,value){
    let item;
    try{item=await materializeFile(path,name,value)}
    catch(err){notify("Partilhar",err?.message||"Não foi possível preparar o ficheiro.");return false}

    const file=new File([item.blob],name,{type:item.type||item.blob.type||"application/octet-stream",lastModified:Date.now()});
    if(typeof navigator.share==="function"){
      try{
        if(typeof navigator.canShare==="function"&&navigator.canShare({files:[file]})){
          await navigator.share({title:name,files:[file]});
          return true;
        }
        const cat=categoryOf(name,value,item.type);
        if(cat==="text"){
          const text=(await item.text()).slice(0,20000);
          await navigator.share({title:name,text});
          return true;
        }
      }catch(err){
        if(err?.name==="AbortError")return false;
        console.warn("[DesktopIntegration] native share failed",err);
      }
    }

    const cat=categoryOf(name,value,item.type);
    if(cat==="text"){
      try{
        await RealClipboardBridge.writeText(await item.text());
        notify("Partilhar","A API de partilha não está disponível; o conteúdo foi copiado para a área de transferência.");
        return true;
      }catch{}
    }
    try{
      await RealContentBridge.exportVirtualValue(name,value);
      notify("Partilhar","A API de partilha não está disponível; o ficheiro foi exportado para o dispositivo.");
      return true;
    }catch{
      notify("Partilhar","Este navegador não disponibiliza uma forma de partilhar este ficheiro.");
      return false;
    }
  }

  function printableTextDocument(name,text){
    return '<!doctype html><html><head><meta charset="utf-8"><title>'+escapeHTML(name)+'</title>'+
      '<style>body{font:14px Segoe UI,Arial,sans-serif;margin:24mm;color:#111}h1{font-size:18px;margin:0 0 12mm}pre{white-space:pre-wrap;word-break:break-word;font:13px Consolas,monospace;line-height:1.45}</style>'+
      '</head><body><h1>'+escapeHTML(name)+'</h1><pre>'+escapeHTML(text)+'</pre></body></html>';
  }

  function printableImageDocument(name,url){
    return '<!doctype html><html><head><meta charset="utf-8"><title>'+escapeHTML(name)+'</title>'+
      '<style>body{margin:0;display:grid;place-items:center;min-height:100vh}img{max-width:100%;max-height:100vh;object-fit:contain}</style>'+
      '</head><body><img src="'+escapeHTML(url)+'" alt="'+escapeHTML(name)+'"></body></html>';
  }

  async function printFile(path,name,value){
    let item;
    try{item=await materializeFile(path,name,value)}
    catch(err){notify("Imprimir",err?.message||"Não foi possível preparar o ficheiro.");return false}

    const category=categoryOf(name,value,item.type);
    if(!["text","image"].includes(category)){
      notify("Imprimir","Este tipo de ficheiro não tem um formato de impressão suportado.");
      return false;
    }

    const frame=document.createElement("iframe");
    frame.className="desktop-print-frame";
    frame.setAttribute("aria-hidden","true");
    document.body.appendChild(frame);
    let objectUrl=null;

    try{
      const doc=frame.contentDocument;
      if(category==="text"){
        doc.open();
        doc.write(printableTextDocument(name,await item.text()));
        doc.close();
      }else{
        objectUrl=URL.createObjectURL(item.blob);
        doc.open();
        doc.write(printableImageDocument(name,objectUrl));
        doc.close();
        await new Promise(resolve=>{
          const img=doc.querySelector("img");
          if(!img||img.complete){resolve();return}
          img.onload=resolve;img.onerror=resolve;
          setTimeout(resolve,1200);
        });
      }
      await new Promise(r=>setTimeout(r,80));
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(()=>{
        if(objectUrl)URL.revokeObjectURL(objectUrl);
        frame.remove();
      },1800);
      return true;
    }catch(err){
      if(objectUrl)URL.revokeObjectURL(objectUrl);
      frame.remove();
      notify("Imprimir","O navegador não conseguiu abrir o diálogo de impressão.");
      return false;
    }
  }

  function renderDefaultApps(box){
    if(globalThis.Win11DefaultApps?.renderSettings)return Win11DefaultApps.renderSettings(box);
    if(box.querySelector("[data-default-apps-v700]"))return;
    const card=document.createElement("div");
    card.className="sys-card default-apps-card";
    card.dataset.defaultAppsV700="";
    card.innerHTML=
      '<div class="default-apps-head"><div><strong>Aplicações predefinidas</strong><p>Escolha a aplicação utilizada pelo Explorer para cada tipo de ficheiro.</p></div><button class="sys-button" data-default-reset>Repor</button></div>'+
      '<div class="default-apps-list">'+TYPE_ROWS.map(([ext,label])=>{
        const apps=candidateApps("ficheiro"+ext);
        return '<label class="default-app-row"><span><strong>'+escapeHTML(label)+'</strong><small>'+escapeHTML(ext)+'</small></span>'+
          '<select data-default-ext="'+escapeHTML(ext)+'">'+apps.map(app=>'<option value="'+app.id+'" '+(state.fileAssociations[ext]===app.id?"selected":"")+'>'+escapeHTML(app.name)+'</option>').join("")+'</select></label>';
      }).join("")+'</div>';
    (box.querySelector(".sys-grid")||box).appendChild(card);
    card.querySelectorAll("[data-default-ext]").forEach(select=>{
      select.onchange=()=>{
        setDefaultApp(select.dataset.defaultExt,select.value);
        notify("Aplicações predefinidas",select.dataset.defaultExt+" agora abre com "+APP_META[select.value].name+".");
      };
    });
    card.querySelector("[data-default-reset]").onclick=()=>{
      state.fileAssociations={...DEFAULT_ASSOCIATIONS};
      saveState();
      card.remove();
      renderDefaultApps(box);
      notify("Aplicações predefinidas","Associações repostas.");
    };
  }

  function networkDescription(){
    const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;
    if(!navigator.onLine)return {title:"Offline",detail:"Sem ligação à Internet",icon:"○"};
    const effective=connection?.effectiveType?String(connection.effectiveType).toUpperCase():"Online";
    const downlink=connection?.downlink?(" · "+connection.downlink+" Mbps"):"";
    return {title:"Internet",detail:effective+downlink,icon:"📶"};
  }

  function installQuickSettings(){
    const grid=$("#quick-panel .quick-grid");
    if(!grid||grid.querySelector("[data-real-network]"))return;

    const oldWifi=grid.querySelector('[data-quick="wifi"]');
    if(oldWifi){
      const network=document.createElement("button");
      network.className="quick-tile real-quick-tile on";
      network.dataset.realNetwork="";
      network.onclick=()=>{state.settingsPage="network";saveState();openApp("settings");closeOverlays()};
      oldWifi.replaceWith(network);
    }

    const fullscreen=document.createElement("button");
    fullscreen.className="quick-tile real-quick-tile";
    fullscreen.dataset.realFullscreen="";
    fullscreen.innerHTML='⛶<strong>Ecrã completo</strong><small>Desligado</small>';
    fullscreen.onclick=async()=>{
      try{
        if(document.fullscreenElement)await RealDeviceBridge.exitFullscreen();
        else await RealDeviceBridge.enterFullscreen();
      }catch{notify("Definições rápidas","O navegador não permitiu ecrã completo.")}
      refreshQuickReal();
    };

    const wake=document.createElement("button");
    wake.className="quick-tile real-quick-tile";
    wake.dataset.realWake="";
    wake.innerHTML='☀️<strong>Ecrã ativo</strong><small>Desligado</small>';
    wake.onclick=async()=>{
      try{
        await RealDeviceBridge.setWakeLock(!state.realWakeLock);
      }catch{notify("Definições rápidas","Wake Lock não está disponível neste dispositivo.")}
      refreshQuickReal();
    };

    grid.append(fullscreen,wake);

    const panelPad=$("#quick-panel .panel-pad");
    if(panelPad&&!panelPad.querySelector("[data-quick-real-note]")){
      const note=document.createElement("div");
      note.className="quick-real-note";
      note.dataset.quickRealNote="";
      note.textContent="Internet é apenas monitorizada: uma página Web não pode ligar ou desligar o Wi‑Fi/Bluetooth do dispositivo.";
      panelPad.appendChild(note);
    }

    document.addEventListener("fullscreenchange",refreshQuickReal);
    window.addEventListener("online",refreshQuickReal);
    window.addEventListener("offline",refreshQuickReal);
    try{(navigator.connection||navigator.mozConnection||navigator.webkitConnection)?.addEventListener("change",refreshQuickReal)}catch{}
    refreshQuickReal();
  }

  function refreshQuickReal(){
    const network=$("[data-real-network]");
    if(network){
      const info=networkDescription();
      network.innerHTML=info.icon+'<strong>'+escapeHTML(info.title)+'</strong><small>'+escapeHTML(info.detail)+'</small>';
      network.classList.toggle("on",navigator.onLine);
      network.classList.toggle("offline",!navigator.onLine);
    }
    const full=$("[data-real-fullscreen]");
    if(full){
      const on=Boolean(document.fullscreenElement);
      full.classList.toggle("on",on);
      full.querySelector("small").textContent=on?"Ligado":"Desligado";
    }
    const wake=$("[data-real-wake]");
    if(wake){
      const on=Boolean(state.realWakeLock);
      wake.classList.toggle("on",on);
      wake.querySelector("small").textContent=on?"Ligado":"Desligado";
    }
    document.querySelectorAll("[data-real-network-card]").forEach(card=>{
      const info=networkDescription();
      const status=card.querySelector("[data-real-network-status]");
      const detail=card.querySelector("[data-real-network-detail]");
      if(status)status.textContent=info.title;
      if(detail)detail.textContent=info.detail;
    });
    const qb=$("#quick-btn");
    if(qb){
      if(globalThis.Win11SystemTray?.refresh){
        globalThis.Win11SystemTray.refresh().catch(()=>{});
      }else{
        qb.textContent=(navigator.onLine?"📶":"○")+" 🔊";
      }
    }
  }

  const previousSettings=globalThis.renderSettingsPageV5;
  if(typeof previousSettings==="function"){
    globalThis.renderSettingsPageV5=function(box,page){
      previousSettings(box,page);
      if(page==="apps")renderDefaultApps(box);
      if(page==="network"&&!box.querySelector("[data-real-network-card]")){
        const info=networkDescription();
        const card=document.createElement("div");
        card.className="sys-card real-network-card";
        card.dataset.realNetworkCard="";
        card.innerHTML='<strong>🌐 Estado real do dispositivo</strong>'+
          '<p><b data-real-network-status>'+escapeHTML(info.title)+'</b> · <span data-real-network-detail>'+escapeHTML(info.detail)+'</span></p>'+
          '<small>As redes Wi‑Fi listadas abaixo pertencem à simulação; o browser não pode alterar o Wi‑Fi real.</small>';
        const h=box.querySelector("h1");
        if(h)h.insertAdjacentElement("afterend",card); else box.prepend(card);
      }
    };
    try{globalThis.renderSettingsPageV5=renderSettingsPageV5}catch{}
  }

  installQuickSettings();

  globalThis.Win11DesktopIntegration=Object.freeze({
    version:"8.1.0",
    extensionOf,
    categoryOf,
    defaultAppFor,
    setDefaultApp,
    candidateApps,
    materializeFile,
    openDocumentApp,
    openWithApp,
    showOpenWith,
    shareFile,
    printFile,
    printableTextDocument,
    printableImageDocument,
    renderDefaultApps,
    refreshQuickReal
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"8.1.0",
    step:9,
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
      "file-associations","open-with","native-share","real-print","real-network-status","real-quick-settings"
    ]
  });
})();
