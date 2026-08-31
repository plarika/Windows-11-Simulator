"use strict";
(function installStorageV986(){
  const VERSION="9.8.6";
  const CAPACITY_BYTES=128*1024*1024*1024;
  const TEMP_ROOTS=["C:/Temp","C:/Windows/Temp","C:/AppData/Local/Temp"];
  const store=globalThis.Win11SettingsStore;
  const bus=globalThis.Win11SystemBus;
  const previousRenderSettingsPage=globalThis.renderSettingsPageV5;
  if(!store||!bus||typeof previousRenderSettingsPage!=="function"){
    throw new Error("Storage V9.8.6 requires Settings Core, System Bus and Settings V5.");
  }

  const CATEGORY_META=Object.freeze({
    apps:{label:"Aplicações",icon:"▦"},
    documents:{label:"Documentos",icon:"▤"},
    pictures:{label:"Imagens",icon:"▧"},
    videos:{label:"Vídeos",icon:"▶"},
    music:{label:"Música",icon:"♫"},
    downloads:{label:"Transferências",icon:"⇩"},
    temporary:{label:"Ficheiros temporários",icon:"⌛"},
    recycle:{label:"Reciclagem",icon:"♻"},
    other:{label:"Outros",icon:"◇"}
  });
  const APP_SIZE_MB=Object.freeze({
    edge:520,explorer:95,settings:82,store:210,photos:170,paint:125,
    mediaplayer:185,notepad:34,terminal:72,powershell:74,taskmanager:48,
    resmon:42,camera:95,calc:28,security:135,diskmgmt:38,services:36,
    taskscheduler:36,systeminfo:44,backup:52,recovery:40
  });
  let rerenderPending=false;

  function valueSize(value){
    if(value==null)return 0;
    if(globalThis.Win11ExplorerDetails?.virtualValueSize){
      try{return Win11ExplorerDetails.virtualValueSize(value)}catch{}
    }
    if(typeof value==="string")return new Blob([value]).size;
    if(value instanceof Blob)return value.size;
    if(Number.isFinite(Number(value?.size)))return Number(value.size);
    try{return new Blob([JSON.stringify(value)]).size}catch{return 0}
  }
  function formatBytes(bytes){
    bytes=Math.max(0,Number(bytes)||0);
    if(bytes<1024)return bytes+" B";
    const units=["KB","MB","GB","TB"];let n=bytes/1024,i=0;
    while(n>=1024&&i<units.length-1){n/=1024;i++}
    return n.toLocaleString("pt-PT",{maximumFractionDigits:n>=100?0:n>=10?1:2})+" "+units[i];
  }
  function isPathUnder(path,root){return path===root||path.startsWith(root+"/")}

  function categoryForPath(path){
    path=String(path||"");
    if(path==="Recycle Bin")return "recycle";
    if(TEMP_ROOTS.some(root=>isPathUnder(path,root)))return "temporary";
    if(isPathUnder(path,"C:/Documents"))return "documents";
    if(isPathUnder(path,"C:/Pictures"))return "pictures";
    if(isPathUnder(path,"C:/Videos"))return "videos";
    if(isPathUnder(path,"C:/Music"))return "music";
    if(isPathUnder(path,"C:/Downloads"))return "downloads";
    return "other";
  }
  function appBytes(){
    let total=0,count=0;
    for(const id of Object.keys(APPS||{})){
      total+=(APP_SIZE_MB[id]||32)*1024*1024;count++;
    }
    return {bytes:total,count};
  }
  function scan(){
    const categories={};
    for(const key of Object.keys(CATEGORY_META))categories[key]={key,...CATEGORY_META[key],bytes:0,files:0,folders:0};
    const paths=Object.keys(state.files||{});
    for(const path of paths){
      const key=categoryForPath(path);
      if(key==="recycle")continue;
      const entries=state.files[path]||{};
      categories[key].folders++;
      for(const value of Object.values(entries)){
        categories[key].files++;
        categories[key].bytes+=valueSize(value);
      }
    }
    const recycle=globalThis.Win11ExplorerRecycle?.getSummary?.();
    if(recycle){
      categories.recycle.files=Number(recycle.count)||0;
      categories.recycle.bytes=Number(recycle.size)||0;
      categories.recycle.folders=categories.recycle.files?1:0;
    }else{
      const bin=ensureFolder("Recycle Bin");
      for(const entry of Object.values(bin)){
        categories.recycle.files++;
        categories.recycle.bytes+=valueSize(entry?.content??entry);
      }
      categories.recycle.folders=categories.recycle.files?1:0;
    }
    const apps=appBytes();
    categories.apps.bytes=apps.bytes;categories.apps.files=apps.count;categories.apps.folders=1;
    return categories;
  }
  function snapshot(){
    const categories=scan();
    const used=Object.values(categories).reduce((n,c)=>n+c.bytes,0);
    const free=Math.max(0,CAPACITY_BYTES-used);
    return {
      version:VERSION,capacity:CAPACITY_BYTES,used,free,
      percent:CAPACITY_BYTES?Math.min(100,used/CAPACITY_BYTES*100):0,
      categories:Object.values(categories).map(c=>({...c})),
      settings:store.get("storage"),
      generatedAt:Date.now()
    };
  }

  async function cleanupTemporary(){
    let files=0,bytes=0;
    for(const path of Object.keys(state.files||{})){
      if(!TEMP_ROOTS.some(root=>isPathUnder(path,root)))continue;
      const folder=state.files[path]||{};
      for(const [name,value] of Object.entries(folder)){
        bytes+=valueSize(value);files++;
        try{await globalThis.RealContentBridge?.cleanupVirtualValue?.(value)}catch{}
        delete folder[name];
      }
    }
    return {files,bytes};
  }
  async function cleanup({temporary=true,recycleBin=false,source="manual"}={}){
    const before=snapshot();
    const result={temporary:{files:0,bytes:0},recycle:{files:0,bytes:0},freed:0,source};
    if(temporary)result.temporary=await cleanupTemporary();
    if(recycleBin){
      const summary=globalThis.Win11ExplorerRecycle?.getSummary?.()||{count:0,size:0};
      result.recycle={files:Number(summary.count)||0,bytes:Number(summary.size)||0};
      if(result.recycle.files){
        if(globalThis.Win11ExplorerRecycle?.empty)await Win11ExplorerRecycle.empty(null);
        else{
          const bin=ensureFolder("Recycle Bin");
          for(const [name,entry] of Object.entries(bin)){
            try{await globalThis.RealContentBridge?.cleanupVirtualValue?.(entry?.content??entry)}catch{}
            delete bin[name];
          }
        }
      }
    }
    saveState();
    globalThis.Win11SearchV920?.invalidate?.();
    globalThis.Win11ExplorerFilesystem?.refreshAll?.();
    globalThis.Win11ExplorerRecycle?.getItems?.();
    const after=snapshot();
    result.freed=Math.max(0,before.used-after.used);
    bus.emit("storage:changed",{source:String(source).slice(0,64),freed:result.freed,temporary:result.temporary.files,recycle:result.recycle.files});
    return result;
  }
  async function runStorageSense({source="storage-sense"}={}){
    if(!store.get("storage.cleanupEnabled"))return {ran:false,reason:"disabled",freed:0};
    const result=await cleanup({
      temporary:true,
      recycleBin:Boolean(store.get("storage.recycleBinEnabled")),
      source
    });
    return {ran:true,...result};
  }

  function pct(bytes,total){return total?Math.min(100,bytes/total*100):0}
  function categoryRow(c,maxBytes){
    const width=maxBytes?Math.max(c.bytes?2:0,c.bytes/maxBytes*100):0;
    return '<div class="storage-category-v986" data-storage-category="'+c.key+'">'+
      '<div class="storage-category-icon-v986">'+c.icon+'</div>'+
      '<div class="storage-category-main-v986"><div><strong>'+escapeHTML(c.label)+'</strong>'+
      '<span>'+escapeHTML(formatBytes(c.bytes))+'</span></div>'+
      '<div class="storage-category-bar-v986"><i style="width:'+width.toFixed(2)+'%"></i></div>'+
      '<small>'+c.files+' ficheiro'+(c.files===1?"":"s")+(c.key==="apps"?" · estimativa da instalação virtual":"")+'</small></div></div>';
  }
  function toggleRow(title,desc,path,on){
    return '<div class="storage-toggle-row-v986"><div><strong>'+escapeHTML(title)+'</strong><small>'+escapeHTML(desc)+
      '</small></div><button class="toggle '+(on?"on":"")+'" data-storage-toggle-v986="'+path+'" aria-pressed="'+String(on)+'"></button></div>';
  }
  function renderSettings(box){
    const s=snapshot(),maxBytes=Math.max(...s.categories.map(c=>c.bytes),1);
    const temp=s.categories.find(c=>c.key==="temporary"),recycle=s.categories.find(c=>c.key==="recycle");
    box.dataset.settingsStorageV986="1";
    box.innerHTML='<div class="settings-storage-v986">'+
      '<div class="storage-title-v986"><div><h1>Armazenamento</h1>'+
      '<p>Armazenamento virtual do perfil ativo — não é o disco real do dispositivo.</p></div>'+
      '<span class="storage-badge-v986">Storage 2.0 · V9.8.6</span></div>'+
      '<section class="storage-hero-v986"><div class="storage-capacity-v986"><strong>'+escapeHTML(formatBytes(s.used))+'</strong>'+
      '<span>utilizados de '+escapeHTML(formatBytes(s.capacity))+'</span></div>'+
      '<div class="storage-total-bar-v986"><i style="width:'+Math.max(s.percent?1:0,s.percent).toFixed(3)+'%"></i></div>'+
      '<div class="storage-summary-v986"><span>'+s.percent.toLocaleString("pt-PT",{maximumFractionDigits:2})+'% utilizado</span>'+
      '<span>'+escapeHTML(formatBytes(s.free))+' livres</span></div></section>'+
      '<section class="storage-categories-v986"><h3>Utilização por categoria</h3>'+
      s.categories.map(c=>categoryRow(c,maxBytes)).join("")+'</section>'+
      '<section class="storage-cleanup-v986"><div class="storage-cleanup-head-v986"><div><h3>Sensor de Armazenamento</h3>'+
      '<p>Limpa apenas ficheiros temporários virtuais e, opcionalmente, a Reciclagem.</p></div></div>'+
      toggleRow("Limpeza automática","Permite que a tarefa Storage Sense execute a limpeza virtual.","storage.cleanupEnabled",s.settings.cleanupEnabled)+
      toggleRow("Incluir Reciclagem","Quando a limpeza automática corre, pode esvaziar também a Reciclagem.","storage.recycleBinEnabled",s.settings.recycleBinEnabled)+
      '<div class="storage-cleanup-preview-v986"><span>Temporários: <strong>'+escapeHTML(formatBytes(temp.bytes))+'</strong></span>'+
      '<span>Reciclagem: <strong>'+escapeHTML(formatBytes(recycle.bytes))+'</strong></span></div>'+
      '<div class="storage-actions-v986"><button class="sys-button primary" data-storage-clean-v986>Limpar agora</button>'+
      '<button class="sys-button" data-storage-refresh-v986>Atualizar cálculo</button></div></section>'+
      '<p class="storage-footnote-v986">Aplicações são uma estimativa interna da instalação simulada. Ficheiros e Reciclagem usam o conteúdo virtual efetivo do perfil.</p>'+
      '</div>';

    box.querySelectorAll("[data-storage-toggle-v986]").forEach(btn=>btn.onclick=()=>{
      const path=btn.dataset.storageToggleV986;
      store.set(path,!store.get(path),{source:"settings-ui-v986"});
      renderSettings(box);
    });
    box.querySelector("[data-storage-refresh-v986]")?.addEventListener("click",()=>renderSettings(box));
    box.querySelector("[data-storage-clean-v986]")?.addEventListener("click",()=>{
      const current=snapshot(),t=current.categories.find(c=>c.key==="temporary"),r=current.categories.find(c=>c.key==="recycle");
      const includeRecycle=Boolean(store.get("storage.recycleBinEnabled"));
      const total=t.bytes+(includeRecycle?r.bytes:0);
      if(total<=0){notify("Armazenamento","Não existem ficheiros temporários"+(includeRecycle?" nem itens na Reciclagem":"")+" para limpar.");return}
      showSystemDialog("Limpeza de armazenamento",
        '<p>Serão removidos ficheiros temporários virtuais'+(includeRecycle?" e o conteúdo da Reciclagem.":".")+'</p>'+
        '<p><strong>Espaço aproximado a libertar: '+escapeHTML(formatBytes(total))+'</strong></p>'+
        '<p>Esta ação não toca no armazenamento real do dispositivo.</p>',
        "Limpar",async()=>{
          const result=await cleanup({temporary:true,recycleBin:includeRecycle,source:"settings-ui-v986"});
          notify("Armazenamento",formatBytes(result.freed)+" libertados no armazenamento virtual.");
          renderSettings(box);
        });
    });
  }
  function scheduleRerender(source){
    if(String(source||"").startsWith("settings-ui-v986"))return;
    if(rerenderPending)return;rerenderPending=true;
    queueMicrotask(()=>{
      rerenderPending=false;
      document.querySelectorAll('[data-settings-page][data-settings-storage-v986="1"]').forEach(renderSettings);
    });
  }

  globalThis.renderSettingsPageV5=function(box,page){
    if(page==="storage"){renderSettings(box);return}
    delete box.dataset.settingsStorageV986;
    previousRenderSettingsPage(box,page);
  };
  try{renderSettingsPageV5=globalThis.renderSettingsPageV5}catch{}

  bus.on("settings:storage:changed",event=>scheduleRerender(event.detail?.source));
  bus.on("storage:changed",event=>scheduleRerender(event.detail?.source));

  globalThis.Win11Storage=Object.freeze({
    version:VERSION,capacity:CAPACITY_BYTES,tempRoots:[...TEMP_ROOTS],
    scan,snapshot,formatBytes,cleanup,runStorageSense,renderSettings,
    get settings(){return Object.freeze(store.get("storage"))}
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:36,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "storage-2","storage-category-scan","storage-virtual-capacity",
      "storage-temporary-cleanup","storage-recycle-cleanup","storage-sense-live",
      "storage-settings-page","storage-profile-isolation"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
