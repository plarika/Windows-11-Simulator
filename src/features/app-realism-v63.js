"use strict";
/* Windows 11 Simulator V6.3 — App Realism */
(function installAppRealismV63(){
  const realIcon=(id,extra="")=>{
    if(globalThis.Win11Realism?.iconFor) return Win11Realism.iconFor(id,extra);
    return '<span class="real-app-icon '+extra+'">'+(APPS[id]?.icon||"▦")+'</span>';
  };

  function appIdFromName(name){
    return Object.entries(APPS).find(([,a])=>a.name===name)?.[0]||"default";
  }

  /* -------- Windows-style virtual Open / Save dialog -------- */
  globalThis.showVirtualFileDialog=function(options={}){
    const mode=options.mode==="save"?"save":"open";
    const accept=options.accept||".txt";
    const folders=options.folders||["C:/Documents","C:/Desktop","C:/Downloads"];
    let current=options.path||folders[0];
    let selected="";
    const dialog=$("#system-dialog");
    const title=$("#system-dialog-title"),body=$("#system-dialog-body"),ok=$("#system-dialog-ok");
    title.textContent=mode==="save"?"Guardar como":"Abrir";
    function render(){
      const files=ensureFolder(current);
      const names=Object.keys(files).filter(n=>!accept||accept==="*"||n.toLowerCase().endsWith(accept.toLowerCase()));
      body.innerHTML=
        '<div class="file-dialog-toolbar"><select data-dialog-folder class="file-dialog-field">'+
        folders.map(f=>'<option value="'+escapeHTML(f)+'" '+(f===current?"selected":"")+'>'+escapeHTML(f)+'</option>').join("")+
        '</select></div><div class="file-dialog-list">'+
        names.map(n=>'<div class="file-dialog-row '+(n===selected?"selected":"")+'" data-dialog-file="'+escapeHTML(n)+'"><span>📄</span><div class="file-dialog-name">'+escapeHTML(n)+'</div><div class="file-dialog-path">'+escapeHTML(current)+'</div></div>').join("")+
        (names.length?"":'<div style="padding:18px;color:#6d7680">Nenhum ficheiro compatível.</div>')+
        '</div>'+
        (mode==="save"?'<label style="display:block;font-size:11px;margin-bottom:4px">Nome do ficheiro</label><input data-dialog-name class="file-dialog-field" value="'+escapeHTML(options.defaultName||"Documento.txt")+'">':"");
      body.querySelector("[data-dialog-folder]").onchange=e=>{current=e.target.value;selected="";render()};
      body.querySelectorAll("[data-dialog-file]").forEach(r=>{
        r.onclick=()=>{
          selected=r.dataset.dialogFile;
          body.querySelectorAll("[data-dialog-file]").forEach(x=>x.classList.toggle("selected",x.dataset.dialogFile===selected));
        };
        r.ondblclick=()=>{selected=r.dataset.dialogFile;finish()};
      });
    }
    function finish(){
      let name=mode==="save"?(body.querySelector("[data-dialog-name]")?.value||"").trim():selected;
      if(!name){notify(mode==="save"?"Guardar":"Abrir","Selecione ou indique um ficheiro.");return}
      name=name.replace(/[\\/:*?"<>|]/g,"_");
      if(mode==="save"&&accept&&accept.startsWith(".")&&!name.toLowerCase().endsWith(accept.toLowerCase()))name+=accept;
      dialog.classList.remove("open");
      options.onSelect?.({path:current,name,value:ensureFolder(current)[name]});
    }
    ok.textContent=mode==="save"?"Guardar":"Abrir";
    ok.onclick=finish;
    dialog.classList.add("open");
    render();
  };

  /* -------- Notepad: native-style dialogs -------- */
  globalThis.buildNotepadV5=function(wrap){
    wrap.className="notepad";
    wrap.innerHTML='<div class="app-toolbar"><button data-new>Novo</button><button data-open>Abrir</button><button data-save>Guardar</button><button data-saveas>Guardar como</button><span style="width:1px;height:22px;background:#d9dde2;margin:0 3px"></span><button data-copy>Copiar</button><button data-cut>Cortar</button><button data-paste>Colar</button><span style="flex:1"></span><button data-time>Hora/Data</button></div><textarea spellcheck="false"></textarea>';
    const ta=wrap.querySelector("textarea");
    ta.value=state.notepadText||"";
    let current={path:"C:/Documents",name:"Notas.txt"};
    ta.oninput=()=>{state.notepadText=ta.value;saveState()};
    wrap.querySelector("[data-new]").onclick=()=>{ta.value="";current={path:"C:/Documents",name:"Sem título.txt"};state.notepadText="";saveState()};
    wrap.querySelector("[data-open]").onclick=()=>showVirtualFileDialog({mode:"open",accept:".txt",onSelect:f=>{ta.value=String(f.value??"");state.notepadText=ta.value;current={path:f.path,name:f.name};touchRecent(f.path+"/"+f.name);saveState()}});
    wrap.querySelector("[data-save]").onclick=()=>{ensureFolder(current.path)[current.name]=ta.value;touchRecent(current.path+"/"+current.name);saveState();notify("Bloco de Notas",current.name+" guardado.")};
    wrap.querySelector("[data-saveas]").onclick=()=>showVirtualFileDialog({mode:"save",accept:".txt",defaultName:current.name==="Sem título.txt"?"Documento.txt":current.name,onSelect:f=>{ensureFolder(f.path)[f.name]=ta.value;current={path:f.path,name:f.name};touchRecent(f.path+"/"+f.name);saveState();notify("Bloco de Notas",f.name+" guardado.")}});
    wrap.querySelector("[data-copy]").onclick=()=>{const a=ta.selectionStart,b=ta.selectionEnd;addClipboard(ta.value.slice(a,b)||ta.value)};
    wrap.querySelector("[data-cut]").onclick=()=>{const a=ta.selectionStart,b=ta.selectionEnd;if(a===b)return;addClipboard(ta.value.slice(a,b));ta.setRangeText("",a,b,"start");state.notepadText=ta.value;saveState()};
    wrap.querySelector("[data-paste]").onclick=()=>{const text=(state.clipboard||[])[0]||"";ta.setRangeText(text,ta.selectionStart,ta.selectionEnd,"end");state.notepadText=ta.value;saveState()};
    wrap.querySelector("[data-time]").onclick=()=>{ta.setRangeText(new Date().toLocaleString("pt-PT"),ta.selectionStart,ta.selectionEnd,"end");state.notepadText=ta.value;saveState()};
  };

  /* -------- Explorer: preserve V5 logic, improve chrome -------- */
  const explorerV5=globalThis.buildExplorerV5;
  globalThis.buildExplorerV5=function(wrap,win,startPath){
    explorerV5(wrap,win,startPath);
    wrap.className="explorer-real";
    const main=wrap.querySelector("main");
    const command=wrap.querySelector(".explorer-command");
    const address=wrap.querySelector(".explorer-address");
    const files=wrap.querySelector(".explorer-files");
    const search=wrap.querySelector(".explorer-search");
    command?.classList.add("real");
    address?.classList.add("real");
    files?.classList.add("real");
    search?.classList.add("real");

    if(main){
      const tabs=document.createElement("div");
      tabs.className="explorer-tabs";
      tabs.innerHTML='<button class="explorer-tab"><span>📁</span><span data-explorer-tab-title>Explorador de Ficheiros</span></button><button class="edge-new-tab" data-new-explorer title="Novo separador">＋</button>';
      main.prepend(tabs);
      tabs.querySelector("[data-new-explorer]").onclick=()=>makeWindow("explorer","This PC");
    }

    if(command){
      const replacements=[
        ["[data-new]","＋","Novo"],["[data-cut]","✂","Cortar"],["[data-copy]","▣","Copiar"],["[data-paste]","▤","Colar"],
        ["[data-rename]","✎","Mudar nome"],["[data-delete]","⌫","Eliminar"],["[data-sort]","↕","Ordenar"],
        ["[data-icons]","▦","Ver"],["[data-list]","☷","Detalhes"]
      ];
      replacements.forEach(([sel,ic,label])=>{const b=command.querySelector(sel);if(b)b.innerHTML='<span class="cmd-icon">'+ic+'</span><span class="cmd-label">'+label+'</span>'});
    }

    const pathbar=wrap.querySelector(".pathbar");
    const status=document.createElement("div");
    status.className="explorer-status";
    files?.appendChild(status);

    let pathObserver=null;
    function updateBreadcrumb(){
      if(!pathbar)return;
      const raw=pathbar.textContent.trim()||startPath||"This PC";
      const title=wrap.querySelector("[data-explorer-tab-title]");
      if(title)title.textContent=raw==="This PC"?"Este PC":raw.split("/").pop()||"Explorador";
      const parts=raw==="This PC"?["Este PC"]:raw.split("/");
      if(pathObserver)pathObserver.disconnect();
      pathbar.innerHTML="";
      parts.forEach((part,i)=>{
        const b=document.createElement("button");b.className="crumb";b.textContent=part==="C:"?"Este PC":part;
        b.onclick=()=>{
          let target;
          if(raw==="This PC"||i===0&&part==="C:")target=i===0&&parts.length===1?"This PC":"C:/"+parts.slice(1,i+1).join("/");
          else target=parts.slice(0,i+1).join("/");
          win.dispatchEvent(new CustomEvent("navigate",{detail:target||"This PC"}));
        };
        pathbar.appendChild(b);
        if(i<parts.length-1){const sep=document.createElement("span");sep.className="crumb-sep";sep.textContent="›";pathbar.appendChild(sep)}
      });
      if(pathObserver)pathObserver.observe(pathbar,{childList:true,subtree:true,characterData:true});
    }
    function updateStatus(){
      const grid=wrap.querySelector(".file-grid,.file-list");
      if(!grid||!status)return;
      const count=[...grid.children].filter(x=>x!==status&&!x.classList.contains("header")&&x.matches(".file,.file-row,.drive-card")).length;
      const selected=grid.querySelectorAll(".selected").length;
      status.innerHTML='<span>'+count+' item'+(count===1?"":"s")+'</span><span>'+(selected?selected+" selecionado":"Windows 11 Simulator")+'</span>';
      if(grid.classList.contains("file-list")&&!grid.querySelector(".file-row.header")){
        const h=document.createElement("div");h.className="file-row header";h.innerHTML='<div>Nome</div><div>Tipo</div><div>Tamanho</div><div>Data de modificação</div>';grid.prepend(h);
      }
    }

    pathObserver=new MutationObserver(()=>{updateBreadcrumb();updateStatus()});
    if(pathbar)pathObserver.observe(pathbar,{childList:true,subtree:true,characterData:true});
    const grid=wrap.querySelector(".file-grid");
    const gridObserver=new MutationObserver(()=>{updateStatus()});
    if(grid)gridObserver.observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    updateBreadcrumb();updateStatus();
  };

  /* -------- Settings: add header/search/device identity -------- */
  const settingsV5=globalThis.buildSettingsV5;
  globalThis.buildSettingsV5=function(wrap){
    settingsV5(wrap);
    const main=wrap.querySelector(".settings-main-v4");
    const page=wrap.querySelector("[data-settings-page]");
    if(!main||!page)return;
    const top=document.createElement("div");
    top.className="settings-real-top";
    top.innerHTML='<h1>Definições</h1><input class="settings-searchbox" placeholder="Localizar uma definição">';
    main.insertBefore(top,page);
    const device=document.createElement("div");
    device.className="settings-device-card";
    device.innerHTML='<div class="settings-device-icon">▣</div><div><strong>SIMULATOR-PC</strong><small>Windows 11 Simulator · Conta local</small></div>';
    main.insertBefore(device,page);
    const input=top.querySelector("input");
    input.onkeydown=e=>{if(e.key==="Enter"&&input.value.trim()){const q=input.value.trim();openGlobalSearch();$("#global-search").value=q;renderGlobalSearch(q)}};
  };

  /* -------- Modern Task Manager -------- */
  globalThis.renderTaskManager=function(wrap){
    wrap.className="tm-real";
    const tabs=[
      ["processes","▦","Processos"],["performance","⌁","Desempenho"],["startup","↗","Aplicações de arranque"],
      ["users","♙","Utilizadores"],["details","☷","Detalhes"],["services","⚙","Serviços"]
    ];
    wrap.innerHTML='<nav class="tm-real-nav"><div class="tm-brand">Gestor de Tarefas</div>'+tabs.map(([id,ic,n])=>'<button data-tm="'+id+'"><span style="display:inline-block;width:23px">'+ic+'</span>'+n+'</button>').join("")+'</nav><main class="tm-real-main"><header class="tm-real-head"><h2 data-tm-title>Processos</h2><button data-run-new>＋ <span>Executar nova tarefa</span></button><button data-efficiency>♧ <span>Modo de eficiência</span></button><button data-end-task>▣ <span>Terminar tarefa</span></button></header><div class="tm-real-content"></div></main>';
    const content=wrap.querySelector(".tm-real-content"),title=wrap.querySelector("[data-tm-title]");
    let active="processes",selected=null;

    function runningWindows(){return $$(".window").filter(w=>Number(w.dataset.desktop||0)===Number(state.currentDesktop))}
    function cpuFor(w){return +(((Number(w.dataset.pid)%19)+2)/10).toFixed(1)}
    function memFor(w){return 38+(Number(w.dataset.pid)%165)}
    function renderProcesses(){
      const wins=runningWindows();
      const cpu=Math.min(99,wins.reduce((n,w)=>n+cpuFor(w),2)).toFixed(0);
      const mem=Math.min(91,32+wins.length*3);
      content.innerHTML='<div class="tm-summary"><div class="tm-summary-card"><strong>'+cpu+'%</strong>CPU</div><div class="tm-summary-card"><strong>'+mem+'%</strong>Memória</div><div class="tm-summary-card"><strong>2%</strong>Disco</div><div class="tm-summary-card"><strong>0%</strong>Rede</div></div><table class="tm-process-table"><thead><tr><th>Nome</th><th>Estado</th><th>CPU</th><th>Memória</th><th>Disco</th><th>Rede</th></tr></thead><tbody>'+
        wins.map(w=>{const id=w.dataset.app,a=APPS[id]||{name:id};const eff=w.dataset.efficiency==="1";return '<tr data-process="'+w.dataset.id+'" class="'+(selected===w.dataset.id?"selected":"")+'"><td><div class="process-name">'+realIcon(id)+'<span>'+escapeHTML(a.name)+'</span></div></td><td>'+(eff?"🌿 Eficiência":"")+'</td><td class="usage-cell">'+cpuFor(w)+'%</td><td class="usage-hi">'+memFor(w)+' MB</td><td class="usage-cell">'+((Number(w.dataset.pid)%8)/10).toFixed(1)+' MB/s</td><td>0 Mbps</td></tr>'}).join("")+
        '</tbody></table>';
      content.querySelectorAll("[data-process]").forEach(r=>r.onclick=()=>{selected=r.dataset.process;renderProcesses()});
    }
    function performance(){
      const seed=Date.now()%100;
      content.innerHTML='<div class="performance-grid" style="margin-top:14px">'+
        perfCard("CPU","7%","Virtual CPU · 3.40 GHz",seed)+perfCard("Memória","42%","3.4 / 8.0 GB",seed+11)+perfCard("Disco 0 (C:)","2%","SSD virtual",seed+24)+perfCard("Wi-Fi","0 Kbps","SIMULATOR-NET",seed+37)+'</div>';
    }
    function startup(){
      content.innerHTML='<table class="tm-process-table"><thead><tr><th>Nome</th><th>Publicador</th><th>Estado</th><th>Impacto no arranque</th></tr></thead><tbody><tr><td>Windows Security notification icon</td><td>Microsoft Windows</td><td>Ativado</td><td>Baixo</td></tr><tr><td>Microsoft Edge</td><td>Microsoft Corporation</td><td>Desativado</td><td>Não medido</td></tr><tr><td>OneDrive</td><td>Microsoft Corporation</td><td>Desativado</td><td>Baixo</td></tr></tbody></table>';
    }
    function details(){
      content.innerHTML='<table class="tm-process-table"><thead><tr><th>Nome</th><th>PID</th><th>Estado</th><th>Nome de utilizador</th><th>CPU</th></tr></thead><tbody>'+runningWindows().map(w=>'<tr><td>'+escapeHTML(w.dataset.app)+'.exe</td><td>'+w.dataset.pid+'</td><td>Em execução</td><td>USER</td><td>'+cpuFor(w)+'%</td></tr>').join("")+'</tbody></table>';
    }
    function users(){content.innerHTML='<div class="tm-summary" style="margin-top:14px"><div class="tm-summary-card"><strong>USER</strong>Utilizador</div><div class="tm-summary-card"><strong>'+runningWindows().length+'</strong>Aplicações</div><div class="tm-summary-card"><strong>42%</strong>Memória</div></div>'}
    function services(){content.innerHTML='<table class="tm-process-table"><thead><tr><th>Nome</th><th>PID</th><th>Descrição</th><th>Estado</th></tr></thead><tbody>'+(state.services||[]).map(s=>'<tr><td>'+escapeHTML(s.name)+'</td><td>'+(s.pid||"")+'</td><td>'+escapeHTML(s.display)+'</td><td>'+escapeHTML(s.status)+'</td></tr>').join("")+'</tbody></table>'}
    function show(tab){
      active=tab;selected=null;
      wrap.querySelectorAll("[data-tm]").forEach(b=>b.classList.toggle("active",b.dataset.tm===tab));
      const label=tabs.find(x=>x[0]===tab)?.[2]||"Gestor de Tarefas";title.textContent=label;
      if(tab==="processes")renderProcesses();else if(tab==="performance")performance();else if(tab==="startup")startup();else if(tab==="users")users();else if(tab==="details")details();else services();
    }
    wrap.querySelectorAll("[data-tm]").forEach(b=>b.onclick=()=>show(b.dataset.tm));
    wrap.querySelector("[data-run-new]").onclick=()=>{if(typeof openRun==="function")openRun();else notify("Gestor de Tarefas","Use Win+R para executar uma nova tarefa.")};
    wrap.querySelector("[data-end-task]").onclick=()=>{if(!selected)return notify("Gestor de Tarefas","Selecione um processo.");const w=$('.window[data-id="'+selected+'"]');if(w){closeWindow(w);selected=null;show(active)}};
    wrap.querySelector("[data-efficiency]").onclick=()=>{if(!selected)return notify("Gestor de Tarefas","Selecione um processo.");const w=$('.window[data-id="'+selected+'"]');if(w){w.dataset.efficiency=w.dataset.efficiency==="1"?"0":"1";renderProcesses()}};
    show("processes");
  };

  /* -------- Edge with multiple tabs -------- */
  globalThis.buildEdge=function(wrap){
    wrap.className="edge-real";
    wrap.innerHTML='<div class="edge-real-tabs"><div data-tabs style="display:flex;gap:2px;flex:1;min-width:0;overflow:hidden"></div><button class="edge-new-tab" data-new-tab title="Novo separador">＋</button></div><div class="edge-real-bar"><button data-back>←</button><button data-forward>→</button><button data-reload>↻</button><button data-home>⌂</button><input class="edge-real-address" aria-label="Barra de endereço"><button data-go>→</button><button data-external>↗</button></div><div class="edge-real-page"></div>';
    const tabsBox=wrap.querySelector("[data-tabs]"),address=wrap.querySelector(".edge-real-address"),page=wrap.querySelector(".edge-real-page");
    let seq=0,activeId=null,tabs=[];

    function normalize(raw){
      const v=String(raw||"").trim();
      if(!v)return "edge://newtab";
      if(v==="edge://newtab"||v.startsWith("local:"))return v;
      if(/^https?:\/\//i.test(v))return v;
      if(!/\s/.test(v)&&/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(v))return "https://"+v;
      return "https://www.google.com/search?igu=1&q="+encodeURIComponent(v);
    }
    function current(){return tabs.find(t=>t.id===activeId)}
    function titleFor(url){
      if(url==="edge://newtab")return "Novo separador";
      if(url.startsWith("local:"))return "Pesquisa local";
      try{return new URL(url).hostname.replace(/^www\./,"")}catch{return "Microsoft Edge"}
    }
    function newTab(url="edge://newtab"){
      const t={id:"tab-"+(++seq),url,history:[url],index:0,title:titleFor(url)};
      tabs.push(t);activeId=t.id;renderTabs();renderActive();return t;
    }
    function closeTab(id,e){
      e?.stopPropagation();const i=tabs.findIndex(t=>t.id===id);if(i<0)return;
      tabs.splice(i,1);if(!tabs.length)return newTab();
      if(activeId===id)activeId=tabs[Math.max(0,i-1)]?.id||tabs[0].id;
      renderTabs();renderActive();
    }
    function renderTabs(){
      tabsBox.innerHTML="";
      tabs.forEach(t=>{
        const b=document.createElement("button");b.className="edge-real-tab"+(t.id===activeId?" active":"");b.dataset.tab=t.id;
        b.innerHTML='<span class="tab-favicon">🌐</span><span class="tab-label">'+escapeHTML(t.title)+'</span><span class="tab-close" role="button">×</span>';
        b.onclick=()=>{activeId=t.id;renderTabs();renderActive()};
        b.querySelector(".tab-close").onclick=e=>closeTab(t.id,e);
        tabsBox.appendChild(b);
      });
    }
    function push(t,url){t.history=t.history.slice(0,t.index+1);t.history.push(url);t.index=t.history.length-1;t.url=url;t.title=titleFor(url)}
    function navigate(raw,pushHistory=true){
      const t=current(),url=normalize(raw);if(!t)return;
      if(pushHistory)push(t,url);else{t.url=url;t.title=titleFor(url)}
      renderTabs();renderActive();
    }
    function renderActive(){
      const t=current();if(!t)return;
      address.value=t.url;
      page.innerHTML="";
      if(t.url==="edge://newtab"){
        page.innerHTML='<div class="edge-home"><div class="edge-logo">🌐</div><h1>Microsoft Edge</h1><p>Pesquisar na Web ou introduzir um endereço.</p><div class="edge-search"><input placeholder="Pesquisar na Web"><button>Pesquisar</button></div><div class="edge-cards"><div class="edge-card"><strong>Internet</strong><p>Navegação HTTPS dentro do simulador quando permitida.</p></div><div class="edge-card"><strong>Vários separadores</strong><p>Abra, feche e alterne entre páginas.</p></div><div class="edge-card"><strong>Pesquisa local</strong><p>Use local: termo para procurar no simulador.</p></div></div></div>';
        const i=page.querySelector(".edge-search input"),b=page.querySelector(".edge-search button");const go=()=>navigate(i.value);b.onclick=go;i.onkeydown=e=>{if(e.key==="Enter")go()};return;
      }
      if(t.url.startsWith("local:")){
        const q=t.url.slice(6).trim(),rs=collectSearchResults(q);
        page.innerHTML='<div style="padding:28px;overflow:auto;height:100%"><h2>Resultados locais para “'+escapeHTML(q)+'”</h2><div class="search-results" style="color:inherit"></div></div>';
        const box=page.querySelector(".search-results");rs.forEach(r=>{const b=document.createElement("button");b.className="search-result";b.style.color="inherit";b.innerHTML='<span class="sr-icon">'+r.icon+'</span><span><strong>'+escapeHTML(r.name)+'</strong><small>'+escapeHTML(r.detail)+'</small></span>';b.onclick=()=>launchSearchResult(r);box.appendChild(b)});return;
      }
      const shell=document.createElement("div");shell.className="edge-site-shell";
      const note=document.createElement("div");note.className="edge-site-note";note.innerHTML='<span>🔒 Ligação Web isolada · alguns sites bloqueiam incorporação</span><button data-ext>Abrir externamente ↗</button>';
      const frame=document.createElement("iframe");frame.className="edge-tab-frame";frame.src=t.url;frame.referrerPolicy="no-referrer";frame.setAttribute("sandbox","allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads");
      shell.append(note,frame);page.appendChild(shell);note.querySelector("[data-ext]").onclick=()=>openExternal(t.url);
    }
    function openExternal(url=current()?.url){
      if(!/^https?:\/\//i.test(url||""))return notify("Microsoft Edge","Este separador não contém um endereço Web.");
      const w=window.open(url,"_blank","noopener,noreferrer");if(!w)notify("Microsoft Edge","O browser bloqueou a nova janela.");
    }

    wrap.querySelector("[data-new-tab]").onclick=()=>newTab();
    wrap.querySelector("[data-go]").onclick=()=>navigate(address.value);
    wrap.querySelector("[data-home]").onclick=()=>navigate("edge://newtab");
    wrap.querySelector("[data-external]").onclick=()=>openExternal();
    wrap.querySelector("[data-reload]").onclick=()=>renderActive();
    wrap.querySelector("[data-back]").onclick=()=>{const t=current();if(t&&t.index>0){t.index--;t.url=t.history[t.index];t.title=titleFor(t.url);renderTabs();renderActive()}};
    wrap.querySelector("[data-forward]").onclick=()=>{const t=current();if(t&&t.index<t.history.length-1){t.index++;t.url=t.history[t.index];t.title=titleFor(t.url);renderTabs();renderActive()}};
    address.onkeydown=e=>{if(e.key==="Enter")navigate(address.value)};
    newTab();
  };

  globalThis.Win11AppRealism={version:"7.9.0"};
})();
