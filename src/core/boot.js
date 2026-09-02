"use strict";
(async function bootWindowsSimulatorV103(){
  const VERSION="10.3.0";
  const BOOT_MIN_MS=650;
  const required=[
    "openApp","applyState","renderRecommended","buildExplorerV5",
    "buildSettingsV5","buildServices","buildDiskManagement","buildPowerShell"
  ];
  const platform=globalThis.Win11Platform;
  const recovery=globalThis.Win11BootRecovery;
  const bootElement=document.getElementById("boot");
  const bootStartedAt=Date.now();

  function text(value,max=220){
    return String(value??"").trim().slice(0,max);
  }
  function html(value){
    return String(value??"").replace(/[&<>"']/g,c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    })[c]);
  }
  function setBootStatus(message){
    const node=document.getElementById("boot-status");
    if(node)node.textContent=text(message,120);
  }
  function renderBootFailure(title,detail,error=null){
    try{recovery?.failBoot?.(title,error)}catch{}
    try{
      if(platform?.inspect?.("boot"))platform.setStatus("boot","failed",{
        reason:text(title,96)
      });
    }catch{}
    console.error("[V10.3]",title,detail||"",error||"");
    if(!bootElement)return false;
    const safeAvailable=Boolean(globalThis.Win11SessionManager?.activeUserId&&globalThis.Win11SafeMode?.enter);
    bootElement.innerHTML=
      '<div class="boot-recovery-panel-v101" role="alert">'+
      '<h2>'+html(title)+'</h2><p>'+html(detail||"O arranque não foi concluído.")+'</p>'+
      '<div class="boot-recovery-actions-v101">'+
      '<button class="sys-button primary" data-boot-retry-v101>Tentar novamente</button>'+
      '<button class="sys-button" data-boot-safe-v101 '+(safeAvailable?"":"disabled")+
      '>Modo de Segurança</button></div>'+
      '<small>O Modo de Segurança é apenas do simulador e não altera o Windows anfitrião.</small></div>';
    bootElement.classList.remove("hidden");
    bootElement.querySelector("[data-boot-retry-v101]")?.addEventListener("click",()=>location.reload());
    bootElement.querySelector("[data-boot-safe-v101]")?.addEventListener("click",()=>{
      const ok=globalThis.Win11SafeMode?.enter?.({reason:"boot-failure-v101",source:"boot-v101"});
      if(ok)bootElement.classList.add("hidden");
    });
    return false;
  }
  if(!platform||typeof platform.registerModule!=="function"){
    renderBootFailure("Falha ao iniciar V10.3","Platform Foundation indisponível.");
    return;
  }
  if(!recovery||typeof recovery.runPhase!=="function"){
    renderBootFailure("Falha ao iniciar V10.3","Boot Recovery Coordinator indisponível.");
    return;
  }

  platform.attachSystemBus();
  const bootMeta=recovery.beginBoot({source:"boot-v103"});

  function registerCompat(id,version,globals,provides=[]){
    try{
      return platform.inspect(id)||platform.registerLegacy(id,version,globals,{provides});
    }catch(error){
      throw new Error("Falha ao registar "+id+": "+text(error?.message||error));
    }
  }
  async function runPhase(name,label,task,options={}){
    setBootStatus(label);
    try{
      if(platform.inspect("boot"))platform.setStatus("boot","starting",{phase:name});
    }catch{}
    const result=await recovery.runPhase(name,task,options);
    if(!result.ok&&options.required!==false)throw result.error||new Error("Boot phase failed: "+name);
    return result;
  }
  let sessionHandled=false,recoveryPlan=null;
  try{
    await runPhase("compatibility","A validar componentes do sistema...",async()=>{
      registerCompat("legacy-runtime","9.9.7",required,["runtime"]);
      registerCompat("system-bus","9.8.1",["Win11SystemBus"],["event-bus"]);
      registerCompat("settings-core","9.8.7",["Win11SettingsStore"],["settings-store"]);
      registerCompat("storage","9.8.6",["Win11Storage"],["storage-engine"]);
      registerCompat("shell-intents","9.9.0",["Win11Shell"],["shell-router"]);
      registerCompat("app-sessions","9.9.1",["Win11AppSessions"],["app-session-manager"]);
      registerCompat("window-manager","8.1.0",["Win11WindowManager"],["window-manager"]);
      registerCompat("desktop-integration","8.1.0",["Win11DesktopIntegration"],["desktop-integration"]);
      registerCompat("start-search","8.1.0",["Win11StartSearch"],["start-search"]);
      registerCompat("taskbar-window","9.7.0",["Win11TaskbarWindowPro"],["taskbar-window"]);
      registerCompat("taskbar-system","9.8.3",["Win11TaskbarSystem"],["taskbar-system"]);
      registerCompat("session-restore","9.9.5",["Win11SessionRestore"],["session-restore"]);
      registerCompat("session-recovery","9.9.4",["Win11SessionRecovery"],["session-recovery"]);
      registerCompat("safe-mode","9.9.5",["Win11SafeMode"],["safe-mode"]);
      registerCompat("system-health","9.8.7",["Win11SystemHealth"],["system-health"]);
      registerCompat("edge-search","9.9.7",["Win11EdgeSearch"],["edge-search"]);
      const moduleState=await platform.start("boot-recovery");
      if(moduleState.status!=="ready")throw new Error("Boot Recovery dependencies are not ready.");
      if(!platform.inspect("boot")){
        platform.registerModule({
          id:"boot",version:VERSION,layer:"core",
          requires:["platform","legacy-runtime","boot-recovery","desktop-taskbar","window-manager-v10"],
          provides:["boot-orchestrator-v2","recovery-aware-bootstrap","shell-surface-bootstrap","window-manager-bootstrap"]
        });
      }
    },{timeoutMs:3000});

    await runPhase("runtime","A validar o runtime...",()=>{
      const missing=required.filter(name=>typeof globalThis[name]!=="function");
      if(missing.length){
        try{platform.setStatus("legacy-runtime","degraded",{missingFunctions:missing})}catch{}
        throw new Error("Módulos em falta: "+missing.join(", "));
      }
      platform.setStatus("legacy-runtime","ready",{validated:true});
      return true;
    },{timeoutMs:2500});

    globalThis.Win11SimDiagnostics={
      version:VERSION,
      run(){
        return {
          version:VERSION,
          missingFunctions:required.filter(name=>typeof globalThis[name]!=="function"),
          windowCount:document.querySelectorAll(".window").length,
          currentDesktop:Number(state.currentDesktop)||0,
          platform:platform.diagnostics(),
          bootRecovery:recovery.diagnostics(),
          desktopTaskbar:globalThis.Win11DesktopTaskbar?.diagnostics?.()||null,
          windowManager:globalThis.Win11WindowManagerV10?.diagnostics?.()||null
        };
      }
    };

    await runPhase("state","A preparar o ambiente...",async()=>{
      state.desktops=Array.isArray(state.desktops)&&state.desktops.length
        ?state.desktops:["Ambiente 1"];
      state.currentDesktop=clamp(Number(state.currentDesktop)||0,0,state.desktops.length-1);
      applyState();
      renderRecommended();
      const shellModule=await platform.start("desktop-taskbar");
      if(shellModule.status!=="ready")throw new Error("Desktop / Taskbar V10.2 não ficou pronto.");
      const windowModule=await platform.start("window-manager-v10");
      if(windowModule.status!=="ready")throw new Error("Window Manager V10.3 não ficou pronto.");
      return true;
    },{timeoutMs:3000});

    const sessionPhase=await runPhase("session","A preparar a sessão...",async()=>{
      if(!globalThis.Win11SessionManager?.handleBootComplete)return false;
      await globalThis.Win11SessionManager.handleBootComplete();
      return true;
    },{timeoutMs:10000});
    sessionHandled=Boolean(sessionPhase.value&&globalThis.Win11SessionManager);

    const recoveryPhase=await runPhase("recovery","A verificar recuperação...",()=>{
      const sessionInfo=globalThis.Win11SessionRecovery?.statusInfo?.();
      const safeInfo=globalThis.Win11SafeMode?.diagnostics?.();
      recoveryPlan=recovery.recoveryPlan();
      return {
        plan:recoveryPlan,
        sessionPending:Boolean(sessionInfo?.recoveryPending),
        safeModeActive:Boolean(safeInfo?.active)
      };
    },{timeoutMs:2500});
    if(!recoveryPhase.ok)recoveryPlan=recovery.recoveryPlan();

    await runPhase("shell","A iniciar o ambiente de trabalho...",async()=>{
      const remaining=Math.max(0,BOOT_MIN_MS-(Date.now()-bootStartedAt));
      if(remaining)await new Promise(resolve=>setTimeout(resolve,remaining));
      globalThis.Win11DesktopTaskbar?.reconcile?.({source:"boot-shell-v103"});
      globalThis.Win11WindowManagerV10?.reconcile?.({source:"boot-shell-v103",placements:false});
      if(!sessionHandled)document.getElementById("lock")?.classList.remove("hidden");
      document.getElementById("boot")?.classList.add("hidden");
      return true;
    },{timeoutMs:3000});

    platform.setStatus("boot","ready",{
      phase:"complete",
      sessionManager:Boolean(globalThis.Win11SessionManager),
      recoveryMode:recoveryPlan?.mode||"normal",
      safeMode:Boolean(globalThis.Win11SafeMode)
    });
    recovery.completeBoot({
      recoveryMode:recoveryPlan?.mode||"normal",
      sessionHandled
    });

    if(bootMeta.safeModeRecommended&&globalThis.Win11SessionManager?.activeUserId){
      setTimeout(()=>{
        try{notify(
          "Recuperação de arranque",
          "Foram detetados arranques incompletos anteriores. O Modo de Segurança está disponível em Definições > Contas."
        )}catch{}
      },900);
    }
  }catch(error){
    renderBootFailure(
      "O Windows Simulator não conseguiu iniciar",
      text(error?.message||"Falha durante o arranque."),
      error
    );
  }
})();
