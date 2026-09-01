"use strict";
(function installSafeModeV995(){
  const VERSION="9.9.5";
  const bus=globalThis.Win11SystemBus;
  const recovery=globalThis.Win11SessionRecovery;
  const restore=globalThis.Win11SessionRestore;
  const sessions=globalThis.Win11SessionManager;
  const background=globalThis.Win11BackgroundEngine;
  const previousRenderSettingsPage=globalThis.renderSettingsPageV5;
  const baseOpenApp=globalThis.openApp||openApp;
  const baseOpenAppNewWindow=globalThis.openAppNewWindow;
  if(!bus||!recovery||!restore||!sessions||typeof previousRenderSettingsPage!=="function"||
     typeof baseOpenApp!=="function"||typeof baseOpenAppNewWindow!=="function"){
    throw new Error("Safe Mode V9.9.5 requires recovery, restore, session and window APIs.");
  }

  const ALLOWED=new Set([
    "explorer","settings","terminal","powershell","taskmanager","security",
    "systeminfo","recovery","gethelp","eventviewer","devicemanager"
  ]);
  let rerenderPending=false;

  function clone(value){
    try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}
  }

  function blankState(){
    return {
      schemaVersion:1,active:false,enteredAt:0,lastExitAt:0,
      reason:"",backgroundWasEnabled:null,launchesBlocked:0,lastBlockedApp:""
    };
  }
  function ensureState(){
    const raw=state.safeModeV995;
    if(!raw||typeof raw!=="object"||Array.isArray(raw))state.safeModeV995=blankState();
    const s=state.safeModeV995;
    s.schemaVersion=1;
    s.active=Boolean(s.active);
    s.enteredAt=Number.isFinite(Number(s.enteredAt))?Math.max(0,Math.trunc(Number(s.enteredAt))):0;
    s.lastExitAt=Number.isFinite(Number(s.lastExitAt))?Math.max(0,Math.trunc(Number(s.lastExitAt))):0;
    s.reason=String(s.reason||"").slice(0,48);
    s.backgroundWasEnabled=s.backgroundWasEnabled===null?null:Boolean(s.backgroundWasEnabled);
    s.launchesBlocked=Math.max(0,Math.trunc(Number(s.launchesBlocked)||0));
    s.lastBlockedApp=String(s.lastBlockedApp||"").slice(0,40);
    return s;
  }
  function persist(){
    try{saveState();return true}catch{return false}
  }
  function canLaunch(appId){
    return ALLOWED.has(String(appId||"").trim().toLowerCase());
  }

  function notifyBlocked(appId){
    const s=ensureState(),id=String(appId||"").trim().toLowerCase();
    s.launchesBlocked++;
    s.lastBlockedApp=id.slice(0,40);
    persist();
    bus.emit("safe-mode:launch-blocked",{
      version:VERSION,appId:s.lastBlockedApp,count:s.launchesBlocked
    });
    try{notify("Modo de Segurança","Esta aplicação não está disponível no Modo de Segurança virtual.")}catch{}
    scheduleSettingsRerender();
  }
  function guardedOpenApp(appId,initialPath){
    if(ensureState().active&&!canLaunch(appId)){notifyBlocked(appId);return null}
    return baseOpenApp(appId,initialPath);
  }
  function guardedOpenAppNewWindow(appId,initialPath){
    if(ensureState().active&&!canLaunch(appId)){notifyBlocked(appId);return null}
    return baseOpenAppNewWindow(appId,initialPath);
  }

  globalThis.openApp=guardedOpenApp;
  globalThis.openAppNewWindow=guardedOpenAppNewWindow;
  try{openApp=guardedOpenApp;openAppNewWindow=guardedOpenAppNewWindow}catch{}

  function closeWindowsForSafeMode(){
    for(const win of [...document.querySelectorAll("#window-layer > .window")]){
      try{closeWindow(win)}catch{}
    }
  }
  function applyShell(active){
    document.getElementById("app")?.classList.toggle("safe-mode-v995",Boolean(active));
    ensureSafeBanner();
    const banner=document.getElementById("safe-mode-banner-v995");
    if(banner)banner.hidden=!active;
    if(active){
      try{closeOverlays()}catch{}
      try{background?.stop?.()}catch{}
    }else{
      const s=ensureState();
      if(s.backgroundWasEnabled!==false){
        try{background?.start?.()}catch{}
      }
    }
    return Boolean(active);
  }
  function formatTime(value){
    return value?new Date(value).toLocaleString("pt-PT"):"Sem registo";
  }
  function interruptionReport(){
    const info=recovery.statusInfo();
    return Object.freeze({
      lastExitKind:info.lastExitKind,lastExitAt:info.lastExitAt,
      lastExitReason:info.lastExitReason,heartbeatAt:info.heartbeatAt,
      recoveryPending:info.recoveryPending,recoveryDetectedAt:info.recoveryDetectedAt,
      candidateCount:info.candidate?.count||0,autoResume:info.autoResume,
      safeModeActive:ensureState().active
    });
  }

  function ensureSafeBanner(){
    let banner=document.getElementById("safe-mode-banner-v995");
    if(banner)return banner;
    banner=document.createElement("div");
    banner.id="safe-mode-banner-v995";
    banner.hidden=true;
    banner.innerHTML=
      '<div><strong>Modo de Segurança</strong><small>Windows Simulator · apenas componentes essenciais</small></div>'+
      '<div class="safe-mode-banner-actions-v995">'+
      '<button data-safe-mode-recover-v995>Recuperar sessão</button>'+
      '<button data-safe-mode-exit-v995>Sair sem recuperar</button></div>';
    document.getElementById("app")?.appendChild(banner);
    banner.querySelector("[data-safe-mode-recover-v995]").onclick=()=>exit({
      source:"safe-banner",recoverPending:true
    });
    banner.querySelector("[data-safe-mode-exit-v995]").onclick=()=>exit({
      source:"safe-banner",discardPending:true
    });
    return banner;
  }

  function hideRecoveryChoice(){
    document.getElementById("recovery-choice-v995")?.remove();
  }
  function showRecoveryChoice({source="recovery"}={}){
    if(ensureState().active)return false;
    const info=recovery.statusInfo();
    if(!info.recoveryPending)return false;
    hideRecoveryChoice();

    const report=interruptionReport(),overlay=document.createElement("div");
    overlay.id="recovery-choice-v995";
    overlay.className="recovery-choice-v995";
    overlay.innerHTML=
      '<section role="dialog" aria-modal="true" aria-labelledby="recovery-choice-title-v995">'+
      '<div class="recovery-choice-icon-v995" aria-hidden="true">!</div>'+
      '<h2 id="recovery-choice-title-v995">O Windows Simulator foi interrompido</h2>'+
      '<p>Encontrámos uma sessão anterior que não terminou de forma limpa.</p>'+
      '<div class="recovery-choice-diagnostics-v995">'+
      '<span>Janelas recuperáveis <strong>'+Number(report.candidateCount||0)+'</strong></span>'+
      '<span>Último heartbeat <strong>'+escapeHTML(formatTime(report.heartbeatAt))+'</strong></span>'+
      '<span>Origem <strong>'+escapeHTML(report.lastExitReason||"unexpected")+'</strong></span></div>'+
      '<div class="recovery-choice-actions-v995">'+
      '<button class="primary" data-recovery-choice-restore-v995>Recuperar sessão</button>'+
      '<button data-recovery-choice-normal-v995>Continuar sem recuperar</button>'+
      '<button data-recovery-choice-safe-v995>Modo de Segurança</button></div>'+
      '<small>O Modo de Segurança é apenas do simulador e não altera o Windows anfitrião.</small></section>';
    document.getElementById("app")?.appendChild(overlay);
    overlay.querySelector("[data-recovery-choice-restore-v995]").onclick=async()=>{
      hideRecoveryChoice();await recovery.recover({source:"recovery-choice-v995"});
    };
    overlay.querySelector("[data-recovery-choice-normal-v995]").onclick=()=>{
      recovery.discard({source:"recovery-choice-v995-normal"});hideRecoveryChoice();
    };
    overlay.querySelector("[data-recovery-choice-safe-v995]").onclick=()=>{
      hideRecoveryChoice();enter({reason:"recovery-pending",source:"recovery-choice-v995"});
    };
    bus.emit("safe-mode:recovery-choice-shown",{
      version:VERSION,source:String(source).slice(0,48),count:report.candidateCount
    });
    return true;
  }

  function enter({reason="manual",source="api"}={}){
    if(!sessions.activeUserId)return false;
    const s=ensureState();
    if(s.active){applyShell(true);return true}
    s.active=true;
    s.enteredAt=Date.now();
    s.reason=String(reason||"manual").slice(0,48);
    s.backgroundWasEnabled=background?.enabled===undefined?null:Boolean(background.enabled);
    s.launchesBlocked=0;
    s.lastBlockedApp="";
    restore.setCaptureSuspended(true,{source:"safe-mode-v995-enter"});
    persist();
    closeWindowsForSafeMode();
    applyShell(true);
    bus.emit("safe-mode:entered",{
      version:VERSION,reason:s.reason,source:String(source).slice(0,48)
    });
    setTimeout(()=>{
      state.settingsPage="accounts";persist();
      baseOpenApp("settings");
    },70);
    scheduleSettingsRerender();
    return true;
  }

  async function exit({source="api",recoverPending=false,discardPending=false}={}){
    const s=ensureState();
    if(!s.active)return {exited:false,recovered:false};
    s.active=false;s.lastExitAt=Date.now();
    restore.setCaptureSuspended(false,{source:"safe-mode-v995-exit"});
    applyShell(false);
    persist();
    bus.emit("safe-mode:exited",{
      version:VERSION,source:String(source).slice(0,48),
      recoverPending:Boolean(recoverPending),discardPending:Boolean(discardPending)
    });
    let result=null;
    if(recoverPending&&recovery.statusInfo().recoveryPending){
      result=await recovery.recover({source:"safe-mode-v995-exit"});
    }else if(discardPending&&recovery.statusInfo().recoveryPending){
      recovery.discard({source:"safe-mode-v995-exit"});
    }
    scheduleSettingsRerender();
    return {exited:true,recovered:Boolean(result?.recovered),count:result?.count||0};
  }

  function handleSessionStart(reason="login"){
    if(!ensureState().active)return false;
    restore.setCaptureSuspended(true,{source:"safe-mode-v995-resume"});
    applyShell(true);
    try{recovery.heartbeat({source:"safe-mode-v995-resume",persistNow:true})}catch{}
    bus.emit("safe-mode:resumed",{version:VERSION,reason:String(reason).slice(0,48)});
    setTimeout(()=>{
      if(!document.querySelector('#window-layer > .window[data-app="settings"]')){
        state.settingsPage="accounts";persist();baseOpenApp("settings");
      }
    },80);
    return true;
  }

  function diagnostics(){
    const s=ensureState(),report=interruptionReport();
    return Object.freeze({
      version:VERSION,active:s.active,reason:s.reason,enteredAt:s.enteredAt,
      lastExitAt:s.lastExitAt,launchesBlocked:s.launchesBlocked,
      lastBlockedApp:s.lastBlockedApp,allowedApps:[...ALLOWED],
      backgroundPaused:Boolean(s.active),recoveryPending:report.recoveryPending,
      candidateCount:report.candidateCount,lastHeartbeatAt:report.heartbeatAt
    });
  }

  function renderSafeModeCard(box){
    box.querySelector("[data-safe-mode-v995]")?.remove();
    const s=ensureState(),report=interruptionReport(),card=document.createElement("div");
    card.className="sys-card safe-mode-card-v995";
    card.dataset.safeModeV995="";
    card.innerHTML=
      '<div class="safe-mode-card-head-v995"><div><strong>Modo de Segurança virtual</strong>'+
      '<p>Inicia apenas componentes essenciais e mantém intacto o snapshot de recuperação.</p></div>'+
      '<span class="safe-mode-state-v995 '+(s.active?"on":"")+'">'+(s.active?"Ativo":"Desativado")+'</span></div>'+
      '<div class="safe-mode-diag-v995">'+
      '<span>Último encerramento <strong>'+escapeHTML(report.lastExitKind||"unknown")+'</strong></span>'+
      '<span>Heartbeat <strong>'+escapeHTML(formatTime(report.heartbeatAt))+'</strong></span>'+
      '<span>Recuperação pendente <strong>'+(report.recoveryPending?"Sim":"Não")+'</strong></span>'+
      '<span>Janelas recuperáveis <strong>'+Number(report.candidateCount||0)+'</strong></span>'+
      '<span>Bloqueios de apps <strong>'+s.launchesBlocked+'</strong></span></div>'+
      '<div class="safe-mode-actions-v995">'+
      (s.active?
        '<button class="sys-button primary" data-safe-mode-recover-settings-v995>Recuperar e sair</button>'+
        '<button class="sys-button" data-safe-mode-exit-settings-v995>Sair sem recuperar</button>':
        '<button class="sys-button" data-safe-mode-enter-settings-v995>Iniciar Modo de Segurança</button>'+
        (report.recoveryPending?'<button class="sys-button" data-safe-mode-choice-settings-v995>Opções de recuperação</button>':""))+
      '</div><small class="safe-mode-note-v995">Apps essenciais: Explorer, Definições, Terminal/PowerShell, Gestor de Tarefas, Segurança, Informação do Sistema, Recuperação e Ajuda.</small>';
    (box.querySelector(".sys-grid")||box).appendChild(card);

    card.querySelector("[data-safe-mode-enter-settings-v995]")?.addEventListener("click",()=>
      enter({reason:"manual",source:"settings-ui-v995"})
    );
    card.querySelector("[data-safe-mode-choice-settings-v995]")?.addEventListener("click",()=>
      showRecoveryChoice({source:"settings-ui-v995"})
    );
    card.querySelector("[data-safe-mode-recover-settings-v995]")?.addEventListener("click",()=>
      exit({source:"settings-ui-v995",recoverPending:true})
    );
    card.querySelector("[data-safe-mode-exit-settings-v995]")?.addEventListener("click",()=>
      exit({source:"settings-ui-v995",discardPending:true})
    );
    return card;
  }

  function scheduleSettingsRerender(){
    if(rerenderPending)return;rerenderPending=true;
    queueMicrotask(()=>{
      rerenderPending=false;
      if(state.settingsPage!=="accounts")return;
      document.querySelectorAll('#window-layer > .window[data-app="settings"] [data-settings-page]')
        .forEach(renderSafeModeCard);
    });
  }

  globalThis.renderSettingsPageV5=function(box,page){
    previousRenderSettingsPage(box,page);
    if(page==="accounts")renderSafeModeCard(box);
  };
  try{renderSettingsPageV5=globalThis.renderSettingsPageV5}catch{}

  bus.on("session-recovery:detected",event=>{
    const info=recovery.statusInfo();
    if(event.detail?.recoveryPending&&info.recoveryPending&&!info.autoResume){
      setTimeout(()=>showRecoveryChoice({source:"session-recovery-detected"}),80);
    }
  });
  for(const topic of ["session-recovery:completed","session-recovery:discarded",
    "session-recovery:auto-resume","safe-mode:entered","safe-mode:exited"]){
    bus.on(topic,scheduleSettingsRerender);
  }

  globalThis.Win11SafeMode=Object.freeze({
    version:VERSION,enter,exit,handleSessionStart,showRecoveryChoice,hideRecoveryChoice,
    canLaunch,diagnostics,interruptionReport,
    get isActive(){return Boolean(ensureState().active)},
    get allowedApps(){return Object.freeze([...ALLOWED])},
    get state(){return Object.freeze(clone(ensureState()))}
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"9.9.7",step:45,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "recovery-choice-ui","virtual-safe-mode","safe-mode-launch-policy",
      "safe-mode-background-pause","safe-mode-snapshot-preservation",
      "safe-mode-session-resume","safe-mode-diagnostics","safe-mode-settings-center",
      "edge-google-youtube-hotfix","edge-search-experience-pro",
      "edge-google-programmable-search","edge-youtube-data-api-search"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });

  ensureSafeBanner();
})();
