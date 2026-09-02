import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const platformSource=readFileSync(resolve(root,"src/core/platform-v100.js"),"utf8");
const recoverySource=readFileSync(resolve(root,"src/core/boot-recovery-v101.js"),"utf8");
class TestEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
const storage=new Map();
const sessionStorage={
  getItem:key=>storage.has(key)?storage.get(key):null,
  setItem:(key,value)=>storage.set(key,String(value)),
  removeItem:key=>storage.delete(key)
};
const context={
  structuredClone,CustomEvent:TestEvent,sessionStorage,
  document:{dispatchEvent(){}},console,setTimeout,clearTimeout,Date,Math
};
vm.createContext(context);
vm.runInContext(platformSource,context);
vm.runInContext(recoverySource,context);
const platform=context.Win11Platform;
const recovery=context.Win11BootRecovery;
assert.equal(recovery.version,"10.1.0");
assert.equal(platform.inspect("boot-recovery").status,"registered");

for(const id of ["session-restore","session-recovery","safe-mode"]){
  platform.registerModule({id,version:"test",layer:"compat"});
  platform.setStatus(id,"ready",{test:true});
}
await platform.start("boot-recovery");
assert.equal(platform.inspect("boot-recovery").status,"ready");

const first=recovery.beginBoot({source:"unit"});
assert.equal(first.consecutiveIncomplete,0);
const ok=await recovery.runPhase("runtime",()=>42,{timeoutMs:300});
assert.equal(ok.ok,true);
assert.equal(ok.value,42);
assert.equal(recovery.phases()[0].status,"ready");
await assert.rejects(recovery.runPhase("invalid",()=>true),/Invalid boot phase/);
const timed=await recovery.runPhase(
  "session",
  ()=>new Promise(()=>{}),
  {timeoutMs:100}
);
assert.equal(timed.ok,false);
assert.equal(timed.reason,"timeout");
assert.equal(recovery.phases().find(x=>x.name==="session").status,"failed");

recovery.completeBoot({test:true});
assert.equal(recovery.diagnostics().guard.hasActiveRun,false);
assert.equal(recovery.diagnostics().guard.consecutiveIncomplete,0);

recovery.beginBoot({source:"loop-1"});
const second=recovery.beginBoot({source:"loop-2"});
assert.equal(second.consecutiveIncomplete,1);
const third=recovery.beginBoot({source:"loop-3"});
assert.equal(third.consecutiveIncomplete,2);
assert.equal(recovery.recoveryPlan().mode,"safe-mode-recommended");
context.Win11SessionRecovery={
  statusInfo:()=>({recoveryPending:true,autoResume:false})
};
assert.equal(recovery.recoveryPlan().mode,"session-recovery-choice");
context.Win11SessionRecovery={
  statusInfo:()=>({recoveryPending:true,autoResume:true})
};
assert.equal(recovery.recoveryPlan().mode,"session-auto-recovery");
context.Win11SafeMode={isActive:true};
assert.equal(recovery.recoveryPlan().mode,"safe-mode-active");

recovery.clearBootGuard({source:"unit"});
assert.equal(recovery.diagnostics().guard.consecutiveIncomplete,0);
assert.ok(recovery.diagnostics().recentEvents.length<=32);
assert.ok(!recoverySource.includes("localStorage"));
console.log("Boot Recovery V10.1 unit tests passed.");
