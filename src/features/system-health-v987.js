"use strict";
(function installSystemHealthV987(){
  const VERSION="9.8.7";
  const HISTORY_LIMIT=20;
  const history=[];
  const store=globalThis.Win11SettingsStore;
  const bus=globalThis.Win11SystemBus;
  const previousRenderSettingsPage=globalThis.renderSettingsPageV5;
  if(!store||!bus||typeof previousRenderSettingsPage!=="function"){
    throw new Error("System Health V9.8.7 requires Settings Core, System Bus and Settings V5.");
  }

  const WEIGHTS=Object.freeze({
    core:15,integrity:15,schema:10,bridges:15,bus:10,
    apps:10,storage:10,taskbar:5,explorer:5,personalization:5
  });
  const EXT_BRIDGES=Object.freeze({
    txtApp:[".txt"],htmlApp:[".html",".htm"],pngApp:[".png"],jpgApp:[".jpg",".jpeg"],
    mp3App:[".mp3"],mp4App:[".mp4"],pdfApp:[".pdf"]
  });
  const FALLBACK_BRIDGES=Object.freeze({
    defaultText:[".md",".log",".json",".csv",".js",".css",".xml",".ini"],
    defaultImage:[".webp",".gif",".bmp",".svg"],
    defaultMedia:[".wav",".ogg",".m4a",".aac",".flac",".webm",".mov",".mkv",".avi"]
  });
  let rerenderPending=false;

  function clone(value){
    try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}
  }
  function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}
  function row(id,label,status,detail,repairable=false){
    return Object.freeze({id,label,status,detail:String(detail||""),repairable:Boolean(repairable),weight:WEIGHTS[id]||0});
  }
  function coreCheck(){
    const names=[
      "Win11SettingsStore","Win11SystemBus","Win11Personalization","Win11TaskbarSystem",
      "Win11TaskbarWindowPro","Win11ExplorerSettings","Win11Storage","Win11AppRegistry",
      "Win11FileAssociations","Win11ProtocolRegistry","Win11DefaultApps"
    ];
    const missing=names.filter(name=>!globalThis[name]);
    return row("core","APIs centrais",missing.length?"error":"ok",
      missing.length?missing.length+" integração(ões) indisponíveis":"Todas as integrações V9.8 estão carregadas");
  }
  function integrityCheck(){
    try{
      const meta=store.metadata(),pkg=store.exportConfig();
      const ok=meta.schemaVersion===store.schemaVersion&&meta.checksum===pkg.integrity?.value;
      return row("integrity","Integridade das Definições",ok?"ok":"error",
        ok?"Schema e checksum coerentes":"Checksum ou schema inconsistente",!ok);
    }catch(error){return row("integrity","Integridade das Definições","error",error?.message||"Falha de integridade",true)}
  }
  function schemaCheck(){
    try{
      const data=store.get();let invalid=0,total=0;
      for(const [category,values] of Object.entries(data)){
        for(const [key,value] of Object.entries(values)){total++;if(!store.validate(category+"."+key,value))invalid++}
      }
      return row("schema","Validação do schema",invalid?"error":"ok",
        invalid?invalid+" valor(es) inválidos":total+" valores validados",invalid>0);
    }catch(error){return row("schema","Validação do schema","error",error?.message||"Falha de validação",true)}
  }
  function legacyBridgeIssues(){
    const cfg=store.get(),issues=[];
    const p=state.personalizationV78||{},fs=state.explorerFilesystemV91||{};
    for(const key of ["themeMode","accent","transparency","animations","wallpaperIndex"]){
      if(!same(p[key],cfg.appearance[key]))issues.push("appearance."+key);
    }
    if(!same(p.taskbarAlignment,cfg.taskbar.alignment))issues.push("taskbar.alignment");
    if(!same(fs.showHidden,cfg.explorer.showHidden))issues.push("explorer.showHidden");
    if(!same(fs.showExtensions,cfg.explorer.showExtensions))issues.push("explorer.showExtensions");
    for(const key of ["textScale","highContrast","narrator","stickyKeys"]){
      if(!same(state.accessibility?.[key],cfg.accessibility[key]))issues.push("accessibility."+key);
    }
    if(!same(state.privacy?.notifications,cfg.notifications.enabled))issues.push("notifications.enabled");
    if(!same(state.notificationCenterV77?.focusMode,cfg.notifications.focusMode))issues.push("notifications.focusMode");
    for(const key of ["brightness","volume"])if(!same(state[key],cfg.system[key]))issues.push("system."+key);
    for(const key of ["location","camera","microphone","diagnostics"]){
      if(!same(state.privacy?.[key],cfg.privacy[key]))issues.push("privacy."+key);
    }
    const assoc=state.fileAssociations||{},protocols=state.protocolAssociations||{};
    for(const [key,exts] of Object.entries(EXT_BRIDGES))for(const ext of exts){
      if(!same(assoc[ext],cfg.apps[key]))issues.push("apps."+ext);
    }
    for(const [key,exts] of Object.entries(FALLBACK_BRIDGES))for(const ext of exts){
      if(!same(assoc[ext],cfg.apps[key]))issues.push("apps."+ext);
    }
    if(!same(protocols.http,cfg.apps.httpApp))issues.push("apps.http");
    if(!same(protocols.https,cfg.apps.httpsApp))issues.push("apps.https");
    return [...new Set(issues)];
  }
  function bridgeCheck(){
    try{
      const issues=legacyBridgeIssues();
      return row("bridges","Bridges de compatibilidade",issues.length?"warn":"ok",
        issues.length?issues.length+" bridge(s) fora de sincronização":"Estado legado alinhado com o Settings Store",issues.length>0);
    }catch(error){return row("bridges","Bridges de compatibilidade","error",error?.message||"Falha ao comparar bridges",true)}
  }
  function busCheck(){
    try{
      const d=bus.diagnostics(),errors=Array.isArray(d.errors)?d.errors.length:0;
      return row("bus","System Bus",errors?"warn":"ok",
        errors?errors+" erro(s) isolados no histórico do bus":d.listenerCount+" listeners · "+d.historySize+" eventos");
    }catch(error){return row("bus","System Bus","error",error?.message||"Diagnóstico indisponível")}
  }
  function appsCheck(){
    try{
      const exts=[".txt",".html",".htm",".png",".jpg",".jpeg",".mp3",".mp4",".pdf"];
      const invalid=exts.filter(ext=>{
        const current=globalThis.Win11FileAssociations?.get?.(ext);
        return !current||!globalThis.Win11AppRegistry?.candidatesForExtension?.(ext)?.some(app=>app.id===current);
      });
      for(const protocol of ["http","https"]){
        const current=globalThis.Win11ProtocolRegistry?.get?.(protocol);
        if(!current||!globalThis.Win11AppRegistry?.supportsProtocol?.(current,protocol))invalid.push(protocol);
      }
      return row("apps","Aplicações predefinidas",invalid.length?"error":"ok",
        invalid.length?invalid.length+" associação(ões) inválidas":"Extensões e protocolos resolvem para aplicações permitidas",invalid.length>0);
    }catch(error){return row("apps","Aplicações predefinidas","error",error?.message||"Registry indisponível",true)}
  }
  function storageCheck(){
    try{
      const s=globalThis.Win11Storage?.snapshot?.();
      const structural=!!s&&Number.isFinite(s.capacity)&&s.capacity>0&&Number.isFinite(s.used)&&s.used>=0&&
        Number.isFinite(s.free)&&s.free===Math.max(0,s.capacity-s.used)&&Array.isArray(s.categories)&&s.categories.length===9;
      if(!structural)return row("storage","Storage 2.0","error","Snapshot de armazenamento inconsistente");
      if(s.used>s.capacity)return row("storage","Storage 2.0","warn","Capacidade virtual excedida · "+Win11Storage.formatBytes(s.used));
      return row("storage","Storage 2.0","ok",Win11Storage.formatBytes(s.used)+" utilizados de "+Win11Storage.formatBytes(s.capacity));
    }catch(error){return row("storage","Storage 2.0","error",error?.message||"Snapshot indisponível")}
  }
  function taskbarCheck(){
    try{
      const cfg=store.get("taskbar"),live=globalThis.Win11TaskbarSystem?.state;
      const ok=!!live&&live.autoHide===cfg.autoHide&&live.showDesktop===cfg.showDesktop&&live.showSeconds===cfg.showSeconds;
      return row("taskbar","Integração da Taskbar",ok?"ok":"warn",
        ok?"Estado live alinhado com as Definições":"Estado live necessita reaplicação",!ok);
    }catch(error){return row("taskbar","Integração da Taskbar","error",error?.message||"Taskbar indisponível",true)}
  }
  function explorerCheck(){
    try{
      const cfg=store.get("explorer"),live=globalThis.Win11ExplorerSettings?.state;
      const ok=!!live&&same(cfg,live);
      return row("explorer","Integração do Explorer",ok?"ok":"warn",
        ok?"Preferências live alinhadas":"Preferências live necessitam reaplicação",!ok);
    }catch(error){return row("explorer","Integração do Explorer","error",error?.message||"Explorer Settings indisponível",true)}
  }
  function personalizationCheck(){
    try{
      const live=globalThis.Win11Personalization?.settings;
      const ok=!!live&&same(live.appearance,store.get("appearance"))&&same(live.taskbar,store.get("taskbar"))&&
        live.textScale===store.get("accessibility.textScale");
      return row("personalization","Personalização",ok?"ok":"warn",
        ok?"Tema, Taskbar e escala alinhados":"Personalização necessita reaplicação",!ok);
    }catch(error){return row("personalization","Personalização","error",error?.message||"Personalização indisponível",true)}
  }
  function scoreChecks(checks){
    let score=0;
    for(const check of checks)score+=check.status==="ok"?check.weight:check.status==="warn"?check.weight*.5:0;
    return Math.round(score);
  }
  function diagnose({record=true,source="api"}={}){
    const checks=[
      coreCheck(),integrityCheck(),schemaCheck(),bridgeCheck(),busCheck(),
      appsCheck(),storageCheck(),taskbarCheck(),explorerCheck(),personalizationCheck()
    ];
    const score=scoreChecks(checks),errors=checks.filter(c=>c.status==="error").length,warnings=checks.filter(c=>c.status==="warn").length;
    const level=errors?"degraded":warnings?"attention":"healthy";
    const result={
      version:VERSION,time:Date.now(),source:String(source).slice(0,64),
      score,level,errors,warnings,
      settings:{schemaVersion:store.schemaVersion,revision:store.metadata().revision},
      bus:{errors:bus.diagnostics().errors.length,historySize:bus.diagnostics().historySize},
      checks:checks.map(c=>({...c}))
    };
    if(record){
      history.unshift(clone(result));
      if(history.length>HISTORY_LIMIT)history.length=HISTORY_LIMIT;
    }
    return clone(result);
  }
  async function reconcile({source="manual"}={}){
    const before=diagnose({record:false,source:"before-reconcile"}),actions=[];
    try{store.reconcileLegacy({source:"system-health-v987"});actions.push("settings-legacy")}catch{}
    try{globalThis.Win11Personalization?.apply?.();actions.push("personalization")}catch{}
    try{globalThis.Win11ExplorerSettings?.apply?.();actions.push("explorer-settings")}catch{}
    try{globalThis.Win11ExplorerFilesystem?.refreshAll?.();actions.push("explorer-filesystem")}catch{}
    try{globalThis.Win11TaskbarSystem?.apply?.();actions.push("taskbar-system")}catch{}
    try{
      const repaired=globalThis.Win11TaskbarWindowPro?.repairTaskButtons?.()||0;
      globalThis.Win11TaskbarWindowPro?.refresh?.();actions.push("taskbar-windows:"+repaired);
    }catch{}
    try{globalThis.Win11SearchV920?.invalidate?.();actions.push("search-index")}catch{}
    const after=diagnose({record:true,source:String(source).slice(0,64)});
    bus.emit("system-health:reconciled",{
      source:String(source).slice(0,64),beforeScore:before.score,afterScore:after.score,actions:[...actions]
    });
    return {before,after,actions:[...actions]};
  }
  function exportDiagnostics(){
    const d=diagnose({record:false,source:"export"});
    return {
      kind:"win11-simulator-system-health",version:VERSION,exportedAt:Date.now(),
      score:d.score,level:d.level,errors:d.errors,warnings:d.warnings,
      settings:d.settings,bus:d.bus,
      checks:d.checks.map(({id,label,status,detail,repairable,weight})=>({id,label,status,detail,repairable,weight}))
    };
  }
  function downloadDiagnostics(){
    const blob=new Blob([JSON.stringify(exportDiagnostics(),null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="win11-system-health-v987.json";a.rel="noopener";
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    return true;
  }
  function statusLabel(level){return level==="healthy"?"Saudável":level==="attention"?"Atenção":"Degradado"}
  function checkCard(check){
    const icon=check.status==="ok"?"✓":check.status==="warn"?"!":"×";
    return '<div class="health-check-v987 '+check.status+'" data-health-check="'+check.id+'">'+
      '<span class="health-check-icon-v987">'+icon+'</span><div><strong>'+escapeHTML(check.label)+'</strong>'+
      '<small>'+escapeHTML(check.detail)+'</small></div><span class="health-check-status-v987">'+
      (check.status==="ok"?"OK":check.status==="warn"?"Atenção":"Erro")+'</span></div>';
  }
  function renderHealth(box){
    const d=diagnose({record:false,source:"settings-ui"});
    box.dataset.settingsHealthV987="1";
    box.innerHTML='<div class="settings-health-v987">'+
      '<div class="health-title-v987"><div><h1>Integridade do sistema</h1>'+
      '<p>Diagnóstico das integrações internas do simulador.</p></div>'+
      '<span class="health-badge-v987">V9.8.7</span></div>'+
      '<section class="health-hero-v987 '+d.level+'"><div class="health-score-v987"><strong>'+d.score+'</strong><span>/100</span></div>'+
      '<div><h2>'+statusLabel(d.level)+'</h2><p>'+d.errors+' erro(s) · '+d.warnings+' aviso(s)</p>'+
      '<small>Verifica apenas o simulador — não diagnostica o Windows anfitrião.</small></div></section>'+
      '<section class="health-checks-v987">'+d.checks.map(checkCard).join("")+'</section>'+
      '<section class="health-actions-v987"><div><strong>Reconciliação segura</strong>'+
      '<small>Reaplica Settings, bridges e consumidores sem resetar preferências ou apagar ficheiros.</small></div>'+
      '<div class="health-buttons-v987"><button class="sys-button primary" data-health-reconcile-v987>Reconciliar</button>'+
      '<button class="sys-button" data-health-refresh-v987>Reanalisar</button>'+
      '<button class="sys-button" data-health-export-v987>Exportar diagnóstico</button></div></section>'+
      '<p class="health-footnote-v987">Histórico do System Bus: '+d.bus.historySize+' eventos · erros isolados: '+d.bus.errors+
      ' · revisão Settings: '+d.settings.revision+'.</p></div>';
    box.querySelector("[data-health-refresh-v987]")?.addEventListener("click",()=>renderHealth(box));
    box.querySelector("[data-health-export-v987]")?.addEventListener("click",()=>{
      downloadDiagnostics();notify("Integridade do sistema","Diagnóstico técnico exportado.");
    });
    box.querySelector("[data-health-reconcile-v987]")?.addEventListener("click",async e=>{
      const btn=e.currentTarget;btn.disabled=true;btn.textContent="A reconciliar…";
      try{
        const result=await reconcile({source:"settings-ui-v987"});
        notify("Integridade do sistema","Reconciliação concluída: "+result.after.score+"/100.");
      }finally{renderHealth(box)}
    });
  }
  function scheduleRerender(){
    if(rerenderPending)return;rerenderPending=true;
    queueMicrotask(()=>{
      rerenderPending=false;
      document.querySelectorAll('[data-settings-page][data-settings-health-v987="1"]').forEach(renderHealth);
    });
  }

  globalThis.renderSettingsPageV5=function(box,page){
    if(page==="health"){renderHealth(box);return}
    delete box.dataset.settingsHealthV987;
    previousRenderSettingsPage(box,page);
  };
  try{renderSettingsPageV5=globalThis.renderSettingsPageV5}catch{}

  for(const topic of ["settings:committed","settings:reconciled","storage:changed"])bus.on(topic,scheduleRerender);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")scheduleRerender()});
  globalThis.Win11SystemHealth=Object.freeze({
    version:VERSION,diagnose,reconcile,exportDiagnostics,downloadDiagnostics,
    getHistory:(limit=10)=>clone(history.slice(0,Math.max(0,Math.min(HISTORY_LIMIT,Number(limit)||0)))),
    get last(){return clone(history[0]||null)}
  });

  reconcile({source:"boot-v987"}).catch(()=>{});

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:37,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "system-health","integration-diagnostics","settings-legacy-reconcile",
      "integration-safe-repair","bounded-health-history","diagnostics-export",
      "v98-integration-hardening"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
