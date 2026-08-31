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
await check("Explorer Pro bridge",async()=>await evaluate(`Win11ExplorerPro?.version==="8.2.1"`));
await check("Explorer Navigation V8.3 bridge",async()=>await evaluate(`Win11ExplorerNavigation?.version==="8.3.0"`));
await check("Explorer Details V8.4 bridge",async()=>await evaluate(`Win11ExplorerDetails?.version==="8.4.0"`));
await check("Explorer Details V8.4 UI installed",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');return !!w?.__explorerDetailsV840&&!!w.querySelector("[data-details-v840]")&&!!w.querySelector(".explorer-details-pane-v840")})()`));
await check("Explorer Context V8.5 bridge",async()=>await evaluate(`Win11ExplorerContext?.version==="8.5.0"`));
await check("Explorer Context V8.5 installed",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"]')?.__explorerContextV850`));
await evaluate(`document.querySelector('.window[data-app="explorer"]').__explorerNavigationV820.go("This PC");true`); await wait(150);
await check("Explorer This PC V8.4 folders",async()=>await evaluate(`(()=>{const w=document.querySelector('.window[data-app="explorer"]');return w.querySelectorAll(".thispc-folder-card-v840").length===6&&w.querySelectorAll(".drive-card").length>=3&&!!w.querySelector(".thispc-storage-summary-v840")})()`));
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
  ensureFolder(root+"/FolderOne")["inside.txt"]="inside";
  ensureFolder(root+"/Destination");
  ensureFolder(root+"/RecycleMe")["trash.txt"]="trash";
  const w=document.querySelector('.window[data-app="explorer"]');w.dispatchEvent(new CustomEvent("navigate",{detail:root}));return true;
})()`); await wait(260);
await check("Explorer Pro installed on window",async()=>await evaluate(`document.querySelector('.window[data-app="explorer"] .explorer-pro-v740')?.dataset.explorerProV740==="1"`));
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

await check("Start Search V8.1 bridge",async()=>await evaluate(`Win11StartSearch?.version==="8.1.0" && typeof Win11StartSearch.collect==="function" && typeof Win11StartSearch.pin==="function" && typeof Win11StartSearch.reorderPinned==="function"`));
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
await evaluate(`ensureFolder("C:/Documents")["PesquisaV81.txt"]="conteúdo exclusivo nebulosa quântica zebra";saveState();true`);
await check("Search V8.1 finds virtual file content",async()=>await evaluate(`Win11StartSearch.collect("nebulosa quantica zebra").some(r=>r.type==="file"&&r.name==="PesquisaV81.txt")`));
await check("Search V8.1 ignores accents",async()=>await evaluate(`Win11StartSearch.collect("personalizacao").some(r=>r.type==="setting"&&r.name==="Personalização")`));
await check("Search V8.1 categorizes apps settings files",async()=>await evaluate(`(()=>{const a=Win11StartSearch.collect("a");const types=new Set(a.map(x=>x.type));return types.has("app")&&types.has("setting")&&types.has("file")})()`));
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
await evaluate(`document.querySelector("#context-menu")?.classList.remove("open");delete ensureFolder("C:/Documents")["PesquisaV81.txt"];saveState();true`);

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

await check("Personalization V7.8 bridge",async()=>await evaluate(`Win11Personalization?.version==="8.1.0" && Win11Personalization.wallpaperCount===8 && Win11Personalization.accents.length===8`));
await evaluate(`(()=>{globalThis.__personalV78Before=Win11Personalization.state;state.settingsPage="personalization";const w=document.querySelector('.window[data-app="settings"]');if(w){w.querySelector(".win-body").innerHTML="";w.querySelector(".win-body").appendChild(renderApp("settings",w));}return true})()`); await wait(120);
await check("Personalization V7.8 settings UI",async()=>await evaluate(`document.querySelectorAll('.window[data-app="settings"] [data-theme-mode]').length===3 && document.querySelectorAll('.window[data-app="settings"] [data-accent]').length===8 && document.querySelectorAll('.window[data-app="settings"] [data-wallpaper-v78]').length===8`));
await check("System theme preference",async()=>await evaluate(`Win11Personalization.set("themeMode","system") && state.personalizationV78.themeMode==="system"`));
await check("Dark theme application",async()=>await evaluate(`Win11Personalization.set("themeMode","dark") && document.querySelector("#app").classList.contains("theme-dark")`));
await check("Accent color application",async()=>await evaluate(`Win11Personalization.set("accent","#8764b8") && getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()==="#8764b8"`));
await check("Taskbar left alignment state",async()=>await evaluate(`Win11Personalization.set("taskbarAlignment","left") && document.querySelector("#app").classList.contains("taskbar-left-v78")`));
await check("Transparency toggle state",async()=>await evaluate(`Win11Personalization.set("transparency",false) && document.querySelector("#app").classList.contains("no-transparency-v78")`));
await check("Animation toggle state",async()=>await evaluate(`Win11Personalization.set("animations",false) && document.querySelector("#app").classList.contains("no-animations-v78")`));
await check("Extended wallpaper application",async()=>await evaluate(`Win11Personalization.set("wallpaperIndex",5) && state.personalizationV78.wallpaperIndex===5 && document.querySelector("#app").style.background.includes("gradient")`));
await evaluate(`(()=>{const p=__personalV78Before;for(const k of ["themeMode","accent","transparency","animations","taskbarAlignment","wallpaperIndex"])Win11Personalization.set(k,p[k]);return true})()`);
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
await check("Real functions Start Search marker",async()=>await evaluate(`Win11RealFunctions?.step===20 && Win11RealFunctions.features.includes("windows-experience-v8") && Win11RealFunctions.features.includes("start-menu-v3") && Win11RealFunctions.features.includes("per-user-start-pins") && Win11RealFunctions.features.includes("search-v3") && Win11RealFunctions.features.includes("categorized-search") && Win11RealFunctions.features.includes("taskbar-jump-lists")`));

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
await check("PWA cache populated",async()=>await evaluate(`(async()=>{for(let i=0;i<25;i++){const keys=await caches.keys();if(keys.includes("win11-simulator-v8.5.0"))return true;await new Promise(x=>setTimeout(x,100))}return false})()`));
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
