"use strict";
/* Windows 11 Simulator V7.8 — Settings, Personalization & Windows Security */
(function installSettingsSecurityV780(){
  const previousApplyState=globalThis.applyState;
  const previousRenderSettingsPage=globalThis.renderSettingsPageV5;
  const TEST_MARKER="WIN11_SIMULATOR_TEST_THREAT";
  const ACCENTS=["#0078d4","#3cc7e8","#8764b8","#c239b3","#e74856","#ff8c00","#107c10","#00b7c3"];
  const WALLPAPERS_V78=[
    "radial-gradient(circle at 70% 20%,rgba(255,207,129,.95),transparent 28%),radial-gradient(circle at 18% 12%,rgba(78,66,157,.95),transparent 34%),linear-gradient(145deg,#343066 0%,#bd638e 52%,#ee8968 100%)",
    "radial-gradient(circle at 55% 25%,#8be8ff,transparent 30%),linear-gradient(145deg,#101a43,#4165bd 55%,#88d5e8)",
    "radial-gradient(circle at 28% 30%,#ff8cb7,transparent 28%),linear-gradient(150deg,#1d1144,#8c3b8d 55%,#ff956f)",
    "radial-gradient(circle at 72% 26%,rgba(85,176,255,.8),transparent 23%),radial-gradient(circle at 40% 70%,rgba(64,85,210,.65),transparent 34%),linear-gradient(135deg,#070b22,#13275e 48%,#163e66)",
    "radial-gradient(circle at 22% 18%,rgba(255,255,255,.22),transparent 20%),radial-gradient(circle at 76% 72%,rgba(120,93,255,.5),transparent 30%),linear-gradient(145deg,#1b1531,#4d2d6f 50%,#aa5f8c)",
    "radial-gradient(circle at 50% 30%,rgba(112,255,226,.3),transparent 32%),linear-gradient(145deg,#061a1d,#0d3d43 52%,#17776e)",
    "radial-gradient(circle at 65% 25%,rgba(255,190,115,.34),transparent 26%),linear-gradient(145deg,#21130b,#63351e 55%,#b16636)",
    "radial-gradient(circle at 35% 20%,rgba(215,231,255,.5),transparent 20%),linear-gradient(155deg,#283745,#547385 55%,#9fb5bc)"
  ];
  let scanJob=null;
  let securityRenderHook=null;

  function clone(v){try{return structuredClone(v)}catch{return JSON.parse(JSON.stringify(v))}}
  function ensureState(){
    state.personalizationV78=Object.assign({
      themeMode:state.theme==="dark"?"dark":"light",
      accent:"#0078d4",
      transparency:true,
      animations:true,
      taskbarAlignment:"center",
      wallpaperIndex:Number(state.wallpaper)||0
    },state.personalizationV78||{});
    if(!["light","dark","system"].includes(state.personalizationV78.themeMode))state.personalizationV78.themeMode="light";
    if(!ACCENTS.includes(state.personalizationV78.accent))state.personalizationV78.accent="#0078d4";
    state.personalizationV78.wallpaperIndex=Math.max(0,Math.min(WALLPAPERS_V78.length-1,Number(state.personalizationV78.wallpaperIndex)||0));
    state.security=Object.assign({lastScan:0,threats:0},state.security||{});
    state.securityV78=Object.assign({
      realTime:true,
      cloudProtection:true,
      tamperProtection:true,
      ransomwareProtection:true,
      smartScreen:true,
      puaProtection:true,
      firewall:{domain:true,private:true,public:true},
      scanHistory:[],
      protectionHistory:[],
      allowedThreatPaths:[],
      lastScanType:null,
      lastScanFiles:0,
      lastScanDurationMs:0
    },state.securityV78||{});
    state.securityV78.firewall=Object.assign({domain:true,private:true,public:true},state.securityV78.firewall||{});
    state.securityV78.scanHistory=Array.isArray(state.securityV78.scanHistory)?state.securityV78.scanHistory:[];
    state.securityV78.protectionHistory=Array.isArray(state.securityV78.protectionHistory)?state.securityV78.protectionHistory:[];
    state.securityV78.allowedThreatPaths=Array.isArray(state.securityV78.allowedThreatPaths)?state.securityV78.allowedThreatPaths:[];
    syncThreatCount();
  }

  function effectiveTheme(){
    const mode=state.personalizationV78.themeMode;
    if(mode==="system")return matchMedia?.("(prefers-color-scheme: dark)")?.matches?"dark":"light";
    return mode;
  }
  function accentStrong(hex){return hex}
  function applyPersonalization(){
    ensureState();
    const p=state.personalizationV78,app=document.getElementById("app");
    if(!app)return;
    const theme=effectiveTheme();
    state.theme=theme;
    app.classList.toggle("theme-dark",theme==="dark");
    app.classList.toggle("no-transparency-v78",!p.transparency);
    app.classList.toggle("no-animations-v78",!p.animations);
    app.classList.toggle("taskbar-left-v78",p.taskbarAlignment==="left");
    document.documentElement.style.setProperty("--accent",p.accent);
    document.documentElement.style.setProperty("--accent-strong",accentStrong(p.accent));
    app.style.background=WALLPAPERS_V78[p.wallpaperIndex]||WALLPAPERS_V78[0];
    state.wallpaper=Math.min(2,p.wallpaperIndex);
  }
  globalThis.applyState=function(){
    if(typeof previousApplyState==="function")previousApplyState();
    applyPersonalization();
  };
  try{applyState=globalThis.applyState}catch{}

  try{
    const mq=matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change",()=>{if(state.personalizationV78?.themeMode==="system")applyPersonalization()});
  }catch{}

  function setPersonalization(key,value){
    ensureState();
    if(key==="themeMode"&&!["light","dark","system"].includes(value))return false;
    if(key==="accent"&&!ACCENTS.includes(value))return false;
    if(key==="taskbarAlignment"&&!["center","left"].includes(value))return false;
    if(key==="wallpaperIndex"){
      value=Math.max(0,Math.min(WALLPAPERS_V78.length-1,Number(value)||0));
    }
    state.personalizationV78[key]=value;
    saveState();applyPersonalization();
    return true;
  }

  function personalizationPreview(){
    const p=state.personalizationV78;
    return '<div class="personalization-preview-v78" style="background:'+WALLPAPERS_V78[p.wallpaperIndex]+'">'+
      '<div class="preview-window-v78"><div></div><span></span><span></span><span></span></div>'+
      '<div class="preview-taskbar-v78 '+(p.taskbarAlignment==="left"?"left":"center")+'"><i></i><i></i><i></i></div>'+
    '</div>';
  }
  function renderPersonalization(box){
    ensureState();
    const p=state.personalizationV78;
    box.innerHTML=
      '<div class="settings-page-v78">'+
        '<div class="settings-page-title-v78"><div><h1>Personalização</h1><p>Escolha o aspeto do seu perfil local do simulador.</p></div></div>'+
        personalizationPreview()+
        '<section class="settings-section-v78"><h3>Tema</h3><div class="segmented-v78" data-theme-options>'+
          [["light","Claro"],["dark","Escuro"],["system","Sistema"]].map(([v,l])=>'<button data-theme-mode="'+v+'" class="'+(p.themeMode===v?"active":"")+'">'+l+'</button>').join("")+
        '</div></section>'+
        '<section class="settings-section-v78"><h3>Cor de destaque</h3><div class="accent-grid-v78">'+
          ACCENTS.map(c=>'<button data-accent="'+c+'" class="'+(p.accent===c?"active":"")+'" style="--swatch:'+c+'" aria-label="Cor '+c+'"></button>').join("")+
        '</div></section>'+
        '<section class="settings-section-v78"><h3>Fundo</h3><div class="wallpaper-grid-v78">'+
          WALLPAPERS_V78.map((bg,i)=>'<button data-wallpaper-v78="'+i+'" class="'+(p.wallpaperIndex===i?"active":"")+'" style="background:'+bg+'"><span>'+(i+1)+'</span></button>').join("")+
        '</div></section>'+
        '<section class="settings-list-v78">'+
          toggleRow("Efeitos de transparência","Acrylic e blur nas superfícies do simulador","transparency",p.transparency)+
          toggleRow("Animações","Transições, menus e efeitos de janelas","animations",p.animations)+
        '</section>'+
        '<section class="settings-section-v78"><h3>Barra de tarefas</h3><div class="segmented-v78">'+
          '<button data-taskbar-align="center" class="'+(p.taskbarAlignment==="center"?"active":"")+'">Centro</button>'+
          '<button data-taskbar-align="left" class="'+(p.taskbarAlignment==="left"?"active":"")+'">Esquerda</button>'+
        '</div></section>'+
      '</div>';
    box.querySelectorAll("[data-theme-mode]").forEach(b=>b.onclick=()=>{setPersonalization("themeMode",b.dataset.themeMode);renderPersonalization(box)});
    box.querySelectorAll("[data-accent]").forEach(b=>b.onclick=()=>{setPersonalization("accent",b.dataset.accent);renderPersonalization(box)});
    box.querySelectorAll("[data-wallpaper-v78]").forEach(b=>b.onclick=()=>{setPersonalization("wallpaperIndex",Number(b.dataset.wallpaperV78));renderPersonalization(box)});
    box.querySelectorAll("[data-personal-toggle]").forEach(b=>b.onclick=()=>{
      const k=b.dataset.personalToggle;setPersonalization(k,!state.personalizationV78[k]);renderPersonalization(box);
    });
    box.querySelectorAll("[data-taskbar-align]").forEach(b=>b.onclick=()=>{setPersonalization("taskbarAlignment",b.dataset.taskbarAlign);renderPersonalization(box)});
  }
  function toggleRow(title,desc,key,on){
    return '<div class="settings-row-v78"><div><strong>'+escapeHTML(title)+'</strong><small>'+escapeHTML(desc)+'</small></div><button class="toggle '+(on?"on":"")+'" data-personal-toggle="'+key+'"></button></div>';
  }

  function healthScore(){
    ensureState();
    const s=state.securityV78;
    let score=0;
    if(s.realTime)score+=20;
    if(s.cloudProtection)score+=10;
    if(s.tamperProtection)score+=10;
    if(s.ransomwareProtection)score+=15;
    if(s.smartScreen)score+=15;
    if(s.puaProtection)score+=10;
    const fw=Object.values(s.firewall).filter(Boolean).length;
    score+=Math.round((fw/3)*20);
    return Math.min(100,score);
  }
  function healthLabel(){
    const score=healthScore(),threats=activeThreats().length;
    if(threats)return {label:"Ação recomendada",level:"warning"};
    if(score>=90)return {label:"Proteção virtual elevada",level:"ok"};
    if(score>=70)return {label:"Proteção virtual moderada",level:"warning"};
    return {label:"Proteção virtual reduzida",level:"danger"};
  }
  function activeThreats(){ensureState();return state.securityV78.protectionHistory.filter(x=>x.status==="active")}
  function syncThreatCount(){state.security.threats=state.securityV78?.protectionHistory?.filter(x=>x.status==="active").length||0}

  function renderPrivacy(box){
    ensureState();
    const h=healthLabel(),score=healthScore();
    state.privacy=Object.assign({location:false,camera:true,microphone:true,diagnostics:false,notifications:true},state.privacy||{});
    box.innerHTML=
      '<div class="settings-page-v78">'+
        '<div class="settings-page-title-v78"><div><h1>Privacidade e segurança</h1><p>Controlos do perfil do simulador e integrações explícitas do browser.</p></div></div>'+
        '<div class="security-settings-hero-v78 '+h.level+'" data-open-security-v78>'+
          '<div class="security-score-ring-v78" style="--score:'+score+'"><span>'+score+'</span></div>'+
          '<div><strong>Segurança do Windows</strong><p>'+escapeHTML(h.label)+' · '+activeThreats().length+' deteções ativas</p><small>O estado refere-se ao simulador, não ao Windows anfitrião.</small></div><button>Abrir</button>'+
        '</div>'+
        '<h3>Permissões do simulador</h3>'+
        '<section class="settings-list-v78">'+
          privacyRow("Localização","Permissão lógica do simulador","location")+
          privacyRow("Câmara","Integração real apenas após autorização explícita","camera")+
          privacyRow("Microfone","Integração real apenas após autorização explícita","microphone")+
          privacyRow("Dados de diagnóstico","Dados sanitizados do simulador","diagnostics")+
        '</section>'+
        '<section class="privacy-browser-v78"><div><strong>Segurança do contexto do browser</strong><small>'+(isSecureContext?"Contexto seguro disponível":"Contexto não seguro")+' · '+(navigator.onLine?"online":"offline")+'</small></div>'+
          (globalThis.Win11DeviceCenter?'<button class="sys-button" data-open-device-center-v78>Centro de Dispositivos</button>':"")+
        '</section>'+
      '</div>';
    box.querySelector("[data-open-security-v78]").onclick=()=>openApp("security");
    box.querySelectorAll("[data-privacy-v78]").forEach(b=>b.onclick=()=>{
      const k=b.dataset.privacyV78;state.privacy[k]=!state.privacy[k];saveState();renderPrivacy(box);
    });
    box.querySelector("[data-open-device-center-v78]")?.addEventListener("click",()=>Win11DeviceCenter.open());
  }
  function privacyRow(title,desc,key){
    return '<div class="settings-row-v78"><div><strong>'+escapeHTML(title)+'</strong><small>'+escapeHTML(desc)+'</small></div><button class="toggle '+(state.privacy[key]?"on":"")+'" data-privacy-v78="'+key+'"></button></div>';
  }

  globalThis.renderSettingsPageV5=function(box,page){
    if(page==="personalization"){renderPersonalization(box);return}
    if(page==="privacy"){renderPrivacy(box);return}
    previousRenderSettingsPage?.(box,page);
  };
  try{renderSettingsPageV5=globalThis.renderSettingsPageV5}catch{}

  function scanVirtualFiles(scope){
    const detections=[],allowed=new Set(state.securityV78.allowedThreatPaths||[]);
    const entries=[];
    for(const [folder,files] of Object.entries(state.files||{})){
      if(scope&&scope!=="all"&&folder!==scope&&!folder.startsWith(scope+"/"))continue;
      if(!files||typeof files!=="object")continue;
      for(const [name,value] of Object.entries(files)){
        const full=folder+"/"+name;
        entries.push(full);
        let text="";
        if(typeof value==="string")text=value;
        else if(value&&typeof value==="object"&&typeof value.content==="string")text=value.content;
        if(!allowed.has(full)&&text.includes(TEST_MARKER)){
          detections.push({path:full,name,folder});
        }
      }
    }
    return {detections,filesChecked:entries.length};
  }
  function scanLabel(type){return ({quick:"Verificação rápida",full:"Verificação completa",custom:"Verificação personalizada"})[type]||"Verificação"}
  function scanScope(type,customPath){
    if(type==="quick")return "C:/Downloads";
    if(type==="custom")return customPath||"C:/Documents";
    return "all";
  }

  function upsertDetection(d){
    let item=state.securityV78.protectionHistory.find(x=>x.path===d.path&&x.status==="active");
    if(!item){
      item={id:"threat-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7),path:d.path,name:d.name,status:"active",detectedAt:Date.now(),category:"Item de teste do simulador",severity:"low"};
      state.securityV78.protectionHistory.unshift(item);
    }else item.detectedAt=Date.now();
    state.securityV78.protectionHistory=state.securityV78.protectionHistory.slice(0,80);
    return item;
  }

  function runScan(type="quick",customPath=null){
    ensureState();
    if(scanJob)return Promise.resolve({ok:false,reason:"busy"});
    const label=scanLabel(type),scope=scanScope(type,customPath),started=Date.now();
    scanJob={type,label,scope,progress:0,started,filesChecked:0};
    securityRenderHook?.();
    return new Promise(resolve=>{
      const steps=type==="full"?20:type==="custom"?15:10;
      let step=0;
      const timer=setInterval(()=>{
        step++;scanJob.progress=Math.round(step/steps*100);securityRenderHook?.(true);
        if(step<steps)return;
        clearInterval(timer);
        const result=scanVirtualFiles(scope);
        result.detections.forEach(upsertDetection);
        const completed=Date.now();
        const record={id:"scan-"+completed.toString(36),type,label,scope,started,completed,durationMs:completed-started,filesChecked:result.filesChecked,detections:result.detections.length};
        state.securityV78.scanHistory.unshift(record);
        state.securityV78.scanHistory=state.securityV78.scanHistory.slice(0,50);
        state.security.lastScan=completed;
        state.securityV78.lastScanType=type;
        state.securityV78.lastScanFiles=result.filesChecked;
        state.securityV78.lastScanDurationMs=record.durationMs;
        syncThreatCount();
        scanJob=null;saveState();
        notify("Segurança do Windows",result.detections.length?result.detections.length+" item(ns) de teste detetado(s).":label+" concluída sem deteções.",{
          source:"Segurança do Windows",appId:"security",category:"security",priority:result.detections.length?"high":"normal",
          actions:[{label:"Abrir Segurança",type:"open-app",appId:"security"}],
          replaceKey:"security:last-scan"
        });
        securityRenderHook?.();
        resolve({ok:true,...record});
      },type==="full"?95:85);
    });
  }

  function createTestItem(){
    ensureState();
    ensureFolder("C:/Downloads")["Security-Test-Item.txt"]="Este é um item inofensivo criado apenas para testar o Windows Security do simulador.\n"+TEST_MARKER;
    state.securityV78.allowedThreatPaths=state.securityV78.allowedThreatPaths.filter(x=>x!=="C:/Downloads/Security-Test-Item.txt");
    saveState();
    notify("Segurança do Windows","Item de teste inofensivo criado em Downloads.",{source:"Segurança do Windows",appId:"security",category:"security",priority:"low"});
    securityRenderHook?.();
    return true;
  }
  function resolveThreat(id,action){
    ensureState();
    const item=state.securityV78.protectionHistory.find(x=>x.id===id);if(!item||item.status!=="active")return false;
    if(action==="remove"){
      const slash=item.path.lastIndexOf("/"),folder=item.path.slice(0,slash),name=item.path.slice(slash+1);
      if(state.files?.[folder])delete state.files[folder][name];
      item.status="removed";item.resolvedAt=Date.now();
    }else if(action==="allow"){
      item.status="allowed";item.resolvedAt=Date.now();
      if(!state.securityV78.allowedThreatPaths.includes(item.path))state.securityV78.allowedThreatPaths.push(item.path);
    }else return false;
    syncThreatCount();saveState();
    notify("Segurança do Windows",action==="remove"?"Item de teste removido do sistema virtual.":"Item permitido no sistema virtual.",{source:"Segurança do Windows",appId:"security",category:"security",priority:"normal"});
    securityRenderHook?.();
    return true;
  }
  function setProtection(key,value){
    ensureState();
    if(!(key in state.securityV78))return false;
    state.securityV78[key]=Boolean(value);saveState();
    if(!value)notify("Segurança do Windows","A proteção "+key+" foi desativada no simulador.",{source:"Segurança do Windows",appId:"security",category:"security",priority:"high"});
    securityRenderHook?.();return true;
  }
  function setFirewall(profile,value){
    ensureState();
    if(!(profile in state.securityV78.firewall))return false;
    state.securityV78.firewall[profile]=Boolean(value);saveState();
    notify("Firewall do Windows",(value?"Firewall ativado: ":"Firewall desativado: ")+profile,{source:"Segurança do Windows",appId:"security",category:"security",priority:value?"normal":"high"});
    securityRenderHook?.();return true;
  }

  function securityNavButton(page,icon,label){
    return '<button data-security-page="'+page+'"><span>'+icon+'</span><span>'+escapeHTML(label)+'</span></button>';
  }
  function statusDot(ok){return '<span class="security-status-dot-v78 '+(ok?"ok":"warn")+'"></span>'}
  function buildSecurityHome(){
    const s=state.securityV78,h=healthLabel(),score=healthScore(),threats=activeThreats().length;
    return '<div class="security-home-v78">'+
      '<div class="security-hero-v78 '+h.level+'"><div class="security-shield-v78">🛡️</div><div><h2>'+escapeHTML(h.label)+'</h2><p>Estado do Windows Security do simulador.</p><small>Não representa nem verifica a segurança do Windows anfitrião.</small></div><div class="security-health-score-v78"><strong>'+score+'</strong><span>/100</span></div></div>'+
      '<div class="security-card-grid-v78">'+
        securityCard("virus","Proteção contra vírus e ameaças",threats?threats+" deteção(ões) ativa(s)":"Sem deteções ativas",threats===0)+
        securityCard("account","Proteção de conta","Sessão local protegida",Boolean(globalThis.Win11SessionManager?.activeUserId))+
        securityCard("firewall","Firewall e proteção de rede",Object.values(s.firewall).every(Boolean)?"Todos os perfis ativos":"Atenção necessária",Object.values(s.firewall).every(Boolean))+
        securityCard("appbrowser","Controlo de aplicações e browser",s.smartScreen?"SmartScreen virtual ativo":"SmartScreen virtual desativado",s.smartScreen)+
        securityCard("device","Segurança do dispositivo",s.tamperProtection?"Proteção contra adulteração ativa":"Proteção reduzida",s.tamperProtection)+
        securityCard("performance","Desempenho e estado","Estado do simulador: "+score+"/100",score>=70)+
      '</div>'+
    '</div>';
  }
  function securityCard(page,title,text,ok){
    return '<button class="security-card-v78" data-security-page="'+page+'"><div>'+statusDot(ok)+'<strong>'+escapeHTML(title)+'</strong></div><p>'+escapeHTML(text)+'</p><span>›</span></button>';
  }
  function scanProgressHtml(){
    if(!scanJob)return "";
    return '<div class="security-scan-running-v78"><div><strong>'+escapeHTML(scanJob.label)+'</strong><span>'+scanJob.progress+'%</span></div><div class="scan-bar-v78"><i style="width:'+scanJob.progress+'%"></i></div><small>Âmbito virtual: '+escapeHTML(scanJob.scope)+'</small></div>';
  }
  function buildVirusPage(){
    const history=state.securityV78.scanHistory.slice(0,5),threats=activeThreats();
    return '<div class="security-page-v78"><div class="security-page-head-v78"><div><h2>Proteção contra vírus e ameaças</h2><p>As verificações analisam apenas os ficheiros virtuais do simulador.</p></div>'+statusDot(threats.length===0)+'</div>'+
      scanProgressHtml()+
      '<section class="security-section-v78"><h3>Ameaças atuais</h3>'+
        (threats.length?threats.map(threatRow).join(""):'<div class="security-empty-v78">✓ Nenhuma ameaça virtual ativa.</div>')+
      '</section>'+
      '<section class="security-section-v78"><h3>Opções de verificação</h3><div class="security-action-grid-v78">'+
        '<button data-scan-type="quick"><strong>Verificação rápida</strong><small>Downloads virtuais</small></button>'+
        '<button data-scan-type="full"><strong>Verificação completa</strong><small>Todos os ficheiros virtuais</small></button>'+
        '<button data-scan-type="custom"><strong>Personalizada</strong><small>Escolher pasta virtual</small></button>'+
        '<button data-create-test-threat><strong>Gerar item de teste</strong><small>Ficheiro inofensivo do simulador</small></button>'+
      '</div></section>'+
      '<section class="settings-list-v78">'+
        securityToggle("Proteção em tempo real","Monitorização lógica do sistema virtual","realTime",state.securityV78.realTime)+
        securityToggle("Proteção fornecida pela cloud","Estado virtual; não envia ficheiros","cloudProtection",state.securityV78.cloudProtection)+
      '</section>'+
      '<section class="security-section-v78"><h3>Verificações recentes</h3>'+
        (history.length?history.map(x=>'<div class="scan-history-row-v78"><span>'+new Date(x.completed).toLocaleString("pt-PT")+'</span><strong>'+escapeHTML(x.label)+'</strong><small>'+x.filesChecked+' ficheiros · '+x.detections+' deteções</small></div>').join(""):'<p class="security-muted-v78">Ainda não existem verificações.</p>')+
      '</section>'+
    '</div>';
  }
  function threatRow(t){
    return '<div class="threat-row-v78"><div><strong>'+escapeHTML(t.category)+'</strong><small>'+escapeHTML(t.path)+' · gravidade baixa</small></div><div><button data-threat-remove="'+t.id+'">Remover</button><button data-threat-allow="'+t.id+'">Permitir</button></div></div>';
  }
  function securityToggle(title,desc,key,on){
    return '<div class="settings-row-v78"><div><strong>'+escapeHTML(title)+'</strong><small>'+escapeHTML(desc)+'</small></div><button class="toggle '+(on?"on":"")+'" data-security-toggle="'+key+'"></button></div>';
  }
  function buildAccountPage(){
    const user=globalThis.Win11SessionManager?.activeUser;
    return '<div class="security-page-v78"><div class="security-page-head-v78"><div><h2>Proteção de conta</h2><p>Proteção da sessão local do simulador.</p></div>'+statusDot(Boolean(user))+'</div>'+
      '<section class="security-section-v78"><div class="security-account-v78"><div class="security-user-avatar-v78">'+escapeHTML((user?.name||"U").slice(0,1).toUpperCase())+'</div><div><strong>'+escapeHTML(user?.name||"Utilizador local")+'</strong><small>Conta local · credencial derivada com PBKDF2</small></div></div></section>'+
      '<section class="security-section-v78"><h3>Segurança da sessão</h3><p>Bloqueio automático, mudança de utilizador e isolamento de dados por perfil estão ativos quando configurados no gestor de contas.</p><button class="sys-button" data-security-open-settings>Gerir contas</button></section>'+
    '</div>';
  }
  function buildFirewallPage(){
    const f=state.securityV78.firewall;
    const rows=[["domain","Rede de domínio","Perfil virtual para ambientes geridos"],["private","Rede privada","Perfil virtual para redes confiáveis"],["public","Rede pública","Perfil virtual mais restritivo"]];
    return '<div class="security-page-v78"><div class="security-page-head-v78"><div><h2>Firewall e proteção de rede</h2><p>Perfis de firewall internos ao simulador.</p></div>'+statusDot(Object.values(f).every(Boolean))+'</div>'+
      '<section class="settings-list-v78">'+rows.map(([k,t,d])=>'<div class="settings-row-v78"><div><strong>'+t+'</strong><small>'+d+'</small></div><button class="toggle '+(f[k]?"on":"")+'" data-firewall="'+k+'"></button></div>').join("")+'</section>'+
      '<div class="security-disclosure-v78">O firewall virtual não altera regras, portas ou perfis do firewall real do Windows.</div>'+
    '</div>';
  }
  function buildAppBrowserPage(){
    const s=state.securityV78;
    return '<div class="security-page-v78"><div class="security-page-head-v78"><div><h2>Controlo de aplicações e browser</h2><p>Políticas de reputação aplicadas apenas ao comportamento do simulador.</p></div>'+statusDot(s.smartScreen&&s.puaProtection)+'</div>'+
      '<section class="settings-list-v78">'+
        securityToggle("SmartScreen virtual","Avisos internos para conteúdo não reconhecido","smartScreen",s.smartScreen)+
        securityToggle("Bloqueio de aplicações potencialmente indesejadas","Política virtual de reputação","puaProtection",s.puaProtection)+
      '</section>'+
      '<div class="security-disclosure-v78">Estas opções não configuram Microsoft Defender SmartScreen no dispositivo real.</div>'+
    '</div>';
  }
  function buildDeviceSecurityPage(){
    const s=state.securityV78;
    return '<div class="security-page-v78"><div class="security-page-head-v78"><div><h2>Segurança do dispositivo</h2><p>Isolamento e integridade do simulador.</p></div>'+statusDot(s.tamperProtection&&s.ransomwareProtection)+'</div>'+
      '<section class="settings-list-v78">'+
        securityToggle("Proteção contra adulteração","Evita alterações acidentais às definições virtuais","tamperProtection",s.tamperProtection)+
        securityToggle("Acesso controlado a pastas","Proteção contra ransomware apenas no FS virtual","ransomwareProtection",s.ransomwareProtection)+
      '</section>'+
      '<section class="security-section-v78"><h3>Ambiente do browser</h3><div class="kv-v78"><span>Contexto seguro</span><strong>'+(isSecureContext?"Sim":"Não")+'</strong><span>Estado de rede</span><strong>'+(navigator.onLine?"Online":"Offline")+'</strong><span>IndexedDB</span><strong>'+("indexedDB" in window?"Disponível":"Indisponível")+'</strong></div></section>'+
    '</div>';
  }
  function buildPerformancePage(){
    const score=healthScore(),h=healthLabel();
    const checks=[
      ["Proteção em tempo real",state.securityV78.realTime],
      ["Firewall",Object.values(state.securityV78.firewall).every(Boolean)],
      ["SmartScreen virtual",state.securityV78.smartScreen],
      ["Ransomware virtual",state.securityV78.ransomwareProtection],
      ["Contexto seguro do browser",isSecureContext],
      ["Armazenamento local",typeof localStorage!=="undefined"]
    ];
    return '<div class="security-page-v78"><div class="security-page-head-v78"><div><h2>Desempenho e estado do dispositivo</h2><p>Indicadores do simulador e do ambiente web.</p></div><div class="health-pill-v78 '+h.level+'">'+score+'/100</div></div>'+
      '<section class="health-grid-v78">'+checks.map(([t,ok])=>'<div>'+statusDot(ok)+'<span>'+escapeHTML(t)+'</span><strong>'+(ok?"OK":"Atenção")+'</strong></div>').join("")+'</section>'+
      '<div class="security-disclosure-v78">Este diagnóstico não lê antivírus, TPM, Secure Boot ou políticas de segurança do Windows anfitrião.</div>'+
    '</div>';
  }
  function buildHistoryPage(){
    const items=state.securityV78.protectionHistory;
    return '<div class="security-page-v78"><div class="security-page-head-v78"><div><h2>Histórico de proteção</h2><p>Eventos produzidos pelo motor de segurança virtual.</p></div></div>'+
      '<section class="security-history-v78">'+(items.length?items.map(x=>'<div><span class="history-status-v78 '+x.status+'">'+escapeHTML(x.status)+'</span><div><strong>'+escapeHTML(x.category)+'</strong><small>'+escapeHTML(x.path)+'</small></div><time>'+new Date(x.detectedAt).toLocaleString("pt-PT")+'</time></div>').join(""):'<div class="security-empty-v78">Sem eventos de proteção.</div>')+'</section>'+
    '</div>';
  }

  globalThis.buildSecurity=function(wrap){
    ensureState();
    wrap.className="security-v78";
    wrap.innerHTML='<aside class="security-nav-v78"><div class="security-brand-v78"><span>🛡️</span><div><strong>Segurança do Windows</strong><small>Simulator V7.8</small></div></div>'+
      securityNavButton("home","⌂","Início")+
      securityNavButton("virus","◉","Vírus e ameaças")+
      securityNavButton("account","●","Proteção de conta")+
      securityNavButton("firewall","◎","Firewall e rede")+
      securityNavButton("appbrowser","◇","Aplicações e browser")+
      securityNavButton("device","▣","Segurança do dispositivo")+
      securityNavButton("performance","♡","Desempenho e estado")+
      securityNavButton("history","◷","Histórico de proteção")+
      '<div class="security-safe-note-v78">Ambiente isolado<br><small>Sem acesso ao Defender real</small></div></aside><main class="security-main-v78"></main>';
    const main=wrap.querySelector(".security-main-v78");
    let page="home";
    function render(partial=false){
      ensureState();
      wrap.querySelectorAll("[data-security-page]").forEach(b=>b.classList.toggle("active",b.dataset.securityPage===page));
      if(partial&&page==="virus"&&scanJob){
        const old=main.querySelector(".security-scan-running-v78");
        if(old){
          const fresh=document.createElement("div");fresh.innerHTML=scanProgressHtml();
          old.replaceWith(fresh.firstElementChild);return;
        }
      }
      const html=page==="home"?buildSecurityHome():
        page==="virus"?buildVirusPage():
        page==="account"?buildAccountPage():
        page==="firewall"?buildFirewallPage():
        page==="appbrowser"?buildAppBrowserPage():
        page==="device"?buildDeviceSecurityPage():
        page==="performance"?buildPerformancePage():
        page==="history"?buildHistoryPage():buildSecurityHome();
      main.innerHTML=html;
      bindPage();
    }
    function bindPage(){
      main.querySelectorAll("[data-security-page]").forEach(b=>b.onclick=()=>{page=b.dataset.securityPage;render()});
      main.querySelectorAll("[data-scan-type]").forEach(b=>b.onclick=()=>{
        const type=b.dataset.scanType;
        if(type==="custom"){
          const p=prompt("Pasta virtual a verificar:","C:/Documents");if(!p)return;
          runScan("custom",String(p).trim()).then(()=>render());
        }else runScan(type).then(()=>render());
        render();
      });
      main.querySelector("[data-create-test-threat]")?.addEventListener("click",()=>{createTestItem();render()});
      main.querySelectorAll("[data-threat-remove]").forEach(b=>b.onclick=()=>{resolveThreat(b.dataset.threatRemove,"remove");render()});
      main.querySelectorAll("[data-threat-allow]").forEach(b=>b.onclick=()=>{resolveThreat(b.dataset.threatAllow,"allow");render()});
      main.querySelectorAll("[data-security-toggle]").forEach(b=>b.onclick=()=>{const k=b.dataset.securityToggle;setProtection(k,!state.securityV78[k]);render()});
      main.querySelectorAll("[data-firewall]").forEach(b=>b.onclick=()=>{const k=b.dataset.firewall;setFirewall(k,!state.securityV78.firewall[k]);render()});
      main.querySelector("[data-security-open-settings]")?.addEventListener("click",()=>{openApp("settings");setTimeout(()=>{const w=document.querySelector('.window[data-app="settings"]');w?.querySelector('[data-settings="accounts"]')?.click()},50)});
    }
    wrap.querySelectorAll(".security-nav-v78 [data-security-page]").forEach(b=>b.onclick=()=>{page=b.dataset.securityPage;render()});
    securityRenderHook=render;
    render();
  };
  try{buildSecurity=globalThis.buildSecurity}catch{}

  applyPersonalization();

  globalThis.Win11Personalization=Object.freeze({
    version:"8.1.0",
    accents:[...ACCENTS],
    wallpaperCount:WALLPAPERS_V78.length,
    apply:applyPersonalization,
    set:setPersonalization,
    get state(){ensureState();return clone(state.personalizationV78)}
  });
  globalThis.Win11SecurityCenter=Object.freeze({
    version:"8.1.0",
    runScan,
    createTestItem,
    resolveThreat,
    setProtection,
    setFirewall,
    healthScore,
    activeThreats:()=>clone(activeThreats()),
    scanHistory:()=>clone(state.securityV78.scanHistory),
    protectionHistory:()=>clone(state.securityV78.protectionHistory),
    get snapshot(){ensureState();return clone(state.securityV78)}
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"8.1.0",
    step:17,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "personalization-v2","theme-system-mode","accent-color","transparency-effects","animation-toggle",
      "taskbar-alignment","extended-wallpapers","security-center-v2","virtual-threat-scanner",
      "security-scan-history","protection-history","virtual-real-time-protection","virtual-firewall-profiles",
      "virtual-smartscreen","virtual-ransomware-protection","security-health-score","security-notification-integration"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
