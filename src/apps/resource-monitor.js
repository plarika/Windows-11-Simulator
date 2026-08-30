"use strict";
/* ---------- Resource Monitor ---------- */
function buildResourceMonitor(wrap){
  wrap.className="resmon";wrap.innerHTML='<div class="resmon-tabs"><button class="active" data-res="overview">Descrição Geral</button><button data-res="cpu">CPU</button><button data-res="memory">Memória</button><button data-res="disk">Disco</button><button data-res="network">Rede</button></div><div class="resmon-body"></div>';
  const body=wrap.querySelector(".resmon-body");let tab="overview",timer=null;
  function metric(seed,max=100){return Math.max(0,Math.min(max,Math.round((Math.sin(Date.now()/1700+seed)+1)*max*.25+(seed*7)%20)))}
  function spark(seed){let s="";for(let i=0;i<34;i++)s+=`<i style="height:${10+((seed+i*19+Math.floor(Date.now()/500))%86)}%"></i>`;return s}
  function render(){
    if(!wrap.isConnected){clearInterval(timer);return}
    const cpu=metric(2,55),mem=42,disk=metric(5,25),net=metric(8,18);
    if(tab==="overview")body.innerHTML=`<div class="resmon-summary"><div class="resmon-card"><strong>CPU</strong><div class="value">${cpu}%</div><div class="spark">${spark(2)}</div></div><div class="resmon-card"><strong>Memória</strong><div class="value">${mem}%</div><div class="spark">${spark(6)}</div></div><div class="resmon-card"><strong>Disco</strong><div class="value">${disk}%</div><div class="spark">${spark(10)}</div></div><div class="resmon-card"><strong>Rede</strong><div class="value">${net} Kbps</div><div class="spark">${spark(14)}</div></div></div><h3>Processos</h3>${resourceProcessTable()}`;
    else if(tab==="cpu")body.innerHTML=`<h2>CPU</h2><div class="resmon-card"><div class="value">${cpu}%</div><div class="spark" style="height:150px">${spark(21)}</div></div>${resourceProcessTable()}`;
    else if(tab==="memory")body.innerHTML=`<h2>Memória</h2><div class="resmon-card"><div class="value">3.4 GB / 8.0 GB</div><div class="sys-progress"><i style="width:${mem}%"></i></div><p>Em utilização: 42% · Disponível: 4.6 GB virtual</p></div>${resourceProcessTable()}`;
    else if(tab==="disk")body.innerHTML=`<h2>Disco</h2><div class="resmon-card"><div class="value">${disk}%</div><p>Atividade de E/S virtual.</p><div class="spark" style="height:130px">${spark(30)}</div></div>${resourceProcessTable()}`;
    else body.innerHTML=`<h2>Rede</h2><div class="resmon-card"><div class="value">${net} Kbps</div><p>${state.quick.wifi?"SIMULATOR-NET ligado":"Wi-Fi desligado"}</p><div class="spark" style="height:130px">${spark(40)}</div></div>${resourceProcessTable()}`;
  }
  wrap.querySelectorAll("[data-res]").forEach(b=>b.onclick=()=>{tab=b.dataset.res;wrap.querySelectorAll("[data-res]").forEach(x=>x.classList.toggle("active",x===b));render()});render();timer=setInterval(render,1600);
}
function resourceProcessTable(){
  const rows=$$(".window").filter(w=>Number(w.dataset.desktop||0)===Number(state.currentDesktop)).map(w=>`<tr><td>${escapeHTML(APPS[w.dataset.app]?.name||w.dataset.app)}</td><td>${w.dataset.pid}</td><td>${((Number(w.dataset.pid)%23)/10+0.2).toFixed(1)}%</td><td>${40+(Number(w.dataset.pid)%120)} MB</td></tr>`).join("");
  return `<table class="admin-table"><tr><th>Processo</th><th>PID</th><th>CPU</th><th>Memória</th></tr>${rows||'<tr><td colspan="4">Sem processos.</td></tr>'}</table>`;
}
