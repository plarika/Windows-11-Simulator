"use strict";
/* ---------- Windows Tools ---------- */
function buildWindowsTools(wrap){
  wrap.className="sys-page";
  const tools=[
    ["services","⚙️","Serviços","Iniciar, parar e configurar serviços virtuais."],
    ["diskmgmt","💽","Gestão de Discos","Volumes e partições virtuais."],
    ["taskscheduler","🗓️","Agendador de Tarefas","Tarefas automáticas virtuais."],
    ["systeminfo","ℹ️","Informações do Sistema","Hardware e ambiente do simulador."],
    ["resmon","📈","Monitor de Recursos","CPU, memória, disco e rede virtuais."],
    ["eventviewer","📜","Visualizador de Eventos","Registos de eventos do simulador."],
    ["registry","🧱","Editor de Registo","Registry exclusivamente virtual."],
    ["devicemanager","🧩","Gestor de Dispositivos","Dispositivos virtuais."],
    ["controlpanel","🎛️","Painel de Controlo","Interface clássica simulada."],
    ["powershell","🔷","Windows PowerShell","Shell PowerShell virtual e segura."],
    ["backup","💾","Cópia de Segurança","Snapshots locais do simulador."],
    ["optionalfeatures","▦","Funcionalidades do Windows","Componentes opcionais virtuais."]
  ];
  wrap.innerHTML=`<h2>Ferramentas do Windows</h2><p>Consolas administrativas simuladas e isoladas do sistema real.</p><div class="tools-grid">${tools.map(([id,ic,n,d])=>`<div class="tool-card" data-tool="${id}"><div class="tool-icon">${ic}</div><strong>${n}</strong><p>${d}</p></div>`).join("")}</div>`;
  wrap.querySelectorAll("[data-tool]").forEach(c=>c.onclick=()=>openApp(c.dataset.tool));
}
