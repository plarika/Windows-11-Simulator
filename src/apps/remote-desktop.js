"use strict";
/* ---------- Remote Desktop ---------- */
function buildRemoteDesktop(wrap){
  wrap.className="remote-v5";
  wrap.innerHTML=`<div class="remote-card"><h2>Ligação ao Ambiente de Trabalho Remoto</h2><p>Introduza um nome de computador <strong>fictício</strong>. Esta aplicação não abre ligações RDP reais.</p><label>Computador</label><input data-host value="${escapeHTML(state.remoteDesktop.lastHost||"SIMULATOR-SERVER")}" placeholder="SIMULATOR-SERVER"><div><button class="sys-button primary" data-connect>Ligar</button> <button class="sys-button" data-settings-rdp>Mostrar opções</button></div><div class="remote-preview">Modo seguro: nenhuma ligação TCP/RDP é iniciada pelo simulador.</div></div>`;
  wrap.querySelector("[data-connect]").onclick=()=>{const h=wrap.querySelector("[data-host]").value.trim();state.remoteDesktop.lastHost=h;saveState();showSystemDialog("Ambiente de Trabalho Remoto",`<h3>A ligar a ${escapeHTML(h||"host virtual")}…</h3><p>A sessão foi simulada localmente. Nenhuma rede foi utilizada.</p>`,"Fechar")};
  wrap.querySelector("[data-settings-rdp]").onclick=()=>notify("Remote Desktop","Opções avançadas RDP apresentadas apenas como simulação.");
}
