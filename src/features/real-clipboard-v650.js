"use strict";
/* Windows 11 Simulator V6.5 — Real Clipboard Bridge */
(function installRealClipboardBridge(){
  const canNativeWrite=Boolean(navigator.clipboard?.writeText);
  const canNativeRead=Boolean(navigator.clipboard?.readText);

  async function fallbackWrite(text){
    const ta=document.createElement("textarea");
    ta.value=String(text??"");
    ta.setAttribute("readonly","");
    ta.style.position="fixed";
    ta.style.left="-9999px";
    ta.style.top="0";
    ta.style.opacity="0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0,ta.value.length);
    let ok=false;
    try{
      ok=document.execCommand("copy");
    }finally{
      ta.remove();
    }
    if(!ok)throw new DOMException("A cópia não foi autorizada pelo navegador.","NotAllowedError");
    return true;
  }

  async function writeText(text){
    text=String(text??"");
    if(!text)return false;
    if(canNativeWrite&&window.isSecureContext){
      try{
        await navigator.clipboard.writeText(text);
        return true;
      }catch(err){
        if(err?.name!=="NotAllowedError"&&err?.name!=="SecurityError")throw err;
      }
    }
    return fallbackWrite(text);
  }

  function manualPasteDialog(){
    return new Promise((resolve,reject)=>{
      const dialog=document.querySelector("#system-dialog");
      const title=document.querySelector("#system-dialog-title");
      const body=document.querySelector("#system-dialog-body");
      const ok=document.querySelector("#system-dialog-ok");
      const close=document.querySelector("#system-dialog-x");
      if(!dialog||!title||!body||!ok){
        reject(new Error("Diálogo do sistema indisponível."));
        return;
      }

      title.textContent="Colar do dispositivo";
      body.innerHTML=
        '<p style="margin-top:0">O navegador não permitiu ler automaticamente a área de transferência.</p>'+
        '<p>Cole manualmente o texto na caixa abaixo e carregue em <strong>Importar</strong>.</p>'+
        '<textarea data-real-paste-box class="real-paste-box" placeholder="Toque aqui e escolha Colar"></textarea>'+
        '<small class="real-clipboard-note">O conteúdo só é lido após esta ação.</small>';

      const input=body.querySelector("[data-real-paste-box]");
      const previousCloseHandler=close.onclick;
      let settled=false;
      const onBackdrop=e=>{if(e.target===dialog)cancel()};

      function cleanup(){
        ok.onclick=null;
        close.onclick=previousCloseHandler;
        dialog.removeEventListener("pointerdown",onBackdrop,true);
      }
      function finish(value){
        if(settled)return;
        settled=true;
        cleanup();
        dialog.classList.remove("open");
        resolve(String(value??""));
      }
      function cancel(){
        if(settled)return;
        settled=true;
        cleanup();
        dialog.classList.remove("open");
        reject(new DOMException("Operação cancelada.","AbortError"));
      }

      input.addEventListener("paste",e=>{
        const pasted=e.clipboardData?.getData("text/plain");
        if(typeof pasted==="string"&&pasted){
          e.preventDefault();
          input.value=pasted;
        }
      });

      ok.textContent="Importar";
      ok.onclick=()=>finish(input.value);
      close.onclick=cancel;
      dialog.addEventListener("pointerdown",onBackdrop,true);
      dialog.classList.add("open");
      setTimeout(()=>input.focus(),0);
    });
  }

  async function readText(){
    if(canNativeRead&&window.isSecureContext){
      try{
        const text=await navigator.clipboard.readText();
        if(typeof text==="string"&&text.length)return text;
      }catch(err){
        if(err?.name!=="NotAllowedError"&&err?.name!=="SecurityError")throw err;
      }
    }
    return manualPasteDialog();
  }

  globalThis.RealClipboardBridge=Object.freeze({
    version:"6.7.3",
    canNativeRead,
    canNativeWrite,
    writeText,
    readText,
    manualPasteDialog
  });

  function clipboardCapabilityText(){
    if(canNativeRead&&canNativeWrite&&window.isSecureContext)return "Clipboard API disponível";
    if(canNativeWrite&&window.isSecureContext)return "Escrita nativa · leitura com fallback";
    return "Modo compatível · ações manuais quando necessário";
  }

  globalThis.renderClipboard=function(){
    const box=document.querySelector("#clipboard-list");
    if(!box)return;
    box.innerHTML="";

    const tools=document.createElement("div");
    tools.className="real-clipboard-tools";
    tools.innerHTML=
      '<div><strong>Área de transferência</strong><small>'+escapeHTML(clipboardCapabilityText())+'</small></div>'+
      '<div class="real-clipboard-actions">'+
      '<button class="sys-button" data-real-clip-read>Ler do dispositivo</button>'+
      '<button class="sys-button" data-real-clip-write>Copiar último para dispositivo</button>'+
      '</div>';
    box.appendChild(tools);

    tools.querySelector("[data-real-clip-read]").onclick=async()=>{
      try{
        const text=await RealClipboardBridge.readText();
        if(!text)return;
        addClipboard(text);
        notify("Área de transferência","Texto importado do dispositivo.");
      }catch(err){
        if(err?.name!=="AbortError")notify("Área de transferência","Não foi possível ler a área de transferência do dispositivo.");
      }
    };

    tools.querySelector("[data-real-clip-write]").onclick=async()=>{
      const text=(state.clipboard||[])[0]||"";
      if(!text){
        notify("Área de transferência","Não existe conteúdo virtual para copiar.");
        return;
      }
      try{
        await RealClipboardBridge.writeText(text);
        notify("Área de transferência","Último item copiado para a área de transferência do dispositivo.");
      }catch{
        notify("Área de transferência","O navegador não permitiu copiar para o dispositivo.");
      }
    };

    const items=document.createElement("div");
    items.className="real-clipboard-items";

    (state.clipboard||[]).forEach((text,i)=>{
      const item=document.createElement("div");
      item.className="clip-item real-clip-item";
      item.innerHTML=
        '<div class="real-clip-text">'+escapeHTML(String(text).slice(0,220))+'</div>'+
        '<small>Item '+(i+1)+'</small>'+
        '<div class="real-clip-item-actions">'+
        '<button data-send-notepad>Bloco de Notas</button>'+
        '<button data-copy-device>Copiar para dispositivo</button>'+
        '</div>';

      item.querySelector("[data-send-notepad]").onclick=()=>{
        state.notepadText=String(text);
        saveState();
        closeOverlays();
        openApp("notepad");
        notify("Área de transferência","Conteúdo enviado para o Bloco de Notas.");
      };

      item.querySelector("[data-copy-device]").onclick=async()=>{
        try{
          await RealClipboardBridge.writeText(text);
          notify("Área de transferência","Item copiado para o dispositivo.");
        }catch{
          notify("Área de transferência","O navegador bloqueou a cópia.");
        }
      };

      items.appendChild(item);
    });

    if(!(state.clipboard||[]).length){
      items.innerHTML='<div class="search-empty">A área de transferência virtual está vazia.</div>';
    }
    box.appendChild(items);
  };

  const notepadWithRealFiles=globalThis.buildNotepadV5;
  globalThis.buildNotepadV5=function(wrap){
    notepadWithRealFiles(wrap);

    const toolbar=wrap.querySelector(".notepad-toolbar-real,.app-toolbar");
    const ta=wrap.querySelector("textarea");
    if(!toolbar||!ta)return;

    const anchor=toolbar.querySelector("[data-paste]");
    if(!anchor)return;

    const copyReal=document.createElement("button");
    copyReal.dataset.copyDevice="";
    copyReal.textContent="Copiar dispositivo";
    copyReal.title="Copiar texto selecionado para a área de transferência real";

    const pasteReal=document.createElement("button");
    pasteReal.dataset.pasteDevice="";
    pasteReal.textContent="Colar dispositivo";
    pasteReal.title="Colar texto da área de transferência real";

    anchor.after(copyReal,pasteReal);

    copyReal.onclick=async()=>{
      const a=ta.selectionStart,b=ta.selectionEnd;
      const text=ta.value.slice(a,b)||ta.value;
      if(!text){
        notify("Bloco de Notas","Não existe texto para copiar.");
        return;
      }
      try{
        await RealClipboardBridge.writeText(text);
        addClipboard(text);
        notify("Bloco de Notas","Texto copiado para o dispositivo.");
      }catch{
        notify("Bloco de Notas","O navegador não permitiu copiar para o dispositivo.");
      }
    };

    pasteReal.onclick=async()=>{
      try{
        const text=await RealClipboardBridge.readText();
        if(!text)return;
        ta.setRangeText(text,ta.selectionStart,ta.selectionEnd,"end");
        ta.dispatchEvent(new Event("input",{bubbles:true}));
        addClipboard(text);
        notify("Bloco de Notas","Texto colado do dispositivo.");
        ta.focus();
      }catch(err){
        if(err?.name!=="AbortError")notify("Bloco de Notas","Não foi possível colar do dispositivo.");
      }
    };
  };

  globalThis.Win11RealFunctions=Object.freeze({
    version:"6.7.3",
    step:2,
    features:[
      "real-file-open",
      "real-file-save",
      "download-fallback",
      "real-clipboard-write",
      "real-clipboard-read",
      "clipboard-manual-paste-fallback"
    ]
  });
})();
