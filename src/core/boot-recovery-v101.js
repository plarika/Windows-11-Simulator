"use strict";
(function installBootRecoveryV101(){
  const VERSION="10.1.0";
  const GUARD_KEY="win11-sim-boot-guard-v101";
  const PHASES=new Set(["compatibility","runtime","state","session","recovery","shell"]);
  const EVENT_LIMIT=96,PHASE_LIMIT=48;
  const platform=globalThis.Win11Platform;
  const events=[],phases=new Map();
  let currentRunId="",completed=false,sequence=0;

  if(!platform||typeof platform.registerModule!=="function"){
    throw new Error("Boot Recovery V10.1 requires Platform V10.");
  }
  function clone(value){
    if(value===undefined)return null;
    try{return structuredClone(value)}
    catch{
      try{return JSON.parse(JSON.stringify(value))}
      catch{return null}
    }
  }
  function safeText(value,max=160){
    return String(value??"").trim().slice(0,max);
  }
  function boundedInt(value,min,max,fallback=0){
    const n=Math.trunc(Number(value));
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
  }
  function blankGuard(){
    return {
      schemaVersion:1,currentRunId:"",startedAt:0,lastCompletedAt:0,
      consecutiveIncomplete:0,lastFailureReason:""
    };
  }
  function loadGuard(){
    try{
      const raw=JSON.parse(sessionStorage.getItem(GUARD_KEY)||"null");
      if(!raw||typeof raw!=="object"||Array.isArray(raw))return blankGuard();
      return {
        schemaVersion:1,
        currentRunId:safeText(raw.currentRunId,72),
        startedAt:boundedInt(raw.startedAt,0,Number.MAX_SAFE_INTEGER,0),
        lastCompletedAt:boundedInt(raw.lastCompletedAt,0,Number.MAX_SAFE_INTEGER,0),
        consecutiveIncomplete:boundedInt(raw.consecutiveIncomplete,0,10,0),
        lastFailureReason:safeText(raw.lastFailureReason,96)
      };
    }catch{return blankGuard()}
  }
  function saveGuard(value){
    try{
      sessionStorage.setItem(GUARD_KEY,JSON.stringify(value));
      return true;
    }catch{return false}
  }
  function record(type,detail={}){
    const entry={
      id:"boot-v101-"+(++sequence),version:VERSION,time:Date.now(),
      type:safeText(type,48),detail:clone(detail)
    };
    events.unshift(entry);
    if(events.length>EVENT_LIMIT)events.length=EVENT_LIMIT;
    try{globalThis.Win11SystemBus?.emit?.("boot-recovery:"+entry.type,{version:VERSION,...entry.detail})}catch{}
    return clone(entry);
  }
  function phaseSnapshot(){
    return [...phases.values()]
      .sort((a,b)=>a.order-b.order)
      .slice(0,PHASE_LIMIT)
      .map(clone);
  }
  function beginBoot({source="boot"}={}){
    const guard=loadGuard();
    if(guard.currentRunId){
      guard.consecutiveIncomplete=Math.min(10,guard.consecutiveIncomplete+1);
    }
    currentRunId="run-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10);
    guard.currentRunId=currentRunId;
    guard.startedAt=Date.now();
    guard.lastFailureReason="";
    saveGuard(guard);
    phases.clear();
    completed=false;
    record("started",{
      source:safeText(source,48),
      consecutiveIncomplete:guard.consecutiveIncomplete
    });
    return Object.freeze({
      runId:currentRunId,
      consecutiveIncomplete:guard.consecutiveIncomplete,
      safeModeRecommended:guard.consecutiveIncomplete>=2
    });
  }
  function assertPhase(name){
    name=safeText(name,32);
    if(!PHASES.has(name))throw new TypeError("Invalid boot phase.");
    return name;
  }
  async function runPhase(name,task,{timeoutMs=4000,required=true}={}){
    name=assertPhase(name);
    if(typeof task!=="function")throw new TypeError("Boot phase task must be a function.");
    timeoutMs=boundedInt(timeoutMs,100,15000,4000);
    const startedAt=Date.now(),order=phases.size;
    phases.set(name,{name,order,status:"running",required:Boolean(required),startedAt,endedAt:0,durationMs:0,reason:""});
    record("phase-start",{name,required:Boolean(required),timeoutMs});
    let timer=0;
    try{
      const timeout=new Promise((_,reject)=>{
        timer=setTimeout(()=>{
          const error=new Error("Boot phase timed out: "+name);
          error.code="BOOT_PHASE_TIMEOUT";
          reject(error);
        },timeoutMs);
      });
      const value=await Promise.race([Promise.resolve().then(task),timeout]);
      clearTimeout(timer);
      const endedAt=Date.now(),row=phases.get(name);
      Object.assign(row,{status:"ready",endedAt,durationMs:endedAt-startedAt});
      record("phase-ready",{name,durationMs:row.durationMs});
      return {ok:true,status:"ready",value};
    }catch(error){
      clearTimeout(timer);
      const endedAt=Date.now(),row=phases.get(name);
      const reason=error?.code==="BOOT_PHASE_TIMEOUT"?"timeout":"error";
      Object.assign(row,{status:required?"failed":"degraded",endedAt,durationMs:endedAt-startedAt,reason});
      record("phase-"+row.status,{name,reason,message:safeText(error?.message||error,200)});
      return {ok:false,status:row.status,error,reason};
    }
  }
  function completeBoot(detail={}){
    const guard=loadGuard();
    guard.currentRunId="";
    guard.startedAt=0;
    guard.consecutiveIncomplete=0;
    guard.lastFailureReason="";
    guard.lastCompletedAt=Date.now();
    saveGuard(guard);
    completed=true;
    record("completed",{
      durationMs:Math.max(0,Date.now()-(phases.get("compatibility")?.startedAt||Date.now())),
      ...clone(detail)
    });
    return true;
  }
  function failBoot(reason,error=null){
    const guard=loadGuard();
    guard.lastFailureReason=safeText(reason||error?.message||"boot-failure",96);
    saveGuard(guard);
    completed=false;
    record("failed",{
      reason:guard.lastFailureReason,
      message:safeText(error?.message||"",200)
    });
    return false;
  }
  function clearBootGuard({source="api"}={}){
    saveGuard(blankGuard());
    currentRunId="";
    record("guard-cleared",{source:safeText(source,48)});
    return true;
  }
  function recoveryPlan(){
    const guard=loadGuard();
    let recovery=null,safeActive=false;
    try{recovery=globalThis.Win11SessionRecovery?.statusInfo?.()||null}catch{}
    try{safeActive=Boolean(globalThis.Win11SafeMode?.isActive)}catch{}
    let mode="normal";
    if(safeActive)mode="safe-mode-active";
    else if(recovery?.recoveryPending)mode=recovery.autoResume?"session-auto-recovery":"session-recovery-choice";
    else if(guard.consecutiveIncomplete>=2)mode="safe-mode-recommended";
    return Object.freeze({
      version:VERSION,mode,
      bootIncompleteCount:guard.consecutiveIncomplete,
      lastFailureReason:guard.lastFailureReason,
      sessionRecoveryPending:Boolean(recovery?.recoveryPending),
      sessionAutoResume:Boolean(recovery?.autoResume),
      safeModeActive:safeActive
    });
  }
  function diagnostics(){
    const guard=loadGuard(),plan=recoveryPlan();
    return Object.freeze({
      version:VERSION,runId:currentRunId,completed,
      guard:Object.freeze({
        consecutiveIncomplete:guard.consecutiveIncomplete,
        lastFailureReason:guard.lastFailureReason,
        hasActiveRun:Boolean(guard.currentRunId),
        lastCompletedAt:guard.lastCompletedAt
      }),
      plan,phases:phaseSnapshot(),
      eventCount:events.length,
      recentEvents:clone(events.slice(0,32))
    });
  }
  const api=Object.freeze({
    version:VERSION,beginBoot,runPhase,completeBoot,failBoot,clearBootGuard,
    recoveryPlan,diagnostics,
    phases:()=>Object.freeze(phaseSnapshot()),
    events:(limit=24)=>Object.freeze(clone(events.slice(0,boundedInt(limit,0,EVENT_LIMIT,24))))
  });
  globalThis.Win11BootRecovery=api;

  if(!platform.inspect("boot-recovery")){
    platform.registerModule({
      id:"boot-recovery",version:VERSION,layer:"core",
      requires:["platform","session-restore","session-recovery","safe-mode"],
      provides:["boot-phases","boot-timeouts","boot-loop-guard","recovery-plan"],
      start:()=>{record("module-start",{});return true},
      health:()=>({
        completed,
        phaseCount:phases.size,
        recoveryMode:recoveryPlan().mode,
        incompleteBoots:loadGuard().consecutiveIncomplete
      })
    });
  }
  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:47,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "boot-recovery-v101","boot-phase-orchestration","boot-timeout-guards",
      "boot-loop-detection","central-recovery-plan"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
