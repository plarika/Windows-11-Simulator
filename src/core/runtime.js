"use strict";
const STORAGE_KEY="win11-sim-v4";
const SESSION_STORAGE_KEY="win11-sim-active-session-v67";
const PROFILE_STORAGE_PREFIX="win11-sim-profile-v67:";
function activeProfileStorageKey(){
  try{
    const id=sessionStorage.getItem(SESSION_STORAGE_KEY);
    return id?PROFILE_STORAGE_PREFIX+id:STORAGE_KEY;
  }catch{return STORAGE_KEY}
}
const APPS={explorer:{name:"Explorador",icon:"📁",w:800,h:540},notepad:{name:"Notas",icon:"📝",w:720,h:500},calc:{name:"Calculadora",icon:"🧮",w:360,h:520},terminal:{name:"Terminal",icon:"⌨️",w:720,h:460},settings:{name:"Definições",icon:"⚙️",w:780,h:540},taskmanager:{name:"Gestor de Tarefas",icon:"📊",w:760,h:470},recycle:{name:"Reciclagem",icon:"🗑️",w:690,h:470},photos:{name:"Fotografias",icon:"🖼️",w:700,h:500},paint:{name:"Pintar",icon:"🖌️",w:760,h:540},edge:{name:"Microsoft Edge",icon:"🌐",w:900,h:600},
security:{name:"Segurança do Windows",icon:"🛡️",w:790,h:560},
devicemanager:{name:"Gestor de Dispositivos",icon:"🧩",w:760,h:540},
registry:{name:"Editor de Registo",icon:"🧱",w:780,h:540},
eventviewer:{name:"Visualizador de Eventos",icon:"📜",w:820,h:560},
controlpanel:{name:"Painel de Controlo",icon:"🎛️",w:790,h:540},
clock:{name:"Relógio",icon:"⏱️",w:620,h:500},
snipping:{name:"Ferramenta de Recorte",icon:"✂️",w:760,h:540},
mediaplayer:{name:"Media Player",icon:"▶️",w:760,h:540},
store:{name:"Microsoft Store",icon:"🛍️",w:820,h:580},
windowstools:{name:"Ferramentas do Windows",icon:"🧰",w:840,h:590},
services:{name:"Serviços",icon:"⚙️",w:860,h:580},
diskmgmt:{name:"Gestão de Discos",icon:"💽",w:900,h:600},
taskscheduler:{name:"Agendador de Tarefas",icon:"🗓️",w:850,h:580},
systeminfo:{name:"Informações do Sistema",icon:"ℹ️",w:840,h:590},
resmon:{name:"Monitor de Recursos",icon:"📈",w:850,h:580},
powershell:{name:"Windows PowerShell",icon:"🔷",w:780,h:500},
optionalfeatures:{name:"Funcionalidades do Windows",icon:"🧩",w:700,h:540},
backup:{name:"Cópia de Segurança",icon:"💾",w:730,h:540},
recovery:{name:"Recuperação",icon:"🩹",w:730,h:540},
stickynotes:{name:"Sticky Notes",icon:"🗒️",w:720,h:520},
onedrive:{name:"OneDrive",icon:"☁️",w:760,h:540},
remotedesktop:{name:"Ligação ao Ambiente de Trabalho Remoto",icon:"🖥️",w:660,h:500},
soundrecorder:{name:"Gravador de Som",icon:"🎙️",w:620,h:500},
gethelp:{name:"Obter Ajuda",icon:"❔",w:720,h:540}};
const WALLPAPERS=["radial-gradient(circle at 70% 20%,rgba(255,207,129,.95),transparent 28%),radial-gradient(circle at 18% 12%,rgba(78,66,157,.95),transparent 34%),linear-gradient(145deg,#343066 0%,#bd638e 52%,#ee8968 100%)","radial-gradient(circle at 55% 25%,#8be8ff,transparent 30%),linear-gradient(145deg,#101a43,#4165bd 55%,#88d5e8)","radial-gradient(circle at 28% 30%,#ff8cb7,transparent 28%),linear-gradient(150deg,#1d1144,#8c3b8d 55%,#ff956f)"];
function defaultState(){return{brightness:100,volume:67,theme:"light",wallpaper:0,quick:{wifi:true,sound:true,night:false,protection:true},files:{"C:/Desktop":{"Welcome.txt":"Bem-vindo ao Windows 11 Simulator."},"C:/Documents":{"Notas.txt":"Reunião às 17:00.\nRever o Windows 11 Simulator.","Projeto.txt":"Windows 11 Simulator"},"C:/Pictures":{},"Recycle Bin":{}},notifications:[{title:"Windows Simulator",message:"Sistema iniciado com sucesso.",time:Date.now()}],notepadText:"",currentDesktop:0,desktops:["Ambiente 1"],recents:["C:/Documents/Notas.txt","C:/Documents/Projeto.txt"],
clipboard:["Windows 11 Simulator"],
settingsPage:"system",
update:{status:"ready",progress:0,lastChecked:0,version:"26100.1000"},
devices:{bluetooth:true,camera:true,audio:true,network:true,gpu:true},
storeInstalled:{terminal:true,photos:true,paint:true},
security:{lastScan:0,threats:0},
events:[]}}
function loadState(){try{const raw=localStorage.getItem(activeProfileStorageKey());return raw?Object.assign(defaultState(),JSON.parse(raw)):defaultState()}catch{return defaultState()}}const state=loadState();function saveState(){try{localStorage.setItem(activeProfileStorageKey(),JSON.stringify(state))}catch{}}
let zCounter=200,pidCounter=1000,drag=null,resize=null,altIndex=0;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],clamp=(v,a,b)=>Math.min(Math.max(v,a),b),isMobile=()=>innerWidth<=720;
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function applyState(){document.getElementById("app").style.background=WALLPAPERS[state.wallpaper]||WALLPAPERS[0];document.getElementById("app").classList.toggle("theme-dark",state.theme==="dark");document.getElementById("desktop").style.filter=`brightness(${state.brightness/100})`;document.getElementById("brightness").value=state.brightness;document.getElementById("volume").value=state.volume;syncQuick();renderNotifications();renderRecommended()}
const overlays={start:$("#start-menu"),calendar:$("#calendar-panel"),quick:$("#quick-panel"),notifications:$("#notification-panel"),search:$("#search-panel"),widgets:$("#widgets-panel"),clipboard:$("#clipboard-panel")};
function closeOverlays(except=null){Object.entries(overlays).forEach(([k,e])=>{if(k!==except)e.classList.remove("open")});syncOverlayButtons()}function toggleOverlay(name){const e=overlays[name],open=!e.classList.contains("open");closeOverlays(open?name:null);e.classList.toggle("open",open);syncOverlayButtons()}function syncOverlayButtons(){$("#start-btn").classList.toggle("active",overlays.start.classList.contains("open"));$("#quick-btn").classList.toggle("active",overlays.quick.classList.contains("open"));$("#notify-btn").classList.toggle("active",overlays.notifications.classList.contains("open"));$("#search-btn").classList.toggle("active",overlays.search.classList.contains("open"));$("#taskview-btn").classList.toggle("active",$("#task-view").classList.contains("open"))}
$$('[data-close-overlay]').forEach(b=>b.addEventListener('click',()=>closeOverlays()));
function populateDesktop(){const d=$("#desktop-icons");d.innerHTML="";[["explorer","Este PC","🖥️"],["explorer","Documentos","📁"],["recycle","Reciclagem","🗑️"],["settings","Definições","⚙️"]].forEach(([app,label,icon],i)=>{const b=document.createElement("button");b.className="desktop-icon";b.innerHTML=`<span class="icon">${icon}</span><span class="label">${label}</span>`;b.addEventListener("dblclick",()=>openApp(app,i===1?"C:/Documents":undefined));let last=0;b.addEventListener("click",()=>{$$(".desktop-icon").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");const now=Date.now();if(now-last<420)openApp(app,i===1?"C:/Documents":undefined);last=now});d.appendChild(b)})}
function populateStart(){const g=$("#start-grid");g.innerHTML="";Object.entries(APPS).forEach(([k,a])=>{const b=document.createElement("button");b.className="start-app";b.dataset.app=k;b.innerHTML=`<span class="icon">${a.icon}</span><span>${a.name}</span>`;b.addEventListener("click",()=>{openApp(k);closeOverlays()});g.appendChild(b)})}
populateDesktop();populateStart();
$("#start-search").addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();$$('.start-app').forEach(el=>el.style.display=el.textContent.toLowerCase().includes(q)?"":"none");if(q){Object.entries(state.files).some(([path,files])=>Object.keys(files).some(name=>{if(name.toLowerCase().includes(q)){return false}return false}))}});
$("#start-search").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.value.trim()){const q=e.target.value.trim();openGlobalSearch();$("#global-search").value=q;renderGlobalSearch(q)}});
$("#start-btn").addEventListener("click",e=>{e.stopPropagation();toggleOverlay("start")});$("#clock-btn").addEventListener("click",e=>{e.stopPropagation();toggleOverlay("calendar")});$("#quick-btn").addEventListener("click",e=>{e.stopPropagation();toggleOverlay("quick")});$("#notify-btn").addEventListener("click",e=>{e.stopPropagation();toggleOverlay("notifications")});$("#search-btn").addEventListener("click",e=>{e.stopPropagation();openGlobalSearch()});$("#taskview-btn").addEventListener("click",e=>{e.stopPropagation();toggleTaskView()});$("#widgets-btn").addEventListener("click",e=>{e.stopPropagation();toggleOverlay("widgets")});
function makeWindow(appId,initialPath){const a=APPS[appId]||APPS.explorer,win=document.createElement("section"),id="w-"+Math.random().toString(36).slice(2);win.className="window focused";win.dataset.id=id;win.dataset.app=appId;win.dataset.pid=String(++pidCounter);win.dataset.desktop=String(Number(state.currentDesktop)||0);const s=fitWindowSize(a.w,a.h),p=initialPosition(s.w,s.h);Object.assign(win.style,{width:s.w+"px",height:s.h+"px",left:p.x+"px",top:p.y+"px",zIndex:String(++zCounter)});win.innerHTML=`<header class="win-head"><div class="win-title"><span>${a.icon}</span><span>${escapeHTML(a.name)}</span></div><div class="win-controls"><button class="win-control min" title="Minimizar">—</button><button class="win-control max" title="Maximizar">▢</button><button class="win-control close" title="Fechar">✕</button></div></header><div class="snap-menu"><button class="snap-cell" data-snap="left"></button><button class="snap-cell" data-snap="right"></button><button class="snap-cell" data-snap="tl"></button><button class="snap-cell" data-snap="tr"></button><button class="snap-cell" data-snap="bl"></button><button class="snap-cell" data-snap="br"></button></div><div class="win-body"></div><div class="resize-grip"></div>`;$("#window-layer").appendChild(win);win.querySelector(".win-body").appendChild(renderApp(appId,win,initialPath));bindWindow(win);createTaskButton(win);focusWindow(win);return win}
function openApp(appId,initialPath){const existing=$$(".window").find(w=>w.dataset.app===appId&&Number(w.dataset.desktop||0)===(Number(state.currentDesktop)||0));if(existing){existing.classList.remove("hidden");focusWindow(existing);if(appId==="explorer"&&initialPath)existing.dispatchEvent(new CustomEvent("navigate",{detail:initialPath}));return existing}return makeWindow(appId,initialPath)}
function bindWindow(win){win.addEventListener("pointerdown",()=>focusWindow(win));win.querySelector(".close").addEventListener("click",()=>closeWindow(win));win.querySelector(".min").addEventListener("click",()=>minimizeWindow(win));win.querySelector(".max").addEventListener("click",()=>toggleMaximize(win));const max=win.querySelector(".max"),snap=win.querySelector(".snap-menu");let snapTimer;max.addEventListener("pointerenter",()=>{if(!isMobile()){clearTimeout(snapTimer);snap.classList.add("open")}});win.querySelector(".win-controls").addEventListener("pointerleave",()=>{snapTimer=setTimeout(()=>snap.classList.remove("open"),300)});snap.addEventListener("pointerenter",()=>clearTimeout(snapTimer));snap.addEventListener("pointerleave",()=>snap.classList.remove("open"));snap.querySelectorAll("[data-snap]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();applySnap(win,b.dataset.snap);snap.classList.remove("open")}));const head=win.querySelector(".win-head");head.addEventListener("dblclick",e=>{if(!e.target.closest("button"))toggleMaximize(win)});head.addEventListener("pointerdown",e=>{if(e.target.closest("button")||isMobile()||win.classList.contains("maximized"))return;drag={win,dx:e.clientX-win.offsetLeft,dy:e.clientY-win.offsetTop};head.setPointerCapture?.(e.pointerId)});win.querySelector(".resize-grip").addEventListener("pointerdown",e=>{if(isMobile()||win.classList.contains("maximized"))return;e.stopPropagation();resize={win,sx:e.clientX,sy:e.clientY,sw:win.offsetWidth,sh:win.offsetHeight};e.currentTarget.setPointerCapture?.(e.pointerId)})}
document.addEventListener("pointermove",e=>{if(drag){const maxX=innerWidth-drag.win.offsetWidth,maxY=innerHeight-70-drag.win.offsetHeight;drag.win.style.left=clamp(e.clientX-drag.dx,0,Math.max(0,maxX))+"px";drag.win.style.top=clamp(e.clientY-drag.dy,0,Math.max(0,maxY))+"px"}if(resize){const maxW=innerWidth-resize.win.offsetLeft-6,maxH=innerHeight-70-resize.win.offsetTop;resize.win.style.width=clamp(resize.sw+e.clientX-resize.sx,300,maxW)+"px";resize.win.style.height=clamp(resize.sh+e.clientY-resize.sy,220,maxH)+"px"}});document.addEventListener("pointerup",()=>{drag=null;resize=null});
function focusWindow(win){$$('.window').forEach(w=>w.classList.remove('focused'));win.classList.add('focused');win.style.zIndex=String(++zCounter);updateTaskbar()}function minimizeWindow(win){win.classList.add('hidden');updateTaskbar()}function closeWindow(win){document.querySelector(`.task-btn[data-window="${win.dataset.id}"]`)?.remove();win.remove();updateTaskbar()}function toggleMaximize(win){if(win.classList.contains('maximized')){win.classList.remove('maximized');const p=JSON.parse(win.dataset.prev||'{}');Object.assign(win.style,p)}else{win.dataset.prev=JSON.stringify({left:win.style.left,top:win.style.top,width:win.style.width,height:win.style.height});win.classList.add('maximized')}focusWindow(win)}
function applySnap(win,type){win.classList.remove('maximized');const gap=6,availableH=innerHeight-74;const halfW=Math.floor((innerWidth-gap*3)/2),halfH=Math.floor((availableH-gap*3)/2);const map={left:{l:gap,t:gap,w:halfW,h:availableH-gap*2},right:{l:halfW+gap*2,t:gap,w:halfW,h:availableH-gap*2},tl:{l:gap,t:gap,w:halfW,h:halfH},tr:{l:halfW+gap*2,t:gap,w:halfW,h:halfH},bl:{l:gap,t:halfH+gap*2,w:halfW,h:halfH},br:{l:halfW+gap*2,t:halfH+gap*2,w:halfW,h:halfH}};const s=map[type];Object.assign(win.style,{left:s.l+'px',top:s.t+'px',width:s.w+'px',height:s.h+'px'});focusWindow(win)}
function createTaskButton(win){const a=APPS[win.dataset.app],b=document.createElement('button');b.className='task-btn running';b.dataset.window=win.dataset.id;b.textContent=a.icon;b.title=a.name;b.addEventListener('click',()=>{if(win.classList.contains('hidden')){win.classList.remove('hidden');focusWindow(win)}else if(win.classList.contains('focused'))minimizeWindow(win);else focusWindow(win)});$('#task-center').appendChild(b);updateTaskbar()}function updateTaskbar(){
  $$(".task-btn[data-window]").forEach(btn=>{
    const w=document.querySelector(`.window[data-id="${btn.dataset.window}"]`);
    const same=!!w&&Number(w.dataset.desktop||0)===Number(state.currentDesktop);
    btn.style.display=same?"":"none";
    btn.classList.toggle("active",same&&w.classList.contains("focused")&&!w.classList.contains("hidden"));
  });
}function fitWindowSize(w,h){return isMobile()?{w:innerWidth-12,h:innerHeight-76}:{w:Math.min(w,innerWidth-30),h:Math.min(h,innerHeight-90)}}function initialPosition(w,h){if(isMobile())return{x:6,y:6};const n=$$('.window').length;return{x:clamp(80+n*26,10,Math.max(10,innerWidth-w-10)),y:clamp(55+n*24,10,Math.max(10,innerHeight-h-75))}}
function keepWindowsInViewport(){$$('.window').forEach(w=>{if(isMobile()){w.classList.remove('maximized');Object.assign(w.style,{left:'6px',top:'6px',width:(innerWidth-12)+'px',height:(innerHeight-76)+'px'})}else if(!w.classList.contains('maximized')){const ww=Math.min(w.offsetWidth,innerWidth-12),hh=Math.min(w.offsetHeight,innerHeight-76);w.style.width=ww+'px';w.style.height=hh+'px';w.style.left=clamp(w.offsetLeft,0,Math.max(0,innerWidth-ww))+'px';w.style.top=clamp(w.offsetTop,0,Math.max(0,innerHeight-hh-66))+'px'}})}addEventListener('resize',keepWindowsInViewport);
function renderApp(appId,win,initialPath){const wrap=document.createElement('div');if(appId==='explorer'||appId==='recycle'){buildExplorer(wrap,win,appId==='recycle'?'Recycle Bin':(initialPath||'C:/Documents'));return wrap}if(appId==='notepad'){wrap.className='notepad';wrap.innerHTML='<div class="app-toolbar"><button data-new>Novo</button><button data-save>Guardar</button><button data-saveas>Guardar como</button></div><textarea spellcheck="false"></textarea>';const ta=wrap.querySelector('textarea');ta.value=state.notepadText||'';ta.addEventListener('input',()=>{state.notepadText=ta.value;saveState()});wrap.querySelector('[data-new]').onclick=()=>{ta.value='';state.notepadText='';saveState()};wrap.querySelector('[data-save]').onclick=()=>saveNotepad(ta.value,'Notas.txt');wrap.querySelector('[data-saveas]').onclick=()=>saveNotepad(ta.value,'Notas-'+Date.now()+'.txt');return wrap}if(appId==='calc'){buildCalc(wrap);return wrap}if(appId==='terminal'){buildTerminal(wrap);return wrap}if(appId==='edge'){buildEdge(wrap);return wrap}if(appId==='settings'){buildSettings(wrap);return wrap}if(appId==='taskmanager'){wrap.className='tm';renderTaskManager(wrap);return wrap}if(appId==='paint'){buildPaint(wrap);return wrap}if(appId==='photos'){buildPhotos(wrap);return wrap}wrap.style.padding='24px';wrap.innerHTML='<h2>Aplicação</h2>';return wrap}
function ensureFolder(path){state.files[path]??={};return state.files[path]}
function buildExplorer(wrap,win,startPath){wrap.className='explorer';wrap.innerHTML='<aside><div class="nav-item" data-path="C:/Desktop">🖥️ Ambiente de Trabalho</div><div class="nav-item" data-path="C:/Documents">📄 Documentos</div><div class="nav-item" data-path="C:/Pictures">🖼️ Imagens</div><div class="nav-item" data-path="Recycle Bin">🗑️ Reciclagem</div></aside><main><div class="explorer-top"><div class="explorer-nav"><button data-back>←</button><button data-forward>→</button><button data-up>↑</button><div class="pathbar"></div></div><div class="app-toolbar"><button data-newfile>Novo ficheiro</button><button data-newfolder>Nova pasta</button></div></div><div class="explorer-content"><div class="file-grid"></div></div></main>';let path=startPath,history=[path],idx=0;const grid=wrap.querySelector('.file-grid'),pathbar=wrap.querySelector('.pathbar');function nav(p,push=true){ensureFolder(p);path=p;if(push){history=history.slice(0,idx+1);history.push(p);idx++}pathbar.textContent=p;wrap.querySelectorAll('[data-path]').forEach(n=>n.classList.toggle('active',n.dataset.path===p));renderExplorerGrid(grid,p,nav)}wrap.querySelectorAll('[data-path]').forEach(n=>n.onclick=()=>nav(n.dataset.path));wrap.querySelector('[data-back]').onclick=()=>{if(idx>0){idx--;nav(history[idx],false)}};wrap.querySelector('[data-forward]').onclick=()=>{if(idx<history.length-1){idx++;nav(history[idx],false)}};wrap.querySelector('[data-up]').onclick=()=>{if(path==='Recycle Bin')return;const parts=path.split('/');if(parts.length>2){parts.pop();nav(parts.join('/'))}};wrap.querySelector('[data-newfile]').onclick=()=>{const files=ensureFolder(path);let n='Novo ficheiro.txt',i=1;while(n in files)n=`Novo ficheiro (${++i}).txt`;files[n]='';saveState();renderExplorerGrid(grid,path,nav);notify('Explorador',`${n} criado.`)};wrap.querySelector('[data-newfolder]').onclick=()=>{let base=path==='Recycle Bin'?'C:/Documents':path,n='Nova pasta',i=1;while(state.files[base+'/'+n])n=`Nova pasta (${++i})`;ensureFolder(base+'/'+n);saveState();renderExplorerGrid(grid,path,nav)};win.addEventListener('navigate',e=>nav(e.detail));nav(path,false)}
function childFolders(path){if(path==='Recycle Bin')return[];const prefix=path+'/';return Object.keys(state.files).filter(p=>p.startsWith(prefix)&&!p.slice(prefix.length).includes('/')).map(p=>p.slice(prefix.length))}
function renderExplorerGrid(grid,path,nav){grid.innerHTML='';childFolders(path).forEach(name=>{const b=document.createElement('button');b.className='file';b.innerHTML=`<span class="icon">📁</span><div class="file-name">${escapeHTML(name)}</div>`;b.ondblclick=()=>nav(path+'/'+name);b.oncontextmenu=e=>{e.preventDefault();showContext(e.clientX,e.clientY,[['Abrir',()=>nav(path+'/'+name)],['Eliminar pasta',()=>deleteFolder(path+'/'+name,path,grid,nav)]])};grid.appendChild(b)});const files=ensureFolder(path);Object.entries(files).forEach(([name,value])=>{const isImage=typeof value==='string'&&value.startsWith('data:image/');const b=document.createElement('button');b.className='file';b.innerHTML=`<span class="icon">${isImage?'🖼️':'📄'}</span><div class="file-name">${escapeHTML(name)}</div>`;b.ondblclick=()=>openFile(path,name,value);b.oncontextmenu=e=>{e.preventDefault();const items=path==='Recycle Bin'?[['Restaurar',()=>restoreFile(name)],['Eliminar permanentemente',()=>{delete files[name];saveState();renderExplorerGrid(grid,path,nav)}]]:[['Abrir',()=>openFile(path,name,value)],['Renomear',()=>renameFile(path,name,grid,nav)],['Eliminar',()=>deleteFile(path,name,grid,nav)]];showContext(e.clientX,e.clientY,items)};grid.appendChild(b)});if(!grid.children.length){const p=document.createElement('p');p.textContent='Esta pasta está vazia.';grid.appendChild(p)}}
function openFile(path,name,value){if(typeof value==='string'&&value.startsWith('data:image/')){openApp('photos');return}state.notepadText=typeof value==='object'?String(value.content||''):String(value);saveState();openApp('notepad')}
function renameFile(path,name,grid,nav){const next=prompt('Novo nome:',name);if(!next||next===name)return;const files=ensureFolder(path);if(files[next])return notify('Explorador','Já existe um ficheiro com esse nome.');files[next]=files[name];delete files[name];saveState();renderExplorerGrid(grid,path,nav)}function deleteFile(path,name,grid,nav){const files=ensureFolder(path),bin=ensureFolder('Recycle Bin');bin[name]={content:files[name],originalPath:path};delete files[name];saveState();renderExplorerGrid(grid,path,nav);notify('Reciclagem',`${name} movido para a Reciclagem.`)}function restoreFile(name){const bin=ensureFolder('Recycle Bin'),item=bin[name];if(!item)return;const dest=ensureFolder(item.originalPath||'C:/Documents');dest[name]=item.content;delete bin[name];saveState();notify('Reciclagem',`${name} restaurado.`);const w=$$('.window').find(x=>x.dataset.app==='recycle');w?.dispatchEvent(new CustomEvent('navigate',{detail:'Recycle Bin'}))}function deleteFolder(folder,parent,grid,nav){Object.keys(state.files).filter(p=>p===folder||p.startsWith(folder+'/')).forEach(p=>delete state.files[p]);saveState();renderExplorerGrid(grid,parent,nav)}
function saveNotepad(text,name){ensureFolder('C:/Documents')[name]=text;touchRecent('C:/Documents/'+name);saveState();notify('Notas',`${name} guardado em Documentos.`)}
function buildCalc(wrap){wrap.className='calc';wrap.innerHTML='<div class="calc-display">0</div><div class="calc-grid"></div>';let expr='';const display=wrap.querySelector('.calc-display');['C','⌫','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','(',')','='].forEach(k=>{const b=document.createElement('button');b.textContent=k;if('÷×−+'.includes(k))b.className='op';if(k==='=')b.className='eq';b.onclick=()=>{if(k==='C')expr='';else if(k==='⌫')expr=expr.slice(0,-1);else if(k==='%'){const n=Number(expr);expr=Number.isFinite(n)?String(n/100):expr}else if(k==='='){try{const safe=expr.replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-');if(!/^[0-9+\-*/. ()]+$/.test(safe))throw Error();expr=String(evaluateArithmetic(safe))}catch{expr='Erro'}}else expr+=k;display.textContent=expr||'0';if(expr==='Erro')expr=''};wrap.querySelector('.calc-grid').appendChild(b)})}
function evaluateArithmetic(s){const t=s.match(/\d+(?:\.\d+)?|[()+\-*/]/g)||[];let i=0;function f(){if(t[i]==='('){i++;const v=e();if(t[i++]!==')')throw Error();return v}if(t[i]==='-'){i++;return-f()}const n=Number(t[i++]);if(!Number.isFinite(n))throw Error();return n}function m(){let v=f();while(t[i]==='*'||t[i]==='/'){const o=t[i++],r=f();v=o==='*'?v*r:v/r}return v}function e(){let v=m();while(t[i]==='+'||t[i]==='-'){const o=t[i++],r=m();v=o==='+'?v+r:v-r}return v}const v=e();if(i!==t.length||!Number.isFinite(v))throw Error();return v}
function buildTerminal(wrap){wrap.className='terminal';wrap.innerHTML='<div class="term-line">Microsoft Windows [Versão simulada 11.0.26100]</div><div class="term-line">Terminal virtual seguro — sem acesso ao host Replit.</div><br><div data-out></div><div class="term-inputrow"><span>C:\\Users\\User&gt;</span><input autocomplete="off" spellcheck="false"></div>';const input=wrap.querySelector('input'),out=wrap.querySelector('[data-out]');input.onkeydown=e=>{if(e.key==='Enter'){runVirtualCommand(input.value,out);input.value='';wrap.scrollTop=wrap.scrollHeight}};setTimeout(()=>input.focus(),0)}
function runVirtualCommand(raw,out){const cmd=raw.trim();if(!cmd)return;const q=document.createElement('div');q.className='term-line';q.textContent=`C:\\Users\\User>${cmd}`;out.appendChild(q);const [op,...args]=cmd.split(/\s+/);let r='';switch((op||'').toLowerCase()){case'help':r='help, dir, cd, mkdir, echo, type, cls, tasklist, systeminfo, ipconfig, ver, whoami, date, time';break;case'dir':r=Object.keys(ensureFolder('C:/Documents')).join('\n')||'Pasta vazia.';break;case'cd':r=args.length?'Diretório virtual alterado para '+args.join(' '):'C:\\Users\\User';break;case'mkdir':if(args[0]){ensureFolder('C:/Documents/'+args.join(' '));saveState();r='Diretório virtual criado.'}else r='Falta o nome.';break;case'echo':r=args.join(' ');break;case'type':r=ensureFolder('C:/Documents')[args.join(' ')]??'Ficheiro não encontrado.';break;case'cls':out.innerHTML='';return;case'tasklist':r=$$('.window').map(w=>`${APPS[w.dataset.app]?.name}  PID ${w.dataset.pid}`).join('\n')||'Sem processos.';break;case'systeminfo':r='SO: Windows 11 Simulator\nPlataforma: Browser Sandbox\nExecução real: DESATIVADA';break;case'ipconfig':r='IPv4 virtual: 192.168.56.101\nGateway virtual: 192.168.56.1\n(Dados simulados)';break;case'ver':r='Microsoft Windows [Versão simulada 11.0.26100]';break;case'whoami':r='simulator\\user';break;case'date':r=new Date().toLocaleDateString('pt-PT');break;case'time':r=new Date().toLocaleTimeString('pt-PT');break;default:r=`'${op}' não é reconhecido como comando virtual.`}const el=document.createElement('div');el.className='term-line';el.textContent=String(r);out.appendChild(el)}
function buildSettings(wrap){wrap.className='settings';wrap.innerHTML='<aside><div class="nav-item active">Sistema</div><div class="nav-item">Personalização</div><div class="nav-item">Aplicações</div><div class="nav-item">Privacidade e segurança</div></aside><main><h2>Definições</h2><div class="card"><div class="row"><div><strong>Modo escuro</strong><div style="font-size:12px;color:#747983">Altera janelas e aplicações do simulador</div></div><button class="toggle '+(state.theme==="dark"?"on":"")+'" data-theme aria-label="Alternar modo escuro"></button></div></div><div class="card"><div class="row"><div><strong>Volume</strong><div style="font-size:12px;color:#747983">Volume virtual</div></div><input data-vol type="range" min="0" max="100" value="'+state.volume+'"></div></div><div class="card"><strong>Wallpaper</strong><div class="wallpapers"></div></div><div class="card"><strong>Ambientes virtuais</strong><p>'+state.desktops.length+' ambiente(s) configurado(s). Use Win+Tab para gerir.</p></div><div class="card"><strong>Sobre</strong><p>Windows 11 Simulator V3 — ambiente virtual isolado no navegador.</p></div></main>';wrap.querySelector('[data-theme]').onclick=e=>{state.theme=state.theme==='dark'?'light':'dark';e.currentTarget.classList.toggle('on',state.theme==='dark');saveState();applyState()};wrap.querySelector('[data-vol]').oninput=e=>{state.volume=+e.target.value;$('#volume').value=state.volume;saveState()};const ws=wrap.querySelector('.wallpapers');WALLPAPERS.forEach((bg,i)=>{const b=document.createElement('button');b.className='wallpaper-choice'+(i===state.wallpaper?' active':'');b.style.background=bg;b.onclick=()=>{state.wallpaper=i;saveState();applyState();ws.querySelectorAll('button').forEach((x,j)=>x.classList.toggle('active',j===i))};ws.appendChild(b)})}
function renderTaskManager(wrap){const rows=$$('.window').map(w=>`<tr><td>${escapeHTML(APPS[w.dataset.app]?.name||w.dataset.app)}</td><td>${w.dataset.pid}</td><td>${(((Number(w.dataset.pid)%17)+3)/10).toFixed(1)}%</td><td>${45+(Number(w.dataset.pid)%90)} MB</td><td><button data-end="${w.dataset.id}">Terminar tarefa</button></td></tr>`).join('');wrap.innerHTML=`<h2>Gestor de Tarefas</h2><table><thead><tr><th>Nome</th><th>PID</th><th>CPU</th><th>Memória</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="5">Sem aplicações abertas.</td></tr>'}</tbody></table>`;wrap.querySelectorAll('[data-end]').forEach(b=>b.onclick=()=>{const w=document.querySelector(`.window[data-id="${b.dataset.end}"]`);if(w){closeWindow(w);renderTaskManager(wrap)}})}

function renderRecommended(){
  const box=$("#recommended-list");if(!box)return;box.innerHTML="";
  const rec=(state.recents||[]).slice(0,4);
  rec.forEach(full=>{
    const parts=full.split("/"),name=parts.pop(),path=parts.join("/");
    const b=document.createElement("button");b.className="recommended-item";
    b.innerHTML=`<span class="ri-icon">📄</span><span><strong>${escapeHTML(name)}</strong><small>${escapeHTML(path||"Ficheiro")}</small></span>`;
    b.onclick=()=>{const value=(state.files[path]||{})[name];if(typeof value==="string"){state.notepadText=value;touchRecent(full);saveState();openApp("notepad");closeOverlays()}};
    box.appendChild(b);
  });
  if(!box.children.length)box.innerHTML='<div style="color:var(--muted);padding:8px">Sem itens recentes.</div>';
}
function touchRecent(full){
  state.recents=(state.recents||[]).filter(x=>x!==full);state.recents.unshift(full);state.recents=state.recents.slice(0,8);saveState();renderRecommended();
}
function collectSearchResults(q){
  q=q.trim().toLowerCase();if(!q)return [];
  const out=[];
  Object.entries(APPS).forEach(([id,a])=>{if((a.name+" "+id).toLowerCase().includes(q))out.push({type:"app",id,name:a.name,icon:a.icon,detail:"Aplicação"})});
  [["Personalização","settings"],["Modo escuro","settings"],["Wallpaper","settings"],["Volume","settings"],["Privacidade","settings"]].forEach(([name,id])=>{if(name.toLowerCase().includes(q))out.push({type:"app",id,name,icon:"⚙️",detail:"Definição"})});
  Object.entries(state.files||{}).forEach(([path,files])=>Object.entries(files||{}).forEach(([name,value])=>{
    if(name.toLowerCase().includes(q)||String(value).toLowerCase().includes(q))out.push({type:"file",path,name,icon:name.endsWith(".png")?"🖼️":"📄",detail:path});
  }));
  return out.slice(0,24);
}
function renderGlobalSearch(q){
  const box=$("#search-results");box.innerHTML="";const results=collectSearchResults(q);
  if(!q.trim()){box.innerHTML='<div class="search-empty">Comece a escrever para procurar no computador virtual.</div>';return}
  if(!results.length){box.innerHTML='<div class="search-empty">Nenhum resultado encontrado.</div>';return}
  results.forEach((r,i)=>{
    const b=document.createElement("button");b.className="search-result"+(i===0?" active":"");
    b.innerHTML=`<span class="sr-icon">${r.icon}</span><span><strong>${escapeHTML(r.name)}</strong><small>${escapeHTML(r.detail)}</small></span>`;
    b.onclick=()=>launchSearchResult(r);box.appendChild(b);
  });
}
function launchSearchResult(r){
  if(r.type==="app"){openApp(r.id)}
  else{const v=(state.files[r.path]||{})[r.name];if(typeof v==="string"&&v.startsWith("data:image/"))openApp("photos");else if(typeof v==="string"){state.notepadText=v;touchRecent(r.path+"/"+r.name);openApp("notepad")}else openApp("explorer",r.path)}
  closeOverlays();
}
function openGlobalSearch(){
  closeOverlays("search");overlays.search.classList.add("open");syncOverlayButtons();$("#global-search").value="";renderGlobalSearch("");setTimeout(()=>$("#global-search").focus(),0);
}
$("#global-search").addEventListener("input",e=>renderGlobalSearch(e.target.value));
$("#global-search").addEventListener("keydown",e=>{if(e.key==="Enter"){const first=$("#search-results .search-result");if(first)first.click()}});

function renderTaskView(){
  const strip=$("#desktop-strip"),wins=$("#task-windows");strip.innerHTML="";wins.innerHTML="";
  state.desktops=Array.isArray(state.desktops)&&state.desktops.length?state.desktops:["Ambiente 1"];
  state.desktops.forEach((name,i)=>{
    const card=document.createElement("button");card.className="desktop-card"+(i===Number(state.currentDesktop)?" active":"");
    const windows=$$(".window").filter(w=>Number(w.dataset.desktop||0)===i);
    const minis=windows.slice(0,4).map((w,j)=>`<i class="desktop-miniwin" style="left:${8+(j%2)*44}%;top:${9+Math.floor(j/2)*42}%;width:38%;height:34%"></i>`).join("");
    card.innerHTML=`<div class="desktop-preview">${minis}</div><footer><span>${escapeHTML(name)}</span><span>${windows.length}</span></footer>`;
    card.onclick=()=>switchDesktop(i);strip.appendChild(card);
  });
  $$(".window").filter(w=>Number(w.dataset.desktop||0)===Number(state.currentDesktop)).forEach(w=>{
    const c=document.createElement("button");c.className="task-window-card";c.dataset.id=w.dataset.id;
    c.innerHTML=`<div class="preview">${escapeHTML((w.querySelector(".win-body")?.innerText||"").slice(0,180))}</div><strong><span>${APPS[w.dataset.app]?.icon||"◻"}</span>${escapeHTML(APPS[w.dataset.app]?.name||w.dataset.app)}</strong>`;
    c.onclick=()=>{$("#task-view").classList.remove("open");w.classList.remove("hidden");focusWindow(w);syncOverlayButtons()};wins.appendChild(c);
  });
  if(!wins.children.length)wins.innerHTML='<div style="color:var(--muted)">Não existem janelas neste ambiente.</div>';
}
function toggleTaskView(force){
  closeOverlays();const tv=$("#task-view"),open=force===undefined?!tv.classList.contains("open"):!!force;
  tv.classList.toggle("open",open);if(open)renderTaskView();syncOverlayButtons();
}
function switchDesktop(index){
  index=clamp(index,0,state.desktops.length-1);state.currentDesktop=index;saveState();
  $$(".window").forEach(w=>{w.style.visibility=Number(w.dataset.desktop||0)===index?"":"hidden"});
  updateTaskbar();renderTaskView();populateDesktop();notify("Ambientes virtuais",`Mudou para ${state.desktops[index]}.`);
}
$("#taskview-close").onclick=()=>toggleTaskView(false);
$("#new-desktop").onclick=()=>{state.desktops.push(`Ambiente ${state.desktops.length+1}`);saveState();switchDesktop(state.desktops.length-1)};
function cycleDesktop(dir){
  if(!state.desktops.length)return;let n=Number(state.currentDesktop)+dir;if(n<0)n=state.desktops.length-1;if(n>=state.desktops.length)n=0;switchDesktop(n);toggleTaskView(false)
}

function buildEdge(wrap){
  wrap.className="edge";
  wrap.innerHTML=`<div class="edge-tabs"><button class="edge-tab">Novo separador</button></div>
  <div class="edge-bar">
    <button data-back title="Voltar">←</button>
    <button data-forward title="Avançar">→</button>
    <button data-reload title="Atualizar">↻</button>
    <button data-home title="Página inicial">⌂</button>
    <input class="edge-address" value="edge://newtab" aria-label="Barra de endereço">
    <button data-go>Ir</button>
    <button data-external title="Abrir no navegador real">↗</button>
  </div>
  <div class="edge-page"></div>`;

  const address=wrap.querySelector(".edge-address");
  const page=wrap.querySelector(".edge-page");
  let history=["edge://newtab"];
  let historyIndex=0;
  let currentUrl="edge://newtab";

  function setAddress(v){ currentUrl=v; address.value=v; }

  function normalizeInput(raw){
    const v=raw.trim();
    if(!v) return "edge://newtab";
    if(v==="edge://newtab" || v.startsWith("local:")) return v;
    if(/^https?:\/\//i.test(v)) return v;
    if(/^[a-z]+:/i.test(v)) return "blocked:"+v;
    if(!/\s/.test(v) && /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return "https://"+v;
    return "https://www.google.com/search?igu=1&q="+encodeURIComponent(v);
  }

  function pushHistory(url){
    history=history.slice(0,historyIndex+1);
    history.push(url);
    historyIndex=history.length-1;
  }

  function home(push=true){
    setAddress("edge://newtab");
    if(push && history[historyIndex]!=="edge://newtab") pushHistory("edge://newtab");
    page.innerHTML=`<div class="edge-home">
      <div class="edge-logo">🌐</div>
      <h1>Microsoft Edge</h1>
      <p>Internet ativada no Windows 11 Simulator.</p>
      <div class="edge-search"><input placeholder="Pesquisar na Web ou introduzir endereço"><button>Pesquisar</button></div>
      <div class="edge-cards">
        <div class="edge-card"><strong>Internet</strong><p>Abra páginas HTTPS diretamente dentro do Edge quando o site permitir incorporação.</p></div>
        <div class="edge-card"><strong>Pesquisa Web</strong><p>Pesquisas normais são enviadas para a Internet.</p></div>
        <div class="edge-card"><strong>Pesquisa local</strong><p>Use <code>local: termo</code> para procurar apenas no simulador.</p></div>
      </div>
    </div>`;
    const input=page.querySelector(".edge-search input");
    const button=page.querySelector(".edge-search button");
    const go=()=>navigate(normalizeInput(input.value));
    button.onclick=go;
    input.onkeydown=e=>{if(e.key==="Enter")go()};
  }

  function localSearch(q,push=true){
    const url="local:"+q;
    setAddress(url);
    if(push) pushHistory(url);
    const rs=collectSearchResults(q);
    page.innerHTML=`<div class="edge-local-results"><h2>Resultados locais para “${escapeHTML(q)}”</h2><p>Resultados do Windows Simulator.</p><div class="search-results" style="color:inherit"></div></div>`;
    const box=page.querySelector(".search-results");
    rs.forEach(r=>{
      const b=document.createElement("button");
      b.className="search-result";
      b.style.color="inherit";
      b.innerHTML=`<span class="sr-icon">${r.icon}</span><span><strong>${escapeHTML(r.name)}</strong><small>${escapeHTML(r.detail)}</small></span>`;
      b.onclick=()=>launchSearchResult(r);
      box.appendChild(b);
    });
    if(!rs.length) box.innerHTML="<p>Sem resultados locais.</p>";
  }

  function showBlocked(url,push=true){
    setAddress(url.replace(/^blocked:/,""));
    if(push) pushHistory(url);
    page.innerHTML=`<div class="edge-web-message"><h2>Endereço bloqueado</h2><p>Por segurança, o simulador só permite endereços <strong>http://</strong> e <strong>https://</strong>.</p><code>${escapeHTML(url.replace(/^blocked:/,""))}</code></div>`;
  }

  function showWeb(url,push=true){
    setAddress(url);
    if(push) pushHistory(url);
    page.innerHTML="";
    const shell=document.createElement("div");
    shell.className="edge-web-shell";
    const notice=document.createElement("div");
    notice.className="edge-web-notice";
    notice.innerHTML='<span>🔒 Navegação Web isolada</span><span>Alguns sites podem bloquear incorporação.</span>';
    const frame=document.createElement("iframe");
    frame.className="edge-web-frame";
    frame.src=url;
    frame.title="Conteúdo Web";
    frame.referrerPolicy="no-referrer";
    frame.setAttribute("sandbox","allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads");
    const fallback=document.createElement("div");
    fallback.className="edge-web-fallback";
    fallback.innerHTML='<span>Se a página não aparecer, o próprio site poderá estar a bloquear iframes.</span><button class="sys-button primary" data-open-external>Abrir externamente ↗</button>';
    shell.append(notice,frame,fallback);
    page.appendChild(shell);
    fallback.querySelector("[data-open-external]").onclick=()=>openExternal(url);
  }

  function navigate(input,push=true){
    const url=normalizeInput(input);
    if(url==="edge://newtab"){home(push);return}
    if(url.startsWith("local:")){localSearch(url.slice(6).trim(),push);return}
    if(url.startsWith("blocked:")){showBlocked(url,push);return}
    showWeb(url,push);
  }

  function openExternal(url=currentUrl){
    if(!/^https?:\/\//i.test(url)){
      notify("Microsoft Edge","Abra primeiro um endereço HTTP ou HTTPS.");
      return;
    }
    const w=window.open(url,"_blank","noopener,noreferrer");
    if(!w) notify("Microsoft Edge","O browser bloqueou a nova janela. Autorize pop-ups para este site.");
  }

  wrap.querySelector("[data-home]").onclick=()=>home(true);
  wrap.querySelector("[data-go]").onclick=()=>navigate(address.value,true);
  wrap.querySelector("[data-external]").onclick=()=>openExternal();
  wrap.querySelector("[data-reload]").onclick=()=>navigate(currentUrl,false);
  address.onkeydown=e=>{if(e.key==="Enter")navigate(address.value,true)};
  wrap.querySelector("[data-back]").onclick=()=>{
    if(historyIndex<=0)return;
    historyIndex--;
    navigate(history[historyIndex],false);
  };
  wrap.querySelector("[data-forward]").onclick=()=>{
    if(historyIndex>=history.length-1)return;
    historyIndex++;
    navigate(history[historyIndex],false);
  };

  home(false);
}

function buildPaint(wrap){wrap.className='paint';wrap.innerHTML='<div class="paint-toolbar"><button data-pencil>Lápis</button><button data-eraser>Borracha</button><input data-color type="color" value="#111111"><button data-clear>Limpar</button><button data-save>Guardar</button></div><div class="paint-canvas-wrap"><canvas width="900" height="560"></canvas></div>';const c=wrap.querySelector('canvas'),ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);let drawing=false,eraser=false,color='#111';function pos(e){const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}}c.onpointerdown=e=>{drawing=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);c.setPointerCapture?.(e.pointerId)};c.onpointermove=e=>{if(!drawing)return;const p=pos(e);ctx.strokeStyle=eraser?'#fff':color;ctx.lineWidth=eraser?18:4;ctx.lineCap='round';ctx.lineTo(p.x,p.y);ctx.stroke()};c.onpointerup=()=>drawing=false;wrap.querySelector('[data-pencil]').onclick=()=>eraser=false;wrap.querySelector('[data-eraser]').onclick=()=>eraser=true;wrap.querySelector('[data-color]').oninput=e=>color=e.target.value;wrap.querySelector('[data-clear]').onclick=()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height)};wrap.querySelector('[data-save]').onclick=()=>{const name='Desenho-'+Date.now()+'.png';ensureFolder('C:/Pictures')[name]=c.toDataURL('image/png');saveState();notify('Pintar',`${name} guardado em Imagens.`)}}
function buildPhotos(wrap){wrap.className='photos';const pics=ensureFolder('C:/Pictures');wrap.innerHTML='<h2>Fotografias</h2><div class="photo-grid"></div>';const g=wrap.querySelector('.photo-grid');Object.entries(pics).forEach(([name,v])=>{if(typeof v!=='string'||!v.startsWith('data:image/'))return;const c=document.createElement('div');c.className='photo-card';const img=document.createElement('img');img.src=v;img.alt=name;const d=document.createElement('div');d.textContent=name;c.append(img,d);g.appendChild(c)});if(!g.children.length)g.innerHTML='<p>Ainda não existem imagens. Crie uma no Pintar.</p>'}
function syncQuick(){$$('[data-quick]').forEach(b=>{const k=b.dataset.quick,on=!!state.quick[k];b.classList.toggle('on',on);b.querySelector('small').textContent=on?(k==='protection'?'Ativa':'Ligado'):'Desligado'})}$$('[data-quick]').forEach(b=>b.onclick=()=>{const k=b.dataset.quick;state.quick[k]=!state.quick[k];saveState();syncQuick()});$('#brightness').oninput=e=>{state.brightness=+e.target.value;saveState();applyState()};$('#volume').oninput=e=>{state.volume=+e.target.value;saveState()};
function notify(title,message){state.notifications.unshift({title,message,time:Date.now()});state.notifications=state.notifications.slice(0,20);saveState();renderNotifications();toast(title,message)}function renderNotifications(){const l=$('#notification-list');if(!l)return;l.innerHTML='';state.notifications.forEach(n=>{const d=document.createElement('div');d.className='notification';d.innerHTML=`<strong>${escapeHTML(n.title)}</strong><div>${escapeHTML(n.message)}</div><small>${new Date(n.time).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})}</small>`;l.appendChild(d)});if(!l.children.length)l.innerHTML='<div style="color:var(--muted)">Sem notificações.</div>'}function toast(title,message){const s=$('#toast-stack'),t=document.createElement('div');t.className='toast';const a=document.createElement('strong'),b=document.createElement('small');a.textContent=title;b.textContent=message;t.append(a,b);s.appendChild(t);setTimeout(()=>t.remove(),3200)}
function showContext(x,y,items){const m=$('#context-menu');m.innerHTML='';items.forEach(it=>{if(it==='---'){m.appendChild(document.createElement('hr'));return}const b=document.createElement('button');b.textContent=it[0];b.onclick=()=>{m.classList.remove('open');it[1]()};m.appendChild(b)});m.style.left=Math.min(x,innerWidth-210)+'px';m.style.top=Math.min(y,innerHeight-220)+'px';m.classList.add('open')}$('#desktop').addEventListener('contextmenu',e=>{if(e.target.closest('.desktop-icon'))return;e.preventDefault();showContext(e.clientX,e.clientY,[['Atualizar',()=>notify('Ambiente de Trabalho','Atualizado.')],['Nova pasta',()=>{let n='Nova pasta',i=1;while(state.files['C:/Desktop/'+n])n=`Nova pasta (${++i})`;ensureFolder('C:/Desktop/'+n);saveState();notify('Ambiente de Trabalho',`${n} criada.`)}],'---',['Personalizar',()=>openApp('settings')]])});document.addEventListener('pointerdown',e=>{if(!e.target.closest('#context-menu'))$('#context-menu').classList.remove('open')});
function openRun(){$('#run-modal').classList.add('open');$('#run-input').value='';setTimeout(()=>$('#run-input').focus(),0)}function closeRun(){$('#run-modal').classList.remove('open')}function executeRun(){const cmd=$('#run-input').value.trim().toLowerCase(),map={notepad:'notepad',calc:'calc',calculator:'calc',explorer:'explorer',cmd:'terminal',terminal:'terminal',settings:'settings',taskmgr:'taskmanager',paint:'paint',photos:'photos',edge:'edge',msedge:'edge'};if(map[cmd]){openApp(map[cmd]);closeRun()}else notify('Executar',`Não foi possível localizar "${cmd}".`)}$('#run-ok').onclick=executeRun;$('#run-cancel').onclick=closeRun;$('#run-input').onkeydown=e=>{if(e.key==='Enter')executeRun();if(e.key==='Escape')closeRun()};
function showAltTab(){const wins=$$('.window').filter(w=>!w.classList.contains('hidden'));if(!wins.length)return;const box=$('#alt-box');box.innerHTML='';altIndex=(altIndex+1)%wins.length;wins.forEach((w,i)=>{const d=document.createElement('div');d.className='alt-card'+(i===altIndex?' active':'');d.dataset.id=w.dataset.id;d.innerHTML=`<div style="font-size:30px">${APPS[w.dataset.app]?.icon||'◻'}</div><div>${escapeHTML(APPS[w.dataset.app]?.name||w.dataset.app)}</div>`;box.appendChild(d)});$('#alt-tab').classList.add('open')}function commitAltTab(){const c=$('#alt-box .alt-card.active');if(c){const w=document.querySelector(`.window[data-id="${c.dataset.id}"]`);if(w){w.classList.remove('hidden');focusWindow(w)}}$('#alt-tab').classList.remove('open')}
function buildCalendar(){const g=$('#calendar-grid');g.innerHTML='';['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].forEach(x=>{const d=document.createElement('div');d.className='dow';d.textContent=x;g.appendChild(d)});const now=new Date(),y=now.getFullYear(),m=now.getMonth();$('#calendar-title').textContent=now.toLocaleDateString('pt-PT',{month:'long',year:'numeric'});let first=new Date(y,m,1).getDay();first=first===0?6:first-1;for(let i=0;i<first;i++)g.appendChild(document.createElement('div'));for(let d=1;d<=new Date(y,m+1,0).getDate();d++){const el=document.createElement('div');el.textContent=d;if(d===now.getDate())el.className='today';g.appendChild(el)}}buildCalendar();function updateClock(){const d=new Date(),t=d.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'});$('#clock').textContent=t;$('#date').textContent=d.toLocaleDateString('pt-PT');$('#lock-time').textContent=t;$('#lock-date').textContent=d.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'})}updateClock();setInterval(updateClock,1000);
function lockSystem(){closeOverlays();$('#lock').classList.remove('hidden')}$('#lock').onclick=()=>$('#lock').classList.add('hidden');function restartSystem(){closeOverlays();$('#shutdown-text').textContent='A reiniciar...';$('#shutdown').classList.remove('hidden');setTimeout(()=>{$$('.window').forEach(closeWindow);$('#shutdown').classList.add('hidden');$('#boot').classList.remove('hidden');setTimeout(()=>{$('#boot').classList.add('hidden');$('#lock').classList.remove('hidden')},1000)},900)}function shutdownSystem(){closeOverlays();$('#shutdown-text').textContent='Encerrado. Toque para ligar.';$('#shutdown').classList.remove('hidden');$('#shutdown').onclick=()=>{$('#shutdown').onclick=null;$('#shutdown').classList.add('hidden');$('#boot').classList.remove('hidden');setTimeout(()=>{$('#boot').classList.add('hidden');$('#lock').classList.remove('hidden')},1000)}}
$('#power-btn').onclick=e=>{e.stopPropagation();showContext(e.clientX||innerWidth/2,e.clientY||innerHeight/2,[['Bloquear',lockSystem],['Suspender',()=>{closeOverlays();$('#lock').classList.remove('hidden')}],['Reiniciar',restartSystem],['Encerrar',shutdownSystem]])};
document.addEventListener('click',e=>{if(!e.target.closest('.overlay')&&!e.target.closest('#start-btn,#search-btn,#taskview-btn,#clock-btn,#quick-btn,#notify-btn,#widgets-btn'))closeOverlays()});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeOverlays();closeRun();$('#context-menu').classList.remove('open')}if(e.key==='Meta'){e.preventDefault();toggleOverlay('start')}if(e.metaKey&&e.key.toLowerCase()==='e'){e.preventDefault();openApp('explorer')}if(e.metaKey&&e.key.toLowerCase()==='i'){e.preventDefault();openApp('settings')}if(e.metaKey&&e.key.toLowerCase()==='r'){e.preventDefault();openRun()}if(e.ctrlKey&&e.shiftKey&&e.key==='Escape'){e.preventDefault();openApp('taskmanager')}if(e.metaKey&&e.key.toLowerCase()==='s'){e.preventDefault();openGlobalSearch()}if(e.metaKey&&e.key==='Tab'){e.preventDefault();toggleTaskView()}if(e.metaKey&&e.ctrlKey&&e.key==='ArrowLeft'){e.preventDefault();cycleDesktop(-1)}if(e.metaKey&&e.ctrlKey&&e.key==='ArrowRight'){e.preventDefault();cycleDesktop(1)}if(e.altKey&&e.key==='F4'){e.preventDefault();const w=$('.window.focused:not(.hidden)');if(w)closeWindow(w)}if(e.altKey&&e.key==='Tab'){e.preventDefault();showAltTab()}});document.addEventListener('keyup',e=>{if(e.key==='Alt')commitAltTab()});
