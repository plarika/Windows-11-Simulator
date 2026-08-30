"use strict";
/* Windows 11 Simulator V6.4 — Real File Bridge */
(function installRealFileBridge(){
  const nativeOpenSupported=typeof window.showOpenFilePicker==="function";
  const nativeSaveSupported=typeof window.showSaveFilePicker==="function";

  async function pickTextFile(){
    if(nativeOpenSupported){
      const [handle]=await window.showOpenFilePicker({
        multiple:false,
        types:[{
          description:"Documento de texto",
          accept:{"text/plain":[".txt",".md",".log",".csv"]}
        }]
      });
      const file=await handle.getFile();
      return {
        name:file.name,
        text:await file.text(),
        handle,
        source:"device"
      };
    }

    return new Promise((resolve,reject)=>{
      const input=document.createElement("input");
      input.type="file";
      input.accept=".txt,.md,.log,.csv,text/plain,text/markdown,text/csv";
      input.hidden=true;
      input.onchange=async()=>{
        const file=input.files?.[0];
        input.remove();
        if(!file){reject(new DOMException("Seleção cancelada.","AbortError"));return}
        resolve({
          name:file.name,
          text:await file.text(),
          handle:null,
          source:"device-fallback"
        });
      };
      input.addEventListener("cancel",()=>{
        input.remove();
        reject(new DOMException("Seleção cancelada.","AbortError"));
      },{once:true});
      document.body.appendChild(input);
      input.click();
    });
  }

  async function writeHandle(handle,text){
    const writable=await handle.createWritable();
    try{
      await writable.write(text);
    }finally{
      await writable.close();
    }
    return handle;
  }

  function downloadText(name,text){
    const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=name||"Documento.txt";
    a.rel="noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    return {name:a.download,handle:null,source:"download"};
  }

  async function saveText({handle=null,name="Documento.txt",text="",forcePicker=false}={}){
    if(handle&&!forcePicker&&typeof handle.createWritable==="function"){
      await writeHandle(handle,text);
      return {name:handle.name||name,handle,source:"device"};
    }

    if(nativeSaveSupported){
      const nextHandle=await window.showSaveFilePicker({
        suggestedName:name,
        types:[{
          description:"Documento de texto",
          accept:{"text/plain":[".txt",".md",".log",".csv"]}
        }]
      });
      await writeHandle(nextHandle,text);
      return {name:nextHandle.name||name,handle:nextHandle,source:"device"};
    }

    return downloadText(name,text);
  }

  globalThis.RealFileBridge=Object.freeze({
    version:"6.8.0",
    nativeOpenSupported,
    nativeSaveSupported,
    pickTextFile,
    saveText,
    writeHandle,
    downloadText
  });

  globalThis.buildNotepadV5=function(wrap){
    wrap.className="notepad notepad-real-files";
    wrap.innerHTML='<div class="app-toolbar notepad-toolbar-real">'+
      '<button data-new>Novo</button>'+
      '<button data-open-virtual>Abrir virtual</button>'+
      '<button data-save-virtual>Guardar virtual</button>'+
      '<button data-saveas data-saveas-virtual>Guardar como virtual</button>'+
      '<span class="toolbar-divider"></span>'+
      '<button data-open-device title="Abrir um ficheiro real com autorização">Abrir do dispositivo</button>'+
      '<button data-save-device title="Guardar no dispositivo">Guardar no dispositivo</button>'+
      '<span class="toolbar-divider"></span>'+
      '<button data-copy>Copiar</button><button data-cut>Cortar</button><button data-paste>Colar</button>'+
      '<span style="flex:1"></span><button data-time>Hora/Data</button>'+
      '</div>'+
      '<textarea spellcheck="false"></textarea>'+
      '<div class="notepad-real-status"><span data-doc-source>Virtual · Notas.txt</span><span data-dirty>Guardado</span></div>';

    const ta=wrap.querySelector("textarea");
    const sourceLabel=wrap.querySelector("[data-doc-source]");
    const dirtyLabel=wrap.querySelector("[data-dirty]");

    let virtualCurrent={path:"C:/Documents",name:"Notas.txt"};
    let realCurrent=null;
    let dirty=false;

    ta.value=state.notepadText||"";

    function setDirty(value){
      dirty=Boolean(value);
      dirtyLabel.textContent=dirty?"Modificado":"Guardado";
      dirtyLabel.classList.toggle("dirty",dirty);
    }

    function showSource(){
      if(realCurrent){
        sourceLabel.textContent="Dispositivo · "+realCurrent.name+
          (RealFileBridge.nativeSaveSupported?"":" · modo download");
      }else{
        sourceLabel.textContent="Virtual · "+virtualCurrent.name;
      }
    }

    function syncState(){
      state.notepadText=ta.value;
      saveState();
    }

    function resetReal(){
      realCurrent=null;
      showSource();
    }

    ta.oninput=()=>{
      syncState();
      setDirty(true);
    };

    wrap.querySelector("[data-new]").onclick=()=>{
      ta.value="";
      virtualCurrent={path:"C:/Documents",name:"Sem título.txt"};
      realCurrent=null;
      syncState();
      setDirty(false);
      showSource();
      ta.focus();
    };

    wrap.querySelector("[data-open-virtual]").onclick=()=>showVirtualFileDialog({
      mode:"open",
      accept:".txt",
      onSelect:f=>{
        ta.value=String(f.value??"");
        virtualCurrent={path:f.path,name:f.name};
        realCurrent=null;
        syncState();
        touchRecent(f.path+"/"+f.name);
        setDirty(false);
        showSource();
        ta.focus();
      }
    });

    wrap.querySelector("[data-save-virtual]").onclick=()=>{
      ensureFolder(virtualCurrent.path)[virtualCurrent.name]=ta.value;
      touchRecent(virtualCurrent.path+"/"+virtualCurrent.name);
      syncState();
      setDirty(false);
      notify("Bloco de Notas",virtualCurrent.name+" guardado no Windows virtual.");
    };

    wrap.querySelector("[data-saveas]").onclick=()=>showVirtualFileDialog({
      mode:"save",
      accept:".txt",
      defaultName:virtualCurrent.name==="Sem título.txt"?"Documento.txt":virtualCurrent.name,
      onSelect:f=>{
        ensureFolder(f.path)[f.name]=ta.value;
        virtualCurrent={path:f.path,name:f.name};
        realCurrent=null;
        touchRecent(f.path+"/"+f.name);
        syncState();
        setDirty(false);
        showSource();
        notify("Bloco de Notas",f.name+" guardado no Windows virtual.");
      }
    });

    wrap.querySelector("[data-open-device]").onclick=async()=>{
      try{
        const file=await RealFileBridge.pickTextFile();
        ta.value=file.text;
        realCurrent={name:file.name,handle:file.handle,source:file.source};
        virtualCurrent={path:"C:/Documents",name:file.name};
        syncState();
        setDirty(false);
        showSource();
        notify("Bloco de Notas",file.name+" aberto do dispositivo.");
        ta.focus();
      }catch(err){
        if(err?.name!=="AbortError")notify("Bloco de Notas","Não foi possível abrir o ficheiro real.");
      }
    };

    wrap.querySelector("[data-save-device]").onclick=async()=>{
      try{
        const suggested=realCurrent?.name||virtualCurrent.name||"Documento.txt";
        const result=await RealFileBridge.saveText({
          handle:realCurrent?.handle||null,
          name:suggested,
          text:ta.value
        });
        realCurrent=result;
        setDirty(false);
        showSource();
        notify(
          "Bloco de Notas",
          result.source==="download"
            ? result.name+" transferido para o dispositivo."
            : result.name+" guardado no dispositivo."
        );
      }catch(err){
        if(err?.name!=="AbortError")notify("Bloco de Notas","Não foi possível guardar no dispositivo.");
      }
    };

    wrap.querySelector("[data-copy]").onclick=()=>{
      const a=ta.selectionStart,b=ta.selectionEnd;
      addClipboard(ta.value.slice(a,b)||ta.value);
    };
    wrap.querySelector("[data-cut]").onclick=()=>{
      const a=ta.selectionStart,b=ta.selectionEnd;
      if(a===b)return;
      addClipboard(ta.value.slice(a,b));
      ta.setRangeText("",a,b,"start");
      syncState();
      setDirty(true);
    };
    wrap.querySelector("[data-paste]").onclick=()=>{
      const text=(state.clipboard||[])[0]||"";
      ta.setRangeText(text,ta.selectionStart,ta.selectionEnd,"end");
      syncState();
      setDirty(true);
    };
    wrap.querySelector("[data-time]").onclick=()=>{
      ta.setRangeText(new Date().toLocaleString("pt-PT"),ta.selectionStart,ta.selectionEnd,"end");
      syncState();
      setDirty(true);
    };

    showSource();
    setDirty(false);
  };

  globalThis.Win11RealFunctions=Object.freeze({
    version:"6.8.0",
    step:1,
    features:["real-file-open","real-file-save","download-fallback"]
  });
})();
