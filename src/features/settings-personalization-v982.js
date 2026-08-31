"use strict";
(function installSettingsPersonalizationV982(){
  const VERSION="9.8.2";
  const store=globalThis.Win11SettingsStore;
  const bus=globalThis.Win11SystemBus;
  const legacy=globalThis.Win11Personalization;
  if(!store||!bus||!legacy)throw new Error("Settings Personalization V9.8.2 requires Settings Core, System Bus and V7.8 personalization.");

  const previousRenderSettingsPage=globalThis.renderSettingsPageV5;
  const previousApplyState=globalThis.applyState;
  const accents=[...(legacy.accents||[])];
  const wallpapers=[...(legacy.wallpapers||[])];
  const LEGACY_PATHS={
    themeMode:"appearance.themeMode",
    accent:"appearance.accent",
    transparency:"appearance.transparency",
    animations:"appearance.animations",
    wallpaperIndex:"appearance.wallpaperIndex",
    taskbarAlignment:"taskbar.alignment"
  };
  let rerenderPending=false;

  function clone(value){return structuredClone(value)}
  function currentLegacyShape(){
    const appearance=store.get("appearance"),taskbar=store.get("taskbar");
    return {
      themeMode:appearance.themeMode,accent:appearance.accent,
      transparency:appearance.transparency,animations:appearance.animations,
      wallpaperIndex:appearance.wallpaperIndex,taskbarAlignment:taskbar.alignment
    };
  }

  function reconcileLegacy(){
    const p=legacy.state||{};
    const patch={};
    for(const key of ["themeMode","accent","transparency","animations","wallpaperIndex"]){
      const path=LEGACY_PATHS[key],value=p[key];
      if(store.validate(path,value))patch[key]=value;
    }
    if(Object.keys(patch).length)store.update("appearance",patch,{source:"v982-legacy-reconcile"});
    if(store.validate("taskbar.alignment",p.taskbarAlignment)){
      store.set("taskbar.alignment",p.taskbarAlignment,{source:"v982-legacy-reconcile"});
    }
    const scale=Number(state.accessibility?.textScale);
    if(store.validate("accessibility.textScale",scale)){
      store.set("accessibility.textScale",scale,{source:"v982-legacy-reconcile"});
    }
  }

  function syncCompatibilityState(){
    const p=currentLegacyShape();
    if(!state.personalizationV78||typeof state.personalizationV78!=="object")state.personalizationV78={};
    Object.assign(state.personalizationV78,p);
    const scale=store.get("accessibility.textScale");
    if(!state.accessibility||typeof state.accessibility!=="object")state.accessibility={};
    state.accessibility.textScale=scale;
    return {p,scale};
  }

  function applyFromStore(){
    const {scale}=syncCompatibilityState();
    legacy.apply();
    const app=document.getElementById("app");
    if(app){
      app.style.fontSize=(scale/100*16)+"px";
      app.dataset.settingsIntegration="9.8.2";
    }
    globalThis.Win11TaskbarWindowPro?.refresh?.();
    globalThis.Win11ExplorerMultiWindow?.refreshTaskbar?.();
    return true;
  }

  function setLegacy(key,value){
    const path=LEGACY_PATHS[key];
    if(!path)return false;
    try{
      const changed=store.set(path,value,{source:"personalization-api-v982"});
      applyFromStore();
      return changed||Object.is(store.get(path),value);
    }catch{return false}
  }

  function toggleRow(title,desc,path,on){
    return '<div class="settings-row-v78"><div><strong>'+escapeHTML(title)+'</strong><small>'+escapeHTML(desc)+
      '</small></div><button class="toggle '+(on?"on":"")+'" data-setting-toggle-v982="'+path+'" aria-pressed="'+String(on)+'"></button></div>';
  }
  function personalizationPreview(appearance,taskbar){
    const bg=wallpapers[appearance.wallpaperIndex]||wallpapers[0]||"";
    return '<div class="personalization-preview-v78" style="background:'+bg+'">'+
      '<div class="preview-window-v78"><div></div><span></span><span></span><span></span></div>'+
      '<div class="preview-taskbar-v78 '+(taskbar.alignment==="left"?"left":"center")+'"><i></i><i></i><i></i></div>'+
    '</div>';
  }
  function segment(items,current,attr){
    return '<div class="segmented-v78">'+items.map(([value,label])=>
      '<button '+attr+'="'+value+'" class="'+(current===value?"active":"")+'">'+escapeHTML(label)+'</button>'
    ).join("")+'</div>';
  }

  function renderPersonalization(box){
    const appearance=store.get("appearance"),taskbar=store.get("taskbar");
    const scale=store.get("accessibility.textScale");
    box.dataset.settingsPersonalizationV982="1";
    box.innerHTML=
      '<div class="settings-page-v78 settings-personalization-v982">'+
        '<div class="settings-page-title-v78"><div><h1>Personalização</h1><p>As alterações são validadas e guardadas no perfil ativo.</p></div>'+
          '<span class="settings-core-badge-v982">Settings Core V9.8.2</span></div>'+
        personalizationPreview(appearance,taskbar)+
        '<section class="settings-section-v78"><h3>Tema</h3>'+
          segment([["light","Claro"],["dark","Escuro"],["system","Sistema"]],appearance.themeMode,"data-theme-v982")+
        '</section>'+
        '<section class="settings-section-v78"><h3>Cor de destaque</h3><div class="accent-grid-v78">'+

          accents.map(c=>'<button data-accent-v982="'+c+'" class="'+(appearance.accent===c?"active":"")+
            '" style="--swatch:'+c+'" aria-label="Cor '+c+'"></button>').join("")+
        '</div></section>'+
        '<section class="settings-section-v78"><h3>Fundo</h3><div class="wallpaper-grid-v78">'+
          wallpapers.map((bg,i)=>'<button data-wallpaper-v982="'+i+'" class="'+(appearance.wallpaperIndex===i?"active":"")+
            '" style="background:'+bg+'"><span>'+(i+1)+'</span></button>').join("")+
        '</div></section>'+
        '<section class="settings-list-v78">'+
          toggleRow("Efeitos de transparência","Acrylic e blur nas superfícies do simulador","appearance.transparency",appearance.transparency)+
          toggleRow("Animações","Transições, menus e efeitos das janelas","appearance.animations",appearance.animations)+
        '</section>'+
        '<section class="settings-section-v78 settings-scale-v982"><div><h3>Escala da interface</h3><small>Ajusta o tamanho do texto e dos controlos no simulador.</small></div>'+
          '<div class="settings-scale-control-v982"><input type="range" min="90" max="160" step="5" value="'+scale+'" data-scale-v982>'+
          '<output data-scale-output-v982>'+scale+'%</output></div></section>'+
        '<section class="settings-section-v78"><h3>Alinhamento da Barra de tarefas</h3>'+
          segment([["center","Centro"],["left","Esquerda"]],taskbar.alignment,"data-taskbar-align-v982")+
        '</section>'+
        '<section class="settings-section-v78"><h3>Agrupamento de janelas</h3>'+
          segment([["always","Sempre"],["when-multiple","Quando houver várias"],["never","Nunca"]],taskbar.groupWindows,"data-taskbar-group-v982")+
        '</section>'+
        '<section class="settings-list-v78">'+
          toggleRow("Badges da Barra de tarefas","Mostra o número de janelas agrupadas","taskbar.showBadges",taskbar.showBadges)+
          toggleRow("Progresso de operações","Mostra cópia/movimento do Explorer na Barra de tarefas","taskbar.showProgress",taskbar.showProgress)+
          toggleRow("Pré-visualizações de janelas","Mostra previews seguros nos grupos de aplicações","taskbar.previews",taskbar.previews)+
        '</section>'+

        '<div class="settings-actions-v982"><button class="sys-button" data-reset-personalization-v982>Repor personalização</button>'+
          '<small>As definições são isoladas por perfil e não alteram o Windows real.</small></div>'+
      '</div>';

    box.querySelectorAll("[data-theme-v982]").forEach(b=>b.onclick=()=>{
      store.set("appearance.themeMode",b.dataset.themeV982,{source:"settings-ui-v982"});
      renderPersonalization(box);
    });
    box.querySelectorAll("[data-accent-v982]").forEach(b=>b.onclick=()=>{
      store.set("appearance.accent",b.dataset.accentV982,{source:"settings-ui-v982"});
      renderPersonalization(box);
    });
    box.querySelectorAll("[data-wallpaper-v982]").forEach(b=>b.onclick=()=>{
      store.set("appearance.wallpaperIndex",Number(b.dataset.wallpaperV982),{source:"settings-ui-v982"});
      renderPersonalization(box);
    });
    box.querySelectorAll("[data-taskbar-align-v982]").forEach(b=>b.onclick=()=>{
      store.set("taskbar.alignment",b.dataset.taskbarAlignV982,{source:"settings-ui-v982"});
      renderPersonalization(box);
    });
    box.querySelectorAll("[data-taskbar-group-v982]").forEach(b=>b.onclick=()=>{
      store.set("taskbar.groupWindows",b.dataset.taskbarGroupV982,{source:"settings-ui-v982"});
      renderPersonalization(box);
    });

    box.querySelectorAll("[data-setting-toggle-v982]").forEach(b=>b.onclick=()=>{
      const path=b.dataset.settingToggleV982;
      store.set(path,!store.get(path),{source:"settings-ui-v982"});
      renderPersonalization(box);
    });
    const slider=box.querySelector("[data-scale-v982]"),output=box.querySelector("[data-scale-output-v982]");
    slider?.addEventListener("input",()=>{
      const value=Number(slider.value);
      if(output)output.textContent=value+"%";
      const app=document.getElementById("app");
      if(app)app.style.fontSize=(value/100*16)+"px";
    });
    slider?.addEventListener("change",()=>{
      store.set("accessibility.textScale",Number(slider.value),{source:"settings-ui-v982"});
      renderPersonalization(box);
    });
    box.querySelector("[data-reset-personalization-v982]")?.addEventListener("click",()=>{
      store.resetCategory("appearance",{source:"settings-ui-v982-reset"});
      store.resetCategory("taskbar",{source:"settings-ui-v982-reset"});
      store.set("accessibility.textScale",100,{source:"settings-ui-v982-reset"});
      renderPersonalization(box);
    });
  }

  function scheduleOpenRerender(){
    if(rerenderPending)return;
    rerenderPending=true;
    queueMicrotask(()=>{
      rerenderPending=false;
      document.querySelectorAll('[data-settings-page][data-settings-personalization-v982="1"]').forEach(renderPersonalization);
    });
  }

  globalThis.renderSettingsPageV5=function(box,page){
    if(page==="personalization"){renderPersonalization(box);return}
    delete box.dataset.settingsPersonalizationV982;
    previousRenderSettingsPage?.(box,page);
  };

  try{renderSettingsPageV5=globalThis.renderSettingsPageV5}catch{}

  globalThis.applyState=function(){
    previousApplyState?.();
    applyFromStore();
  };
  try{applyState=globalThis.applyState}catch{}

  function handleSettingsEvent(event){
    applyFromStore();
    if(!String(event.detail?.source||"").startsWith("settings-ui-v982"))scheduleOpenRerender();
  }
  bus.on("settings:appearance:changed",handleSettingsEvent);
  bus.on("settings:taskbar:changed",handleSettingsEvent);
  bus.on("settings:accessibility:changed",event=>{
    if(event.detail?.path==="accessibility.textScale")handleSettingsEvent(event);
  });
  try{
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{
      if(store.get("appearance.themeMode")==="system")applyFromStore();
    });
  }catch{}

  reconcileLegacy();
  applyFromStore();

  globalThis.Win11Personalization=Object.freeze({
    version:VERSION,legacyVersion:legacy.version,
    accents:[...accents],wallpapers:[...wallpapers],wallpaperCount:wallpapers.length,
    apply:applyFromStore,set:setLegacy,
    setScale:value=>{try{return store.set("accessibility.textScale",value,{source:"personalization-api-v982"})}catch{return false}},
    reset:()=>{store.resetCategory("appearance",{source:"personalization-api-v982"});store.resetCategory("taskbar",{source:"personalization-api-v982"});store.set("accessibility.textScale",100,{source:"personalization-api-v982"});return true},
    get state(){return clone(currentLegacyShape())},
    get settings(){return {appearance:store.get("appearance"),taskbar:store.get("taskbar"),textScale:store.get("accessibility.textScale")}}
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:32,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "settings-personalization-store","settings-personalization-events","settings-ui-scale",
      "settings-taskbar-controls","settings-personalization-reset","legacy-personalization-bridge"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
