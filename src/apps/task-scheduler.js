"use strict";
/* ---------- Task Scheduler ---------- */
function buildTaskScheduler(wrap){
  wrap.className="scheduler-tree";
  wrap.innerHTML='<nav class="scheduler-nav"><strong>Biblioteca do Agendador</strong><button class="active">Biblioteca</button><button>Microsoft</button><button>Windows</button><button>FantaMK</button></nav><main class="scheduler-main"></main>';
  const main=wrap.querySelector(".scheduler-main");let selected=null;
  function render(){
    main.innerHTML=`<h2>Agendador de Tarefas</h2><div class="admin-toolbar"><button class="sys-button primary" data-create>Criar tarefa básica</button><button class="sys-button" data-run>Executar</button><button class="sys-button" data-toggle>Ativar/Desativar</button><button class="sys-button danger" data-delete>Eliminar</button></div>
    <table class="admin-table"><thead><tr><th>Nome</th><th>Estado</th><th>Última execução</th><th>Localização</th></tr></thead><tbody>${state.scheduledTasks.map((t,i)=>`<tr data-task="${i}" class="${selected===i?"selected":""}"><td>${escapeHTML(t.name)}</td><td>${t.enabled?escapeHTML(t.status):"Desativada"}</td><td>${t.lastRun?new Date(t.lastRun).toLocaleString("pt-PT"):"Nunca"}</td><td>${escapeHTML(t.folder)}</td></tr>`).join("")}</tbody></table>`;
    main.querySelectorAll("[data-task]").forEach(r=>r.onclick=()=>{selected=+r.dataset.task;render()});
    main.querySelector("[data-create]").onclick=()=>{const n=prompt("Nome da tarefa:","Nova Tarefa");if(!n)return;state.scheduledTasks.push({name:n,folder:"\\FantaMK",enabled:true,status:"Ready",lastRun:0});saveState();render()};
    main.querySelector("[data-run]").onclick=()=>{if(selected==null)return;const t=state.scheduledTasks[selected];t.lastRun=Date.now();t.status="Ready";saveState();notify("Agendador de Tarefas",`${t.name} executada virtualmente.`);render()};
    main.querySelector("[data-toggle]").onclick=()=>{if(selected==null)return;state.scheduledTasks[selected].enabled=!state.scheduledTasks[selected].enabled;saveState();render()};
    main.querySelector("[data-delete]").onclick=()=>{if(selected==null)return;state.scheduledTasks.splice(selected,1);selected=null;saveState();render()};
  }render();
}
