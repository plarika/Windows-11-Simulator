import {closeSync,openSync,statSync,unlinkSync,writeSync} from "node:fs";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import {join} from "node:path";

const port=Number(process.argv[2]||9227);
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const auditLockPath=join(tmpdir(),`win11sim-browser-audit-${createHash("sha256").update(new URL("../",import.meta.url).href).digest("hex").slice(0,16)}.lock`);
let auditLockFd=null;
let auditLockReleased=false;

async function acquireAuditLock(){
  const deadline=Date.now()+300000;
  for(;;){
    try{
      auditLockFd=openSync(auditLockPath,"wx");
      writeSync(auditLockFd,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString(),port})+"\n");
      return;
    }catch(err){
      if(err?.code!=="EEXIST")throw err;
      try{
        if(Date.now()-statSync(auditLockPath).mtimeMs>600000){
          unlinkSync(auditLockPath);
          continue;
        }
      }catch(e){
        if(e?.code==="ENOENT")continue;
        throw e;
      }
      if(Date.now()>=deadline)throw new Error("Browser audit lock timeout: another audit is still running");
      await wait(250);
    }
  }
}

function releaseAuditLock(){
  if(auditLockReleased)return;
  auditLockReleased=true;
  try{if(auditLockFd!==null)closeSync(auditLockFd)}catch{}
  try{unlinkSync(auditLockPath)}catch{}
}

await acquireAuditLock();
process.on("exit",releaseAuditLock);
process.on("SIGINT",()=>process.exit(130));
process.on("SIGTERM",()=>process.exit(143));

const targets=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());
const target=targets.find(t=>t.type==="page"&&/^http:\/\/127\.0\.0\.1:\d+\//.test(t.url));
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
  await evaluate(`Win11Experience?.revealSignIn?.(false);true`);
  await wait(40);
  await evaluate(`(()=>{const i=document.querySelector("[data-login-secret]");const b=document.querySelector("[data-login]");if(!i||!b)return false;i.value=${JSON.stringify(secret)};b.click();return true})()`);
  return waitFor(async()=>await evaluate(`(()=>{const lock=document.querySelector("#lock");return Win11SessionManager?.activeUserId===${JSON.stringify(id)} && lock?.classList.contains("hidden") && getComputedStyle(lock).display==="none"})()`),12000,120);
}

await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");

const auditOrigin=new URL(target.url).origin;
await send("Storage.clearDataForOrigin",{origin:auditOrigin,storageTypes:"all"});
await send("Page.navigate",{url:target.url});
if(!(await waitFor(async()=>await evaluate(`document.readyState==="complete" && typeof Win11SessionManager==="object" && typeof Win11SimDiagnostics==="object"`),15000,120))){
  throw new Error("Audit precondition failed: simulator did not reach a clean ready state after storage reset");
}
await wait(250);

await check("boot diagnostics",async()=>await evaluate(`typeof Win11SimDiagnostics==="object" && Win11SimDiagnostics.run().missingFunctions.length===0`));
await check("session manager available",async()=>await evaluate(`typeof Win11SessionManager==="object" && Win11SessionManager.version==="8.1.0"`));
await check("first account setup visible",async()=>await evaluate(`!!document.querySelector("[data-new-user-name]") && !!document.querySelector("[data-create-user]")`));
await check("first account setup bypasses lock staging",async()=>await evaluate(`!document.querySelector("#lock").classList.contains("lock-clock-stage-v800") && !document.querySelector("[data-hello-v800]")`));

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

await check("first account login",async()=>await waitFor(async()=>await evaluate(`(()=>{const lock=document.querySelector("#lock");return Win11SessionManager?.activeUser?.displayName==="Audit User One" && lock?.classList.contains("hidden") && getComputedStyle(lock).display==="none"})()`),12000,120));

const user1Id=await evaluate(`Win11SessionManager.activeUserId`);
if(!user1Id)throw new Error("Audit precondition failed: first account was not created or logged in.");
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
await check("prepare legacy 180k credential",async()=>await evaluate(`(async()=>{const accounts=JSON.parse(localStorage.getItem("win11-sim-accounts-v67")||"[]");const a=accounts.find(x=>x.id===Win11SessionManager.activeUserId);if(!a)return false;const salt=crypto.getRandomValues(new Uint8Array(16));const to64=b=>{let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s)};const key=await crypto.subtle.importKey("raw",new TextEncoder().encode("2468"),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:180000,hash:"SHA-256"},key,256);a.credential={type:"local-secret",algorithm:"PBKDF2-SHA-256",iterations:180000,salt:to64(salt),hash:to64(new Uint8Array(bits))};localStorage.setItem("win11-sim-accounts-v67",JSON.stringify(accounts));return true})()`));
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

await evaluate(`Win11SessionManager.lock();true`); await wait(120);
await check("V8 lock starts in clock stage",async()=>await evaluate(`(()=>{const lock=document.querySelector("#lock");return Win11SessionManager.isLocked && lock.classList.contains("lock-clock-stage-v800") && !!lock.querySelector("[data-lock-hint-v800]") && !!lock.querySelector("[data-lock-status-v800]")})()`));
await check("V8 lock keeps credential hidden visually",async()=>await evaluate(`document.querySelector("#lock .session-auth-host")?.getAttribute("aria-hidden")==="true" && !!document.querySelector("[data-login-secret]")`));
await evaluate(`Win11Experience.revealSignIn();true`); await wait(100);
await check("V8 reveal shows authentication stage",async()=>await evaluate(`document.querySelector("#lock").classList.contains("lock-auth-stage-v800") && document.querySelector("#lock .session-auth-host")?.getAttribute("aria-hidden")==="false"`));
await check("Windows Hello visual present",async()=>await evaluate(`!!document.querySelector("[data-hello-v800]") && document.querySelector("[data-hello-v800]")?.textContent.includes("Windows Hello")`));
await check("Sign-in options disclose visual-only biometrics",async()=>await evaluate(`(()=>{document.querySelector("[data-signin-options-v800]")?.click();const p=document.querySelector("[data-signin-options-panel-v800]");return !!p&&!p.hidden&&p.textContent.includes("sem acesso biométrico")})()`));
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
await check("Explorer Pro bridge",async()=>await evaluate(`Win11ExplorerPro?.version==="9.1.0"`));
await check("Explorer Navigation V9.3 bridge",async()=>await evaluate(`Win11ExplorerNavigation?.version==="9.3.0"`));
await check("Explorer Details V8.4 bridge",async()=>await evaluate(`Win11ExplorerDetails?.version==="8.4.0"`));
await check("Explorer Details V8.4 UI installed",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');return !!w?.__explorerDetailsV840&&!!w.querySelector("[data-details-v840]")&&!!w.querySelector(".explorer-details-pane-v840")})()`));
await check("Explorer Context V9.1 bridge",async()=>await evaluate(`Win11ExplorerContext?.version==="9.1.0"`));
await check("Explorer Context V8.5 installed",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"]')?.__explorerContextV850`));
await check("Explorer Views V8.6 bridge",async()=>await evaluate(`Win11ExplorerViews?.version==="8.6.0"`));
await check("Explorer Views V8.6 installed",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"]')?.__explorerViewsV860`));
await check("Explorer Sidebar V8.7 bridge",async()=>await evaluate(`Win11ExplorerSidebar?.version==="8.7.0"`));
await check("Explorer Sidebar V8.7 installed",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"]')?.__explorerSidebarV870`));
await check("Explorer Command V8.8 bridge",async()=>await evaluate(`Win11ExplorerCommand?.version==="8.8.0"`));
await check("Explorer Command V8.8 installed",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"]')?.__explorerCommandV880`));
await check("Explorer Columns V8.9 bridge",async()=>await evaluate(`Win11ExplorerColumns?.version==="8.9.0"`));
await check("Explorer Columns V8.9 installed",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"]')?.__explorerColumnsV890`));
await check("Explorer Operations V9.0 bridge",async()=>await evaluate(`Win11ExplorerOperations?.version==="9.0.0"`));
await check("Explorer Operations V9.0 installed",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"]')?.__explorerOperationsV900`));
await check("Explorer History V9.4 bridge",async()=>await evaluate(`Win11ExplorerHistory?.version==="9.4.0" && typeof Win11ExplorerHistory.undo==="function" && typeof Win11ExplorerHistory.redo==="function" && typeof Win11ExplorerHistory.clear==="function"`));
await check("Explorer History V9.4 installed",async()=>await evaluate(`!!document.querySelector('#window-layer > .window[data-app="explorer"]')?.__explorerHistoryV940`));
await check("Explorer Recycle V9.5 bridge",async()=>await evaluate(`Win11ExplorerRecycle?.version==="9.5.0" && typeof Win11ExplorerRecycle.restoreNames==="function" && typeof Win11ExplorerRecycle.restoreAll==="function" && typeof Win11ExplorerRecycle.empty==="function"`));
await check("Explorer Recycle V9.5 installed",async()=>await evaluate(`!!document.querySelector('#window-layer > .window[data-app="explorer"]')?.__explorerRecycleV950`));
await check("Explorer Versions V9.6 bridge",async()=>await evaluate(`Win11ExplorerVersions?.version==="9.6.0" && typeof Win11ExplorerVersions.capture==="function" && typeof Win11ExplorerVersions.restore==="function" && typeof Win11ExplorerVersions.show==="function"`));
await check("Explorer Filesystem V9.1 bridge",async()=>await evaluate(`Win11ExplorerFilesystem?.version==="9.1.0"`));
await check("Explorer Filesystem V9.1 installed",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"]')?.__explorerFilesystemV910`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerNavigationV820.go("This PC");true`); await wait(150);
await check("Explorer This PC V8.4 folders",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');return w.querySelectorAll(".thispc-folder-card-v840").length===6&&w.querySelectorAll(".drive-card").length>=3&&!!w.querySelector(".thispc-storage-summary-v840")})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerSidebarV870.setWidth(260);true`); await wait(60);
await check("Explorer V8.7 sidebar resize state",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),r=w.querySelector(".explorer-sidebar-v870");return state.explorerSidebarV87?.width===260&&r?.style.getPropertyValue("--explorer-sidebar-width")==="260px"})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerSidebarV870.toggleSection("quick");true`); await wait(40);
await check("Explorer V8.7 collapsible sidebar",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');return state.explorerSidebarV87?.quickCollapsed===true&&w.querySelector('[data-sidebar-section="quick"]')?.classList.contains("collapsed-v870")})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerSidebarV870.toggleSection("quick");true`); await wait(30);
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerSidebarV870.toggleCompact();true`); await wait(40);
await check("Explorer V8.7 compact sidebar",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),r=w.querySelector(".explorer-sidebar-v870");return state.explorerSidebarV87?.compact===true&&r?.classList.contains("sidebar-compact-v870")})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerSidebarV870.toggleCompact();true`); await wait(30);
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="explorer"] aside');a.style.display="block";return true})()`); await wait(20);
await check("Explorer Quick Access readability V9.0",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),q=w.querySelector(".explorer-quick-item-v830"),label=q?.querySelector(".explorer-sidebar-label-v870");if(!q||!label)return false;const qs=getComputedStyle(q),ls=getComputedStyle(label),r=q.getBoundingClientRect();return parseFloat(qs.fontSize)>=12&&parseFloat(qs.opacity)>=0.99&&parseFloat(ls.opacity)>=0.99&&r.height>=30&&ls.color!=="rgba(0, 0, 0, 0)"})()`));
await evaluate(`(()=>{const app=document.querySelector("#app");globalThis.__v930ThemeWasDark=app.classList.contains("theme-dark");app.classList.add("theme-dark");return true})()`); await wait(30);
await check("Explorer Quick Access dark inactive reset V9.3",async()=>await evaluate(`(()=>{const w=document.querySelector('#window-layer > .window[data-app="explorer"]'),items=[...w.querySelectorAll(".explorer-quick-item-v830")].filter(x=>!x.classList.contains("active"));if(items.length<2)return false;return items.every(q=>{const s=getComputedStyle(q),label=q.querySelector(".explorer-sidebar-label-v870"),ls=label?getComputedStyle(label):null;return s.backgroundColor==="rgba(0, 0, 0, 0)"&&s.boxShadow==="none"&&s.color!=="rgb(255, 255, 255, 0)"&&!!ls&&parseFloat(ls.opacity)>=0.99})})()`));
await check("Explorer Quick Access dark active state V9.3",async()=>await evaluate(`(()=>{const w=document.querySelector('#window-layer > .window[data-app="explorer"]'),q=w.querySelector(".explorer-quick-item-v830");if(!q)return false;const had=q.classList.contains("active");q.classList.add("active");const s=getComputedStyle(q),ok=s.backgroundColor!=="rgba(0, 0, 0, 0)"&&s.backgroundColor!=="rgb(255, 255, 255)"&&s.color==="rgb(255, 255, 255)";if(!had)q.classList.remove("active");return ok})()`));
await evaluate(`(()=>{const app=document.querySelector("#app");if(!globalThis.__v930ThemeWasDark)app.classList.remove("theme-dark");delete globalThis.__v930ThemeWasDark;return true})()`); await wait(20);
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),items=[...w.querySelectorAll('aside [role="treeitem"]')].filter(x=>x.offsetParent!==null);if(items.length<2)return false;items[0].focus();items[0].dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true}));return true})()`); await wait(40);
await check("Explorer V8.7 sidebar keyboard navigation",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),items=[...w.querySelectorAll('aside [role="treeitem"]')].filter(x=>x.offsetParent!==null),active=document.activeElement;return items.length>=2&&active?.getAttribute("role")==="treeitem"&&active!==items[0]&&items.includes(active)})()`));
await evaluate(`(()=>{document.querySelector('.window[data-app="explorer"] aside').style.removeProperty("display");return true})()`);
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerNavigationV820.go("C:/Documents");true`); await wait(140);
await check("Explorer V8.3 initial tab",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');return w?.__explorerNavigationV820?.getTabs().length===1&&w.querySelectorAll(".explorer-tab-v820").length===1})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"t",ctrlKey:true,bubbles:true}));return true})()`); await wait(120);
await check("Explorer Ctrl+T creates tab",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');return w.__explorerNavigationV820.getTabs().length===2&&w.querySelectorAll(".explorer-tab-v820").length===2})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');return w.__explorerNavigationV820.go("C:/Pictures")})()`); await wait(140);
await check("Explorer active tab navigates independently",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');const api=w.__explorerNavigationV820,tabs=api.getTabs();return tabs.length===2&&tabs.find(t=>t.id===api.getActiveId())?.path==="C:/Pictures"})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820,tabs=api.getTabs();api.switchTab(tabs[0].id);return true})()`); await wait(140);
await check("Explorer tab restores own path",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820,tabs=api.getTabs();return tabs.find(t=>t.id===api.getActiveId())?.path==="C:/Documents"&&Win11ExplorerPro.currentVirtualPath(w)==="C:/Documents"})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820,tabs=api.getTabs();api.switchTab(tabs[1].id);return true})()`); await wait(120);
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerNavigationV820.go("C:/Music");true`); await wait(120);
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowLeft",altKey:true,bubbles:true}));return true})()`); await wait(120);
await check("Explorer per-tab back history",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820;return api.getTabs().find(t=>t.id===api.getActiveId())?.path==="C:/Pictures"})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"l",ctrlKey:true,bubbles:true}));return true})()`); await wait(60);
await check("Explorer Ctrl+L edits address",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');return w.querySelector(".explorer-location-shell-v820")?.classList.contains("editing")&&w.querySelector(".explorer-location-input-v820")===document.activeElement})()`));
await evaluate(`(()=>{const i=document.querySelector('.window[data-app="explorer"] .explorer-location-input-v820');i.value="C:/Does-Not-Exist";i.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));return true})()`); await wait(80);
await check("Explorer invalid address is rejected",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820;return api.getTabs().find(t=>t.id===api.getActiveId())?.path==="C:/Pictures"&&w.querySelector(".explorer-location-shell-v820")?.classList.contains("editing")})()`));
await evaluate(`(()=>{const i=document.querySelector('.window[data-app="explorer"] .explorer-location-input-v820');i.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));return true})()`); await wait(40);
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",ctrlKey:true,bubbles:true}));return true})()`); await wait(120);
await check("Explorer Ctrl+Tab switches tabs",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820;return api.getTabs().find(t=>t.id===api.getActiveId())?.path==="C:/Documents"})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"w",ctrlKey:true,bubbles:true}));return true})()`); await wait(120);
await check("Explorer Ctrl+W closes active tab",async()=>await evaluate(`document.querySelector('.window[data-app="explorer"]')?.__explorerNavigationV820?.getTabs().length===1`));
await check("Explorer tab session persisted in profile",async()=>await evaluate(`state.explorerNavigationV83?.lastSession?.tabs?.length===1&&state.explorerNavigationV83.lastSession.tabs[0]?.path==="C:/Pictures"&&state.explorerNavigationV83.closedTabs?.length>=1`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"t",ctrlKey:true,shiftKey:true,bubbles:true}));return true})()`); await wait(120);
await check("Explorer Ctrl+Shift+T reopens closed tab",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820,tabs=api.getTabs();return tabs.length===2&&tabs.find(t=>t.id===api.getActiveId())?.path==="C:/Documents"})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerNavigationV820.duplicateTab();true`); await wait(120);
await check("Explorer duplicate tab",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820,tabs=api.getTabs();const active=tabs.find(t=>t.id===api.getActiveId());return tabs.length===3&&active?.path==="C:/Documents"&&active.history.includes("C:/Documents")})()`));
await check("Explorer Quick Access defaults",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820,q=api.getQuickAccess();return ["C:/Desktop","C:/Documents","C:/Downloads"].every(p=>q.includes(p))&&w.querySelectorAll(".explorer-quick-item-v830").length>=3})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820,pic=api.getTabs().find(t=>t.path==="C:/Pictures");globalThis.__v83PinnedId=pic?.id;return !!pic&&api.togglePinTab(pic.id)})()`); await wait(80);
await check("Explorer pinned tab",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820,tabs=api.getTabs();return tabs[0]?.id===__v83PinnedId&&tabs[0]?.pinned===true&&w.querySelector('[data-explorer-tab-id="'+__v83PinnedId+'"]')?.classList.contains("pinned")})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerNavigationV820.go("C:/Music");true`); await wait(100);
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820,tabs=api.getTabs(),music=tabs.find(t=>t.id===api.getActiveId()),docs=tabs.find(t=>!t.pinned&&t.path==="C:/Documents"&&t.id!==music.id);return !!music&&!!docs&&api.reorderTab(music.id,docs.id)})()`); await wait(80);
await check("Explorer drag reorder engine",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820,tabs=api.getTabs();return tabs[0]?.pinned&&tabs[1]?.path==="C:/Music"&&tabs[2]?.path==="C:/Documents"&&[...w.querySelectorAll(".explorer-tab-v820")].every(b=>b.draggable)})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerNavigationV820.addQuickAccess("C:/Music");true`); await wait(70);
await check("Explorer Quick Access profile state",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820;return api.getQuickAccess().includes("C:/Music")&&state.explorerNavigationV83?.quickAccess?.includes("C:/Music")&&[...w.querySelectorAll(".explorer-quick-item-v830")].some(x=>x.dataset.path==="C:/Music")})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820,docs=api.getTabs().find(t=>!t.pinned&&t.path==="C:/Documents");api.switchTab(docs.id);return true})()`); await wait(90);
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820;const b=w.querySelector('[data-explorer-tab-id="'+api.getActiveId()+'"]');if(!b)return false;const r=b.getBoundingClientRect();b.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:r.left+8,clientY:r.top+8}));return true})()`); await wait(60);
await check("Explorer tab context menu",async()=>await evaluate(`(()=>{const m=document.querySelector("#context-menu.open");const t=m?.textContent||"";return t.includes("Duplicar separador")&&t.includes("Fixar separador")&&t.includes("Remover do Acesso rápido")&&t.includes("Fechar outros separadores")&&t.includes("Fechar separadores à direita")})()`));
await evaluate(`(()=>{const m=document.querySelector("#context-menu");m?.classList.remove("open");return true})()`); await wait(30);
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');closeWindow(w);return true})()`); await wait(160);
await evaluate(`openApp("explorer","This PC");true`); await wait(300);
await check("Explorer session restores after reopen",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w?.__explorerNavigationV820;if(!api)return false;const tabs=api.getTabs(),active=tabs.find(t=>t.id===api.getActiveId());return tabs.length===3&&tabs[0]?.pinned===true&&tabs[0]?.path==="C:/Pictures"&&tabs[1]?.path==="C:/Music"&&active?.path==="C:/Documents"&&api.getQuickAccess().includes("C:/Music")&&Win11ExplorerPro.currentVirtualPath(w)==="C:/Documents"})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820;api.closeOtherTabs(api.getActiveId());return true})()`); await wait(120);
await check("Explorer close other tabs preserves pinned",async()=>await evaluate(`(()=>{const api=document.querySelector('.window[data-app="explorer"]')?.__explorerNavigationV820,tabs=api?.getTabs()||[];return tabs.length===2&&tabs.some(t=>t.pinned&&t.path==="C:/Pictures")&&tabs.some(t=>t.id===api.getActiveId()&&t.path==="C:/Documents")})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerNavigationV820.removeQuickAccess("C:/Music");true`); await wait(50);
await check("Explorer Quick Access remove",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerNavigationV820;return !api.getQuickAccess().includes("C:/Music")&&!state.explorerNavigationV83.quickAccess.includes("C:/Music")})()`));
await evaluate(`(()=>{
  const root="C:/Documents/V74Audit";
  ensureFolder(root)["alpha.txt"]="A";
  ensureFolder(root)["beta.txt"]="B";
  ensureFolder(root)["image.png"]="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6vVQAAAAASUVORK5CYII=";
  ensureFolder(root)["recent.meta"]={content:"recent",lastModified:Date.now()};
  ensureFolder(root)["old.meta"]={content:"old",lastModified:Date.now()-40*86400000};
  ensureFolder(root)["secret.txt"]="HIDDEN";
  ensureFolder(root)["conflict.txt"]="SOURCE";
  ensureFolder(root)["skip.txt"]="SOURCE_SKIP";
  ensureFolder(root)["dialog.txt"]="SOURCE_DIALOG";
  ensureFolder(root)["pause1.txt"]="P1";
  ensureFolder(root)["pause2.txt"]="P2";
  ensureFolder(root)["pause3.txt"]="P3";
  ensureFolder(root)["cancel1.txt"]="C1";
  ensureFolder(root)["cancel2.txt"]="C2";
  ensureFolder(root)["cancel3.txt"]="C3";
  ensureFolder(root)["cancel4.txt"]="C4";
  ensureFolder(root)["cancel5.txt"]="C5";
  ensureFolder(root+"/FolderOne")["inside.txt"]="inside";
  ensureFolder(root+"/Destination");
  ensureFolder(root+"/OpDest")["conflict.txt"]="OLD";
  ensureFolder(root+"/OpDest")["skip.txt"]="OLD_SKIP";
  ensureFolder(root+"/OpDest")["dialog.txt"]="OLD_DIALOG";
  ensureFolder(root+"/PauseDest");
  ensureFolder(root+"/CancelDest");
  ensureFolder(root+"/RecycleMe")["trash.txt"]="trash";
  const w=document.querySelector('.window[data-app="explorer"]');w.dispatchEvent(new CustomEvent("navigate",{detail:root}));return true;
})()`); await wait(260);
await check("Explorer Pro installed on window",async()=>await evaluate(`document.querySelector('.window[data-app="explorer"] .explorer-pro-v740')?.dataset.explorerProV740==="1"`));
await check("Explorer V9.1 metadata initialized",async()=>await evaluate(`(()=>{const root="C:/Documents/V74Audit",m=Win11ExplorerFilesystem.getMetadata(root,"alpha.txt","file"),s=Win11ExplorerFilesystem.getState();return Number(m.created)>0&&Number(m.modified)>0&&!!s.metadata[root+"/alpha.txt"]&&s.showHidden===false&&s.showExtensions===true})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');w.__explorerFilesystemV910.setHidden("C:/Documents/V74Audit","secret.txt",true);return true})()`); await wait(80);
await check("Explorer V9.1 hidden item concealed",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),n=[...w.querySelectorAll(".file,.file-row:not(.header)")].find(x=>x.dataset.v740Name==="secret.txt"),results=Win11StartSearch.collect("secret.txt");return !!n&&n.classList.contains("filesystem-hidden-v910")&&!results.some(r=>r.type==="file"&&r.name==="secret.txt")})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerFilesystemV910.setShowHidden(true);true`); await wait(80);
await check("Explorer V9.1 show hidden and search",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),n=[...w.querySelectorAll(".file,.file-row:not(.header)")].find(x=>x.dataset.v740Name==="secret.txt"),results=Win11StartSearch.collect("secret.txt");return !!n&&!n.classList.contains("filesystem-hidden-v910")&&n.classList.contains("filesystem-hidden-visible-v910")&&results.some(r=>r.type==="file"&&r.name==="secret.txt")})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerFilesystemV910.setShowExtensions(false);true`); await wait(80);
await check("Explorer V9.1 hide extensions",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),n=[...w.querySelectorAll(".file,.file-row:not(.header)")].find(x=>x.dataset.v740Name==="alpha.txt"),label=n?.querySelector(".file-name")||n?.querySelector(".fname span:last-child");return n?.dataset.v740Name==="alpha.txt"&&label?.textContent==="alpha"&&Win11ExplorerFilesystem.getState().showExtensions===false})()`));
await evaluate(`(()=>{const root="C:/Documents/V74Audit",out=Win11ExplorerFilesystem.createShortcut(root,{path:root,name:"Destination",type:"folder"});globalThis.__v910Shortcut=out?.name||"";return !!out})()`); await wait(140);
await check("Explorer V9.1 virtual shortcut created",async()=>await evaluate(`(()=>{const root="C:/Documents/V74Audit",w=document.querySelector('.window[data-app="explorer"]'),value=ensureFolder(root)[__v910Shortcut],n=[...w.querySelectorAll(".file,.file-row:not(.header)")].find(x=>x.dataset.v740Name===__v910Shortcut);return !!value?.__virtualShortcutV91&&!!n?.querySelector(".filesystem-shortcut-badge-v910")&&n.classList.contains("filesystem-shortcut-v910")})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerFilesystemV910.openShortcut("C:/Documents/V74Audit",__v910Shortcut);true`); await wait(120);
await check("Explorer V9.1 shortcut resolves folder",async()=>await evaluate(`Win11ExplorerPro.currentVirtualPath(document.querySelector('.window[data-app="explorer"]'))==="C:/Documents/V74Audit/Destination"`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerNavigationV820.go("C:/Documents/V74Audit");true`); await wait(120);
await evaluate(`(()=>{const root="C:/Documents/V74Audit";Win11ExplorerFilesystem.touch(root,"beta.txt",{hidden:true});return true})()`); await wait(30);
await check("Explorer V9.1 metadata copied with file",async()=>await evaluate(`(async()=>{const root="C:/Documents/V74Audit",r=await Win11ExplorerPro.copyFileAdvanced(root,"beta.txt",root+"/Destination",false),m=Win11ExplorerFilesystem.getMetadata(root+"/Destination",r.name,"file");return r.ok&&m.hidden===true&&Number(m.created)>0&&ensureFolder(root+"/Destination")[r.name]==="B"})()`));
await check("Explorer V9.1 delete cleans metadata",async()=>await evaluate(`(async()=>{const root="C:/Documents/V74Audit",key=root+"/Destination/beta.txt",ok=await Win11ExplorerPro.permanentlyDeleteVirtual(root+"/Destination","beta.txt","file"),s=Win11ExplorerFilesystem.getState();return ok&&!Object.prototype.hasOwnProperty.call(s.metadata,key)&&!Object.prototype.hasOwnProperty.call(ensureFolder(root+"/Destination"),"beta.txt")})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerFilesystemV910;api.setShowHidden(false);api.setShowExtensions(true);api.setHidden("C:/Documents/V74Audit","beta.txt",false);return true})()`); await wait(80);
await check("Explorer V9.1 preferences reset",async()=>await evaluate(`(()=>{const s=Win11ExplorerFilesystem.getState();return s.showHidden===false&&s.showExtensions===true&&Win11ExplorerFilesystem.getMetadata("C:/Documents/V74Audit","beta.txt","file").hidden===false})()`));
await check("Explorer V8.8 adaptive command state",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),r=w.querySelector(".explorer-command-v880"),width=r?.getBoundingClientRect().width||0;return !!r&&r.classList.contains("command-compact-v880")===(width<760)&&r.classList.contains("command-tight-v880")===(width<610)})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerCommandV880.setCheckboxes(true);true`); await wait(90);
await check("Explorer V8.8 checkbox mode",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),r=w.querySelector(".explorer-command-v880"),items=[...w.querySelectorAll(".file,.file-row:not(.header)")];return state.explorerCommandV88?.checkboxes===true&&r?.classList.contains("checkbox-selection-v880")&&items.length>0&&items.every(x=>!!x.querySelector(".explorer-select-checkbox-v880"))})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),n=[...w.querySelectorAll(".file,.file-row:not(.header)")].find(x=>x.dataset.v740Name==="alpha.txt"),cb=n?.querySelector(".explorer-select-checkbox-v880");if(!cb)return false;cb.checked=true;cb.dispatchEvent(new Event("change",{bubbles:true}));return true})()`); await wait(90);
await check("Explorer V8.8 selection indicator",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerCommandV880,pill=w.querySelector(".explorer-selection-pill-v880");return api.getSelectedCount()===1&&!pill.hidden&&pill.textContent.includes("1 selecionado")})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"] [data-overflow-v880]')?.click();true`); await wait(60);
await check("Explorer V8.8 command overflow",async()=>await evaluate(`(()=>{const m=document.querySelector("#context-menu.open"),t=m?.textContent||"";return !!m&&t.includes("Propriedades")&&t.includes("Painel de detalhes")&&t.includes("Ver: Detalhes")&&t.includes("Alternar agrupamento")&&t.includes("Modo compacto lateral")})()`));
await evaluate(`(()=>{document.querySelector("#context-menu")?.classList.remove("open");const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerCommandV880;api.clearSelection();api.setCheckboxes(false);return true})()`); await wait(100);
await check("Explorer V8.8 selection reset",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerCommandV880;return api.getSelectedCount()===0&&state.explorerCommandV88?.checkboxes===false&&!w.querySelector(".explorer-command-v880")?.classList.contains("checkbox-selection-v880")})()`));
await check("Explorer V9.0 same-folder copy",async()=>await evaluate(`(async()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerOperationsV900,root="C:/Documents/V74Audit";const r=await api.transfer([{path:root,name:"alpha.txt",type:"file"}],root,"copy",{conflictPolicy:"keep"});return r.done===1&&ensureFolder(root)["alpha (2).txt"]==="A"&&api.getLast()?.percent===100&&!!w.querySelector('.explorer-operation-card-v900[data-operation-status="completed"]')})()`));
await check("Explorer V9.0 replace conflict",async()=>await evaluate(`(async()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerOperationsV900,root="C:/Documents/V74Audit";const r=await api.transfer([{path:root,name:"conflict.txt",type:"file"}],root+"/OpDest","copy",{conflictPolicy:"replace"});return r.done===1&&ensureFolder(root+"/OpDest")["conflict.txt"]==="SOURCE"})()`));
await check("Explorer V9.0 skip conflict",async()=>await evaluate(`(async()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerOperationsV900,root="C:/Documents/V74Audit";const r=await api.transfer([{path:root,name:"skip.txt",type:"file"}],root+"/OpDest","copy",{conflictPolicy:"skip"});return r.done===0&&r.skipped===1&&ensureFolder(root+"/OpDest")["skip.txt"]==="OLD_SKIP"})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerOperationsV900,root="C:/Documents/V74Audit";globalThis.__v900ConflictPromise=api.transfer([{path:root,name:"dialog.txt",type:"file"}],root+"/OpDest","copy");return true})()`); await wait(80);
await check("Explorer V9.0 conflict dialog UI",async()=>await evaluate(`(()=>{const h=document.querySelector("#explorer-conflict-v900.open");return !!h&&!!h.querySelector("[data-conflict-replace]")&&!!h.querySelector("[data-conflict-skip]")&&!!h.querySelector("[data-conflict-keep]")&&!!h.querySelector("[data-conflict-all]")})()`));
await evaluate(`(()=>{const h=document.querySelector("#explorer-conflict-v900");h.querySelector("[data-conflict-all]").checked=true;h.querySelector("[data-conflict-keep]").click();return true})()`); await wait(100);
await check("Explorer V9.0 conflict keep-both decision",async()=>await evaluate(`(async()=>{const r=await __v900ConflictPromise,root="C:/Documents/V74Audit";return r.done===1&&ensureFolder(root+"/OpDest")["dialog.txt"]==="OLD_DIALOG"&&ensureFolder(root+"/OpDest")["dialog (2).txt"]==="SOURCE_DIALOG"})()`));
await check("Explorer V9.0 pause resume and busy guard",async()=>await evaluate(`(async()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerOperationsV900,root="C:/Documents/V74Audit",items=["pause1.txt","pause2.txt","pause3.txt"].map(name=>({path:root,name,type:"file"}));const promise=api.transfer(items,root+"/PauseDest","copy");api.pause();await new Promise(r=>setTimeout(r,70));const paused=api.getActive()?.paused===true;const busy=await api.transfer([{path:root,name:"beta.txt",type:"file"}],root+"/PauseDest","copy");api.resume();const r=await promise;return paused&&busy.reason==="busy"&&r.done===3&&["pause1.txt","pause2.txt","pause3.txt"].every(n=>ensureFolder(root+"/PauseDest")[n])})()`));
await check("Explorer V9.0 cancel operation",async()=>await evaluate(`(async()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerOperationsV900,root="C:/Documents/V74Audit",items=["cancel1.txt","cancel2.txt","cancel3.txt","cancel4.txt","cancel5.txt"].map(name=>({path:root,name,type:"file"}));const promise=api.transfer(items,root+"/CancelDest","copy");api.cancel();const r=await promise;return r.cancelled===true&&r.remaining.length>=4&&Object.keys(ensureFolder(root+"/CancelDest")).length<=1})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerViewsV860.setView("small");true`); await wait(100);
await check("Explorer V8.6 small view",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');const r=w.querySelector(".explorer-views-v860");return r?.classList.contains("view-small-v860")&&w.__explorerViewsV860.getView()==="small"&&state.explorerViewsV86?.mode==="small"})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerViewsV860.setView("details");true`); await wait(120);
await check("Explorer V8.6 details view",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');const r=w.querySelector(".explorer-views-v860");return r?.classList.contains("view-details-v860")&&!!w.querySelector(".file-list")&&w.__explorerViewsV860.getView()==="details"})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerViewsV860.setGroup("type");true`); await wait(100);
await check("Explorer V8.6 group by type",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),heads=[...w.querySelectorAll(".explorer-group-heading-v860")].map(x=>x.textContent);return state.explorerViewsV86?.group==="type"&&heads.some(x=>x.startsWith("Pastas"))&&heads.some(x=>x.startsWith("Ficheiros"))})()`));
await evaluate(`(()=>{const api=document.querySelector('.window[data-app="explorer"]').__explorerViewsV860;api.setGroup("none");api.setView("medium");return true})()`); await wait(100);
await check("Explorer V8.6 reset view",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');const r=w.querySelector(".explorer-views-v860");return r?.classList.contains("view-medium-v860")&&!w.querySelector(".explorer-group-heading-v860")&&state.explorerViewsV86?.group==="none"})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');w.__explorerViewsV860.setView("details");w.__explorerColumnsV890.setGroup("none");w.__explorerColumnsV890.setSort("name","desc");return true})()`); await wait(140);
await check("Explorer V8.9 name descending sort",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),names=[...w.querySelectorAll(".file-row:not(.header)")].map(x=>x.dataset.v740Name),expected=names.slice().sort((a,b)=>b.localeCompare(a,undefined,{numeric:true,sensitivity:"base"}));return names.length>4&&names.every((x,i)=>x===expected[i])&&state.explorerColumnsV89?.sort==="name"&&state.explorerColumnsV89?.direction==="desc"})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerColumnsV890.setSort("size","asc");true`); await wait(100);
await check("Explorer V8.9 size sort",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),path=Win11ExplorerPro.currentVirtualPath(w),nodes=[...w.querySelectorAll(".file-row:not(.header)")].filter(x=>x.dataset.v740Type==="file"),size=n=>{const v=ensureFolder(path)[n];if(typeof v==="string")return new Blob([v]).size;if(Number.isFinite(Number(v?.size)))return Number(v.size);return new Blob([JSON.stringify(v)]).size},actual=nodes.map(x=>x.dataset.v740Name),expected=actual.slice().sort((a,b)=>size(a)-size(b)||a.localeCompare(b,undefined,{numeric:true,sensitivity:"base"}));return actual.length>=4&&actual.every((x,i)=>x===expected[i])})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerColumnsV890.setSort("date","desc");true`); await wait(100);
await check("Explorer V8.9 date sort",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),names=[...w.querySelectorAll(".file-row:not(.header)")].map(x=>x.dataset.v740Name);return names.indexOf("recent.meta")>=0&&names.indexOf("old.meta")>=0&&names.indexOf("recent.meta")<names.indexOf("old.meta")})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerColumnsV890.setGroup("size");true`); await wait(100);
await check("Explorer V8.9 group by size",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),heads=[...w.querySelectorAll(".explorer-group-heading-v890")].map(x=>x.textContent);return heads.some(x=>x.startsWith("Pastas"))&&heads.some(x=>x.startsWith("Pequenos"))&&state.explorerColumnsV89?.group==="size"})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerColumnsV890.setGroup("date");true`); await wait(100);
await check("Explorer V8.9 group by date",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),heads=[...w.querySelectorAll(".explorer-group-heading-v890")].map(x=>x.textContent);return heads.some(x=>x.startsWith("Hoje"))&&heads.some(x=>x.startsWith("Mais antigos"))})()`));
await evaluate(`(()=>{const api=document.querySelector('.window[data-app="explorer"]').__explorerColumnsV890;api.setGroup("none");api.setColumnWidth("type",180);api.toggleColumn("date");return true})()`); await wait(90);
await check("Explorer V8.9 configurable columns",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerColumnsV890,s=api.getState(),h=w.querySelector(".file-row.header"),date=h?.children?.[3];return s.widths.type===180&&s.visible.date===false&&date?.style.display==="none"&&!!h?.querySelector('[data-resize-column="type"]')})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),api=w.__explorerColumnsV890;api.toggleColumn("date");api.setColumnWidth("type",140);api.setSort("name","asc");w.__explorerViewsV860.setView("medium");return true})()`); await wait(110);
await check("Explorer V8.9 state reset",async()=>await evaluate(`(()=>{const s=document.querySelector('.window[data-app="explorer"]').__explorerColumnsV890.getState();return s.group==="none"&&s.sort==="name"&&s.direction==="asc"&&s.visible.date===true&&s.widths.type===140&&state.explorerViewsV86?.group==="none"})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');const q=n=>[...w.querySelectorAll('.file,.file-row:not(.header)')].find(x=>x.dataset.v740Name===n);const a=q("alpha.txt");a?.click();w.__explorerContextV850?.openMenuFor(a,180,180);return true})()`); await wait(90);
await check("Explorer V8.5 modern context menu",async()=>await evaluate(`(()=>{const m=document.querySelector("#context-menu.open.explorer-modern-menu-v850");if(!m)return false;const labels=[...m.querySelectorAll(".explorer-context-quick-action-v850")].map(x=>x.getAttribute("aria-label"));const text=m.textContent||"";return ["Cortar","Copiar","Mudar nome","Partilhar","Eliminar"].every(x=>labels.includes(x))&&text.includes("Abrir")&&text.includes("Adicionar ao Acesso rápido")&&text.includes("Abrir com...")&&text.includes("Propriedades")&&text.includes("Mostrar mais opções")})()`));
await evaluate(`document.querySelector("#context-menu .explorer-context-more-v850")?.click();true`); await wait(70);
await check("Explorer V8.5 More Options",async()=>await evaluate(`(()=>{const m=document.querySelector("#context-menu.open.explorer-more-menu-v850");const t=m?.textContent||"";return !!m&&t.includes("Abrir com...")&&t.includes("Partilhar")&&t.includes("Imprimir")&&t.includes("Copiar caminho")&&t.includes("Propriedades")})()`));
await evaluate(`document.querySelector("#context-menu")?.classList.remove("open");true`); await wait(30);
await evaluate(`document.querySelector('.window[data-app="explorer"]')?.__explorerContextV850?.showProperties();true`); await wait(90);
await check("Explorer V8.5 rich properties general",async()=>await evaluate(`(()=>{const d=document.querySelector("#system-dialog");const b=document.querySelector("#system-dialog-body");return d?.classList.contains("open")&&!!b?.querySelector(".explorer-properties-v850")&&b.textContent.includes("alpha.txt")&&b.textContent.includes("Filesystem virtual do perfil")&&b.querySelector('[data-prop-tab="general"]')?.classList.contains("active")})()`));
await evaluate(`document.querySelector('#system-dialog-body [data-prop-tab="details"]')?.click();true`); await wait(50);
await check("Explorer V8.5 rich properties details tab",async()=>await evaluate(`(()=>{const b=document.querySelector("#system-dialog-body");const p=b?.querySelector('[data-prop-panel="details"]');return p?.classList.contains("active")&&p.textContent.includes("C:/Documents/V74Audit/alpha.txt")&&p.textContent.includes(".txt")&&p.textContent.includes("Atributos")})()`));
await evaluate(`document.querySelector("#system-dialog-ok")?.click();true`); await wait(40);
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');const q=n=>[...w.querySelectorAll('.file,.file-row:not(.header)')].find(x=>x.dataset.v740Name===n);q("alpha.txt")?.click();w.querySelector("[data-details-v840]")?.click();return true})()`); await wait(100);
await check("Explorer V8.4 text preview",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]'),c=w.querySelector(".explorer-details-content-v840");return w.__explorerDetailsV840?.isOpen()&&c?.textContent.includes("alpha.txt")&&c.querySelector(".explorer-detail-text-v840")?.textContent==="A"})()`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');[...w.querySelectorAll('.file,.file-row:not(.header)')].find(x=>x.dataset.v740Name==="image.png")?.click();return true})()`); await wait(100);
await check("Explorer V8.4 image preview",async()=>await evaluate(`document.querySelector('.window[data-app="explorer"] .explorer-detail-image-v840 img')?.src.startsWith("data:image/png")`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');[...w.querySelectorAll('.file,.file-row:not(.header)')].find(x=>x.dataset.v740Name==="FolderOne")?.click();return true})()`); await wait(100);
await check("Explorer V8.4 folder summary",async()=>await evaluate(`(()=>{const c=document.querySelector('.window[data-app="explorer"] .explorer-details-content-v840');return c?.textContent.includes("FolderOne")&&c?.textContent.includes("Ficheiros")&&c?.textContent.includes("1")})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerDetailsV840.close();true`); await wait(50);
await check("Explorer V8.4 details closes",async()=>await evaluate(`!document.querySelector('.window[data-app="explorer"]').classList.contains("details-open-v840")`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');const q=n=>[...w.querySelectorAll('.file,.file-row:not(.header)')].find(x=>x.dataset.v740Name===n);q("alpha.txt")?.click();q("beta.txt")?.dispatchEvent(new MouseEvent("click",{bubbles:true,ctrlKey:true}));return true})()`); await wait(80);
await check("Explorer Ctrl multi-select",async()=>await evaluate(`document.querySelectorAll('.window[data-app="explorer"] .file.selected,.window[data-app="explorer"] .file-row.selected:not(.header)').length===2`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"a",ctrlKey:true,bubbles:true}));return true})()`); await wait(80);
await check("Explorer Ctrl+A selects visible items",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');const items=[...w.querySelectorAll('.file,.file-row:not(.header)')].filter(x=>!x.hidden);return items.length>=6&&items.every(x=>x.classList.contains("selected"))})()`));
await evaluate(`document.querySelector('.window[data-app="explorer"] [data-properties-v740]').click();true`); await wait(80);
await check("Explorer multi-item properties",async()=>await evaluate(`document.querySelector("#system-dialog").classList.contains("open") && document.querySelector("#system-dialog-body")?.textContent.includes("itens selecionados")`));
await evaluate(`document.querySelector("#system-dialog-ok").click();true`);
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));const q=n=>[...w.querySelectorAll('.file,.file-row:not(.header)')].find(x=>x.dataset.v740Name===n);q("alpha.txt")?.click();q("beta.txt")?.dispatchEvent(new MouseEvent("click",{bubbles:true,ctrlKey:true}));document.dispatchEvent(new KeyboardEvent("keydown",{key:"c",ctrlKey:true,bubbles:true}));return true})()`); await wait(60);
await check("Explorer batch clipboard copy",async()=>await evaluate(`state.fileClipboardV74?.mode==="copy" && state.fileClipboardV74.items?.length===2`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').dispatchEvent(new CustomEvent("navigate",{detail:"C:/Documents/V74Audit/Destination"}));true`); await wait(170);
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"v",ctrlKey:true,bubbles:true}));return true})()`); await wait(220);
await check("Explorer batch paste copies files",async()=>await evaluate(`ensureFolder("C:/Documents/V74Audit/Destination")["alpha.txt"]==="A" && ensureFolder("C:/Documents/V74Audit/Destination")["beta.txt"]==="B"`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').dispatchEvent(new CustomEvent("navigate",{detail:"C:/Documents/V74Audit"}));true`); await wait(170);
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');const img=[...w.querySelectorAll('.file,.file-row:not(.header)')].find(x=>x.dataset.v740Name==="image.png");img?.click();focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"x",ctrlKey:true,bubbles:true}));w.dispatchEvent(new CustomEvent("navigate",{detail:"C:/Documents/V74Audit/Destination"}));return true})()`); await wait(180);
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"v",ctrlKey:true,bubbles:true}));return true})()`); await wait(220);
await check("Explorer batch cut moves file",async()=>await evaluate(`!("image.png" in ensureFolder("C:/Documents/V74Audit")) && !!ensureFolder("C:/Documents/V74Audit/Destination")["image.png"]`));
await check("Explorer image thumbnail",async()=>await waitFor(async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"] [data-v740-name="image.png"] .explorer-pro-thumb')`),1800,100));
await evaluate(`document.querySelector('.window[data-app="explorer"]').dispatchEvent(new CustomEvent("navigate",{detail:"C:/Documents/V74Audit"}));true`); await wait(170);
await evaluate(`(()=>{const s=document.querySelector('.window[data-app="explorer"] .explorer-search');s.value="type:folder";s.dispatchEvent(new Event("input",{bubbles:true}));return true})()`); await wait(140);
await check("Explorer type filter",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');const visible=[...w.querySelectorAll('.file,.file-row:not(.header)')].filter(x=>!x.hidden);return visible.length>=3&&visible.every(x=>x.dataset.v740Type==="folder")})()`));
await evaluate(`(()=>{const s=document.querySelector('.window[data-app="explorer"] .explorer-search');s.value="";s.dispatchEvent(new Event("input",{bubbles:true}));return true})()`); await wait(120);
await check("Explorer safe real Blob copy",async()=>await evaluate(`(async()=>{const root="C:/Documents/V74Audit",dst=root+"/Destination";const imp=await RealContentBridge.importFileToVirtual(new File(["blob-v74"],"blob-v74.txt",{type:"text/plain"}),root);const src=ensureFolder(root)[imp.name];const result=await Win11ExplorerPro.copyFileAdvanced(root,imp.name,dst,false);const copied=ensureFolder(dst)[result.name];const a=await RealContentBridge.getRecord(src),b=await RealContentBridge.getRecord(copied);globalThis.__v74BlobNames={src:imp.name,dst:result.name};return !!a&&!!b&&src.__realBlobId!==copied.__realBlobId&&(await a.blob.text())===(await b.blob.text())})()`));
await check("Explorer folder recycle",async()=>await evaluate(`(()=>{const root="C:/Documents/V74Audit";const ok=Win11ExplorerPro.moveFolderToRecycle(root,"RecycleMe");const bin=ensureFolder("Recycle Bin");const name=Object.keys(bin).find(n=>bin[n]?.content?.__virtualFolderTrash&&bin[n]?.content?.rootName==="RecycleMe"&&bin[n]?.originalPath===root);globalThis.__v74TrashName=name||null;return ok&&!state.files[root+"/RecycleMe"]&&!!name})()`));
await check("Explorer folder restore",async()=>await evaluate(`Win11ExplorerPro.restoreRecycleItem(__v74TrashName) && !!state.files["C:/Documents/V74Audit/RecycleMe"] && ensureFolder("C:/Documents/V74Audit/RecycleMe")["trash.txt"]==="trash"`));
await evaluate(`ensureFolder("C:/Documents/V74Audit")["DeleteMe.txt"]="delete";true`);
await check("Explorer permanent delete",async()=>await evaluate(`(async()=>await Win11ExplorerPro.permanentlyDeleteVirtual("C:/Documents/V74Audit","DeleteMe.txt","file") && !("DeleteMe.txt" in ensureFolder("C:/Documents/V74Audit")))()`));
await evaluate(`(async()=>{const root="C:/Documents/V74Audit";try{await RealContentBridge.cleanupVirtualFolder(root)}catch{}Object.keys(state.files).filter(p=>p===root||p.startsWith(root+"/")).sort((a,b)=>b.length-a.length).forEach(p=>delete state.files[p]);state.fileClipboardV74=null;saveState();const w=document.querySelector('.window[data-app="explorer"]');w.dispatchEvent(new CustomEvent("navigate",{detail:"C:/Documents"}));return true})()`); await wait(180);
await check("Window Manager V7.5 bridge",async()=>await evaluate(`Win11WindowManager?.version==="8.1.0" && Object.keys(Win11WindowManager.layouts||{}).length===6`));
await check("Taskbar Window V9.7 bridge",async()=>await evaluate(`Win11TaskbarWindowPro?.version==="9.7.0" && typeof Win11TaskbarWindowPro.refresh==="function" && typeof Win11TaskbarWindowPro.getGroups==="function" && typeof Win11TaskbarWindowPro.savePlacement==="function"`));
await check("System Bus V9.8.1 bridge",async()=>await evaluate(`Win11SystemBus?.version==="9.8.1"&&typeof Win11SystemBus.emit==="function"&&typeof Win11SystemBus.on==="function"&&typeof Win11SystemBus.getHistory==="function"`));
await check("Settings Core V9.8.1 bridge",async()=>await evaluate(`Win11SettingsStore?.version==="9.8.1"&&Win11SettingsStore.schemaVersion===1&&typeof Win11SettingsStore.importConfig==="function"&&typeof Win11SettingsStore.resetCategory==="function"`));
await check("Settings V9.8.1 migrated profile schema",async()=>await evaluate(`(()=>{const m=Win11SettingsStore.metadata(),d=Win11SettingsStore.get();return state.settingsV98?.schemaVersion===1&&m.checksum===state.settingsV98.checksum&&d.appearance&&d.taskbar&&d.explorer&&d.apps&&d.storage&&d.accessibility&&d.notifications&&d.system&&d.privacy})()`));
await evaluate(`(()=>{globalThis.__v981Original=Win11SettingsStore.exportConfig();globalThis.__v981Events=[];globalThis.__v981DomEvents=[];globalThis.__v981Off=Win11SystemBus.on("settings:changed",e=>__v981Events.push(e));globalThis.__v981DomHandler=e=>__v981DomEvents.push(e.detail);document.addEventListener("win11:settings:changed",__v981DomHandler);return true})()`);
await check("Settings V9.8.1 validation matrix",async()=>await evaluate(`Win11SettingsStore.validate("system.volume",73)&&!Win11SettingsStore.validate("system.volume",101)&&Win11SettingsStore.validate("appearance.themeMode","system")&&!Win11SettingsStore.validate("appearance.themeMode","amoled")`));
await evaluate(`(()=>{globalThis.__v981SetResult=Win11SettingsStore.set("system.volume",73,{source:"browser-audit"});return true})()`);
await check("Settings V9.8.1 set syncs legacy and persists",async()=>await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem("win11-sim-profile-v67:"+Win11SessionManager.activeUserId)||"{}");return __v981SetResult===true&&Win11SettingsStore.get("system.volume")===73&&state.volume===73&&p.settingsV98?.data?.system?.volume===73})()`));
await check("Settings V9.8.1 emits typed bus and DOM events",async()=>await evaluate(`__v981Events.some(e=>e.topic==="settings:changed"&&e.detail.path==="system.volume"&&e.detail.source==="browser-audit")&&__v981DomEvents.some(e=>e.topic==="settings:changed"&&e.detail.path==="system.volume")`));
await evaluate(`(()=>{globalThis.__v981InvalidRejected=false;const before=Win11SettingsStore.get("system.volume");try{Win11SettingsStore.set("system.volume",101,{source:"browser-audit"})}catch{globalThis.__v981InvalidRejected=true}globalThis.__v981InvalidPreserved=Win11SettingsStore.get("system.volume")===before;return true})()`);
await check("Settings V9.8.1 rejects invalid values without mutation",async()=>await evaluate(`__v981InvalidRejected===true&&__v981InvalidPreserved===true`));
await evaluate(`(()=>{const before=Win11SettingsStore.get("taskbar.alignment");globalThis.__v981AtomicRejected=false;try{Win11SettingsStore.update("taskbar",{alignment:before==="left"?"center":"left",groupWindows:"invalid"},{source:"browser-audit"})}catch{globalThis.__v981AtomicRejected=true}globalThis.__v981AtomicPreserved=Win11SettingsStore.get("taskbar.alignment")===before;return true})()`);
await check("Settings V9.8.1 category update is atomic",async()=>await evaluate(`__v981AtomicRejected===true&&__v981AtomicPreserved===true`));
await evaluate(`(()=>{const x=Win11SettingsStore.exportConfig();x.data.system.volume=x.data.system.volume===73?72:73;globalThis.__v981TamperRejected=false;try{Win11SettingsStore.importConfig(x,{source:"browser-audit"})}catch{globalThis.__v981TamperRejected=true}return true})()`);
await check("Settings V9.8.1 import detects tampering",async()=>await evaluate(`__v981TamperRejected===true&&Win11SettingsStore.get("system.volume")===73`));
await evaluate(`(()=>{globalThis.__v981RoundTrip=Win11SettingsStore.exportConfig();Win11SettingsStore.set("system.volume",74,{source:"browser-audit"});Win11SettingsStore.importConfig(__v981RoundTrip,{source:"browser-audit"});return true})()`);
await check("Settings V9.8.1 export import roundtrip",async()=>await evaluate(`Win11SettingsStore.get("system.volume")===73&&Win11SettingsStore.metadata().checksum===state.settingsV98.checksum`));
await check("System Bus V9.8.1 bounded history",async()=>await evaluate(`(()=>{for(let i=0;i<90;i++)Win11SystemBus.emit("audit:v981",{i});return Win11SystemBus.getHistory("audit:v981",80).length===80&&Win11SystemBus.diagnostics().historySize===80})()`));
await check("Settings V9.8.1 prototype pollution guard",async()=>await evaluate(`(()=>{let rejected=false;try{Win11SettingsStore.importConfig('{"kind":"win11-simulator-settings","schemaVersion":1,"data":{"__proto__":{"polluted":true}}}')}catch{rejected=true}return rejected&&({}).polluted===undefined})()`));
await evaluate(`(()=>{Win11SettingsStore.importConfig(__v981Original,{source:"browser-audit-cleanup"});globalThis.__v981RestoreOk=JSON.stringify(Win11SettingsStore.get())===JSON.stringify(__v981Original.data);__v981Off?.();document.removeEventListener("win11:settings:changed",__v981DomHandler);for(const k of ["__v981Original","__v981Events","__v981DomEvents","__v981Off","__v981DomHandler","__v981SetResult","__v981InvalidRejected","__v981InvalidPreserved","__v981AtomicRejected","__v981AtomicPreserved","__v981TamperRejected","__v981RoundTrip"])delete globalThis[k];saveState();return true})()`);
await check("Settings V9.8.1 audit cleanup",async()=>await evaluate(`(()=>{const ok=globalThis.__v981RestoreOk===true;delete globalThis.__v981RestoreOk;return ok})()`));
await check("Window Manager decorates existing window",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');return w?.dataset.wmV750==="1"&&w.querySelectorAll(".wm-layout-choice").length===6})()`));
await evaluate(`openApp("notepad");openApp("calc");true`); await wait(220);
await evaluate(`(()=>{const ex=document.querySelector('.window[data-app="explorer"]'),np=document.querySelector('.window[data-app="notepad"]');Win11WindowManager.applyLayoutSlot(ex,"halves",0,{assist:false});Win11WindowManager.applyLayoutSlot(np,"halves",1,{assist:false});return true})()`); await wait(100);
await check("Snap Groups pair complementary windows",async()=>await evaluate(`(()=>{const ex=document.querySelector('.window[data-app="explorer"]'),np=document.querySelector('.window[data-app="notepad"]');return !!ex.dataset.wmSnapGroup&&ex.dataset.wmSnapGroup===np.dataset.wmSnapGroup&&ex.dataset.wmSnapLayout==="halves"&&np.dataset.wmSnapSlot==="1"})()`));
await evaluate(`(()=>{const ex=document.querySelector('.window[data-app="explorer"]');Win11WindowManager.restoreFloating(ex);Win11WindowManager.applyLayoutSlot(ex,"thirds",0,{assist:true});return true})()`); await wait(130);
await check("Snap Assist opens for remaining windows",async()=>await evaluate(`!!document.querySelector(".wm-snap-assist.open .wm-assist-card")`));
await evaluate(`document.querySelector(".wm-snap-assist [data-close]")?.click();true`);
await evaluate(`showAltTab();true`); await wait(120);
await check("Alt+Tab live preview UI",async()=>await evaluate(`document.querySelector("#alt-tab").classList.contains("open") && document.querySelectorAll("#alt-tab .wm-alt-card").length>=2 && !!document.querySelector("#alt-tab .wm-alt-preview .wm-preview-clone")`));
await evaluate(`commitAltTab();true`); await wait(50);
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');const b=document.querySelector('.task-btn[data-window="'+w.dataset.id+'"]');b?.dispatchEvent(new PointerEvent("pointerover",{bubbles:true}));return true})()`); await wait(120);
await check("Taskbar window preview UI",async()=>await evaluate(`document.querySelector(".wm-taskbar-preview")?.classList.contains("open") && !!document.querySelector(".wm-taskbar-preview .wm-taskbar-preview-card")`));
await evaluate(`document.querySelector(".wm-taskbar-preview")?.classList.remove("open");true`);
await evaluate(`(()=>{ensureFolder("C:/Desktop")["V75 Desktop Audit.txt"]="desktop-v75";Win11WindowManager.populateDesktop();return true})()`); await wait(80);
await check("Desktop shows virtual files",async()=>await evaluate(`!!document.querySelector('#desktop-icons [data-desktop-item="file:V75 Desktop Audit.txt"]')`));
await check("Desktop system shortcuts use SVG icons",async()=>await evaluate(`document.querySelectorAll('#desktop-icons [data-desktop-item^="system-"] .desktop-icon-art svg').length===5`));
await check("Desktop virtual file uses SVG icon",async()=>await evaluate(`!!document.querySelector('#desktop-icons [data-desktop-item="file:V75 Desktop Audit.txt"] .desktop-icon-art svg')`));
await check("Desktop icons contain no emoji text glyphs",async()=>await evaluate(`[...document.querySelectorAll("#desktop-icons .desktop-icon-art")].every(x=>x.textContent.trim()==="")`));
await evaluate(`(()=>{state.windowManagerV75.desktopIconPositions["file:V75 Desktop Audit.txt"]={x:123,y:88};saveState();Win11WindowManager.populateDesktop();return true})()`); await wait(60);
await check("Desktop icon position persists",async()=>await evaluate(`(()=>{const i=document.querySelector('#desktop-icons [data-desktop-item="file:V75 Desktop Audit.txt"]');return i?.style.left==="123px"&&i?.style.top==="88px"})()`));
await evaluate(`(()=>{globalThis.__v75DesktopCount=state.desktops.length;globalThis.__v75Calc=document.querySelector('.window[data-app="calc"]');Win11WindowManager.createDesktop();return true})()`); await wait(130);
await check("Virtual desktop creation",async()=>await evaluate(`state.desktops.length===__v75DesktopCount+1 && Number(state.currentDesktop)===state.desktops.length-1`));
await evaluate(`Win11WindowManager.moveWindowToDesktop(__v75Calc,Number(state.currentDesktop));Win11WindowManager.renderTaskView();document.querySelector("#task-view").classList.add("open");true`); await wait(100);
await check("Task View V7.5 window cards",async()=>await evaluate(`document.querySelectorAll(".wm-desktop-card").length===state.desktops.length && !!document.querySelector(".wm-task-window-card[draggable=true]")`));
await check("Move window between virtual desktops",async()=>await evaluate(`Number(__v75Calc.dataset.desktop)===Number(state.currentDesktop)`));
await evaluate(`Win11WindowManager.closeDesktop(Number(state.currentDesktop));document.querySelector("#task-view").classList.remove("open");true`); await wait(100);
await check("Virtual desktop close restores count",async()=>await evaluate(`state.desktops.length===__v75DesktopCount && Number(state.currentDesktop)<state.desktops.length`));
await evaluate(`(()=>{const ex=document.querySelector('.window[data-app="explorer"]'),np=document.querySelector('.window[data-app="notepad"]'),calc=document.querySelector('.window[data-app="calc"]');Win11WindowManager.restoreFloating(ex);if(np)closeWindow(np);if(calc)closeWindow(calc);delete ensureFolder("C:/Desktop")["V75 Desktop Audit.txt"];delete state.windowManagerV75.desktopIconPositions["file:V75 Desktop Audit.txt"];saveState();Win11WindowManager.populateDesktop();return true})()`); await wait(100);
await check("Desktop integration bridge",async()=>await evaluate(`typeof Win11DesktopIntegration==="object" && Win11DesktopIntegration.version==="8.1.0"`));
await check("Default file associations",async()=>await evaluate(`Win11DesktopIntegration.defaultAppFor("teste.txt")==="notepad" && Win11DesktopIntegration.defaultAppFor("imagem.png")==="photos"`));
await check("Image has multiple Open With apps",async()=>await evaluate(`(()=>{const ids=Win11DesktopIntegration.candidateApps("imagem.png").map(a=>a.id);return ids.includes("photos")&&ids.includes("paint")})()`));
await evaluate(`(()=>{const c=document.createElement("canvas");c.width=16;c.height=16;const x=c.getContext("2d");x.fillStyle="#3366cc";x.fillRect(0,0,16,16);ensureFolder("C:/Pictures")["V7Audit.png"]=c.toDataURL("image/png");Win11DesktopIntegration.setDefaultApp(".png","paint");return true})()`);
await check("Per-profile association stored",async()=>await evaluate(`state.fileAssociations[".png"]==="paint" && JSON.parse(localStorage.getItem("win11-sim-profile-v67:"+Win11SessionManager.activeUserId)).fileAssociations[".png"]==="paint"`));
await check("Association isolated from user two",async()=>await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem("win11-sim-profile-v67:"+${JSON.stringify(user2.id)})||"{}");return p.fileAssociations?.[".png"]!=="paint"})()`));
await evaluate(`(async()=>{await openFile("C:/Pictures","V7Audit.png",ensureFolder("C:/Pictures")["V7Audit.png"]);return true})()`); await wait(80);
await check("Default app opens image in Paint",async()=>await evaluate(`$$(".window").some(w=>w.dataset.app==="paint"&&w.dataset.openedFile==="V7Audit.png")`));
await evaluate(`Win11DesktopIntegration.setDefaultApp(".png","photos");Win11DesktopIntegration.showOpenWith("C:/Pictures","V7Audit.png",ensureFolder("C:/Pictures")["V7Audit.png"]);true`); await wait(100);
await check("Open With dialog UI",async()=>await evaluate(`document.querySelector("#system-dialog").classList.contains("open") && document.querySelectorAll('#system-dialog-body input[name="openwith-app"]').length>=2 && !!document.querySelector("#system-dialog-body [data-openwith-always]")`));
await evaluate(`document.querySelector("#system-dialog-x").click();true`);
await check("Native file share path",async()=>await evaluate(`(async()=>{Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>true});Object.defineProperty(navigator,"share",{configurable:true,value:async data=>{globalThis.__auditShared={title:data.title,file:data.files?.[0]?.name||null,text:data.text||null}}});ensureFolder("C:/Documents")["ShareV7.txt"]="partilha v7";const ok=await Win11DesktopIntegration.shareFile("C:/Documents","ShareV7.txt",ensureFolder("C:/Documents")["ShareV7.txt"]);const pass=ok&&__auditShared?.file==="ShareV7.txt";delete navigator.share;delete navigator.canShare;return pass})()`));
await check("Safe print document escaping",async()=>await evaluate(`(()=>{const d=Win11DesktopIntegration.printableTextDocument("audit.txt","<script>danger<\\/script>");return !d.includes("<script>danger<\\/script>")&&d.includes("&lt;script&gt;danger&lt;/script&gt;")})()`));
await check("Real print path for text file",async()=>await evaluate(`(async()=>await Win11DesktopIntegration.printFile("C:/Documents","ShareV7.txt",ensureFolder("C:/Documents")["ShareV7.txt"]))()`));
await evaluate(`delete ensureFolder("C:/Pictures")["V7Audit.png"];delete ensureFolder("C:/Documents")["ShareV7.txt"];Win11DesktopIntegration.setDefaultApp(".png","paint");saveState();true`);
await check("Quick Settings V7.9 replaces legacy tiles",async()=>await evaluate(`document.querySelector("#quick-panel")?.classList.contains("quick-panel-v79") && document.querySelectorAll("#quick-panel [data-quick-v79]").length===6 && !document.querySelector('#quick-panel [data-quick="wifi"]') && !document.querySelector("#quick-panel [data-real-network]")`));
await check("System Tray V7.9 reflects navigator network",async()=>await evaluate(`(()=>{const t=document.querySelector("#quick-btn .tray-network-v79");return !!t && (navigator.onLine?!t.classList.contains("offline"):t.classList.contains("offline"))})()`));
await check("System Tray V7.9 bridge",async()=>await evaluate(`Win11SystemTray?.version==="8.1.0" && typeof Win11SystemTray.refresh==="function" && typeof Win11SystemTray.toggleOverflow==="function"`));
await check("System Tray cluster uses stable SVG icons",async()=>await evaluate(`(()=>{const q=document.querySelector("#quick-btn");return q?.getAttribute("aria-label")==="Rede, volume e bateria"&&q.querySelectorAll(".tray-svg-v79").length>=2&&!/[📶🔊🔔]/u.test(q.textContent)})()`));
await check("Legacy device tray button hidden",async()=>await evaluate(`document.querySelector("#device-center-btn")?.hidden===true`));
await check("Quick Settings V7.9 status cards",async()=>await evaluate(`document.querySelectorAll("#quick-panel .quick-status-v79 > button").length===2 && !!document.querySelector("#quick-panel [data-network-detail-v79]") && !!document.querySelector("#quick-panel [data-battery-detail-v79]")`));
await check("Quick Settings V7.9 sliders",async()=>await evaluate(`!!document.querySelector("#quick-panel [data-volume-v79]") && !!document.querySelector("#quick-panel [data-brightness-v79]") && document.querySelectorAll("#quick-panel .quick-slider-v79").length===2`));
await check("Quick Settings real versus virtual disclosure",async()=>await evaluate(`document.querySelector("#quick-panel .quick-footer-v79")?.textContent.includes("Rede/bateria: browser") && document.querySelector("#quick-panel .quick-footer-v79")?.textContent.includes("simulador")`));
await evaluate(`(()=>{globalThis.__v79SoundBefore=state.quick.sound;document.querySelector('#quick-panel [data-quick-v79="sound"]').click();return true})()`); await wait(70);
await check("Quick Settings sound toggle",async()=>await evaluate(`state.quick.sound!==__v79SoundBefore && !!document.querySelector("#quick-btn .tray-volume-v79 .tray-svg-v79")`));
await evaluate(`document.querySelector('#quick-panel [data-quick-v79="sound"]').click();true`); await wait(60);
await check("Quick Settings sound toggle restores",async()=>await evaluate(`state.quick.sound===__v79SoundBefore`));
await evaluate(`(()=>{globalThis.__v79BluetoothBefore=state.systemTrayV79.bluetooth;document.querySelector('#quick-panel [data-quick-v79="bluetooth"]').click();return true})()`); await wait(60);
await check("Quick Settings virtual Bluetooth toggle",async()=>await evaluate(`state.systemTrayV79.bluetooth!==__v79BluetoothBefore && state.devices.bluetooth===state.systemTrayV79.bluetooth`));
await evaluate(`document.querySelector('#quick-panel [data-quick-v79="bluetooth"]').click();true`); await wait(60);
await check("Quick Settings Bluetooth restores",async()=>await evaluate(`state.systemTrayV79.bluetooth===__v79BluetoothBefore`));
await evaluate(`(()=>{globalThis.__v79NightBefore=state.quick.night;document.querySelector('#quick-panel [data-quick-v79="night"]').click();return true})()`); await wait(60);
await check("Quick Settings Night Light visual",async()=>await evaluate(`state.quick.night!==__v79NightBefore && document.querySelector("#app").classList.contains("night-light-v79")===state.quick.night`));
await evaluate(`document.querySelector('#quick-panel [data-quick-v79="night"]').click();true`); await wait(60);
await check("Quick Settings Night Light restores",async()=>await evaluate(`state.quick.night===__v79NightBefore`));
await evaluate(`Win11NotificationCenter.setFocusMode("off");document.querySelector('#quick-panel [data-quick-v79="focus"]').click();true`); await wait(60);
await check("Quick Settings Focus Assist integration",async()=>await evaluate(`Win11NotificationCenter.focusMode==="priority" && Win11NotificationCenter.isQuiet()`));
await evaluate(`document.querySelector('#quick-panel [data-quick-v79="focus"]').click();true`); await wait(60);
await check("Quick Settings Focus Assist restores",async()=>await evaluate(`Win11NotificationCenter.focusMode==="off" && !Win11NotificationCenter.isQuiet()`));
await evaluate(`(()=>{globalThis.__v79VolumeBefore=state.volume;const r=document.querySelector("#quick-panel [data-volume-v79]");r.value="41";r.dispatchEvent(new Event("input",{bubbles:true}));return true})()`); await wait(50);
await check("Quick Settings volume slider state",async()=>await evaluate(`state.volume===41 && document.querySelector("#quick-panel [data-volume-v79]")?.parentElement.querySelector("output")?.textContent==="41%"`));
await evaluate(`(()=>{state.volume=__v79VolumeBefore;saveState();Win11SystemTray.refresh();return true})()`); await wait(80);
await evaluate(`(()=>{globalThis.__v79BrightnessBefore=state.brightness;const r=document.querySelector("#quick-panel [data-brightness-v79]");r.value="72";r.dispatchEvent(new Event("input",{bubbles:true}));return true})()`); await wait(50);
await check("Quick Settings brightness slider state",async()=>await evaluate(`state.brightness===72 && document.querySelector("#desktop").style.filter.includes("0.72")`));
await evaluate(`(()=>{state.brightness=__v79BrightnessBefore;saveState();applyState();return true})()`); await wait(50);
await evaluate(`document.querySelector("#tray-overflow-btn-v79").click();true`); await wait(60);
await check("System Tray overflow",async()=>await evaluate(`document.querySelector("#tray-overflow-v79")?.classList.contains("open") && document.querySelectorAll("#tray-overflow-v79 button").length===4`));
await evaluate(`Win11SystemTray.closeOverflow();true`);
await check("System Tray snapshot uses browser network",async()=>await evaluate(`(async()=>{const s=await Win11SystemTray.refresh();return s&&s.online===navigator.onLine&&typeof s.secureContext==="boolean"})()`));
await evaluate(`closeOverlays();document.dispatchEvent(new KeyboardEvent("keydown",{key:"a",metaKey:true,bubbles:true}));true`); await wait(60);
await check("Win+A opens Quick Settings",async()=>await evaluate(`document.querySelector("#quick-panel").classList.contains("open")`));
await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown",{key:"a",metaKey:true,bubbles:true}));true`); await wait(50);
await check("Win+A toggles Quick Settings closed",async()=>await evaluate(`!document.querySelector("#quick-panel").classList.contains("open")`));
await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",metaKey:true,bubbles:true}));true`); await wait(60);
await check("Win+N opens Notification Center",async()=>await evaluate(`document.querySelector("#notification-panel").classList.contains("open")`));
await evaluate(`closeOverlays();true`);

await check("Explorer Multi-Window V9.3 bridge",async()=>await evaluate(`Win11ExplorerMultiWindow?.version==="9.3.0"&&typeof Win11ExplorerMultiWindow.open==="function"&&typeof Win11ExplorerMultiWindow.transferAcross==="function"`));
await evaluate(`(()=>{const primary=document.querySelector('#window-layer > .window[data-app="explorer"]'),wrap=primary?.querySelector(".explorer-navigation-v820");if(!primary||!wrap)return false;wrap.__explorerNavigationV820.go("C:/Documents");ensureFolder("C:/Documents")["MultiV93.txt"]="multi window audit";wrap.__explorerProV740?.forceRender?.();globalThis.__v930PrimaryId=primary.dataset.id;return true})()`); await wait(120);
await evaluate(`(()=>{globalThis.__v930Secondary=Win11ExplorerMultiWindow.open("C:/Downloads",document.querySelector('#window-layer > .window[data-id="'+CSS.escape(globalThis.__v930PrimaryId)+'"]'));return !!globalThis.__v930Secondary})()`); await wait(180);
await check("Explorer V9.3 opens second independent window",async()=>await evaluate(`(()=>{const wins=Win11ExplorerMultiWindow.getWindows();if(wins.length!==2)return false;const a=wins.find(w=>w.dataset.id===globalThis.__v930PrimaryId),b=wins.find(w=>w.dataset.id!==globalThis.__v930PrimaryId);return !!a&&!!b&&a.dataset.id!==b.dataset.id&&Win11ExplorerPro.currentVirtualPath(a.querySelector(".explorer-navigation-v820"))==="C:/Documents"&&Win11ExplorerPro.currentVirtualPath(b.querySelector(".explorer-navigation-v820"))==="C:/Downloads"&&b.dataset.explorerMultiWindowV930==="1"})()`));
await check("Explorer V9.3 per-window tab session keys",async()=>await evaluate(`(()=>{const wins=Win11ExplorerMultiWindow.getWindows(),keys=wins.map(w=>w.__explorerNavigationV820?.getSessionKey?.());return keys.length===2&&keys.every(Boolean)&&new Set(keys).size===2&&keys.every(k=>!!state.explorerNavigationV83.windowSessions[k])})()`));
await evaluate(`(()=>{const wins=Win11ExplorerMultiWindow.getWindows(),b=wins.find(w=>w.dataset.id!==globalThis.__v930PrimaryId);b.__explorerNavigationV820.go("C:/Music");return true})()`); await wait(100);
await check("Explorer V9.3 secondary navigation does not overwrite primary",async()=>await evaluate(`(()=>{const wins=Win11ExplorerMultiWindow.getWindows(),a=wins.find(w=>w.dataset.id===globalThis.__v930PrimaryId),b=wins.find(w=>w.dataset.id!==globalThis.__v930PrimaryId),s=state.explorerNavigationV83.lastSession,active=s?.tabs?.[Math.max(0,Math.min(Number(s?.activeIndex)||0,(s?.tabs?.length||1)-1))];return Win11ExplorerPro.currentVirtualPath(a.querySelector(".explorer-navigation-v820"))==="C:/Documents"&&Win11ExplorerPro.currentVirtualPath(b.querySelector(".explorer-navigation-v820"))==="C:/Music"&&active?.path==="C:/Documents"})()`));
await evaluate(`(()=>{const b=Win11ExplorerMultiWindow.getWindows().find(w=>w.dataset.id!==globalThis.__v930PrimaryId);focusWindow(b);document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",ctrlKey:true,bubbles:true,cancelable:true}));return true})()`); await wait(160);
await check("Explorer V9.3 Ctrl+N creates third window",async()=>await evaluate(`Win11ExplorerMultiWindow.getWindows().length===3`));
await check("Explorer V9.3 grouped taskbar badge",async()=>await evaluate(`(()=>{Win11ExplorerMultiWindow.refreshTaskbar();const lead=document.querySelector("#task-center .explorer-task-group-lead-v930"),hidden=document.querySelectorAll("#task-center .explorer-task-group-hidden-v930");return !!lead&&lead.dataset.explorerGroupCount==="3"&&hidden.length===2})()`)); await wait(60);
await evaluate(`(()=>{const lead=document.querySelector("#task-center .explorer-task-group-lead-v930");lead?.click();return true})()`); await wait(70);
await check("Explorer V9.3 taskbar group panel",async()=>await evaluate(`document.querySelector("#explorer-task-group-v930")?.classList.contains("open")&&document.querySelectorAll("#explorer-task-group-v930 .explorer-task-window-v930").length===3`));
await evaluate(`(()=>{document.querySelector("#explorer-task-group-v930")?.classList.remove("open");const wins=Win11ExplorerMultiWindow.getWindows(),primary=wins.find(w=>w.dataset.id===globalThis.__v930PrimaryId),others=wins.filter(w=>w!==primary),third=others.find(w=>Win11ExplorerPro.currentVirtualPath(w.querySelector(".explorer-navigation-v820"))==="C:/Music"&&w!==globalThis.__v930Secondary);if(third)closeWindow(third);return true})()`); await wait(100);
await evaluate(`(()=>{const wins=Win11ExplorerMultiWindow.getWindows(),a=wins.find(w=>w.dataset.id===globalThis.__v930PrimaryId),b=wins.find(w=>w.dataset.id!==globalThis.__v930PrimaryId);a.__explorerNavigationV820.go("C:/Documents");b.__explorerNavigationV820.go("C:/Downloads");Win11WindowManager.applyLayoutSlot(a,"halves",0,{assist:false});Win11WindowManager.applyLayoutSlot(b,"halves",1,{assist:false});return true})()`); await wait(90);
await check("Explorer V9.3 two windows Snap side by side",async()=>await evaluate(`(()=>{const wins=Win11ExplorerMultiWindow.getWindows();return wins.length===2&&wins.every(w=>w.classList.contains("wm-snapped"))&&new Set(wins.map(w=>w.dataset.wmSnapSlot)).size===2})()`));
await evaluate(`(()=>{const wins=Win11ExplorerMultiWindow.getWindows(),a=wins.find(w=>w.dataset.id===globalThis.__v930PrimaryId),b=wins.find(w=>w.dataset.id!==globalThis.__v930PrimaryId);Win11WindowManager.restoreFloating(a);Win11WindowManager.restoreFloating(b);a.querySelector(".explorer-navigation-v820").__explorerProV740.forceRender();return true})()`); await wait(100);
await check("Explorer V9.3 drag payload and cross-window move",async()=>await evaluate(`(async()=>{const wins=Win11ExplorerMultiWindow.getWindows(),a=wins.find(w=>w.dataset.id===globalThis.__v930PrimaryId),b=wins.find(w=>w.dataset.id!==globalThis.__v930PrimaryId),aw=a.querySelector(".explorer-navigation-v820"),bw=b.querySelector(".explorer-navigation-v820");aw.__explorerNavigationV820.go("C:/Documents");bw.__explorerNavigationV820.go("C:/Downloads");await new Promise(r=>setTimeout(r,80));aw.__explorerProV740.forceRender();await new Promise(r=>setTimeout(r,60));const node=[...aw.querySelectorAll(".file,.file-row:not(.header)")].find(x=>x.dataset.v740Name==="MultiV93.txt");if(!node)return false;const dt=new DataTransfer();node.dispatchEvent(new DragEvent("dragstart",{bubbles:true,cancelable:true,dataTransfer:dt}));const hasPayload=dt.types.includes("application/x-win11-explorer-window-v930");const host=bw.querySelector(".explorer-files");host.dispatchEvent(new DragEvent("dragover",{bubbles:true,cancelable:true,dataTransfer:dt}));host.dispatchEvent(new DragEvent("drop",{bubbles:true,cancelable:true,dataTransfer:dt}));await new Promise(r=>setTimeout(r,180));return hasPayload&&!Object.prototype.hasOwnProperty.call(ensureFolder("C:/Documents"),"MultiV93.txt")&&ensureFolder("C:/Downloads")["MultiV93.txt"]==="multi window audit"})()`));
await evaluate(`(()=>{delete ensureFolder("C:/Downloads")["MultiV93.txt"];Win11ExplorerFilesystem.onDelete({path:"C:/Downloads",name:"MultiV93.txt",type:"file"});const wins=Win11ExplorerMultiWindow.getWindows(),primary=wins.find(w=>w.dataset.id===globalThis.__v930PrimaryId);wins.filter(w=>w!==primary).forEach(w=>closeWindow(w));primary?.__explorerNavigationV820?.go("C:/Documents");Win11ExplorerMultiWindow.refreshTaskbar();saveState();return true})()`); await wait(130);
await check("Explorer V9.3 cleanup returns to one window",async()=>await evaluate(`Win11ExplorerMultiWindow.getWindows().length===1&&!document.querySelector("#task-center .explorer-task-group-hidden-v930")&&!document.querySelector("#task-center .explorer-task-group-lead-v930")`));

await evaluate(`(()=>{globalThis.__v970OriginalWM97=state.windowManagerV97?JSON.parse(JSON.stringify(state.windowManagerV97)):null;globalThis.__v970BaseNotepads=[...document.querySelectorAll('#window-layer > .window[data-app="notepad"]')].map(w=>({id:w.dataset.id,hidden:w.classList.contains("hidden")}));const a=openAppNewWindow("notepad"),b=openAppNewWindow("notepad");globalThis.__v970NewNotepads=[a.dataset.id,b.dataset.id];return true})()`); await wait(180);
await evaluate(`(async()=>{Win11TaskbarWindowPro.refresh();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true})()`);
await check("Taskbar V9.7 groups duplicate app windows",async()=>await evaluate(`(()=>{const wins=[...document.querySelectorAll('#window-layer > .window[data-app="notepad"]')].filter(w=>Number(w.dataset.desktop||0)===(Number(state.currentDesktop)||0)),lead=document.querySelector('#task-center .taskbar-group-lead-v970[data-taskbar-group-app="notepad"]'),hidden=document.querySelectorAll("#task-center .taskbar-group-hidden-v970");return wins.length>=2&&!!lead&&Number(lead.dataset.taskbarGroupCount)===wins.length&&lead.querySelector(".taskbar-group-badge-v970")?.textContent===String(wins.length)&&hidden.length>=wins.length-1})()`));
await evaluate(`(()=>{const lead=document.querySelector('#task-center .taskbar-group-lead-v970[data-taskbar-group-app="notepad"]');lead?.click();return true})()`); await wait(80);
await check("Taskbar V9.7 group preview panel",async()=>await evaluate(`(()=>{const p=document.querySelector("#taskbar-group-v970");const n=document.querySelectorAll('#window-layer > .window[data-app="notepad"]').length;return p?.classList.contains("open")&&p.querySelectorAll(".taskbar-group-card-v970").length===n&&p.querySelectorAll(".taskbar-group-preview-clone-v970").length>=1&&!!p.querySelector("[data-min-all]")&&!!p.querySelector("[data-restore-all]")&&!!p.querySelector("[data-close-all]")})()`));
await evaluate(`document.querySelector("#taskbar-group-v970 [data-min-all]")?.click();true`); await wait(70);
await check("Taskbar V9.7 minimize all",async()=>await evaluate(`[...document.querySelectorAll('#window-layer > .window[data-app="notepad"]')].every(w=>w.classList.contains("hidden"))`));
await evaluate(`(()=>{const lead=document.querySelector('#task-center .taskbar-group-lead-v970[data-taskbar-group-app="notepad"]');lead?.click();return true})()`); await wait(60);
await evaluate(`document.querySelector("#taskbar-group-v970 [data-restore-all]")?.click();true`); await wait(70);
await check("Taskbar V9.7 restore all",async()=>await evaluate(`[...document.querySelectorAll('#window-layer > .window[data-app="notepad"]')].every(w=>!w.classList.contains("hidden"))`));
await evaluate(`(()=>{const w=document.querySelector('#window-layer > .window[data-id="'+CSS.escape(globalThis.__v970NewNotepads[0])+'"]');if(!w)return false;globalThis.__v970PlacementBefore={left:w.style.left,top:w.style.top,width:w.style.width,height:w.style.height};Object.assign(w.style,{left:"137px",top:"93px",width:"612px",height:"418px"});globalThis.__v970SavedPlacement=Win11TaskbarWindowPro.savePlacement(w);Object.assign(w.style,{left:"12px",top:"12px",width:"430px",height:"300px"});globalThis.__v970AppliedPlacement=Win11TaskbarWindowPro.applyPlacement(w);return true})()`);
await check("Taskbar V9.7 window placement persistence",async()=>await evaluate(`(()=>{const w=document.querySelector('#window-layer > .window[data-id="'+CSS.escape(globalThis.__v970NewNotepads[0])+'"]'),p=Win11TaskbarWindowPro.getPlacement(w);const width=Math.max(300,Math.min(612,innerWidth-12)),height=Math.max(220,Math.min(418,innerHeight-76)),left=Math.max(0,Math.min(137,innerWidth-width)),top=Math.max(0,Math.min(93,innerHeight-height-66));return globalThis.__v970SavedPlacement===true&&globalThis.__v970AppliedPlacement===true&&w.style.left===left+"px"&&w.style.top===top+"px"&&w.style.width===width+"px"&&w.style.height===height+"px"&&p?.left===137&&p?.top===93&&p?.width===612&&p?.height===418})()`));
await check("Taskbar V9.7 placement state persists per profile",async()=>await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem("win11-sim-profile-v67:"+Win11SessionManager.activeUserId)||"{}");return !!p.windowManagerV97?.placements&&Object.keys(p.windowManagerV97.placements).length>=1})()`));

await evaluate(`(()=>{const docs=ensureFolder("C:/Documents"),down=ensureFolder("C:/Downloads"),items=[];for(let i=0;i<14;i++){const n="TaskProgressV97-"+i+".txt";docs[n]="progress-"+i;delete down[n];items.push({path:"C:/Documents",name:n,type:"file"})}const w=document.querySelector('#window-layer > .window[data-app="explorer"]'),wrap=w.querySelector(".explorer-navigation-v820");globalThis.__v970ProgressWindow=w.dataset.id;globalThis.__v970ProgressPromise=wrap.__explorerOperationsV900.transfer(items,"C:/Downloads","copy");return true})()`); await wait(65);
await check("Taskbar V9.7 Explorer operation progress",async()=>await evaluate(`(()=>{const b=document.querySelector('#task-center .task-btn[data-window="'+CSS.escape(globalThis.__v970ProgressWindow)+'"]'),p=Number(b?.dataset.taskProgress);return !!b&&b.classList.contains("task-progress-v970")&&Number.isFinite(p)&&p>=0&&p<100})()`));
await evaluate(`globalThis.__v970ProgressPromise`); await wait(1400);
await check("Taskbar V9.7 progress clears after completion",async()=>await evaluate(`(()=>{const b=document.querySelector('#task-center .task-btn[data-window="'+CSS.escape(globalThis.__v970ProgressWindow)+'"]');return !!b&&!b.classList.contains("task-progress-v970")&&!b.hasAttribute("data-task-progress")})()`));
await evaluate(`(()=>{const docs=ensureFolder("C:/Documents"),down=ensureFolder("C:/Downloads");for(let i=0;i<14;i++){const n="TaskProgressV97-"+i+".txt";delete docs[n];delete down[n];Win11ExplorerFilesystem.onDelete({path:"C:/Documents",name:n,type:"file"});Win11ExplorerFilesystem.onDelete({path:"C:/Downloads",name:n,type:"file"})}Win11ExplorerHistory.clear();for(const id of globalThis.__v970NewNotepads||[]){const w=document.querySelector('#window-layer > .window[data-id="'+CSS.escape(id)+'"]');if(w)closeWindow(w)}for(const x of globalThis.__v970BaseNotepads||[]){const w=document.querySelector('#window-layer > .window[data-id="'+CSS.escape(x.id)+'"]');if(w)w.classList.toggle("hidden",!!x.hidden)}if(globalThis.__v970OriginalWM97)state.windowManagerV97=globalThis.__v970OriginalWM97;else delete state.windowManagerV97;for(const k of ["__v970OriginalWM97","__v970BaseNotepads","__v970NewNotepads","__v970PlacementBefore","__v970SavedPlacement","__v970AppliedPlacement","__v970ProgressWindow","__v970ProgressPromise"])delete globalThis[k];Win11TaskbarWindowPro.refresh();saveState();updateTaskbar();return true})()`); await wait(150);
await check("Taskbar V9.7 cleanup",async()=>await evaluate(`!document.querySelector('#task-center .taskbar-group-lead-v970[data-taskbar-group-app="notepad"]')&&!document.querySelector("#taskbar-group-v970.open")&&!Object.keys(ensureFolder("C:/Documents")).some(n=>n.startsWith("TaskProgressV97-"))`));

await evaluate(`(()=>{const docs=ensureFolder("C:/Documents"),down=ensureFolder("C:/Downloads"),bin=ensureFolder("Recycle Bin"),names=["HistCopyV94.txt","HistMoveV94.txt","HistRenameV94.txt","HistRenamedV94.txt","HistDeleteV94.txt","HistReplaceV94.txt"];for(const n of names){delete docs[n];delete down[n]}for(const [k,v] of Object.entries(bin))if(names.includes(k)||names.includes(v?.originalName))delete bin[k];docs["HistCopyV94.txt"]="copy-v94";docs["HistMoveV94.txt"]="move-v94";docs["HistRenameV94.txt"]="rename-v94";docs["HistDeleteV94.txt"]="delete-v94";Win11ExplorerHistory.clear();Win11SearchV920?.invalidate?.();const w=document.querySelector('#window-layer > .window[data-app="explorer"]');w.__explorerNavigationV820.go("C:/Documents");return true})()`); await wait(120);
await check("Explorer History V9.4 initial UI",async()=>await evaluate(`(()=>{const w=document.querySelector('#window-layer > .window[data-app="explorer"]'),u=w.querySelector("[data-history-undo-v940]"),r=w.querySelector("[data-history-redo-v940]");return !!w.__explorerHistoryV940&&!!u&&!!r&&u.disabled&&r.disabled&&Win11ExplorerHistory.getState().undo.length===0})()`));

await evaluate(`(async()=>{const w=document.querySelector('#window-layer > .window[data-app="explorer"]'),wrap=w.querySelector(".explorer-navigation-v820");return await wrap.__explorerOperationsV900.transfer([{path:"C:/Documents",name:"HistCopyV94.txt",type:"file"}],"C:/Downloads","copy")})()`); await wait(100);
await check("Explorer V9.4 copy recorded",async()=>await evaluate(`(()=>{const h=Win11ExplorerHistory.getState(),w=document.querySelector('#window-layer > .window[data-app="explorer"]');return ensureFolder("C:/Downloads")["HistCopyV94.txt"]==="copy-v94"&&h.undo.length===1&&h.undo[0].kind==="copy"&&h.undo[0].items[0].dstName==="HistCopyV94.txt"&&!w.querySelector("[data-history-undo-v940]").disabled})()`));
await evaluate(`(()=>{const w=document.querySelector('#window-layer > .window[data-app="explorer"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true,cancelable:true}));return true})()`); await wait(130);
await check("Explorer V9.4 Ctrl+Z undoes copy",async()=>await evaluate(`(()=>{const h=Win11ExplorerHistory.getState(),w=document.querySelector('#window-layer > .window[data-app="explorer"]');return !Object.prototype.hasOwnProperty.call(ensureFolder("C:/Downloads"),"HistCopyV94.txt")&&ensureFolder("C:/Documents")["HistCopyV94.txt"]==="copy-v94"&&h.undo.length===0&&h.redo.length===1&&!w.querySelector("[data-history-redo-v940]").disabled})()`));
await evaluate(`(()=>{const w=document.querySelector('#window-layer > .window[data-app="explorer"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"y",ctrlKey:true,bubbles:true,cancelable:true}));return true})()`); await wait(130);
await check("Explorer V9.4 Ctrl+Y redoes copy",async()=>await evaluate(`ensureFolder("C:/Downloads")["HistCopyV94.txt"]==="copy-v94"&&Win11ExplorerHistory.getState().undo.at(-1)?.kind==="copy"`));
await evaluate(`(async()=>{await Win11ExplorerPro.permanentlyDeleteVirtual("C:/Downloads","HistCopyV94.txt","file");Win11ExplorerHistory.clear();return true})()`); await wait(50);

await evaluate(`(async()=>{const w=document.querySelector('#window-layer > .window[data-app="explorer"]'),wrap=w.querySelector(".explorer-navigation-v820");return await wrap.__explorerOperationsV900.transfer([{path:"C:/Documents",name:"HistMoveV94.txt",type:"file"}],"C:/Downloads","move")})()`); await wait(90);
await check("Explorer V9.4 move recorded",async()=>await evaluate(`!Object.prototype.hasOwnProperty.call(ensureFolder("C:/Documents"),"HistMoveV94.txt")&&ensureFolder("C:/Downloads")["HistMoveV94.txt"]==="move-v94"&&Win11ExplorerHistory.getState().undo.at(-1)?.kind==="move"`));
await evaluate(`Win11ExplorerHistory.undo()`); await wait(90);
await check("Explorer V9.4 undo move",async()=>await evaluate(`ensureFolder("C:/Documents")["HistMoveV94.txt"]==="move-v94"&&!Object.prototype.hasOwnProperty.call(ensureFolder("C:/Downloads"),"HistMoveV94.txt")`));
await evaluate(`Win11ExplorerHistory.redo()`); await wait(90);
await check("Explorer V9.4 redo move",async()=>await evaluate(`!Object.prototype.hasOwnProperty.call(ensureFolder("C:/Documents"),"HistMoveV94.txt")&&ensureFolder("C:/Downloads")["HistMoveV94.txt"]==="move-v94"`));
await evaluate(`(async()=>{await Win11ExplorerPro.permanentlyDeleteVirtual("C:/Downloads","HistMoveV94.txt","file");Win11ExplorerHistory.clear();return true})()`); await wait(50);

await evaluate(`(()=>{const ok=Win11ExplorerPro.renameVirtual("C:/Documents","HistRenameV94.txt","HistRenamedV94.txt","file");if(ok)Win11ExplorerHistory.recordRename({path:"C:/Documents",oldName:"HistRenameV94.txt",newName:"HistRenamedV94.txt",type:"file"});return ok})()`); await wait(50);
await check("Explorer V9.4 rename recorded",async()=>await evaluate(`ensureFolder("C:/Documents")["HistRenamedV94.txt"]==="rename-v94"&&!Object.prototype.hasOwnProperty.call(ensureFolder("C:/Documents"),"HistRenameV94.txt")&&Win11ExplorerHistory.getState().undo.at(-1)?.kind==="rename"`));
await evaluate(`Win11ExplorerHistory.undo()`); await wait(70);
await check("Explorer V9.4 undo rename",async()=>await evaluate(`ensureFolder("C:/Documents")["HistRenameV94.txt"]==="rename-v94"&&!Object.prototype.hasOwnProperty.call(ensureFolder("C:/Documents"),"HistRenamedV94.txt")`));
await evaluate(`Win11ExplorerHistory.redo()`); await wait(70);
await check("Explorer V9.4 redo rename",async()=>await evaluate(`ensureFolder("C:/Documents")["HistRenamedV94.txt"]==="rename-v94"`));
await evaluate(`(async()=>{await Win11ExplorerPro.permanentlyDeleteVirtual("C:/Documents","HistRenamedV94.txt","file");Win11ExplorerHistory.clear();return true})()`); await wait(50);

await evaluate(`(()=>{const trashName=Win11ExplorerPro.moveFileToRecycle("C:/Documents","HistDeleteV94.txt");if(trashName)Win11ExplorerHistory.recordDelete([{path:"C:/Documents",name:"HistDeleteV94.txt",type:"file",trashName}]);globalThis.__v94TrashName=trashName;saveState();return !!trashName})()`); await wait(60);
await check("Explorer V9.4 delete recorded with original name",async()=>await evaluate(`(()=>{const e=ensureFolder("Recycle Bin")[globalThis.__v94TrashName],h=Win11ExplorerHistory.getState();return !Object.prototype.hasOwnProperty.call(ensureFolder("C:/Documents"),"HistDeleteV94.txt")&&e?.originalName==="HistDeleteV94.txt"&&h.undo.at(-1)?.kind==="delete"})()`));
await evaluate(`Win11ExplorerHistory.undo()`); await wait(80);
await check("Explorer V9.4 undo delete restores exact name",async()=>await evaluate(`ensureFolder("C:/Documents")["HistDeleteV94.txt"]==="delete-v94"&&!ensureFolder("Recycle Bin")[globalThis.__v94TrashName]`));
await evaluate(`Win11ExplorerHistory.redo()`); await wait(80);
await check("Explorer V9.4 redo delete",async()=>await evaluate(`(()=>{const h=Win11ExplorerHistory.getState(),x=h.undo.at(-1)?.items?.[0];return !Object.prototype.hasOwnProperty.call(ensureFolder("C:/Documents"),"HistDeleteV94.txt")&&x?.trashName&&ensureFolder("Recycle Bin")[x.trashName]?.originalName==="HistDeleteV94.txt"})()`));
await evaluate(`(async()=>{const h=Win11ExplorerHistory.getState(),x=h.undo.at(-1)?.items?.[0];if(x?.trashName)await Win11ExplorerPro.permanentlyDeleteVirtual("Recycle Bin",x.trashName,"recycle");Win11ExplorerHistory.clear();return true})()`); await wait(50);

await evaluate(`(()=>{state.explorerHistoryV94={undo:Array.from({length:55},(_,i)=>({id:"bound-"+i,at:i,kind:"rename",label:"Mudar nome",undoable:true,items:[{path:"C:/Documents",oldName:"a"+i,newName:"b"+i,type:"file"}]})),redo:[]};saveState();return true})()`);
await check("Explorer V9.4 history bounded to 50",async()=>await evaluate(`Win11ExplorerHistory.getState().undo.length===50&&Win11ExplorerHistory.getState().undo[0].id==="bound-5"`));
await evaluate(`Win11ExplorerHistory.clear();Win11ExplorerHistory.recordTransfer({mode:"copy",items:[{srcPath:"C:/Documents",srcName:"HistReplaceV94.txt",dstPath:"C:/Downloads",dstName:"HistReplaceV94.txt",type:"file"}],reversible:false});true`); await wait(30);
await check("Explorer V9.4 destructive action disabled",async()=>await evaluate(`(()=>{const h=Win11ExplorerHistory.getState(),w=document.querySelector('#window-layer > .window[data-app="explorer"]');return h.undo.length===1&&h.undo[0].undoable===false&&w.querySelector("[data-history-undo-v940]").disabled})()`));
await check("Explorer V9.4 history persists in profile",async()=>await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem("win11-sim-profile-v67:"+Win11SessionManager.activeUserId)||"{}");return p.explorerHistoryV94?.undo?.length===1&&p.explorerHistoryV94.undo[0].undoable===false})()`));
await evaluate(`(()=>{Win11ExplorerHistory.clear();const docs=ensureFolder("C:/Documents"),down=ensureFolder("C:/Downloads"),bin=ensureFolder("Recycle Bin"),names=["HistCopyV94.txt","HistMoveV94.txt","HistRenameV94.txt","HistRenamedV94.txt","HistDeleteV94.txt","HistReplaceV94.txt"];for(const n of names){delete docs[n];delete down[n]}for(const [k,v] of Object.entries(bin))if(names.includes(k)||names.includes(v?.originalName))delete bin[k];delete globalThis.__v94TrashName;Win11SearchV920?.invalidate?.();saveState();return true})()`); await wait(50);
await check("Explorer V9.4 cleanup",async()=>await evaluate(`Win11ExplorerHistory.getState().undo.length===0&&Win11ExplorerHistory.getState().redo.length===0`));

await evaluate(`(()=>{const docs=ensureFolder("C:/Documents"),names=["RecycleMetaV95.txt","RecycleKeepV95.txt","RecycleKeepV95 (2).txt","RecycleSkipAV95.txt","RecycleSkipBV95.txt","RecycleReplaceV95.txt","RecycleAllAV95.txt","RecycleAllBV95.txt","RecycleEmptyAV95.txt","RecycleEmptyBV95.txt"];for(const n of names)delete docs[n];globalThis.__v95OriginalBin=state.files["Recycle Bin"]||{};state.files["Recycle Bin"]={};Win11ExplorerHistory.clear();docs["RecycleMetaV95.txt"]="meta-v95";const trash=Win11ExplorerPro.moveFileToRecycle("C:/Documents","RecycleMetaV95.txt");globalThis.__v95MetaTrash=trash;Win11ExplorerHistory.recordDelete([{path:"C:/Documents",name:"RecycleMetaV95.txt",type:"file",trashName:trash}]);const w=document.querySelector('#window-layer > .window[data-app="explorer"]');w.__explorerNavigationV820.go("Recycle Bin");saveState();return !!trash})()`); await wait(160);
await check("Explorer Recycle V9.5 UI and metadata",async()=>await evaluate(`(()=>{const w=document.querySelector('#window-layer > .window[data-app="explorer"]'),node=[...w.querySelectorAll(".file,.file-row:not(.header)")].find(x=>x.dataset.v740Name===globalThis.__v95MetaTrash),meta=node?.querySelector(".recycle-meta-v950"),banner=w.querySelector(".explorer-recycle-banner-v950"),toolbar=w.querySelector(".explorer-recycle-actions-v950"),s=Win11ExplorerRecycle.getSummary();return !!w.__explorerRecycleV950&&!toolbar.hidden&&!banner.hidden&&s.count===1&&!!node&&!!meta&&meta.textContent.includes("C:/Documents")&&meta.textContent.length>12})()`));
await evaluate(`(()=>{const w=document.querySelector('#window-layer > .window[data-app="explorer"]'),node=[...w.querySelectorAll(".file,.file-row:not(.header)")].find(x=>x.dataset.v740Name===globalThis.__v95MetaTrash);node?.click();return !!node})()`); await wait(50);
await check("Explorer Recycle V9.5 selected restore enabled",async()=>await evaluate(`(()=>{const w=document.querySelector('#window-layer > .window[data-app="explorer"]'),b=w.querySelector("[data-recycle-restore-selected]");return !b.disabled&&w.__explorerRecycleV950.getSelected().includes(globalThis.__v95MetaTrash)})()`));
await evaluate(`document.querySelector('#window-layer > .window[data-app="explorer"]').__explorerRecycleV950.restoreSelected()`); await wait(120);
await check("Explorer Recycle V9.5 manual restore invalidates Undo",async()=>await evaluate(`(()=>{const h=Win11ExplorerHistory.getState(),a=h.undo.at(-1);return ensureFolder("C:/Documents")["RecycleMetaV95.txt"]==="meta-v95"&&!ensureFolder("Recycle Bin")[globalThis.__v95MetaTrash]&&a?.kind==="delete"&&a.undoable===false&&a.reason.includes("restaurado manualmente")})()`));
await evaluate(`delete ensureFolder("C:/Documents")["RecycleMetaV95.txt"];Win11ExplorerHistory.clear();true`);

await evaluate(`(()=>{const docs=ensureFolder("C:/Documents");docs["RecycleKeepV95.txt"]="deleted-keep";const trash=Win11ExplorerPro.moveFileToRecycle("C:/Documents","RecycleKeepV95.txt");docs["RecycleKeepV95.txt"]="existing-keep";globalThis.__v95KeepTrash=trash;const w=document.querySelector('#window-layer > .window[data-app="explorer"]');w.__explorerNavigationV820.go("Recycle Bin");globalThis.__v95KeepPromise=Win11ExplorerRecycle.restoreNames([trash],w);return true})()`); await wait(80);
await check("Explorer Recycle V9.5 conflict dialog",async()=>await evaluate(`(()=>{const h=document.querySelector("#explorer-recycle-conflict-v950.open");return !!h&&!!h.querySelector("[data-recycle-keep]")&&!!h.querySelector("[data-recycle-skip]")&&!!h.querySelector("[data-recycle-replace]")&&!!h.querySelector("[data-recycle-conflict-all]")})()`));
await evaluate(`document.querySelector("#explorer-recycle-conflict-v950 [data-recycle-keep]").click();true`); await wait(120);
await check("Explorer Recycle V9.5 keep both",async()=>await evaluate(`(async()=>{const r=await globalThis.__v95KeepPromise,docs=ensureFolder("C:/Documents");return r.done===1&&r.skipped===0&&docs["RecycleKeepV95.txt"]==="existing-keep"&&docs["RecycleKeepV95 (2).txt"]==="deleted-keep"&&!ensureFolder("Recycle Bin")[globalThis.__v95KeepTrash]})()`));
await evaluate(`(()=>{const d=ensureFolder("C:/Documents");delete d["RecycleKeepV95.txt"];delete d["RecycleKeepV95 (2).txt"];return true})()`);

await evaluate(`(()=>{const docs=ensureFolder("C:/Documents");for(const n of ["RecycleSkipAV95.txt","RecycleSkipBV95.txt"]){docs[n]="deleted-"+n;const t=Win11ExplorerPro.moveFileToRecycle("C:/Documents",n);globalThis[n.includes("A")?"__v95SkipA":"__v95SkipB"]=t;docs[n]="existing-"+n}const w=document.querySelector('#window-layer > .window[data-app="explorer"]');w.__explorerNavigationV820.go("Recycle Bin");globalThis.__v95SkipPromise=Win11ExplorerRecycle.restoreNames([globalThis.__v95SkipA,globalThis.__v95SkipB],w);return true})()`); await wait(80);
await evaluate(`(()=>{const h=document.querySelector("#explorer-recycle-conflict-v950");h.querySelector("[data-recycle-conflict-all]").checked=true;h.querySelector("[data-recycle-skip]").click();return true})()`); await wait(120);
await check("Explorer Recycle V9.5 skip apply-all",async()=>await evaluate(`(async()=>{const r=await globalThis.__v95SkipPromise,b=ensureFolder("Recycle Bin"),d=ensureFolder("C:/Documents");return r.done===0&&r.skipped===2&&!!b[globalThis.__v95SkipA]&&!!b[globalThis.__v95SkipB]&&d["RecycleSkipAV95.txt"].startsWith("existing-")&&d["RecycleSkipBV95.txt"].startsWith("existing-")})()`));
await evaluate(`(async()=>{for(const t of [globalThis.__v95SkipA,globalThis.__v95SkipB])await Win11ExplorerPro.permanentlyDeleteVirtual("Recycle Bin",t,"recycle");const d=ensureFolder("C:/Documents");delete d["RecycleSkipAV95.txt"];delete d["RecycleSkipBV95.txt"];return true})()`); await wait(50);

await evaluate(`(()=>{const docs=ensureFolder("C:/Documents");docs["RecycleReplaceV95.txt"]="deleted-replace";const trash=Win11ExplorerPro.moveFileToRecycle("C:/Documents","RecycleReplaceV95.txt");docs["RecycleReplaceV95.txt"]="existing-replace";globalThis.__v95ReplaceTrash=trash;const w=document.querySelector('#window-layer > .window[data-app="explorer"]');w.__explorerNavigationV820.go("Recycle Bin");globalThis.__v95ReplacePromise=Win11ExplorerRecycle.restoreNames([trash],w);return true})()`); await wait(80);
await evaluate(`document.querySelector("#explorer-recycle-conflict-v950 [data-recycle-replace]").click();true`); await wait(130);
await check("Explorer Recycle V9.5 safe replace",async()=>await evaluate(`(async()=>{const r=await globalThis.__v95ReplacePromise,b=ensureFolder("Recycle Bin"),d=ensureFolder("C:/Documents"),replacement=Object.entries(b).find(([,e])=>e?.originalName==="RecycleReplaceV95.txt"&&e?.content==="existing-replace");globalThis.__v95ReplacementTrash=replacement?.[0]||"";return r.done===1&&r.replaced===1&&d["RecycleReplaceV95.txt"]==="deleted-replace"&&!!replacement&&!b[globalThis.__v95ReplaceTrash]})()`));
await evaluate(`(async()=>{delete ensureFolder("C:/Documents")["RecycleReplaceV95.txt"];if(globalThis.__v95ReplacementTrash)await Win11ExplorerPro.permanentlyDeleteVirtual("Recycle Bin",globalThis.__v95ReplacementTrash,"recycle");return true})()`); await wait(50);

await evaluate(`(()=>{const d=ensureFolder("C:/Documents");for(const n of ["RecycleAllAV95.txt","RecycleAllBV95.txt"]){d[n]="all-"+n;Win11ExplorerPro.moveFileToRecycle("C:/Documents",n)}const w=document.querySelector('#window-layer > .window[data-app="explorer"]');w.__explorerNavigationV820.go("Recycle Bin");return true})()`); await wait(80);
await evaluate(`document.querySelector('#window-layer > .window[data-app="explorer"]').__explorerRecycleV950.restoreAll()`); await wait(130);
await check("Explorer Recycle V9.5 restore all",async()=>await evaluate(`(()=>{const d=ensureFolder("C:/Documents");return d["RecycleAllAV95.txt"]==="all-RecycleAllAV95.txt"&&d["RecycleAllBV95.txt"]==="all-RecycleAllBV95.txt"&&Win11ExplorerRecycle.getSummary().count===0})()`));
await evaluate(`(()=>{const d=ensureFolder("C:/Documents");delete d["RecycleAllAV95.txt"];delete d["RecycleAllBV95.txt"];return true})()`);

await evaluate(`(()=>{const d=ensureFolder("C:/Documents");d["RecycleEmptyAV95.txt"]="empty-a";d["RecycleEmptyBV95.txt"]="empty-b";const a=Win11ExplorerPro.moveFileToRecycle("C:/Documents","RecycleEmptyAV95.txt"),b=Win11ExplorerPro.moveFileToRecycle("C:/Documents","RecycleEmptyBV95.txt");Win11ExplorerHistory.clear();Win11ExplorerHistory.recordDelete([{path:"C:/Documents",name:"RecycleEmptyAV95.txt",type:"file",trashName:a},{path:"C:/Documents",name:"RecycleEmptyBV95.txt",type:"file",trashName:b}]);const w=document.querySelector('#window-layer > .window[data-app="explorer"]');w.__explorerNavigationV820.go("Recycle Bin");return true})()`); await wait(80);
await evaluate(`document.querySelector('#window-layer > .window[data-app="explorer"]').__explorerRecycleV950.confirmEmpty();true`); await wait(50);
await check("Explorer Recycle V9.5 empty confirmation",async()=>await evaluate(`document.querySelector("#system-dialog")?.classList.contains("open")&&document.querySelector("#system-dialog-title")?.textContent==="Esvaziar Reciclagem"&&document.querySelector("#system-dialog-ok")?.textContent==="Esvaziar"`));
await evaluate(`document.querySelector("#system-dialog-ok").click();true`); await wait(160);
await check("Explorer Recycle V9.5 empty invalidates history",async()=>await evaluate(`(()=>{const h=Win11ExplorerHistory.getState(),a=h.undo.at(-1);return Win11ExplorerRecycle.getSummary().count===0&&a?.kind==="delete"&&a.undoable===false&&a.reason.includes("permanentemente")})()`));

await evaluate(`(()=>{Win11ExplorerHistory.clear();const d=ensureFolder("C:/Documents"),names=["RecycleMetaV95.txt","RecycleKeepV95.txt","RecycleKeepV95 (2).txt","RecycleSkipAV95.txt","RecycleSkipBV95.txt","RecycleReplaceV95.txt","RecycleAllAV95.txt","RecycleAllBV95.txt","RecycleEmptyAV95.txt","RecycleEmptyBV95.txt"];for(const n of names)delete d[n];state.files["Recycle Bin"]=globalThis.__v95OriginalBin;const ok=state.files["Recycle Bin"]===globalThis.__v95OriginalBin;for(const k of ["__v95OriginalBin","__v95MetaTrash","__v95KeepTrash","__v95KeepPromise","__v95SkipA","__v95SkipB","__v95SkipPromise","__v95ReplaceTrash","__v95ReplacePromise","__v95ReplacementTrash"])delete globalThis[k];const w=document.querySelector('#window-layer > .window[data-app="explorer"]');w.__explorerNavigationV820.go("C:/Documents");Win11SearchV920?.invalidate?.();saveState();globalThis.__v95CleanupOk=ok;return ok})()`); await wait(100);
await check("Explorer Recycle V9.5 isolated cleanup",async()=>await evaluate(`globalThis.__v95CleanupOk===true&&document.querySelector('#window-layer > .window[data-app="explorer"] .explorer-recycle-actions-v950')?.hidden===true`));
await evaluate(`delete globalThis.__v95CleanupOk;true`);

await evaluate(`(()=>{const docs=ensureFolder("C:/Documents"),down=ensureFolder("C:/Downloads"),names=["VersionV96.txt","VersionMovedV96.txt","VersionLargeV96.txt","VersionDataV96.txt","VersionReplaceV96.txt"];for(const n of names){delete docs[n];delete down[n]}globalThis.__v96OriginalVersions=state.explorerVersionsV96?JSON.parse(JSON.stringify(state.explorerVersionsV96)):null;state.explorerVersionsV96={schemaVersion:1,bindings:{},files:{}};docs["VersionV96.txt"]="v1";Win11ExplorerFilesystem.touch("C:/Documents","VersionV96.txt");saveState();return true})()`);
await check("Explorer Versions V9.6 limits",async()=>await evaluate(`Win11ExplorerVersions.limits.perFile===8&&Win11ExplorerVersions.limits.global===80&&Win11ExplorerVersions.limits.snapshotBytes===131072&&Win11ExplorerVersions.limits.totalBytes===1572864`));
await evaluate(`(()=>{const d=ensureFolder("C:/Documents");globalThis.__v96First=Win11ExplorerVersions.beforeWrite("C:/Documents","VersionV96.txt","v2","Teste antes de guardar");d["VersionV96.txt"]="v2";Win11ExplorerFilesystem.touch("C:/Documents","VersionV96.txt");return true})()`);
await check("Explorer Versions V9.6 captures previous content",async()=>await evaluate(`(()=>{const a=Win11ExplorerVersions.list("C:/Documents","VersionV96.txt");return globalThis.__v96First?.ok===true&&a.length===1&&a[0].reason==="Teste antes de guardar"&&a[0].size===2&&!("content" in a[0])})()`));
await check("Explorer Versions V9.6 deduplicates unchanged save",async()=>await evaluate(`(()=>{const r=Win11ExplorerVersions.beforeWrite("C:/Documents","VersionV96.txt","v2","Duplicado");return r.reason==="unchanged"&&Win11ExplorerVersions.list("C:/Documents","VersionV96.txt").length===1})()`));
await evaluate(`(()=>{const d=ensureFolder("C:/Documents");Win11ExplorerVersions.beforeWrite("C:/Documents","VersionV96.txt","v3","Segunda gravação");d["VersionV96.txt"]="v3";Win11ExplorerFilesystem.touch("C:/Documents","VersionV96.txt");for(let i=4;i<=13;i++){Win11ExplorerVersions.beforeWrite("C:/Documents","VersionV96.txt","v"+i,"Gravação "+i);d["VersionV96.txt"]="v"+i;Win11ExplorerFilesystem.touch("C:/Documents","VersionV96.txt")}return true})()`);
await check("Explorer Versions V9.6 per-file bound",async()=>await evaluate(`Win11ExplorerVersions.list("C:/Documents","VersionV96.txt").length===8`));
await evaluate(`(()=>{const d=ensureFolder("C:/Documents");d["VersionLargeV96.txt"]="x".repeat(131073);d["VersionDataV96.txt"]="data:text/plain;base64,SGVsbG8=";globalThis.__v96Large=Win11ExplorerVersions.capture("C:/Documents","VersionLargeV96.txt",{reason:"large"});globalThis.__v96Data=Win11ExplorerVersions.capture("C:/Documents","VersionDataV96.txt",{reason:"data"});return true})()`);
await check("Explorer Versions V9.6 rejects heavy snapshots",async()=>await evaluate(`globalThis.__v96Large?.reason==="unsupported"&&globalThis.__v96Data?.reason==="unsupported"&&Win11ExplorerVersions.list("C:/Documents","VersionLargeV96.txt").length===0&&Win11ExplorerVersions.list("C:/Documents","VersionDataV96.txt").length===0`));

await evaluate(`(async()=>{const r=await Win11ExplorerPro.copyFileAdvanced("C:/Documents","VersionV96.txt","C:/Downloads",true);globalThis.__v96MoveName=r.name;return r.ok})()`); await wait(50);
await check("Explorer Versions V9.6 follows move",async()=>await evaluate(`Win11ExplorerVersions.list("C:/Documents","VersionV96.txt").length===0&&Win11ExplorerVersions.list("C:/Downloads",globalThis.__v96MoveName).length===8&&ensureFolder("C:/Downloads")[globalThis.__v96MoveName]==="v13"`));
await evaluate(`Win11ExplorerPro.renameVirtual("C:/Downloads",globalThis.__v96MoveName,"VersionMovedV96.txt","file")`); await wait(40);
await check("Explorer Versions V9.6 follows rename",async()=>await evaluate(`Win11ExplorerVersions.list("C:/Downloads",globalThis.__v96MoveName).length===0&&Win11ExplorerVersions.list("C:/Downloads","VersionMovedV96.txt").length===8`));

await evaluate(`(()=>{const t=Win11ExplorerPro.moveFileToRecycle("C:/Downloads","VersionMovedV96.txt");globalThis.__v96Trash=t;return !!t})()`); await wait(40);
await check("Explorer Versions V9.6 detaches in Recycle Bin",async()=>await evaluate(`(()=>{const e=ensureFolder("Recycle Bin")[globalThis.__v96Trash];return Win11ExplorerVersions.list("C:/Downloads","VersionMovedV96.txt").length===0&&!!e?.versionId})()`));
await evaluate(`(()=>{const r=Win11ExplorerPro.restoreRecycleItemAdvanced(globalThis.__v96Trash,"keep");globalThis.__v96RestoreName=r.name;return r.ok})()`); await wait(50);
await check("Explorer Versions V9.6 reattaches after restore",async()=>await evaluate(`Win11ExplorerVersions.list("C:/Downloads",globalThis.__v96RestoreName).length===8&&ensureFolder("C:/Downloads")[globalThis.__v96RestoreName]==="v13"`));

await evaluate(`(()=>{const a=Win11ExplorerVersions.list("C:/Downloads",globalThis.__v96RestoreName),before=ensureFolder("C:/Downloads")[globalThis.__v96RestoreName];globalThis.__v96BeforeRestore=before;globalThis.__v96RestoreResult=Win11ExplorerVersions.restore("C:/Downloads",globalThis.__v96RestoreName,a.at(-1).id);return true})()`); await wait(70);
await check("Explorer Versions V9.6 restores previous version",async()=>await evaluate(`(()=>{const name=globalThis.__v96RestoreName,current=ensureFolder("C:/Downloads")[name],a=Win11ExplorerVersions.list("C:/Downloads",name);return globalThis.__v96RestoreResult?.ok===true&&current!==globalThis.__v96BeforeRestore&&a.length<=8&&a.some(v=>v.reason==="Antes de restaurar versão")})()`));

await evaluate(`(()=>{const w=document.querySelector('#window-layer > .window[data-app="explorer"]'),wrap=w.querySelector(".explorer-navigation-v820");wrap.__explorerNavigationV820.go("C:/Downloads");wrap.__explorerProV740.forceRender();return true})()`); await wait(130);
await evaluate(`(()=>{const w=document.querySelector('#window-layer > .window[data-app="explorer"]'),node=[...w.querySelectorAll(".file,.file-row:not(.header)")].find(x=>x.dataset.v740Name===globalThis.__v96RestoreName);node?.click();w.querySelector("[data-properties-v740]")?.click();return !!node})()`); await wait(80);
await check("Explorer Versions V9.6 appears in Properties",async()=>await evaluate(`document.querySelector("#system-dialog")?.classList.contains("open")&&document.querySelector("#system-dialog-body")?.textContent.includes("Versões anteriores")&&!!document.querySelector("#system-dialog-body [data-open-versions-v960]")`));
await evaluate(`document.querySelector("#system-dialog-body [data-open-versions-v960]")?.click();true`); await wait(50);
await check("Explorer Versions V9.6 history dialog",async()=>await evaluate(`document.querySelector("#system-dialog-title")?.textContent==="Versões anteriores"&&document.querySelectorAll("#system-dialog-body .version-row-v960").length>=1&&!!document.querySelector("#system-dialog-body [data-version-restore]")`));
await evaluate(`document.querySelector("#system-dialog-x")?.click();true`);

await evaluate(`(async()=>{const docs=ensureFolder("C:/Documents"),down=ensureFolder("C:/Downloads");docs["VersionReplaceV96.txt"]="replacement-new";down["VersionReplaceV96.txt"]="replacement-old";const w=document.querySelector('#window-layer > .window[data-app="explorer"]'),wrap=w.querySelector(".explorer-navigation-v820");globalThis.__v96Replace=await wrap.__explorerOperationsV900.transfer([{path:"C:/Documents",name:"VersionReplaceV96.txt",type:"file"}],"C:/Downloads","copy",{conflictPolicy:"replace"});return true})()`); await wait(100);
await check("Explorer Versions V9.6 snapshots Replace conflict",async()=>await evaluate(`(()=>{const a=Win11ExplorerVersions.list("C:/Downloads","VersionReplaceV96.txt");return globalThis.__v96Replace?.ok===true&&ensureFolder("C:/Downloads")["VersionReplaceV96.txt"]==="replacement-new"&&a.length===1&&a[0].reason==="Antes de substituir"})()`));
await evaluate(`(()=>{const a=Win11ExplorerVersions.list("C:/Downloads","VersionReplaceV96.txt");return Win11ExplorerVersions.restore("C:/Downloads","VersionReplaceV96.txt",a[0].id).ok})()`); await wait(60);
await check("Explorer Versions V9.6 restores pre-replace content",async()=>await evaluate(`ensureFolder("C:/Downloads")["VersionReplaceV96.txt"]==="replacement-old"`));

await evaluate(`(()=>{state.explorerVersionsV96={schemaVersion:1,bindings:{},files:{}};const d=ensureFolder("C:/Documents");for(let f=0;f<11;f++){const name="VersionBoundV96-"+f+".txt";d[name]="0";for(let i=1;i<=8;i++){Win11ExplorerVersions.beforeWrite("C:/Documents",name,String(i),"bound");d[name]=String(i)}}const total=Object.values(state.explorerVersionsV96.files).reduce((n,r)=>n+(r.versions?.length||0),0);globalThis.__v96GlobalCount=total;return true})()`);
await check("Explorer Versions V9.6 global snapshot bound",async()=>await evaluate(`globalThis.__v96GlobalCount<=80`));

await evaluate(`(async()=>{const docs=ensureFolder("C:/Documents"),down=ensureFolder("C:/Downloads");for(let f=0;f<11;f++){const n="VersionBoundV96-"+f+".txt";if(Object.prototype.hasOwnProperty.call(docs,n))await Win11ExplorerPro.permanentlyDeleteVirtual("C:/Documents",n,"file")}for(const [path,n] of [["C:/Documents","VersionLargeV96.txt"],["C:/Documents","VersionDataV96.txt"],["C:/Documents","VersionReplaceV96.txt"],["C:/Downloads","VersionReplaceV96.txt"],["C:/Downloads",globalThis.__v96RestoreName]])if(n&&Object.prototype.hasOwnProperty.call(ensureFolder(path),n))await Win11ExplorerPro.permanentlyDeleteVirtual(path,n,"file");if(globalThis.__v96OriginalVersions)state.explorerVersionsV96=globalThis.__v96OriginalVersions;else delete state.explorerVersionsV96;for(const k of Object.keys(globalThis).filter(k=>k.startsWith("__v96")))delete globalThis[k];saveState();return true})()`); await wait(60);
await check("Explorer Versions V9.6 isolated cleanup",async()=>await evaluate(`!Object.keys(ensureFolder("C:/Documents")).some(n=>n.startsWith("VersionBoundV96-"))&&!Object.prototype.hasOwnProperty.call(ensureFolder("C:/Downloads"),"VersionReplaceV96.txt")`));

await check("Start Search V8.1 bridge",async()=>await evaluate(`Win11StartSearch?.version==="8.1.0" && typeof Win11StartSearch.collect==="function" && typeof Win11StartSearch.pin==="function" && typeof Win11StartSearch.reorderPinned==="function"`));
await check("Search V9.2 bridge",async()=>await evaluate(`Win11SearchV920?.version==="9.2.0" && typeof Win11SearchV920.collect==="function" && typeof Win11SearchV920.parse==="function" && typeof Win11SearchV920.suggestions==="function"`));
await check("Start V8.1 default pinned state",async()=>await evaluate(`Array.isArray(state.startSearchV81?.pinned) && state.startSearchV81.pinned.length>=10 && state.startSearchV81.pinned.every(id=>!!APPS[id])`));
await evaluate(`globalThis.__v81PinsBefore=state.startSearchV81.pinned.slice();true`);
await evaluate(`Win11StartSearch.unpin("paint");true`); await wait(50);
await check("Start V8.1 unpin persists per profile",async()=>await evaluate(`!state.startSearchV81.pinned.includes("paint") && !JSON.parse(localStorage.getItem("win11-sim-profile-v67:"+Win11SessionManager.activeUserId)).startSearchV81.pinned.includes("paint")`));
await check("Start V8.1 pin isolated from user two",async()=>await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem("win11-sim-profile-v67:"+${JSON.stringify(user2.id)})||"{}");return p.startSearchV81?.pinned?.includes("paint")!==false})()`));
await evaluate(`(()=>{const a=state.startSearchV81.pinned;if(a.length<2)return false;globalThis.__v81A=a[0];globalThis.__v81B=a[1];Win11StartSearch.reorderPinned(__v81A,__v81B);return true})()`); await wait(50);
await check("Start V8.1 drag-order engine",async()=>await evaluate(`state.startSearchV81.pinned[0]===__v81B && state.startSearchV81.pinned[1]===__v81A`));
await evaluate(`state.startSearchV81.pinned=__v81PinsBefore.slice();saveState();Win11StartSearch.renderStart(false);true`); await wait(60);
await check("Start V8.1 pinned UI",async()=>await evaluate(`document.querySelectorAll("#start-grid .start-app-v81").length===state.startSearchV81.pinned.length && document.querySelectorAll("#start-grid .start-app-v81 svg").length>=6`));
await evaluate(`Win11StartSearch.renderStart(true);true`); await wait(60);
await check("Start V8.1 All Apps alphabetical UI",async()=>await evaluate(`document.querySelectorAll("#start-grid .start-allapp-v81").length===Object.keys(APPS).length && document.querySelectorAll("#start-grid .allapps-letter-v81").length>=5 && document.querySelector("#start-menu .section-head h3")?.textContent==="Todas as aplicações"`));
await evaluate(`Win11StartSearch.renderStart(false);true`); await wait(50);
await evaluate(`(()=>{ensureFolder("C:/Documents")["PesquisaV81.txt"]="conteúdo exclusivo nebulosa quântica zebra";ensureFolder("C:/Documents")["SearchV92Big.txt"]="searchv92 payload "+"x".repeat(4096);ensureFolder("C:/Documents")["SearchV92Image.png"]="data:image/png;base64,iVBORw0KGgo=";ensureFolder("C:/Documents/SearchV92Folder")["inside.txt"]="searchv92 folder content";Win11ExplorerFilesystem.touch("C:/Documents","SearchV92Big.txt",{modified:Date.now()});Win11ExplorerFilesystem.touch("C:/Documents","PesquisaV81.txt",{modified:Date.now()-45*86400000});saveState();return true})()`);
await check("Search V8.1 finds virtual file content",async()=>await evaluate(`Win11StartSearch.collect("nebulosa quantica zebra").some(r=>r.type==="file"&&r.name==="PesquisaV81.txt")`));
await check("Search V8.1 ignores accents",async()=>await evaluate(`Win11StartSearch.collect("personalizacao").some(r=>r.type==="setting"&&r.name==="Personalização")`));
await check("Search V8.1 categorizes apps settings files",async()=>await evaluate(`(()=>{const a=Win11StartSearch.collect("a");const types=new Set(a.map(x=>x.type));return types.has("app")&&types.has("setting")&&types.has("file")})()`));
await check("Search V9.2 parses filters",async()=>await evaluate(`(()=>{const p=Win11SearchV920.parse('type:image ext:png size:>1KB modified:week in:Documents hidden:false termo');return p.text==="termo"&&p.filters.type==="image"&&p.filters.ext==="png"&&p.filters.size===">1KB"&&p.filters.modified==="week"&&p.filters.path==="Documents"&&p.filters.hidden==="false"})()`));
await check("Search V9.2 finds folders",async()=>await evaluate(`Win11SearchV920.collect("type:folder SearchV92Folder").some(r=>r.kind==="folder"&&r.name==="SearchV92Folder"&&r.path==="C:/Documents")`));
await check("Search V9.2 image and extension filters",async()=>await evaluate(`(()=>{const a=Win11SearchV920.collect("type:image ext:png SearchV92Image");return a.length===1&&a[0].name==="SearchV92Image.png"&&a[0].kind==="image"})()`));
await check("Search V9.2 size filter",async()=>await evaluate(`Win11SearchV920.collect("size:>1KB SearchV92Big").some(r=>r.name==="SearchV92Big.txt"&&r.size>1024)`));
await check("Search V9.2 modified today filter",async()=>await evaluate(`Win11SearchV920.collect("modified:today SearchV92Big").some(r=>r.name==="SearchV92Big.txt")`));
await check("Search V9.2 modified older filter",async()=>await evaluate(`Win11SearchV920.collect("modified:older nebulosa").some(r=>r.name==="PesquisaV81.txt")`));
await check("Search V9.2 path filter",async()=>await evaluate(`Win11SearchV920.collect("in:Documents SearchV92Big").some(r=>r.name==="SearchV92Big.txt"&&r.path==="C:/Documents")`));
await check("Search V9.2 cached index",async()=>await evaluate(`(()=>{Win11SearchV920.rebuild();const a=Win11SearchV920.indexVersion;Win11SearchV920.collect("SearchV92");Win11SearchV920.collect("SearchV92Big");return Win11SearchV920.indexVersion===a&&Win11SearchV920.indexSize>0})()`));
await check("Search V9.2 index invalidation",async()=>await evaluate(`(()=>{const before=Win11SearchV920.indexVersion;Win11ExplorerFilesystem.touch("C:/Documents","SearchV92Big.txt",{modified:Date.now()-1000});Win11SearchV920.collect("SearchV92Big");return Win11SearchV920.indexVersion>before})()`));
await check("Search V9.2 suggestions",async()=>await evaluate(`(()=>{const s=Win11SearchV920.suggestions("");return s.includes("type:folder")&&s.includes("type:image")&&s.includes("modified:today")})()`));
await evaluate(`Win11StartSearch.openSearch("type:image in:Documents SearchV92Image");true`); await wait(90);
await check("Search V9.2 controls and chips",async()=>await evaluate(`(()=>{const c=document.querySelector("#search-results .search-controls-v920"),chips=[...document.querySelectorAll("#search-results .search-active-filters-v920 button")].map(x=>x.textContent),quick=[...document.querySelectorAll("#search-results .search-quick-filters-v920 button")].map(x=>x.textContent);return !!c&&chips.some(x=>x.includes("Tipo: image"))&&chips.some(x=>x.includes("Local: Documents"))&&quick.includes("Pastas")&&quick.includes("Imagens")})()`));
await check("Search V9.2 filtered UI result",async()=>await evaluate(`document.querySelector("#search-results .search-result-v81.active strong")?.textContent==="SearchV92Image.png"`));
await evaluate(`Win11StartSearch.openSearch("personalizacao");true`); await wait(80);
await check("Search V8.1 layout and preview",async()=>await evaluate(`document.querySelector("#search-panel").classList.contains("open") && !!document.querySelector("#search-results .search-layout-v81") && !!document.querySelector("#search-results .search-preview-v81") && !!document.querySelector("#search-results .search-preview-actions-v81 .primary")`));
await check("Search V8.1 best result is setting",async()=>await evaluate(`document.querySelector("#search-results .search-result-v81.active")?.dataset.type==="setting"`));
await evaluate(`(()=>{const input=document.querySelector("#global-search");input.value="a";input.dispatchEvent(new Event("input",{bubbles:true}));return true})()`); await wait(60);
await evaluate(`document.querySelector("#global-search").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true}));true`); await wait(40);
await check("Search V8.1 keyboard navigation",async()=>await evaluate(`document.querySelector('#search-results .search-result-v81[data-search-index="1"]')?.classList.contains("active")`));
await evaluate(`closeOverlays();document.querySelector("#start-btn").click();true`); await wait(50);
await evaluate(`(()=>{const i=document.querySelector("#start-search");i.value="bloco";i.dispatchEvent(new Event("input",{bubbles:true}));return true})()`); await wait(50);
await check("Start V8.1 inline search",async()=>await evaluate(`!document.querySelector("#start-search-results-v81").hidden && document.querySelectorAll("#start-search-results-v81 .start-search-result-v81").length>=1 && document.querySelector("#start-grid").hidden`));
await evaluate(`(()=>{const i=document.querySelector("#start-search");i.value="";i.dispatchEvent(new Event("input",{bubbles:true}));closeOverlays();return true})()`); await wait(40);
await evaluate(`openApp("calc");renderRecommended();true`); await wait(70);
await check("Start V8.1 recent app tracking",async()=>await evaluate(`state.startSearchV81.recentApps[0]==="calc" && [...document.querySelectorAll("#recommended-list .recommended-v81 strong")].some(x=>x.textContent===APPS.calc.name)`));
await evaluate(`openApp("explorer","C:/Documents");true`); await wait(100);
await evaluate(`(()=>{const b=document.querySelector('.task-btn.running[data-app="explorer"][data-window]');if(!b)return false;const r=b.getBoundingClientRect();b.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:r.left+5,clientY:r.top+5}));return true})()`); await wait(60);
await check("Taskbar V8.1 Explorer jump list",async()=>await evaluate(`(()=>{const m=document.querySelector("#context-menu.open");const t=m?.textContent||"";return t.includes("Documentos")&&t.includes("Ambiente de Trabalho")&&t.includes("Imagens")&&(t.includes("Afixar no Iniciar")||t.includes("Remover do Iniciar"))})()`));
await evaluate(`(()=>{document.querySelector("#context-menu")?.classList.remove("open");for(const n of ["PesquisaV81.txt","SearchV92Big.txt","SearchV92Image.png"]){delete ensureFolder("C:/Documents")[n];Win11ExplorerFilesystem.onDelete({path:"C:/Documents",name:n,type:"file"})}delete state.files["C:/Documents/SearchV92Folder"];Win11ExplorerFilesystem.onDelete({path:"C:/Documents",name:"SearchV92Folder",type:"folder"});Win11SearchV920.invalidate();saveState();return true})()`);

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
await check("Edge Internet bridge",async()=>await evaluate(`Win11EdgeInternet?.version==="8.1.2"`));
await evaluate(`document.querySelector('.window[data-app="edge"] [data-home]').click();true`); await wait(100);
await check("Edge Web shortcuts",async()=>await evaluate(`document.querySelectorAll('.window[data-app="edge"] [data-edge-shortcut]').length===4`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="google.com";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(160);
await check("Edge Google home iframe",async()=>await evaluate(`(()=>{const f=document.querySelector('.window[data-app="edge"] .edge-tab-frame');if(!f)return false;const u=new URL(f.src);return u.hostname.endsWith("google.com")&&u.pathname==="/webhp"&&u.searchParams.get("igu")==="1"&&u.searchParams.get("newwindow")==="1"})()`));
await check("Edge Google iframe configured cross-origin",async()=>await evaluate(`(()=>{const f=document.querySelector('.window[data-app="edge"] .edge-tab-frame');if(!f)return false;const u=new URL(f.src);const s=f.getAttribute("sandbox")||"";return u.origin!==location.origin&&u.hostname.endsWith("google.com")&&u.searchParams.get("igu")==="1"&&u.searchParams.get("newwindow")==="1"&&s.includes("allow-popups")&&s.includes("allow-popups-to-escape-sandbox")&&!s.includes("allow-top-navigation")})()`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="Windows 11";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(160);
await check("Edge Google search",async()=>await evaluate(`(()=>{const f=document.querySelector('.window[data-app="edge"] .edge-tab-frame');if(!f)return false;const u=new URL(f.src);return u.hostname.endsWith("google.com")&&u.pathname==="/search"&&u.searchParams.get("igu")==="1"&&u.searchParams.get("newwindow")==="1"&&u.searchParams.get("q")?.includes("Windows")})()`));
await check("Edge Google external fallback",async()=>await evaluate(`(()=>{const u=new URL(Win11EdgeInternet.externalUrlFor("https://www.google.com/search?igu=1&newwindow=1&q=Windows+11"));return u.hostname==="www.google.com"&&!u.searchParams.has("igu")&&u.searchParams.get("newwindow")==="1"&&u.searchParams.get("q")==="Windows 11"})()`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="ouvirmusica.com.br";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(220);
await check("Edge Ouvir Música navigation",async()=>await evaluate(`document.querySelector('.window[data-app="edge"] .edge-tab-frame')?.src==="https://www.ouvirmusica.com.br/"`));
await check("Edge Ouvir Música iframe configured cross-origin",async()=>await evaluate(`(()=>{const f=document.querySelector('.window[data-app="edge"] .edge-tab-frame');if(!f)return false;const u=new URL(f.src);return u.origin!==location.origin && u.hostname==="www.ouvirmusica.com.br"})()`));
await check("Edge Ouvir Música iframe sandboxed",async()=>await evaluate(`(()=>{const f=document.querySelector('.window[data-app="edge"] .edge-tab-frame');const s=f?.getAttribute("sandbox")||"";return s.includes("allow-scripts")&&s.includes("allow-same-origin")&&s.includes("allow-popups")&&!s.includes("allow-top-navigation")})()`));
await check("Edge Ouvir Música audio permission",async()=>await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-tab-frame')?.getAttribute("allow")||"";return a.includes("autoplay")&&a.includes("encrypted-media")})()`));
await check("Edge Ouvir Música tab title",async()=>await evaluate(`state.edgeBrowser?.tabs?.some(t=>t.url==="https://www.ouvirmusica.com.br/"&&t.title==="Ouvir Música")`));
await check("Edge Ouvir Música external URL",async()=>await evaluate(`Win11EdgeInternet.externalUrlFor("edge://ouvirmusica")==="https://www.ouvirmusica.com.br/"`));
await check("Edge legacy YouTube route migrates",async()=>await evaluate(`Win11EdgeInternet.normalize("edge://youtube/watch?v=M7lc1UVf-VE")==="https://www.ouvirmusica.com.br/"`));
await check("Edge YouTube no privileged player",async()=>await evaluate(`Win11EdgeInternet.normalize("https://www.youtube.com/watch?v=M7lc1UVf-VE")==="https://www.youtube.com/watch?v=M7lc1UVf-VE" && Win11EdgeInternet.knownFrameBlocker("https://www.youtube.com/watch?v=M7lc1UVf-VE")`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="https://x.com/";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(100);
await check("Edge blocked-site compatibility page",async()=>await evaluate(`!!document.querySelector('.window[data-app="edge"] .edge-compat-page [data-compat-open]')`));
await check("Edge Advanced bridge",async()=>await evaluate(`Win11EdgeAdvanced?.version==="8.1.2"`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="edge"]');focusWindow(w);w.querySelector("[data-favorite]").click();return true})()`); await wait(80);
await check("Edge favorite stored",async()=>await evaluate(`state.edgeBrowser?.favorites?.some(f=>f.url==="https://x.com/") && document.querySelectorAll('.window[data-app="edge"] .edge-favorite-chip').length>=1`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="edge://favorites";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(90);
await check("Edge Favorites page",async()=>await evaluate(`!!document.querySelector('.window[data-app="edge"] .edge-favorites-page') && document.querySelectorAll('.window[data-app="edge"] .edge-internal-row').length>=1`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="edge://history";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(90);
await check("Edge History page",async()=>await evaluate(`!!document.querySelector('.window[data-app="edge"] .edge-history-page') && state.edgeBrowser?.history?.length>=5`));
await evaluate(`Win11EdgeAdvanced.recordDownload({name:"audit-edge.txt",url:location.origin+"/README.md",status:"completed",size:12});(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="edge://downloads";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(90);
await check("Edge Downloads page",async()=>await evaluate(`!!document.querySelector('.window[data-app="edge"] .edge-downloads-page') && document.querySelector('.window[data-app="edge"] .edge-download-row')?.textContent.includes("audit-edge.txt")`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="edge://settings";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`); await wait(90);
await check("Edge Settings page",async()=>await evaluate(`!!document.querySelector('.window[data-app="edge"] .edge-settings-page [data-setting-restore]') && !!document.querySelector('.window[data-app="edge"] [data-setting-favbar]')`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="edge"]');focusWindow(w);globalThis.__edgeTabsBeforeShortcut=w.querySelectorAll(".edge-real-tab").length;document.dispatchEvent(new KeyboardEvent("keydown",{key:"t",ctrlKey:true,bubbles:true}));return true})()`); await wait(80);
await check("Edge Ctrl+T",async()=>await evaluate(`document.querySelectorAll('.window[data-app="edge"] .edge-real-tab').length===__edgeTabsBeforeShortcut+1`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="edge"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"l",ctrlKey:true,bubbles:true}));return true})()`);
await check("Edge Ctrl+L",async()=>await evaluate(`document.activeElement===document.querySelector('.window[data-app="edge"] .edge-real-address')`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="edge"]');focusWindow(w);globalThis.__edgeActiveBeforeTab=state.edgeBrowser.activeId;document.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",ctrlKey:true,bubbles:true}));return true})()`); await wait(60);
await check("Edge Ctrl+Tab",async()=>await evaluate(`state.edgeBrowser.activeId!==__edgeActiveBeforeTab`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="edge"]');focusWindow(w);globalThis.__edgeTabsBeforeClose=w.querySelectorAll(".edge-real-tab").length;document.dispatchEvent(new KeyboardEvent("keydown",{key:"w",ctrlKey:true,bubbles:true}));return true})()`); await wait(60);
await check("Edge Ctrl+W",async()=>await evaluate(`document.querySelectorAll('.window[data-app="edge"] .edge-real-tab').length===__edgeTabsBeforeClose-1`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="edge"]');focusWindow(w);document.dispatchEvent(new KeyboardEvent("keydown",{key:"T",ctrlKey:true,shiftKey:true,bubbles:true}));return true})()`); await wait(70);
await check("Edge Ctrl+Shift+T",async()=>await evaluate(`document.querySelectorAll('.window[data-app="edge"] .edge-real-tab').length===__edgeTabsBeforeClose`));
await evaluate(`(()=>{const tab=document.querySelector('.window[data-app="edge"] .edge-real-tab.active');tab.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,clientX:160,clientY:80}));return true})()`); await wait(40);
await check("Edge tab context menu",async()=>await evaluate(`[...document.querySelectorAll("#context-menu button")].some(b=>b.textContent.includes("Fixar separador")) && [...document.querySelectorAll("#context-menu button")].some(b=>b.textContent.includes("Duplicar"))`));
await evaluate(`(()=>{const b=[...document.querySelectorAll("#context-menu button")].find(x=>x.textContent.includes("Fixar separador"));b?.click();return true})()`); await wait(60);
await check("Edge pinned tab",async()=>await evaluate(`state.edgeBrowser.tabs.some(t=>t.id===state.edgeBrowser.activeId&&t.pinned)`));
await evaluate(`Win11EdgeAdvanced.toggleFavorite("https://example.com/edge-user1","Edge User One");saveState();true`);
await check("Edge data written to user one profile",async()=>await evaluate(`JSON.parse(localStorage.getItem("win11-sim-profile-v67:"+Win11SessionManager.activeUserId)).edgeBrowser.favorites.some(f=>f.url==="https://example.com/edge-user1")`));
await evaluate(`Win11SessionManager.signOut();true`);
await check("Edge login second account for isolation",async()=>await uiLogin(user2.id,"5678"));
await evaluate(`openApp("edge");true`); await wait(220);
await check("Edge state isolated from user two",async()=>await evaluate(`!state.edgeBrowser?.favorites?.some(f=>f.url==="https://example.com/edge-user1") && ![...document.querySelectorAll('.window[data-app="edge"] .edge-favorite-chip')].some(x=>x.textContent.includes("Edge User One"))`));
await evaluate(`Win11SessionManager.signOut();true`);
await check("Edge login first account after isolation",async()=>await uiLogin(user1Id,"2468"));
await evaluate(`openApp("edge");true`); await wait(260);
await check("Edge user one data restored",async()=>await evaluate(`state.edgeBrowser?.favorites?.some(f=>f.url==="https://example.com/edge-user1") && document.querySelectorAll('.window[data-app="edge"] .edge-real-tab').length>=2`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="edge://history";document.querySelector('.window[data-app="edge"] [data-go]').click();globalThis.__edgePersistedTabCount=state.edgeBrowser.tabs.length;return true})()`); await wait(70);
await check("Edge tabs queued for persistence",async()=>await evaluate(`state.edgeBrowser.tabs.length===__edgePersistedTabCount && state.edgeBrowser.tabs.some(t=>t.url==="edge://history")`));

await evaluate(`openApp("taskmanager");true`);
await wait(250);
await check("Task Manager modern shell",async()=>await evaluate(`!!document.querySelector('.window[data-app="taskmanager"] .tm-real')`));
await check("Task Manager process rows",async()=>await evaluate(`document.querySelectorAll('.window[data-app="taskmanager"] [data-process]').length>=2`));

await evaluate(`openApp("settings");true`);
await wait(250);
await check("Settings realism header",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] .settings-real-top')`));
await check("Power button uses CSS symbol",async()=>await evaluate(`(()=>{const b=document.querySelector("#power-btn");const s=b?.querySelector(".power-symbol-v781");return !!b&&!!s&&b.textContent.trim()===""&&b.getAttribute("aria-label")==="Energia"&&getComputedStyle(s).borderTopColor==="rgba(0, 0, 0, 0)"})()`));
await evaluate(`(()=>{const b=document.querySelector("#power-btn");b.click();return true})()`); await wait(80);
await check("Power menu still exposes shutdown action",async()=>await evaluate(`(()=>{const m=document.querySelector(".context-menu.open");const t=m?.textContent||"";return t.includes("Encerrar")&&t.includes("Reiniciar")&&t.includes("Suspender")&&t.includes("Bloquear")})()`));
await evaluate(`document.querySelector(".context-menu.open")?.classList.remove("open");true`);
await evaluate(`(()=>{state.settingsPage="accounts";const settingsWin=document.querySelector('.window[data-app="settings"]');if(settingsWin){settingsWin.querySelector(".win-body").innerHTML="";settingsWin.querySelector(".win-body").appendChild(renderApp("settings",settingsWin));}return true})()`);
await wait(150);
await check("Settings local accounts card",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-session-accounts-card]')`));
await check("Settings profile management controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-profile-avatar]') && !!document.querySelector('.window[data-app="settings"] [data-profile-pin]') && !!document.querySelector('.window[data-app="settings"] [data-profile-export]') && !!document.querySelector('.window[data-app="settings"] [data-profile-restore]') && !!document.querySelector('.window[data-app="settings"] [data-profile-autolock]')`));
await evaluate(`(()=>{state.settingsPage="apps";const w=document.querySelector('.window[data-app="settings"]');if(w){w.querySelector(".win-body").innerHTML="";w.querySelector(".win-body").appendChild(renderApp("settings",w));}return true})()`); await wait(140);
await check("Settings Default Apps UI",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-default-apps-v700]') && document.querySelector('.window[data-app="settings"] [data-default-ext=".png"]')?.querySelectorAll("option").length>=2`));
await evaluate(`(()=>{state.settingsPage="network";const w=document.querySelector('.window[data-app="settings"]');if(w){w.querySelector(".win-body").innerHTML="";w.querySelector(".win-body").appendChild(renderApp("settings",w));}return true})()`); await wait(140);
await check("Settings real network disclosure",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-real-network-card]') && document.querySelector('.window[data-app="settings"] [data-real-network-card]')?.textContent.includes("redes Wi‑Fi listadas abaixo pertencem à simulação")`));

await check("Personalization V9.8.2 bridge",async()=>await evaluate(`Win11Personalization?.version==="9.8.2" && Win11Personalization.legacyVersion==="8.1.0" && Win11Personalization.wallpaperCount===8 && Win11Personalization.accents.length===8 && Win11Personalization.wallpapers.length===8`));
await evaluate(`(()=>{globalThis.__personalV982Before=Win11SettingsStore.exportConfig();state.settingsPage="personalization";const w=document.querySelector('.window[data-app="settings"]');if(w){w.querySelector(".win-body").innerHTML="";w.querySelector(".win-body").appendChild(renderApp("settings",w));}return true})()`); await wait(120);
await check("Personalization V9.8.2 Settings Core UI",async()=>await evaluate(`document.querySelectorAll('.window[data-app="settings"] [data-theme-v982]').length===3 && document.querySelectorAll('.window[data-app="settings"] [data-accent-v982]').length===8 && document.querySelectorAll('.window[data-app="settings"] [data-wallpaper-v982]').length===8 && !!document.querySelector('.window[data-app="settings"] .settings-core-badge-v982') && !!document.querySelector('.window[data-app="settings"] [data-scale-v982]')`));
await check("Settings Core category snapshots",async()=>await evaluate(`Win11SettingsStore.get("appearance").themeMode===Win11SettingsStore.get("appearance.themeMode") && typeof Win11SettingsStore.get("taskbar").showBadges==="boolean"`));
await check("System theme preference through Settings Store",async()=>await evaluate(`Win11Personalization.set("themeMode","system") && Win11SettingsStore.get("appearance.themeMode")==="system" && state.personalizationV78.themeMode==="system"`));
await check("Dark theme application through Settings Store",async()=>await evaluate(`Win11Personalization.set("themeMode","dark") && Win11SettingsStore.get("appearance.themeMode")==="dark" && document.querySelector("#app").classList.contains("theme-dark")`));
await check("Accent color application through Settings Store",async()=>await evaluate(`Win11Personalization.set("accent","#8764b8") && Win11SettingsStore.get("appearance.accent")==="#8764b8" && getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()==="#8764b8"`));
await check("Taskbar alignment through Settings Store",async()=>await evaluate(`Win11Personalization.set("taskbarAlignment","left") && Win11SettingsStore.get("taskbar.alignment")==="left" && document.querySelector("#app").classList.contains("taskbar-left-v78")`));
await check("Transparency through Settings Store",async()=>await evaluate(`Win11Personalization.set("transparency",false) && Win11SettingsStore.get("appearance.transparency")===false && document.querySelector("#app").classList.contains("no-transparency-v78")`));
await check("Animations through Settings Store",async()=>await evaluate(`Win11Personalization.set("animations",false) && Win11SettingsStore.get("appearance.animations")===false && document.querySelector("#app").classList.contains("no-animations-v78")`));
await check("Extended wallpaper through Settings Store",async()=>await evaluate(`Win11Personalization.set("wallpaperIndex",5) && Win11SettingsStore.get("appearance.wallpaperIndex")===5 && state.personalizationV78.wallpaperIndex===5 && document.querySelector("#app").style.background.includes("gradient")`));
await evaluate(`(()=>{const s=document.querySelector('.window[data-app="settings"] [data-scale-v982]');s.value="125";s.dispatchEvent(new Event("input",{bubbles:true}));globalThis.__v982ScalePreview=document.querySelector("#app").style.fontSize;s.dispatchEvent(new Event("change",{bubbles:true}));return true})()`); await wait(50);
await check("Personalization V9.8.2 scale preview and commit",async()=>await evaluate(`__v982ScalePreview==="20px" && Win11SettingsStore.get("accessibility.textScale")===125 && state.accessibility.textScale===125 && document.querySelector("#app").style.fontSize==="20px"`));
await evaluate(`(()=>{globalThis.__v982TaskWins=[openAppNewWindow("notepad"),openAppNewWindow("notepad")].map(w=>w.dataset.id);Win11SettingsStore.set("taskbar.groupWindows","never",{source:"browser-audit-v982"});Win11TaskbarWindowPro.refresh();return true})()`); await wait(70);
await check("Taskbar V9.8.2 never-group setting",async()=>await evaluate(`!document.querySelector('#task-center .taskbar-group-lead-v970[data-taskbar-group-app="notepad"]') && !document.querySelector("#task-center .taskbar-group-hidden-v970")`));
await evaluate(`(()=>{Win11SettingsStore.update("taskbar",{groupWindows:"when-multiple",showBadges:false},{source:"browser-audit-v982"});Win11TaskbarWindowPro.refresh();return true})()`); await wait(70);
await check("Taskbar V9.8.2 grouping without badges",async()=>await evaluate(`(()=>{const lead=document.querySelector('#task-center .taskbar-group-lead-v970[data-taskbar-group-app="notepad"]');return !!lead&&!lead.querySelector(".taskbar-group-badge-v970")})()`));
await evaluate(`(()=>{Win11SettingsStore.set("taskbar.showBadges",true,{source:"browser-audit-v982"});Win11SettingsStore.set("taskbar.previews",false,{source:"browser-audit-v982"});Win11TaskbarWindowPro.refresh();document.querySelector('#task-center .taskbar-group-lead-v970[data-taskbar-group-app="notepad"]')?.click();return true})()`); await wait(80);
await check("Taskbar V9.8.2 badge and disabled previews",async()=>await evaluate(`(()=>{const lead=document.querySelector('#task-center .taskbar-group-lead-v970[data-taskbar-group-app="notepad"]'),panel=document.querySelector("#taskbar-group-v970");return !!lead?.querySelector(".taskbar-group-badge-v970")&&panel?.classList.contains("open")&&panel.querySelectorAll(".taskbar-group-preview-disabled-v982").length>=2&&!panel.querySelector(".taskbar-group-preview-clone-v970")})()`));
await evaluate(`(()=>{document.querySelector("#taskbar-group-v970")?.classList.remove("open");Win11SettingsStore.set("taskbar.showProgress",false,{source:"browser-audit-v982"});const existing=document.querySelector('#window-layer > .window[data-app="explorer"]'),w=existing||openAppNewWindow("explorer","C:/Documents");globalThis.__v982ProgressWindow=w.dataset.id;globalThis.__v982CreatedExplorer=!existing;w.dispatchEvent(new CustomEvent("explorer-operation-progress-v970",{detail:{id:"v982-progress",status:"running",percent:44,paused:false}}));return true})()`); await wait(40);
await check("Taskbar V9.8.2 progress setting disables indicator",async()=>await evaluate(`(()=>{const b=document.querySelector('#task-center .task-btn[data-window="'+CSS.escape(__v982ProgressWindow)+'"]');return !!b&&!b.classList.contains("task-progress-v970")&&!b.hasAttribute("data-task-progress")})()`));
await evaluate(`(()=>{for(const id of globalThis.__v982TaskWins||[]){const w=document.querySelector('#window-layer > .window[data-id="'+CSS.escape(id)+'"]');if(w)closeWindow(w)}if(globalThis.__v982CreatedExplorer){const w=document.querySelector('#window-layer > .window[data-id="'+CSS.escape(__v982ProgressWindow)+'"]');if(w)closeWindow(w)}Win11SettingsStore.importConfig(__personalV982Before,{source:"browser-audit-v982-cleanup"});Win11TaskbarWindowPro.refresh();Win11ExplorerMultiWindow?.refreshTaskbar?.();for(const k of ["__personalV982Before","__v982ScalePreview","__v982TaskWins","__v982ProgressWindow","__v982CreatedExplorer"])delete globalThis[k];return true})()`); await wait(100);
await check("Personalization V9.8.2 cleanup restores profile",async()=>await evaluate(`document.querySelector("#app").dataset.settingsIntegration==="9.8.2"`));
await evaluate(`(()=>{globalThis.__v982AccessBefore=Win11SettingsStore.get("accessibility");state.settingsPage="accessibility";const w=document.querySelector('.window[data-app="settings"]');if(w){w.querySelector(".win-body").innerHTML="";w.querySelector(".win-body").appendChild(renderApp("settings",w));}return true})()`); await wait(100);
await check("Accessibility V9.8.2 Store-backed UI",async()=>await evaluate(`(()=>{const box=document.querySelector('.window[data-app="settings"] [data-settings-page]');return !!box?.querySelector("[data-textscale]")&&!box.hasAttribute("data-settings-personalization-v982")&&!box.querySelector(".settings-core-badge-v982")})()`));
await evaluate(`(()=>{const s=document.querySelector('.window[data-app="settings"] [data-textscale]'),target=__v982AccessBefore.textScale===130?135:130;globalThis.__v982AccessTarget=target;s.value=String(target);s.dispatchEvent(new Event("input",{bubbles:true}));return true})()`); await wait(70);
await check("Accessibility V9.8.2 persists scale without page regression",async()=>await evaluate(`Win11SettingsStore.get("accessibility.textScale")===__v982AccessTarget&&state.accessibility.textScale===__v982AccessTarget&&document.querySelector("#app").style.fontSize===(__v982AccessTarget/100*16)+"px"&&!!document.querySelector('.window[data-app="settings"] [data-textscale]')&&!document.querySelector('.window[data-app="settings"] .settings-core-badge-v982')`));
await evaluate(`(()=>{Win11SettingsStore.update("accessibility",__v982AccessBefore,{source:"browser-audit-v982-access-cleanup"});delete globalThis.__v982AccessBefore;delete globalThis.__v982AccessTarget;return true})()`); await wait(60);
await evaluate(`(()=>{globalThis.__v982BackupsBefore=structuredClone(state.backups||[]);globalThis.__v982BackupSettingsBefore=Win11SettingsStore.exportConfig();openApp("backup");return true})()`); await wait(120);
await evaluate(`(()=>{document.querySelector('.window[data-app="backup"] [data-backup-now]')?.click();return true})()`); await wait(80);
await check("Backup V9.8.2 stores Settings export",async()=>await evaluate(`state.backups?.[0]?.data?.settingsConfig?.kind==="win11-simulator-settings"&&state.backups[0].data.settingsConfig.schemaVersion===1`));
await evaluate(`(()=>{const original=__v982BackupSettingsBefore.data.appearance.accent,alt=original==="#8764b8"?"#0078d4":"#8764b8";Win11SettingsStore.set("appearance.accent",alt,{source:"browser-audit-v982-backup"});document.querySelector('.window[data-app="backup"] [data-restore-backup="0"]')?.click();return true})()`); await wait(60);
await evaluate(`document.querySelector("#system-dialog-ok")?.click();true`); await wait(120);
await check("Backup V9.8.2 restores Settings Store",async()=>await evaluate(`Win11SettingsStore.get("appearance.accent")===__v982BackupSettingsBefore.data.appearance.accent`));
await evaluate(`(()=>{state.backups=__v982BackupsBefore;Win11SettingsStore.importConfig(__v982BackupSettingsBefore,{source:"browser-audit-v982-backup-cleanup"});const w=document.querySelector('.window[data-app="backup"]');if(w)closeWindow(w);saveState();delete globalThis.__v982BackupsBefore;delete globalThis.__v982BackupSettingsBefore;return true})()`); await wait(80);
await evaluate(`(()=>{state.settingsPage="privacy";const w=document.querySelector('.window[data-app="settings"]');if(w){w.querySelector(".win-body").innerHTML="";w.querySelector(".win-body").appendChild(renderApp("settings",w));}return true})()`); await wait(100);
await check("Privacy Security V7.8 settings UI",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-open-security-v78]') && document.querySelector('.window[data-app="settings"] [data-open-security-v78]')?.textContent.includes("não ao Windows anfitrião")`));

await check("Security Center V7.8 bridge",async()=>await evaluate(`Win11SecurityCenter?.version==="8.1.0" && typeof Win11SecurityCenter.runScan==="function" && typeof Win11SecurityCenter.healthScore==="function"`));
await evaluate(`openApp("security");true`); await wait(140);
await check("Windows Security V7.8 shell",async()=>await evaluate(`document.querySelectorAll('.window[data-app="security"] .security-nav-v78 [data-security-page]').length===8 && !!document.querySelector('.window[data-app="security"] .security-health-score-v78')`));
await check("Security health score baseline",async()=>await evaluate(`Win11SecurityCenter.healthScore()===100`));
await check("Harmless test item creation",async()=>await evaluate(`Win11SecurityCenter.createTestItem() && String(state.files["C:/Downloads"]["Security-Test-Item.txt"]).includes("WIN11_SIMULATOR_TEST_THREAT")`));
await check("Quick virtual scan detects test item",async()=>await evaluate(`(async()=>{const r=await Win11SecurityCenter.runScan("quick");globalThis.__securityScanV78=r;return r.ok&&r.detections===1&&r.filesChecked>=1&&Win11SecurityCenter.activeThreats().length===1})()`));
await check("Security scan history persisted",async()=>await evaluate(`Win11SecurityCenter.scanHistory().some(x=>x.id===__securityScanV78.id&&x.type==="quick"&&x.detections===1)`));
await check("Security notification integration",async()=>await evaluate(`state.notifications.some(n=>n.source==="Segurança do Windows"&&String(n.message).includes("item(ns) de teste detetado"))`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="security"]');w?.querySelector('[data-security-page="virus"]')?.click();return true})()`); await wait(80);
await check("Security active threat UI",async()=>await evaluate(`!!document.querySelector('.window[data-app="security"] [data-threat-remove]') && document.querySelector('.window[data-app="security"] .security-main-v78')?.textContent.includes("Security-Test-Item.txt")`));
await check("Threat removal is virtual-only",async()=>await evaluate(`(()=>{const t=Win11SecurityCenter.activeThreats()[0];return !!t&&Win11SecurityCenter.resolveThreat(t.id,"remove")&&!state.files["C:/Downloads"]["Security-Test-Item.txt"]&&Win11SecurityCenter.activeThreats().length===0})()`));
await check("Protection history records resolution",async()=>await evaluate(`Win11SecurityCenter.protectionHistory().some(x=>x.status==="removed"&&x.path==="C:/Downloads/Security-Test-Item.txt")`));
await check("Firewall profile affects health score",async()=>await evaluate(`(()=>{const before=Win11SecurityCenter.healthScore();Win11SecurityCenter.setFirewall("public",false);const reduced=Win11SecurityCenter.healthScore();Win11SecurityCenter.setFirewall("public",true);return before===100&&reduced<before&&state.securityV78.firewall.public===true})()`));
await check("Security host boundary disclosure",async()=>await evaluate(`(()=>{document.querySelector('.window[data-app="security"] [data-security-page="performance"]')?.click();const text=document.querySelector('.window[data-app="security"] .security-main-v78')?.textContent||"";return text.includes("não lê antivírus")&&text.includes("Windows anfitrião")})()`));
await evaluate(`openApp("notepad");true`);
await wait(220);
await evaluate(`document.querySelector('.window[data-app="notepad"] [data-saveas]').click();true`);
await wait(120);
await check("Save dialog",async()=>await evaluate(`document.querySelector("#system-dialog").classList.contains("open") && !!document.querySelector("[data-dialog-name]")`));
await evaluate(`document.querySelector("[data-dialog-name]").value="AuditFile";document.querySelector("#system-dialog-ok").click();true`);
await wait(120);
await check("Save extension .txt",async()=>await evaluate(`Object.prototype.hasOwnProperty.call(state.files["C:/Documents"],"AuditFile.txt")`));
await evaluate(`delete state.files["C:/Documents"]["AuditFile.txt"];saveState();true`);

await check("Real file bridge available",async()=>await evaluate(`typeof RealFileBridge==="object" && RealFileBridge.version==="8.1.0"`));
await check("Notepad real file controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="notepad"] [data-open-device]') && !!document.querySelector('.window[data-app="notepad"] [data-save-device]')`));
await check("Real file handle write path",async()=>await evaluate(`(async()=>{const test={text:null,closed:false};const handle={name:"audit.txt",async createWritable(){return {async write(v){test.text=v},async close(){test.closed=true}}}};await RealFileBridge.writeHandle(handle,"conteúdo real");return test.text==="conteúdo real"&&test.closed})()`));
await check("Real functions Personalization V9.8.2 marker",async()=>await evaluate(`Win11RealFunctions?.step===32 && Win11RealFunctions.features.includes("explorer-multi-window") && Win11RealFunctions.features.includes("explorer-undo") && Win11RealFunctions.features.includes("taskbar-app-groups") && Win11RealFunctions.features.includes("system-integration-bus") && Win11RealFunctions.features.includes("settings-profile-store") && Win11RealFunctions.features.includes("settings-personalization-store") && Win11RealFunctions.features.includes("settings-taskbar-controls") && Win11RealFunctions.features.includes("settings-ui-scale")`));

await check("Real clipboard bridge available",async()=>await evaluate(`typeof RealClipboardBridge==="object" && RealClipboardBridge.version==="8.1.0"`));
await check("Notepad real clipboard controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="notepad"] [data-copy-device]') && !!document.querySelector('.window[data-app="notepad"] [data-paste-device]')`));
await evaluate(`closeOverlays();toggleOverlay("clipboard");renderClipboard();true`);
await wait(120);
await check("Win+V real clipboard controls",async()=>await evaluate(`!!document.querySelector("#clipboard-list [data-real-clip-read]") && !!document.querySelector("#clipboard-list [data-real-clip-write]")`));
await check("Manual paste fallback",async()=>await evaluate(`(async()=>{const p=RealClipboardBridge.manualPasteDialog();await new Promise(r=>setTimeout(r,30));const box=document.querySelector("[data-real-paste-box]");if(!box)return false;box.value="clipboard audit";document.querySelector("#system-dialog-ok").click();return (await p)==="clipboard audit"})()`));
await evaluate(`closeOverlays();true`);

await check("Real content bridge available",async()=>await evaluate(`typeof RealContentBridge==="object" && RealContentBridge.version==="8.1.0"`));
await check("IndexedDB import and cleanup",async()=>await evaluate(`(async()=>{const imported=await RealContentBridge.importFileToVirtual(new File(["conteúdo indexeddb"],"browser-audit-real.txt",{type:"text/plain"}),"C:/Documents");const rec=await RealContentBridge.getRecord(imported.ref);const ok=rec&&await rec.blob.text()==="conteúdo indexeddb"&&rec.ownerId===Win11SessionManager.activeUserId;delete state.files["C:/Documents"][imported.name];saveState();await RealContentBridge.cleanupVirtualValue(imported.ref);const gone=!(await RealContentBridge.getRecord(imported.ref));return !!ok&&gone})()`));
await check("Real folder import preserves subfolders",async()=>await evaluate(`(async()=>{const f=new File(["subfile"],"one.txt",{type:"text/plain"});Object.defineProperty(f,"_relativePath",{value:"Sub/one.txt"});const result=await RealContentBridge.importDirectoryToVirtual({name:"AuditFolder",files:[f]},"C:/Downloads");const ref=state.files[result.root+"/Sub"]?.["one.txt"];const ok=!!ref?.__realBlobId;await RealContentBridge.cleanupVirtualFolder(result.root);Object.keys(state.files).filter(p=>p===result.root||p.startsWith(result.root+"/")).forEach(p=>delete state.files[p]);saveState();return ok})()`));
await evaluate(`openApp("explorer","C:/Documents");true`); await wait(180);
await check("Explorer real content controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"] [data-import-files]') && !!document.querySelector('.window[data-app="explorer"] [data-import-folder]') && !!document.querySelector('.window[data-app="explorer"] [data-export-file]')`));

await evaluate(`globalThis.RealPhotosPending={name:"audit.svg",blob:new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>'],{type:"image/svg+xml"})};openApp("photos");true`);
await wait(160);
await check("Photos real viewer",async()=>await evaluate(`!!document.querySelector('.window[data-app="photos"] [data-open-real-photo]') && document.querySelector('.window[data-app="photos"] .real-photo-viewer img')?.src.startsWith("blob:")`));

await evaluate(`globalThis.RealMediaPending={name:"audit.wav",blob:new Blob([new Uint8Array([82,73,70,70,36,0,0,0,87,65,86,69,102,109,116,32,16,0,0,0,1,0,1,0,64,31,0,0,128,62,0,0,2,0,16,0,100,97,116,97,0,0,0,0])],{type:"audio/wav"}),type:"audio/wav"};openApp("mediaplayer");true`);
await wait(160);
await check("Media Player real media",async()=>await evaluate(`!!document.querySelector('.window[data-app="mediaplayer"] [data-open-media]') && !!document.querySelector('.window[data-app="mediaplayer"] audio')`));

await check("Real platform bridge available",async()=>await evaluate(`typeof RealPlatformBridge==="object" && RealPlatformBridge.version==="8.1.0"`));
await evaluate(`renderNotifications();true`);
await wait(80);
await check("Real notification controls",async()=>await evaluate(`!!document.querySelector("#notification-list .real-notify-strip-v77 [data-real-notify]") && typeof RealPlatformBridge?.requestNotificationPermission==="function"`));
await check("PWA manifest link",async()=>await evaluate(`document.querySelector('link[rel="manifest"]')?.getAttribute("href").includes("manifest.webmanifest")`));
await check("PWA service worker registration",async()=>await evaluate(`(async()=>{if(!("serviceWorker" in navigator))return false;for(let i=0;i<20;i++){const r=await navigator.serviceWorker.getRegistration();if(r)return true;await new Promise(x=>setTimeout(x,100))}return false})()`));
await check("PWA cache populated",async()=>await evaluate(`(async()=>{for(let i=0;i<25;i++){const keys=await caches.keys();if(keys.includes("win11-simulator-v9.8.2"))return true;await new Promise(x=>setTimeout(x,100))}return false})()`));
await evaluate(`(()=>{state.settingsPage="system";const settingsWin=document.querySelector('.window[data-app="settings"]');if(settingsWin){settingsWin.querySelector(".win-body").innerHTML="";settingsWin.querySelector(".win-body").appendChild(renderApp("settings",settingsWin));}return true})()`);
await wait(140);
await check("PWA settings card",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-pwa-card] [data-install-pwa]')`));
await check("Windows Experience V8.0 bridge",async()=>await evaluate(`Win11Experience?.version==="8.1.0" && typeof Win11Experience.revealSignIn==="function" && typeof Win11Experience.recoverShell==="function"`));
await check("Update Coordinator V8.0 bridge",async()=>await evaluate(`Win11UpdateCoordinator?.version==="8.1.0" && typeof Win11UpdateCoordinator.checkForUpdate==="function" && typeof Win11UpdateCoordinator.activateUpdate==="function"`));
await check("Windows Update V8.0 settings card",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-update-card-v800] [data-check-update-v800]')`));
await evaluate(`Win11UpdateCoordinator.showPrompt();true`); await wait(70);
await check("V8 update banner opens",async()=>await evaluate(`document.querySelector("#update-banner-v800")?.classList.contains("open") && document.querySelector("#update-banner-v800")?.textContent.includes("Nova versão disponível") && !!document.querySelector("#update-banner-v800 [data-update-now-v800]")`));
await evaluate(`document.querySelector("#update-banner-v800 [data-update-later-v800]")?.click();true`); await wait(50);
await check("V8 update banner can defer",async()=>await evaluate(`!document.querySelector("#update-banner-v800")?.classList.contains("open")`));
await check("V8 update check is callable",async()=>await evaluate(`(async()=>{const r=await Win11UpdateCoordinator.checkForUpdate();return r&&r.supported===true&&["checking","current","available","error"].includes(Win11UpdateCoordinator.state)})()`));
await check("V8 shell recovery callable",async()=>await evaluate(`Win11Experience.recoverShell()===true`));
await check("Real device bridge available",async()=>await evaluate(`typeof RealDeviceBridge==="object" && RealDeviceBridge.version==="8.1.0"`));
await check("Real device diagnostics",async()=>await evaluate(`(async()=>{const i=await RealDeviceBridge.getDeviceInfo();return typeof i.online==="boolean"&&i.storage&&typeof i.secureContext==="boolean"})()`));
await check("Real device settings card",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-real-device-settings]') && !!document.querySelector('.window[data-app="settings"] [data-persist-storage]') && !!document.querySelector('.window[data-app="settings"] [data-wake-lock]')`));
await check("Device Center bridge available",async()=>await evaluate(`Win11DeviceCenter?.version==="8.1.0" && typeof Win11DeviceCenter.collectSnapshot==="function" && typeof Win11DeviceCenter.buildReport==="function"`));
await check("Device Center snapshot shape",async()=>await evaluate(`(async()=>{const s=await Win11DeviceCenter.collectSnapshot();globalThis.__device760=s;return typeof s.online==="boolean"&&!!s.hardware&&!!s.screen&&!!s.storage&&!!s.capabilities&&Array.isArray(s.permissions)&&s.permissions.length===6})()`));
await check("Device Center permission states",async()=>await evaluate(`__device760.permissions.every(p=>["granted","denied","prompt","unsupported","unknown"].includes(p.state))`));
await check("Device Center storage shape",async()=>await evaluate(`Object.prototype.hasOwnProperty.call(__device760.storage,"usage")&&Object.prototype.hasOwnProperty.call(__device760.storage,"quota")&&Object.prototype.hasOwnProperty.call(__device760.storage,"persisted")`));
await check("Device Center taskbar status",async()=>await evaluate(`!!document.querySelector("#device-center-btn [data-device-net]")`));
await check("Device Center Quick Settings V7.9 integration",async()=>await evaluate(`!!document.querySelector("#quick-panel [data-open-device-v79]") && !!document.querySelector("#quick-panel [data-battery-detail-v79]") && !document.querySelector("#quick-panel [data-device-center-v760]")`));
await check("Device Center Settings integration",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-device-center-settings-v760] [data-open-device-center]')`));
await evaluate(`Win11DeviceCenter.open();true`); await wait(260);
await check("Device Center panel opens",async()=>await evaluate(`document.querySelector("#device-center-v760").classList.contains("open") && document.querySelectorAll("#device-center-v760 .device-summary-card").length===4`));
await check("Device Center capability matrix",async()=>await evaluate(`document.querySelectorAll("#device-center-v760 .device-cap").length>=10`));
await check("Device Center permission UI",async()=>await evaluate(`document.querySelectorAll("#device-center-v760 .device-permission-row").length===6 && document.querySelectorAll("#device-center-v760 [data-request-permission]").length===4`));
await check("Device Center control actions",async()=>await evaluate(`!!document.querySelector("#device-center-v760 [data-persist]") && !!document.querySelector("#device-center-v760 [data-wake]") && !!document.querySelector("#device-center-v760 [data-fullscreen]")`));
await check("Device diagnostic report sanitized",async()=>await evaluate(`(async()=>{const r=await Win11DeviceCenter.buildReport();const text=JSON.stringify(r).toLowerCase();return r.schema==="win11-simulator-device-report-v1"&&r.version==="8.1.0"&&!text.includes("latitude")&&!text.includes("longitude")&&!text.includes("clipboardtext")&&!text.includes("clipboardcontent")&&!text.includes("password")&&!text.includes("credential")&&!text.includes("\\"pin\\"")})()`));
await evaluate(`Win11DeviceCenter.close();openApp("systeminfo");true`); await wait(180);
await check("System Information V7.6 diagnostic tab",async()=>await evaluate(`!!document.querySelector('.window[data-app="systeminfo"] [data-device-center-info-v760]')`));
await evaluate(`document.querySelector('.window[data-app="systeminfo"] [data-device-center-info-v760]')?.click();true`); await wait(220);
await check("System Information V7.6 diagnostic content",async()=>await evaluate(`document.querySelector('.window[data-app="systeminfo"] .info-main')?.textContent.includes("Diagnóstico V7.6") && !!document.querySelector('.window[data-app="systeminfo"] .device-systeminfo-summary')`));
await evaluate(`(()=>{const w=document.querySelector('.window[data-app="systeminfo"]');if(w)closeWindow(w);return true})()`); await wait(60);
await check("Notification Center V7.7 bridge",async()=>await evaluate(`Win11NotificationCenter?.version==="8.1.0" && Win11BackgroundEngine?.version==="8.1.0"`));
await evaluate(`(()=>{Win11NotificationCenter.setFocusMode("off");state.notificationCenterV77.quietUntil=0;state.notifications=state.notifications.filter(n=>!String(n.source||"").startsWith("Audit V77"));saveState();renderNotifications();return true})()`);
await evaluate(`(()=>{globalThis.__auditNotifId=Win11NotificationCenter.push("Audit V77","Notificação rica de teste",{source:"Audit V77",appId:"notepad",priority:"high",real:false,actions:[{label:"Abrir Bloco de Notas",type:"open-app",appId:"notepad"}]});return true})()`); await wait(80);
await check("Rich notification stored",async()=>await evaluate(`(()=>{const n=Win11NotificationCenter.active().find(x=>x.id===__auditNotifId);return !!n&&n.source==="Audit V77"&&n.priority==="high"&&n.actions?.length===1&&!n.read})()`));
await check("Unread notification badge",async()=>await evaluate(`(()=>{const b=document.querySelector("#notify-btn .notification-badge-v77");return !!b&&!b.hidden&&Number(state.notificationCenterV77.unread)>=1})()`));
await evaluate(`toggleOverlay("notifications");renderNotifications();true`); await wait(100);
await check("Grouped Action Center UI",async()=>await evaluate(`document.querySelector("#notification-panel").classList.contains("open") && [...document.querySelectorAll(".notification-group-v77>header strong")].some(x=>x.textContent==="Audit V77") && !!document.querySelector('[data-notification-id="'+__auditNotifId+'"] [data-notification-action]')`));
await check("Notification Settings card",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-notification-settings-v77]')`));
await evaluate(`(()=>{globalThis.__auditSnoozeId=Win11NotificationCenter.push("Audit V77 Snooze","Adiar",{source:"Audit V77 Snooze",real:false});Win11NotificationCenter.snooze(__auditSnoozeId,15);return true})()`);
await check("Notification snooze hides active item",async()=>await evaluate(`!Win11NotificationCenter.active().some(x=>x.id===__auditSnoozeId) && state.notifications.find(x=>x.id===__auditSnoozeId)?.snoozedUntil>Date.now()`));
await evaluate(`Win11NotificationCenter.setFocusMode("priority");globalThis.__auditNormalId=Win11NotificationCenter.push("Audit V77 Normal","Sem banner",{source:"Audit V77 Normal",priority:"normal",real:false});true`); await wait(80);
await check("Do Not Disturb suppresses normal banner",async()=>await evaluate(`Win11NotificationCenter.active().some(x=>x.id===__auditNormalId) && !document.querySelector('.notification-toast-v77[data-notification-id="'+__auditNormalId+'"]')`));
await evaluate(`globalThis.__auditHighId=Win11NotificationCenter.push("Audit V77 Priority","Com banner",{source:"Audit V77 Priority",priority:"high",real:false});true`); await wait(80);
await check("Priority notification bypasses Do Not Disturb",async()=>await evaluate(`!!document.querySelector('.notification-toast-v77[data-notification-id="'+__auditHighId+'"]')`));
await evaluate(`Win11NotificationCenter.setFocusMode("off");const r=Win11NotificationCenter.ruleFor("Audit V77 Muted");r.enabled=false;globalThis.__auditMuted=Win11NotificationCenter.push("Audit V77 Muted","Não deve entrar",{source:"Audit V77 Muted",real:false});saveState();true`);
await check("Per-source notification rule blocks source",async()=>await evaluate(`__auditMuted===null && !state.notifications.some(n=>n.source==="Audit V77 Muted")`));
await evaluate(`Win11NotificationCenter.runAction(__auditNotifId,0);true`); await wait(80);
await check("Notification action opens application",async()=>await evaluate(`!!document.querySelector('.window[data-app="notepad"]:not(.hidden)')`));
await evaluate(`closeOverlays();openApp("services");true`); await wait(160);
await check("Services V7.7 UI",async()=>await evaluate(`!!document.querySelector('.window[data-app="services"] .services-v77')`));
await evaluate(`(()=>{globalThis.__auditBits=state.services.find(s=>s.name==="BITS");globalThis.__auditBitsBefore={status:__auditBits.status,pid:__auditBits.pid,restarts:__auditBits.restarts};return Win11BackgroundEngine.changeService("BITS","start")})()`); await wait(60);
await check("Service runtime start and Event Log",async()=>await evaluate(`__auditBits.status==="Running" && __auditBits.pid>0 && state.events.some(e=>e.source==="Service Control Manager"&&String(e.message).includes("Background Intelligent Transfer Service"))`));
await evaluate(`Win11BackgroundEngine.changeService("BITS","stop");true`);
await check("Service runtime stop",async()=>await evaluate(`__auditBits.status==="Stopped" && __auditBits.pid===0`));
await evaluate(`openApp("taskscheduler");true`); await wait(160);
await check("Task Scheduler V7.7 UI",async()=>await evaluate(`!!document.querySelector('.window[data-app="taskscheduler"] .scheduler-v77 [data-engine-state]') && !!document.querySelector('.window[data-app="taskscheduler"] .background-history-v77')`));
await check("Background engine executes due task",async()=>await evaluate(`(async()=>{state.backgroundActivityV77.enabled=true;const t={id:"task-v77-audit",name:"V77 Audit Background Task",folder:"\\\\FantaMK",enabled:true,status:"Ready",lastRun:0,lastResult:"Nunca executada",runCount:0,intervalMinutes:30,action:"notification",nextRun:Date.now()-10};state.scheduledTasks.push(t);saveState();const ran=await Win11BackgroundEngine.tick();globalThis.__auditTask=t;return ran>=1&&t.runCount===1&&t.lastRun>0&&t.nextRun>Date.now()&&Win11BackgroundEngine.history.some(r=>r.taskId===t.id)})()`));
await check("Background task creates integrated notification",async()=>await evaluate(`state.notifications.some(n=>n.source==="Agendador de Tarefas"&&n.message.includes("V77 Audit Background Task"))`));
await evaluate(`(()=>{state.scheduledTasks=state.scheduledTasks.filter(t=>t.id!=="task-v77-audit");state.notifications=state.notifications.filter(n=>!String(n.source||"").startsWith("Audit V77")&&!String(n.message||"").includes("V77 Audit Background Task")&&n.replaceKey!=="service:BITS");state.notificationHistoryV77=state.notificationHistoryV77.filter(n=>!String(n.source||"").startsWith("Audit V77")&&!String(n.message||"").includes("V77 Audit Background Task"));delete state.notificationCenterV77.appRules["Audit V77 Muted"];state.notificationCenterV77.focusMode="off";state.notificationCenterV77.quietUntil=0;const s=document.querySelector('.window[data-app="services"]');if(s)closeWindow(s);const t=document.querySelector('.window[data-app="taskscheduler"]');if(t)closeWindow(t);saveState();renderNotifications();return true})()`); await wait(80);
await evaluate(`globalThis.__auditMusicBefore=Object.keys(ensureFolder("C:/Music"));openApp("soundrecorder");true`); await wait(160);
await check("Sound Recorder real controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="soundrecorder"] [data-rec-toggle]') && !!document.querySelector('.window[data-app="soundrecorder"] [data-rec-audio]')`));
await evaluate(`document.querySelector('.window[data-app="soundrecorder"] [data-rec-toggle]').click();true`);
await check("Sound Recorder receives microphone stream",async()=>await waitFor(async()=>await evaluate(`document.querySelector('.window[data-app="soundrecorder"] [data-mic-state]')?.textContent==="A gravar"`),5000,100));
await wait(900);
await evaluate(`document.querySelector('.window[data-app="soundrecorder"] [data-rec-toggle]').click();true`);
await check("Sound Recorder saves real audio",async()=>await waitFor(async()=>await evaluate(`(()=>{const before=new Set(__auditMusicBefore);const names=Object.keys(ensureFolder("C:/Music"));const n=names.find(x=>!before.has(x));if(!n)return false;globalThis.__auditRecording=n;const v=ensureFolder("C:/Music")[n];return !!v?.__realBlobId&&document.querySelector('.window[data-app="soundrecorder"] [data-mic-state]')?.textContent==="Guardado"})()`),7000,120));
await evaluate(`(async()=>{if(globalThis.__auditRecording){const f=ensureFolder("C:/Music"),v=f[globalThis.__auditRecording];await RealContentBridge.cleanupVirtualValue(v);delete f[globalThis.__auditRecording];saveState()}return true})()`);
await evaluate(`globalThis.__auditPicsBefore=Object.keys(ensureFolder("C:/Pictures"));openApp("camera");true`); await wait(160);
await check("Camera real controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="camera"] [data-camera-start]') && !!document.querySelector('.window[data-app="camera"] [data-camera-shot]')`));
await evaluate(`document.querySelector('.window[data-app="camera"] [data-camera-start]').click();true`);
await check("Camera receives video stream",async()=>await waitFor(async()=>await evaluate(`(()=>{const v=document.querySelector('.window[data-app="camera"] [data-camera-video]');return !!v?.srcObject&&v.srcObject.getVideoTracks().some(t=>t.readyState==="live")&&v.videoWidth>0})()`),6000,120));
await check("System Tray camera privacy indicator",async()=>await waitFor(async()=>await evaluate(`(()=>{const p=document.querySelector("#privacy-indicator-v79");return !!p&&!p.hidden&&p.textContent.includes("Câmara")})()`),3500,120));
await evaluate(`document.querySelector('.window[data-app="camera"] [data-camera-shot]').click();true`);
await check("Camera saves real photo",async()=>await waitFor(async()=>await evaluate(`(()=>{const before=new Set(__auditPicsBefore);const names=Object.keys(ensureFolder("C:/Pictures"));const n=names.find(x=>!before.has(x));if(!n)return false;globalThis.__auditCameraPhoto=n;return !!ensureFolder("C:/Pictures")[n]?.__realBlobId})()`),5000,120));
await evaluate(`document.querySelector('.window[data-app="camera"] [data-camera-stop]').click();true`);
await evaluate(`(async()=>{if(globalThis.__auditCameraPhoto){const f=ensureFolder("C:/Pictures"),v=f[globalThis.__auditCameraPhoto];await RealContentBridge.cleanupVirtualValue(v);delete f[globalThis.__auditCameraPhoto];saveState()}return true})()`);
await evaluate(`(()=>{const md=navigator.mediaDevices;globalThis.__auditOriginalDisplay=md.getDisplayMedia;Object.defineProperty(md,"getDisplayMedia",{configurable:true,value:()=>md.getUserMedia({video:true,audio:false})});globalThis.__auditSnipBefore=Object.keys(ensureFolder("C:/Pictures"));openApp("snipping");return true})()`); await wait(140);
await evaluate(`document.querySelector('.window[data-app="snipping"] [data-capture-real]').click();true`);
await check("Snipping real capture path",async()=>await waitFor(async()=>await evaluate(`document.querySelector('.window[data-app="snipping"] [data-snip-state]')?.textContent==="Captura real"`),5000,120));
await evaluate(`document.querySelector('.window[data-app="snipping"] [data-save]').click();true`);
await check("Snipping saves captured image",async()=>await waitFor(async()=>await evaluate(`(()=>{const before=new Set(__auditSnipBefore);const names=Object.keys(ensureFolder("C:/Pictures"));const n=names.find(x=>!before.has(x));if(!n)return false;globalThis.__auditSnipPhoto=n;return !!ensureFolder("C:/Pictures")[n]?.__realBlobId})()`),5000,120));
await evaluate(`(async()=>{const md=navigator.mediaDevices;try{if(globalThis.__auditOriginalDisplay)Object.defineProperty(md,"getDisplayMedia",{configurable:true,value:globalThis.__auditOriginalDisplay});else delete md.getDisplayMedia}catch{};if(globalThis.__auditSnipPhoto){const f=ensureFolder("C:/Pictures"),v=f[globalThis.__auditSnipPhoto];await RealContentBridge.cleanupVirtualValue(v);delete f[globalThis.__auditSnipPhoto];saveState()}return true})()`);
await evaluate(`openApp("systeminfo");true`); await wait(140);
await evaluate(`document.querySelector('.window[data-app="systeminfo"] [data-real-device-info]')?.click();true`); await wait(300);
await check("System Information real device page",async()=>await evaluate(`document.querySelector('.window[data-app="systeminfo"] .info-main')?.textContent.includes("Estado da rede") && document.querySelector('.window[data-app="systeminfo"] .info-main')?.textContent.includes("Armazenamento")`));

await send("Emulation.setDeviceMetricsOverride",{width:412,height:915,deviceScaleFactor:2,mobile:true});
await wait(180);
await evaluate(`closeOverlays();toggleOverlay("start");true`);
await wait(160);
await check("Mobile start inside viewport",async()=>await evaluate(`(()=>{const r=document.querySelector("#start-menu").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})()`));
await evaluate(`closeOverlays();Win11SystemTray.toggleQuick();true`); await wait(80);
await check("Mobile Quick Settings V7.9 inside viewport",async()=>await evaluate(`(()=>{const r=document.querySelector("#quick-panel").getBoundingClientRect();return document.querySelector("#quick-panel").classList.contains("open")&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})()`));
await check("Mobile Quick Settings V7.9 two-column tiles",async()=>await evaluate(`getComputedStyle(document.querySelector("#quick-panel .quick-grid-v79")).gridTemplateColumns.split(" ").length===2`));
await evaluate(`closeOverlays();true`);
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
await check("Edge session state survives refresh",async()=>await evaluate(`state.edgeBrowser?.tabs?.length>=2 && state.edgeBrowser.tabs.some(t=>t.url==="edge://history") && state.edgeBrowser.favorites.some(f=>f.url==="https://example.com/edge-user1")`));
await evaluate(`openApp("edge");true`); await wait(260);
await check("Edge tabs restored after refresh",async()=>await evaluate(`document.querySelectorAll('.window[data-app="edge"] .edge-real-tab').length===state.edgeBrowser.tabs.length && state.edgeBrowser.tabs.length>=2`));
await check("start footer shows active user",async()=>await evaluate(`document.querySelector("#start-menu .start-footer span:first-child")?.textContent==="Audit User One"`));

await wait(250);
const failed=checks.filter(c=>!c.ok);
console.log(JSON.stringify({checks,exceptions,consoleErrors,privacyWarnings},null,2));
ws.close();
if(failed.length||exceptions.length||consoleErrors.length)process.exit(1);
