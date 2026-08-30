"use strict";
/* Windows 11 Simulator V7.6 — Real Device Integration */
(function installRealDeviceIntegrationV760(){
  const PERMISSIONS=[
    ["notifications","Notificações"],
    ["camera","Câmara"],
    ["microphone","Microfone"],
    ["geolocation","Localização"],
    ["clipboard-read","Área de transferência · leitura"],
    ["clipboard-write","Área de transferência · escrita"]
  ];
  const permissionCache=new Map();
  let panel=null;
  let lastSnapshot=null;
  let refreshTimer=null;
  let batteryObject=null;
  let trayButton=null;

  function yesNo(v){return v===true?"Sim":v===false?"Não":"Não exposto"}
  function readablePermission(v){
    return v==="granted"?"Permitido":v==="denied"?"Negado":v==="prompt"?"Perguntar":v==="unsupported"?"Não suportado":"Não exposto";
  }
  function formatBytes(v){
    if(globalThis.RealDeviceBridge?.formatBytes)return RealDeviceBridge.formatBytes(v);
    const n=Number(v)||0;if(n<1024)return n+" B";
    const units=["KB","MB","GB","TB"];let x=n,i=-1;
    do{x/=1024;i++}while(x>=1024&&i<units.length-1);
    return x.toFixed(x>=10?1:2)+" "+units[i];
  }
  function pct(usage,quota){
    if(!Number.isFinite(usage)||!Number.isFinite(quota)||quota<=0)return null;
    return Math.max(0,Math.min(100,Math.round(usage/quota*100)));
  }
  function duration(sec){
    const n=Number(sec);
    if(!Number.isFinite(n)||n<=0)return null;
    const h=Math.floor(n/3600),m=Math.round((n%3600)/60);
    return h?String(h)+" h "+String(m)+" min":String(m)+" min";
  }

  async function queryPermission(name){
    if(!navigator.permissions?.query)return "unsupported";
    try{
      const status=await navigator.permissions.query({name});
      const old=permissionCache.get(name);
      if(old!==status){
        permissionCache.set(name,status);
        status.onchange=()=>queueRefresh();
      }
      return status.state||"unknown";
    }catch{return "unsupported"}
  }

  async function permissionSnapshot(){
    const entries=await Promise.all(PERMISSIONS.map(async([name,label])=>({
      name,label,state:await queryPermission(name)
    })));
    if(typeof Notification!=="undefined"){
      const n=entries.find(x=>x.name==="notifications");
      if(n&&n.state==="unsupported")n.state=Notification.permission||"prompt";
    }
    return entries;
  }

  async function storageSnapshot(){
    const result={supported:Boolean(navigator.storage),usage:null,quota:null,persisted:null};
    if(!navigator.storage)return result;
    try{
      const e=await navigator.storage.estimate();
      result.usage=e.usage??null;result.quota=e.quota??null;
    }catch{}
    try{result.persisted=await navigator.storage.persisted()}catch{}
    return result;
  }

  async function batterySnapshot(){
    if(globalThis.RealDeviceBridge?.getBatteryInfo){
      try{return await RealDeviceBridge.getBatteryInfo()}catch{}
    }
    if(typeof navigator.getBattery!=="function")return null;
    try{
      const b=await navigator.getBattery();
      return {
        level:Math.round((Number(b.level)||0)*100),
        charging:Boolean(b.charging),
        chargingTime:b.chargingTime,
        dischargingTime:b.dischargingTime
      };
    }catch{return null}
  }

  async function mediaSnapshot(){
    const out={supported:Boolean(navigator.mediaDevices),audioInputs:null,videoInputs:null,audioOutputs:null,labelsExposed:false};
    if(!navigator.mediaDevices?.enumerateDevices)return out;
    try{
      const devices=await navigator.mediaDevices.enumerateDevices();
      out.audioInputs=devices.filter(x=>x.kind==="audioinput").length;
      out.videoInputs=devices.filter(x=>x.kind==="videoinput").length;
      out.audioOutputs=devices.filter(x=>x.kind==="audiooutput").length;
      out.labelsExposed=devices.some(x=>Boolean(x.label));
    }catch{}
    return out;
  }

  function connectionSnapshot(){
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;
    return c?{
      effectiveType:c.effectiveType||null,
      downlink:c.downlink??null,
      rtt:c.rtt??null,
      saveData:Boolean(c.saveData),
      type:c.type||null
    }:null;
  }

  function displayMode(){
    if(matchMedia?.("(display-mode: standalone)")?.matches)return "PWA / standalone";
    if(matchMedia?.("(display-mode: fullscreen)")?.matches)return "Fullscreen";
    return "Browser";
  }

  async function collectSnapshot(){
    const [storage,battery,media,permissions]=await Promise.all([
      storageSnapshot(),batterySnapshot(),mediaSnapshot(),permissionSnapshot()
    ]);
    const uaData=navigator.userAgentData||null;
    const snap={
      capturedAt:new Date().toISOString(),
      online:navigator.onLine,
      secureContext:window.isSecureContext,
      platform:uaData?.platform||navigator.platform||null,
      mobile:uaData?.mobile??/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),
      language:navigator.language||null,
      languages:Array.from(navigator.languages||[]),
      hardware:{
        logicalProcessors:navigator.hardwareConcurrency||null,
        deviceMemoryGB:navigator.deviceMemory||null,
        maxTouchPoints:navigator.maxTouchPoints??null
      },
      screen:{
        width:screen.width||null,height:screen.height||null,
        availableWidth:screen.availWidth||null,availableHeight:screen.availHeight||null,
        colorDepth:screen.colorDepth||null,pixelDepth:screen.pixelDepth||null,
        devicePixelRatio:window.devicePixelRatio||1,
        orientation:screen.orientation?.type||null
      },
      connection:connectionSnapshot(),
      battery,storage,media,permissions,
      capabilities:{
        mediaDevices:Boolean(navigator.mediaDevices),
        mediaRecorder:typeof MediaRecorder==="function",
        screenCapture:Boolean(navigator.mediaDevices?.getDisplayMedia),
        wakeLock:Boolean(navigator.wakeLock?.request),
        fullscreen:Boolean(document.documentElement.requestFullscreen),
        notifications:typeof Notification!=="undefined",
        webShare:Boolean(navigator.share),
        clipboardRead:Boolean(navigator.clipboard?.readText),
        clipboardWrite:Boolean(navigator.clipboard?.writeText),
        fileOpenPicker:typeof showOpenFilePicker==="function",
        fileSavePicker:typeof showSaveFilePicker==="function",
        directoryPicker:typeof showDirectoryPicker==="function",
        pwaInstall:Boolean(globalThis.RealPlatformBridge)||Boolean(navigator.serviceWorker)
      },
      displayMode:displayMode(),
      visibility:document.visibilityState
    };
    lastSnapshot=snap;
    return snap;
  }

  function kv(label,value,cls=""){
    return '<div class="device-kv '+cls+'"><span>'+escapeHTML(String(label))+'</span><strong>'+escapeHTML(String(value??"Não exposto"))+'</strong></div>';
  }
  function cap(label,value){
    return '<div class="device-cap '+(value?"available":"unavailable")+'"><span>'+(value?"✓":"—")+'</span><strong>'+escapeHTML(label)+'</strong></div>';
  }

  function summaryHTML(s){
    const storagePct=pct(s.storage.usage,s.storage.quota);
    const battery=s.battery?s.battery.level+"%"+(s.battery.charging?" · a carregar":""):"Não exposta";
    const net=s.online?(s.connection?.effectiveType?("Online · "+s.connection.effectiveType.toUpperCase()):"Online"):"Offline";
    return '<div class="device-summary-grid">'+
      '<div class="device-summary-card '+(s.online?"ok":"warn")+'"><small>Rede</small><strong>'+escapeHTML(net)+'</strong><span>'+(s.connection?.downlink!=null?escapeHTML(String(s.connection.downlink)+" Mbps estimados"):"Estado real do navegador")+'</span></div>'+
      '<div class="device-summary-card"><small>Bateria</small><strong>'+escapeHTML(battery)+'</strong><span>'+(s.battery?(duration(s.battery.charging?s.battery.chargingTime:s.battery.dischargingTime)||"Tempo não exposto"):"API indisponível")+'</span></div>'+
      '<div class="device-summary-card"><small>Armazenamento</small><strong>'+(storagePct==null?"Não exposto":storagePct+"% utilizado")+'</strong><span>'+(s.storage.usage==null?"API limitada":escapeHTML(formatBytes(s.storage.usage)+" / "+formatBytes(s.storage.quota)))+'</span></div>'+
      '<div class="device-summary-card"><small>Hardware exposto</small><strong>'+escapeHTML(String(s.hardware.logicalProcessors??"—"))+' CPU lógicas</strong><span>'+(s.hardware.deviceMemoryGB?escapeHTML(String(s.hardware.deviceMemoryGB)+" GB memória aprox."):"Memória não exposta")+'</span></div>'+
    '</div>';
  }

  function permissionsHTML(s){
    return s.permissions.map(p=>
      '<div class="device-permission-row" data-permission="'+escapeHTML(p.name)+'">'+
        '<div><strong>'+escapeHTML(p.label)+'</strong><small>'+escapeHTML(readablePermission(p.state))+'</small></div>'+
        (["notifications","camera","microphone","geolocation"].includes(p.name)?'<button class="sys-button" data-request-permission="'+escapeHTML(p.name)+'">Solicitar</button>':'')+
      '</div>'
    ).join("");
  }

  function detailedHTML(s){
    const conn=s.connection;
    const rows=[
      ["Plataforma",s.platform||"Não exposta"],
      ["Tipo",s.mobile?"Dispositivo móvel":"Computador/desktop"],
      ["Idioma",s.language||"Não exposto"],
      ["Contexto HTTPS",s.secureContext?"Sim":"Não"],
      ["Modo",s.displayMode],
      ["CPU lógicas",s.hardware.logicalProcessors??"Não expostas"],
      ["Memória aprox.",s.hardware.deviceMemoryGB?s.hardware.deviceMemoryGB+" GB":"Não exposta"],
      ["Pontos de toque",s.hardware.maxTouchPoints??"Não exposto"],
      ["Ecrã",s.screen.width&&s.screen.height?s.screen.width+" × "+s.screen.height+" CSS px":"Não exposto"],
      ["Pixel ratio",s.screen.devicePixelRatio],
      ["Profundidade de cor",s.screen.colorDepth?s.screen.colorDepth+" bit":"Não exposta"],
      ["Orientação",s.screen.orientation||"Não exposta"],
      ["Rede",s.online?"Online":"Offline"]
    ];
    if(conn){
      rows.push(
        ["Tipo efetivo",conn.effectiveType||"Não exposto"],
        ["Download estimado",conn.downlink==null?"Não exposto":conn.downlink+" Mbps"],
        ["RTT estimado",conn.rtt==null?"Não exposto":conn.rtt+" ms"],
        ["Poupança de dados",conn.saveData?"Ativa":"Desativada"]
      );
    }
    if(s.battery){
      rows.push(
        ["Bateria",s.battery.level+"%"],
        ["A carregar",s.battery.charging?"Sim":"Não"]
      );
    }
    rows.push(
      ["Áudio entrada",s.media.audioInputs==null?"Não exposto":s.media.audioInputs],
      ["Vídeo entrada",s.media.videoInputs==null?"Não exposto":s.media.videoInputs],
      ["Áudio saída",s.media.audioOutputs==null?"Não exposto":s.media.audioOutputs],
      ["Labels de media",s.media.labelsExposed?"Expostas":"Ocultas até autorização"]
    );
    return '<div class="device-detail-grid">'+rows.map(([a,b])=>kv(a,b)).join("")+'</div>';
  }

  function capabilitiesHTML(s){
    const c=s.capabilities;
    return [
      ["Câmara/microfone",c.mediaDevices],["MediaRecorder",c.mediaRecorder],["Captura de ecrã",c.screenCapture],
      ["Wake Lock",c.wakeLock],["Fullscreen",c.fullscreen],["Notificações",c.notifications],
      ["Web Share",c.webShare],["Clipboard leitura",c.clipboardRead],["Clipboard escrita",c.clipboardWrite],
      ["Abrir ficheiro",c.fileOpenPicker],["Guardar ficheiro",c.fileSavePicker],["Escolher pasta",c.directoryPicker],
      ["Service Worker / PWA",c.pwaInstall]
    ].map(([a,b])=>cap(a,b)).join("");
  }

  function ensurePanel(){
    if(panel?.isConnected)return panel;
    panel=document.createElement("section");
    panel.id="device-center-v760";
    panel.className="device-center-v760";
    panel.innerHTML=
      '<div class="device-center-shell">'+
        '<header><div><small>Windows 11 Simulator V7.6</small><h2>Centro do dispositivo real</h2></div><div class="device-center-actions"><button data-refresh>Atualizar</button><button data-export>Exportar diagnóstico</button><button data-close>✕</button></div></header>'+
        '<div class="device-center-note">Apenas dados que o navegador decide expor. Nenhuma permissão é pedida automaticamente.</div>'+
        '<main data-device-content><div class="device-loading">A recolher dados reais do navegador...</div></main>'+
      '</div>';
    document.getElementById("app").appendChild(panel);
    panel.querySelector("[data-close]").onclick=()=>closePanel();
    panel.querySelector("[data-refresh]").onclick=()=>refreshPanel(true);
    panel.querySelector("[data-export]").onclick=()=>exportReport();
    panel.addEventListener("pointerdown",e=>{if(e.target===panel)closePanel()});
    return panel;
  }

  async function renderPanel(snapshot){
    const p=ensurePanel(),main=p.querySelector("[data-device-content]");
    const s=snapshot||await collectSnapshot();
    main.innerHTML=
      summaryHTML(s)+
      '<div class="device-center-columns">'+
        '<section><div class="device-section-head"><h3>Dispositivo</h3><span>tempo real</span></div>'+detailedHTML(s)+'</section>'+
        '<section><div class="device-section-head"><h3>Permissões</h3><span>sem pedidos automáticos</span></div><div class="device-permissions">'+permissionsHTML(s)+'</div></section>'+
      '</div>'+
      '<section class="device-capabilities"><div class="device-section-head"><h3>Capacidades disponíveis</h3><span>APIs do navegador</span></div><div class="device-cap-grid">'+capabilitiesHTML(s)+'</div></section>'+
      '<section class="device-storage-actions"><div class="device-section-head"><h3>Controlo</h3><span>ações explícitas</span></div>'+
        '<div class="device-control-grid">'+
          '<button class="sys-button" data-persist '+(s.storage.persisted?"disabled":"")+'>'+(s.storage.persisted?"Armazenamento persistente ativo":"Pedir armazenamento persistente")+'</button>'+
          '<button class="sys-button" data-wake>'+(state.realWakeLock?"Desativar Wake Lock":"Ativar Wake Lock")+'</button>'+
          '<button class="sys-button" data-fullscreen>'+(document.fullscreenElement?"Sair do ecrã completo":"Entrar em ecrã completo")+'</button>'+
        '</div>'+
      '</section>';
    main.querySelectorAll("[data-request-permission]").forEach(b=>b.onclick=()=>requestPermission(b.dataset.requestPermission));
    main.querySelector("[data-persist]")?.addEventListener("click",requestPersistentStorage);
    main.querySelector("[data-wake]")?.addEventListener("click",toggleWakeLock);
    main.querySelector("[data-fullscreen]")?.addEventListener("click",toggleFullscreen);
    updateTray(s);
  }

  async function openPanel(){
    const p=ensurePanel();p.classList.add("open");
    await refreshPanel(true);
  }
  function closePanel(){panel?.classList.remove("open")}
  async function refreshPanel(force=false){
    if(!force&&panel&&!panel.classList.contains("open"))return;
    try{await renderPanel(await collectSnapshot())}
    catch(err){
      const main=ensurePanel().querySelector("[data-device-content]");
      main.innerHTML='<div class="device-error">Não foi possível atualizar o diagnóstico: '+escapeHTML(err?.message||"erro desconhecido")+'</div>';
    }
  }

  async function requestPermission(kind){
    try{
      if(kind==="notifications"){
        if(typeof Notification==="undefined")throw new Error("Notificações não suportadas.");
        await Notification.requestPermission();
      }else if(kind==="camera"||kind==="microphone"){
        if(!navigator.mediaDevices?.getUserMedia)throw new Error("MediaDevices não suportado.");
        const stream=await navigator.mediaDevices.getUserMedia(kind==="camera"?{video:true}:{audio:true});
        stream.getTracks().forEach(t=>t.stop());
      }else if(kind==="geolocation"){
        if(!navigator.geolocation)throw new Error("Geolocalização não suportada.");
        await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(
          ()=>resolve(true),reject,{enableHighAccuracy:false,maximumAge:0,timeout:8000}
        ));
      }
      notify("Centro do dispositivo","Estado da permissão atualizado.");
    }catch(err){
      notify("Centro do dispositivo",err?.message||"O navegador não concedeu a permissão.");
    }
    await refreshPanel(true);
  }

  async function requestPersistentStorage(){
    try{
      if(!navigator.storage?.persist)throw new Error("Armazenamento persistente não suportado.");
      const ok=await navigator.storage.persist();
      notify("Armazenamento",ok?"Armazenamento persistente concedido.":"O navegador não concedeu armazenamento persistente.");
    }catch(err){notify("Armazenamento",err?.message||"Função indisponível.")}
    await refreshPanel(true);
  }

  async function toggleWakeLock(){
    try{
      if(!globalThis.RealDeviceBridge)throw new Error("Wake Lock indisponível.");
      if(state.realWakeLock)await RealDeviceBridge.releaseWakeLock();
      else await RealDeviceBridge.requestWakeLock();
    }catch(err){notify("Sistema",err?.message||"Wake Lock não disponível.")}
    await refreshPanel(true);
  }

  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement){
        if(document.exitFullscreen)await document.exitFullscreen();
      }else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
      else throw new Error("Fullscreen não suportado.");
    }catch(err){notify("Sistema",err?.message||"Fullscreen não permitido.")}
    await refreshPanel(true);
  }

  function sanitizedReport(s){
    return {
      schema:"win11-simulator-device-report-v1",
      version:"7.8.1",
      generatedAt:new Date().toISOString(),
      online:s.online,secureContext:s.secureContext,platform:s.platform,mobile:s.mobile,
      language:s.language,languages:s.languages,hardware:s.hardware,screen:s.screen,
      connection:s.connection,battery:s.battery,storage:s.storage,media:s.media,
      permissions:s.permissions,capabilities:s.capabilities,displayMode:s.displayMode
    };
  }

  async function exportReport(){
    const snap=lastSnapshot||await collectSnapshot();
    const blob=new Blob([JSON.stringify(sanitizedReport(snap),null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="windows-11-simulator-device-report-"+new Date().toISOString().slice(0,10)+".json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify("Centro do dispositivo","Relatório de diagnóstico preparado.");
  }

  function ensureTray(){
    if(trayButton?.isConnected)return trayButton;
    const quick=document.getElementById("quick-btn");
    if(!quick)return null;
    trayButton=document.createElement("button");
    trayButton.id="device-center-btn";
    trayButton.className="tray-btn device-center-btn";
    trayButton.title="Centro do dispositivo real";
    trayButton.innerHTML='<span data-device-net>●</span><strong data-device-battery>—</strong>';
    quick.parentElement.insertBefore(trayButton,quick);
    trayButton.onclick=e=>{e.stopPropagation();openPanel()};
    return trayButton;
  }

  function updateTray(s){
    const b=ensureTray();if(!b)return;
    const net=b.querySelector("[data-device-net]"),bat=b.querySelector("[data-device-battery]");
    net.classList.toggle("offline",!s.online);
    net.title=s.online?"Online":"Offline";
    bat.textContent=s.battery?String(s.battery.level)+"%":"";
    b.classList.toggle("has-battery",Boolean(s.battery));
  }

  function queueRefresh(){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(async()=>{
      try{
        const s=await collectSnapshot();
        updateTray(s);
        if(panel?.classList.contains("open"))await renderPanel(s);
      }catch{}
    },180);
  }

  async function bindBatteryEvents(){
    if(typeof navigator.getBattery!=="function")return;
    try{
      batteryObject=await navigator.getBattery();
      ["chargingchange","levelchange","chargingtimechange","dischargingtimechange"].forEach(ev=>
        batteryObject.addEventListener(ev,queueRefresh)
      );
    }catch{}
  }

  function bindLiveEvents(){
    window.addEventListener("online",queueRefresh);
    window.addEventListener("offline",queueRefresh);
    document.addEventListener("fullscreenchange",queueRefresh);
    document.addEventListener("visibilitychange",queueRefresh);
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    c?.addEventListener?.("change",queueRefresh);
    navigator.mediaDevices?.addEventListener?.("devicechange",queueRefresh);
    bindBatteryEvents();
    setInterval(()=>{if(document.visibilityState==="visible"&&panel?.classList.contains("open"))queueRefresh()},30000);
  }

  function installQuickTile(){
    const grid=document.querySelector("#quick-panel .quick-grid");
    if(!grid||grid.querySelector("[data-device-center-v760]"))return;
    const b=document.createElement("button");
    b.className="quick-tile";
    b.dataset.deviceCenterV760="";
    b.innerHTML='◉<strong>Dispositivo real</strong><small data-device-quick-state>A verificar...</small>';
    b.onclick=e=>{e.stopPropagation();closeOverlays();openPanel()};
    grid.appendChild(b);
    const update=async()=>{
      try{
        const s=lastSnapshot||await collectSnapshot();
        b.querySelector("[data-device-quick-state]").textContent=s.online?(s.connection?.effectiveType?("Online · "+s.connection.effectiveType):"Online"):"Offline";
        b.classList.toggle("on",s.online);
      }catch{}
    };
    window.addEventListener("online",update);window.addEventListener("offline",update);
    update();
  }

  function installSettingsIntegration(){
    if(typeof globalThis.renderSettingsPageV5!=="function")return;
    const previous=globalThis.renderSettingsPageV5;
    globalThis.renderSettingsPageV5=function(box,page){
      previous(box,page);
      if(page!=="system"||box.querySelector("[data-device-center-settings-v760]"))return;
      const card=document.createElement("div");
      card.className="sys-card device-center-settings-card";
      card.dataset.deviceCenterSettingsV760="";
      card.innerHTML=
        '<div><strong>Centro do dispositivo real</strong><p>Rede, bateria, armazenamento, hardware exposto, permissões e capacidades do navegador.</p></div>'+
        '<button class="sys-button" data-open-device-center>Abrir centro</button>';
      (box.querySelector(".sys-grid")||box).appendChild(card);
      card.querySelector("[data-open-device-center]").onclick=openPanel;
    };
    try{renderSettingsPageV5=globalThis.renderSettingsPageV5}catch{}
  }

  function installSystemInfoIntegration(){
    if(typeof globalThis.buildSystemInfo!=="function")return;
    const previous=globalThis.buildSystemInfo;
    globalThis.buildSystemInfo=function(wrap){
      previous(wrap);
      const nav=wrap.querySelector(".info-nav"),main=wrap.querySelector(".info-main");
      if(!nav||!main||nav.querySelector("[data-device-center-info-v760]"))return;
      const b=document.createElement("button");
      b.dataset.deviceCenterInfoV760="";
      b.textContent="Diagnóstico V7.6";
      nav.appendChild(b);
      b.onclick=async()=>{
        nav.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));
        main.innerHTML='<h2>Diagnóstico V7.6</h2><p>A recolher dados...</p>';
        const s=await collectSnapshot();
        main.innerHTML=
          '<h2>Diagnóstico V7.6</h2>'+
          '<p class="real-device-note">Dados reais expostos pelo navegador. Sem coordenadas de localização ou conteúdo da área de transferência.</p>'+
          '<div class="device-systeminfo-summary">'+summaryHTML(s)+'</div>'+
          '<table class="info-table">'+
            [
              ["Rede",s.online?"Online":"Offline"],
              ["Plataforma",s.platform||"Não exposta"],
              ["CPU lógicas",s.hardware.logicalProcessors??"Não expostas"],
              ["Memória",s.hardware.deviceMemoryGB?s.hardware.deviceMemoryGB+" GB aprox.":"Não exposta"],
              ["Bateria",s.battery?s.battery.level+"%":"Não exposta"],
              ["Armazenamento",s.storage.usage==null?"Não exposto":formatBytes(s.storage.usage)],
              ["Quota",s.storage.quota==null?"Não exposta":formatBytes(s.storage.quota)],
              ["Modo",s.displayMode]
            ].map(([k,v])=>'<tr><td>'+escapeHTML(String(k))+'</td><td>'+escapeHTML(String(v))+'</td></tr>').join("")+
          '</table><p><button class="sys-button" data-open-device-center>Abrir Centro do dispositivo</button></p>';
        main.querySelector("[data-open-device-center]").onclick=openPanel;
      };
    };
    try{buildSystemInfo=globalThis.buildSystemInfo}catch{}
  }

  globalThis.Win11DeviceCenter=Object.freeze({
    version:"7.8.1",
    collectSnapshot,
    permissionSnapshot,
    storageSnapshot,
    batterySnapshot,
    mediaSnapshot,
    open:openPanel,
    close:closePanel,
    refresh:()=>refreshPanel(true),
    requestPermission,
    exportReport,
    buildReport:async()=>sanitizedReport(await collectSnapshot())
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"7.8.1",
    step:15,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "device-center","live-device-status","battery-monitoring","connection-monitoring",
      "storage-diagnostics","permission-center","media-device-summary","capability-matrix",
      "device-diagnostic-export","device-tray-status","device-quick-settings"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });

  ensureTray();
  installQuickTile();
  installSettingsIntegration();
  installSystemInfoIntegration();
  bindLiveEvents();
  queueRefresh();
})();
