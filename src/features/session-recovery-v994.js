"use strict";
(function installSessionRecoveryV994(){
  const VERSION="9.9.4";
  const SCHEMA_VERSION=1;
  const HEARTBEAT_MS=30000;
  const HISTORY_LIMIT=24;
  const bus=globalThis.Win11SystemBus;
  const restore=globalThis.Win11SessionRestore;
  const sessions=globalThis.Win11SessionManager;
  const previousRenderSettingsPage=globalThis.renderSettingsPageV5;
  if(!bus||!restore||!sessions||typeof previousRenderSettingsPage!=="function"){
    throw new Error("Session Recovery V9.9.4 requires System Bus, Session Restore, Session Manager and Settings.");
  }

  let heartbeatTimer=0;
  let rerenderPending=false;
  const history=[];

  function clone(value){
    try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}
  }
  function now(){return Date.now()}
  function safeTime(value){
    const n=Number(value);
    return Number.isFinite(n)&&n>0?Math.trunc(n):0;
  }
  function blankState(){
    return {
      schemaVersion:SCHEMA_VERSION,
      autoResume:true,
      runtimeStatus:"idle",
      startedAt:0,
      heartbeatAt:0,
      lastExitKind:"unknown",
      lastExitAt:0,
      lastExitReason:"",
      recoveryPending:false,
      recoveryDetectedAt:0,
      lastRecoveryAt:0,
      lastRecoveryCount:0,
      interruptions:0,
      recoveries:0,
      discards:0
    };
  }
  function ensureState(){
    const raw=state.sessionRecoveryV994;
    if(!raw||typeof raw!=="object"||Array.isArray(raw))state.sessionRecoveryV994=blankState();
    const s=state.sessionRecoveryV994;
    s.schemaVersion=SCHEMA_VERSION;
    s.autoResume=s.autoResume!==false;
    s.runtimeStatus=["idle","running","locked","clean"].includes(s.runtimeStatus)?s.runtimeStatus:"idle";
    for(const key of ["startedAt","heartbeatAt","lastExitAt","recoveryDetectedAt","lastRecoveryAt"]){
      s[key]=safeTime(s[key]);
    }
    for(const key of ["lastRecoveryCount","interruptions","recoveries","discards"]){
      s[key]=Math.max(0,Math.trunc(Number(s[key])||0));
    }
    s.lastExitKind=["unknown","clean","interrupted"].includes(s.lastExitKind)?s.lastExitKind:"unknown";
    s.lastExitReason=String(s.lastExitReason||"").slice(0,48);
    s.recoveryPending=Boolean(s.recoveryPending);
    return s;
  }
  function record(type,detail={}){
    const entry={
      version:VERSION,time:now(),type:String(type).slice(0,40),
      ...detail
    };
    history.unshift(entry);
    if(history.length>HISTORY_LIMIT)history.length=HISTORY_LIMIT;
    return entry;
  }

  function persist(){
    try{saveState();return true}catch{return false}
  }
  function hasActiveSession(){
    return Boolean(sessions.activeUserId);
  }
  function recoveryCandidate(){
    try{
      const info=restore.snapshotInfo();
      return {
        available:Boolean(info.enabled&&info.count>0&&!info.stale),
        count:info.count||0,
        savedAt:info.savedAt||0,
        stale:Boolean(info.stale),
        enabled:Boolean(info.enabled)
      };
    }catch{
      return {available:false,count:0,savedAt:0,stale:false,enabled:false};
    }
  }
  function heartbeat({source="timer",persistNow=true}={}){
    if(!hasActiveSession())return false;
    const s=ensureState();
    if(s.runtimeStatus!=="running")return false;
    s.heartbeatAt=now();
    if(persistNow)persist();
    if(source!=="timer")record("heartbeat",{source:String(source).slice(0,48)});
    return true;
  }
  function scheduleSettingsRerender(){
    if(rerenderPending)return;
    rerenderPending=true;
    queueMicrotask(()=>{
      rerenderPending=false;
      if(state.settingsPage!=="accounts")return;
      document.querySelectorAll('.window[data-app="settings"] [data-settings-page]').forEach(renderRecoveryCard);
    });
  }
  function startHeartbeat(){
    clearInterval(heartbeatTimer);
    heartbeatTimer=setInterval(()=>heartbeat({source:"timer",persistNow:true}),HEARTBEAT_MS);
  }

  function markClean(reason){
    if(!hasActiveSession())return false;
    const s=ensureState(),t=now();
    s.runtimeStatus="clean";
    s.lastExitKind="clean";
    s.lastExitAt=t;
    s.lastExitReason=String(reason||"clean").slice(0,48);
    s.heartbeatAt=t;
    s.recoveryPending=false;
    s.recoveryDetectedAt=0;
    persist();
    const detail={reason:s.lastExitReason};
    record("clean",detail);
    bus.emit("session-recovery:clean",{version:VERSION,...detail});
    scheduleSettingsRerender();
    return true;
  }
  function markLocked(reason){
    if(!hasActiveSession())return false;
    const s=ensureState();
    s.runtimeStatus="locked";
    s.heartbeatAt=now();
    persist();
    record("locked",{reason:String(reason||"lock").slice(0,48)});
    scheduleSettingsRerender();
    return true;
  }
  function setAutoResume(value,{source="api"}={}){
    const s=ensureState(),next=Boolean(value);
    if(s.autoResume===next)return next;
    s.autoResume=next;
    persist();
    const detail={enabled:next,source:String(source).slice(0,48)};
    record("auto-resume",detail);
    bus.emit("session-recovery:auto-resume",{version:VERSION,...detail});
    scheduleSettingsRerender();
    return next;
  }
  function clearHistory({source="api"}={}){
    const s=ensureState();
    s.lastExitKind="unknown";
    s.lastExitAt=0;
    s.lastExitReason="";
    s.lastRecoveryAt=0;
    s.lastRecoveryCount=0;
    s.interruptions=0;
    s.recoveries=0;
    s.discards=0;
    if(!s.recoveryPending)s.recoveryDetectedAt=0;
    history.length=0;
    persist();
    bus.emit("session-recovery:history-cleared",{version:VERSION,source:String(source).slice(0,48)});
    scheduleSettingsRerender();
    return true;
  }

  async function recover({source="api"}={}){
    const s=ensureState();
    if(!s.recoveryPending)return {recovered:false,count:0,reason:"none"};
    const result=await restore.restore({
      source:"crash-recovery-v994-"+String(source||"api").slice(0,40),
      force:true
    });
    const t=now();
    s.recoveryPending=false;
    s.recoveryDetectedAt=0;
    s.runtimeStatus="running";
    s.startedAt=s.startedAt||t;
    s.heartbeatAt=t;
    if(result.restored){
      s.lastRecoveryAt=t;
      s.lastRecoveryCount=Math.max(0,Math.trunc(Number(result.count)||0));
      s.recoveries++;
    }
    persist();
    const detail={
      source:String(source).slice(0,48),
      recovered:Boolean(result.restored),
      count:result.count||0,
      reason:result.reason||""
    };
    record("recovery",detail);
    bus.emit("session-recovery:completed",{version:VERSION,...detail});
    scheduleSettingsRerender();
    return {recovered:Boolean(result.restored),count:result.count||0,reason:result.reason||""};
  }
  function discard({source="api"}={}){
    const s=ensureState();
    if(!s.recoveryPending)return false;
    s.recoveryPending=false;
    s.recoveryDetectedAt=0;
    s.discards++;
    s.runtimeStatus="running";
    s.heartbeatAt=now();
    persist();
    const detail={source:String(source).slice(0,48)};
    record("discarded",detail);
    bus.emit("session-recovery:discarded",{version:VERSION,...detail});
    scheduleSettingsRerender();
    return true;
  }

  function handleSessionStart(reason="login"){
    const s=ensureState();
    const previousStatus=s.runtimeStatus;
    const wasPending=s.recoveryPending;
    const t=now();
    const candidate=recoveryCandidate();
    let intercepted=false;

    if(previousStatus==="running"){
      s.lastExitKind="interrupted";
      s.lastExitAt=s.heartbeatAt||s.startedAt||t;
      s.lastExitReason="unexpected";
      if(!wasPending)s.interruptions++;
      s.recoveryPending=Boolean(candidate.available);
      s.recoveryDetectedAt=s.recoveryPending?(s.recoveryDetectedAt||t):0;
      intercepted=true;
    }else if(previousStatus==="locked"){
      s.recoveryPending=false;
      s.recoveryDetectedAt=0;
      intercepted=true;
    }else{
      s.recoveryPending=false;
      s.recoveryDetectedAt=0;
    }

    s.runtimeStatus="running";
    s.startedAt=t;
    s.heartbeatAt=t;
    persist();

    const detail={
      reason:String(reason).slice(0,48),
      previousStatus,
      interrupted:previousStatus==="running",
      recoveryPending:s.recoveryPending,
      candidateCount:candidate.count,
      autoResume:s.autoResume
    };
    record("session-start",detail);
    bus.emit("session-recovery:session-start",{version:VERSION,...detail});

    if(previousStatus==="running"){
      bus.emit("session-recovery:detected",{
        version:VERSION,
        reason:"unexpected",
        recoveryPending:s.recoveryPending,
        count:candidate.count,
        ageMs:Math.max(0,t-(s.lastExitAt||t))
      });
      if(s.recoveryPending&&s.autoResume){
        setTimeout(()=>recover({source:"auto"}).catch(()=>{}),90);
      }else if(s.recoveryPending){
        setTimeout(()=>notify(
          "Recuperação de sessão",
          "Foi detetada uma sessão interrompida. Pode recuperá-la em Definições > Contas."
        ),120);
      }
    }

    startHeartbeat();
    scheduleSettingsRerender();
    return intercepted;
  }

  function statusInfo(){
    const s=ensureState(),candidate=recoveryCandidate();
    let label="Sessão em execução",tone="ok";
    if(s.recoveryPending){label="Recuperação pendente";tone="warn"}
    else if(s.runtimeStatus==="locked"){label="Sessão bloqueada";tone="neutral"}
    else if(s.lastExitKind==="clean"){label="Último encerramento limpo";tone="ok"}
    else if(s.lastExitKind==="interrupted"&&s.lastRecoveryAt){label="Interrupção recuperada";tone="ok"}
    else if(s.lastExitKind==="interrupted"){label="Interrupção detetada";tone="warn"}
    return {
      version:VERSION,schemaVersion:SCHEMA_VERSION,label,tone,
      runtimeStatus:s.runtimeStatus,lastExitKind:s.lastExitKind,lastExitAt:s.lastExitAt,
      lastExitReason:s.lastExitReason,heartbeatAt:s.heartbeatAt,
      recoveryPending:s.recoveryPending,recoveryDetectedAt:s.recoveryDetectedAt,
      autoResume:s.autoResume,interruptions:s.interruptions,recoveries:s.recoveries,
      discards:s.discards,lastRecoveryAt:s.lastRecoveryAt,lastRecoveryCount:s.lastRecoveryCount,
      candidate
    };
  }

  function diagnostics(){
    const i=statusInfo();
    return Object.freeze({
      version:VERSION,schemaVersion:SCHEMA_VERSION,
      runtimeStatus:i.runtimeStatus,lastExitKind:i.lastExitKind,
      recoveryPending:i.recoveryPending,autoResume:i.autoResume,
      interruptions:i.interruptions,recoveries:i.recoveries,discards:i.discards,
      heartbeatMs:HEARTBEAT_MS,historySize:history.length,historyLimit:HISTORY_LIMIT,
      candidateCount:i.candidate.count
    });
  }

  function formatTime(value){
    return value?new Date(value).toLocaleString("pt-PT"):"Sem registo";
  }

  function renderRecoveryCard(box){
    box.querySelector("[data-session-recovery-v994]")?.remove();
    const info=statusInfo(),card=document.createElement("div");
    card.className="sys-card session-recovery-v994";
    card.dataset.sessionRecoveryV994="";
    card.innerHTML=
      '<div class="session-recovery-head-v994"><div><strong>Recuperação de sessão</strong>'+
      '<p>Distingue encerramentos limpos de interrupções e usa o snapshot seguro V9.9.3 para retomar aplicações.</p></div>'+
      '<span class="session-recovery-status-v994 '+info.tone+'">'+escapeHTML(info.label)+'</span></div>'+
      '<div class="session-recovery-row-v994"><div><strong>Recuperar automaticamente após interrupção</strong>'+
      '<small>Mantém a reabertura automática. Desative para escolher Recuperar ou Descartar.</small></div>'+
      '<button class="toggle '+(info.autoResume?"on":"")+'" data-session-recovery-auto-v994 aria-pressed="'+String(info.autoResume)+'"></button></div>'+
      '<div class="session-recovery-meta-v994">'+
      '<span>Interrupções: <strong>'+info.interruptions+'</strong></span>'+
      '<span>Recuperações: <strong>'+info.recoveries+'</strong></span>'+
      '<span>Descartadas: <strong>'+info.discards+'</strong></span>'+
      '<span>Último heartbeat: '+escapeHTML(formatTime(info.heartbeatAt))+'</span></div>'+
      (info.recoveryPending?
        '<div class="session-recovery-pending-v994"><strong>Sessão interrompida disponível</strong>'+
        '<small>'+info.candidate.count+' janela(s) no snapshot seguro.</small>'+
        '<div><button class="sys-button primary" data-session-recovery-now-v994>Recuperar sessão</button>'+
        '<button class="sys-button" data-session-recovery-discard-v994>Descartar</button></div></div>':
        '<p class="session-recovery-note-v994">Último estado: '+escapeHTML(info.lastExitKind)+
        ' · '+escapeHTML(formatTime(info.lastExitAt))+'.</p>')+
      '<div class="session-recovery-actions-v994"><button class="sys-button" data-session-recovery-clear-v994>Limpar histórico</button></div>';

    (box.querySelector(".sys-grid")||box).appendChild(card);

    card.querySelector("[data-session-recovery-auto-v994]").onclick=()=>{
      setAutoResume(!ensureState().autoResume,{source:"settings-ui-v994"});
      renderRecoveryCard(box);
    };
    card.querySelector("[data-session-recovery-now-v994]")?.addEventListener("click",async()=>{
      const result=await recover({source:"settings-ui"});
      notify("Recuperação de sessão",result.recovered?result.count+" janela(s) recuperadas.":"Nada para recuperar.");
      renderRecoveryCard(box);
    });
    card.querySelector("[data-session-recovery-discard-v994]")?.addEventListener("click",()=>{
      discard({source:"settings-ui"});
      notify("Recuperação de sessão","Recuperação pendente descartada.");
      renderRecoveryCard(box);
    });
    card.querySelector("[data-session-recovery-clear-v994]").onclick=()=>{
      clearHistory({source:"settings-ui"});
      renderRecoveryCard(box);
    };
    return card;
  }

  globalThis.renderSettingsPageV5=function(box,page){
    previousRenderSettingsPage(box,page);
    if(page==="accounts")renderRecoveryCard(box);
  };
  try{renderSettingsPageV5=globalThis.renderSettingsPageV5}catch{}

  window.addEventListener("win11-session-saving",event=>{
    const reason=String(event.detail?.reason||"unknown");
    if(reason.startsWith("lock-"))markLocked(reason);
    else if(["sign-out","forced-end","power","switch-account"].includes(reason))markClean(reason);
    else heartbeat({source:"session-saving-"+reason,persistNow:true});
  });

  window.addEventListener("win11-session-lock",event=>
    markLocked("lock-"+String(event.detail?.reason||"manual"))
  );

  window.addEventListener("pagehide",()=>
    heartbeat({source:"pagehide-v994",persistNow:true})
  );

  window.addEventListener("pageshow",event=>{
    if(event.persisted)heartbeat({source:"pageshow-bfcache-v994",persistNow:true});
  });

  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"){
      heartbeat({source:"visibility-v994",persistNow:true});
    }
  });

  globalThis.Win11SessionRecovery=Object.freeze({
    version:VERSION,
    schemaVersion:SCHEMA_VERSION,
    handleSessionStart,
    recover,
    discard,
    setAutoResume,
    clearHistory,
    heartbeat,
    statusInfo,
    diagnostics,
    get state(){return Object.freeze(clone(ensureState()))},
    getHistory:(limit=12)=>clone(
      history.slice(0,Math.max(0,Math.min(HISTORY_LIMIT,Number(limit)||0)))
    ),
    limits:Object.freeze({heartbeatMs:HEARTBEAT_MS,historyLimit:HISTORY_LIMIT})
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,
    step:42,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "session-recovery-manager",
      "clean-exit-detection",
      "unexpected-session-detection",
      "session-heartbeat",
      "crash-resume",
      "manual-recovery-choice",
      "auto-crash-resume",
      "session-recovery-history",
      "accounts-recovery-center"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
