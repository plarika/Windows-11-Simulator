"use strict";
/* Windows 11 Simulator V6.7 — Local Accounts & Sessions */
(function installLocalAccountsV670(){
  const ACCOUNTS_KEY="win11-sim-accounts-v67";
  const LAST_USER_KEY="win11-sim-last-user-v67";
  const SESSION_KEY="win11-sim-active-session-v67";
  const PROFILE_PREFIX="win11-sim-profile-v67:";
  const LEGACY_BACKUP_KEY="win11-sim-legacy-backup-v67";
  const CHANNEL_PREFIX="win11-sim-session-v67:";
  const ITERATIONS=120000;
  const AUTH_WORKER_URL="./src/workers/auth-crypto-v673.js?v=6.7.3";
  const tabId=crypto.randomUUID?.()||("tab-"+Date.now()+"-"+Math.random().toString(36).slice(2));

  let activeAccount=null;
  let locked=true;
  let sessionChannel=null;
  let bootResumePromise=null;

  function clone(value){
    try{return structuredClone(value)}
    catch{return JSON.parse(JSON.stringify(value))}
  }

  function readAccounts(){
    try{
      const parsed=JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||"[]");
      return Array.isArray(parsed)?parsed:[];
    }catch{return []}
  }

  function writeAccounts(accounts){
    localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(accounts));
  }

  function profileKey(id){return PROFILE_PREFIX+id}

  function readProfile(id){
    try{
      const raw=localStorage.getItem(profileKey(id));
      return raw?Object.assign(defaultState(),JSON.parse(raw)):defaultState();
    }catch{return defaultState()}
  }

  function writeProfile(id,data=state){
    if(!id)return false;
    try{
      localStorage.setItem(profileKey(id),JSON.stringify(data));
      return true;
    }catch{
      return false;
    }
  }

  function bytesToBase64(bytes){
    let s="";
    for(const b of bytes)s+=String.fromCharCode(b);
    return btoa(s);
  }

  function base64ToBytes(value){
    const raw=atob(value);
    const out=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
    return out;
  }

  function withTimeout(promise,ms,message){
    let timer;
    return Promise.race([
      promise,
      new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(new Error(message||"Operação excedeu o tempo limite.")),ms);
      })
    ]).finally(()=>clearTimeout(timer));
  }

  async function deriveCredentialMain(secret,saltBase64,iterations=ITERATIONS){
    if(!crypto.subtle)throw new Error("Web Crypto indisponível.");
    const key=await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(String(secret)),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits=await crypto.subtle.deriveBits(
      {
        name:"PBKDF2",
        salt:base64ToBytes(saltBase64),
        iterations,
        hash:"SHA-256"
      },
      key,
      256
    );
    return bytesToBase64(new Uint8Array(bits));
  }

  async function deriveCredentialWorker(secret,saltBase64,iterations=ITERATIONS){
    if(typeof Worker!=="function")throw new Error("Web Worker indisponível.");
    return new Promise((resolve,reject)=>{
      const worker=new Worker(AUTH_WORKER_URL);
      const id="auth-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      const timer=setTimeout(()=>{
        try{worker.terminate()}catch{}
        reject(new Error("A verificação demorou demasiado no worker."));
      },10000);
      worker.onmessage=e=>{
        const data=e.data||{};
        if(data.id!==id)return;
        clearTimeout(timer);
        try{worker.terminate()}catch{}
        if(data.ok)resolve(data.hash);
        else reject(new Error(data.error||"Falha na verificação do PIN."));
      };
      worker.onerror=e=>{
        clearTimeout(timer);
        try{worker.terminate()}catch{}
        reject(new Error(e?.message||"Falha no worker de autenticação."));
      };
      worker.postMessage({id,secret:String(secret),saltBase64,iterations});
    });
  }

  async function deriveCredential(secret,saltBase64,iterations=ITERATIONS){
    try{
      return await deriveCredentialWorker(secret,saltBase64,iterations);
    }catch(workerError){
      console.warn("[Sessions] auth worker fallback",workerError);
      return withTimeout(
        deriveCredentialMain(secret,saltBase64,iterations),
        12000,
        "A verificação do PIN demorou demasiado. Tente novamente."
      );
    }
  }

  function constantTimeEqual(a,b){
    if(a.length!==b.length)return false;
    let diff=0;
    for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
    return diff===0;
  }

  async function upgradeCredentialIfNeeded(account,secret){
    const currentIterations=Number(account?.credential?.iterations)||ITERATIONS;
    if(currentIterations<=ITERATIONS)return;
    try{
      const salt=crypto.getRandomValues(new Uint8Array(16));
      const saltBase64=bytesToBase64(salt);
      const hash=await deriveCredential(secret,saltBase64,ITERATIONS);
      const accounts=readAccounts();
      const target=accounts.find(a=>a.id===account.id);
      if(!target)return;
      target.credential={
        type:"local-secret",
        algorithm:"PBKDF2-SHA-256",
        iterations:ITERATIONS,
        salt:saltBase64,
        hash
      };
      writeAccounts(accounts);
      account.credential=target.credential;
    }catch(err){
      console.warn("[Sessions] credential upgrade skipped",err);
    }
  }

  async function verifyAccount(account,secret){
    if(!account?.credential?.salt||!account?.credential?.hash)return false;
    const derived=await deriveCredential(
      secret,
      account.credential.salt,
      account.credential.iterations||ITERATIONS
    );
    const ok=constantTimeEqual(derived,account.credential.hash);
    if(ok)await upgradeCredentialIfNeeded(account,secret);
    return ok;
  }

  function normalizedName(name){
    return String(name||"").trim().replace(/\s+/g," ").slice(0,40);
  }

  function initials(name){
    const parts=normalizedName(name).split(" ").filter(Boolean);
    return (parts.slice(0,2).map(x=>x[0]?.toUpperCase()||"").join("")||"U").slice(0,2);
  }

  function accountById(id){
    return readAccounts().find(a=>a.id===id)||null;
  }

  function legacySnapshot(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw)return Object.assign(defaultState(),JSON.parse(raw));
    }catch{}
    return clone(state);
  }

  async function createAccount(displayName,secret,{migrateLegacy=false}={}){
    const name=normalizedName(displayName);
    if(name.length<2)throw new Error("Indique um nome com pelo menos 2 caracteres.");
    if(String(secret).length<4)throw new Error("O PIN/palavra-passe deve ter pelo menos 4 caracteres.");

    const accounts=readAccounts();
    if(accounts.some(a=>a.displayName.toLocaleLowerCase("pt-PT")===name.toLocaleLowerCase("pt-PT"))){
      throw new Error("Já existe uma conta com esse nome.");
    }

    const id="user-"+(crypto.randomUUID?.()||Math.random().toString(36).slice(2));
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const saltBase64=bytesToBase64(salt);
    const hash=await deriveCredential(secret,saltBase64,ITERATIONS);
    const account={
      id,
      displayName:name,
      createdAt:Date.now(),
      lastLoginAt:0,
      credential:{
        type:"local-secret",
        algorithm:"PBKDF2-SHA-256",
        iterations:ITERATIONS,
        salt:saltBase64,
        hash
      }
    };

    const first=accounts.length===0;
    const useLegacy=Boolean(migrateLegacy&&first);
    const profile=useLegacy?legacySnapshot():defaultState();

    localStorage.setItem(profileKey(id),JSON.stringify(profile));
    accounts.push(account);
    writeAccounts(accounts);

    if(useLegacy){
      try{
        const legacy=localStorage.getItem(STORAGE_KEY);
        if(legacy&&!localStorage.getItem(LEGACY_BACKUP_KEY)){
          localStorage.setItem(LEGACY_BACKUP_KEY,legacy);
        }
        localStorage.removeItem(STORAGE_KEY);
      }catch{}
      try{
        await globalThis.RealContentBridge?.claimLegacyBlobs?.(id);
      }catch(err){
        console.warn("[Sessions] legacy blob claim failed",err);
      }
    }

    return account;
  }

  function closeAllWindows(){
    $$(".window").slice().forEach(w=>{
      try{closeWindow(w)}catch{w.remove()}
    });
    $("#task-center")?.querySelectorAll("[data-window]")?.forEach?.(b=>b.remove());
  }

  function replaceStateData(profile){
    for(const key of Object.keys(state))delete state[key];
    Object.assign(state,defaultState(),profile||{});
  }

  function updateCurrentUserUI(){
    const footer=$("#start-menu .start-footer span:first-child");
    if(footer){
      footer.textContent=activeAccount?.displayName||"Utilizador";
      footer.title=activeAccount?"Opções da conta":"";
      footer.style.cursor=activeAccount?"pointer":"default";
      footer.onclick=activeAccount?(e=>{
        e.stopPropagation();
        showContext(e.clientX||innerWidth/2,e.clientY||innerHeight/2,[
          ["Bloquear",()=>lockSession()],
          ["Mudar de utilizador",()=>switchUser()],
          ["Terminar sessão",()=>signOut()]
        ]);
      }):null;
    }
  }

  function refreshShell(){
    try{applyState()}catch{}
    try{populateDesktop()}catch{}
    try{populateStart()}catch{}
    try{renderRecommended()}catch{}
    try{renderNotifications()}catch{}
    try{renderClipboard()}catch{}
    try{globalThis.Win11Realism?.refresh?.()}catch{}
    updateCurrentUserUI();
  }

  function saveActiveProfile(){
    if(!activeAccount)return false;
    return writeProfile(activeAccount.id,state);
  }

  const originalSaveState=saveState;
  saveState=function(){
    try{
      const sessionId=sessionStorage.getItem(SESSION_KEY);
      if(sessionId&&accountById(sessionId)){
        localStorage.setItem(profileKey(sessionId),JSON.stringify(state));
        return;
      }
      if(readAccounts().length===0){
        originalSaveState();
      }
    }catch{}
  };
  try{globalThis.saveState=saveState}catch{}

  function currentTimeParts(){
    const d=new Date();
    return {
      time:d.toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"}),
      date:d.toLocaleDateString("pt-PT",{weekday:"long",day:"numeric",month:"long"})
    };
  }

  function lockShell(content){
    const lock=$("#lock");
    if(!lock)return null;
    const t=currentTimeParts();
    lock.className="session-lock";
    lock.innerHTML=
      '<div class="session-lock-clock">'+
        '<div class="lock-time" id="lock-time">'+escapeHTML(t.time)+'</div>'+
        '<div class="lock-date" id="lock-date">'+escapeHTML(t.date)+'</div>'+
      '</div>'+
      '<div class="session-auth-host">'+content+'</div>';
    lock.onclick=e=>e.stopPropagation();
    return lock;
  }

  function accountListHtml(accounts,selectedId){
    return '<div class="session-account-list">'+accounts.map(a=>
      '<button class="session-account '+(a.id===selectedId?"selected":"")+'" data-account="'+escapeHTML(a.id)+'">'+
        '<span class="session-avatar">'+escapeHTML(initials(a.displayName))+'</span>'+
        '<span>'+escapeHTML(a.displayName)+'</span>'+
      '</button>'
    ).join("")+'</div>';
  }

  function renderCreateAccount({message="",firstAccount=false}={}){
    const accounts=readAccounts();
    const content=
      '<div class="session-card session-create-card">'+
        '<div class="session-avatar large">＋</div>'+
        '<h2>'+(firstAccount?"Criar a primeira conta":"Adicionar utilizador")+'</h2>'+
        '<p class="session-subtitle">'+
          (firstAccount
            ?"Crie uma conta local para separar e guardar os dados deste dispositivo."
            :"A nova conta terá ambiente de trabalho, ficheiros e definições próprios.")+
        '</p>'+
        (firstAccount?'<div class="session-migration-note">Os dados atuais do simulador serão associados a esta primeira conta.</div>':"")+
        (message?'<div class="session-message error">'+escapeHTML(message)+'</div>':"")+
        '<label>Nome da conta<input data-new-user-name autocomplete="username" maxlength="40" placeholder="Nome do utilizador"></label>'+
        '<label>PIN ou palavra-passe<input data-new-user-secret type="password" autocomplete="new-password" placeholder="Mínimo 4 caracteres"></label>'+
        '<label>Confirmar<input data-new-user-confirm type="password" autocomplete="new-password" placeholder="Repita o PIN/palavra-passe"></label>'+
        '<div class="session-actions">'+
          (accounts.length?'<button class="session-secondary" data-create-cancel>Cancelar</button>':"")+
          '<button class="session-primary" data-create-user>Criar conta</button>'+
        '</div>'+
      '</div>';

    const lock=lockShell(content);
    if(!lock)return;
    const name=lock.querySelector("[data-new-user-name]");
    const secret=lock.querySelector("[data-new-user-secret]");
    const confirm=lock.querySelector("[data-new-user-confirm]");
    const create=lock.querySelector("[data-create-user]");

    async function submit(){
      const displayName=name.value;
      if(secret.value!==confirm.value){
        renderCreateAccount({message:"Os dois valores não coincidem.",firstAccount});
        return;
      }
      create.disabled=true;
      create.textContent="A criar...";
      try{
        const account=await createAccount(displayName,secret.value,{migrateLegacy:firstAccount});
        await finishLogin(account,{loadProfile:true});
      }catch(err){
        renderCreateAccount({message:err?.message||"Não foi possível criar a conta.",firstAccount});
      }
    }

    create.onclick=submit;
    [name,secret,confirm].forEach(input=>input.onkeydown=e=>{if(e.key==="Enter")submit()});
    lock.querySelector("[data-create-cancel]")?.addEventListener("click",()=>renderLogin());
    setTimeout(()=>name.focus(),0);
  }

  function renderLogin({selectedId=null,message=""}={}){
    const accounts=readAccounts();
    if(!accounts.length){
      renderCreateAccount({firstAccount:true,message});
      return;
    }

    const preferred=selectedId||
      activeAccount?.id||
      localStorage.getItem(LAST_USER_KEY)||
      accounts[0].id;
    const selected=accounts.find(a=>a.id===preferred)||accounts[0];
    const isUnlock=Boolean(activeAccount&&activeAccount.id===selected.id&&locked);

    const content=
      '<div class="session-login-layout">'+
        accountListHtml(accounts,selected.id)+
        '<div class="session-card">'+
          '<div class="session-avatar large">'+escapeHTML(initials(selected.displayName))+'</div>'+
          '<h2>'+escapeHTML(selected.displayName)+'</h2>'+
          '<p class="session-subtitle">'+(isUnlock?"Introduza o PIN/palavra-passe para desbloquear.":"Inicie sessão neste perfil local.")+'</p>'+
          (message?'<div class="session-message">'+escapeHTML(message)+'</div>':"")+
          '<label class="session-secret-label">PIN ou palavra-passe'+
            '<input data-login-secret type="password" autocomplete="current-password" placeholder="PIN ou palavra-passe">'+
          '</label>'+
          '<button class="session-primary" data-login>'+(isUnlock?"Desbloquear":"Iniciar sessão")+'</button>'+
          '<button class="session-link" data-add-user>Adicionar utilizador</button>'+
        '</div>'+
      '</div>';

    const lock=lockShell(content);
    if(!lock)return;

    lock.querySelectorAll("[data-account]").forEach(btn=>{
      btn.onclick=()=>renderLogin({selectedId:btn.dataset.account});
    });
    lock.querySelector("[data-add-user]").onclick=()=>renderCreateAccount({firstAccount:false});

    const secret=lock.querySelector("[data-login-secret]");
    const login=lock.querySelector("[data-login]");

    async function submit(){
      if(login.disabled)return;
      const enteredSecret=secret.value;
      login.disabled=true;
      login.textContent="A verificar...";
      const slowTimer=setTimeout(()=>{
        if(login.isConnected)login.textContent="A verificar no dispositivo...";
      },1200);
      try{
        const ok=await verifyAccount(selected,enteredSecret);
        if(!ok){
          renderLogin({selectedId:selected.id,message:"PIN/palavra-passe incorreto."});
          return;
        }

        if(activeAccount?.id===selected.id&&locked){
          locked=false;
          $("#lock").classList.add("hidden");
          updateCurrentUserUI();
          return;
        }

        const conflict=await detectConflict(selected.id);
        if(conflict){
          renderConflict(selected);
          return;
        }
        await finishLogin(selected,{loadProfile:true});
      }catch(err){
        renderLogin({selectedId:selected.id,message:err?.message||"Não foi possível iniciar sessão."});
      }finally{
        clearTimeout(slowTimer);
      }
    }

    login.onclick=submit;
    secret.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();submit()}};
    setTimeout(()=>secret.focus(),0);
  }

  function renderConflict(account){
    const content=
      '<div class="session-card session-conflict">'+
        '<div class="session-avatar large">'+escapeHTML(initials(account.displayName))+'</div>'+
        '<h2>Sessão já aberta</h2>'+
        '<p>Esta conta já está aberta noutra janela deste dispositivo.</p>'+
        '<div class="session-message warning">Continuar aqui termina a sessão da outra janela.</div>'+
        '<div class="session-actions">'+
          '<button class="session-secondary" data-conflict-back>Voltar</button>'+
          '<button class="session-primary" data-conflict-takeover>Continuar aqui</button>'+
        '</div>'+
      '</div>';
    const lock=lockShell(content);
    lock.querySelector("[data-conflict-back]").onclick=()=>renderLogin({selectedId:account.id});
    lock.querySelector("[data-conflict-takeover]").onclick=async()=>{
      await broadcastTakeover(account.id);
      await finishLogin(account,{loadProfile:true});
    };
  }

  function stopChannel(){
    try{sessionChannel?.close()}catch{}
    sessionChannel=null;
  }

  function setupChannel(accountId){
    stopChannel();
    if(!("BroadcastChannel" in window))return;
    sessionChannel=new BroadcastChannel(CHANNEL_PREFIX+accountId);
    sessionChannel.onmessage=e=>{
      const data=e.data||{};
      if(data.from===tabId)return;
      if(data.type==="probe"){
        sessionChannel.postMessage({type:"occupied",from:tabId,to:data.from});
      }else if(data.type==="takeover"){
        forceSessionEnded("A sessão foi transferida para outra janela.");
      }
    };
  }

  async function detectConflict(accountId){
    if(!("BroadcastChannel" in window))return false;
    const channel=new BroadcastChannel(CHANNEL_PREFIX+accountId);
    let conflict=false;
    channel.onmessage=e=>{
      const data=e.data||{};
      if(data.type==="occupied"&&data.to===tabId)conflict=true;
    };
    channel.postMessage({type:"probe",from:tabId});
    await new Promise(r=>setTimeout(r,220));
    channel.close();
    return conflict;
  }

  async function broadcastTakeover(accountId){
    if(!("BroadcastChannel" in window))return;
    const channel=new BroadcastChannel(CHANNEL_PREFIX+accountId);
    channel.postMessage({type:"takeover",from:tabId});
    await new Promise(r=>setTimeout(r,100));
    channel.close();
  }

  function updateLastLogin(account){
    const accounts=readAccounts();
    const target=accounts.find(a=>a.id===account.id);
    if(target){
      target.lastLoginAt=Date.now();
      writeAccounts(accounts);
      activeAccount=target;
    }
    localStorage.setItem(LAST_USER_KEY,account.id);
  }

  async function finishLogin(account,{loadProfile=true}={}){
    if(activeAccount&&activeAccount.id!==account.id)saveActiveProfile();
    closeAllWindows();
    stopChannel();

    sessionStorage.setItem(SESSION_KEY,account.id);
    activeAccount=account;

    if(loadProfile){
      replaceStateData(readProfile(account.id));
      try{v5MigrateState()}catch{}
    }

    updateLastLogin(account);
    setupChannel(account.id);
    locked=false;
    refreshShell();
    $("#lock")?.classList.add("hidden");
    notify("Windows","Sessão iniciada como "+activeAccount.displayName+".");
  }

  function clearSessionIdentity(){
    try{sessionStorage.removeItem(SESSION_KEY)}catch{}
    stopChannel();
    activeAccount=null;
    locked=true;
  }

  function resetMemoryAfterLogout(){
    closeAllWindows();
    replaceStateData(defaultState());
    refreshShell();
  }

  function signOut(message="Sessão terminada."){
    if(activeAccount)saveActiveProfile();
    clearSessionIdentity();
    resetMemoryAfterLogout();
    $("#lock")?.classList.remove("hidden");
    renderLogin({message});
  }

  function forceSessionEnded(message){
    if(activeAccount)saveActiveProfile();
    clearSessionIdentity();
    resetMemoryAfterLogout();
    $("#lock")?.classList.remove("hidden");
    renderLogin({message});
  }

  function lockSession({switching=false}={}){
    if(activeAccount)saveActiveProfile();
    locked=true;
    closeOverlays();
    $("#lock")?.classList.remove("hidden");
    renderLogin({
      selectedId:switching?(localStorage.getItem(LAST_USER_KEY)||null):activeAccount?.id||null
    });
  }

  function switchUser(){lockSession({switching:true})}

  lockSystem=function(){lockSession()};
  try{globalThis.lockSystem=lockSystem}catch{}

  function endSessionForPower(){
    if(activeAccount)saveActiveProfile();
    clearSessionIdentity();
    closeAllWindows();
    replaceStateData(defaultState());
    refreshShell();
  }

  function restartWithSessions(){
    closeOverlays();
    endSessionForPower();
    $("#lock")?.classList.add("hidden");
    $("#shutdown-text").textContent="A reiniciar...";
    $("#shutdown").classList.remove("hidden");
    setTimeout(()=>{
      $("#shutdown").classList.add("hidden");
      $("#boot").classList.remove("hidden");
      setTimeout(()=>{
        $("#boot").classList.add("hidden");
        renderLogin();
        $("#lock").classList.remove("hidden");
      },1000);
    },900);
  }

  function shutdownWithSessions(){
    closeOverlays();
    endSessionForPower();
    $("#lock")?.classList.add("hidden");
    $("#shutdown-text").textContent="Encerrado. Toque para ligar.";
    $("#shutdown").classList.remove("hidden");
    $("#shutdown").onclick=()=>{
      $("#shutdown").onclick=null;
      $("#shutdown").classList.add("hidden");
      $("#boot").classList.remove("hidden");
      setTimeout(()=>{
        $("#boot").classList.add("hidden");
        renderLogin();
        $("#lock").classList.remove("hidden");
      },1000);
    };
  }

  restartSystem=restartWithSessions;
  shutdownSystem=shutdownWithSessions;
  try{
    globalThis.restartSystem=restartSystem;
    globalThis.shutdownSystem=shutdownSystem;
  }catch{}

  function wirePowerMenu(){
    const power=$("#power-btn");
    if(!power)return;
    power.onclick=e=>{
      e.stopPropagation();
      showContext(e.clientX||innerWidth/2,e.clientY||innerHeight/2,[
        ["Bloquear",()=>lockSession()],
        ["Mudar de utilizador",()=>switchUser()],
        ["Terminar sessão",()=>signOut()],
        ["Suspender",()=>lockSession()],
        ["Reiniciar",()=>restartWithSessions()],
        ["Encerrar",()=>shutdownWithSessions()]
      ]);
    };
  }

  function renderAccountsSettings(box){
    if(box.querySelector("[data-session-accounts-card]"))return;
    const accounts=readAccounts();
    const card=document.createElement("div");
    card.className="sys-card session-settings-card";
    card.dataset.sessionAccountsCard="";
    card.innerHTML=
      '<strong>Contas locais e sessões</strong>'+
      '<p>Perfis separados neste dispositivo. O PIN/palavra-passe é verificado por PBKDF2-SHA-256.</p>'+
      '<div class="session-settings-users">'+accounts.map(a=>
        '<div><span class="session-avatar small">'+escapeHTML(initials(a.displayName))+'</span>'+
        '<span><strong>'+escapeHTML(a.displayName)+'</strong><small>'+
        (a.id===activeAccount?.id?"Sessão atual":"Perfil local")+
        '</small></span></div>'
      ).join("")+'</div>'+
      '<div class="session-settings-actions">'+
        '<button class="sys-button" data-session-add>Adicionar utilizador</button>'+
        '<button class="sys-button" data-session-switch>Mudar de utilizador</button>'+
      '</div>';
    (box.querySelector(".sys-grid")||box).appendChild(card);
    card.querySelector("[data-session-add]").onclick=()=>{
      saveActiveProfile();
      locked=true;
      $("#lock").classList.remove("hidden");
      renderCreateAccount({firstAccount:false});
    };
    card.querySelector("[data-session-switch]").onclick=()=>switchUser();
  }

  if(typeof renderSettingsPageV5==="function"){
    const previousSettingsPage=renderSettingsPageV5;
    renderSettingsPageV5=function(box,page){
      previousSettingsPage(box,page);
      if(page==="accounts")renderAccountsSettings(box);
    };
    try{globalThis.renderSettingsPageV5=renderSettingsPageV5}catch{}
  }

  async function handleBootComplete(){
    wirePowerMenu();

    const sessionId=sessionStorage.getItem(SESSION_KEY);
    const account=sessionId?accountById(sessionId):null;

    if(sessionId&&!account){
      sessionStorage.removeItem(SESSION_KEY);
    }

    if(account){
      activeAccount=account;
      const conflict=await detectConflict(account.id);
      if(conflict){
        clearSessionIdentity();
        resetMemoryAfterLogout();
        renderLogin({selectedId:account.id,message:"A sessão já está aberta noutra janela. Inicie sessão novamente para continuar."});
        $("#lock").classList.remove("hidden");
        return false;
      }
      updateLastLogin(account);
      setupChannel(account.id);
      locked=false;
      refreshShell();
      $("#lock").classList.add("hidden");
      return true;
    }

    activeAccount=null;
    locked=true;
    resetMemoryAfterLogout();
    renderLogin();
    $("#lock").classList.remove("hidden");
    return false;
  }

  bootResumePromise=Promise.resolve();

  globalThis.Win11SessionManager=Object.freeze({
    version:"6.7.3",
    get activeUserId(){return activeAccount?.id||null},
    get activeUser(){return activeAccount?{id:activeAccount.id,displayName:activeAccount.displayName}:null},
    get isLocked(){return locked},
    get broadcastChannelSupported(){return "BroadcastChannel" in window},
    listAccounts(){return readAccounts().map(a=>({id:a.id,displayName:a.displayName,createdAt:a.createdAt,lastLoginAt:a.lastLoginAt}))},
    createAccount,
    verifyAccount,
    lock:lockSession,
    signOut,
    switchUser,
    handleBootComplete,
    saveActiveProfile
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"6.7.3",
    step:6,
    features:[
      "real-file-open","real-file-save","download-fallback",
      "real-clipboard-write","real-clipboard-read","clipboard-manual-paste-fallback",
      "explorer-real-import","explorer-real-folder-import","explorer-drag-drop","explorer-real-export",
      "photos-real-image-open","media-real-playback",
      "local-accounts","per-user-state","session-lock","session-signout","session-switch-user",
      "pbkdf2-credentials","broadcast-session-conflict","per-user-indexeddb-ownership"
    ]
  });
})();
