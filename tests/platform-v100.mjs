import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const source=readFileSync(resolve(root,"src/core/platform-v100.js"),"utf8");
class TestEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
const context={
  structuredClone,
  CustomEvent:TestEvent,
  document:{dispatchEvent(){}},
  console
};
vm.createContext(context);
vm.runInContext(source,context);

const platform=context.Win11Platform;
assert.equal(platform.version,"10.0.0");
assert.equal(platform.inspect("platform").status,"ready");
assert.equal(platform.health().status,"ready");
assert.throws(()=>platform.registerModule({id:"../bad",version:"1"}),/Invalid platform module id/);

platform.registerModule({
  id:"test-service",version:"1.0.0",layer:"service",
  requires:["platform"],provides:["test-capability"],
  start:()=>true,health:()=>({ok:true})
});
assert.equal(platform.inspect("test-service").status,"registered");
await platform.start("test-service");
assert.equal(platform.inspect("test-service").status,"ready");
assert.equal(platform.health().modules.find(x=>x.id==="test-service").health.ok,true);

platform.registerModule({
  id:"blocked-service",version:"1.0.0",layer:"service",
  requires:["missing-dependency"]
});
await platform.start("blocked-service");
assert.equal(platform.inspect("blocked-service").status,"degraded");

for(let i=0;i<220;i++){
  platform.setStatus("test-service","ready",{iteration:i});
}
assert.equal(platform.events(999).length,160);
assert.ok(platform.diagnostics().recentEvents.length<=40);
assert.ok(platform.diagnostics().recentErrors.length<=20);

await platform.stop("test-service");
assert.equal(platform.inspect("test-service").status,"stopped");
console.log("Platform V10.0 unit tests passed.");
