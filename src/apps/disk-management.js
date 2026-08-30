"use strict";
/* ---------- Disk Management ---------- */
function buildDiskManagement(wrap){
  wrap.className="sys-page";let selected=null;
  function render(){
    wrap.innerHTML=`<h2>Gestão de Discos</h2><div class="admin-toolbar"><button class="sys-button" data-refresh>Atualizar</button><button class="sys-button" data-newvol>Novo Volume Simples</button><button class="sys-button" data-format>Formatar</button></div><p style="font-size:12px;color:#68717b">Todos os discos e volumes são modelos virtuais; nenhuma operação toca no armazenamento real.</p><div class="disk-canvas">${state.disks.map((d,di)=>`<div class="disk-row-v5"><div class="disk-label"><strong>${escapeHTML(d.name)}</strong>${d.type}<br>${d.size} GB<br>${d.online?"Online":"Offline"}</div><div class="partition-strip">${d.partitions.map((p,pi)=>`<div class="partition ${p.type==="unallocated"?"unallocated":""} ${selected===di+":"+pi?"selected":""}" data-part="${di}:${pi}" style="flex:${Math.max(.4,p.size/d.size*6)}"><strong>${escapeHTML(p.name)}</strong>${p.letter?escapeHTML(p.letter)+"<br>":""}${p.size} GB<br>${escapeHTML(p.fs||"Não alocado")}</div>`).join("")}</div></div>`).join("")}</div>`;
    wrap.querySelectorAll("[data-part]").forEach(p=>p.onclick=()=>{selected=p.dataset.part;render()});
    wrap.querySelector("[data-refresh]").onclick=render;
    wrap.querySelector("[data-newvol]").onclick=()=>{
      if(!selected)return notify("Gestão de Discos","Selecione espaço não alocado.");
      const [di,pi]=selected.split(":").map(Number),part=state.disks[di]?.partitions[pi];if(!part||part.type!=="unallocated")return notify("Gestão de Discos","Selecione uma região Não alocado.");
      const size=Math.max(1,Math.round(part.size/2*10)/10),letter=nextDriveLetter();part.size=Math.round((part.size-size)*10)/10;
      state.disks[di].partitions.splice(pi,0,{name:"Novo Volume",letter,size,fs:"NTFS",type:"primary"});if(part.size<.5)state.disks[di].partitions=state.disks[di].partitions.filter(x=>x.size>=.5);
      saveState();notify("Gestão de Discos",`${letter} criado virtualmente.`);selected=null;render();
    };
    wrap.querySelector("[data-format]").onclick=()=>{
      if(!selected)return;const [di,pi]=selected.split(":").map(Number),p=state.disks[di]?.partitions[pi];if(!p||p.type==="unallocated"||p.type==="system")return notify("Gestão de Discos","Este volume não pode ser formatado nesta simulação.");
      showSystemDialog("Formatar volume",`<p>Formatar <strong>${escapeHTML(p.letter||p.name)}</strong> como NTFS?</p><p>Isto altera apenas o modelo virtual do disco.</p>`,"Formatar",()=>{p.fs="NTFS";p.name=p.name||"Novo Volume";saveState();notify("Gestão de Discos","Formatação virtual concluída.");render()});
    };
  }render();
}
function nextDriveLetter(){
  const used=new Set(state.disks.flatMap(d=>d.partitions.map(p=>p.letter)).filter(Boolean).map(x=>x[0]));
  for(const c of "EFGHIJKLMNOPQRSTUVWXYZ")if(!used.has(c))return c+":";
  return "Z:";
}
