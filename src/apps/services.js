"use strict";
/* ---------- Services ---------- */
function buildServices(wrap){
  wrap.className="sys-page";
  let selected=null,filter="";
  function render(){
    const items=state.services.filter(s=>(s.display+" "+s.name).toLowerCase().includes(filter));
    wrap.innerHTML=`<h2>Serviços</h2><div class="services-toolbar"><input class="explorer-search" data-service-search placeholder="Pesquisar serviços"><button class="sys-button" data-start-service>Iniciar</button><button class="sys-button" data-stop-service>Parar</button><button class="sys-button" data-restart-service>Reiniciar</button></div>
    <table class="services-table"><thead><tr><th>Nome</th><th>Descrição</th><th>Estado</th><th>Tipo de arranque</th><th>PID</th></tr></thead><tbody>${items.map(s=>`<tr data-service="${s.name}" class="${selected===s.name?"selected":""}"><td>${escapeHTML(s.name)}</td><td>${escapeHTML(s.display)}</td><td class="${s.status==="Running"?"status-running":"status-stopped"}">${s.status==="Running"?"Em execução":"Parado"}</td><td>${escapeHTML(s.startup)}</td><td>${s.pid||""}</td></tr>`).join("")}</tbody></table>`;
    wrap.querySelector("[data-service-search]").value=filter;wrap.querySelector("[data-service-search]").oninput=e=>{filter=e.target.value.toLowerCase();render()};
    wrap.querySelectorAll("[data-service]").forEach(r=>r.onclick=()=>{selected=r.dataset.service;render()});
    wrap.querySelector("[data-start-service]").onclick=()=>changeService("start");
    wrap.querySelector("[data-stop-service]").onclick=()=>changeService("stop");
    wrap.querySelector("[data-restart-service]").onclick=()=>changeService("restart");
  }
  function changeService(action){
    const s=state.services.find(x=>x.name===selected);if(!s)return notify("Serviços","Selecione um serviço.");
    if(action==="stop"){s.status="Stopped";s.pid=0}else{s.status="Running";s.pid=s.pid||1700+(state.services.indexOf(s)*37)}
    saveState();state.events.push({level:"Information",source:"Service Control Manager",id:7036,message:`${s.display}: ${s.status}`,time:Date.now()});saveState();render();
  }render();
}
