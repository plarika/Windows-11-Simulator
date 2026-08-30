"use strict";
/* Windows 11 Simulator V8.0 — Windows Experience & Reliability */
(function installWindowsExperienceV800(){
  const VERSION="8.1.0";
  const RELOAD_KEY="win11-update-reload-v800";
  let revealUntil=0;
  let lastLockHidden=true;
  let registration=null;
  let updateBanner=null;
  let updateState="idle";
  let controllerReloadArmed=false;
  let enhanceTimer=null;
  const watchedRegistrations=new WeakSet();

  function lock(){
    return document.getElementById("lock");
  }
  function visibleLock(){
    const l=lock();
    return Boolean(l&&!l.classList.contains("hidden")&&getComputedStyle(l).display!=="none");
  }
  function isLogin(){
    return Boolean(lock()?.querySelector("[data-login-secret]"));
  }
  function firstSetup(){
    return Boolean(lock()?.querySelector("[data-new-user-name]"));
  }
  function icon(kind){
    const common='viewBox="0 0 24 24" focusable="false" aria-hidden="true"';
    if(kind==="network")return '<svg '+common+'><path d="M4 18h2v2H4zm4-4h2v6H8zm4-4h2v10h-2zm4-4h2v14h-2z" fill="currentColor"/></svg>';
    if(kind==="offline")return '<svg '+common+'><path d="M4 18h2v2H4zm4-4h2v6H8zm4-4h2v10h-2zm4-4h2v14h-2z" fill="currentColor" opacity=".25"/><path d="M5 5l14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    if(kind==="battery")return '<svg '+common+'><rect x="3" y="7" width="17" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M21 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    if(kind==="face")return '<svg '+common+'><path d="M7 4H5a1 1 0 0 0-1 1v2m13-3h2a1 1 0 0 1 1 1v2M7 20H5a1 1 0 0 1-1-1v-2m13 3h2a1 1 0 0 0 1-1v-2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/><path d="M9 15c1.8 1.4 4.2 1.4 6 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    if(kind==="key")return '<svg '+common+'><circle cx="8" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 12h8m-3 0v3m-3-3v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    return '<svg '+common+'><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
  }

  async function lockStatus(){
    const net=navigator.onLine;
    let battery=null;
    try{
      if(globalThis.Win11DeviceCenter?.batterySnapshot)battery=await Win11DeviceCenter.batterySnapshot();
      else if(typeof navigator.getBattery==="function"){
        const b=await navigator.getBattery();
        battery={level:Math.round((Number(b.level)||0)*100),charging:Boolean(b.charging)};
      }
    }catch{}
    return {net,battery};
  }

  async function renderLockStatus(){
    const host=lock()?.querySelector("[data-lock-status-v800]");
    if(!host)return;
    const s=await lockStatus();
    const html=
      '<span title="'+(s.net?"Online":"Offline")+'">'+icon(s.net?"network":"offline")+'<small>'+(s.net?"Online":"Offline")+'</small></span>'+
      (s.battery?'<span title="Bateria '+s.battery.level+'%">'+icon("battery")+'<small>'+s.battery.level+'%</small></span>':"");
    if(host.innerHTML!==html)host.innerHTML=html;
  }

  function revealSignIn(focus=true){
    const l=lock();
    if(!l||!isLogin())return false;
    revealUntil=Date.now()+60000;
    l.classList.remove("lock-clock-stage-v800");
    l.classList.add("lock-auth-stage-v800");
    l.querySelector(".session-auth-host")?.setAttribute("aria-hidden","false");
    if(focus)setTimeout(()=>l.querySelector("[data-login-secret]")?.focus(),120);
    return true;
  }

  function stageSignIn(){
    const l=lock();
    if(!l||!isLogin()||firstSetup())return;
    if(Date.now()<revealUntil){revealSignIn(false);return;}
    l.classList.add("lock-clock-stage-v800");
    l.classList.remove("lock-auth-stage-v800");
    l.querySelector(".session-auth-host")?.setAttribute("aria-hidden","true");
  }
  function helloMarkup(){
    return '<div class="hello-v800" data-hello-v800>'+
      '<span class="hello-face-v800">'+icon("face")+'</span>'+
      '<div><strong>Windows Hello</strong><small>Início de sessão local protegido</small></div>'+
    '</div>';
  }

  function signInOptionsMarkup(){
    return '<button class="signin-options-btn-v800" data-signin-options-v800>Opções de início de sessão</button>'+
      '<div class="signin-options-v800" data-signin-options-panel-v800 hidden>'+
        '<div><span>'+icon("key")+'</span><div><strong>PIN / palavra-passe local</strong><small>Disponível neste perfil</small></div></div>'+
        '<div class="disabled"><span>'+icon("face")+'</span><div><strong>Windows Hello Face</strong><small>Visual apenas · sem acesso biométrico</small></div></div>'+
      '</div>';
  }

  function enhanceAuthCard(){
    const l=lock();
    const card=l?.querySelector(".session-card");
    if(!card||!isLogin())return;
    if(!card.querySelector("[data-hello-v800]")){
      card.insertAdjacentHTML("afterbegin",helloMarkup());
      const link=card.querySelector("[data-add-user]");
      if(link)link.insertAdjacentHTML("beforebegin",signInOptionsMarkup());
      else card.insertAdjacentHTML("beforeend",signInOptionsMarkup());
    }
    const options=card.querySelector("[data-signin-options-v800]");
    if(options&&!options.dataset.bound){
      options.dataset.bound="1";
      options.onclick=()=>{
        const p=card.querySelector("[data-signin-options-panel-v800]");
        p.hidden=!p.hidden;
      };
    }
    const login=card.querySelector("[data-login]");
    card.classList.toggle("hello-verifying-v800",Boolean(login?.disabled));
  }

  function enhanceLock(){
    const l=lock();
    if(!l||!visibleLock())return;
    l.classList.add("lock-v800");
    if(!l.querySelector("[data-lock-status-v800]")){
      const status=document.createElement("div");
      status.className="lock-status-v800";
      status.dataset.lockStatusV800="";
      l.appendChild(status);
    }
    if(!firstSetup()&&!l.querySelector("[data-lock-hint-v800]")){
      const hint=document.createElement("div");
      hint.className="lock-hint-v800";
      hint.dataset.lockHintV800="";
      hint.textContent="Clique ou prima uma tecla para iniciar sessão";
      l.appendChild(hint);
    }
    enhanceAuthCard();
    stageSignIn();
    renderLockStatus();
  }

  function scheduleEnhance(){
    clearTimeout(enhanceTimer);
    enhanceTimer=setTimeout(enhanceLock,20);
  }

  function observeLock(){
    const l=lock();
    if(!l)return;
    lastLockHidden=l.classList.contains("hidden");
    new MutationObserver(()=>{
      const hidden=l.classList.contains("hidden");
      if(lastLockHidden&&!hidden)revealUntil=0;
      lastLockHidden=hidden;
      scheduleEnhance();
    }).observe(l,{subtree:true,childList:true,attributes:true,characterData:true});
    l.addEventListener("pointerdown",e=>{
      if(l.classList.contains("lock-clock-stage-v800")){
        e.preventDefault();revealSignIn(true);
      }
    },true);
    document.addEventListener("keydown",e=>{
      if(!visibleLock()||!l.classList.contains("lock-clock-stage-v800"))return;
      if(e.ctrlKey||e.altKey||e.metaKey)return;
      e.preventDefault();revealSignIn(true);
    },true);
  }

  function ensureUpdateBanner(){
    if(updateBanner?.isConnected)return updateBanner;
    updateBanner=document.createElement("section");
    updateBanner.id="update-banner-v800";
    updateBanner.className="update-banner-v800";
    updateBanner.innerHTML=
      '<div class="update-icon-v800">↻</div>'+
      '<div><strong>Nova versão disponível</strong><small>Atualize sem perder os dados do perfil local.</small></div>'+
      '<button data-update-later-v800>Depois</button>'+
      '<button class="primary" data-update-now-v800>Atualizar agora</button>';
    document.getElementById("app")?.appendChild(updateBanner);
    updateBanner.querySelector("[data-update-later-v800]").onclick=()=>hideUpdatePrompt();
    updateBanner.querySelector("[data-update-now-v800]").onclick=()=>activateUpdate();
    return updateBanner;
  }

  function showUpdatePrompt(){
    updateState="available";
    ensureUpdateBanner().classList.add("open");
    return true;
  }
  function hideUpdatePrompt(){
    ensureUpdateBanner().classList.remove("open");
    return true;
  }

  async function resolveRegistration(){
    if(registration)return registration;
    registration=globalThis.RealPlatformBridge?.registration||await navigator.serviceWorker?.getRegistration?.("./")||null;
    return registration;
  }

  function watchRegistration(reg){
    if(!reg||watchedRegistrations.has(reg))return;
    watchedRegistrations.add(reg);
    if(reg.waiting&&navigator.serviceWorker.controller)showUpdatePrompt();
    reg.addEventListener("updatefound",()=>{
      const worker=reg.installing;
      if(!worker)return;
      worker.addEventListener("statechange",()=>{
        if(worker.state==="installed"&&navigator.serviceWorker.controller)showUpdatePrompt();
      });
    });
  }

  async function checkForUpdate(){
    if(!("serviceWorker" in navigator))return {supported:false,state:"unsupported"};
    const reg=await resolveRegistration();
    if(!reg)return {supported:true,state:"unregistered"};
    watchRegistration(reg);
    updateState="checking";
    try{await reg.update()}catch(err){
      updateState="error";
      return {supported:true,state:"error",message:String(err?.message||err)};
    }
    if(reg.waiting&&navigator.serviceWorker.controller)showUpdatePrompt();
    else updateState="current";
    return {supported:true,state:updateState,waiting:Boolean(reg.waiting)};
  }
  async function activateUpdate(){
    const reg=await resolveRegistration();
    if(!reg?.waiting){
      const result=await checkForUpdate();
      if(!reg?.waiting){
        notify("Windows Update",result.state==="current"?"Já está a utilizar a versão mais recente.":"A atualização ainda não está pronta.");
        return false;
      }
    }
    updateState="activating";
    controllerReloadArmed=true;
    sessionStorage.setItem(RELOAD_KEY,"1");
    reg.waiting.postMessage({type:"SKIP_WAITING"});
    return true;
  }

  function bindUpdateCoordinator(){
    if(!("serviceWorker" in navigator))return;
    navigator.serviceWorker.addEventListener("controllerchange",()=>{
      if(!controllerReloadArmed)return;
      controllerReloadArmed=false;
      location.reload();
    });
    setTimeout(async()=>{
      const reg=await resolveRegistration();
      watchRegistration(reg);
      checkForUpdate();
    },1400);
    if(sessionStorage.getItem(RELOAD_KEY)==="1"){
      sessionStorage.removeItem(RELOAD_KEY);
      setTimeout(()=>notify("Windows Update","Atualização do simulador aplicada com sucesso."),1000);
    }
  }

  function installSettingsCard(){
    if(typeof globalThis.renderSettingsPageV5!=="function")return;
    const previous=globalThis.renderSettingsPageV5;
    globalThis.renderSettingsPageV5=function(box,page){
      previous(box,page);
      if(page!=="system"||box.querySelector("[data-update-card-v800]"))return;
      const card=document.createElement("div");
      card.className="sys-card update-settings-card-v800";
      card.dataset.updateCardV800="";
      card.innerHTML=
        '<div><strong>Windows Update · Simulator</strong><p>Versão '+VERSION+' · atualizações PWA controladas pelo utilizador.</p></div>'+
        '<button class="sys-button" data-check-update-v800>Procurar atualizações</button>';
      (box.querySelector(".sys-grid")||box).appendChild(card);
      card.querySelector("[data-check-update-v800]").onclick=async e=>{
        const b=e.currentTarget;b.disabled=true;b.textContent="A verificar...";
        const result=await checkForUpdate();
        b.disabled=false;b.textContent=result.waiting?"Atualização pronta":"Procurar atualizações";
        if(result.waiting)showUpdatePrompt();
        else notify("Windows Update","Não foi encontrada uma atualização pendente.");
      };
    };
    try{renderSettingsPageV5=globalThis.renderSettingsPageV5}catch{}
  }
  function recoverShell(){
    try{applyState()}catch{}
    try{globalThis.Win11SystemTray?.refresh?.()}catch{}
    try{renderNotifications()}catch{}
    try{globalThis.Win11DeviceCenter?.refresh?.()}catch{}
    return true;
  }

  function bindRecovery(){
    window.addEventListener("pageshow",e=>{if(e.persisted)recoverShell()});
    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState==="visible")recoverShell();
    });
    window.addEventListener("online",()=>renderLockStatus());
    window.addEventListener("offline",()=>renderLockStatus());
  }

  observeLock();
  installSettingsCard();
  bindUpdateCoordinator();
  bindRecovery();
  scheduleEnhance();

  globalThis.Win11Experience=Object.freeze({
    version:VERSION,
    revealSignIn,
    stageSignIn,
    enhanceLock,
    recoverShell
  });
  globalThis.Win11UpdateCoordinator=Object.freeze({
    version:VERSION,
    checkForUpdate,
    activateUpdate,
    showPrompt:showUpdatePrompt,
    hidePrompt:hideUpdatePrompt,
    get state(){return updateState},
    get registration(){return registration}
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,
    step:19,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "windows-experience-v8","two-stage-lock-screen","windows-hello-visual",
      "lock-network-status","lock-battery-status","signin-options",
      "pwa-update-coordinator","user-approved-service-worker-update",
      "update-settings-card","bfcache-session-recovery","visibility-shell-recovery"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
