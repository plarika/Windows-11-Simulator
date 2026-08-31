"use strict";
(function installAppsDefaultsV985(){
  const VERSION="9.8.5";
  const store=globalThis.Win11SettingsStore;
  const bus=globalThis.Win11SystemBus;
  if(!store||!bus)throw new Error("Apps & Defaults V9.8.5 requires Settings Core and System Bus.");

  const APPS_V985=Object.freeze({
    edge:Object.freeze({id:"edge",name:"Microsoft Edge",icon:"🌐",files:["html","pdf"],protocols:["http","https"]}),
    notepad:Object.freeze({id:"notepad",name:"Bloco de Notas",icon:"📝",files:["text","html"],protocols:[]}),
    photos:Object.freeze({id:"photos",name:"Fotografias",icon:"🖼️",files:["image"],protocols:[]}),
    paint:Object.freeze({id:"paint",name:"Pintar",icon:"🎨",files:["image"],protocols:[]}),
    mediaplayer:Object.freeze({id:"mediaplayer",name:"Media Player",icon:"▶️",files:["audio","video"],protocols:[]})
  });
  const EXACT=Object.freeze({
    ".txt":"txtApp",".html":"htmlApp",".htm":"htmlApp",".png":"pngApp",
    ".jpg":"jpgApp",".jpeg":"jpgApp",".mp3":"mp3App",".mp4":"mp4App",".pdf":"pdfApp"
  });
  const FALLBACK=Object.freeze({
    ".md":"defaultText",".log":"defaultText",".json":"defaultText",".csv":"defaultText",
    ".js":"defaultText",".css":"defaultText",".xml":"defaultText",".ini":"defaultText",
    ".webp":"defaultImage",".gif":"defaultImage",".bmp":"defaultImage",".svg":"defaultImage",
    ".wav":"defaultMedia",".ogg":"defaultMedia",".m4a":"defaultMedia",".aac":"defaultMedia",
    ".flac":"defaultMedia",".webm":"defaultMedia",".mov":"defaultMedia",".mkv":"defaultMedia",".avi":"defaultMedia"
  });
  const PROTOCOLS=Object.freeze({http:"httpApp",https:"httpsApp"});
  const ROWS=Object.freeze([
    [".txt","Texto"],[".html","HTML"],[".png","PNG"],[".jpg","JPEG"],
    [".mp3","MP3"],[".mp4","MP4"],[".pdf","PDF"],["http","HTTP"],["https","HTTPS"]
  ]);

  function extensionOf(name){
    const clean=String(name||"").toLowerCase().split(/[?#]/)[0];
    const i=clean.lastIndexOf(".");
    return i>0?clean.slice(i):"";
  }
  function normalizeExtension(ext){
    ext=String(ext||"").trim().toLowerCase();
    if(!ext)return "";
    if(!ext.startsWith("."))ext="."+ext;
    if(!/^\.[a-z0-9]{1,10}$/.test(ext))throw new TypeError("Extensão inválida.");
    return ext;
  }
  function normalizeProtocol(value){
    const raw=String(value||"").trim().toLowerCase();
    const p=raw.endsWith(":")?raw.slice(0,-1):raw;
    if(!Object.prototype.hasOwnProperty.call(PROTOCOLS,p))throw new TypeError("Protocolo não suportado.");
    return p;
  }
  function categoryForExtension(ext){
    ext=normalizeExtension(ext);
    if([".txt",".md",".log",".json",".csv",".js",".css",".xml",".ini"].includes(ext))return "text";
    if([".html",".htm"].includes(ext))return "html";
    if([".png",".jpg",".jpeg",".webp",".gif",".bmp",".svg"].includes(ext))return "image";
    if([".mp3",".wav",".ogg",".m4a",".aac",".flac"].includes(ext))return "audio";
    if([".mp4",".webm",".mov",".mkv",".avi"].includes(ext))return "video";
    if(ext===".pdf")return "pdf";
    return "unknown";
  }
  function settingForExtension(ext){
    ext=normalizeExtension(ext);
    return EXACT[ext]||FALLBACK[ext]||null;
  }
  function appInfo(id){
    const app=APPS_V985[String(id||"")];
    return app?{...app,files:[...app.files],protocols:[...app.protocols]}:null;
  }
  function supportsFile(id,ext){
    const app=APPS_V985[id],cat=categoryForExtension(ext);
    if(!app)return false;
    return app.files.includes(cat)||(cat==="pdf"&&app.files.includes("pdf"));
  }

  function candidatesForExtension(ext){
    ext=normalizeExtension(ext);
    return Object.values(APPS_V985).filter(app=>supportsFile(app.id,ext)).map(app=>appInfo(app.id));
  }
  function candidatesForFile(name,value=null,mime=""){
    const ext=extensionOf(name);
    if(ext&&settingForExtension(ext))return candidatesForExtension(ext);
    const type=String(mime||value?.type||"").toLowerCase();
    let cat="unknown";
    if(type.startsWith("text/"))cat="text";
    else if(type.startsWith("image/"))cat="image";
    else if(type.startsWith("audio/"))cat="audio";
    else if(type.startsWith("video/"))cat="video";
    return Object.values(APPS_V985).filter(app=>app.files.includes(cat)).map(app=>appInfo(app.id));
  }
  function candidatesForProtocol(protocol){
    protocol=normalizeProtocol(protocol);
    return Object.values(APPS_V985).filter(app=>app.protocols.includes(protocol)).map(app=>appInfo(app.id));
  }
  function forFile(name){
    const ext=extensionOf(name),key=ext?settingForExtension(ext):null;
    if(!key)return null;
    const id=store.get("apps."+key);
    return supportsFile(id,ext)?id:null;
  }
  function setForFile(ext,appId,{source="default-apps-v985"}={}){
    ext=normalizeExtension(ext);
    const key=settingForExtension(ext);
    if(!key)throw new RangeError("Tipo de ficheiro não suportado.");
    if(!supportsFile(appId,ext))throw new TypeError("Aplicação incompatível com "+ext+".");
    return store.set("apps."+key,String(appId),{source});
  }
  function forProtocol(protocol){
    protocol=normalizeProtocol(protocol);
    const id=store.get("apps."+PROTOCOLS[protocol]);
    return APPS_V985[id]?.protocols.includes(protocol)?id:null;
  }
  function setForProtocol(protocol,appId,{source="default-apps-v985"}={}){
    protocol=normalizeProtocol(protocol);
    if(!APPS_V985[appId]?.protocols.includes(protocol))throw new TypeError("Aplicação incompatível com "+protocol+".");
    return store.set("apps."+PROTOCOLS[protocol],String(appId),{source});
  }

  function edgeWindow(){
    const existing=[...document.querySelectorAll('.window[data-app="edge"]')]
      .find(w=>Number(w.dataset.desktop||0)===(Number(state.currentDesktop)||0));
    return existing||openApp("edge");
  }
  function openProtocol(url){
    url=String(url||"").trim();
    let parsed;
    try{parsed=new URL(url)}catch{throw new TypeError("URL inválido.")}
    const protocol=normalizeProtocol(parsed.protocol);
    const appId=forProtocol(protocol);
    if(appId!=="edge")throw new Error("Não existe browser compatível configurado.");
    const win=edgeWindow(),edge=win?.querySelector(".edge-v730");
    if(!edge?.__edgeV730?.newTab)throw new Error("O Edge ainda não está pronto.");
    win.classList.remove("hidden");focusWindow(win);
    edge.__edgeV730.newTab(parsed.href);
    return true;
  }

  function sanitizeHtmlDocument(text,name){
    const doc=new DOMParser().parseFromString(String(text||""),"text/html");
    doc.querySelectorAll("script,style,link,iframe,frame,object,embed,base,form,input,button,textarea,select,meta").forEach(n=>n.remove());
    for(const el of doc.querySelectorAll("*")){
      for(const attr of [...el.attributes]){
        const key=attr.name.toLowerCase(),value=attr.value.trim();
        if(key.startsWith("on")||["style","srcdoc","formaction"].includes(key)){el.removeAttribute(attr.name);continue}
        if(key==="src"&&!/^data:image\//i.test(value)){el.removeAttribute(attr.name);continue}
        if(key==="href"){
          if(!/^https?:\/\//i.test(value)){el.removeAttribute(attr.name);continue}
          el.setAttribute("target","_blank");el.setAttribute("rel","noopener noreferrer");
        }
      }
    }
    const title=escapeHTML(name||"Documento HTML");
    return '<!doctype html><html><head><meta charset="utf-8">'+
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\'">'+
      '<title>'+title+'</title><style>body{font:14px Segoe UI,Arial,sans-serif;margin:24px;color:#1f2328;background:#fff;line-height:1.5}img{max-width:100%}pre{white-space:pre-wrap}</style></head>'+
      '<body>'+doc.body.innerHTML+'</body></html>';
  }

  async function openEdgeFile(path,name,value,item=null){
    const ext=extensionOf(name);
    if(![".html",".htm",".pdf"].includes(ext))throw new Error("O Edge só abre HTML e PDF locais nesta versão.");
    if(!item){
      if(!globalThis.Win11DesktopIntegration?.materializeFile)throw new Error("Integração de ficheiros indisponível.");
      item=await Win11DesktopIntegration.materializeFile(path,name,value);
    }
    const win=openAppNewWindow("edge"),edge=win.querySelector(".edge-v730"),page=edge?.querySelector(".edge-real-page"),address=edge?.querySelector(".edge-real-address");
    if(!edge||!page)throw new Error("Não foi possível preparar o visualizador do Edge.");
    const virtualUrl="file://virtual/"+String(path||"").replace(/^\/+|\/+$/g,"")+"/"+name;
    if(address){address.value=virtualUrl;address.setAttribute("readonly","")}
    page.innerHTML="";
    const shell=document.createElement("section");shell.className="edge-local-document-v985";
    shell.innerHTML='<header><span>Documento local seguro</span><strong>'+escapeHTML(name)+'</strong></header>';
    if(ext===".html"||ext===".htm"){
      const frame=document.createElement("iframe");
      frame.className="edge-local-html-v985";frame.setAttribute("sandbox","");
      frame.setAttribute("referrerpolicy","no-referrer");
      frame.srcdoc=sanitizeHtmlDocument(await item.text(),name);
      shell.appendChild(frame);
    }else{
      const pdfBlob=item.blob.type==="application/pdf"?item.blob:new Blob([item.blob],{type:"application/pdf"});
      const url=URL.createObjectURL(pdfBlob),frame=document.createElement("iframe");
      frame.className="edge-local-pdf-v985";frame.src=url;frame.setAttribute("sandbox","");
      frame.setAttribute("referrerpolicy","no-referrer");shell.appendChild(frame);
      const obs=new MutationObserver(()=>{if(win.isConnected)return;URL.revokeObjectURL(url);obs.disconnect()});
      obs.observe(document.body,{childList:true,subtree:true});
    }
    page.appendChild(shell);
    win.dataset.localDocument=name;
    const title=win.querySelector(".win-title span:last-child");if(title)title.textContent=name+" — Microsoft Edge";
    return true;
  }

  function syncLegacySnapshot(){
    if(!state.fileAssociations||typeof state.fileAssociations!=="object")state.fileAssociations={};
    if(!state.protocolAssociations||typeof state.protocolAssociations!=="object")state.protocolAssociations={};
    for(const ext of Object.keys({...EXACT,...FALLBACK})){
      const app=forFile("ficheiro"+ext);
      if(app)state.fileAssociations[ext]=app;
    }
    for(const protocol of Object.keys(PROTOCOLS)){
      const app=forProtocol(protocol);if(app)state.protocolAssociations[protocol]=app;
    }
    saveState();
  }
  function rowOptions(kind){
    const apps=kind.startsWith(".")?candidatesForExtension(kind):candidatesForProtocol(kind);
    const selected=kind.startsWith(".")?forFile("ficheiro"+kind):forProtocol(kind);
    return apps.map(app=>'<option value="'+app.id+'" '+(app.id===selected?"selected":"")+'>'+escapeHTML(app.name)+'</option>').join("");
  }
  function renderSettings(box){
    box.querySelector("[data-default-apps-v700]")?.remove();
    box.querySelector("[data-default-apps-v985]")?.remove();
    const card=document.createElement("div");
    card.className="sys-card default-apps-card default-apps-v985";card.dataset.defaultAppsV985="";
    card.innerHTML='<div class="default-apps-head"><div><strong>Aplicações predefinidas V9.8.5</strong>'+
      '<p>Associações por extensão e protocolo, validadas pelo Settings Core.</p></div>'+
      '<button class="sys-button" data-default-reset-v985>Repor</button></div>'+
      '<div class="apps-registry-grid-v985">'+Object.values(APPS_V985).map(app=>
        '<div class="apps-registry-app-v985"><span>'+app.icon+'</span><strong>'+escapeHTML(app.name)+'</strong></div>'
      ).join("")+'</div>'+
      '<div class="default-apps-list">'+ROWS.map(([kind,label])=>
        '<label class="default-app-row"><span><strong>'+escapeHTML(label)+'</strong><small>'+escapeHTML(kind.startsWith(".")?kind:kind.toUpperCase())+
        '</small></span><select data-default-kind-v985="'+escapeHTML(kind)+'">'+rowOptions(kind)+'</select></label>'
      ).join("")+'</div>';

    (box.querySelector(".sys-grid")||box).appendChild(card);
    card.querySelectorAll("[data-default-kind-v985]").forEach(select=>select.onchange=()=>{
      const kind=select.dataset.defaultKindV985,id=select.value;
      try{
        if(kind.startsWith("."))setForFile(kind,id,{source:"settings-ui-v985"});
        else setForProtocol(kind,id,{source:"settings-ui-v985"});
        notify("Aplicações predefinidas",kind+" agora abre com "+APPS_V985[id].name+".");
      }catch(err){notify("Aplicações predefinidas",err?.message||"Não foi possível alterar a associação.");renderSettings(box)}
    });
    card.querySelector("[data-default-reset-v985]")?.addEventListener("click",()=>{
      store.resetCategory("apps",{source:"settings-ui-v985-reset"});renderSettings(box);
    });
    return card;
  }

  let rerenderPending=false;
  function scheduleSettingsRerender(source){
    if(String(source||"").startsWith("settings-ui-v985"))return;
    if(rerenderPending)return;rerenderPending=true;
    queueMicrotask(()=>{
      rerenderPending=false;
      document.querySelectorAll('.window[data-app="settings"] [data-settings-page]').forEach(box=>{
        if(state.settingsPage==="apps")renderSettings(box);
      });
    });
  }
  bus.on("settings:apps:changed",event=>{syncLegacySnapshot();scheduleSettingsRerender(event.detail?.source)});
  syncLegacySnapshot();

  globalThis.Win11AppRegistry=Object.freeze({
    version:VERSION,list:()=>Object.keys(APPS_V985).map(appInfo),get:appInfo,
    has:id=>Boolean(APPS_V985[id]),candidatesForExtension,candidatesForFile,candidatesForProtocol,
    supportsFile,supportsProtocol:(id,protocol)=>{try{return APPS_V985[id]?.protocols.includes(normalizeProtocol(protocol))||false}catch{return false}}
  });
  globalThis.Win11FileAssociations=Object.freeze({
    version:VERSION,extensionOf,categoryForExtension,settingForExtension,
    get:ext=>forFile("ficheiro"+normalizeExtension(ext)),set:setForFile,
    resolve:forFile,candidates:candidatesForExtension
  });

  globalThis.Win11ProtocolRegistry=Object.freeze({
    version:VERSION,get:forProtocol,set:setForProtocol,open:openProtocol,
    normalize:normalizeProtocol,candidates:candidatesForProtocol
  });
  globalThis.Win11DefaultApps=Object.freeze({
    version:VERSION,forFile,setForFile,forProtocol,setForProtocol,openProtocol,
    openEdgeFile,sanitizeHtmlDocument,renderSettings,
    reset:()=>store.resetCategory("apps",{source:"default-apps-v985-reset"}),
    get state(){return Object.freeze(store.get("apps"))}
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:35,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "app-registry","default-apps-store","file-associations","protocol-registry",
      "edge-local-html-safe-preview","edge-local-pdf-viewer","default-apps-settings"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
