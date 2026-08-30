const port=Number(process.argv[2]||9227);
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));

const targets=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());
const target=targets.find(t=>/^http:\/\/127\.0\.0\.1:8767\//.test(t.url));
if(!target)throw new Error("Simulator target not found");

const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});

let seq=0;
const pending=new Map();
const exceptions=[];
const consoleErrors=[];
const privacyWarnings=[];

ws.onmessage=(ev)=>{
  const msg=JSON.parse(ev.data);
  if(msg.id&&pending.has(msg.id)){
    const {resolve,reject}=pending.get(msg.id);
    pending.delete(msg.id);
    if(msg.error)reject(new Error(msg.error.message));
    else resolve(msg.result);
    return;
  }
  if(msg.method==="Runtime.exceptionThrown"){
    exceptions.push(msg.params.exceptionDetails?.exception?.description||msg.params.exceptionDetails?.text||"exception");
  }
  if(msg.method==="Log.entryAdded"&&["error","warning"].includes(msg.params.entry?.level)){
    const entry={
      text:msg.params.entry.text,
      url:msg.params.entry.url||"",
      source:msg.params.entry.source||""
    };
    if(/^Tracking Prevention blocked access to storage for /i.test(entry.text||""))privacyWarnings.push(entry);
    else consoleErrors.push(entry);
  }
};

function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++seq;
    pending.set(id,{resolve,reject});
    ws.send(JSON.stringify({id,method,params}));
    setTimeout(()=>{
      if(pending.has(id)){
        pending.delete(id);
        reject(new Error("CDP timeout: "+method));
      }
    },7000);
  });
}

async function evaluate(expression){
  const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails){
    const ex=r.exceptionDetails;
    const detail=ex.exception?.description||ex.exception?.value||ex.text||"Evaluation failed";
    throw new Error(String(detail));
  }
  return r.result?.value;
}

const checks=[];
async function check(name,fn){
  try{
    const ok=Boolean(await fn());
    checks.push({name,ok});
  }catch(e){
    checks.push({name,ok:false,error:e.message});
  }
}

async function waitFor(fn,timeout=3000,step=100){
  const start=Date.now();
  while(Date.now()-start<timeout){
    try{if(await fn())return true}catch{}
    await wait(step);
  }
  return false;
}

async function isolatedTargetUrls(){
  const result=await send("Target.getTargets");
  return (result.targetInfos||[]).map(t=>t.url).filter(Boolean);
}

async function uiLogin(id,secret){
  await evaluate(`(()=>{const id=${JSON.stringify(id)};const b=document.querySelector('[data-account="'+id+'"]');if(!b)return false;b.click();return true})()`);
  await wait(80);
  await evaluate(`(()=>{const i=document.querySelector("[data-login-secret]");const b=document.querySelector("[data-login]");if(!i||!b)return false;i.value=${JSON.stringify(secret)};b.click();return true})()`);
  return waitFor(async()=>await evaluate(`(()=>{const lock=document.querySelector("#lock");return Win11SessionManager?.activeUserId===${JSON.stringify(id)} && lock?.classList.contains("hidden") && getComputedStyle(lock).display==="none"})()`),12000,120);
}

await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
await wait(250);

await check("boot diagnostics",async()=>await evaluate(`typeof Win11SimDiagnostics==="object" && Win11SimDiagnostics.run().missingFunctions.length===0`));
await check("session manager available",async()=>await evaluate(`typeof Win11SessionManager==="object" && Win11SessionManager.version==="7.2.0"`));
await check("first account setup visible",async()=>await evaluate(`!!document.querySelector("[data-new-user-name]") && !!document.querySelector("[data-create-user]")`));

await evaluate(`(()=>{
  const n=document.querySelector("[data-new-user-name]");
  const s=document.querySelector("[data-new-user-secret]");
  const c=document.querySelector("[data-new-user-confirm]");
  if(!n||!s||!c)return false;
  n.value="Audit User One";
  s.value="2468";
  c.value="2468";
  document.querySelector("[data-create-user]").click();
  return true;
})()`);

await check("first account login",async()=>await waitFor(async()=>await evaluate(`(()=>{const lock=document.querySelector("#lock");return Win11SessionManager?.activeUser?.displayName==="Audit User One" && lock?.classList.contains("hidden") && getComputedStyle(lock).display==="none"})()`),5000,120));

const user1Id=await evaluate(`Win11SessionManager.activeUserId`);
await check("credential hash metadata",async()=>await evaluate(`(()=>{
  const raw=localStorage.getItem("win11-sim-accounts-v67")||"";
  const accounts=JSON.parse(raw||"[]");
  return accounts.length===1 &&
    accounts[0].credential?.algorithm==="PBKDF2-SHA-256" &&
    !!accounts[0].credential?.salt &&
    !!accounts[0].credential?.hash &&
    !raw.includes("2468");
})()`));
await check("per-user profile created",async()=>await evaluate(`!!localStorage.getItem("win11-sim-profile-v67:"+Win11SessionManager.activeUserId)`));
await check("legacy state moved out of active key",async()=>await evaluate(`!localStorage.getItem("win11-sim-v4") && !!localStorage.getItem("win11-sim-legacy-backup-v67")`));
await check("active session stored in sessionStorage",async()=>await evaluate(`sessionStorage.getItem("win11-sim-active-session-v67")===Win11SessionManager.activeUserId`));
await evaluate(`(async()=>{const accounts=JSON.parse(localStorage.getItem("win11-sim-accounts-v67"));const a=accounts.find(x=>x.id===Win11SessionManager.activeUserId);const salt=crypto.getRandomValues(new Uint8Array(16));const to64=b=>{let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s)};const key=await crypto.subtle.importKey("raw",new TextEncoder().encode("2468"),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:180000,hash:"SHA-256"},key,256);a.credential={type:"local-secret",algorithm:"PBKDF2-SHA-256",iterations:180000,salt:to64(salt),hash:to64(new Uint8Array(bits))};localStorage.setItem("win11-sim-accounts-v67",JSON.stringify(accounts));return true})()`);
await evaluate(`Win11SessionManager.signOut();true`);
await check("legacy 180k credential login through worker",async()=>await uiLogin(user1Id,"2468"));
await check("legacy credential upgraded to 120k",async()=>await evaluate(`JSON.parse(localStorage.getItem("win11-sim-accounts-v67")).find(x=>x.id===Win11SessionManager.activeUserId)?.credential?.iterations===120000`));

await evaluate(`state.notepadText="USER_ONE_ONLY";saveState();true`);
await evaluate(`(async()=>{globalThis.__auditOwnerRef=await RealContentBridge.importFileToVirtual(new File(["owner-one"],"owner-one.txt",{type:"text/plain"}),"C:/Documents");return true})()`);
await check("IndexedDB blob owned by user one",async()=>await evaluate(`(async()=>{const r=await RealContentBridge.getRecord(__auditOwnerRef.ref);return r?.ownerId===Win11SessionManager.activeUserId})()`));

const user2=await evaluate(`(async()=>await Win11SessionManager.createAccount("Audit User Two","5678"))()`);
await check("second account created",async()=>Boolean(user2?.id));
await check("second credential verifies",async()=>await evaluate(`(async()=>{const a=Win11SessionManager.listAccounts().find(x=>x.id===${JSON.stringify(user2.id)});const full=JSON.parse(localStorage.getItem("win11-sim-accounts-v67")).find(x=>x.id===a.id);return await Win11SessionManager.verifyAccount(full,"5678") && !(await Win11SessionManager.verifyAccount(full,"0000"))})()`));

await evaluate(`Win11SessionManager.signOut();true`);
await check("sign out clears session identity",async()=>await evaluate(`!Win11SessionManager.activeUserId && !sessionStorage.getItem("win11-sim-active-session-v67") && !document.querySelector("#lock")?.classList.contains("hidden")`));
await check("login second account",async()=>await uiLogin(user2.id,"5678"));
await check("user two starts isolated",async()=>await evaluate(`state.notepadText!=="USER_ONE_ONLY"`));
await check("user two cannot read user one blob",async()=>await evaluate(`(async()=>!(await RealContentBridge.getRecord(__auditOwnerRef.ref)))()`));
await evaluate(`state.notepadText="USER_TWO_ONLY";saveState();true`);

await evaluate(`Win11SessionManager.signOut();true`);
await check("login first account again",async()=>await uiLogin(user1Id,"2468"));
await check("user one state restored",async()=>await evaluate(`state.notepadText==="USER_ONE_ONLY"`));
await check("user one blob restored",async()=>await evaluate(`(async()=>{const r=await RealContentBridge.getRecord(__auditOwnerRef.ref);return !!r && await r.blob.text()==="owner-one"})()`));
await check("Profile management APIs available",async()=>await evaluate(`typeof Win11SessionManager.updateAccountName==="function" && typeof Win11SessionManager.setAccountAvatar==="function" && typeof Win11SessionManager.changeCurrentCredential==="function" && typeof Win11SessionManager.buildCurrentProfileBackup==="function" && typeof Win11SessionManager.restoreCurrentProfileBackup==="function"`));
await evaluate(`Win11SessionManager.updateAccountName(Win11SessionManager.activeUserId,"Audit User One Renamed");true`);
await check("Account rename",async()=>await evaluate(`Win11SessionManager.activeUser?.displayName==="Audit User One Renamed" && Win11SessionManager.listAccounts().some(a=>a.displayName==="Audit User One Renamed")`));
await evaluate(`Win11SessionManager.updateAccountName(Win11SessionManager.activeUserId,"Audit User One");true`);
await evaluate(`(async()=>{const c=document.createElement("canvas");c.width=24;c.height=24;const x=c.getContext("2d");x.fillStyle="#1976d2";x.fillRect(0,0,24,24);const blob=await new Promise(r=>c.toBlob(r,"image/png"));await Win11SessionManager.setAccountAvatar(Win11SessionManager.activeUserId,blob);return true})()`);
await check("Profile avatar stored",async()=>await evaluate(`Win11SessionManager.listAccounts().find(a=>a.id===Win11SessionManager.activeUserId)?.avatarDataUrl?.startsWith("data:image/jpeg")`));
await evaluate(`Win11SessionManager.removeAccountAvatar(Win11SessionManager.activeUserId);true`);
await check("Profile avatar removed",async()=>await evaluate(`!Win11SessionManager.listAccounts().find(a=>a.id===Win11SessionManager.activeUserId)?.avatarDataUrl`));
await check("Credential change",async()=>await evaluate(`(async()=>{await Win11SessionManager.changeCurrentCredential("2468","1357");const full=JSON.parse(localStorage.getItem("win11-sim-accounts-v67")).find(a=>a.id===Win11SessionManager.activeUserId);const changed=await Win11SessionManager.verifyAccount(full,"1357")&&!(await Win11SessionManager.verifyAccount(full,"2468"));await Win11SessionManager.changeCurrentCredential("1357","2468");return changed})()`));
await evaluate(`state.notepadText="BACKUP_ORIGINAL";saveState();true`);
await evaluate(`(async()=>{globalThis.__auditProfilePack=await Win11SessionManager.buildCurrentProfileBackup();globalThis.__auditBackupOldId=state.files["C:/Documents"]["owner-one.txt"]?.__realBlobId||null;return true})()`);
await check("Profile backup excludes credentials",async()=>await evaluate(`__auditProfilePack?.schema==="win11-simulator-profile" && !JSON.stringify(__auditProfilePack).includes("\\"credential\\"") && Array.isArray(__auditProfilePack.blobs) && __auditProfilePack.blobs.length>=1`));
await evaluate(`state.notepadText="BACKUP_MUTATED";saveState();true`);
await evaluate(`(async()=>{const f=new File([JSON.stringify(__auditProfilePack)],"audit.win11profile",{type:"application/json"});await Win11SessionManager.restoreCurrentProfileBackup(f);return true})()`);
await check("Profile restore state",async()=>await evaluate(`state.notepadText==="BACKUP_ORIGINAL"`));
await check("Profile restore remaps blob IDs",async()=>await evaluate(`(async()=>{const ref=state.files["C:/Documents"]["owner-one.txt"];if(!ref?.__realBlobId||ref.__realBlobId===__auditBackupOldId)return false;const rec=await RealContentBridge.getRecord(ref);return !!rec&&await rec.blob.text()==="owner-one"})()`));
const deleteUser=await evaluate(`(async()=>await Win11SessionManager.createAccount("Audit Delete Me","9999"))()`);
await check("Temporary account created",async()=>Boolean(deleteUser?.id));
await evaluate(`(async()=>{await Win11SessionManager.deleteAccount(${JSON.stringify(deleteUser?.id)});return true})()`);
await check("Inactive account deletion",async()=>await evaluate(`!Win11SessionManager.listAccounts().some(a=>a.id===${JSON.stringify(deleteUser?.id)}) && !localStorage.getItem("win11-sim-profile-v67:"+${JSON.stringify(deleteUser?.id)})`));
await evaluate(`state.sessionAutoLockMinutes=0.002;saveState();Win11SessionManager.scheduleInactivityLock();true`);
await check("Automatic inactivity lock",async()=>await waitFor(async()=>await evaluate(`Win11SessionManager.isLocked && getComputedStyle(document.querySelector("#lock")).display!=="none"`),1200,80));
await check("Unlock after automatic lock",async()=>await uiLogin(user1Id,"2468"));
await evaluate(`state.sessionAutoLockMinutes=0;saveState();Win11SessionManager.scheduleInactivityLock();true`);

await check("same-account BroadcastChannel probe",async()=>await evaluate(`(async()=>{
  if(!("BroadcastChannel" in window))return true;
  const id=Win11SessionManager.activeUserId;
  const probeId="audit-probe-"+Date.now();
  const ch=new BroadcastChannel("win11-sim-session-v67:"+id);
  let occupied=false;
  ch.onmessage=e=>{if(e.data?.type==="occupied"&&e.data?.to===probeId)occupied=true};
  ch.postMessage({type:"probe",from:probeId});
  await new Promise(r=>setTimeout(r,280));
  ch.close();
  return occupied;
})()`));

await evaluate(`Win11SessionManager.lock();true`);
await check("lock requires credential",async()=>await evaluate(`(()=>{const lock=document.querySelector("#lock");return Win11SessionManager.isLocked && !lock?.classList.contains("hidden") && getComputedStyle(lock).display!=="none" && !!document.querySelector("[data-login-secret]")})()`));
await check("unlock current account",async()=>await uiLogin(user1Id,"2468"));

await evaluate(`openApp("explorer","C:/Documents");true`);
await wait(450);
await check("Explorer real shell",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"] .explorer-real')`));
await check("Explorer breadcrumbs",async()=>await evaluate(`document.querySelectorAll('.window[data-app="explorer"] .crumb').length>=1`));
await check("Explorer status",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"] .explorer-status')`));
await evaluate(`document.querySelector('.window[data-app="explorer"] .file,.window[data-app="explorer"] .file-row:not(.header)')?.click();true`);
await wait(120);
await check("Explorer selected count",async()=>await evaluate(`document.querySelector('.window[data-app="explorer"] .explorer-status')?.textContent.includes("selecionado")`));
await check("Desktop integration bridge",async()=>await evaluate(`typeof Win11DesktopIntegration==="object" && Win11DesktopIntegration.version==="7.2.0"`));
await check("Default file associations",async()=>await evaluate(`Win11DesktopIntegration.defaultAppFor("teste.txt")==="notepad" && Win11DesktopIntegration.defaultAppFor("imagem.png")==="photos"`));
await check("Image has multiple Open With apps",async()=>await evaluate(`(()=>{const ids=Win11DesktopIntegration.candidateApps("imagem.png").map(a=>a.id);return ids.includes("photos")&&ids.includes("paint")})()`));
await evaluate(`(()=>{const c=document.createElement("canvas");c.width=16;c.height=16;const x=c.getContext("2d");x.fillStyle="#3366cc";x.fillRect(0,0,16,16);ensureFolder("C:/Pictures")["V7Audit.png"]=c.toDataURL("image/png");Win11DesktopIntegration.setDefaultApp(".png","paint");return true})()`);
await check("Per-profile association stored",async()=>await evaluate(`state.fileAssociations[".png"]==="paint" && JSON.parse(localStorage.getItem("win11-sim-profile-v67:"+Win11SessionManager.activeUserId)).fileAssociations[".png"]==="paint"`));
await check("Association isolated from user two",async()=>await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem("win11-sim-profile-v67:"+${JSON.stringify(user2.id)})||"{}");return p.fileAssociations?.[".png"]!=="paint"})()`));
await evaluate(`openFile("C:/Pictures","V7Audit.png",ensureFolder("C:/Pictures")["V7Audit.png"]);true`); await wait(180);
await check("Default app opens image in Paint",async()=>await evaluate(`$$(".window").some(w=>w.dataset.app==="paint"&&w.dataset.openedFile==="V7Audit.png")`));
await evaluate(`Win11DesktopIntegration.setDefaultApp(".png","photos");Win11DesktopIntegration.showOpenWith("C:/Pictures","V7Audit.png",ensureFolder("C:/Pictures")["V7Audit.png"]);true`); await wait(100);
await check("Open With dialog UI",async()=>await evaluate(`document.querySelector("#system-dialog").classList.contains("open") && document.querySelectorAll('#system-dialog-body input[name="openwith-app"]').length>=2 && !!document.querySelector("#system-dialog-body [data-openwith-always]")`));
await evaluate(`document.querySelector("#system-dialog-x").click();true`);
await check("Native file share path",async()=>await evaluate(`(async()=>{Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>true});Object.defineProperty(navigator,"share",{configurable:true,value:async data=>{globalThis.__auditShared={title:data.title,file:data.files?.[0]?.name||null,text:data.text||null}}});ensureFolder("C:/Documents")["ShareV7.txt"]="partilha v7";const ok=await Win11DesktopIntegration.shareFile("C:/Documents","ShareV7.txt",ensureFolder("C:/Documents")["ShareV7.txt"]);const pass=ok&&__auditShared?.file==="ShareV7.txt";delete navigator.share;delete navigator.canShare;return pass})()`));
await check("Safe print document escaping",async()=>await evaluate(`(()=>{const d=Win11DesktopIntegration.printableTextDocument("audit.txt","<script>danger<\\/script>");return !d.includes("<script>danger<\\/script>")&&d.includes("&lt;script&gt;danger&lt;/script&gt;")})()`));
await check("Real print path for text file",async()=>await evaluate(`(async()=>await Win11DesktopIntegration.printFile("C:/Documents","ShareV7.txt",ensureFolder("C:/Documents")["ShareV7.txt"]))()`));
await evaluate(`delete ensureFolder("C:/Pictures")["V7Audit.png"];delete ensureFolder("C:/Documents")["ShareV7.txt"];Win11DesktopIntegration.setDefaultApp(".png","paint");saveState();true`);
await check("Real Quick Settings controls",async()=>await evaluate(`!!document.querySelector("[data-real-network]") && !!document.querySelector("[data-real-fullscreen]") && !!document.querySelector("[data-real-wake]") && !document.querySelector('#quick-panel [data-quick="wifi"]')`));
await check("Real network tile reflects navigator",async()=>await evaluate(`(()=>{const t=document.querySelector("[data-real-network]");return !!t && (navigator.onLine?t.classList.contains("on"):t.classList.contains("offline"))})()`));

await evaluate(`openApp("edge");true`);
await wait(350);
await check("Edge real shell",async()=>await evaluate(`!!document.querySelector('.window[data-app="edge"] .edge-real')`));
await check("Edge initial tab",async()=>await evaluate(`document.querySelectorAll('.window[data-app="edge"] .edge-real-tab').length===1`));
await evaluate(`document.querySelector('.window[data-app="edge"] [data-new-tab]').click();true`);
await wait(120);
await check("Edge multi tab",async()=>await evaluate(`document.querySelectorAll('.window[data-app="edge"] .edge-real-tab').length===2`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="wikipedia.org";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`);
await wait(180);
await check("Edge URL normalization",async()=>await evaluate(`document.querySelector('.window[data-app="edge"] .edge-tab-frame')?.src.startsWith("https://wikipedia.org")`));
await check("Edge Internet bridge",async()=>await evaluate(`Win11EdgeInternet?.version==="7.2.0"`));
await evaluate(`document.querySelector('.window[data-app="edge"] [data-home]').click();true`); await wait(100);
await check("Edge Web shortcuts",async()=>await evaluate(`document.querySelectorAll('.window[data-app="edge"] [data-edge-shortcut]').length===4`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="google.com";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(160);
await check("Edge Google home iframe",async()=>await evaluate(`(()=>{const f=document.querySelector('.window[data-app="edge"] .edge-tab-frame');return !!f && f.src.includes("google.com/webhp") && f.src.includes("igu=1")})()`));
await check("Edge Google cross-origin iframe target",async()=>await waitFor(async()=>{const urls=await isolatedTargetUrls();return urls.some(u=>u.includes("google.com/webhp")&&u.includes("igu=1"))},3000,150));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="Windows 11";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(160);
await check("Edge Google search",async()=>await evaluate(`(()=>{const f=document.querySelector('.window[data-app="edge"] .edge-tab-frame');return !!f && f.src.includes("google.com/search") && f.src.includes("igu=1") && f.src.includes("Windows")})()`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="youtube.com";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(120);
await check("Edge YouTube compatibility portal",async()=>await evaluate(`!!document.querySelector('.window[data-app="edge"] .edge-youtube-portal') && !!document.querySelector('.window[data-app="edge"] [data-youtube-url]')`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="yt: nasa";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(100);
await check("Edge YouTube search mode",async()=>await evaluate(`document.querySelector('.window[data-app="edge"] [data-youtube-search]')?.value==="nasa" && !!document.querySelector('.window[data-app="edge"] [data-youtube-external-search]')`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="https://www.youtube.com/watch?v=M7lc1UVf-VE";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(180);
await check("Edge YouTube official video player",async()=>await evaluate(`document.querySelector('.window[data-app="edge"] .edge-youtube-frame')?.src.includes("youtube.com/embed/M7lc1UVf-VE")`));
await check("Edge YouTube cross-origin iframe target",async()=>await waitFor(async()=>{const urls=await isolatedTargetUrls();return urls.some(u=>u.includes("youtube.com/embed/M7lc1UVf-VE"))},3000,150));
await check("Edge YouTube external video URL",async()=>await evaluate(`Win11EdgeInternet.externalUrlFor("edge://youtube/watch?v=M7lc1UVf-VE")==="https://www.youtube.com/watch?v=M7lc1UVf-VE"`));
await check("Edge youtu.be parsing",async()=>await evaluate(`Win11EdgeInternet.normalize("https://youtu.be/M7lc1UVf-VE").startsWith("edge://youtube/watch?v=M7lc1UVf-VE")`));
await check("Edge YouTube Shorts parsing",async()=>await evaluate(`Win11EdgeInternet.normalize("https://www.youtube.com/shorts/M7lc1UVf-VE").startsWith("edge://youtube/watch?v=M7lc1UVf-VE")`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="https://www.youtube.com/playlist?list=PLC77007E23FF423C6";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(160);
await check("Edge YouTube playlist player",async()=>await evaluate(`document.querySelector('.window[data-app="edge"] .edge-youtube-frame')?.src.includes("youtube.com/embed/videoseries") && document.querySelector('.window[data-app="edge"] .edge-youtube-frame')?.src.includes("PLC77007E23FF423C6")`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="https://x.com/";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(100);
await check("Edge blocked-site compatibility page",async()=>await evaluate(`!!document.querySelector('.window[data-app="edge"] .edge-compat-page [data-compat-open]')`));

await evaluate(`openApp("taskmanager");true`);
await wait(250);
await check("Task Manager modern shell",async()=>await evaluate(`!!document.querySelector('.window[data-app="taskmanager"] .tm-real')`));
await check("Task Manager process rows",async()=>await evaluate(`document.querySelectorAll('.window[data-app="taskmanager"] [data-process]').length>=2`));

await evaluate(`openApp("settings");true`);
await wait(250);
await check("Settings realism header",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] .settings-real-top')`));
await evaluate(`(()=>{state.settingsPage="accounts";const settingsWin=document.querySelector('.window[data-app="settings"]');if(settingsWin){settingsWin.querySelector(".win-body").innerHTML="";settingsWin.querySelector(".win-body").appendChild(renderApp("settings",settingsWin));}return true})()`);
await wait(150);
await check("Settings local accounts card",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-session-accounts-card]')`));
await check("Settings profile management controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-profile-avatar]') && !!document.querySelector('.window[data-app="settings"] [data-profile-pin]') && !!document.querySelector('.window[data-app="settings"] [data-profile-export]') && !!document.querySelector('.window[data-app="settings"] [data-profile-restore]') && !!document.querySelector('.window[data-app="settings"] [data-profile-autolock]')`));
await evaluate(`(()=>{state.settingsPage="apps";const w=document.querySelector('.window[data-app="settings"]');if(w){w.querySelector(".win-body").innerHTML="";w.querySelector(".win-body").appendChild(renderApp("settings",w));}return true})()`); await wait(140);
await check("Settings Default Apps UI",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-default-apps-v700]') && document.querySelector('.window[data-app="settings"] [data-default-ext=".png"]')?.querySelectorAll("option").length>=2`));
await evaluate(`(()=>{state.settingsPage="network";const w=document.querySelector('.window[data-app="settings"]');if(w){w.querySelector(".win-body").innerHTML="";w.querySelector(".win-body").appendChild(renderApp("settings",w));}return true})()`); await wait(140);
await check("Settings real network disclosure",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-real-network-card]') && document.querySelector('.window[data-app="settings"] [data-real-network-card]')?.textContent.includes("redes Wi‑Fi listadas abaixo pertencem à simulação")`));

await evaluate(`openApp("notepad");true`);
await wait(220);
await evaluate(`document.querySelector('.window[data-app="notepad"] [data-saveas]').click();true`);
await wait(120);
await check("Save dialog",async()=>await evaluate(`document.querySelector("#system-dialog").classList.contains("open") && !!document.querySelector("[data-dialog-name]")`));
await evaluate(`document.querySelector("[data-dialog-name]").value="AuditFile";document.querySelector("#system-dialog-ok").click();true`);
await wait(120);
await check("Save extension .txt",async()=>await evaluate(`Object.prototype.hasOwnProperty.call(state.files["C:/Documents"],"AuditFile.txt")`));
await evaluate(`delete state.files["C:/Documents"]["AuditFile.txt"];saveState();true`);

await check("Real file bridge available",async()=>await evaluate(`typeof RealFileBridge==="object" && RealFileBridge.version==="7.2.0"`));
await check("Notepad real file controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="notepad"] [data-open-device]') && !!document.querySelector('.window[data-app="notepad"] [data-save-device]')`));
await check("Real file handle write path",async()=>await evaluate(`(async()=>{const test={text:null,closed:false};const handle={name:"audit.txt",async createWritable(){return {async write(v){test.text=v},async close(){test.closed=true}}}};await RealFileBridge.writeHandle(handle,"conteúdo real");return test.text==="conteúdo real"&&test.closed})()`));
await check("Real functions Edge Internet marker",async()=>await evaluate(`Win11RealFunctions?.step===11 && Win11RealFunctions.features.includes("real-folder-mounts") && Win11RealFunctions.features.includes("edge-google") && Win11RealFunctions.features.includes("edge-youtube-player") && Win11RealFunctions.features.includes("edge-site-compatibility")`));

await check("Real clipboard bridge available",async()=>await evaluate(`typeof RealClipboardBridge==="object" && RealClipboardBridge.version==="7.2.0"`));
await check("Notepad real clipboard controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="notepad"] [data-copy-device]') && !!document.querySelector('.window[data-app="notepad"] [data-paste-device]')`));
await evaluate(`closeOverlays();toggleOverlay("clipboard");renderClipboard();true`);
await wait(120);
await check("Win+V real clipboard controls",async()=>await evaluate(`!!document.querySelector("#clipboard-list [data-real-clip-read]") && !!document.querySelector("#clipboard-list [data-real-clip-write]")`));
await check("Manual paste fallback",async()=>await evaluate(`(async()=>{const p=RealClipboardBridge.manualPasteDialog();await new Promise(r=>setTimeout(r,30));const box=document.querySelector("[data-real-paste-box]");if(!box)return false;box.value="clipboard audit";document.querySelector("#system-dialog-ok").click();return (await p)==="clipboard audit"})()`));
await evaluate(`closeOverlays();true`);

await check("Real content bridge available",async()=>await evaluate(`typeof RealContentBridge==="object" && RealContentBridge.version==="7.2.0"`));
await check("IndexedDB import and cleanup",async()=>await evaluate(`(async()=>{const imported=await RealContentBridge.importFileToVirtual(new File(["conteúdo indexeddb"],"browser-audit-real.txt",{type:"text/plain"}),"C:/Documents");const rec=await RealContentBridge.getRecord(imported.ref);const ok=rec&&await rec.blob.text()==="conteúdo indexeddb"&&rec.ownerId===Win11SessionManager.activeUserId;delete state.files["C:/Documents"][imported.name];saveState();await RealContentBridge.cleanupVirtualValue(imported.ref);const gone=!(await RealContentBridge.getRecord(imported.ref));return !!ok&&gone})()`));
await check("Real folder import preserves subfolders",async()=>await evaluate(`(async()=>{const f=new File(["subfile"],"one.txt",{type:"text/plain"});Object.defineProperty(f,"_relativePath",{value:"Sub/one.txt"});const result=await RealContentBridge.importDirectoryToVirtual({name:"AuditFolder",files:[f]},"C:/Downloads");const ref=state.files[result.root+"/Sub"]?.["one.txt"];const ok=!!ref?.__realBlobId;await RealContentBridge.cleanupVirtualFolder(result.root);Object.keys(state.files).filter(p=>p===result.root||p.startsWith(result.root+"/")).forEach(p=>delete state.files[p]);saveState();return ok})()`));
await check("Explorer real content controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"] [data-import-files]') && !!document.querySelector('.window[data-app="explorer"] [data-import-folder]') && !!document.querySelector('.window[data-app="explorer"] [data-export-file]')`));

await evaluate(`globalThis.RealPhotosPending={name:"audit.svg",blob:new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>'],{type:"image/svg+xml"})};openApp("photos");true`);
await wait(160);
await check("Photos real viewer",async()=>await evaluate(`!!document.querySelector('.window[data-app="photos"] [data-open-real-photo]') && document.querySelector('.window[data-app="photos"] .real-photo-viewer img')?.src.startsWith("blob:")`));

await evaluate(`globalThis.RealMediaPending={name:"audit.wav",blob:new Blob([new Uint8Array([82,73,70,70,36,0,0,0,87,65,86,69,102,109,116,32,16,0,0,0,1,0,1,0,64,31,0,0,128,62,0,0,2,0,16,0,100,97,116,97,0,0,0,0])],{type:"audio/wav"}),type:"audio/wav"};openApp("mediaplayer");true`);
await wait(160);
await check("Media Player real media",async()=>await evaluate(`!!document.querySelector('.window[data-app="mediaplayer"] [data-open-media]') && !!document.querySelector('.window[data-app="mediaplayer"] audio')`));

await check("Real platform bridge available",async()=>await evaluate(`typeof RealPlatformBridge==="object" && RealPlatformBridge.version==="7.2.0"`));
await evaluate(`renderNotifications();true`);
await wait(80);
await check("Real notification controls",async()=>await evaluate(`!!document.querySelector("#notification-list .real-notification-tools [data-notify-enable]") && !!document.querySelector("#notification-list [data-notify-test]")`));
await check("PWA manifest link",async()=>await evaluate(`document.querySelector('link[rel="manifest"]')?.getAttribute("href").includes("manifest.webmanifest")`));
await check("PWA service worker registration",async()=>await evaluate(`(async()=>{if(!("serviceWorker" in navigator))return false;for(let i=0;i<20;i++){const r=await navigator.serviceWorker.getRegistration();if(r)return true;await new Promise(x=>setTimeout(x,100))}return false})()`));
await check("PWA cache populated",async()=>await evaluate(`(async()=>{for(let i=0;i<25;i++){const keys=await caches.keys();if(keys.includes("win11-simulator-v7.2.0"))return true;await new Promise(x=>setTimeout(x,100))}return false})()`));
await evaluate(`(()=>{state.settingsPage="system";const settingsWin=document.querySelector('.window[data-app="settings"]');if(settingsWin){settingsWin.querySelector(".win-body").innerHTML="";settingsWin.querySelector(".win-body").appendChild(renderApp("settings",settingsWin));}return true})()`);
await wait(140);
await check("PWA settings card",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-pwa-card] [data-install-pwa]')`));
await check("Real device bridge available",async()=>await evaluate(`typeof RealDeviceBridge==="object" && RealDeviceBridge.version==="7.2.0"`));
await check("Real device diagnostics",async()=>await evaluate(`(async()=>{const i=await RealDeviceBridge.getDeviceInfo();return typeof i.online==="boolean"&&i.storage&&typeof i.secureContext==="boolean"})()`));
await check("Real device settings card",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-real-device-settings]') && !!document.querySelector('.window[data-app="settings"] [data-persist-storage]') && !!document.querySelector('.window[data-app="settings"] [data-wake-lock]')`));
await evaluate(`globalThis.__auditMusicBefore=Object.keys(ensureFolder("C:/Music"));openApp("soundrecorder");true`); await wait(160);
await check("Sound Recorder real controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="soundrecorder"] [data-rec-toggle]') && !!document.querySelector('.window[data-app="soundrecorder"] [data-rec-audio]')`));
await evaluate(`document.querySelector('.window[data-app="soundrecorder"] [data-rec-toggle]').click();true`);
await check("Sound Recorder receives microphone stream",async()=>await waitFor(async()=>await evaluate(`document.querySelector('.window[data-app="soundrecorder"] [data-mic-state]')?.textContent==="A gravar"`),5000,100));
await wait(900);
await evaluate(`document.querySelector('.window[data-app="soundrecorder"] [data-rec-toggle]').click();true`);
await check("Sound Recorder saves real audio",async()=>await waitFor(async()=>await evaluate(`(()=>{const before=new Set(__auditMusicBefore);const names=Object.keys(ensureFolder("C:/Music"));const n=names.find(x=>!before.has(x));if(!n)return false;globalThis.__auditRecording=n;const v=ensureFolder("C:/Music")[n];return !!v?.__realBlobId&&document.querySelector('.window[data-app="soundrecorder"] [data-mic-state]')?.textContent==="Guardado"})()`),7000,120));
await evaluate(`(async()=>{if(__auditRecording){const f=ensureFolder("C:/Music"),v=f[__auditRecording];await RealContentBridge.cleanupVirtualValue(v);delete f[__auditRecording];saveState()}return true})()`);
await evaluate(`globalThis.__auditPicsBefore=Object.keys(ensureFolder("C:/Pictures"));openApp("camera");true`); await wait(160);
await check("Camera real controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="camera"] [data-camera-start]') && !!document.querySelector('.window[data-app="camera"] [data-camera-shot]')`));
await evaluate(`document.querySelector('.window[data-app="camera"] [data-camera-start]').click();true`);
await check("Camera receives video stream",async()=>await waitFor(async()=>await evaluate(`(()=>{const v=document.querySelector('.window[data-app="camera"] [data-camera-video]');return !!v?.srcObject&&v.srcObject.getVideoTracks().some(t=>t.readyState==="live")&&v.videoWidth>0})()`),6000,120));
await evaluate(`document.querySelector('.window[data-app="camera"] [data-camera-shot]').click();true`);
await check("Camera saves real photo",async()=>await waitFor(async()=>await evaluate(`(()=>{const before=new Set(__auditPicsBefore);const names=Object.keys(ensureFolder("C:/Pictures"));const n=names.find(x=>!before.has(x));if(!n)return false;globalThis.__auditCameraPhoto=n;return !!ensureFolder("C:/Pictures")[n]?.__realBlobId})()`),5000,120));
await evaluate(`document.querySelector('.window[data-app="camera"] [data-camera-stop]').click();true`);
await evaluate(`(async()=>{if(__auditCameraPhoto){const f=ensureFolder("C:/Pictures"),v=f[__auditCameraPhoto];await RealContentBridge.cleanupVirtualValue(v);delete f[__auditCameraPhoto];saveState()}return true})()`);
await evaluate(`(()=>{const md=navigator.mediaDevices;globalThis.__auditOriginalDisplay=md.getDisplayMedia;Object.defineProperty(md,"getDisplayMedia",{configurable:true,value:()=>md.getUserMedia({video:true,audio:false})});globalThis.__auditSnipBefore=Object.keys(ensureFolder("C:/Pictures"));openApp("snipping");return true})()`); await wait(140);
await evaluate(`document.querySelector('.window[data-app="snipping"] [data-capture-real]').click();true`);
await check("Snipping real capture path",async()=>await waitFor(async()=>await evaluate(`document.querySelector('.window[data-app="snipping"] [data-snip-state]')?.textContent==="Captura real"`),5000,120));
await evaluate(`document.querySelector('.window[data-app="snipping"] [data-save]').click();true`);
await check("Snipping saves captured image",async()=>await waitFor(async()=>await evaluate(`(()=>{const before=new Set(__auditSnipBefore);const names=Object.keys(ensureFolder("C:/Pictures"));const n=names.find(x=>!before.has(x));if(!n)return false;globalThis.__auditSnipPhoto=n;return !!ensureFolder("C:/Pictures")[n]?.__realBlobId})()`),5000,120));
await evaluate(`(async()=>{const md=navigator.mediaDevices;try{if(__auditOriginalDisplay)Object.defineProperty(md,"getDisplayMedia",{configurable:true,value:__auditOriginalDisplay});else delete md.getDisplayMedia}catch{};if(__auditSnipPhoto){const f=ensureFolder("C:/Pictures"),v=f[__auditSnipPhoto];await RealContentBridge.cleanupVirtualValue(v);delete f[__auditSnipPhoto];saveState()}return true})()`);
await evaluate(`openApp("systeminfo");true`); await wait(140);
await evaluate(`document.querySelector('.window[data-app="systeminfo"] [data-real-device-info]')?.click();true`); await wait(300);
await check("System Information real device page",async()=>await evaluate(`document.querySelector('.window[data-app="systeminfo"] .info-main')?.textContent.includes("Estado da rede") && document.querySelector('.window[data-app="systeminfo"] .info-main')?.textContent.includes("Armazenamento")`));

await send("Emulation.setDeviceMetricsOverride",{width:412,height:915,deviceScaleFactor:2,mobile:true});
await wait(180);
await evaluate(`closeOverlays();toggleOverlay("start");true`);
await wait(160);
await check("Mobile start inside viewport",async()=>await evaluate(`(()=>{const r=document.querySelector("#start-menu").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})()`));
await check("Mobile no page overflow",async()=>await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`));
await check("Rendered text no mojibake",async()=>await evaluate(`(()=>{const t=document.body.innerText;const bad=["\\uFFFD","\\u00C3\\u00A3","\\u00C3\\u00A7","\\u00C3\\u00B5","\\u00C2\\u00B0","\\u00E2\\u20AC\\u201D","\\u00E2\\u20AC\\u00B9","\\u00E2\\u20AC\\u00BA"];return !/[\\u0080-\\u009F]/.test(t)&&!bad.some(x=>t.includes(x))})()`));
await check("Start applications text encoding",async()=>await evaluate(`document.querySelector("#all-apps-btn")?.textContent.includes("Todas as aplica\\u00E7\\u00F5es")`));
await check("Window control glyph encoding",async()=>await evaluate(`(()=>{const w=document.querySelector(".window");return w?.querySelector(".win-control.min")?.textContent==="\\u2014"&&w?.querySelector(".win-control.max")?.textContent==="\\u25A1"&&w?.querySelector(".win-control.close")?.textContent==="\\u00D7"})()`));
await check("Widget temperature encoding",async()=>await evaluate(`document.querySelector("#widgets-btn")?.textContent.includes("22\\u00B0")`));

await evaluate(`closeOverlays();state.notepadText="USER_ONE_REFRESH";saveState();true`);
await send("Emulation.clearDeviceMetricsOverride");
await send("Page.reload",{ignoreCache:true});
await wait(2600);
await check("session survives refresh",async()=>await evaluate(`(()=>{const lock=document.querySelector("#lock");return Win11SessionManager?.activeUserId===${JSON.stringify(user1Id)} && lock?.classList.contains("hidden") && getComputedStyle(lock).display==="none"})()`));
await check("profile survives refresh",async()=>await evaluate(`state.notepadText==="USER_ONE_REFRESH"`));
await check("file association survives refresh",async()=>await evaluate(`state.fileAssociations?.[".png"]==="paint" && Win11DesktopIntegration.defaultAppFor("after-refresh.png")==="paint"`));
await check("start footer shows active user",async()=>await evaluate(`document.querySelector("#start-menu .start-footer span:first-child")?.textContent==="Audit User One"`));

await wait(250);
const failed=checks.filter(c=>!c.ok);
console.log(JSON.stringify({checks,exceptions,consoleErrors,privacyWarnings},null,2));
ws.close();
if(failed.length||exceptions.length||consoleErrors.length)process.exit(1);
