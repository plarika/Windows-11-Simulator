"use strict";
(function installPlatformV100(){
  const VERSION="10.0.0";
  const MODULE_ID=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  const STATUSES=new Set(["registered","starting","ready","degraded","failed","stopped"]);
  const LAYERS=new Set(["core","shell","feature","app","service","compat"]);
  const EVENT_LIMIT=160,ERROR_LIMIT=40;
  const modules=new Map(),events=[],errors=[];
  let sequence=0,bus=null;

  function clone(value){
    if(value===undefined)return null;
    try{return structuredClone(value)}
    catch{
      try{return JSON.parse(JSON.stringify(value))}
      catch{return null}
    }
  }
  function safeText(value,max=120){
    return String(value??"").trim().slice(0,max);
  }
  function assertId(value){
    const id=safeText(value,64);
    if(!MODULE_ID.test(id))throw new TypeError("Invalid platform module id.");
    return id;
  }
  function stringList(value,limit=64){
    const input=Array.isArray(value)?value:[];
    return [...new Set(input.map(v=>safeText(v,80)).filter(Boolean))].slice(0,limit);
  }
  function resolveGlobal(path){
    const parts=safeText(path,160).split(".").filter(Boolean);
    let cursor=globalThis;
    for(const part of parts){
      if(cursor==null||!(part in cursor))return undefined;
      cursor=cursor[part];
    }
    return cursor;
  }
  function record(type,moduleId,detail={}){
    const event=Object.freeze({
      id:"platform-"+(++sequence),
      type:safeText(type,40),
      moduleId:safeText(moduleId,64),
      time:Date.now(),
      detail:clone(detail)
    });
    events.unshift(clone(event));
    if(events.length>EVENT_LIMIT)events.length=EVENT_LIMIT;
    try{bus?.emit?.("platform:"+event.type,{moduleId:event.moduleId,...event.detail})}catch{}
    try{document.dispatchEvent(new CustomEvent("win11:platform",{detail:clone(event)}))}catch{}
    return clone(event);
  }
  function recordError(moduleId,error,phase="runtime"){
    const row={
      moduleId:safeText(moduleId,64),
      phase:safeText(phase,40),
      message:safeText(error?.message||error,240),
      time:Date.now()
    };
    errors.unshift(row);
    if(errors.length>ERROR_LIMIT)errors.length=ERROR_LIMIT;
    record("error",row.moduleId,{phase:row.phase,message:row.message});
  }
  function normalizeDescriptor(input){
    if(!input||typeof input!=="object"||Array.isArray(input)){
      throw new TypeError("Platform module descriptor must be an object.");
    }
    const id=assertId(input.id);
    const version=safeText(input.version||"0.0.0",32);
    const layer=LAYERS.has(input.layer)?input.layer:"feature";
    return {
      id,version,layer,
      requires:stringList(input.requires,32),
      provides:stringList(input.provides,64),
      start:typeof input.start==="function"?input.start:null,
      stop:typeof input.stop==="function"?input.stop:null,
      health:typeof input.health==="function"?input.health:null
    };
  }
  function publicModule(row){
    return Object.freeze({
      id:row.id,version:row.version,layer:row.layer,status:row.status,
      requires:[...row.requires],provides:[...row.provides],
      registeredAt:row.registeredAt,startedAt:row.startedAt,
      readyAt:row.readyAt,stoppedAt:row.stoppedAt,lastDetail:clone(row.lastDetail)
    });
  }
  function registerModule(input){
    const descriptor=normalizeDescriptor(input);
    if(modules.has(descriptor.id))throw new Error("Platform module already registered: "+descriptor.id);
    const row={...descriptor,status:"registered",registeredAt:Date.now(),
      startedAt:0,readyAt:0,stoppedAt:0,lastDetail:null};
    modules.set(row.id,row);
    record("registered",row.id,{version:row.version,layer:row.layer});
    return publicModule(row);
  }
  function setStatus(id,status,detail={}){
    id=assertId(id);
    if(!STATUSES.has(status))throw new TypeError("Invalid platform module status.");
    const row=modules.get(id);
    if(!row)throw new Error("Unknown platform module: "+id);
    row.status=status;
    row.lastDetail=clone(detail);
    const now=Date.now();
    if(status==="starting")row.startedAt=now;
    if(status==="ready")row.readyAt=now;
    if(status==="stopped")row.stoppedAt=now;
    record("status",id,{status,...clone(detail)});
    return publicModule(row);
  }
  function registerLegacy(id,version,globals=[],options={}){
    const requiredGlobals=stringList(globals,48);
    const row=registerModule({
      id,version,layer:"compat",
      requires:stringList(options.requires,32),
      provides:stringList(options.provides,64),
      health:()=>({missingGlobals:requiredGlobals.filter(name=>resolveGlobal(name)===undefined)})
    });
    const missingGlobals=requiredGlobals.filter(name=>resolveGlobal(name)===undefined);
    return missingGlobals.length
      ?setStatus(row.id,"degraded",{missingGlobals})
      :setStatus(row.id,"ready",{legacy:true});
  }
  async function start(id){
    id=assertId(id);
    const row=modules.get(id);
    if(!row)throw new Error("Unknown platform module: "+id);
    if(row.status==="ready")return publicModule(row);
    const unresolved=row.requires.filter(dep=>modules.get(dep)?.status!=="ready");
    if(unresolved.length)return setStatus(id,"degraded",{reason:"dependencies",unresolved});
    setStatus(id,"starting");
    try{
      const result=row.start?await row.start({platform:api,module:publicModule(row)}):true;
      return setStatus(id,result===false?"degraded":"ready",
        result===false?{reason:"start-returned-false"}:{});
    }catch(error){
      recordError(id,error,"start");
      return setStatus(id,"failed",{reason:"start-error"});
    }
  }
  async function stop(id){
    id=assertId(id);
    const row=modules.get(id);
    if(!row)throw new Error("Unknown platform module: "+id);
    try{
      if(row.stop)await row.stop({platform:api,module:publicModule(row)});
      return setStatus(id,"stopped");
    }catch(error){
      recordError(id,error,"stop");
      return setStatus(id,"failed",{reason:"stop-error"});
    }
  }
  function inspect(id){
    const row=modules.get(assertId(id));
    return row?publicModule(row):null;
  }
  function health(){
    const result=[];
    for(const row of modules.values()){
      let detail={};
      if(row.health){
        try{detail=clone(row.health())||{}}
        catch(error){recordError(row.id,error,"health");detail={healthError:true}}
      }
      result.push({...publicModule(row),health:detail});
    }
    const failed=result.filter(x=>x.status==="failed").length;
    const degraded=result.filter(x=>x.status==="degraded").length;
    return Object.freeze({
      version:VERSION,
      status:failed?"failed":degraded?"degraded":"ready",
      moduleCount:result.length,
      readyCount:result.filter(x=>x.status==="ready").length,
      degradedCount:degraded,failedCount:failed,
      modules:clone(result)
    });
  }
  function diagnostics(){
    return Object.freeze({
      ...health(),
      eventCount:events.length,
      recentEvents:clone(events.slice(0,40)),
      recentErrors:clone(errors.slice(0,20)),
      systemBusAttached:Boolean(bus)
    });
  }
  function attachSystemBus(){
    const candidate=globalThis.Win11SystemBus;
    if(!candidate||typeof candidate.emit!=="function")return false;
    bus=candidate;
    record("bus-attached","platform",{version:safeText(candidate.version,32)});
    return true;
  }
  const api=Object.freeze({
    version:VERSION,
    registerModule,registerLegacy,setStatus,start,stop,inspect,health,diagnostics,
    attachSystemBus,
    list:()=>Object.freeze([...modules.values()].map(publicModule)),
    events:(limit=40)=>clone(events.slice(0,Math.max(0,Math.min(EVENT_LIMIT,Number(limit)||0)))),
    isValidModuleId:value=>MODULE_ID.test(String(value||""))
  });
  globalThis.Win11Platform=api;

  registerModule({
    id:"platform",version:VERSION,layer:"core",
    provides:["module-registry","lifecycle","health","diagnostics"]
  });
  setStatus("platform","ready",{foundation:true});

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:46,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "v10-platform-foundation","module-registry-v1","module-lifecycle-v1",
      "central-health-v1","bounded-platform-diagnostics"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
