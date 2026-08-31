"use strict";
(function installSystemBusV981(){
  const VERSION="9.8.1";
  const TOPIC=/^[a-z][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)*$/;
  const listeners=new Map(),history=[],errors=[];
  const HISTORY_LIMIT=80,ERROR_LIMIT=20;
  let sequence=0;

  function assertTopic(topic){
    topic=String(topic||"");
    if(!TOPIC.test(topic))throw new TypeError("Invalid system bus topic.");
    return topic;
  }
  function clone(value){
    if(value===undefined)return null;
    try{return structuredClone(value)}
    catch{
      try{return JSON.parse(JSON.stringify(value))}
      catch{throw new TypeError("System bus payload must be serializable.")}
    }
  }
  function recordError(topic,error){
    errors.unshift({topic,message:String(error?.message||error),time:Date.now()});
    if(errors.length>ERROR_LIMIT)errors.length=ERROR_LIMIT;
  }

  function emit(topic,detail={}){
    topic=assertTopic(topic);
    const event=Object.freeze({
      id:"bus-"+(++sequence),
      topic,time:Date.now(),
      detail:clone(detail)
    });
    history.unshift(clone(event));
    if(history.length>HISTORY_LIMIT)history.length=HISTORY_LIMIT;
    const targets=[listeners.get(topic),listeners.get("*")];
    for(const set of targets){
      if(!set)continue;
      for(const fn of [...set]){
        try{fn(clone(event))}
        catch(error){recordError(topic,error)}
      }
    }
    try{
      document.dispatchEvent(new CustomEvent("win11:"+topic,{detail:clone(event)}));
    }catch(error){recordError(topic,error)}
    return clone(event);
  }
  function on(topic,handler){
    if(topic!=="*")topic=assertTopic(topic);
    if(typeof handler!=="function")throw new TypeError("System bus handler must be a function.");
    if(!listeners.has(topic))listeners.set(topic,new Set());
    listeners.get(topic).add(handler);
    let active=true;
    return ()=>{

      if(!active)return false;
      active=false;
      const set=listeners.get(topic);
      set?.delete(handler);
      if(set?.size===0)listeners.delete(topic);
      return true;
    };
  }
  function once(topic,handler){
    let off=null;
    off=on(topic,event=>{off?.();handler(event)});
    return off;
  }
  function getHistory(topic=null,limit=40){
    if(topic!==null)topic=assertTopic(topic);
    limit=Math.max(0,Math.min(HISTORY_LIMIT,Number(limit)||0));
    const rows=topic?history.filter(e=>e.topic===topic):history;
    return clone(rows.slice(0,limit));
  }
  function diagnostics(){
    return Object.freeze({
      version:VERSION,
      listenerTopics:[...listeners.keys()].filter(k=>k!=="*"),
      listenerCount:[...listeners.values()].reduce((n,s)=>n+s.size,0),
      historySize:history.length,
      errors:clone(errors)
    });
  }

  globalThis.Win11SystemBus=Object.freeze({
    version:VERSION,emit,on,once,getHistory,diagnostics,
    isValidTopic:topic=>TOPIC.test(String(topic||""))
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:31,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "system-integration-bus","typed-system-events","bounded-system-event-history"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
