"use strict";
/* ---------- Optional Features ---------- */
function buildOptionalFeatures(wrap){
  wrap.className="sys-page";
  const features=[
    ["dotnet35",".NET Framework 3.5","Inclui .NET 2.0 e 3.0."],["dotnet48",".NET Framework 4.8 Advanced Services","Componente virtual do sistema."],
    ["hyperv","Hyper-V","Hipervisor apresentado apenas como funcionalidade simulada."],["sandbox","Windows Sandbox","Ambiente isolado visual; não inicia virtualização real."],
    ["wsl","Subsistema Windows para Linux","WSL simulado, sem kernel Linux real."],["containers","Contentores","Componentes de contentores virtuais."],
    ["iis","Internet Information Services","Servidor web apenas representado no estado do simulador."],["smb1","SMB 1.0/CIFS","Desativado por defeito."],
    ["media","Funcionalidades de Multimédia","Media Player e componentes."],["xps","XPS Services","Serviço XPS virtual."]
  ];
  function render(){
    wrap.innerHTML=`<h2>Funcionalidades do Windows</h2><p>Ative ou desative componentes do sistema virtual. Algumas alterações pedem reinício simulado.</p><div class="optional-list">${features.map(([k,n,d])=>`<label class="optional-feature"><input class="check-v5" type="checkbox" data-feature="${k}" ${state.optionalFeatures[k]?"checked":""}><div><strong>${n}</strong><p>${d}</p></div><span class="badge">${state.optionalFeatures[k]?"Ativado":"Desativado"}</span></label>`).join("")}</div>`;
    wrap.querySelectorAll("[data-feature]").forEach(cb=>cb.onchange=()=>{state.optionalFeatures[cb.dataset.feature]=cb.checked;saveState();notify("Funcionalidades do Windows","Alteração guardada. Algumas funções requerem reinício virtual.");render()});
  }render();
}
