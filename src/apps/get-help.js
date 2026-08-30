"use strict";
/* ---------- Get Help ---------- */
function buildGetHelp(wrap){
  wrap.className="help-v5";
  const faqs=[
    ["Como abrir o Gestor de Tarefas?","Use Ctrl+Shift+Esc ou procure Gestor de Tarefas no Iniciar."],
    ["Como usar a Área de Transferência?","Use Win+V. O histórico virtual pode agora importar e exportar texto para a área de transferência real do dispositivo, sempre após uma ação explícita do utilizador."],
    ["O Terminal executa comandos reais?","Não. CMD e PowerShell são interpretadores virtuais isolados."],
    ["Posso alterar discos reais?","Não. Gestão de Discos trabalha apenas sobre objetos virtuais."],
    ["O Windows Update é real?","Não. A sequência de procura, transferência e reinício é simulada."]
  ];
  wrap.innerHTML=`<h2>Obter Ajuda</h2><p>Suporte integrado do Windows Simulator.</p><div class="help-search"><input placeholder="Descreva o problema"><button class="sys-button primary">Pesquisar</button></div><div>${faqs.map(([q,a])=>`<div class="faq"><strong>${q}</strong><p>${a}</p></div>`).join("")}</div>`;
}
