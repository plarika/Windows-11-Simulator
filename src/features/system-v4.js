"use strict";
/* =========================
   V4 behavior overrides
   ========================= */
function v4MigrateState(){
  state.clipboard=Array.isArray(state.clipboard)?state.clipboard:["Windows 11 Simulator"];
  state.settingsPage=state.settingsPage||"system";
  state.update=Object.assign({status:"ready",progress:0,lastChecked:0,version:"26100.1000"},state.update||{});
  state.devices=Object.assign({bluetooth:true,camera:true,audio:true,network:true,gpu:true},state.devices||{});
  state.storeInstalled=Object.assign({terminal:true,photos:true,paint:true},state.storeInstalled||{});
  state.security=Object.assign({lastScan:0,threats:0},state.security||{});
  state.events=Array.isArray(state.events)?state.events:[];
  ["C:/Downloads","C:/Music","C:/Videos","C:/Pictures","C:/Documents","C:/Desktop","Recycle Bin"].forEach(ensureFolder);
  if(!state.events.length){
    state.events=[
      {level:"Information",source:"Kernel-General",id:12,message:"O sistema virtual foi iniciado.",time:Date.now()-120000},
      {level:"Information",source:"Winlogon",id:7001,message:"Sessão virtual iniciada com sucesso.",time:Date.now()-90000},
      {level:"Warning",source:"Simulator",id:1001,message:"Todos os dispositivos apresentados são simulados.",time:Date.now()-60000}
    ];
  }
  saveState();
}

function applyState(){
  $("#app").style.background=WALLPAPERS[state.wallpaper]||WALLPAPERS[0];
  $("#app").classList.toggle("theme-dark",state.theme==="dark");
  $("#desktop").style.filter=`brightness(${state.brightness/100})`;
  $("#brightness").value=state.brightness;
  $("#volume").value=state.volume;
  syncQuick();
  renderNotifications();
  renderRecommended();
  renderClipboard();
  const d=new Date();
  if($("#widget-day"))$("#widget-day").textContent=d.getDate();
  if($("#widget-date"))$("#widget-date").textContent=d.toLocaleDateString("pt-PT",{weekday:"long",month:"long"});
}

function syncOverlayButtons(){
  $("#start-btn").classList.toggle("active",overlays.start.classList.contains("open"));
  $("#quick-btn").classList.toggle("active",overlays.quick.classList.contains("open"));
  $("#notify-btn").classList.toggle("active",overlays.notifications.classList.contains("open"));
  $("#search-btn").classList.toggle("active",overlays.search.classList.contains("open"));
  $("#taskview-btn").classList.toggle("active",$("#task-view").classList.contains("open"));
  $("#widgets-btn").classList.toggle("active",overlays.widgets.classList.contains("open"));
}

function populateDesktop(){
  const d=$("#desktop-icons");d.innerHTML="";
  [
    ["explorer","Este PC","🖥️","This PC"],
    ["explorer","Documentos","📁","C:/Documents"],
    ["edge","Microsoft Edge","🌐",null],
    ["recycle","Reciclagem","🗑️",null],
    ["settings","Definições","⚙️",null]
  ].forEach(([app,label,icon,path])=>{
    const b=document.createElement("button");b.className="desktop-icon";
    b.innerHTML=`<span class="icon">${icon}</span><span class="label">${label}</span>`;
    const launch=()=>openApp(app,path||undefined);
    b.addEventListener("dblclick",launch);
    let last=0;b.addEventListener("click",()=>{$$(".desktop-icon").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");const now=Date.now();if(now-last<420)launch();last=now});
    d.appendChild(b);
  });
}

function addClipboard(text){
  text=String(text??"").trim();if(!text)return;
  state.clipboard=(state.clipboard||[]).filter(x=>x!==text);
  state.clipboard.unshift(text);state.clipboard=state.clipboard.slice(0,12);
  saveState();renderClipboard();
}
function renderClipboard(){
  const box=$("#clipboard-list");if(!box)return;box.innerHTML="";
  (state.clipboard||[]).forEach((text,i)=>{
    const b=document.createElement("div");b.className="clip-item";
    b.innerHTML=`<div>${escapeHTML(text.slice(0,220))}</div><small>Item ${i+1} · toque para copiar para o editor virtual</small>`;
    b.onclick=()=>{state.notepadText=text;saveState();closeOverlays();openApp("notepad");notify("Área de transferência","Conteúdo enviado para o Bloco de Notas virtual.")};
    box.appendChild(b);
  });
  if(!box.children.length)box.innerHTML='<div class="search-empty">A área de transferência está vazia.</div>';
}

function showSystemDialog(title,bodyHtml,actionLabel="OK",onAction=null){
  $("#system-dialog-title").textContent=title;
  $("#system-dialog-body").innerHTML=bodyHtml;
  $("#system-dialog-ok").textContent=actionLabel;
  $("#system-dialog").classList.add("open");
  $("#system-dialog-ok").onclick=()=>{if(onAction)onAction();$("#system-dialog").classList.remove("open")};
}
$("#system-dialog-x").onclick=()=>$("#system-dialog").classList.remove("open");
$("#system-dialog").addEventListener("pointerdown",e=>{if(e.target===$("#system-dialog"))$("#system-dialog").classList.remove("open")});

function fileSize(value){
  if(typeof value==="string")return new Blob([value]).size;
  try{return new Blob([JSON.stringify(value)]).size}catch{return 0}
}
function formatBytes(n){
  if(n<1024)return n+" B";if(n<1048576)return (n/1024).toFixed(1)+" KB";return (n/1048576).toFixed(1)+" MB";
}
function showFileProperties(path,name,value){
  showSystemDialog("Propriedades",`<div class="kv">
    <dt>Nome</dt><dd>${escapeHTML(name)}</dd>
    <dt>Localização</dt><dd>${escapeHTML(path)}</dd>
    <dt>Tipo</dt><dd>${name.endsWith(".png")?"Imagem PNG":"Documento virtual"}</dd>
    <dt>Tamanho</dt><dd>${formatBytes(fileSize(value))}</dd>
    <dt>Modificado</dt><dd>${new Date().toLocaleString("pt-PT")}</dd>
  </div>`);
}

function openSettingsPage(page){
  state.settingsPage=page;saveState();
  const w=$$(".window").find(x=>x.dataset.app==="settings"&&Number(x.dataset.desktop||0)===Number(state.currentDesktop));
  if(w){w.querySelector(".win-body").innerHTML="";w.querySelector(".win-body").appendChild(renderApp("settings",w));focusWindow(w)}
  else openApp("settings");
}

function renderApp(appId,win,initialPath){
  const wrap=document.createElement("div");
  if(appId==="explorer"||appId==="recycle"){buildExplorer(wrap,win,appId==="recycle"?"Recycle Bin":(initialPath||"This PC"));return wrap}
  if(appId==="notepad"){
    wrap.className="notepad";
    wrap.innerHTML='<div class="app-toolbar"><button data-new>Novo</button><button data-open>Abrir</button><button data-save>Guardar</button><button data-saveas>Guardar como</button><button data-copy>Copiar</button><button data-paste>Colar</button></div><textarea spellcheck="false"></textarea>';
    const ta=wrap.querySelector("textarea");ta.value=state.notepadText||"";
    ta.oninput=()=>{state.notepadText=ta.value;saveState()};
    wrap.querySelector("[data-new]").onclick=()=>{ta.value="";state.notepadText="";saveState()};
    wrap.querySelector("[data-open]").onclick=()=>openApp("explorer","C:/Documents");
    wrap.querySelector("[data-save]").onclick=()=>saveNotepad(ta.value,"Notas.txt");
    wrap.querySelector("[data-saveas]").onclick=()=>saveNotepad(ta.value,"Notas-"+Date.now()+".txt");
    wrap.querySelector("[data-copy]").onclick=()=>{const txt=ta.value.substring(ta.selectionStart,ta.selectionEnd)||ta.value;addClipboard(txt);notify("Área de transferência","Texto copiado para o histórico virtual.")};
    wrap.querySelector("[data-paste]").onclick=()=>{const txt=(state.clipboard||[])[0]||"";const a=ta.selectionStart,b=ta.selectionEnd;ta.setRangeText(txt,a,b,"end");state.notepadText=ta.value;saveState()};
    return wrap;
  }
  if(appId==="calc"){buildCalc(wrap);return wrap}
  if(appId==="terminal"){buildTerminal(wrap);return wrap}
  if(appId==="edge"){buildEdge(wrap);return wrap}
  if(appId==="settings"){buildSettings(wrap);return wrap}
  if(appId==="taskmanager"){renderTaskManager(wrap);return wrap}
  if(appId==="paint"){buildPaint(wrap);return wrap}
  if(appId==="photos"){buildPhotos(wrap);return wrap}
  if(appId==="security"){buildSecurity(wrap);return wrap}
  if(appId==="devicemanager"){buildDeviceManager(wrap);return wrap}
  if(appId==="registry"){buildRegistry(wrap);return wrap}
  if(appId==="eventviewer"){buildEventViewer(wrap);return wrap}
  if(appId==="controlpanel"){buildControlPanel(wrap);return wrap}
  if(appId==="clock"){buildClock(wrap);return wrap}
  if(appId==="snipping"){buildSnipping(wrap);return wrap}
  if(appId==="mediaplayer"){buildMediaPlayer(wrap);return wrap}
  if(appId==="store"){buildStore(wrap);return wrap}
  wrap.className="sys-page";wrap.innerHTML="<h2>Aplicação virtual</h2><p>Conteúdo não disponível.</p>";return wrap;
}

function buildExplorer(wrap,win,startPath){
  wrap.className="explorer-v4";
  wrap.innerHTML=`<aside>
    <div class="nav-item" data-path="This PC">🖥️ Este PC</div>
    <div class="nav-item" data-path="C:/Desktop">▣ Ambiente de Trabalho</div>
    <div class="nav-item" data-path="C:/Documents">📄 Documentos</div>
    <div class="nav-item" data-path="C:/Downloads">⬇️ Transferências</div>
    <div class="nav-item" data-path="C:/Pictures">🖼️ Imagens</div>
    <div class="nav-item" data-path="C:/Music">🎵 Música</div>
    <div class="nav-item" data-path="C:/Videos">🎬 Vídeos</div>
    <div class="nav-item" data-path="Recycle Bin">🗑️ Reciclagem</div>
  </aside><main>
    <div class="explorer-command">
      <button data-newfile>＋ Novo</button><button data-cut>✂ Cortar</button><button data-copy>⧉ Copiar</button><button data-delete>🗑 Eliminar</button>
      <span style="flex:1"></span><button data-icons class="active">▦ Ícones</button><button data-list>☷ Detalhes</button>
    </div>
    <div class="explorer-address"><button data-back>←</button><button data-forward>→</button><button data-up>↑</button><div class="pathbar"></div><input class="explorer-search" placeholder="Pesquisar"></div>
    <div class="explorer-files"><div class="file-grid"></div></div>
  </main>`;
  let path=startPath||"This PC",history=[path],idx=0,view="icons",selected=null,query="";
  const grid=wrap.querySelector(".file-grid"),pathbar=wrap.querySelector(".pathbar"),search=wrap.querySelector(".explorer-search");
  function nav(p,push=true){
    if(p!=="This PC")ensureFolder(p);
    path=p;selected=null;
    if(push){history=history.slice(0,idx+1);history.push(p);idx++}
    pathbar.textContent=p;
    wrap.querySelectorAll("[data-path]").forEach(n=>n.classList.toggle("active",n.dataset.path===p));
    render();
  }
  function render(){
    grid.innerHTML="";
    if(path==="This PC"){renderThisPC(grid,nav);return}
    const files=ensureFolder(path);
    const folderPrefix=path+"/";
    const folders=Object.keys(state.files).filter(p=>p.startsWith(folderPrefix)&&!p.slice(folderPrefix.length).includes("/")).map(p=>p.slice(folderPrefix.length));
    let items=[...folders.map(name=>({name,type:"folder",value:null})),...Object.entries(files).map(([name,value])=>({name,type:"file",value}))];
    if(query)items=items.filter(x=>x.name.toLowerCase().includes(query));
    if(view==="details"){
      grid.className="file-list";
      items.forEach(item=>{
        const r=document.createElement("div");r.className="file-row";r.dataset.name=item.name;
        r.innerHTML=`<div class="fname"><span>${item.type==="folder"?"📁":item.name.endsWith(".png")?"🖼️":"📄"}</span><span>${escapeHTML(item.name)}</span></div><div class="meta">${item.type==="folder"?"Pasta de ficheiros":item.name.endsWith(".png")?"Imagem PNG":"Documento"}</div><div class="meta">${item.type==="folder"?"":formatBytes(fileSize(item.value))}</div>`;
        bindExplorerItem(r,item);grid.appendChild(r);
      });
    }else{
      grid.className="file-grid";
      items.forEach(item=>{
        const b=document.createElement("button");b.className="file";b.dataset.name=item.name;
        b.innerHTML=`<span class="icon">${item.type==="folder"?"📁":item.name.endsWith(".png")?"🖼️":"📄"}</span><div class="file-name">${escapeHTML(item.name)}</div>`;
        bindExplorerItem(b,item);grid.appendChild(b);
      });
    }
    if(!items.length)grid.innerHTML='<p>Esta pasta está vazia.</p>';
  }
  function bindExplorerItem(el,item){
    el.onclick=()=>{selected=item;grid.querySelectorAll(".selected").forEach(x=>x.classList.remove("selected"));el.classList.add("selected")};
    el.ondblclick=()=>{if(item.type==="folder")nav(path+"/"+item.name);else openFile(path,item.name,item.value)};
    el.oncontextmenu=e=>{e.preventDefault();selected=item;const menu=[
      ["Abrir",()=>item.type==="folder"?nav(path+"/"+item.name):openFile(path,item.name,item.value)],
      ["Copiar",()=>{if(item.type==="file"){addClipboard(String(item.value).slice(0,3000));notify("Explorador",item.name+" copiado para a área de transferência virtual.")}}],
      ["Mudar nome",()=>item.type==="folder"?notify("Explorador","Mudar nome de pastas será adicionado numa próxima evolução."):renameFile(path,item.name,grid,nav)],
      ["Eliminar",()=>item.type==="folder"?deleteFolder(path+"/"+item.name,path,grid,nav):deleteFile(path,item.name,grid,nav)]
    ];
    if(item.type==="file")menu.push(["Propriedades",()=>showFileProperties(path,item.name,item.value)]);
    showContext(e.clientX,e.clientY,menu);
    };
  }
  wrap.querySelectorAll("[data-path]").forEach(n=>n.onclick=()=>nav(n.dataset.path));
  wrap.querySelector("[data-back]").onclick=()=>{if(idx>0){idx--;nav(history[idx],false)}};
  wrap.querySelector("[data-forward]").onclick=()=>{if(idx<history.length-1){idx++;nav(history[idx],false)}};
  wrap.querySelector("[data-up]").onclick=()=>{if(path==="This PC"||path==="Recycle Bin")return;const parts=path.split("/");if(parts.length<=2)nav("This PC");else{parts.pop();nav(parts.join("/"))}};
  wrap.querySelector("[data-newfile]").onclick=()=>{if(path==="This PC"||path==="Recycle Bin")return notify("Explorador","Abra uma pasta para criar um ficheiro.");const files=ensureFolder(path);let n="Novo ficheiro.txt",i=1;while(n in files)n=`Novo ficheiro (${++i}).txt`;files[n]="";saveState();render()};
  wrap.querySelector("[data-delete]").onclick=()=>{if(!selected)return;if(selected.type==="folder")deleteFolder(path+"/"+selected.name,path,grid,nav);else deleteFile(path,selected.name,grid,nav);render()};
  wrap.querySelector("[data-copy]").onclick=()=>{if(selected&&selected.type==="file"){addClipboard(String(selected.value).slice(0,3000));notify("Explorador","Conteúdo copiado para a área de transferência virtual.")}};
  wrap.querySelector("[data-cut]").onclick=()=>notify("Explorador","A operação Cortar está simulada; use mover através dos menus de contexto numa próxima evolução.");
  wrap.querySelector("[data-icons]").onclick=()=>{view="icons";wrap.querySelector("[data-icons]").classList.add("active");wrap.querySelector("[data-list]").classList.remove("active");render()};
  wrap.querySelector("[data-list]").onclick=()=>{view="details";wrap.querySelector("[data-list]").classList.add("active");wrap.querySelector("[data-icons]").classList.remove("active");render()};
  search.oninput=e=>{query=e.target.value.trim().toLowerCase();render()};
  win.addEventListener("navigate",e=>nav(e.detail));
  nav(path,false);
}
function renderThisPC(grid,nav){
  grid.className="thispc-grid";
  const drives=[
    {name:"Disco Local (C:)",icon:"💽",used:46,total:"120 GB",path:"C:/Documents"},
    {name:"Dados (D:)",icon:"💾",used:28,total:"256 GB",path:"C:/Downloads"}
  ];
  drives.forEach(d=>{
    const c=document.createElement("div");c.className="drive-card";
    c.innerHTML=`<div style="font-size:26px">${d.icon}</div><strong>${escapeHTML(d.name)}</strong><div style="font-size:12px;color:#68717b;margin-top:4px">${100-d.used}% livre de ${d.total} · simulado</div><div class="drive-bar"><i style="width:${d.used}%"></i></div>`;
    c.onclick=()=>nav(d.path);grid.appendChild(c);
  });
}

function buildSettings(wrap){
  wrap.className="settings-v4";
  const pages=[
    ["system","🖥️ Sistema"],["bluetooth","🔵 Bluetooth e dispositivos"],["network","🌐 Rede e Internet"],["personalization","🎨 Personalização"],
    ["apps","▦ Aplicações"],["accounts","👤 Contas"],["time","🕒 Hora e idioma"],["gaming","🎮 Jogos"],["accessibility","♿ Acessibilidade"],
    ["privacy","🔒 Privacidade e segurança"],["update","🔄 Windows Update"]
  ];
  wrap.innerHTML=`<nav class="settings-nav"><div class="settings-profile"><strong>Utilizador</strong><small>Conta local simulada</small></div>${pages.map(([id,n])=>`<button data-settings="${id}">${n}</button>`).join("")}</nav>
  <main class="settings-main-v4"><select class="settings-mobile-nav">${pages.map(([id,n])=>`<option value="${id}">${n.replace(/^.. /,"")}</option>`).join("")}</select><div data-settings-page></div></main>`;
  const pageBox=wrap.querySelector("[data-settings-page]"),mobile=wrap.querySelector(".settings-mobile-nav");
  function show(page){
    state.settingsPage=page;saveState();mobile.value=page;
    wrap.querySelectorAll("[data-settings]").forEach(b=>b.classList.toggle("active",b.dataset.settings===page));
    renderSettingsPage(pageBox,page);
  }
  wrap.querySelectorAll("[data-settings]").forEach(b=>b.onclick=()=>show(b.dataset.settings));
  mobile.onchange=e=>show(e.target.value);
  show(state.settingsPage||"system");
}
function renderSettingsPage(box,page){
  const pages={
    system:()=>`<h1>Sistema</h1><div class="sys-grid">
      <div class="sys-card clickable" data-open-app="security"><div class="big-icon">🛡️</div><strong>Segurança</strong><p>Proteção e estado do dispositivo virtual.</p></div>
      <div class="sys-card"><div class="big-icon">🖥️</div><strong>Ecrã</strong><p>Brilho virtual: ${state.brightness}%</p><input data-set-bright type="range" min="30" max="100" value="${state.brightness}"></div>
      <div class="sys-card"><div class="big-icon">🔊</div><strong>Som</strong><p>Volume virtual: ${state.volume}%</p><input data-set-vol type="range" min="0" max="100" value="${state.volume}"></div>
      <div class="sys-card clickable" data-open-app="devicemanager"><div class="big-icon">🧩</div><strong>Acerca de dispositivos</strong><p>Gestor de Dispositivos virtual.</p></div>
    </div><h3>Acerca de</h3><div class="sys-card"><div class="kv"><dt>Edição</dt><dd>Windows 11 Simulator V4</dd><dt>Versão</dt><dd>24H2 virtual</dd><dt>Compilação</dt><dd>${state.update.version}</dd><dt>Tipo de sistema</dt><dd>Browser Sandbox</dd></div></div>`,
    bluetooth:()=>`<h1>Bluetooth e dispositivos</h1><div class="sys-card"><div class="row"><div><strong>Bluetooth</strong><p>Adaptador virtual</p></div><button class="toggle ${state.devices.bluetooth?"on":""}" data-device-toggle="bluetooth"></button></div></div><h3>Dispositivos</h3><div class="sys-grid"><div class="sys-card"><strong>⌨️ Teclado HID</strong><p>Ligado</p></div><div class="sys-card"><strong>🖱️ Rato compatível</strong><p>Ligado</p></div><div class="sys-card"><strong>🎧 Áudio virtual</strong><p>Ligado</p></div></div>`,
    network:()=>`<h1>Rede e Internet</h1><div class="sys-card"><div class="row"><div><strong>Wi-Fi</strong><p>${state.quick.wifi?"Ligado a SIMULATOR-NET":"Desligado"}</p></div><button class="toggle ${state.quick.wifi?"on":""}" data-wifi></button></div></div><div class="sys-card"><div class="kv"><dt>IPv4</dt><dd>192.168.56.101 (simulado)</dd><dt>Gateway</dt><dd>192.168.56.1</dd><dt>DNS</dt><dd>Virtual Resolver</dd></div></div>`,
    personalization:()=>`<h1>Personalização</h1><div class="sys-card"><div class="row"><div><strong>Modo escuro</strong><p>Tema das aplicações e janelas</p></div><button class="toggle ${state.theme==="dark"?"on":""}" data-theme-v4></button></div></div><h3>Fundo</h3><div class="sys-card"><div class="wallpapers"></div></div>`,
    apps:()=>`<h1>Aplicações</h1><div class="sys-grid"><div class="sys-card clickable" data-open-app="store"><div class="big-icon">🛍️</div><strong>Aplicações instaladas</strong><p>Gerir conteúdo virtual da Microsoft Store.</p></div><div class="sys-card"><div class="big-icon">⚙️</div><strong>Aplicações predefinidas</strong><p>Edge, Fotografias e Notas configuradas como predefinidas.</p></div></div>`,
    accounts:()=>`<h1>Contas</h1><div class="sys-card"><div class="big-icon">👤</div><strong>Utilizador</strong><p>Conta local do Windows Simulator.</p><span class="badge">Administrador virtual</span></div><h3>Opções de início de sessão</h3><div class="sys-card"><p>PIN, Windows Hello e palavras-passe reais não são usados pelo simulador.</p></div>`,
    time:()=>`<h1>Hora e idioma</h1><div class="sys-card"><div class="kv"><dt>Data e hora</dt><dd>${new Date().toLocaleString("pt-PT")}</dd><dt>Idioma</dt><dd>Português (Portugal)</dd><dt>Formato regional</dt><dd>Portugal</dd></div></div><div class="sys-card clickable" data-open-app="clock"><strong>Relógio</strong><p>Abrir alarmes, temporizador e cronómetro.</p></div>`,
    gaming:()=>`<h1>Jogos</h1><div class="sys-card"><div class="row"><div><strong>Modo de Jogo</strong><p>Prioriza visualmente aplicações no simulador.</p></div><button class="toggle on"></button></div></div><div class="sys-card"><strong>Xbox Game Bar</strong><p>Funcionalidade apresentada apenas como conteúdo visual.</p></div>`,
    accessibility:()=>`<h1>Acessibilidade</h1><div class="sys-grid"><div class="sys-card"><strong>Tamanho do texto</strong><p>100% — configuração simulada.</p></div><div class="sys-card"><strong>Contraste</strong><p>Tema padrão.</p></div><div class="sys-card"><strong>Narrador</strong><p>Não ativo.</p></div><div class="sys-card"><strong>Teclado</strong><p>Teclas de aderência desativadas.</p></div></div>`,
    privacy:()=>`<h1>Privacidade e segurança</h1><div class="sys-grid"><div class="sys-card clickable" data-open-app="security"><div class="big-icon">🛡️</div><strong>Segurança do Windows</strong><p class="status-ok">Nenhuma ação necessária</p></div><div class="sys-card"><strong>Permissões das aplicações</strong><p>A simulação não solicita acesso ao sistema de ficheiros real.</p></div><div class="sys-card"><strong>Diagnóstico</strong><p>Telemetria externa desativada nesta versão standalone.</p></div></div>`,
    update:()=>renderWindowsUpdatePage()
  };
  box.innerHTML=(pages[page]||pages.system)();
  box.querySelectorAll("[data-open-app]").forEach(x=>x.onclick=()=>openApp(x.dataset.openApp));
  box.querySelector("[data-set-bright]")?.addEventListener("input",e=>{state.brightness=+e.target.value;saveState();applyState()});
  box.querySelector("[data-set-vol]")?.addEventListener("input",e=>{state.volume=+e.target.value;saveState();applyState()});
  box.querySelector("[data-device-toggle]")?.addEventListener("click",e=>{const k=e.currentTarget.dataset.deviceToggle;state.devices[k]=!state.devices[k];saveState();e.currentTarget.classList.toggle("on",state.devices[k])});
  box.querySelector("[data-wifi]")?.addEventListener("click",e=>{state.quick.wifi=!state.quick.wifi;saveState();syncQuick();e.currentTarget.classList.toggle("on",state.quick.wifi)});
  box.querySelector("[data-theme-v4]")?.addEventListener("click",e=>{state.theme=state.theme==="dark"?"light":"dark";saveState();applyState();e.currentTarget.classList.toggle("on",state.theme==="dark")});
  const ws=box.querySelector(".wallpapers");if(ws)WALLPAPERS.forEach((bg,i)=>{const b=document.createElement("button");b.className="wallpaper-choice"+(i===state.wallpaper?" active":"");b.style.background=bg;b.onclick=()=>{state.wallpaper=i;saveState();applyState();renderSettingsPage(box,"personalization")};ws.appendChild(b)});
  box.querySelector("[data-check-updates]")?.addEventListener("click",()=>startWindowsUpdateCheck(box));
  box.querySelector("[data-update-restart]")?.addEventListener("click",restartSystem);
}
function renderWindowsUpdatePage(){
  const u=state.update;
  const status=u.status==="checking"?"A procurar atualizações…":u.status==="downloading"?"A transferir atualização simulada…":u.status==="restart"?"Reinício necessário":"Está atualizado";
  return `<h1>Windows Update</h1><div class="update-hero"><div class="update-icon">🔄</div><div><div class="update-state">${status}</div><div class="update-meta">Windows 11 Simulator · Compilação ${escapeHTML(u.version)}</div></div></div>
  ${u.status==="checking"||u.status==="downloading"?`<div class="sys-progress"><i style="width:${u.progress}%"></i></div>`:""}
  <div style="margin-top:14px"><button class="sys-button primary" data-check-updates ${u.status==="checking"||u.status==="downloading"?"disabled":""}>Procurar atualizações</button> ${u.status==="restart"?'<button class="sys-button" data-update-restart>Reiniciar agora</button>':""}</div>
  <h3>Mais opções</h3><div class="sys-grid"><div class="sys-card"><strong>Pausar atualizações</strong><p>As atualizações são apenas simuladas e nunca alteram o dispositivo real.</p></div><div class="sys-card"><strong>Histórico de atualizações</strong><p>${u.lastChecked?"Última verificação: "+new Date(u.lastChecked).toLocaleString("pt-PT"):"Ainda não foram procuradas atualizações."}</p></div></div>`;
}
function startWindowsUpdateCheck(box){
  if(["checking","downloading"].includes(state.update.status))return;
  state.update.status="checking";state.update.progress=8;state.update.lastChecked=Date.now();saveState();renderSettingsPage(box,"update");
  let p=8;
  const id=setInterval(()=>{
    p+=13;state.update.progress=Math.min(p,100);
    if(p<35)state.update.status="checking";else state.update.status="downloading";
    saveState();
    if(box.isConnected)renderSettingsPage(box,"update");
    if(p>=100){clearInterval(id);state.update.status="restart";state.update.progress=100;state.update.version="26100.1100";saveState();if(box.isConnected)renderSettingsPage(box,"update");notify("Windows Update","Atualização cumulativa virtual pronta para reiniciar.")}
  },420);
}

function renderTaskManager(wrap){
  wrap.className="tm-v4";
  const tabs=[["processes","Processos"],["performance","Desempenho"],["startup","Aplicações de arranque"],["users","Utilizadores"],["details","Detalhes"]];
  wrap.innerHTML=`<nav class="tm-nav">${tabs.map(([id,n])=>`<button data-tm="${id}">${n}</button>`).join("")}</nav><main class="tm-content"></main>`;
  const content=wrap.querySelector(".tm-content");
  function show(tab){
    wrap.querySelectorAll("[data-tm]").forEach(b=>b.classList.toggle("active",b.dataset.tm===tab));
    if(tab==="processes"){
      const rows=$$(".window").filter(w=>Number(w.dataset.desktop||0)===Number(state.currentDesktop)).map(w=>`<tr><td>${APPS[w.dataset.app]?.icon||"◻"} ${escapeHTML(APPS[w.dataset.app]?.name||w.dataset.app)}</td><td>${w.dataset.pid}</td><td>${(((Number(w.dataset.pid)%17)+3)/10).toFixed(1)}%</td><td>${45+(Number(w.dataset.pid)%90)} MB</td><td><button class="sys-button" data-end="${w.dataset.id}">Terminar tarefa</button></td></tr>`).join("");
      content.innerHTML=`<h2>Processos</h2><table><thead><tr><th>Nome</th><th>PID</th><th>CPU</th><th>Memória</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="5">Sem aplicações abertas.</td></tr>'}</tbody></table>`;
      content.querySelectorAll("[data-end]").forEach(b=>b.onclick=()=>{const w=$(`.window[data-id="${b.dataset.end}"]`);if(w)closeWindow(w);show("processes")});
    }else if(tab==="performance"){
      const seed=Date.now()%100;
      content.innerHTML=`<h2>Desempenho</h2><div class="performance-grid">
        ${perfCard("CPU","7%","3.40 GHz",seed)}
        ${perfCard("Memória","42%","3.4 / 8.0 GB virtual",seed+13)}
        ${perfCard("Disco 0 (C:)","2%","SSD virtual",seed+29)}
        ${perfCard("Wi-Fi","0 Kbps","SIMULATOR-NET",seed+41)}
      </div>`;
    }else if(tab==="startup"){
      content.innerHTML='<h2>Aplicações de arranque</h2><table><tr><th>Nome</th><th>Estado</th><th>Impacto</th></tr><tr><td>Windows Security notification icon</td><td>Ativado</td><td>Baixo</td></tr><tr><td>Microsoft Edge</td><td>Desativado</td><td>Não medido</td></tr><tr><td>OneDrive virtual</td><td>Desativado</td><td>Baixo</td></tr></table>';
    }else if(tab==="users"){
      content.innerHTML='<h2>Utilizadores</h2><div class="sys-card"><strong>👤 Utilizador</strong><p>Sessão local virtual · Administrador virtual</p></div>';
    }else{
      content.innerHTML=`<h2>Detalhes</h2><table><tr><th>Nome</th><th>PID</th><th>Estado</th><th>Nome de utilizador</th></tr>${$$(".window").map(w=>`<tr><td>${escapeHTML(w.dataset.app)}.exe</td><td>${w.dataset.pid}</td><td>Em execução</td><td>USER</td></tr>`).join("")}</table>`;
    }
  }
  wrap.querySelectorAll("[data-tm]").forEach(b=>b.onclick=()=>show(b.dataset.tm));show("processes");
}
function perfCard(name,value,sub,seed){
  let bars="";for(let i=0;i<26;i++){const h=12+((seed+i*17)%77);bars+=`<i style="height:${h}%"></i>`}
  return `<div class="performance-card"><strong>${name}</strong><div class="perf-value">${value}</div><small>${sub}</small><div class="perf-bars">${bars}</div></div>`;
}

function buildSecurity(wrap){
  wrap.className="sys-page";
  wrap.innerHTML=`<h2>Segurança do Windows</h2><div class="security-hero"><div class="security-shield">🛡️</div><div><strong>O dispositivo virtual está protegido</strong><p>As verificações e ameaças desta aplicação são exclusivamente simuladas.</p></div></div>
  <div class="sys-grid">
    <div class="sys-card"><strong>Proteção contra vírus e ameaças</strong><p class="status-ok">${state.security.threats} ameaças virtuais atuais</p><div class="security-actions"><button class="sys-button primary" data-scan>Verificação rápida</button></div><div class="sys-progress" data-scan-progress style="display:none"><i></i></div></div>
    <div class="sys-card"><strong>Proteção de conta</strong><p class="status-ok">Nenhuma ação necessária</p></div>
    <div class="sys-card"><strong>Firewall e proteção de rede</strong><p class="status-ok">Firewall virtual ativo</p></div>
    <div class="sys-card"><strong>Controlo de aplicações e browser</strong><p>SmartScreen virtual ativado.</p></div>
    <div class="sys-card"><strong>Segurança do dispositivo</strong><p>Isolamento da simulação ativo.</p></div>
    <div class="sys-card"><strong>Desempenho e estado</strong><p class="status-ok">Tudo normal.</p></div>
  </div>`;
  wrap.querySelector("[data-scan]").onclick=()=>{
    const prog=wrap.querySelector("[data-scan-progress]"),bar=prog.querySelector("i");prog.style.display="block";let p=0;
    const id=setInterval(()=>{p+=11;bar.style.width=Math.min(p,100)+"%";if(p>=100){clearInterval(id);state.security.lastScan=Date.now();state.security.threats=0;saveState();notify("Segurança do Windows","Verificação rápida virtual concluída: nenhuma ameaça.");prog.style.display="none"}},180);
  };
}

function buildDeviceManager(wrap){
  wrap.className="sys-page";
  const groups=[
    ["Adaptadores de ecrã",[["gpu","🖥️","Microsoft Basic Display Adapter (virtual)"]]],
    ["Bluetooth",[["bluetooth","🔵","Generic Bluetooth Adapter"]]],
    ["Câmaras",[["camera","📷","Integrated Camera (virtual)"]]],
    ["Controladores de som",[["audio","🔊","High Definition Audio Device"]]],
    ["Adaptadores de rede",[["network","🌐","Virtual Ethernet Adapter"]]],
    ["Teclados",[["keyboard","⌨️","HID Keyboard Device"]]]
  ];
  wrap.innerHTML="<h2>Gestor de Dispositivos</h2><p>Todos os dispositivos desta janela são objetos virtuais do simulador.</p>"+groups.map(([g,items])=>`<div class="device-group"><strong>${g}</strong>${items.map(([k,ic,n])=>`<div class="device-item ${state.devices[k]===false?"disabled":""}"><div class="dev-name"><span>${ic}</span><span>${n}</span></div><button class="sys-button" data-device="${k}">${state.devices[k]===false?"Ativar":"Desativar"}</button></div>`).join("")}</div>`).join("");
  wrap.querySelectorAll("[data-device]").forEach(b=>b.onclick=()=>{const k=b.dataset.device;state.devices[k]=state.devices[k]===false?true:false;saveState();buildDeviceManager(wrap);notify("Gestor de Dispositivos",`${k} ${state.devices[k]?"ativado":"desativado"} apenas na simulação.`)});
}

function buildRegistry(wrap){
  wrap.className="registry-layout";
  const keys={
    "HKEY_CURRENT_USER":["Control Panel","Environment","Software\\FantaMK\\WindowsSimulator"],
    "HKEY_LOCAL_MACHINE":["HARDWARE","SOFTWARE","SYSTEM"],
    "HKEY_CLASSES_ROOT":[".txt",".png","Applications"],
    "HKEY_USERS":[".DEFAULT","S-1-5-21-SIMULATOR"]
  };
  wrap.innerHTML=`<div class="registry-tree">${Object.keys(keys).map(k=>`<button data-reg="${escapeHTML(k)}">▸ ${escapeHTML(k)}</button>`).join("")}</div><div class="registry-values"></div>`;
  const values=wrap.querySelector(".registry-values");
  function show(k){
    wrap.querySelectorAll("[data-reg]").forEach(b=>b.classList.toggle("active",b.dataset.reg===k));    values.innerHTML=`<h3>${escapeHTML(k)}</h3><table><tr><th>Nome</th><th>Tipo</th><th>Dados</th></tr><tr><td>(Predefinição)</td><td>REG_SZ</td><td>(valor não definido)</td></tr><tr><td>SimulatorVersion</td><td>REG_SZ</td><td>4.0</td></tr><tr><td>SafeSandbox</td><td>REG_DWORD</td><td>0x00000001 (1)</td></tr></table><p style="font-size:12px;color:#68717a;margin-top:14px">Este editor nunca lê nem altera o Registry real do Windows.</p>`;
  }
  wrap.querySelectorAll("[data-reg]").forEach(b=>b.onclick=()=>show(b.dataset.reg));show("HKEY_CURRENT_USER");
}

function buildEventViewer(wrap){
  wrap.className="sys-page event-list";
  function render(){
    const events=[...(state.events||[]),...(state.notifications||[]).slice(0,8).map((n,i)=>({level:"Information",source:"NotificationCenter",id:2000+i,message:n.title+": "+n.message,time:n.time}))].sort((a,b)=>b.time-a.time);
    wrap.innerHTML=`<h2>Visualizador de Eventos</h2><div class="event-toolbar"><button class="sys-button" data-refresh>Atualizar</button><button class="sys-button" data-clear>Limpar registo virtual</button></div><div>${events.map(e=>`<div class="event-row"><span class="${e.level==="Error"?"event-error":e.level==="Warning"?"event-warning":"event-info"}">${e.level}</span><span>${e.id}</span><span>${escapeHTML(e.message)}</span><span>${escapeHTML(e.source)}</span></div>`).join("")||"<p>Sem eventos.</p>"}</div>`;
    wrap.querySelector("[data-refresh]").onclick=render;
    wrap.querySelector("[data-clear]").onclick=()=>{state.events=[];saveState();render()};
  }render();
}

function buildControlPanel(wrap){
  wrap.className="sys-page";
  const cards=[
    ["🛡️","Sistema e Segurança","security"],["🌐","Rede e Internet","network"],["🧩","Hardware e Som","devicemanager"],
    ["▦","Programas","apps"],["👤","Contas de Utilizador","accounts"],["🎨","Aspeto e Personalização","personalization"],
    ["🕒","Relógio e Região","time"],["♿","Facilidade de Acesso","accessibility"]
  ];
  wrap.innerHTML=`<h2>Painel de Controlo</h2><div class="sys-grid">${cards.map(([ic,n,id])=>`<div class="sys-card clickable" data-cp="${id}"><div class="big-icon">${ic}</div><strong>${n}</strong><p>Abrir definições virtuais relacionadas.</p></div>`).join("")}</div>`;
  wrap.querySelectorAll("[data-cp]").forEach(c=>c.onclick=()=>{const id=c.dataset.cp;if(id==="security")openApp("security");else if(id==="devicemanager")openApp("devicemanager");else openSettingsPage(id)});
}

function buildClock(wrap){
  wrap.className="sys-page";
  wrap.innerHTML=`<h2>Relógio</h2><div class="clock-tabs"><button class="active">Cronómetro</button><button>Temporizador</button><button>Alarmes</button></div><div data-clock-body></div>`;
  const body=wrap.querySelector("[data-clock-body]"),tabs=wrap.querySelectorAll(".clock-tabs button");
  let elapsed=0,running=false,interval=null;
  function stopwatch(){
    body.innerHTML=`<div class="clock-big" data-sw>${formatStopwatch(elapsed)}</div><div class="timer-row"><button class="sys-button primary" data-start>${running?"Pausa":"Iniciar"}</button><button class="sys-button" data-reset>Repor</button></div>`;
    body.querySelector("[data-start]").onclick=()=>{running=!running;if(running&&!interval)interval=setInterval(()=>{elapsed+=100;if(!wrap.isConnected){clearInterval(interval);return}const el=body.querySelector("[data-sw]");if(el)el.textContent=formatStopwatch(elapsed)},100);if(!running&&interval){clearInterval(interval);interval=null}stopwatch()};
    body.querySelector("[data-reset]").onclick=()=>{elapsed=0;running=false;if(interval){clearInterval(interval);interval=null}stopwatch()};
  }
  function timer(){body.innerHTML='<div class="clock-big" data-timer>05:00</div><div class="timer-row"><input data-min type="number" min="1" max="120" value="5"><button class="sys-button primary" data-go>Iniciar</button></div>';body.querySelector("[data-go]").onclick=()=>{let secs=Math.max(1,+body.querySelector("[data-min]").value)*60;const el=body.querySelector("[data-timer]");const id=setInterval(()=>{secs--;el.textContent=`${String(Math.floor(secs/60)).padStart(2,"0")}:${String(secs%60).padStart(2,"0")}`;if(secs<=0||!wrap.isConnected){clearInterval(id);if(secs<=0)notify("Relógio","Temporizador virtual concluído.")}},1000)}}
  function alarms(){body.innerHTML='<div class="sys-card"><strong>07:30</strong><p>Alarme de exemplo · Desativado</p></div><div class="sys-card"><strong>08:00</strong><p>Dias úteis · Desativado</p></div>'}
  tabs.forEach((b,i)=>b.onclick=()=>{tabs.forEach(x=>x.classList.remove("active"));b.classList.add("active");i===0?stopwatch():i===1?timer():alarms()});stopwatch();
}
function formatStopwatch(ms){const s=Math.floor(ms/1000),m=Math.floor(s/60),cs=Math.floor((ms%1000)/10);return `${String(m).padStart(2,"0")}:${String(s%60).padStart(2,"0")}.${String(cs).padStart(2,"0")}`}

function buildSnipping(wrap){
  wrap.className="snip-stage";
  wrap.innerHTML='<div class="snip-toolbar"><button class="sys-button primary" data-new>Novo recorte</button><button class="sys-button" data-save>Guardar em Imagens</button></div><div class="snip-preview"><canvas width="900" height="520"></canvas></div>';
  const c=wrap.querySelector("canvas"),ctx=c.getContext("2d");
  function draw(){
    const grad=ctx.createLinearGradient(0,0,c.width,c.height);grad.addColorStop(0,"#35306b");grad.addColorStop(.55,"#bd638e");grad.addColorStop(1,"#ee8968");ctx.fillStyle=grad;ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle="rgba(25,30,43,.82)";ctx.fillRect(90,80,720,330);ctx.fillStyle="#fff";ctx.font="32px Segoe UI";ctx.fillText("Windows 11 Simulator",130,145);ctx.font="18px Segoe UI";ctx.fillText("Captura simulada da área de trabalho",130,185);
    ctx.fillStyle="rgba(255,255,255,.14)";ctx.fillRect(130,220,550,120);ctx.fillStyle="#fff";ctx.fillText(new Date().toLocaleString("pt-PT"),160,285);
  }draw();
  wrap.querySelector("[data-new]").onclick=()=>{draw();notify("Ferramenta de Recorte","Novo recorte virtual criado.")};
  wrap.querySelector("[data-save]").onclick=()=>{const name="Captura-"+Date.now()+".png";ensureFolder("C:/Pictures")[name]=c.toDataURL("image/png");saveState();notify("Ferramenta de Recorte",`${name} guardada em Imagens.`)};
}

function buildMediaPlayer(wrap){
  wrap.className="media-v4";
  wrap.innerHTML='<aside><div class="nav-item active">Início</div><div class="nav-item">Biblioteca de música</div><div class="nav-item">Biblioteca de vídeo</div><div class="nav-item">Listas de reprodução</div></aside><main class="media-main"><h2>Media Player</h2><div class="album-art">♫</div><div style="text-align:center"><strong data-track>Faixa de demonstração</strong><p style="color:#68717b">Biblioteca virtual</p></div><div class="media-controls"><button>⏮</button><button class="play" data-play>▶</button><button>⏭</button></div><div class="sys-progress"><i data-media-progress></i></div><p style="text-align:center;font-size:12px;color:#68717b">Sem reprodução de áudio real nesta versão standalone.</p></main>';
  let playing=false,p=0,id=null;const btn=wrap.querySelector("[data-play]"),bar=wrap.querySelector("[data-media-progress]");
  btn.onclick=()=>{playing=!playing;btn.textContent=playing?"⏸":"▶";if(playing&&!id)id=setInterval(()=>{p=(p+1)%101;bar.style.width=p+"%";if(!wrap.isConnected){clearInterval(id);id=null}},500);if(!playing&&id){clearInterval(id);id=null}};
}

function buildStore(wrap){
  wrap.className="sys-page";
  const catalog=[
    ["terminal","⌨️","Windows Terminal","Terminal moderno virtual."],
    ["photos","🖼️","Microsoft Photos","Galeria do simulador."],
    ["paint","🖌️","Paint","Editor gráfico virtual."],
    ["powertoys","🧰","PowerToys","Conjunto de utilitários demonstrativo."],
    ["phone","📱","Phone Link","Ligação a telemóvel apresentada como conteúdo visual."],
    ["xbox","🎮","Xbox","Aplicação de jogos simulada."]
  ];
  function render(){
    wrap.innerHTML=`<h2>Microsoft Store</h2><div class="store-hero"><h3>Aplicações para o seu Windows virtual</h3><p>Instalações desta loja apenas alteram o estado do simulador.</p></div><div class="store-grid">${catalog.map(([id,ic,n,d])=>`<div class="store-app"><div class="store-icon">${ic}</div><h4>${n}</h4><p>${d}</p><button class="sys-button ${state.storeInstalled[id]?"":"primary"}" data-store="${id}">${state.storeInstalled[id]?"Instalado":"Obter"}</button></div>`).join("")}</div>`;
    wrap.querySelectorAll("[data-store]").forEach(b=>b.onclick=()=>{const id=b.dataset.store;if(!state.storeInstalled[id]){state.storeInstalled[id]=true;saveState();notify("Microsoft Store","Aplicação virtual instalada.");render()}});
  }render();
}

function runVirtualCommand(raw,out){
  const cmd=raw.trim();if(!cmd)return;
  const q=document.createElement("div");q.className="term-line";q.textContent=`C:\\Users\\User>${cmd}`;out.appendChild(q);
  const [op,...args]=cmd.split(/\s+/);const command=(op||"").toLowerCase();let r="";
  const launch={notepad:"notepad",calc:"calc",explorer:"explorer",taskmgr:"taskmanager",control:"controlpanel",regedit:"registry",devmgmt:"devicemanager",eventvwr:"eventviewer",mspaint:"paint",msedge:"edge",store:"store","ms-settings:":"settings"};
  if(command==="start"&&args[0]){const target=launch[args[0].toLowerCase()]||args[0].toLowerCase();if(APPS[target]){openApp(target);r="Aplicação virtual iniciada."}else r="Aplicação virtual não encontrada."}
  else if(launch[command]){openApp(launch[command]);r="Aplicação virtual iniciada."}
  else switch(command){
    case"help":r="help, dir, cd, mkdir, echo, type, cls, tasklist, systeminfo, ipconfig, ver, whoami, date, time, winver, start, control, regedit, devmgmt, eventvwr";break;
    case"dir":r=Object.keys(ensureFolder("C:/Documents")).join("\n")||"Pasta vazia.";break;
    case"cd":r=args.length?"Diretório virtual alterado para "+args.join(" "):"C:\\Users\\User";break;
    case"mkdir":if(args[0]){ensureFolder("C:/Documents/"+args.join(" "));saveState();r="Diretório virtual criado."}else r="Falta o nome.";break;
    case"echo":r=args.join(" ");break;
    case"type":r=ensureFolder("C:/Documents")[args.join(" ")]??"Ficheiro não encontrado.";break;
    case"cls":out.innerHTML="";return;
    case"tasklist":r=$$(".window").map(w=>`${APPS[w.dataset.app]?.name||w.dataset.app}  PID ${w.dataset.pid}`).join("\n")||"Sem processos.";break;
    case"systeminfo":r=`SO: Windows 11 Simulator V4\nVersão: 24H2 virtual\nCompilação: ${state.update.version}\nPlataforma: Browser Sandbox\nMemória: 8 GB virtual\nExecução real: DESATIVADA`;break;
    case"ipconfig":r=`Adaptador Ethernet Virtual\n IPv4: 192.168.56.101\n Gateway: 192.168.56.1\n Estado Wi-Fi: ${state.quick.wifi?"Ligado":"Desligado"}\n(Dados simulados)`;break;
    case"ver":r=`Microsoft Windows [Versão simulada 11.0.${state.update.version}]`;break;
    case"winver":showSystemDialog("Acerca do Windows",`<h2>Windows 11 Simulator</h2><p>Versão 24H2 virtual</p><p>Compilação ${escapeHTML(state.update.version)}</p><p>Este é um ambiente web simulado e não o Windows real.</p>`);r="Acerca do Windows aberto.";break;
    case"whoami":r="simulator\\user";break;
    case"date":r=new Date().toLocaleDateString("pt-PT");break;
    case"time":r=new Date().toLocaleTimeString("pt-PT");break;
    default:r=`'${command}' não é reconhecido como comando virtual.`;
  }
  const el=document.createElement("div");el.className="term-line";el.textContent=String(r);out.appendChild(el);
}

function executeRun(){
  const cmd=$("#run-input").value.trim().toLowerCase();
  const map={notepad:"notepad",calc:"calc",calculator:"calc",explorer:"explorer",cmd:"terminal",terminal:"terminal",settings:"settings",taskmgr:"taskmanager",paint:"paint",mspaint:"paint",photos:"photos",edge:"edge",msedge:"edge",control:"controlpanel",regedit:"registry",devmgmt:"devicemanager",eventvwr:"eventviewer",security:"security",clock:"clock",snippingtool:"snipping",mediaplayer:"mediaplayer",store:"store"};
  if(map[cmd]){openApp(map[cmd]);closeRun();return}
  if(cmd==="winver"){showSystemDialog("Acerca do Windows",`<h2>Windows 11 Simulator V4</h2><p>Versão 24H2 virtual</p><p>Compilação ${escapeHTML(state.update.version)}</p><p>Executado integralmente no navegador.</p>`);closeRun();return}
  notify("Executar",`Não foi possível localizar "${cmd}".`);
}

function collectSearchResults(q){
  q=q.trim().toLowerCase();if(!q)return [];
  const out=[];
  Object.entries(APPS).forEach(([id,a])=>{if((a.name+" "+id).toLowerCase().includes(q))out.push({type:"app",id,name:a.name,icon:a.icon,detail:"Aplicação"})});
  [
    ["Sistema","system"],["Bluetooth","bluetooth"],["Rede e Internet","network"],["Personalização","personalization"],["Aplicações","apps"],["Contas","accounts"],["Hora e idioma","time"],["Jogos","gaming"],["Acessibilidade","accessibility"],["Privacidade e segurança","privacy"],["Windows Update","update"]
  ].forEach(([name,page])=>{if(name.toLowerCase().includes(q))out.push({type:"settings",page,name,icon:"⚙️",detail:"Definições"})});
  Object.entries(state.files||{}).forEach(([path,files])=>Object.entries(files||{}).forEach(([name,value])=>{if(name.toLowerCase().includes(q)||String(value).toLowerCase().includes(q))out.push({type:"file",path,name,icon:name.endsWith(".png")?"🖼️":"📄",detail:path})}));
  return out.slice(0,30);
}
function launchSearchResult(r){
  if(r.type==="app")openApp(r.id);
  else if(r.type==="settings")openSettingsPage(r.page);
  else{const v=(state.files[r.path]||{})[r.name];if(typeof v==="string"&&v.startsWith("data:image/"))openApp("photos");else if(typeof v==="string"){state.notepadText=v;touchRecent(r.path+"/"+r.name);openApp("notepad")}else openApp("explorer",r.path)}
  closeOverlays();
}

/* richer desktop context menu, capture phase prevents old handler */
$("#desktop").addEventListener("contextmenu",e=>{
  if(e.target.closest(".desktop-icon"))return;
  e.preventDefault();e.stopImmediatePropagation();
  showContext(e.clientX,e.clientY,[
    ["Ver",()=>notify("Ambiente de Trabalho","Ícones médios selecionados.")],
    ["Ordenar por",()=>notify("Ambiente de Trabalho","Ordenação automática simulada.")],
    ["Atualizar",()=>{populateDesktop();notify("Ambiente de Trabalho","Atualizado.")}],
    "---",
    ["Novo > Pasta",()=>{let n="Nova pasta",i=1;while(state.files["C:/Desktop/"+n])n=`Nova pasta (${++i})`;ensureFolder("C:/Desktop/"+n);saveState();notify("Ambiente de Trabalho",`${n} criada.`)}],
    "---",
    ["Definições de visualização",()=>openSettingsPage("system")],
    ["Personalizar",()=>openSettingsPage("personalization")]
  ]);
},true);

/* keyboard additions */
document.addEventListener("keydown",e=>{
  if(e.metaKey&&e.key.toLowerCase()==="v"){e.preventDefault();toggleOverlay("clipboard");renderClipboard()}
  if(e.metaKey&&e.key.toLowerCase()==="w"){/* reserve browser semantics */}
  if(e.metaKey&&e.shiftKey&&e.key.toLowerCase()==="s"){e.preventDefault();openApp("snipping")}
});

/* keep system dialog and new overlays out of generic close click */
document.addEventListener("click",e=>{
  if(e.target.closest("#system-dialog"))return;
},true);

v4MigrateState();
