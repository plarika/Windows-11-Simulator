"use strict";
/* ---------- System Information ---------- */
function buildSystemInfo(wrap){
  wrap.className="info-layout";
  const sections=["Resumo do Sistema","Recursos de Hardware","Componentes","Ambiente de Software"];
  wrap.innerHTML=`<nav class="info-nav">${sections.map((s,i)=>`<button data-info="${i}" class="${i===0?"active":""}">${s}</button>`).join("")}</nav><main class="info-main"></main>`;
  const main=wrap.querySelector(".info-main");
  const data=[
    [["Nome do SO","Microsoft Windows 11 Simulator"],["Versão","24H2 virtual"],["Compilação",state.update.version],["Fabricante do SO","FantaMK Simulator"],["Nome do sistema","SIMULATOR-PC"],["Fabricante do sistema","Browser Virtual Hardware"],["Modelo do sistema","Web Desktop"],["Tipo de sistema","x64-based virtual browser"],["Processador","Virtual CPU @ 3.40 GHz"],["Memória física instalada","8.00 GB virtual"],["Modo BIOS","UEFI virtual"],["Inicialização Segura","Ativada (simulada)"]],
    [["Memória","8 GB virtual"],["IRQ","Virtualizados"],["DMA","Não aplicável"],["Conflitos/Partilha","Nenhum conflito virtual"]],
    [["Ecrã","Microsoft Basic Display Adapter"],["Som","High Definition Audio Device"],["Rede","Virtual Ethernet Adapter"],["Armazenamento","Disco 0 / Disco 1 virtuais"],["USB","Controlador USB virtual"],["Bluetooth","Generic Bluetooth Adapter"]],
    [["Processos em execução",String($$(".window").length)],["Serviços",String(state.services.length)],["Tarefas agendadas",String(state.scheduledTasks.length)],["Ambientes virtuais",String(state.desktops.length)],["Ficheiros virtuais",String(Object.values(state.files).reduce((n,f)=>n+Object.keys(f).length,0))]]
  ];
  function show(i){wrap.querySelectorAll("[data-info]").forEach(b=>b.classList.toggle("active",+b.dataset.info===i));main.innerHTML=`<h2>${sections[i]}</h2><table class="info-table">${data[i].map(([k,v])=>`<tr><td>${escapeHTML(k)}</td><td>${escapeHTML(v)}</td></tr>`).join("")}</table>`}
  wrap.querySelectorAll("[data-info]").forEach(b=>b.onclick=()=>show(+b.dataset.info));show(0);
}
