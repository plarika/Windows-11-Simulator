"use strict";
/* Windows 11 Simulator V6.8 — Real Device Tools */
(function installRealDeviceToolsV680(){
  let wakeLockSentinel=null;

  function formatBytes(bytes){
    const n=Number(bytes)||0;
    if(n<1024)return n+" B";
    const units=["KB","MB","GB","TB"];
    let value=n/1024,i=0;
    while(value>=1024&&i<units.length-1){value/=1024;i++}
    return value.toFixed(value>=100?0:value>=10?1:2)+" "+units[i];
  }

  function safeFileName(prefix,ext){
    const stamp=new Date().toISOString().replace(/[:.]/g,"-");
    return prefix+"-"+stamp+"."+ext;
  }

  function pickRecorderMime(){
    if(typeof MediaRecorder!=="function")return "";
    const types=[
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus"
    ];
    return types.find(t=>MediaRecorder.isTypeSupported?.(t))||"";
  }

  async function getStorageInfo(){
    const result={
      supported:Boolean(navigator.storage),
      usage:null,
      quota:null,
      persisted:null
    };
    if(!navigator.storage)return result;
    try{
      const estimate=await navigator.storage.estimate();
      result.usage=estimate.usage??null;
      result.quota=estimate.quota??null;
    }catch{}
    try{
      result.persisted=await navigator.storage.persisted();
    }catch{}
    return result;
  }

  async function requestPersistentStorage(){
    if(!navigator.storage?.persist)throw new Error("Armazenamento persistente não suportado.");
    return Boolean(await navigator.storage.persist());
  }

  async function getBatteryInfo(){
    if(typeof navigator.getBattery!=="function")return null;
    try{
      const b=await navigator.getBattery();
      return {
        level:Math.round((b.level||0)*100),
        charging:Boolean(b.charging),
        chargingTime:b.chargingTime,
        dischargingTime:b.dischargingTime
      };
    }catch{return null}
  }

  async function getDeviceInfo(){
    const storage=await getStorageInfo();
    const battery=await getBatteryInfo();
    const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;
    const uaData=navigator.userAgentData||null;
    return {
      online:navigator.onLine,
      platform:uaData?.platform||navigator.platform||"Não exposto",
      mobile:uaData?.mobile??/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),
      browser:navigator.userAgent,
      language:navigator.language||"—",
      languages:Array.from(navigator.languages||[]),
      logicalProcessors:navigator.hardwareConcurrency||null,
      deviceMemory:navigator.deviceMemory||null,
      connection:connection?{
        effectiveType:connection.effectiveType||null,
        downlink:connection.downlink??null,
        rtt:connection.rtt??null,
        saveData:Boolean(connection.saveData)
      }:null,
      storage,
      battery,
      secureContext:window.isSecureContext,
      mediaDevices:Boolean(navigator.mediaDevices),
      mediaRecorder:typeof MediaRecorder==="function",
      displayCapture:Boolean(navigator.mediaDevices?.getDisplayMedia),
      wakeLock:Boolean(navigator.wakeLock),
      fullscreen:Boolean(document.documentElement.requestFullscreen)
    };
  }

  async function requestWakeLock(){
    if(!navigator.wakeLock?.request)throw new Error("Wake Lock não suportado.");
    if(wakeLockSentinel&&!wakeLockSentinel.released)return true;
    wakeLockSentinel=await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release",()=>{
      wakeLockSentinel=null;
      state.realWakeLock=false;
      saveState();
    },{once:true});
    state.realWakeLock=true;
    saveState();
    return true;
  }

  async function releaseWakeLock(){
    if(wakeLockSentinel&&!wakeLockSentinel.released){
      try{await wakeLockSentinel.release()}catch{}
    }
    wakeLockSentinel=null;
    state.realWakeLock=false;
    saveState();
  }

  async function setWakeLock(enabled){
    if(enabled)return requestWakeLock();
    await releaseWakeLock();
    return false;
  }

  async function enterFullscreen(){
    if(!document.documentElement.requestFullscreen)throw new Error("Ecrã completo não suportado.");
    if(!document.fullscreenElement)await document.documentElement.requestFullscreen();
    return true;
  }

  async function exitFullscreen(){
    if(document.fullscreenElement&&document.exitFullscreen)await document.exitFullscreen();
    return true;
  }

  document.addEventListener("visibilitychange",async()=>{
    if(document.visibilityState==="visible"&&state.realWakeLock){
      try{await requestWakeLock()}catch{}
    }
  });

  window.addEventListener("online",()=>notify("Rede","Ligação à Internet disponível."));
  window.addEventListener("offline",()=>notify("Rede","O dispositivo ficou offline."));

  globalThis.RealDeviceBridge=Object.freeze({
    version:"7.4.0",
    formatBytes,
    getStorageInfo,
    requestPersistentStorage,
    getBatteryInfo,
    getDeviceInfo,
    requestWakeLock,
    releaseWakeLock,
    setWakeLock,
    enterFullscreen,
    exitFullscreen,
    pickRecorderMime
  });

  /* ---------- Real Sound Recorder ---------- */
  globalThis.buildSoundRecorder=function(wrap){
    wrap.className="soundrec real-soundrec";
    wrap.innerHTML=
      '<div class="soundrec-card real-soundrec-card">'+
        '<div class="real-app-header">'+
          '<div><h2>Gravador de Som</h2><small>Microfone real com autorização do dispositivo</small></div>'+
          '<span class="real-device-badge" data-mic-state>Pronto</span>'+
        '</div>'+
        '<button class="mic-circle real-mic-button" data-rec aria-label="Iniciar gravação">🎙️</button>'+
        '<div class="real-rec-time" data-rec-time>00:00</div>'+
        '<div class="wave real-wave"></div>'+
        '<div class="real-rec-actions">'+
          '<button class="sys-button primary" data-rec-toggle>Iniciar gravação</button>'+
          '<button class="sys-button" data-rec-play disabled>Reproduzir</button>'+
          '<button class="sys-button" data-rec-export disabled>Exportar</button>'+
        '</div>'+
        '<audio controls data-rec-audio hidden></audio>'+
        '<p class="real-device-note">O microfone só é aberto depois de carregar em “Iniciar gravação”.</p>'+
      '</div>';

    const wave=wrap.querySelector(".wave");
    for(let i=0;i<46;i++){
      const bar=document.createElement("i");
      bar.style.height="8px";
      wave.appendChild(bar);
    }

    const timeEl=wrap.querySelector("[data-rec-time]");
    const stateEl=wrap.querySelector("[data-mic-state]");
    const toggle=wrap.querySelector("[data-rec-toggle]");
    const micButton=wrap.querySelector("[data-rec]");
    const play=wrap.querySelector("[data-rec-play]");
    const exportBtn=wrap.querySelector("[data-rec-export]");
    const audio=wrap.querySelector("[data-rec-audio]");

    let stream=null;
    let recorder=null;
    let chunks=[];
    let startedAt=0;
    let timer=null;
    let analyserCtx=null;
    let analyser=null;
    let analyserSource=null;
    let animationFrame=null;
    let latest=null;
    let latestUrl=null;
    let discardOnStop=false;

    function updateTime(){
      if(!startedAt)return;
      const secs=Math.floor((Date.now()-startedAt)/1000);
      timeEl.textContent=String(Math.floor(secs/60)).padStart(2,"0")+":"+String(secs%60).padStart(2,"0");
    }

    function resetWave(){
      [...wave.children].forEach(b=>b.style.height="8px");
    }

    function drawWave(){
      if(!analyser)return;
      const data=new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      [...wave.children].forEach((bar,i)=>{
        const value=data[Math.floor(i*data.length/wave.children.length)]||0;
        bar.style.height=(8+Math.round(value/255*52))+"px";
      });
      animationFrame=requestAnimationFrame(drawWave);
    }

    function stopVisuals(){
      clearInterval(timer);
      timer=null;
      if(animationFrame)cancelAnimationFrame(animationFrame);
      animationFrame=null;
      try{analyserSource?.disconnect()}catch{}
      try{analyserCtx?.close()}catch{}
      analyserSource=null;
      analyser=null;
      analyserCtx=null;
      resetWave();
    }

    function stopStream(){
      stream?.getTracks().forEach(t=>t.stop());
      stream=null;
    }

    async function startRecording(){
      if(recorder?.state==="recording")return;
      if(!navigator.mediaDevices?.getUserMedia){
        notify("Gravador de Som","O navegador não permite acesso ao microfone.");
        return;
      }
      toggle.disabled=true;
      stateEl.textContent="A pedir permissão...";
      try{
        stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
        const mime=pickRecorderMime();
        recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
        chunks=[];
        recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
        recorder.onerror=()=>notify("Gravador de Som","Ocorreu um erro durante a gravação.");
        recorder.onstop=async()=>{
          stopVisuals();
          stopStream();
          if(discardOnStop){
            discardOnStop=false;
            chunks=[];
            stateEl.textContent="Interrompida";
            toggle.textContent="Iniciar gravação";
            toggle.disabled=false;
            timeEl.textContent="00:00";
            return;
          }
          const type=recorder?.mimeType||mime||"audio/webm";
          const blob=new Blob(chunks,{type});
          if(!blob.size){
            stateEl.textContent="Sem áudio";
            toggle.textContent="Iniciar gravação";
            toggle.disabled=false;
            return;
          }
          const ext=type.includes("mp4")?"m4a":type.includes("ogg")?"ogg":"webm";
          const name=safeFileName("Gravação",ext);
          const file=new File([blob],name,{type,lastModified:Date.now()});
          latest=await RealContentBridge.importFileToVirtual(file,"C:/Music");
          if(latestUrl)URL.revokeObjectURL(latestUrl);
          latestUrl=URL.createObjectURL(blob);
          audio.src=latestUrl;
          audio.hidden=false;
          play.disabled=false;
          exportBtn.disabled=false;
          stateEl.textContent="Guardado";
          toggle.textContent="Iniciar gravação";
          toggle.disabled=false;
          timeEl.textContent="00:00";
          notify("Gravador de Som",name+" guardado em Música.");
        };
        recorder.start(250);
        startedAt=Date.now();
        timer=setInterval(updateTime,250);
        updateTime();
        try{
          analyserCtx=new (window.AudioContext||window.webkitAudioContext)();
          analyser=analyserCtx.createAnalyser();
          analyser.fftSize=128;
          analyserSource=analyserCtx.createMediaStreamSource(stream);
          analyserSource.connect(analyser);
          drawWave();
        }catch{}
        stateEl.textContent="A gravar";
        toggle.textContent="Parar gravação";
        toggle.disabled=false;
        micButton.classList.add("recording");
      }catch(err){
        stopVisuals();
        stopStream();
        stateEl.textContent=err?.name==="NotAllowedError"?"Permissão recusada":"Erro";
        toggle.textContent="Iniciar gravação";
        toggle.disabled=false;
        notify("Gravador de Som",err?.name==="NotAllowedError"?"Permissão do microfone recusada.":"Não foi possível iniciar o microfone.");
      }
    }

    function stopRecording(){
      if(recorder?.state==="recording"){
        micButton.classList.remove("recording");
        toggle.disabled=true;
        stateEl.textContent="A guardar...";
        recorder.stop();
      }
    }

    const onSessionLock=()=>{
      if(recorder?.state==="recording")stopRecording();
      else stopStream();
      try{audio.pause()}catch{}
    };
    const onSessionEnd=()=>{
      discardOnStop=true;
      if(recorder?.state==="recording"){
        try{recorder.stop()}catch{}
      }
      stopVisuals();
      stopStream();
      try{audio.pause()}catch{}
    };
    window.addEventListener("win11-session-lock",onSessionLock);
    window.addEventListener("win11-session-end",onSessionEnd);

    toggle.onclick=()=>recorder?.state==="recording"?stopRecording():startRecording();
    micButton.onclick=()=>toggle.click();

    play.onclick=()=>{
      if(!audio.src)return;
      if(audio.paused){audio.play().catch(()=>{});play.textContent="Pausar"}
      else{audio.pause();play.textContent="Reproduzir"}
    };
    audio.onpause=()=>{play.textContent="Reproduzir"};
    audio.onplay=()=>{play.textContent="Pausar"};

    exportBtn.onclick=async()=>{
      if(!latest)return;
      try{
        const value=ensureFolder(latest.folder)[latest.name];
        await RealContentBridge.exportVirtualValue(latest.name,value);
        notify("Gravador de Som","Gravação exportada para o dispositivo.");
      }catch(err){
        if(err?.name!=="AbortError")notify("Gravador de Som","Não foi possível exportar a gravação.");
      }
    };

    const cleanup=setInterval(()=>{
      if(wrap.isConnected)return;
      clearInterval(cleanup);
      if(recorder?.state==="recording"){
        try{recorder.stop()}catch{}
      }
      window.removeEventListener("win11-session-lock",onSessionLock);
      window.removeEventListener("win11-session-end",onSessionEnd);
      stopVisuals();
      stopStream();
      if(latestUrl)URL.revokeObjectURL(latestUrl);
    },700);
  };

  /* ---------- Real Camera ---------- */
  globalThis.buildCamera=function(wrap){
    wrap.className="real-camera";
    wrap.innerHTML=
      '<div class="real-camera-shell">'+
        '<div class="real-app-header">'+
          '<div><h2>Câmara</h2><small>Câmara real do dispositivo</small></div>'+
          '<span class="real-device-badge" data-camera-state>Desligada</span>'+
        '</div>'+
        '<div class="real-camera-stage">'+
          '<video playsinline muted data-camera-video></video>'+
          '<div class="real-camera-placeholder" data-camera-placeholder>📷<span>Ative a câmara para começar</span></div>'+
          '<canvas data-camera-canvas hidden></canvas>'+
        '</div>'+
        '<div class="real-camera-actions">'+
          '<button class="sys-button primary" data-camera-start>Ativar câmara</button>'+
          '<button class="real-shutter" data-camera-shot disabled aria-label="Tirar fotografia"></button>'+
          '<button class="sys-button" data-camera-switch disabled>Trocar câmara</button>'+
          '<button class="sys-button" data-camera-stop disabled>Desligar</button>'+
        '</div>'+
        '<div class="real-camera-last" data-camera-last></div>'+
        '<p class="real-device-note">A câmara só é utilizada após autorização explícita do navegador.</p>'+
      '</div>';

    const video=wrap.querySelector("[data-camera-video]");
    const canvas=wrap.querySelector("[data-camera-canvas]");
    const placeholder=wrap.querySelector("[data-camera-placeholder]");
    const stateEl=wrap.querySelector("[data-camera-state]");
    const start=wrap.querySelector("[data-camera-start]");
    const shot=wrap.querySelector("[data-camera-shot]");
    const switchBtn=wrap.querySelector("[data-camera-switch]");
    const stopBtn=wrap.querySelector("[data-camera-stop]");
    const last=wrap.querySelector("[data-camera-last]");

    let stream=null;
    let facing="environment";
    let lastUrl=null;

    function stopCamera(){
      stream?.getTracks().forEach(t=>t.stop());
      stream=null;
      video.srcObject=null;
      placeholder.hidden=false;
      stateEl.textContent="Desligada";
      start.disabled=false;
      shot.disabled=true;
      switchBtn.disabled=true;
      stopBtn.disabled=true;
    }

    const onSessionLock=()=>stopCamera();
    const onSessionEnd=()=>stopCamera();
    window.addEventListener("win11-session-lock",onSessionLock);
    window.addEventListener("win11-session-end",onSessionEnd);

    async function startCamera(){
      if(!navigator.mediaDevices?.getUserMedia){
        notify("Câmara","Este navegador não permite acesso à câmara.");
        return;
      }
      start.disabled=true;
      stateEl.textContent="A pedir permissão...";
      try{
        stopCamera();
        start.disabled=true;
        stream=await navigator.mediaDevices.getUserMedia({
          video:{facingMode:{ideal:facing}},
          audio:false
        });
        video.srcObject=stream;
        await video.play();
        placeholder.hidden=true;
        stateEl.textContent=facing==="environment"?"Câmara traseira":"Câmara frontal";
        shot.disabled=false;
        switchBtn.disabled=false;
        stopBtn.disabled=false;
      }catch(err){
        stopCamera();
        stateEl.textContent=err?.name==="NotAllowedError"?"Permissão recusada":"Erro";
        notify("Câmara",err?.name==="NotAllowedError"?"Permissão da câmara recusada.":"Não foi possível iniciar a câmara.");
      }
    }

    async function capture(){
      if(!stream||!video.videoWidth||!video.videoHeight)return;
      canvas.width=video.videoWidth;
      canvas.height=video.videoHeight;
      const ctx=canvas.getContext("2d");
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",0.92));
      if(!blob)return;
      const name=safeFileName("Fotografia","jpg");
      const file=new File([blob],name,{type:"image/jpeg",lastModified:Date.now()});
      await RealContentBridge.importFileToVirtual(file,"C:/Pictures");
      if(lastUrl)URL.revokeObjectURL(lastUrl);
      lastUrl=URL.createObjectURL(blob);
      last.innerHTML="";
      const img=document.createElement("img");
      img.src=lastUrl;
      img.alt=name;
      const label=document.createElement("span");
      label.textContent=name+" · guardada em Imagens";
      last.append(img,label);
      notify("Câmara",name+" guardada em Imagens.");
    }

    start.onclick=startCamera;
    stopBtn.onclick=stopCamera;
    shot.onclick=capture;
    switchBtn.onclick=async()=>{
      facing=facing==="environment"?"user":"environment";
      await startCamera();
    };

    const cleanup=setInterval(()=>{
      if(wrap.isConnected)return;
      clearInterval(cleanup);
      window.removeEventListener("win11-session-lock",onSessionLock);
      window.removeEventListener("win11-session-end",onSessionEnd);
      stopCamera();
      if(lastUrl)URL.revokeObjectURL(lastUrl);
    },700);
  };

  /* ---------- Real Snipping Tool ---------- */
  globalThis.buildSnipping=function(wrap){
    wrap.className="snip-stage real-snipping";
    wrap.innerHTML=
      '<div class="snip-toolbar">'+
        '<button class="sys-button primary" data-capture-real>Capturar ecrã/janela</button>'+
        '<button class="sys-button" data-capture-virtual>Recorte virtual</button>'+
        '<button class="sys-button" data-save>Guardar em Imagens</button>'+
        '<span class="real-device-badge" data-snip-state>Pronto</span>'+
      '</div>'+
      '<div class="snip-preview"><canvas width="900" height="520"></canvas></div>'+
      '<p class="real-device-note">A captura real usa o seletor de partilha de ecrã do navegador. Em alguns telemóveis esta API pode não estar disponível.</p>';

    const c=wrap.querySelector("canvas");
    const ctx=c.getContext("2d");
    const stateEl=wrap.querySelector("[data-snip-state]");
    let hasCapture=false;

    function drawVirtual(){
      const grad=ctx.createLinearGradient(0,0,c.width,c.height);
      grad.addColorStop(0,"#35306b");
      grad.addColorStop(.55,"#bd638e");
      grad.addColorStop(1,"#ee8968");
      ctx.fillStyle=grad;
      ctx.fillRect(0,0,c.width,c.height);
      ctx.fillStyle="rgba(25,30,43,.82)";
      ctx.fillRect(90,80,720,330);
      ctx.fillStyle="#fff";
      ctx.font="32px Segoe UI";
      ctx.fillText("Windows 11 Simulator",130,145);
      ctx.font="18px Segoe UI";
      ctx.fillText("Recorte virtual",130,185);
      ctx.fillStyle="rgba(255,255,255,.14)";
      ctx.fillRect(130,220,550,120);
      ctx.fillStyle="#fff";
      ctx.fillText(new Date().toLocaleString("pt-PT"),160,285);
      hasCapture=true;
      stateEl.textContent="Recorte virtual";
    }

    async function captureReal(){
      if(!navigator.mediaDevices?.getDisplayMedia){
        drawVirtual();
        notify("Ferramenta de Recorte","Captura real não suportada neste navegador; foi criado um recorte virtual.");
        return;
      }
      stateEl.textContent="A escolher origem...";
      let stream=null;
      try{
        stream=await navigator.mediaDevices.getDisplayMedia({
          video:{frameRate:{ideal:15,max:30}},
          audio:false
        });
        const video=document.createElement("video");
        video.srcObject=stream;
        video.muted=true;
        video.playsInline=true;
        await video.play();
        await new Promise(resolve=>{
          if(video.videoWidth&&video.videoHeight){resolve();return}
          video.onloadedmetadata=()=>resolve();
          setTimeout(resolve,1200);
        });
        if(!video.videoWidth||!video.videoHeight)throw new Error("A origem de captura não forneceu imagem.");
        const maxW=1440;
        const scale=Math.min(1,maxW/video.videoWidth);
        c.width=Math.max(1,Math.round(video.videoWidth*scale));
        c.height=Math.max(1,Math.round(video.videoHeight*scale));
        ctx.drawImage(video,0,0,c.width,c.height);
        hasCapture=true;
        stateEl.textContent="Captura real";
        notify("Ferramenta de Recorte","Captura real concluída.");
      }catch(err){
        if(err?.name!=="AbortError"&&err?.name!=="NotAllowedError"){
          notify("Ferramenta de Recorte","Não foi possível capturar o ecrã.");
        }
        stateEl.textContent="Pronto";
      }finally{
        stream?.getTracks().forEach(t=>t.stop());
      }
    }

    wrap.querySelector("[data-capture-real]").onclick=captureReal;
    wrap.querySelector("[data-capture-virtual]").onclick=drawVirtual;
    wrap.querySelector("[data-save]").onclick=async()=>{
      if(!hasCapture){drawVirtual()}
      const blob=await new Promise(resolve=>c.toBlob(resolve,"image/png"));
      if(!blob)return;
      const name=safeFileName("Captura","png");
      const file=new File([blob],name,{type:"image/png",lastModified:Date.now()});
      await RealContentBridge.importFileToVirtual(file,"C:/Pictures");
      notify("Ferramenta de Recorte",name+" guardada em Imagens.");
    };
    drawVirtual();
  };

  /* ---------- Real System Information ---------- */
  const baseBuildSystemInfo=globalThis.buildSystemInfo;
  globalThis.buildSystemInfo=function(wrap){
    baseBuildSystemInfo(wrap);
    const nav=wrap.querySelector(".info-nav");
    const main=wrap.querySelector(".info-main");
    if(!nav||!main)return;

    const realBtn=document.createElement("button");
    realBtn.dataset.realDeviceInfo="";
    realBtn.textContent="Dispositivo real";
    nav.appendChild(realBtn);

    realBtn.onclick=async()=>{
      nav.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===realBtn));
      main.innerHTML='<h2>Dispositivo real</h2><p>A recolher informações expostas pelo navegador...</p>';
      const info=await getDeviceInfo();
      const rows=[
        ["Estado da rede",info.online?"Online":"Offline"],
        ["Plataforma",info.platform],
        ["Tipo",info.mobile?"Dispositivo móvel":"Computador/desktop"],
        ["Idioma",info.language],
        ["Processadores lógicos",info.logicalProcessors??"Não exposto"],
        ["Memória do dispositivo",info.deviceMemory?info.deviceMemory+" GB (aprox.)":"Não exposta"],
        ["Contexto seguro HTTPS",info.secureContext?"Sim":"Não"],
        ["MediaDevices",info.mediaDevices?"Disponível":"Indisponível"],
        ["MediaRecorder",info.mediaRecorder?"Disponível":"Indisponível"],
        ["Captura de ecrã",info.displayCapture?"Disponível":"Indisponível"],
        ["Wake Lock",info.wakeLock?"Disponível":"Indisponível"],
        ["Armazenamento utilizado",info.storage.usage==null?"Não exposto":formatBytes(info.storage.usage)],
        ["Quota de armazenamento",info.storage.quota==null?"Não exposta":formatBytes(info.storage.quota)],
        ["Armazenamento persistente",info.storage.persisted==null?"Não exposto":info.storage.persisted?"Sim":"Não"]
      ];
      if(info.connection){
        rows.push(
          ["Ligação efetiva",info.connection.effectiveType||"Não exposta"],
          ["Download estimado",info.connection.downlink==null?"Não exposto":info.connection.downlink+" Mbps"],
          ["Latência estimada",info.connection.rtt==null?"Não exposta":info.connection.rtt+" ms"],
          ["Poupança de dados",info.connection.saveData?"Ativa":"Desativada"]
        );
      }
      if(info.battery){
        rows.push(
          ["Bateria",info.battery.level+"%"],
          ["A carregar",info.battery.charging?"Sim":"Não"]
        );
      }
      rows.push(["User Agent",info.browser]);
      main.innerHTML=
        '<h2>Dispositivo real</h2>'+
        '<p class="real-device-note">São mostrados apenas dados que o navegador decide expor à página.</p>'+
        '<table class="info-table">'+rows.map(([k,v])=>'<tr><td>'+escapeHTML(String(k))+'</td><td>'+escapeHTML(String(v))+'</td></tr>').join("")+'</table>';
    };
  };

  /* ---------- Settings integration ---------- */
  if(typeof renderSettingsPageV5==="function"){
    const previousSettingsPage=globalThis.renderSettingsPageV5;
    globalThis.renderSettingsPageV5=function(box,page){
      previousSettingsPage(box,page);
      if(page!=="system"||box.querySelector("[data-real-device-settings]"))return;

      const card=document.createElement("div");
      card.className="sys-card real-device-settings";
      card.dataset.realDeviceSettings="";
      card.innerHTML=
        '<strong>Dispositivo e armazenamento reais</strong>'+
        '<p data-real-storage-status>A verificar armazenamento...</p>'+
        '<div class="real-device-settings-actions">'+
          '<button class="sys-button" data-persist-storage>Proteger armazenamento local</button>'+
          '<button class="sys-button" data-wake-lock>Manter ecrã ativo</button>'+
          '<button class="sys-button" data-fullscreen>Ecrã completo</button>'+
        '</div>';
      (box.querySelector(".sys-grid")||box).appendChild(card);

      const status=card.querySelector("[data-real-storage-status]");
      const persistBtn=card.querySelector("[data-persist-storage]");
      const wakeBtn=card.querySelector("[data-wake-lock]");
      const fullBtn=card.querySelector("[data-fullscreen]");

      async function refreshStorage(){
        const info=await getStorageInfo();
        if(!info.supported){
          status.textContent="A API de armazenamento não está disponível.";
          persistBtn.disabled=true;
          return;
        }
        const usage=info.usage==null?"uso não exposto":formatBytes(info.usage);
        const quota=info.quota==null?"quota não exposta":formatBytes(info.quota);
        status.textContent=usage+" de "+quota+" · "+(info.persisted?"armazenamento persistente":"armazenamento sujeito às políticas do navegador");
        persistBtn.textContent=info.persisted?"Armazenamento protegido":"Proteger armazenamento local";
        persistBtn.disabled=Boolean(info.persisted);
      }

      persistBtn.onclick=async()=>{
        persistBtn.disabled=true;
        try{
          const ok=await requestPersistentStorage();
          notify("Armazenamento",ok?"O navegador concedeu armazenamento persistente.":"O navegador não concedeu armazenamento persistente.");
        }catch{
          notify("Armazenamento","Esta função não está disponível neste navegador.");
        }
        await refreshStorage();
      };

      wakeBtn.textContent=state.realWakeLock?"Desativar ecrã ativo":"Manter ecrã ativo";
      wakeBtn.onclick=async()=>{
        try{
          if(state.realWakeLock){
            await releaseWakeLock();
            wakeBtn.textContent="Manter ecrã ativo";
            notify("Sistema","Wake Lock desativado.");
          }else{
            await requestWakeLock();
            wakeBtn.textContent="Desativar ecrã ativo";
            notify("Sistema","O ecrã será mantido ativo enquanto o navegador permitir.");
          }
        }catch{
          notify("Sistema","Wake Lock não está disponível neste dispositivo.");
        }
      };

      fullBtn.onclick=async()=>{
        try{
          if(document.fullscreenElement){
            await exitFullscreen();
          }else{
            await enterFullscreen();
          }
        }catch{
          notify("Sistema","O navegador não permitiu ecrã completo.");
        }
      };

      refreshStorage();
    };
    try{globalThis.renderSettingsPageV5=renderSettingsPageV5}catch{}
  }

  globalThis.Win11RealFunctions=Object.freeze({
    version:"7.4.0",
    step:8,
    features:[
      "real-file-open","real-file-save","download-fallback",
      "real-clipboard-write","real-clipboard-read","clipboard-manual-paste-fallback",
      "explorer-real-import","explorer-real-folder-import","explorer-drag-drop","explorer-real-export",
      "photos-real-image-open","media-real-playback",
      "local-accounts","per-user-state","session-lock","session-signout","session-switch-user",
      "pbkdf2-credentials","broadcast-session-conflict","per-user-indexeddb-ownership",
      "real-microphone-recording","real-camera","real-screen-capture",
      "real-device-info","persistent-storage","screen-wake-lock","fullscreen",
      "profile-avatar","profile-rename","credential-change","profile-backup","profile-restore","account-delete","auto-lock"
    ]
  });
})();
