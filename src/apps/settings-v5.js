"use strict";
/* ---------- Settings V5 ---------- */
function buildSettingsV5(wrap){
  wrap.className="settings-v4";
  const pages=[
    ["system","🖥️ Sistema"],["bluetooth","🔵 Bluetooth e dispositivos"],["network","🌐 Rede e Internet"],["personalization","🎨 Personalização"],
    ["apps","▦ Aplicações"],["explorer","📁 Explorador de Ficheiros"],["accounts","👤 Contas"],["time","🕒 Hora e idioma"],["gaming","🎮 Jogos"],["accessibility","♿ Acessibilidade"],
    ["privacy","🔒 Privacidade e segurança"],["update","🔄 Windows Update"]
  ];
  wrap.innerHTML=`<nav class="settings-nav"><div class="settings-profile"><strong>Utilizador</strong><small>Conta local simulada</small></div>${pages.map(([id,n])=>`<button data-settings="${id}">${n}</button>`).join("")}</nav><main class="settings-main-v4"><select class="settings-mobile-nav">${pages.map(([id,n])=>`<option value="${id}">${n}</option>`).join("")}</select><div data-settings-page></div></main>`;
  const box=wrap.querySelector("[data-settings-page]"),mobile=wrap.querySelector(".settings-mobile-nav");
  function show(p){state.settingsPage=p;saveState();mobile.value=p;wrap.querySelectorAll("[data-settings]").forEach(b=>b.classList.toggle("active",b.dataset.settings===p));renderSettingsPageV5(box,p)}
  wrap.querySelectorAll("[data-settings]").forEach(b=>b.onclick=()=>show(b.dataset.settings));mobile.onchange=e=>show(e.target.value);show(state.settingsPage||"system");
}
function renderSettingsPageV5(box,page){
  if(page==="system"){box.innerHTML=`<h1>Sistema</h1>
    <div class="sys-grid">
      <div class="sys-card"><strong>🖥️ Ecrã</strong><p>Brilho virtual ${state.brightness}%</p><input data-bright type="range" min="30" max="100" value="${state.brightness}"></div>
      <div class="sys-card"><strong>🔊 Som</strong><p>Volume virtual ${state.volume}%</p><input data-vol-v5 type="range" min="0" max="100" value="${state.volume}"></div>
      <div class="sys-card clickable" data-sys="notifications"><strong>🔔 Notificações</strong><p>${state.privacy.notifications?"Ativadas":"Desativadas"}</p></div>
      <div class="sys-card clickable" data-sys="power"><strong>🔋 Energia e bateria</strong><p>${state.power.battery}% · ${state.power.mode}</p></div>
      <div class="sys-card clickable" data-sys="storage"><strong>💽 Armazenamento</strong><p>Gestão de discos e Sensor de Armazenamento.</p></div>
      <div class="sys-card clickable" data-sys="multitasking"><strong>▣ Multitarefas</strong><p>Snap, ambientes virtuais e Alt+Tab.</p></div>
      <div class="sys-card clickable" data-sys="clipboard"><strong>📋 Área de transferência</strong><p>Histórico virtual + ligação à área de transferência real com Win+V.</p></div>
      <div class="sys-card clickable" data-open-v5="optionalfeatures"><strong>🧩 Funcionalidades opcionais</strong><p>.NET, WSL, Sandbox e outras opções virtuais.</p></div>
      <div class="sys-card clickable" data-open-v5="recovery"><strong>🩹 Recuperação</strong><p>Opções de recuperação do simulador.</p></div>
      <div class="sys-card clickable" data-open-v5="remotedesktop"><strong>🖥️ Ambiente de Trabalho Remoto</strong><p>${state.remoteDesktop.enabled?"Ativado":"Desativado"}</p></div>
      <div class="sys-card clickable" data-open-v5="systeminfo"><strong>ℹ️ Acerca de</strong><p>Informações detalhadas do sistema virtual.</p></div>
    </div>`}
  else if(page==="bluetooth"){box.innerHTML=`<h1>Bluetooth e dispositivos</h1><div class="sys-card"><div class="row"><div><strong>Bluetooth</strong><p>${state.devices.bluetooth?"Ativado":"Desativado"}</p></div><button class="toggle ${state.devices.bluetooth?"on":""}" data-bt-main></button></div></div><h3>Dispositivos</h3><div class="bt-list">${state.bluetoothDevices.map((d,i)=>`<div class="network-item"><div><strong>${d.type==="Áudio"?"🎧":d.type==="Entrada"?"🖱️":"📱"} ${escapeHTML(d.name)}</strong><small>${d.paired?(d.connected?"Ligado":"Emparelhado"):"Não emparelhado"}</small></div><button class="sys-button" data-bt="${i}">${d.paired?(d.connected?"Desligar":"Ligar"):"Emparelhar"}</button></div>`).join("")}</div>`}
  else if(page==="network"){box.innerHTML=`<h1>Rede e Internet</h1><div class="sys-card"><div class="row"><div><strong>Wi-Fi</strong><p>${state.quick.wifi?"Ativado":"Desativado"}</p></div><button class="toggle ${state.quick.wifi?"on":""}" data-wifi-main></button></div></div><h3>Redes disponíveis</h3><div class="wifi-list">${state.wifiNetworks.map((n,i)=>`<div class="network-item"><div><strong>📶 ${escapeHTML(n.ssid)}</strong><small>Sinal ${n.signal}% · ${n.secure?"Protegida":"Aberta"}${n.connected?" · Ligado":""}</small></div><button class="sys-button ${n.connected?"":"primary"}" data-wifi-net="${i}">${n.connected?"Desligar":"Ligar"}</button></div>`).join("")}</div>`}
  else if(page==="personalization"){box.innerHTML=`<h1>Personalização</h1><div class="sys-card"><div class="row"><div><strong>Modo escuro</strong><p>Tema das aplicações</p></div><button class="toggle ${state.theme==="dark"?"on":""}" data-theme-v5></button></div></div><h3>Fundo</h3><div class="sys-card"><div class="wallpapers"></div></div><div class="sys-card"><strong>Barra de tarefas</strong><p>Ícones centrados e comportamento adaptativo no mobile.</p></div>`}
  else if(page==="apps"){box.innerHTML=`<h1>Aplicações</h1><div class="sys-grid"><div class="sys-card clickable" data-open-v5="store"><strong>🛍️ Aplicações instaladas</strong><p>Microsoft Store virtual.</p></div><div class="sys-card clickable" data-open-v5="optionalfeatures"><strong>🧩 Funcionalidades opcionais</strong><p>Gerir componentes do Windows virtual.</p></div><div class="sys-card"><strong>Aplicações predefinidas</strong><p>Edge, Fotografias, Notas e Media Player.</p></div><div class="sys-card"><strong>Arranque</strong><p>Gerir no Gestor de Tarefas.</p></div></div>`}
  else if(page==="accounts"){box.innerHTML=`<h1>Contas</h1><div class="sys-card"><strong>👤 Utilizador</strong><p>Conta local simulada · Administrador virtual</p><span class="badge">Conta local</span></div><h3>Definições da conta</h3><div class="sys-card"><strong>Opções de início de sessão</strong><p>Windows Hello, PIN e palavra-passe são apenas representados visualmente; não são recolhidas credenciais reais.</p></div><div class="sys-card"><strong>Windows Backup</strong><p><button class="sys-button" data-open-v5="backup">Abrir cópia de segurança</button></p></div>`}
  else if(page==="time"){box.innerHTML=`<h1>Hora e idioma</h1><div class="sys-card"><div class="kv"><dt>Data e hora</dt><dd>${new Date().toLocaleString("pt-PT")}</dd><dt>Fuso horário</dt><dd>Definido pelo navegador</dd><dt>Idioma</dt><dd>Português (Portugal)</dd><dt>Região</dt><dd>Portugal</dd></div><p><button class="sys-button" data-sync-time>Sincronizar agora</button></p></div><div class="sys-card clickable" data-open-v5="clock"><strong>⏱️ Relógio</strong><p>Alarmes, temporizador e cronómetro.</p></div>`}
  else if(page==="gaming"){box.innerHTML=`<h1>Jogos</h1><div class="sys-card"><div class="row"><div><strong>Modo de Jogo</strong><p>Estado virtual para experiências de jogo.</p></div><button class="toggle ${state.gameMode?"on":""}" data-game></button></div></div><div class="sys-card"><strong>Xbox Game Bar</strong><p>Atalho de interface demonstrativo; sem captura real de jogos.</p></div>`}
  else if(page==="accessibility"){box.innerHTML=`<h1>Acessibilidade</h1><div class="sys-card"><strong>Tamanho do texto</strong><p>${state.accessibility.textScale}%</p><input data-textscale type="range" min="90" max="160" value="${state.accessibility.textScale}"></div><div class="sys-card"><div class="row"><div><strong>Contraste elevado</strong></div><button class="toggle ${state.accessibility.highContrast?"on":""}" data-access="highContrast"></button></div></div><div class="sys-card"><div class="row"><div><strong>Narrador</strong><p>Estado visual apenas.</p></div><button class="toggle ${state.accessibility.narrator?"on":""}" data-access="narrator"></button></div></div><div class="sys-card"><div class="row"><div><strong>Teclas de aderência</strong></div><button class="toggle ${state.accessibility.stickyKeys?"on":""}" data-access="stickyKeys"></button></div></div>`}
  else if(page==="privacy"){box.innerHTML=`<h1>Privacidade e segurança</h1><div class="sys-card clickable" data-open-v5="security"><strong>🛡️ Segurança do Windows</strong><p class="status-ok">Nenhuma ação necessária</p></div><h3>Permissões das aplicações</h3>${["location","camera","microphone","diagnostics"].map(k=>`<div class="sys-card"><div class="row"><div><strong>${({location:"Localização",camera:"Câmara",microphone:"Microfone",diagnostics:"Dados de diagnóstico"})[k]}</strong></div><button class="toggle ${state.privacy[k]?"on":""}" data-privacy="${k}"></button></div></div>`).join("")}`}
  else if(page==="update"){box.innerHTML=renderWindowsUpdatePage()}
  else box.innerHTML="<h1>Definições</h1>";
  box.querySelectorAll("[data-open-v5]").forEach(b=>b.onclick=()=>openApp(b.dataset.openV5));
  box.querySelector("[data-bright]")?.addEventListener("input",e=>{state.brightness=+e.target.value;saveState();applyState()});
  box.querySelector("[data-vol-v5]")?.addEventListener("input",e=>{state.volume=+e.target.value;saveState();applyState()});
  box.querySelectorAll("[data-sys]").forEach(c=>c.onclick=()=>showSystemSubpage(c.dataset.sys));
  box.querySelector("[data-bt-main]")?.addEventListener("click",e=>{state.devices.bluetooth=!state.devices.bluetooth;saveState();renderSettingsPageV5(box,"bluetooth")});
  box.querySelectorAll("[data-bt]").forEach(b=>b.onclick=()=>{const d=state.bluetoothDevices[+b.dataset.bt];if(!d.paired)d.paired=true;else d.connected=!d.connected;saveState();renderSettingsPageV5(box,"bluetooth")});
  box.querySelector("[data-wifi-main]")?.addEventListener("click",()=>{state.quick.wifi=!state.quick.wifi;saveState();syncQuick();renderSettingsPageV5(box,"network")});
  box.querySelectorAll("[data-wifi-net]").forEach(b=>b.onclick=()=>{const i=+b.dataset.wifiNet,n=state.wifiNetworks[i];if(n.connected){n.connected=false}else{state.wifiNetworks.forEach(x=>x.connected=false);n.connected=true;state.quick.wifi=true}saveState();syncQuick();renderSettingsPageV5(box,"network")});
  box.querySelector("[data-theme-v5]")?.addEventListener("click",()=>{state.theme=state.theme==="dark"?"light":"dark";saveState();applyState();renderSettingsPageV5(box,"personalization")});
  const ws=box.querySelector(".wallpapers");if(ws)WALLPAPERS.forEach((bg,i)=>{const b=document.createElement("button");b.className="wallpaper-choice"+(i===state.wallpaper?" active":"");b.style.background=bg;b.onclick=()=>{state.wallpaper=i;saveState();applyState();renderSettingsPageV5(box,"personalization")};ws.appendChild(b)});
  box.querySelector("[data-sync-time]")?.addEventListener("click",()=>notify("Data e hora","Hora sincronizada com o relógio do navegador."));
  box.querySelector("[data-game]")?.addEventListener("click",()=>{state.gameMode=!state.gameMode;saveState();renderSettingsPageV5(box,"gaming")});
  box.querySelector("[data-textscale]")?.addEventListener("input",e=>{
    const value=+e.target.value;
    if(globalThis.Win11SettingsStore)Win11SettingsStore.set("accessibility.textScale",value,{source:"settings-v5-compat"});
    else{state.accessibility.textScale=value;saveState();$("#app").style.fontSize=(value/100*16)+"px"}
  });
  box.querySelectorAll("[data-access]").forEach(b=>b.onclick=()=>{
    const k=b.dataset.access,path="accessibility."+k,next=!state.accessibility[k];
    if(globalThis.Win11SettingsStore&&Win11SettingsStore.validate(path,next))Win11SettingsStore.set(path,next,{source:"settings-v5-compat"});
    else{state.accessibility[k]=next;saveState()}
    renderSettingsPageV5(box,"accessibility");
  });
  box.querySelectorAll("[data-privacy]").forEach(b=>b.onclick=()=>{const k=b.dataset.privacy;state.privacy[k]=!state.privacy[k];saveState();renderSettingsPageV5(box,"privacy")});
  box.querySelector("[data-check-updates]")?.addEventListener("click",()=>startWindowsUpdateCheck(box));
  box.querySelector("[data-update-restart]")?.addEventListener("click",restartSystem);
}
function showSystemSubpage(kind){
  if(kind==="clipboard"){toggleOverlay("clipboard");return}
  if(kind==="storage"){openApp("diskmgmt");return}
  const content={
    notifications:`<h3>Notificações</h3><p>As notificações do sistema virtual estão ${state.privacy.notifications?"ativadas":"desativadas"}.</p><button class="sys-button" id="dlg-toggle-notify">${state.privacy.notifications?"Desativar":"Ativar"}</button>`,
    multitasking:`<h3>Multitarefas</h3><p>Snap Layouts: ativo</p><p>Alt+Tab: ativo</p><p>Ambientes virtuais: ${state.desktops.length}</p><p>Use Win+Tab para gerir ambientes.</p>`,
    power:`<h3>Energia e bateria</h3><div class="power-meter"><div class="battery-shell"><div class="battery-fill" style="width:${state.power.battery}%"></div></div><strong>${state.power.battery}%</strong></div><p>Modo: ${state.power.mode}</p><p>Desligar ecrã: ${state.power.screenOff} min · Suspender: ${state.power.sleep} min</p>`,
  };
  showSystemDialog("Sistema",content[kind]||"<p>Definição virtual.</p>");
  setTimeout(()=>{$("#dlg-toggle-notify")?.addEventListener("click",()=>{state.privacy.notifications=!state.privacy.notifications;saveState();$("#system-dialog").classList.remove("open")})},0);
}
