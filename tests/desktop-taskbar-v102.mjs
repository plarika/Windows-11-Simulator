import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const platformSource=readFileSync(resolve(root,"src/core/platform-v100.js"),"utf8");
const shellSource=readFileSync(resolve(root,"src/core/desktop-taskbar-v102.js"),"utf8");

class TestEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
class TestNode{
  constructor(id=""){this.id=id;this.dataset={};this.removed=false}
  addEventListener(){}
  removeEventListener(){}
  remove(){this.removed=true}
  querySelectorAll(selector){
    if(this.id==="task-center"&&selector===".task-btn[data-window]")return taskButtons.filter(x=>!x.removed);
    return [];
  }
}
const nodes=Object.fromEntries(
  ["app","desktop","desktop-icons","taskbar","task-center","start-menu"].map(id=>[id,new TestNode(id)])
);
const windows=[
  {dataset:{id:"w1"}},
  {dataset:{id:"w2"}}
];
const taskButtons=[
  new TestNode(),new TestNode(),new TestNode(),new TestNode()
];
taskButtons[0].dataset.window="w1";
taskButtons[1].dataset.window="w1";
taskButtons[2].dataset.window="orphan";
taskButtons[3].dataset.window="w2";
const icons=[new TestNode(),new TestNode(),new TestNode()];

const document={
  visibilityState:"visible",
  getElementById:id=>nodes[id]||null,
  querySelectorAll(selector){
    if(selector==="#window-layer > .window[data-id]")return windows;
    if(selector==="#desktop-icons .desktop-icon")return icons;
    return [];
  },
  addEventListener(){},
  removeEventListener(){},
  dispatchEvent(){}
};
const busListeners=new Map();
const Win11SystemBus={
  version:"9.8.1",
  emit(){},
  on(topic,handler){
    busListeners.set(topic,handler);
    return ()=>busListeners.delete(topic);
  }
};
const startState={pinned:["edge","explorer"],recentApps:["edge"],searchHistory:["win11"]};
const Win11StartSearch={
  state:startState,
  renderStart(){return true},
  pin(id){if(!startState.pinned.includes(id))startState.pinned.push(id);return true},
  unpin(id){startState.pinned=startState.pinned.filter(x=>x!==id);return true},
  isPinned:id=>startState.pinned.includes(id)
};
let repairCalls=0,refreshCalls=0,applyCalls=0,desktopCalls=0;
const Win11TaskbarWindowPro={
  getGroups:()=>({edge:["w1"],explorer:["w2"]}),
  repairTaskButtons(){repairCalls++;return 0},
  refresh(){refreshCalls++;return true}
};
const Win11TaskbarSystem={
  state:{autoHide:false,showDesktop:true,showSeconds:false,desktopShowing:false},
  apply(){applyCalls++;return true},
  showDesktop:()=>true,
  reveal:()=>true
};

const context={
  structuredClone,CustomEvent:TestEvent,document,console,setTimeout,clearTimeout,
  addEventListener(){},removeEventListener(){},
  state:{desktops:["Ambiente 1","Ambiente 2"],currentDesktop:1},
  populateDesktop(){desktopCalls++;return true},
  renderRecommended(){return true},
  updateTaskbar(){return true},
  Win11SystemBus,Win11SettingsStore:{version:"9.8.7"},
  Win11DesktopIntegration:{version:"8.1.0"},
  Win11StartSearch,Win11TaskbarWindowPro,Win11TaskbarSystem
};
vm.createContext(context);
vm.runInContext(platformSource,context);
const platform=context.Win11Platform;
for(const [moduleId,version] of [
  ["system-bus","9.8.1"],["settings-core","9.8.7"],["desktop-integration","8.1.0"],
  ["start-search","8.1.0"],["taskbar-system","9.8.3"],["taskbar-window","9.7.0"]
]){
  platform.registerModule({id:moduleId,version,layer:"compat"});
  platform.setStatus(moduleId,"ready",{test:true});
}
vm.runInContext(shellSource,context);

const shell=context.Win11DesktopTaskbar;
assert.equal(shell.version,"10.2.0");
assert.equal(platform.inspect("desktop-taskbar").status,"registered");
await platform.start("desktop-taskbar");
assert.equal(platform.inspect("desktop-taskbar").status,"ready");
assert.equal(nodes.app.dataset.desktopTaskbar,"10.2.0");
assert.equal(nodes.desktop.dataset.desktopSurface,"10.2.0");
assert.equal(nodes.taskbar.dataset.taskbarSurface,"10.2.0");
assert.equal(desktopCalls,1);
assert.ok(applyCalls>=1);
assert.ok(repairCalls>=1);
assert.ok(refreshCalls>=1);
const health=shell.health();
assert.equal(health.ok,true);
assert.equal(health.orphanTaskButtons,0);
assert.equal(health.duplicateTaskButtons,0);
assert.equal(taskButtons.filter(x=>x.removed).length,2);
assert.equal(shell.snapshot().desktop.current,1);
assert.equal(shell.snapshot().desktop.count,2);
assert.equal(shell.snapshot().desktop.iconCount,3);
assert.equal(shell.snapshot().start.pinnedCount,2);

assert.equal(shell.pinStart("settings"),true);
assert.equal(shell.isPinnedStart("settings"),true);
assert.equal(shell.unpinStart("settings"),true);
assert.equal(shell.isPinnedStart("settings"),false);
assert.equal(shell.showDesktop(),true);
assert.equal(shell.revealTaskbar(),true);
assert.ok(shell.diagnostics().recentEvents.length<=32);

for(let i=0;i<140;i++)shell.reconcile({source:"bounded-"+i,desktop:false,start:false,taskbar:false});
assert.equal(shell.events(999).length,96);
await platform.stop("desktop-taskbar");
assert.equal(platform.inspect("desktop-taskbar").status,"stopped");
console.log("Desktop / Taskbar V10.2 unit tests passed.");
