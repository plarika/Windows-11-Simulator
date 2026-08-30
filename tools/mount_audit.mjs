const port=Number(process.argv[2]||9227);
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));

const targets=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());
const target=targets.find(t=>t.type==="page"&&/^http:\/\/127\.0\.0\.1:\d+\//.test(t.url));
if(!target)throw new Error("Simulator target not found");

const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});

let seq=0;
const pending=new Map();
const exceptions=[];
const consoleErrors=[];

ws.onmessage=ev=>{
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
  if(msg.method==="Log.entryAdded"&&msg.params.entry?.level==="error"){
    consoleErrors.push(msg.params.entry.text||"console error");
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
    throw new Error(String(ex.exception?.description||ex.exception?.value||ex.text||"Evaluation failed"));
  }
  return r.result?.value;
}

const checks=[];
async function check(name,fn){
  try{checks.push({name,ok:Boolean(await fn())})}
  catch(err){checks.push({name,ok:false,error:err.message})}
}

async function waitFor(fn,timeout=4000,step=80){
  const start=Date.now();
  while(Date.now()-start<timeout){
    try{if(await fn())return true}catch{}
    await wait(step);
  }
  return false;
}

await send("Runtime.enable");
await send("Log.enable");

await check("real mounts bridge",async()=>await evaluate(`typeof Win11RealMounts==="object" && Win11RealMounts.version==="8.1.0"`));
await check("active session exists",async()=>await evaluate(`!!Win11SessionManager?.activeUserId`));

await evaluate(`(()=>{
  function makeFileHandle(name,content="",type="text/plain"){
    return {
      kind:"file",
      name,
      _content:String(content),
      _type:type,
      async getFile(){return new File([this._content],this.name,{type:this._type,lastModified:Date.now()})},
      async createWritable(){
        const self=this;
        return {
          async write(value){
            if(value instanceof Blob)self._content=await value.text();
            else self._content=String(value??"");
          },
          async close(){}
        };
      }
    };
  }

  function makeDirHandle(name){
    return {
      kind:"directory",
      name,
      _entries:new Map(),
      _permission:"prompt",
      async queryPermission(){return this._permission},
      async requestPermission(){this._permission="granted";return "granted"},
      async *entries(){
        for(const pair of this._entries.entries())yield pair;
      },
      async getDirectoryHandle(entryName,opts={}){
        const current=this._entries.get(entryName);
        if(current){
          if(current.kind!=="directory")throw new DOMException("Type mismatch","TypeMismatchError");
          return current;
        }
        if(!opts.create)throw new DOMException("Not found","NotFoundError");
        const next=makeDirHandle(entryName);
        next._permission=this._permission;
        this._entries.set(entryName,next);
        return next;
      },
      async getFileHandle(entryName,opts={}){
        const current=this._entries.get(entryName);
        if(current){
          if(current.kind!=="file")throw new DOMException("Type mismatch","TypeMismatchError");
          return current;
        }
        if(!opts.create)throw new DOMException("Not found","NotFoundError");
        const next=makeFileHandle(entryName);
        this._entries.set(entryName,next);
        return next;
      },
      async removeEntry(entryName,opts={}){
        const current=this._entries.get(entryName);
        if(!current)throw new DOMException("Not found","NotFoundError");
        if(current.kind==="directory"&&!opts.recursive&&current._entries.size){
          throw new DOMException("Directory not empty","InvalidModificationError");
        }
        this._entries.delete(entryName);
      }
    };
  }

  globalThis.__mountAuditRoot=makeDirHandle("Audit Real Folder");
  __mountAuditRoot._entries.set("hello.txt",makeFileHandle("hello.txt","alpha"));
  __mountAuditRoot._entries.set("picture.png",makeFileHandle("picture.png","fakepng","image/png"));
  Object.defineProperty(window,"showDirectoryPicker",{
    configurable:true,
    value:async()=>__mountAuditRoot
  });
  return true;
})()`);

await check("mock directory picker installed",async()=>await evaluate(`typeof window.showDirectoryPicker==="function" && __mountAuditRoot.name==="Audit Real Folder"`));

await evaluate(`(async()=>{
  globalThis.__mountAuditRecord=await Win11RealMounts.mountDirectory();
  return __mountAuditRecord.id;
})()`);

await check("mount created",async()=>await evaluate(`!!__mountAuditRecord?.id && __mountAuditRecord.ownerId===Win11SessionManager.activeUserId`));
await check("mount isolated by owner",async()=>await evaluate(`(async()=>{
  const mine=await Win11RealMounts.listMounts();
  const other=await Win11RealMounts.listMounts("not-the-active-user");
  return mine.some(x=>x.id===__mountAuditRecord.id)&&other.length===0;
})()`));

await check("list mounted directory",async()=>await evaluate(`(async()=>{
  const rows=await Win11RealMounts.listDirectory(__mountAuditRoot,[]);
  return rows.some(x=>x.name==="hello.txt"&&x.kind==="file")&&rows.some(x=>x.name==="picture.png");
})()`));

await check("create real folder",async()=>await evaluate(`(async()=>{
  await Win11RealMounts.createFolder(__mountAuditRoot,[],"FolderA");
  return __mountAuditRoot._entries.get("FolderA")?.kind==="directory";
})()`));

await check("create real text file",async()=>await evaluate(`(async()=>{
  await Win11RealMounts.createTextFile(__mountAuditRoot,[],"Created.txt","created-content");
  return __mountAuditRoot._entries.get("Created.txt")?._content==="created-content";
})()`));

await check("rename real file",async()=>await evaluate(`(async()=>{
  await Win11RealMounts.renameEntry(__mountAuditRoot,[],"Created.txt","Renamed.txt","file");
  return !__mountAuditRoot._entries.has("Created.txt")&&__mountAuditRoot._entries.get("Renamed.txt")?._content==="created-content";
})()`));

await check("rename real folder recursively",async()=>await evaluate(`(async()=>{
  const a=await __mountAuditRoot.getDirectoryHandle("FolderA");
  const f=await a.getFileHandle("Inside.txt",{create:true});
  const w=await f.createWritable();await w.write("inside");await w.close();
  await Win11RealMounts.renameEntry(__mountAuditRoot,[],"FolderA","FolderB","directory");
  const b=__mountAuditRoot._entries.get("FolderB");
  return !__mountAuditRoot._entries.has("FolderA")&&b?._entries.get("Inside.txt")?._content==="inside";
})()`));

await check("delete real entries",async()=>await evaluate(`(async()=>{
  await Win11RealMounts.deleteEntry(__mountAuditRoot,[],"Renamed.txt","file");
  await Win11RealMounts.deleteEntry(__mountAuditRoot,[],"FolderB","directory");
  return !__mountAuditRoot._entries.has("Renamed.txt")&&!__mountAuditRoot._entries.has("FolderB");
})()`));

await evaluate(`openApp("explorer");true`);
await wait(250);
await check("Explorer mount button",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"] [data-mount-real]')`));
await check("Explorer mount nav item",async()=>await waitFor(async()=>await evaluate(`document.querySelectorAll('.window[data-app="explorer"] .real-mount-nav-item').length>=1`),2500,100));

await evaluate(`(()=>{
  const w=[...document.querySelectorAll('.window[data-app="explorer"]')].pop();
  w.querySelector(".explorer-real")?.dispatchEvent(new CustomEvent("open-real-mount",{detail:{id:__mountAuditRecord.id}}));
  return true;
})()`);
await check("Explorer enters real mount mode",async()=>await waitFor(async()=>await evaluate(`(()=>{
  const w=[...document.querySelectorAll('.window[data-app="explorer"]')].pop();
  return !!w?.querySelector(".explorer-real.real-mount-mode .real-mount-view:not([hidden])");
})()`),2500,100));
await check("Explorer shows real files",async()=>await evaluate(`(()=>{
  const w=[...document.querySelectorAll('.window[data-app="explorer"]')].pop();
  return [...w.querySelectorAll(".real-mount-row")].some(x=>x.dataset.name==="hello.txt");
})()`));

await evaluate(`(async()=>{
  await Win11RealMounts.openMountedFile(__mountAuditRecord,[],"hello.txt");
  return true;
})()`);
await wait(180);
await check("Mounted text opens in Notepad",async()=>await evaluate(`(()=>{
  const w=[...document.querySelectorAll('.window[data-app="notepad"]')].pop();
  return w?.querySelector("textarea")?.value==="alpha" &&
    w?.querySelector("[data-doc-source]")?.textContent.includes("hello.txt");
})()`));

await evaluate(`(()=>{
  const w=[...document.querySelectorAll('.window[data-app="notepad"]')].pop();
  const ta=w.querySelector("textarea");
  ta.value="beta";
  ta.dispatchEvent(new Event("input",{bubbles:true}));
  w.querySelector("[data-save-device]").click();
  return true;
})()`);
await check("Notepad writes back to mounted handle",async()=>await waitFor(async()=>await evaluate(`__mountAuditRoot._entries.get("hello.txt")?._content==="beta"`),2500,80));

await check("Settings real mount card",async()=>await evaluate(`(()=>{
  state.settingsPage="system";
  const w=[...document.querySelectorAll('.window[data-app="settings"]')].pop();
  if(!w){openApp("settings");return true}
  w.querySelector(".win-body").innerHTML="";
  w.querySelector(".win-body").appendChild(renderApp("settings",w));
  return true;
})()`).then(async()=>waitFor(async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] [data-real-mount-settings]')`),2000,100)));

await check("This PC real mount card",async()=>await waitFor(async()=>await evaluate(`(()=>{
  const cards=[...document.querySelectorAll('.window[data-app="explorer"] [data-real-mount-card]')];
  return cards.some(x=>x.dataset.realMountCard===__mountAuditRecord.id);
})()`),2500,100));

await check("forget mount",async()=>await evaluate(`(async()=>{
  const ok=await Win11RealMounts.forgetMount(__mountAuditRecord.id);
  const rows=await Win11RealMounts.listMounts();
  return ok&&!rows.some(x=>x.id===__mountAuditRecord.id);
})()`));

await wait(120);
const failed=checks.filter(x=>!x.ok);
console.log(JSON.stringify({checks,exceptions,consoleErrors},null,2));
ws.close();
if(failed.length||exceptions.length||consoleErrors.length)process.exit(1);
