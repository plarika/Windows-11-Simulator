import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const platformSource=readFileSync(resolve(root,"src/core/platform-v100.js"),"utf8");
const wmSource=readFileSync(resolve(root,"src/core/window-manager-v103.js"),"utf8");

class TestEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
class ClassList{
  constructor(...values){this.values=new Set(values)}
  contains(v){return this.values.has(v)}
  add(...values){values.forEach(v=>this.values.add(v))}
  remove(...values){values.forEach(v=>this.values.delete(v))}
}
function makeWindow(id,app,desktop,{focused=false}={}){
  const max={click(){win.classList.add("maximized")}};
  const win={
    dataset:{id,app,desktop:String(desktop)},style:{zIndex:focused?"10":"5"},
    classList:new ClassList("window",...(focused?["focused"]:[])),
    isConnected:true,
    querySelector(sel){return sel===".max"?max:null}
  };
  return win;
}
const w1=makeWindow("dup","edge",0,{focused:true});
const w2=makeWindow("dup","explorer",7,{focused:true});
const layer={children:[w1,w2]};
const nodes={"window-layer":layer};
class Observer{
  constructor(cb){this.cb=cb}
  observe(){}
  disconnect(){}
}
const state={desktops:["Ambiente 1","Ambiente 2"],currentDesktop:0};
let saved=0,focused="",minimized="",closed="",snapRefresh=0,taskbarReconcile=0;
const legacy={
  layouts:{
    halves:[{x:0,y:0,w:.5,h:1},{x:.5,y:0,w:.5,h:1}],
    quarters:[{x:0,y:0,w:.5,h:.5}]
  },
  applyLayoutSlot(win,layout,slot){
    if(!this.layouts[layout]?.[slot])return false;
    win.dataset.wmSnapLayout=layout;win.dataset.wmSnapSlot=String(slot);win.classList.add("wm-snapped");return true;
  },
  restoreFloating(win){
    delete win.dataset.wmSnapLayout;delete win.dataset.wmSnapSlot;delete win.dataset.wmSnapGroup;
    win.classList.remove("wm-snapped","maximized");return true;
  },
  refreshSnapGroups(){snapRefresh++;return true},
  moveWindowToDesktop(win,target){win.dataset.desktop=String(target);win.style.visibility=target===state.currentDesktop?"":"hidden"},
  createDesktop(){state.desktops.push("Ambiente "+(state.desktops.length+1));state.currentDesktop=state.desktops.length-1},
  closeDesktop(index){if(state.desktops.length<=1)return false;state.desktops.splice(index,1);state.currentDesktop=Math.min(state.currentDesktop,state.desktops.length-1);return true},
  renderTaskView(){return true}
};
const context={
  structuredClone,CustomEvent:TestEvent,MutationObserver:Observer,console,setTimeout,clearTimeout,Date,Math,
  document:{getElementById:id=>nodes[id]||null,dispatchEvent(){}},
  addEventListener(){},removeEventListener(){},
  state,saveState(){saved++},
  Win11WindowManager:legacy,
  Win11TaskbarWindowPro:{
    savePlacement:()=>true,
    applyPlacement:()=>true
  },
  Win11DesktopTaskbar:{reconcile(){taskbarReconcile++;return {ok:true}}},
  Win11SystemBus:{emit(){}},
  focusWindow(win){layer.children.forEach(x=>x.classList.remove("focused"));win.classList.add("focused");focused=win.dataset.id},
  minimizeWindow(win){win.classList.add("hidden");minimized=win.dataset.id},
  closeWindow(win){const i=layer.children.indexOf(win);if(i>=0)layer.children.splice(i,1);closed=win.dataset.id}
};
vm.createContext(context);
vm.runInContext(platformSource,context);
const platform=context.Win11Platform;
for(const dep of ["desktop-taskbar","window-manager","taskbar-window"]){
  platform.registerModule({id:dep,version:"test",layer:"compat"});
  platform.setStatus(dep,"ready",{test:true});
}
vm.runInContext(wmSource,context);
const wm=context.Win11WindowManagerV10;
assert.equal(wm.version,"10.3.0");
assert.equal(platform.inspect("window-manager-v10").status,"registered");
await platform.start("window-manager-v10");
assert.equal(platform.inspect("window-manager-v10").status,"ready");

const snap0=wm.snapshot();
assert.equal(snap0.windowCount,2);
assert.equal(wm.integrity().ok,true);
assert.equal(new Set(snap0.windows.map(x=>x.id)).size,2);
assert.equal(snap0.windows.find(x=>x.appId==="explorer").desktop,0);
assert.equal(snap0.windows.filter(x=>x.focused).length,1);
assert.ok(snapRefresh>=1);
assert.ok(taskbarReconcile>=1);

const edgeId=wm.snapshot().windows.find(x=>x.appId==="edge").id;
assert.equal(wm.focus(edgeId),true);
assert.equal(focused,edgeId);
assert.equal(wm.minimize(edgeId),true);
assert.equal(minimized,edgeId);
assert.equal(wm.restore(edgeId),true);
assert.equal(wm.snap(edgeId,"halves",1,{assist:false}),true);
assert.equal(wm.windowById(edgeId).dataset.wmSnapLayout,"halves");
assert.equal(wm.moveToDesktop(edgeId,1),true);
assert.equal(wm.windowById(edgeId).dataset.desktop,"1");

assert.equal(wm.renameDesktop(1,"Trabalho"),true);
assert.equal(state.desktops[1],"Trabalho");
assert.ok(saved>=1);
const beforeCreate=state.desktops.length;
assert.equal(wm.createDesktop(),true);
assert.equal(state.desktops.length,beforeCreate+1);
assert.equal(wm.closeDesktop(state.desktops.length-1),true);
assert.equal(state.desktops.length,beforeCreate);

assert.equal(wm.layouts().halves.length,2);
assert.equal(wm.savePlacement("missing-window"),false);
assert.equal(wm.applyPlacement("missing-window"),false);
assert.ok(wm.diagnostics().recentEvents.length<=36);
for(let i=0;i<150;i++)wm.reconcile({source:"bounded-"+i,placements:false});
assert.equal(wm.events(999).length,120);

assert.equal(wm.close(edgeId),true);
assert.equal(closed,edgeId);
await platform.stop("window-manager-v10");
assert.equal(platform.inspect("window-manager-v10").status,"stopped");
console.log("Window Manager V10.3 unit tests passed.");
