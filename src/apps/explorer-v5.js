"use strict";
/* ---------- Explorer V5: copy/cut/paste, folders, sorting, DnD ---------- */
function vfsImmediateFolders(path){
  const prefix=path+"/";
  return Object.keys(state.files).filter(p=>p.startsWith(prefix)&&!p.slice(prefix.length).includes("/")).map(p=>p.slice(prefix.length));
}
function vfsCopyFile(srcPath,name,dstPath,move=false){
  if(srcPath===dstPath)return false;
  const src=ensureFolder(srcPath),dst=ensureFolder(dstPath);
  if(!(name in src))return false;
  let target=name,i=1;
  while(target in dst){const dot=name.lastIndexOf(".");target=dot>0?`${name.slice(0,dot)} (${++i})${name.slice(dot)}`:`${name} (${++i})`}
  dst[target]=structuredCloneSafe(src[name]);
  if(move)delete src[name];
  saveState();return true;
}
function structuredCloneSafe(v){try{return structuredClone(v)}catch{try{return JSON.parse(JSON.stringify(v))}catch{return String(v)}}}
function vfsCopyFolder(srcFolder,dstParent,move=false){
  const name=srcFolder.split("/").pop(),dstFolder=dstParent+"/"+name;
  if(state.files[dstFolder])return false;
  const paths=Object.keys(state.files).filter(p=>p===srcFolder||p.startsWith(srcFolder+"/")).sort((a,b)=>a.length-b.length);
  paths.forEach(p=>{const rel=p.slice(srcFolder.length);state.files[dstFolder+rel]=structuredCloneSafe(state.files[p])});
  if(move)paths.sort((a,b)=>b.length-a.length).forEach(p=>delete state.files[p]);
  saveState();return true;
}
function buildExplorerV5(wrap,win,startPath){
  wrap.className="explorer-v4";
  wrap.innerHTML=`<aside>
    <div class="nav-item" data-path="This PC">🖥️ Este PC</div>
    <div class="nav-item" data-path="C:/Desktop">▣ Ambiente de Trabalho</div>
    <div class="nav-item" data-path="C:/Documents">📄 Documentos</div>
    <div class="nav-item" data-path="C:/Downloads">⬇️ Transferências</div>
    <div class="nav-item" data-path="C:/OneDrive">☁️ OneDrive</div>
    <div class="nav-item" data-path="C:/Pictures">🖼️ Imagens</div>
    <div class="nav-item" data-path="C:/Music">🎵 Música</div>
    <div class="nav-item" data-path="C:/Videos">🎬 Vídeos</div>
    <div class="nav-item" data-path="Recycle Bin">🗑️ Reciclagem</div>
  </aside><main>
    <div class="explorer-command">
      <button data-new>＋ Novo</button><button data-cut>✂ Cortar</button><button data-copy>⧉ Copiar</button><button data-paste>📋 Colar</button><button data-rename>✎ Mudar nome</button><button data-delete>🗑 Eliminar</button>
      <span style="flex:1"></span><button data-sort>↕ Ordenar</button><button data-icons class="active">▦ Ícones</button><button data-list>☷ Detalhes</button>
    </div>
    <div class="explorer-address"><button data-back>←</button><button data-forward>→</button><button data-up>↑</button><div class="pathbar"></div><input class="explorer-search" placeholder="Pesquisar nesta pasta"></div>
    <div class="explorer-files"><div class="file-grid"></div></div>
  </main>`;
  let path=startPath||"This PC",history=[path],idx=0,view="icons",selected=null,query="",sortMode="name";
  const grid=wrap.querySelector(".file-grid"),pathbar=wrap.querySelector(".pathbar"),search=wrap.querySelector(".explorer-search");
  function currentFiles(){return path==="This PC"?{}:ensureFolder(path)}
  function nav(p,push=true){
    if(p!=="This PC")ensureFolder(p);path=p;selected=null;
    if(push){history=history.slice(0,idx+1);history.push(p);idx++}
    pathbar.textContent=p;wrap.querySelectorAll("[data-path]").forEach(n=>n.classList.toggle("active",n.dataset.path===p));render();
  }
  function itemsForPath(){
    if(path==="This PC")return [];
    if(path==="Recycle Bin"){
      return Object.entries(ensureFolder(path)).map(([name,value])=>({name,type:"recycle",value}));
    }
    const folders=vfsImmediateFolders(path).map(name=>({name,type:"folder",value:null}));
    const files=Object.entries(ensureFolder(path)).map(([name,value])=>({name,type:"file",value}));
    let items=[...folders,...files];
    if(query)items=items.filter(x=>x.name.toLowerCase().includes(query));
    items.sort((a,b)=>sortMode==="type"?(a.type+a.name).localeCompare(b.type+b.name):a.name.localeCompare(b.name,undefined,{numeric:true}));
    return items;
  }
  function render(){
    grid.innerHTML="";
    if(path==="This PC"){renderThisPCV5(grid,nav);return}
    const items=itemsForPath();
    grid.className=view==="details"?"file-list":"file-grid";
    items.forEach(item=>{
      const icon=item.type==="folder"?"📁":item.type==="recycle"?"🗑️":item.name.endsWith(".png")?"🖼️":"📄";
      const el=document.createElement(view==="details"?"div":"button");
      if(view==="details"){
        el.className="file-row";
        const val=item.type==="recycle"?item.value?.content:item.value;
        el.innerHTML=`<div class="fname"><span>${icon}</span><span>${escapeHTML(item.name)}</span></div><div class="meta">${item.type==="folder"?"Pasta":item.type==="recycle"?"Item eliminado":item.name.endsWith(".png")?"Imagem PNG":"Documento"}</div><div class="meta">${item.type==="folder"?"":formatBytes(fileSize(val))}</div>`;
      }else{
        el.className="file";el.innerHTML=`<span class="icon">${icon}</span><div class="file-name">${escapeHTML(item.name)}</div>`;
      }
      el.draggable=item.type!=="recycle";
      el.ondragstart=e=>{e.dataTransfer.setData("text/plain",JSON.stringify({path,name:item.name,type:item.type}));e.dataTransfer.effectAllowed="copyMove"};
      if(item.type==="folder"){
        el.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect=e.ctrlKey?"copy":"move"};
        el.ondrop=e=>{e.preventDefault();try{const d=JSON.parse(e.dataTransfer.getData("text/plain"));const dest=path+"/"+item.name;if(d.type==="file")vfsCopyFile(d.path,d.name,dest,!e.ctrlKey);else if(d.type==="folder")vfsCopyFolder(d.path+"/"+d.name,dest,!e.ctrlKey);render();notify("Explorador",e.ctrlKey?"Item copiado.":"Item movido.")}catch{}};
      }
      el.onclick=()=>{selected=item;grid.querySelectorAll(".selected").forEach(x=>x.classList.remove("selected"));el.classList.add("selected")};
      el.ondblclick=()=>{
        if(item.type==="folder")nav(path+"/"+item.name);
        else if(item.type==="recycle")showFileProperties(item.value?.originalPath||"",item.name,item.value?.content);
        else openFile(path,item.name,item.value);
      };
      el.oncontextmenu=e=>{e.preventDefault();selected=item;const menu=[];
        if(item.type==="recycle"){
          menu.push(["Restaurar",()=>{restoreFile(item.name);render()}],["Eliminar permanentemente",async()=>{const bin=ensureFolder("Recycle Bin"),doomed=bin[item.name]?.content;if(doomed&&globalThis.RealContentBridge?.cleanupVirtualValue)await RealContentBridge.cleanupVirtualValue(doomed);delete bin[item.name];saveState();render()}],["Propriedades",()=>showFileProperties(item.value?.originalPath||"",item.name,item.value?.content)]);
        }else{
          menu.push(["Abrir",()=>item.type==="folder"?nav(path+"/"+item.name):openFile(path,item.name,item.value)]);
          menu.push(["Copiar",()=>{state.fileClipboard={mode:"copy",path,name:item.name,type:item.type};saveState();notify("Explorador","Copiado para a área de transferência de ficheiros.")}]);
          menu.push(["Cortar",()=>{state.fileClipboard={mode:"cut",path,name:item.name,type:item.type};saveState();notify("Explorador","Pronto para mover.")}]);
          menu.push(["Mudar nome",()=>renameSelected()]);
          menu.push(["Eliminar",()=>deleteSelected()]);
          if(item.type==="file")menu.push(["Propriedades",()=>showFileProperties(path,item.name,item.value)]);
        }
        showContext(e.clientX,e.clientY,menu);
      };
      grid.appendChild(el);
    });
    if(!items.length)grid.innerHTML='<p>Esta pasta está vazia.</p>';
  }
  function renameSelected(){
    if(!selected||selected.type==="recycle")return;
    const next=prompt("Novo nome:",selected.name);if(!next||next===selected.name)return;
    if(selected.type==="file"){const files=ensureFolder(path);if(next in files)return notify("Explorador","Esse nome já existe.");files[next]=files[selected.name];delete files[selected.name]}
    else{
      const old=path+"/"+selected.name,neu=path+"/"+next;if(state.files[neu])return notify("Explorador","Essa pasta já existe.");
      const paths=Object.keys(state.files).filter(p=>p===old||p.startsWith(old+"/")).sort((a,b)=>a.length-b.length);
      paths.forEach(p=>{const rel=p.slice(old.length);state.files[neu+rel]=state.files[p]});paths.sort((a,b)=>b.length-a.length).forEach(p=>delete state.files[p]);
    }
    selected=null;saveState();render();
  }
  async function deleteSelected(){
    if(!selected)return;
    if(selected.type==="recycle"){
      const bin=ensureFolder("Recycle Bin"),doomed=bin[selected.name]?.content;
      if(doomed&&globalThis.RealContentBridge?.cleanupVirtualValue)await RealContentBridge.cleanupVirtualValue(doomed);
      delete bin[selected.name];saveState();render();return;
    }
    if(selected.type==="file"){
      const files=ensureFolder(path),bin=ensureFolder("Recycle Bin");let name=selected.name,i=1;
      while(bin[name])name=`${selected.name} (${++i})`;
      bin[name]={content:files[selected.name],originalPath:path};delete files[selected.name];
    }else{
      const folder=path+"/"+selected.name;
      if(globalThis.RealContentBridge?.cleanupVirtualFolder)await RealContentBridge.cleanupVirtualFolder(folder);
      deleteFolder(folder,path,grid,nav);
    }
    selected=null;saveState();render();
  }
  function paste(){
    if(!state.fileClipboard||path==="This PC"||path==="Recycle Bin")return;
    const c=state.fileClipboard,move=c.mode==="cut";
    const ok=c.type==="folder"?vfsCopyFolder(c.path+"/"+c.name,path,move):vfsCopyFile(c.path,c.name,path,move);
    if(ok&&move)state.fileClipboard=null;saveState();render();notify("Explorador",ok?"Operação concluída.":"Não foi possível concluir.");
  }
  wrap.querySelectorAll("[data-path]").forEach(n=>n.onclick=()=>nav(n.dataset.path));
  wrap.querySelector("[data-back]").onclick=()=>{if(idx>0){idx--;nav(history[idx],false)}};
  wrap.querySelector("[data-forward]").onclick=()=>{if(idx<history.length-1){idx++;nav(history[idx],false)}};
  wrap.querySelector("[data-up]").onclick=()=>{if(path==="This PC"||path==="Recycle Bin")return;const parts=path.split("/");if(parts.length<=2)nav("This PC");else{parts.pop();nav(parts.join("/"))}};
  wrap.querySelector("[data-new]").onclick=e=>{if(path==="This PC"||path==="Recycle Bin")return;showContext(e.clientX,e.clientY,[["Pasta",()=>{let n="Nova pasta",i=1;while(state.files[path+"/"+n])n=`Nova pasta (${++i})`;ensureFolder(path+"/"+n);saveState();render()}],["Documento de texto",()=>{const files=ensureFolder(path);let n="Novo Documento de Texto.txt",i=1;while(n in files)n=`Novo Documento de Texto (${++i}).txt`;files[n]="";saveState();render()}]])};
  wrap.querySelector("[data-copy]").onclick=()=>{if(selected&&selected.type!=="recycle"){state.fileClipboard={mode:"copy",path,name:selected.name,type:selected.type};saveState()}};
  wrap.querySelector("[data-cut]").onclick=()=>{if(selected&&selected.type!=="recycle"){state.fileClipboard={mode:"cut",path,name:selected.name,type:selected.type};saveState()}};
  wrap.querySelector("[data-paste]").onclick=paste;
  wrap.querySelector("[data-rename]").onclick=renameSelected;
  wrap.querySelector("[data-delete]").onclick=deleteSelected;
  wrap.querySelector("[data-sort]").onclick=()=>{sortMode=sortMode==="name"?"type":"name";render()};
  wrap.querySelector("[data-icons]").onclick=()=>{view="icons";wrap.querySelector("[data-icons]").classList.add("active");wrap.querySelector("[data-list]").classList.remove("active");render()};
  wrap.querySelector("[data-list]").onclick=()=>{view="details";wrap.querySelector("[data-list]").classList.add("active");wrap.querySelector("[data-icons]").classList.remove("active");render()};
  search.oninput=e=>{query=e.target.value.trim().toLowerCase();render()};
  win.addEventListener("navigate",e=>nav(e.detail));nav(path,false);
}
function renderThisPCV5(grid,nav){
  grid.className="thispc-grid";
  const drives=[{name:"Disco Local (C:)",icon:"💽",used:46,total:"128 GB",path:"C:/Documents"},{name:"Dados (D:)",icon:"💾",used:30,total:"256 GB",path:"C:/Downloads"},{name:"OneDrive",icon:"☁️",used:12,total:"5 GB",path:"C:/OneDrive"}];
  drives.forEach(d=>{const c=document.createElement("div");c.className="drive-card";c.innerHTML=`<div style="font-size:26px">${d.icon}</div><strong>${d.name}</strong><div style="font-size:12px;color:#68717b;margin-top:4px">${100-d.used}% livre de ${d.total} · virtual</div><div class="drive-bar"><i style="width:${d.used}%"></i></div>`;c.onclick=()=>nav(d.path);grid.appendChild(c)});
}
