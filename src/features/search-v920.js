"use strict";
(function installSearchV920(){
  const VERSION="9.2.0";
  const TYPE_ALIASES={
    app:"app",apps:"app",aplicacao:"app","aplicação":"app",aplicacoes:"app","aplicações":"app",
    setting:"setting",settings:"setting",definicao:"setting","definição":"setting",definicoes:"setting","definições":"setting",
    file:"file",ficheiro:"file",folder:"folder",pasta:"folder",
    image:"image",imagem:"image",photo:"image",foto:"image",
    text:"text",texto:"text",document:"text",documento:"text",
    audio:"audio",musica:"audio","música":"audio",video:"video",shortcut:"shortcut",atalho:"shortcut"
  };
  const APP_ALIASES={
    notepad:"bloco de notas notepad editor texto",
    explorer:"explorador ficheiros pastas este pc",
    calc:"calculadora calculator",
    settings:"definições settings configurações",
    taskmanager:"gestor tarefas task manager",
    photos:"fotografias fotos imagens photos",
    edge:"browser navegador internet microsoft edge",
    terminal:"terminal consola command prompt",
    paint:"paint pintar desenho"
  };
  const SETTINGS_INDEX=[
    {name:"Sistema",page:"system",terms:"ecrã som armazenamento energia dispositivo"},
    {name:"Bluetooth e dispositivos",page:"devices",terms:"bluetooth câmara microfone dispositivos"},
    {name:"Rede e Internet",page:"network",terms:"rede internet wifi online ligação"},
    {name:"Personalização",page:"personalization",terms:"tema wallpaper fundo cores barra tarefas"},
    {name:"Aplicações",page:"apps",terms:"apps aplicações predefinidas instalar pwa"},
    {name:"Contas",page:"accounts",terms:"contas utilizadores perfil pin palavra passe"},
    {name:"Privacidade e segurança",page:"privacy",terms:"privacidade segurança permissões proteção"},
    {name:"Windows Update",page:"system",terms:"update atualização versão"}
  ];
  const IMAGE_EXT=new Set(["png","jpg","jpeg","webp","gif","svg","bmp"]);
  const AUDIO_EXT=new Set(["mp3","wav","ogg","m4a","aac","flac"]);
  const VIDEO_EXT=new Set(["mp4","webm","mov","mkv","avi"]);
  const TEXT_EXT=new Set(["txt","md","log","json","csv","xml","html","css","js","mjs","ts","ini","cfg"]);

  let dirty=true,indexCache=[],indexVersion=0,lastFingerprint="";

  function normalize(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
  function extOf(name){const s=String(name||""),i=s.lastIndexOf(".");return i>0?s.slice(i+1).toLowerCase():""}
  function valueSize(value){
    if(value==null)return 0;
    if(typeof value==="string")return new Blob([value]).size;
    if(value instanceof Blob)return value.size;
    if(Number.isFinite(Number(value?.size)))return Number(value.size);
    try{return new Blob([JSON.stringify(value)]).size}catch{return 0}
  }
  function fileKind(name,value){
    if(globalThis.Win11ExplorerFilesystem?.shortcutTarget?.(value))return "shortcut";
    const ext=extOf(name);
    if(IMAGE_EXT.has(ext))return "image";
    if(AUDIO_EXT.has(ext))return "audio";
    if(VIDEO_EXT.has(ext))return "video";
    if(TEXT_EXT.has(ext))return "text";
    return "file";
  }
  function parentOf(path){
    const s=String(path||"").replace(/\/$/,""),i=s.lastIndexOf("/");
    return i>1?s.slice(0,i):"";
  }
  function baseOf(path){const s=String(path||"").replace(/\/$/,""),i=s.lastIndexOf("/");return i>=0?s.slice(i+1):s}

  function fingerprint(){
    const folders=Object.keys(state.files||{});
    let files=0;
    for(const f of folders)files+=Object.keys(state.files[f]||{}).length;
    const meta=Object.keys(globalThis.Win11ExplorerFilesystem?.getState?.().metadata||{}).length;
    return folders.length+":"+files+":"+meta;
  }
  function invalidate(){dirty=true}

  function folderSize(root){
    const prefix=root+"/";let size=0;
    for(const [path,files] of Object.entries(state.files||{})){
      if(path!==root&&!path.startsWith(prefix))continue;
      for(const value of Object.values(files||{}))size+=valueSize(value);
    }
    return size;
  }  function buildIndex(){
    const entries=[],fsState=globalThis.Win11ExplorerFilesystem?.getState?.()||{showHidden:false};
    for(const [id,a] of Object.entries(APPS||{})){
      entries.push({type:"app",kind:"app",id,name:a.name,detail:"Aplicação",searchText:a.name+" "+id+" "+(APP_ALIASES[id]||""),size:0,modified:0,hidden:false});
    }
    for(const item of SETTINGS_INDEX){
      entries.push({type:"setting",kind:"setting",name:item.name,page:item.page,detail:"Definição",searchText:item.name+" "+item.terms,size:0,modified:0,hidden:false});
    }

    const folderKeys=Object.keys(state.files||{}).filter(path=>path.includes("/"));
    for(const full of folderKeys){
      const parent=parentOf(full),name=baseOf(full);
      if(!parent||!name)continue;
      const meta=globalThis.Win11ExplorerFilesystem?.getMetadata?.(parent,name,"folder")||{};
      entries.push({
        type:"file",kind:"folder",path:parent,name,detail:parent,
        searchText:name+" "+parent,size:folderSize(full),modified:Number(meta.modified)||0,hidden:!!meta.hidden
      });
    }

    for(const [path,files] of Object.entries(state.files||{})){
      for(const [name,value] of Object.entries(files||{})){
        const meta=globalThis.Win11ExplorerFilesystem?.getMetadata?.(path,name,"file")||{};
        const shortcut=globalThis.Win11ExplorerFilesystem?.shortcutTarget?.(value);
        const content=typeof value==="string"&&!value.startsWith("data:")?value.slice(0,4000):"";
        const shortcutText=shortcut?(shortcut.path+" "+shortcut.name):"";
        entries.push({
          type:"file",kind:fileKind(name,value),path,name,detail:path,
          searchText:name+" "+path+" "+content+" "+shortcutText,
          extension:extOf(name),size:valueSize(value),modified:Number(meta.modified)||Number(value?.lastModified)||0,
          hidden:!!meta.hidden,shortcut
        });
      }
    }
    indexCache=entries;dirty=false;lastFingerprint=fingerprint();indexVersion++;
    return entries;
  }
  function ensureIndex(){
    const fp=fingerprint();
    if(dirty||fp!==lastFingerprint)return buildIndex();
    return indexCache;
  }

  function tokenizeQuery(query){
    const raw=String(query||"").trim(),tokens=raw.match(/(?:[^\s"]+:"[^"]*"|"[^"]*"|\S+)/g)||[];
    const filters={},terms=[];
    for(let token of tokens){
      const m=token.match(/^([a-zA-ZÀ-ÿ]+):(.*)$/);
      if(!m){terms.push(token.replace(/^"|"$/g,""));continue}
      const key=normalize(m[1]),value=String(m[2]||"").replace(/^"|"$/g,"").trim();
      if(["type","tipo"].includes(key))filters.type=normalize(value);
      else if(["ext","extension","extensao","extensão"].includes(key))filters.ext=normalize(value).replace(/^\./,"");
      else if(["size","tamanho"].includes(key))filters.size=value;
      else if(["modified","date","modificado","data"].includes(key))filters.modified=normalize(value);
      else if(["in","path","em","pasta"].includes(key))filters.path=value;
      else if(["hidden","oculto"].includes(key))filters.hidden=normalize(value);
      else terms.push(token);
    }
    return {raw,text:terms.join(" ").trim(),filters,tokens};
  }  function parseBytes(input){
    const m=String(input||"").trim().toLowerCase().match(/^(>=|<=|>|<|=)?\s*([0-9]+(?:\.[0-9]+)?)\s*(b|kb|mb|gb)?$/);
    if(!m)return null;
    const unit={b:1,kb:1024,mb:1048576,gb:1073741824}[m[3]||"b"];
    return {op:m[1]||"=",value:Number(m[2])*unit};
  }
  function matchSize(size,expr){
    const p=parseBytes(expr);if(!p)return true;
    if(p.op===">")return size>p.value;if(p.op===">=")return size>=p.value;
    if(p.op==="<")return size<p.value;if(p.op==="<=")return size<=p.value;
    return Math.abs(size-p.value)<=Math.max(1,p.value*.02);
  }
  function matchModified(ts,expr){
    if(!expr)return true;
    const now=Date.now(),day=86400000,e=normalize(expr);
    if(!ts)return false;
    if(e==="today"||e==="hoje")return now-ts<day;
    if(["week","semana","7d"].includes(e))return now-ts<=7*day;
    if(["month","mes","mês","30d"].includes(e))return now-ts<=30*day;
    if(["year","ano","365d"].includes(e))return now-ts<=365*day;
    if(["older","antigo","antigos"].includes(e))return now-ts>30*day;
    const d=Date.parse(expr);if(Number.isFinite(d))return new Date(ts).toDateString()===new Date(d).toDateString();
    const dm=e.match(/^(\d+)d$/);if(dm)return now-ts<=Number(dm[1])*day;
    return true;
  }
  function matchType(entry,raw){
    if(!raw)return true;
    const type=TYPE_ALIASES[normalize(raw)]||normalize(raw);
    if(type==="app"||type==="setting")return entry.type===type;
    if(type==="folder")return entry.kind==="folder";
    if(type==="file")return entry.type==="file"&&entry.kind!=="folder";
    return entry.kind===type;
  }
  function boolValue(v){
    const n=normalize(v);if(["true","1","yes","sim"].includes(n))return true;
    if(["false","0","no","nao","não"].includes(n))return false;
    return null;
  }
  function passesFilters(entry,filters,showHidden){
    if(entry.hidden&&!showHidden)return false;
    if(filters.hidden!==undefined){
      const wanted=boolValue(filters.hidden);if(wanted!==null&&entry.hidden!==wanted)return false;
    }
    if(!matchType(entry,filters.type))return false;
    if(filters.ext&&entry.extension!==filters.ext)return false;
    if(filters.size&&entry.type!=="file")return false;
    if(filters.size&&!matchSize(entry.size,filters.size))return false;
    if(filters.modified&&!matchModified(entry.modified,filters.modified))return false;
    if(filters.path){
      const p=normalize(filters.path),target=normalize((entry.path||"")+" "+(entry.detail||""));
      if(!target.includes(p))return false;
    }
    return true;
  }  function textScore(query,entry){
    const q=normalize(query);if(!q)return 35;
    const name=normalize(entry.name),path=normalize(entry.path||""),text=normalize(entry.searchText||"");
    let s=0;
    if(name===q)s=170;
    else if(name.startsWith(q))s=145;
    else if(name.includes(q))s=115;
    else{
      const tokens=q.split(/\s+/).filter(Boolean);
      if(tokens.length&&tokens.every(t=>name.includes(t)))s=105;
      else if(tokens.length&&tokens.every(t=>text.includes(t)))s=82;
      else if(text.includes(q))s=72;
      else if(path.includes(q))s=58;
    }
    if(!s)return 0;
    if(entry.type==="app")s+=14;
    else if(entry.type==="setting")s+=10;
    else if(entry.kind==="folder")s+=6;
    const age=entry.modified?Date.now()-entry.modified:Infinity;
    if(age<86400000)s+=8;else if(age<7*86400000)s+=4;
    const recents=state.recents||[];
    if(entry.type==="file"&&recents.includes((entry.path||"")+"/"+entry.name))s+=6;
    return s;
  }

  function collect(query,limit=36){
    const parsed=tokenizeQuery(query);
    if(!parsed.raw)return [];
    const showHidden=!!globalThis.Win11ExplorerFilesystem?.getState?.().showHidden;
    const out=[];
    for(const entry of ensureIndex()){
      if(!passesFilters(entry,parsed.filters,showHidden))continue;
      const score=textScore(parsed.text,entry);
      if(score)out.push({...entry,score});
    }
    const rank={app:0,setting:1,file:2};
    return out.sort((a,b)=>b.score-a.score||(rank[a.type]-rank[b.type])||a.name.localeCompare(b.name,"pt-PT")).slice(0,limit);
  }

  function filterTokens(parsed){
    const out=[],f=parsed.filters;
    if(f.type)out.push({key:"type",value:f.type,label:"Tipo: "+f.type});
    if(f.ext)out.push({key:"ext",value:f.ext,label:"Extensão: ."+f.ext});
    if(f.size)out.push({key:"size",value:f.size,label:"Tamanho: "+f.size});
    if(f.modified)out.push({key:"modified",value:f.modified,label:"Modificado: "+f.modified});
    if(f.path)out.push({key:"in",value:f.path,label:"Local: "+f.path});
    if(f.hidden!==undefined)out.push({key:"hidden",value:f.hidden,label:"Oculto: "+f.hidden});
    return out;
  }
  function removeFilter(query,key){
    const aliases={type:["type","tipo"],ext:["ext","extension","extensao","extensão"],size:["size","tamanho"],modified:["modified","date","modificado","data"],in:["in","path","em","pasta"],hidden:["hidden","oculto"]}[key]||[key];
    const rx=new RegExp("(?:^|\\s)(?:"+aliases.join("|")+'):(?:"[^"]*"|\\S+)',"ig");
    return String(query||"").replace(rx," ").replace(/\s+/g," ").trim();
  }

  function suggestions(query){
    const parsed=tokenizeQuery(query),q=normalize(parsed.raw),out=[];
    const push=v=>{if(v&&!out.some(x=>normalize(x)===normalize(v)))out.push(v)};
    for(const h of state.startSearchV81?.searchHistory||[])if(!q||normalize(h).includes(q))push(h);
    const templates=[
      "type:folder","type:image","type:text","type:shortcut","ext:txt",
      "size:>1MB","modified:today","modified:week","in:Documents"
    ];
    for(const t of templates)if(!q||normalize(t).includes(q)||q.endsWith(":"))push(t);
    if(parsed.text){
      push('type:file '+parsed.text);push('type:folder '+parsed.text);push('in:Documents '+parsed.text);
    }
    return out.slice(0,8);
  }  function setQuery(value){
    const input=document.getElementById("global-search");if(!input)return;
    input.value=value;globalThis.renderGlobalSearch?.(value);input.focus();
  }
  function renderControls(host,query){
    if(!host)return;
    const parsed=tokenizeQuery(query),bar=document.createElement("div");
    bar.className="search-controls-v920";

    const quick=document.createElement("div");quick.className="search-quick-filters-v920";
    const quicks=[["Todos",""],["Aplicações","type:app"],["Pastas","type:folder"],["Imagens","type:image"],["Texto","type:text"]];
    for(const [label,filter] of quicks){
      const b=document.createElement("button");b.textContent=label;
      const active=filter?normalize(parsed.filters.type)===normalize(filter.split(":")[1]):!parsed.filters.type;
      b.classList.toggle("active",active);
      b.onclick=()=>{
        const base=removeFilter(query,"type"),next=(filter+" "+base).trim();setQuery(next);
      };
      quick.appendChild(b);
    }
    bar.appendChild(quick);

    const chips=filterTokens(parsed);
    if(chips.length){
      const row=document.createElement("div");row.className="search-active-filters-v920";
      for(const chip of chips){
        const b=document.createElement("button");b.innerHTML='<span>'+chip.label+'</span><i aria-hidden="true">×</i>';
        b.title="Remover filtro";b.onclick=()=>setQuery(removeFilter(query,chip.key));row.appendChild(b);
      }
      bar.appendChild(row);
    }

    const sugg=suggestions(query);
    if(sugg.length&&String(query||"").trim().length<48){
      const row=document.createElement("div");row.className="search-suggestions-v920";
      for(const s of sugg.slice(0,5)){
        const b=document.createElement("button");b.textContent=s;b.onclick=()=>setQuery(s);row.appendChild(b);
      }
      bar.appendChild(row);
    }
    host.appendChild(bar);
  }

  globalThis.Win11SearchV920=Object.freeze({
    version:VERSION,collect,parse:tokenizeQuery,suggestions,renderControls,invalidate,
    rebuild:()=>buildIndex(),get indexVersion(){return indexVersion},get indexSize(){return ensureIndex().length}
  });
  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:25,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "search-query-filters","search-type-filter","search-extension-filter","search-size-filter",
      "search-modified-filter","search-path-filter","search-folder-results","search-index-cache",
      "search-filter-chips","search-suggestions"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();