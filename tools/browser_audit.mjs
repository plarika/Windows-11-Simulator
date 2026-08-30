const port=Number(process.argv[2]||9227);
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const targets=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());
const target=targets.find(t=>/^http:\/\/127\.0\.0\.1:8767\//.test(t.url));
if(!target) throw new Error("Simulator target not found");

const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});

let seq=0;
const pending=new Map();
const exceptions=[];
const consoleErrors=[];

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
    exceptions.push(msg.params.exceptionDetails?.text||"exception");
  }
  if(msg.method==="Log.entryAdded"&&["error","warning"].includes(msg.params.entry?.level)){
    consoleErrors.push({
      text:msg.params.entry.text,
      url:msg.params.entry.url||"",
      source:msg.params.entry.source||""
    });
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
    },5000);
  });
}

async function evaluate(expression){
  const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||"Evaluation failed");
  return r.result?.value;
}

await send("Runtime.enable");
await send("Log.enable");
await evaluate(`document.querySelector("#lock")?.classList.add("hidden"); document.querySelector("#boot")?.classList.add("hidden"); true`);

const checks=[];
async function check(name,fn){
  try{
    const ok=Boolean(await fn());
    checks.push({name,ok});
  }catch(e){
    checks.push({name,ok:false,error:e.message});
  }
}

await check("boot diagnostics",async()=>await evaluate(`typeof Win11SimDiagnostics==="object" && Win11SimDiagnostics.run().missingFunctions.length===0`));

await evaluate(`openApp("explorer","C:/Documents"); true`);
await wait(450);
await check("Explorer real shell",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"] .explorer-real')`));
await check("Explorer breadcrumbs",async()=>await evaluate(`document.querySelectorAll('.window[data-app="explorer"] .crumb').length>=1`));
await check("Explorer status",async()=>await evaluate(`!!document.querySelector('.window[data-app="explorer"] .explorer-status')`));
await evaluate(`document.querySelector('.window[data-app="explorer"] .file,.window[data-app="explorer"] .file-row:not(.header)')?.click(); true`);
await wait(120);
await check("Explorer selected count",async()=>await evaluate(`document.querySelector('.window[data-app="explorer"] .explorer-status')?.textContent.includes("selecionado")`));

await evaluate(`openApp("edge"); true`);
await wait(350);
await check("Edge real shell",async()=>await evaluate(`!!document.querySelector('.window[data-app="edge"] .edge-real')`));
await check("Edge initial tab",async()=>await evaluate(`document.querySelectorAll('.window[data-app="edge"] .edge-real-tab').length===1`));
await evaluate(`document.querySelector('.window[data-app="edge"] [data-new-tab]').click(); true`);
await wait(120);
await check("Edge multi tab",async()=>await evaluate(`document.querySelectorAll('.window[data-app="edge"] .edge-real-tab').length===2`));
await evaluate(`(()=>{const a=document.querySelector('.window[data-app="edge"] .edge-real-address');a.value="wikipedia.org";document.querySelector('.window[data-app="edge"] [data-go]').click();return true})()`);
await wait(180);
await check("Edge URL normalization",async()=>await evaluate(`document.querySelector('.window[data-app="edge"] .edge-tab-frame')?.src.startsWith("https://wikipedia.org")`));

await evaluate(`openApp("taskmanager"); true`);
await wait(250);
await check("Task Manager modern shell",async()=>await evaluate(`!!document.querySelector('.window[data-app="taskmanager"] .tm-real')`));
await check("Task Manager process rows",async()=>await evaluate(`document.querySelectorAll('.window[data-app="taskmanager"] [data-process]').length>=2`));

await evaluate(`openApp("settings"); true`);
await wait(250);
await check("Settings realism header",async()=>await evaluate(`!!document.querySelector('.window[data-app="settings"] .settings-real-top')`));

await evaluate(`openApp("notepad"); true`);
await wait(220);
await evaluate(`document.querySelector('.window[data-app="notepad"] [data-saveas]').click(); true`);
await wait(120);
await check("Save dialog",async()=>await evaluate(`document.querySelector('#system-dialog').classList.contains('open') && !!document.querySelector('[data-dialog-name]')`));
await evaluate(`document.querySelector('[data-dialog-name]').value="AuditFile"; document.querySelector('#system-dialog-ok').click(); true`);
await wait(120);
await check("Save extension .txt",async()=>await evaluate(`Object.prototype.hasOwnProperty.call(state.files["C:/Documents"],"AuditFile.txt")`));
await evaluate(`delete state.files["C:/Documents"]["AuditFile.txt"]; saveState(); true`);
await check("Real file bridge available",async()=>await evaluate(`typeof RealFileBridge==="object" && RealFileBridge.version==="6.5.0"`));
await check("Notepad real file controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="notepad"] [data-open-device]') && !!document.querySelector('.window[data-app="notepad"] [data-save-device]')`));
await check("Real file handle write path",async()=>await evaluate(`(async()=>{const test={text:null,closed:false};const handle={name:"audit.txt",async createWritable(){return {async write(v){test.text=v},async close(){test.closed=true}}}};await RealFileBridge.writeHandle(handle,"conteúdo real");return test.text==="conteúdo real"&&test.closed})()`));
await check("Real functions step marker",async()=>await evaluate(`Win11RealFunctions?.step===2 && Win11RealFunctions.features.includes("real-file-save") && Win11RealFunctions.features.includes("real-clipboard-read") && Win11RealFunctions.features.includes("real-clipboard-write")`));
await check("Real clipboard bridge available",async()=>await evaluate(`typeof RealClipboardBridge==="object" && RealClipboardBridge.version==="6.5.0"`));
await check("Notepad real clipboard controls",async()=>await evaluate(`!!document.querySelector('.window[data-app="notepad"] [data-copy-device]') && !!document.querySelector('.window[data-app="notepad"] [data-paste-device]')`));
await evaluate(`closeOverlays(); toggleOverlay("clipboard"); renderClipboard(); true`); await wait(120);
await check("Win+V real clipboard controls",async()=>await evaluate(`!!document.querySelector("#clipboard-list [data-real-clip-read]") && !!document.querySelector("#clipboard-list [data-real-clip-write]")`));
await check("Manual paste fallback",async()=>await evaluate(`(async()=>{const p=RealClipboardBridge.manualPasteDialog();await new Promise(r=>setTimeout(r,30));const box=document.querySelector("[data-real-paste-box]");if(!box)return false;box.value="clipboard audit";document.querySelector("#system-dialog-ok").click();return (await p)==="clipboard audit"})()`));
await evaluate(`closeOverlays(); true`);

await send("Emulation.setDeviceMetricsOverride",{width:412,height:915,deviceScaleFactor:2,mobile:true});
await wait(180);
await evaluate(`closeOverlays(); toggleOverlay("start"); true`);
await wait(160);
await check("Mobile start inside viewport",async()=>await evaluate(`(()=>{const r=document.querySelector("#start-menu").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})()`));
await check("Mobile no page overflow",async()=>await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`));
await check("Rendered text no mojibake",async()=>await evaluate(`(()=>{const t=document.body.innerText;const bad=["\\uFFFD","\\u00C3\\u00A3","\\u00C3\\u00A7","\\u00C3\\u00B5","\\u00C2\\u00B0","\\u00E2\\u20AC\\u201D","\\u00E2\\u20AC\\u00B9","\\u00E2\\u20AC\\u00BA"];return !/[\\u0080-\\u009F]/.test(t)&&!bad.some(x=>t.includes(x))})()`));
await check("Start applications text encoding",async()=>await evaluate(`document.querySelector("#all-apps-btn")?.textContent.includes("Todas as aplica\\u00E7\\u00F5es")`));
await check("Window control glyph encoding",async()=>await evaluate(`(()=>{const w=document.querySelector('.window');return w?.querySelector('.win-control.min')?.textContent==="\\u2014"&&w?.querySelector('.win-control.max')?.textContent==="\\u25A1"&&w?.querySelector('.win-control.close')?.textContent==="\\u00D7"})()`));
await check("Widget temperature encoding",async()=>await evaluate(`document.querySelector("#widgets-btn")?.textContent.includes("22\\u00B0")`));

await wait(250);
const failed=checks.filter(c=>!c.ok);
console.log(JSON.stringify({checks,exceptions,consoleErrors},null,2));
ws.close();
if(failed.length||exceptions.length||consoleErrors.length)process.exit(1);
