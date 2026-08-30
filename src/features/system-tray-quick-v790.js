"use strict";
/* Windows 11 Simulator V7.9 — System Tray & Quick Settings V2 */
(function installSystemTrayQuickV790(){
  const previousApplyState=globalThis.applyState;
  let snapshot=null;
  let batteryObject=null;
  let refreshTimer=null;
  let overflowPanel=null;

  function ensureState(){
    state.quick=Object.assign({wifi:true,sound:true,night:false,protection:true},state.quick||{});
    state.devices=Object.assign({bluetooth:true,camera:true,audio:true,network:true,gpu:true},state.devices||{});
    state.systemTrayV79=Object.assign({
      lastVolume:Number(state.volume)||67,
      bluetooth:Boolean(state.devices.bluetooth),
      energySaver:false,
      showSeconds:false
    },state.systemTrayV79||{});
    state.systemTrayV79.bluetooth=Boolean(state.systemTrayV79.bluetooth);
    state.devices.bluetooth=state.systemTrayV79.bluetooth;
  }

  function svg(kind,opts={}){
    const cls=opts.className?" "+opts.className:"";
    const common='viewBox="0 0 24 24" focusable="false" aria-hidden="true" class="tray-svg-v79'+cls+'"';
    if(kind==="network-off")return '<svg '+common+'><path d="M4 18h2v2H4zm4-4h2v6H8zm4-4h2v10h-2zm4-4h2v14h-2z" fill="currentColor" opacity=".25"/><path d="M5 5l14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    if(kind==="network")return '<svg '+common+'><path d="M4 18h2v2H4zm4-4h2v6H8zm4-4h2v10h-2zm4-4h2v14h-2z" fill="currentColor"/></svg>';
    if(kind==="volume-muted")return '<svg '+common+'><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9l4 6m0-6-4 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    if(kind==="volume-low")return '<svg '+common+'><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 10.5c1 .9 1 2.1 0 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    if(kind==="volume")return '<svg '+common+'><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8c2.5 2 2.5 6 0 8m2.7-10.5c4 3.4 4 9.6 0 13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    if(kind==="battery")return '<svg '+common+'><rect x="3" y="7" width="17" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M21 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect class="battery-fill-v79" x="5" y="9" width="'+Math.max(0,Math.min(13,(Number(opts.level)||0)*.13)).toFixed(2)+'" height="6" rx="1" fill="currentColor"/></svg>';
    if(kind==="battery-charging")return '<svg '+common+'><rect x="3" y="7" width="17" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M21 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12.5 8.5l-3 4h2.4l-.6 3 3.2-4.2h-2.4z" fill="currentColor"/></svg>';
    if(kind==="bell")return '<svg '+common+'><path d="M6 16h12l-1.5-2.2V10a4.5 4.5 0 0 0-9 0v3.8L6 16z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 18a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
    if(kind==="chevron")return '<svg '+common+'><path d="M7 14l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if(kind==="bluetooth")return '<svg '+common+'><path d="M12 3v18l6-5-12-8 12-5-6 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if(kind==="moon")return '<svg '+common+'><path d="M18.5 15.4A7.5 7.5 0 0 1 8.6 5.5 8 8 0 1 0 18.5 15.4z" fill="currentColor"/></svg>';
    if(kind==="focus")return '<svg '+common+'><path d="M5 8V5h3m8 0h3v3m0 8v3h-3M8 19H5v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
    if(kind==="fullscreen")return '<svg '+common+'><path d="M4 9V4h5M15 4h5v5m0 6v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    if(kind==="wake")return '<svg '+common+'><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    if(kind==="brightness")return '<svg '+common+'><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19m0-14-1.5 1.5m-11 11L5 19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    if(kind==="settings")return '<svg '+common+'><path d="M12 8.2A3.8 3.8 0 1 0 12 15.8 3.8 3.8 0 0 0 12 8.2z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9.7 3.7l.6 1.7c.5-.1 1.1-.1 1.7 0l.6-1.7 2 .8-.6 1.7c.5.3.9.7 1.2 1.2l1.7-.6.8 2-1.7.6c.1.5.1 1.1 0 1.7l1.7.6-.8 2-1.7-.6c-.3.5-.7.9-1.2 1.2l.6 1.7-2 .8-.6-1.7c-.5.1-1.1.1-1.7 0l-.6 1.7-2-.8.6-1.7a6 6 0 0 1-1.2-1.2l-1.7.6-.8-2 1.7-.6a6 6 0 0 1 0-1.7l-1.7-.6.8-2 1.7.6c.3-.5.7-.9 1.2-1.2l-.6-1.7z" fill="currentColor" opacity=".35"/></svg>';
    if(kind==="device")return '<svg '+common+'><rect x="5" y="3.5" width="14" height="17" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 6h6M10 17.5h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    if(kind==="shield")return '<svg '+common+'><path d="M12 3l7 3v5c0 4.5-2.7 8.2-7 10-4.3-1.8-7-5.5-7-10V6z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if(kind==="cloud")return '<svg '+common+'><path d="M7 18h10a4 4 0 0 0 .6-7.9A6 6 0 0 0 6.2 9 4.5 4.5 0 0 0 7 18z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
    return '<svg '+common+'><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
  }

  function connection(){
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;
    return c?{
      effectiveType:c.effectiveType||null,
      downlink:c.downlink??null,
      rtt:c.rtt??null,
      saveData:Boolean(c.saveData)
    }:null;
  }

  async function collect(){
    let battery=null;
    try{
      if(globalThis.Win11DeviceCenter?.batterySnapshot)battery=await Win11DeviceCenter.batterySnapshot();
      else if(typeof navigator.getBattery==="function"){
        const b=await navigator.getBattery();
        battery={level:Math.round((Number(b.level)||0)*100),charging:Boolean(b.charging)};
      }
    }catch{}
    snapshot={
      online:navigator.onLine,
      connection:connection(),
      battery,
      secureContext:isSecureContext,
      updatedAt:Date.now()
    };
    return snapshot;
  }

  function networkLabel(){
    if(!navigator.onLine)return {title:"Sem Internet",detail:"Offline"};
    const c=connection();
    if(c?.effectiveType)return {
      title:"Internet",
      detail:String(c.effectiveType).toUpperCase()+(c.downlink!=null?" · "+c.downlink+" Mbps":"")
    };
    return {title:"Internet",detail:"Ligação disponível"};
  }

  function volumeKind(){
    if(!state.quick.sound||Number(state.volume)<=0)return "volume-muted";
    return Number(state.volume)<45?"volume-low":"volume";
  }

  function batteryMarkup(){
    const b=snapshot?.battery;
    if(!b)return '<span class="tray-battery-na-v79" title="Bateria não exposta pelo browser"></span>';
    return '<span class="tray-battery-v79" title="Bateria '+b.level+'%'+(b.charging?" · a carregar":"")+'">'+
      svg(b.charging?"battery-charging":"battery",{level:b.level})+
      '<small>'+b.level+'%</small></span>';
  }

  function installTaskbar(){
    const quick=document.getElementById("quick-btn");
    const notify=document.getElementById("notify-btn");
    const right=document.querySelector("#taskbar .task-right");
    if(!quick||!notify||!right)return;

    const oldDevice=document.getElementById("device-center-btn");
    if(oldDevice)oldDevice.hidden=true;

    let overflow=document.getElementById("tray-overflow-btn-v79");
    if(!overflow){
      overflow=document.createElement("button");
      overflow.id="tray-overflow-btn-v79";
      overflow.className="tray-btn tray-overflow-btn-v79";
      overflow.title="Mostrar ícones ocultos";
      overflow.setAttribute("aria-label","Mostrar ícones ocultos");
      overflow.innerHTML=svg("chevron");
      right.insertBefore(overflow,notify);
      overflow.onclick=e=>{e.stopPropagation();toggleOverflow()};
    }

    quick.classList.add("tray-cluster-v79");
    quick.title="Rede, volume e bateria";
    quick.setAttribute("aria-label","Rede, volume e bateria");
    renderTray();

    const badge=notify.querySelector(".notification-badge-v77");
    const badgeText=badge?.textContent||"";
    const badgeHidden=badge?.hidden??true;
    notify.classList.add("tray-notify-v79");
    notify.innerHTML=svg("bell")+'<span class="notification-badge-v77" '+(badgeHidden?"hidden":"")+'>'+escapeHTML(badgeText)+'</span>';
    notify.title="Centro de Notificações";
    notify.setAttribute("aria-label","Centro de Notificações");
  }

  function renderTray(){
    const quick=document.getElementById("quick-btn");if(!quick)return;
    quick.innerHTML=
      '<span class="tray-network-v79 '+(navigator.onLine?"":"offline")+'">'+svg(navigator.onLine?"network":"network-off")+'</span>'+
      '<span class="tray-volume-v79">'+svg(volumeKind())+'</span>'+
      batteryMarkup();
  }

  function tile(id,icon,title,detail,on=false,extra=""){
    return '<button class="quick-tile-v79 '+(on?"on":"")+'" data-quick-v79="'+id+'" '+extra+'>'+
      '<span class="quick-tile-icon-v79">'+svg(icon)+'</span>'+
      '<span class="quick-tile-copy-v79"><strong>'+escapeHTML(title)+'</strong><small>'+escapeHTML(detail)+'</small></span>'+
    '</button>';
  }

  function focusState(){
    if(!globalThis.Win11NotificationCenter)return {on:false,text:"Desligado"};
    const mode=Win11NotificationCenter.focusMode;
    const quiet=Win11NotificationCenter.isQuiet();
    return {on:quiet,text:mode==="priority"?"Prioridade":mode==="alarms"?"Alarmes":quiet?"Temporário":"Desligado"};
  }

  function fullscreenOn(){return Boolean(document.fullscreenElement)}
  function wakeOn(){return Boolean(state.realWakeLock)}

  function renderQuickPanel(){
    ensureState();
    const panel=document.getElementById("quick-panel");
    if(!panel)return;
    const net=networkLabel(),focus=focusState(),b=snapshot?.battery;
    panel.classList.add("quick-panel-v79");
    panel.innerHTML=
      '<div class="quick-v79">'+
        '<header class="quick-head-v79">'+
          '<div><strong>Definições rápidas</strong><small>'+escapeHTML(net.title)+' · '+(b?b.level+"% bateria":"bateria não exposta")+'</small></div>'+
          '<div><button data-open-device-v79 title="Centro do dispositivo">'+svg("device")+'</button><button data-open-settings-v79 title="Todas as definições">'+svg("settings")+'</button></div>'+
        '</header>'+
        '<section class="quick-status-v79">'+
          '<button data-network-detail-v79><span>'+svg(navigator.onLine?"network":"network-off")+'</span><div><strong>'+escapeHTML(net.title)+'</strong><small>'+escapeHTML(net.detail)+'</small></div><i>›</i></button>'+
          '<button data-battery-detail-v79 class="'+(b?"":"unavailable")+'"><span>'+svg(b?.charging?"battery-charging":"battery",{level:b?.level||0})+'</span><div><strong>'+(b?b.level+"%":"Bateria")+'</strong><small>'+(b?(b.charging?"A carregar":"Estado real do browser"):"Não exposta pelo browser")+'</small></div><i>›</i></button>'+
        '</section>'+
        '<div class="quick-grid-v79">'+
          tile("sound",volumeKind(),state.quick.sound?"Som":"Silenciado",state.quick.sound?state.volume+"%":"Volume virtual",state.quick.sound)+
          tile("bluetooth","bluetooth","Bluetooth",state.systemTrayV79.bluetooth?"Virtual ligado":"Virtual desligado",state.systemTrayV79.bluetooth)+
          tile("focus","focus","Não incomodar",focus.text,focus.on)+
          tile("night","moon","Luz noturna",state.quick.night?"Ligada":"Desligada",state.quick.night)+
          tile("fullscreen","fullscreen","Ecrã completo",fullscreenOn()?"Ligado":"Desligado",fullscreenOn())+
          tile("wake","wake","Manter ecrã ativo",wakeOn()?"Ligado":"Desligado",wakeOn())+
        '</div>'+
        '<section class="quick-sliders-v79">'+
          '<div class="quick-slider-v79"><button data-mute-v79 title="Silenciar">'+svg(volumeKind())+'</button><input id="volume" data-volume-v79 type="range" min="0" max="100" value="'+Number(state.volume)+'" aria-label="Volume virtual"><output>'+Number(state.volume)+'%</output></div>'+
          '<div class="quick-slider-v79"><span>'+svg("brightness")+'</span><input id="brightness" data-brightness-v79 type="range" min="35" max="100" value="'+Number(state.brightness)+'" aria-label="Brilho virtual"><output>'+Number(state.brightness)+'%</output></div>'+
        '</section>'+
        '<footer class="quick-footer-v79"><span>Rede/bateria: browser · Som/brilho/Bluetooth/luz noturna: simulador</span><button data-open-settings-footer-v79>'+svg("settings")+'</button></footer>'+
      '</div>';
    bindQuickPanel();
  }

  function bindQuickPanel(){
    const panel=document.getElementById("quick-panel");if(!panel)return;
    panel.querySelector("[data-open-device-v79]")?.addEventListener("click",()=>{closeOverlays();Win11DeviceCenter?.open?.()});
    panel.querySelector("[data-battery-detail-v79]")?.addEventListener("click",()=>{closeOverlays();Win11DeviceCenter?.open?.()});
    panel.querySelector("[data-network-detail-v79]")?.addEventListener("click",()=>openNetworkSettings());
    panel.querySelector("[data-open-settings-v79]")?.addEventListener("click",()=>openSettings());
    panel.querySelector("[data-open-settings-footer-v79]")?.addEventListener("click",()=>openSettings());

    panel.querySelector('[data-quick-v79="sound"]')?.addEventListener("click",()=>toggleSound());
    panel.querySelector('[data-quick-v79="bluetooth"]')?.addEventListener("click",()=>toggleBluetooth());
    panel.querySelector('[data-quick-v79="focus"]')?.addEventListener("click",()=>toggleFocus());
    panel.querySelector('[data-quick-v79="night"]')?.addEventListener("click",()=>toggleNight());
    panel.querySelector('[data-quick-v79="fullscreen"]')?.addEventListener("click",()=>toggleFullscreen());
    panel.querySelector('[data-quick-v79="wake"]')?.addEventListener("click",()=>toggleWake());

    const volume=panel.querySelector("[data-volume-v79]");
    volume?.addEventListener("input",e=>{
      state.volume=Number(e.target.value);
      if(state.volume>0)state.quick.sound=true;
      state.systemTrayV79.lastVolume=state.volume||state.systemTrayV79.lastVolume||67;
      saveState();
      const old=document.getElementById("volume");if(old)old.value=state.volume;
      renderTray();
      e.target.parentElement.querySelector("output").textContent=state.volume+"%";
    });
    panel.querySelector("[data-mute-v79]")?.addEventListener("click",()=>toggleSound());

    const brightness=panel.querySelector("[data-brightness-v79]");
    brightness?.addEventListener("input",e=>{
      state.brightness=Number(e.target.value);saveState();
      const old=document.getElementById("brightness");if(old)old.value=state.brightness;
      document.getElementById("desktop").style.filter='brightness('+(state.brightness/100)+')';
      e.target.parentElement.querySelector("output").textContent=state.brightness+"%";
    });
  }

  function openSettings(){
    state.settingsPage="system";saveState();closeOverlays();openApp("settings");
  }
  function openNetworkSettings(){
    state.settingsPage="network";saveState();closeOverlays();openApp("settings");
  }

  function toggleSound(){
    ensureState();
    state.quick.sound=!state.quick.sound;
    if(state.quick.sound&&Number(state.volume)<=0){
      state.volume=Math.max(1,Number(state.systemTrayV79.lastVolume)||67);
    }
    if(!state.quick.sound&&Number(state.volume)>0)state.systemTrayV79.lastVolume=Number(state.volume);
    saveState();renderTray();renderQuickPanel();
  }
  function toggleBluetooth(){
    ensureState();
    state.systemTrayV79.bluetooth=!state.systemTrayV79.bluetooth;
    state.devices.bluetooth=state.systemTrayV79.bluetooth;
    saveState();renderQuickPanel();
    notify("Bluetooth",state.systemTrayV79.bluetooth?"Bluetooth virtual ligado.":"Bluetooth virtual desligado.");
  }
  function toggleFocus(){
    if(globalThis.Win11NotificationCenter){
      Win11NotificationCenter.setFocusMode(Win11NotificationCenter.isQuiet()?"off":"priority");
    }
    renderQuickPanel();
  }
  function toggleNight(){
    state.quick.night=!state.quick.night;saveState();applyVirtualVisuals();renderQuickPanel();
  }
  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement)await globalThis.RealDeviceBridge?.exitFullscreen?.();
      else await globalThis.RealDeviceBridge?.enterFullscreen?.();
    }catch{notify("Definições rápidas","O browser não permitiu ecrã completo.")}
    setTimeout(()=>renderQuickPanel(),40);
  }
  async function toggleWake(){
    try{
      if(globalThis.RealDeviceBridge?.setWakeLock)await RealDeviceBridge.setWakeLock(!state.realWakeLock);
      else throw new Error("unsupported");
    }catch{notify("Definições rápidas","Wake Lock não está disponível neste dispositivo.")}
    setTimeout(()=>renderQuickPanel(),40);
  }

  function applyVirtualVisuals(){
    ensureState();
    document.getElementById("app")?.classList.toggle("night-light-v79",Boolean(state.quick.night));
    document.getElementById("app")?.classList.toggle("energy-saver-v79",Boolean(state.systemTrayV79.energySaver));
  }

  function ensureOverflow(){
    if(overflowPanel?.isConnected)return overflowPanel;
    overflowPanel=document.createElement("section");
    overflowPanel.id="tray-overflow-v79";
    overflowPanel.className="tray-overflow-v79";
    overflowPanel.innerHTML=
      '<div class="tray-overflow-grid-v79">'+
        '<button data-overflow-security-v79 title="Segurança do Windows"><span>'+svg("shield")+'</span><small>Segurança</small></button>'+
        '<button data-overflow-device-v79 title="Centro do dispositivo"><span>'+svg("device")+'</span><small>Dispositivo</small></button>'+
        '<button data-overflow-onedrive-v79 title="OneDrive"><span>'+svg("cloud")+'</span><small>OneDrive</small></button>'+
        '<button data-overflow-background-v79 title="Atividade em segundo plano"><span>'+svg("wake")+'</span><small>Background</small></button>'+
      '</div>';
    document.getElementById("app")?.appendChild(overflowPanel);
    overflowPanel.querySelector("[data-overflow-security-v79]").onclick=()=>{closeOverflow();openApp("security")};
    overflowPanel.querySelector("[data-overflow-device-v79]").onclick=()=>{closeOverflow();Win11DeviceCenter?.open?.()};
    overflowPanel.querySelector("[data-overflow-onedrive-v79]").onclick=()=>{closeOverflow();openApp("onedrive")};
    overflowPanel.querySelector("[data-overflow-background-v79]").onclick=()=>{closeOverflow();openApp("taskscheduler")};
    return overflowPanel;
  }
  function toggleOverflow(){
    const p=ensureOverflow();
    const open=!p.classList.contains("open");
    if(open)closeOverlays();
    p.classList.toggle("open",open);
    document.getElementById("tray-overflow-btn-v79")?.classList.toggle("active",open);
  }
  function closeOverflow(){
    overflowPanel?.classList.remove("open");
    document.getElementById("tray-overflow-btn-v79")?.classList.remove("active");
  }

  function privacyActivity(){
    const camera=[...document.querySelectorAll('video')].some(v=>v.srcObject?.getVideoTracks?.().some(t=>t.readyState==="live"));
    const mic=[...document.querySelectorAll('audio,video')].some(v=>v.srcObject?.getAudioTracks?.().some(t=>t.readyState==="live"));
    let dot=document.getElementById("privacy-indicator-v79");
    const right=document.querySelector("#taskbar .task-right");
    if((camera||mic)&&right){
      if(!dot){
        dot=document.createElement("button");dot.id="privacy-indicator-v79";dot.className="privacy-indicator-v79 tray-btn";
        const quick=document.getElementById("quick-btn");right.insertBefore(dot,quick);
        dot.onclick=e=>{e.stopPropagation();Win11DeviceCenter?.open?.()};
      }
      dot.innerHTML='<span class="privacy-dot-v79"></span><small>'+(camera&&mic?"Câmara + micro":camera?"Câmara":"Micro")+'</small>';
      dot.title=(camera&&mic?"Câmara e microfone":camera?"Câmara":"Microfone")+" em utilização por conteúdo Web autorizado";
      dot.hidden=false;
    }else if(dot)dot.hidden=true;
  }

  function scheduleRefresh(){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(async()=>{
      try{await collect()}catch{}
      installTaskbar();renderTray();privacyActivity();
      if(document.getElementById("quick-panel")?.classList.contains("open"))renderQuickPanel();
    },120);
  }

  async function bindBattery(){
    if(typeof navigator.getBattery!=="function")return;
    try{
      batteryObject=await navigator.getBattery();
      ["chargingchange","levelchange","chargingtimechange","dischargingtimechange"].forEach(ev=>batteryObject.addEventListener(ev,scheduleRefresh));
    }catch{}
  }

  function installEvents(){
    window.addEventListener("online",scheduleRefresh);
    window.addEventListener("offline",scheduleRefresh);
    document.addEventListener("fullscreenchange",scheduleRefresh);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")scheduleRefresh()});
    try{(navigator.connection||navigator.mozConnection||navigator.webkitConnection)?.addEventListener("change",scheduleRefresh)}catch{}
    document.getElementById("quick-btn")?.addEventListener("click",()=>{closeOverflow();setTimeout(()=>renderQuickPanel(),0)});
    document.getElementById("notify-btn")?.addEventListener("click",closeOverflow);
    document.getElementById("clock-btn")?.addEventListener("click",closeOverflow);
    document.addEventListener("pointerdown",e=>{
      if(!e.target.closest("#tray-overflow-v79,#tray-overflow-btn-v79"))closeOverflow();
    });
    document.addEventListener("keydown",e=>{
      if(e.metaKey&&!e.ctrlKey&&!e.altKey&&e.key.toLowerCase()==="a"){
        e.preventDefault();closeOverflow();toggleOverlay("quick");if(overlays.quick.classList.contains("open"))renderQuickPanel();
      }
      if(e.metaKey&&!e.ctrlKey&&!e.altKey&&e.key.toLowerCase()==="n"){
        e.preventDefault();closeOverflow();toggleOverlay("notifications");
      }
    });
    setInterval(()=>{if(document.visibilityState==="visible")privacyActivity()},1500);
    bindBattery();
  }

  globalThis.applyState=function(){
    previousApplyState?.();
    applyVirtualVisuals();
    renderTray();
  };
  try{applyState=globalThis.applyState}catch{}

  ensureState();
  applyVirtualVisuals();
  installTaskbar();
  ensureOverflow();
  renderQuickPanel();
  installEvents();
  collect().then(()=>{renderTray();renderQuickPanel()}).catch(()=>{});

  globalThis.Win11SystemTray=Object.freeze({
    version:"8.1.0",
    refresh:async()=>{await collect();installTaskbar();renderTray();renderQuickPanel();privacyActivity();return snapshot},
    toggleQuick:()=>{toggleOverlay("quick");if(overlays.quick.classList.contains("open"))renderQuickPanel()},
    toggleOverflow,
    closeOverflow,
    get snapshot(){return snapshot?JSON.parse(JSON.stringify(snapshot)):null},
    get state(){ensureState();return JSON.parse(JSON.stringify(state.systemTrayV79))}
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"8.1.0",
    step:18,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "system-tray-v2","quick-settings-v2","stable-tray-svg-icons","real-network-tray-state",
      "real-battery-tray-state","virtual-volume-control","virtual-brightness-control","virtual-bluetooth-toggle",
      "night-light-visual","focus-assist-quick-toggle","fullscreen-quick-toggle","wake-lock-quick-toggle",
      "tray-overflow","privacy-media-indicator","win-a-quick-settings","win-n-notifications"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
