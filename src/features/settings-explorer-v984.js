"use strict";
(function installSettingsExplorerV984(){
  const VERSION="9.8.4";
  const store=globalThis.Win11SettingsStore;
  const bus=globalThis.Win11SystemBus;
  const previousRenderSettingsPage=globalThis.renderSettingsPageV5;
  const previousBuildExplorer=globalThis.buildExplorerV5;
  if(!store||!bus||typeof previousRenderSettingsPage!=="function"||typeof previousBuildExplorer!=="function"){
    throw new Error("Explorer Settings V9.8.4 requires Settings Core, System Bus, Settings V5 and Explorer.");
  }

  let rerenderPending=false;

  function prefs(){return store.get("explorer")}
  function quickAccessHome(){
    try{
      const quick=globalThis.Win11ExplorerNavigation?.getQuickAccess?.();
      if(Array.isArray(quick)&&quick.length)return quick[0];
    }catch{}
    return "C:/Documents";
  }
  function resolveInitialPath(initialPath){
    if(initialPath)return initialPath;
    return prefs().openTo==="this-pc"?"This PC":quickAccessHome();
  }
  function explorerWraps(){
    return [...document.querySelectorAll('.window[data-app="explorer"],.window[data-app="recycle"]')].map(w=>
      w.querySelector(".explorer-v4")||w.querySelector(".explorer-real")
    ).filter(Boolean);
  }
  function applyWrap(wrap){
    if(!wrap)return false;
    const p=prefs();
    wrap.classList.toggle("explorer-compact-v984",Boolean(p.compactView));
    wrap.dataset.explorerSettings="9.8.4";
    return true;
  }
  function applyAll(){
    explorerWraps().forEach(applyWrap);
    globalThis.Win11ExplorerFilesystem?.refreshAll?.();
    return true;
  }

  function toggleRow(title,desc,path,on){
    return '<div class="explorer-setting-row-v984"><div><strong>'+escapeHTML(title)+'</strong><small>'+escapeHTML(desc)+
      '</small></div><button class="toggle '+(on?"on":"")+'" data-explorer-toggle-v984="'+path+
      '" aria-pressed="'+String(on)+'"></button></div>';
  }
  function renderExplorerSettings(box){
    const p=prefs(),home=quickAccessHome();
    box.dataset.settingsExplorerV984="1";
    box.innerHTML=
      '<div class="settings-explorer-v984">'+
        '<div class="settings-explorer-title-v984"><div><h1>Explorador de Ficheiros</h1>'+
          '<p>Preferências validadas e isoladas por perfil.</p></div>'+
          '<span class="settings-explorer-badge-v984">Explorer V9.8.4</span></div>'+
        '<section class="settings-explorer-card-v984"><h3>Página inicial</h3>'+
          '<div class="segmented-v78">'+
            '<button data-explorer-open-v984="home" class="'+(p.openTo==="home"?"active":"")+'">Home</button>'+
            '<button data-explorer-open-v984="this-pc" class="'+(p.openTo==="this-pc"?"active":"")+'">Este PC</button>'+
          '</div>'+
          '<small class="settings-explorer-hint-v984">Home abre o primeiro destino do Acesso rápido: '+
            escapeHTML(home)+'.</small></section>'+
        '<section class="settings-explorer-list-v984">'+
          toggleRow("Mostrar itens ocultos","Apresenta ficheiros e pastas marcados como ocultos","explorer.showHidden",p.showHidden)+
          toggleRow("Mostrar extensões de ficheiros","Mantém .txt, .png e outras extensões visíveis","explorer.showExtensions",p.showExtensions)+
          toggleRow("Vista compacta","Reduz espaçamento e altura dos elementos sem alterar o modo de vista","explorer.compactView",p.compactView)+
          toggleRow("Confirmar eliminação","Pede confirmação antes de mover para a Reciclagem ou eliminar itens nela","explorer.confirmDelete",p.confirmDelete)+
        '</section>'+
        '<div class="settings-explorer-actions-v984"><button class="sys-button" data-explorer-reset-v984>Repor definições do Explorer</button>'+
          '<small>Estas opções afetam apenas o filesystem e as janelas virtuais do simulador.</small></div>'+
      '</div>';

    box.querySelectorAll("[data-explorer-open-v984]").forEach(b=>b.onclick=()=>{
      store.set("explorer.openTo",b.dataset.explorerOpenV984,{source:"settings-ui-v984"});
      renderExplorerSettings(box);
    });
    box.querySelectorAll("[data-explorer-toggle-v984]").forEach(b=>b.onclick=()=>{
      const path=b.dataset.explorerToggleV984;
      store.set(path,!store.get(path),{source:"settings-ui-v984"});
      renderExplorerSettings(box);
    });
    box.querySelector("[data-explorer-reset-v984]")?.addEventListener("click",()=>{
      store.resetCategory("explorer",{source:"settings-ui-v984-reset"});
      renderExplorerSettings(box);
    });
  }

  function scheduleOpenRerender(source){
    if(String(source||"").startsWith("settings-ui-v984"))return;
    if(rerenderPending)return;
    rerenderPending=true;
    queueMicrotask(()=>{
      rerenderPending=false;
      document.querySelectorAll('[data-settings-page][data-settings-explorer-v984="1"]').forEach(renderExplorerSettings);
    });
  }

  globalThis.renderSettingsPageV5=function(box,page){
    if(page==="explorer"){renderExplorerSettings(box);return}
    delete box.dataset.settingsExplorerV984;
    previousRenderSettingsPage(box,page);
  };
  try{renderSettingsPageV5=globalThis.renderSettingsPageV5}catch{}

  globalThis.buildExplorerV5=function(wrap,win,startPath){
    previousBuildExplorer(wrap,win,startPath);
    applyWrap(wrap);
  };
  try{buildExplorerV5=globalThis.buildExplorerV5}catch{}

  bus.on("settings:explorer:changed",event=>{
    applyAll();
    scheduleOpenRerender(event.detail?.source);
  });

  applyAll();

  globalThis.Win11ExplorerSettings=Object.freeze({
    version:VERSION,
    apply:applyAll,
    resolveInitialPath,
    get state(){return Object.freeze(prefs())},
    get homePath(){return quickAccessHome()}
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:34,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "explorer-settings-store","explorer-settings-events","explorer-compact-view",
      "explorer-open-to","explorer-delete-confirmation","explorer-filesystem-settings-bridge"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
