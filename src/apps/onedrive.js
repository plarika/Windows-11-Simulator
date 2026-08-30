"use strict";
/* ---------- OneDrive ---------- */
function buildOneDrive(wrap){
  wrap.className="onedrive";wrap.innerHTML='<aside><div class="nav-item active">☁️ Os meus ficheiros</div><div class="nav-item">🕘 Recentes</div><div class="nav-item">🗑️ Reciclagem</div></aside><main></main>';
  const main=wrap.querySelector("main");
  function render(){const files=ensureFolder("C:/OneDrive");main.innerHTML=`<div class="cloud-hero"><div class="cloud-icon">☁️</div><div><strong>OneDrive virtual</strong><p>Estado: sincronizado localmente no browser.</p></div></div><div class="admin-toolbar"><button class="sys-button primary" data-upload>Adicionar ficheiro virtual</button><button class="sys-button" data-open-folder>Abrir no Explorador</button></div><div>${Object.keys(files).map(n=>`<div class="sync-item"><span>📄 ${escapeHTML(n)}</span><span class="status-running">✓ Sincronizado</span></div>`).join("")||"<p>A pasta está vazia.</p>"}</div>`;main.querySelector("[data-upload]").onclick=()=>{const n="OneDrive-"+Date.now()+".txt";files[n]="Ficheiro criado no OneDrive virtual.";saveState();render()};main.querySelector("[data-open-folder]").onclick=()=>openApp("explorer","C:/OneDrive")};render();
}
