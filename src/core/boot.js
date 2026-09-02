"use strict";
(function bootWindowsSimulatorV100(){
  const VERSION="10.0.0";
  const required=[
    "openApp","applyState","renderRecommended","buildExplorerV5",
    "buildSettingsV5","buildServices","buildDiskManagement","buildPowerShell"
  ];
  const platform=globalThis.Win11Platform;
  const bootElement=document.getElementById("boot");

  function renderBootFailure(title,detail){
    console.error("[V10.0]",title,detail||"");
    if(bootElement){
      bootElement.innerHTML="<h2>"+escapeHTML(title)+"</h2><p>"+
        escapeHTML(detail||"Consulte a consola para diagnóstico.")+"</p>";
      bootElement.classList.remove("hidden");
    }
  }
  if(!platform||typeof platform.registerModule!=="function"){
    renderBootFailure("Falha ao iniciar V10.0","Platform Foundation indisponível.");
    return;
  }

  platform.attachSystemBus();
  function registerCompat(id,version,globals,provides=[]){
    try{
      return platform.inspect(id)||platform.registerLegacy(id,version,globals,{provides});
    }catch(error){
      console.warn("[V10.0] Compat registration failed",id,error);
      return null;
    }
  }
  registerCompat("legacy-runtime","9.9.7",required,["runtime"]);
  registerCompat("system-bus","9.8.1",["Win11SystemBus"],["event-bus"]);
  registerCompat("settings-core","9.8.7",["Win11SettingsStore"],["settings-store"]);
  registerCompat("storage","9.8.6",["Win11Storage"],["storage-engine"]);
  registerCompat("shell-intents","9.9.0",["Win11Shell"],["shell-router"]);
  registerCompat("app-sessions","9.9.1",["Win11AppSessions"],["app-session-manager"]);
  registerCompat("window-manager","8.1.0",["Win11WindowManager"],["window-manager"]);
  registerCompat("session-restore","9.9.5",["Win11SessionRestore"],["session-restore"]);
  registerCompat("session-recovery","9.9.4",["Win11SessionRecovery"],["session-recovery"]);
  registerCompat("safe-mode","9.9.7",["Win11SafeMode"],["safe-mode"]);
  registerCompat("system-health","9.8.7",["Win11SystemHealth"],["system-health"]);
  registerCompat("edge-search","9.9.7",["Win11EdgeSearch"],["edge-search"]);

  try{
    if(!platform.inspect("boot")){
      platform.registerModule({
        id:"boot",version:VERSION,layer:"core",
        requires:["platform","legacy-runtime"],
        provides:["boot-orchestrator","compat-bootstrap"]
      });
    }
    platform.setStatus("boot","starting",{phase:"validate-runtime"});
  }catch(error){
    renderBootFailure("Falha ao preparar V10.0",String(error?.message||error));
    return;
  }

  const missing=required.filter(name=>typeof globalThis[name]!=="function");
  globalThis.Win11SimDiagnostics={
    version:VERSION,
    run(){
      return {
        version:VERSION,
        missingFunctions:required.filter(name=>typeof globalThis[name]!=="function"),
        windowCount:document.querySelectorAll(".window").length,
        currentDesktop:Number(state.currentDesktop)||0,
        platform:platform.diagnostics()
      };
    }
  };
  if(missing.length){
    platform.setStatus("legacy-runtime","degraded",{missingFunctions:missing});
    platform.setStatus("boot","failed",{reason:"missing-runtime-functions",missingFunctions:missing});
    renderBootFailure("Falha ao iniciar V10.0","Módulos em falta: "+missing.join(", "));
    return;
  }

  platform.setStatus("legacy-runtime","ready",{validated:true});
  state.desktops=Array.isArray(state.desktops)&&state.desktops.length
    ?state.desktops:["Ambiente 1"];
  state.currentDesktop=clamp(Number(state.currentDesktop)||0,0,state.desktops.length-1);

  try{
    applyState();
    renderRecommended();
  }catch(error){
    platform.setStatus("boot","failed",{reason:"initial-render"});
    renderBootFailure("Falha ao preparar o ambiente",String(error?.message||error));
    return;
  }

  const sessionBoot = globalThis.Win11SessionManager?.handleBootComplete
    ?Promise.resolve().then(()=>globalThis.Win11SessionManager.handleBootComplete())
    :Promise.resolve(false);

  setTimeout(async()=>{
    let sessionHandled=false;
    try{
      await sessionBoot;
      sessionHandled=Boolean(globalThis.Win11SessionManager);
    }catch(error){
      console.error("[V10.0] Session boot failed",error);
    }
    if(!sessionHandled){
      document.getElementById("lock")?.classList.remove("hidden");
    }
    document.getElementById("boot")?.classList.add("hidden");
    try{
      platform.setStatus("boot","ready",{
        phase:"complete",
        sessionManager:Boolean(globalThis.Win11SessionManager),
        safeMode:Boolean(globalThis.Win11SafeMode)
      });
    }catch(error){
      console.error("[V10.0] Platform ready transition failed",error);
    }
  },650);
})();
