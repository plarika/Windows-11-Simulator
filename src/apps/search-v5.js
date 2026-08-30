"use strict";
/* ---------- Search aliases ---------- */
function collectSearchResults(q){
  q=q.trim().toLowerCase();if(!q)return [];
  const out=[];
  Object.entries(APPS).forEach(([id,a])=>{const aliases={services:"services.msc serviços",diskmgmt:"diskmgmt gestão discos",taskscheduler:"taskschd agendador tarefas",systeminfo:"msinfo32 informações sistema",resmon:"monitor recursos",powershell:"windows powershell",windowstools:"ferramentas windows administrativas"}[id]||"";if((a.name+" "+id+" "+aliases).toLowerCase().includes(q))out.push({type:"app",id,name:a.name,icon:a.icon,detail:"Aplicação"})});
  [["Sistema","system"],["Bluetooth","bluetooth"],["Rede e Internet","network"],["Personalização","personalization"],["Aplicações","apps"],["Contas","accounts"],["Hora e idioma","time"],["Jogos","gaming"],["Acessibilidade","accessibility"],["Privacidade e segurança","privacy"],["Windows Update","update"]].forEach(([name,page])=>{if(name.toLowerCase().includes(q))out.push({type:"settings",page,name,icon:"⚙️",detail:"Definições"})});
  Object.entries(state.files||{}).forEach(([path,files])=>Object.entries(files||{}).forEach(([name,value])=>{if(name.toLowerCase().includes(q)||String(value).toLowerCase().includes(q))out.push({type:"file",path,name,icon:name.endsWith(".png")?"🖼️":"📄",detail:path})}));
  return out.slice(0,36);
}
