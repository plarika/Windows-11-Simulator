"use strict";
(function installSettingsCoreV981(){
  const VERSION="9.8.1",SCHEMA_VERSION=1,MAX_IMPORT_BYTES=65536;
  const BLOCKED=new Set(["__proto__","prototype","constructor"]);
  const ACCENTS=["#0078d4","#3cc7e8","#8764b8","#c239b3","#e74856","#ff8c00","#107c10","#00b7c3"];
  const DEFAULTS={
    appearance:{themeMode:"light",accent:"#0078d4",transparency:true,animations:true,wallpaperIndex:0},
    taskbar:{alignment:"center",groupWindows:"when-multiple",showBadges:true,showProgress:true,previews:true,autoHide:false,showDesktop:true,showSeconds:false},
    explorer:{showHidden:false,showExtensions:true,compactView:false,openTo:"home",confirmDelete:true},
    apps:{defaultBrowser:"edge",defaultText:"notepad",defaultImage:"photos",defaultMedia:"mediaplayer"},
    storage:{cleanupEnabled:false,recycleBinEnabled:true},
    accessibility:{textScale:100,highContrast:false,narrator:false,stickyKeys:false},
    notifications:{enabled:true,focusMode:"off"},
    system:{brightness:100,volume:67,snapEnabled:true},
    privacy:{location:false,camera:true,microphone:true,diagnostics:false}
  };
  const SCHEMA={
    appearance:{themeMode:{type:"enum",values:["light","dark","system"]},accent:{type:"enum",values:ACCENTS},transparency:{type:"boolean"},animations:{type:"boolean"},wallpaperIndex:{type:"integer",min:0,max:7}},
    taskbar:{alignment:{type:"enum",values:["center","left"]},groupWindows:{type:"enum",values:["always","when-multiple","never"]},showBadges:{type:"boolean"},showProgress:{type:"boolean"},previews:{type:"boolean"},autoHide:{type:"boolean"},showDesktop:{type:"boolean"},showSeconds:{type:"boolean"}},

    explorer:{showHidden:{type:"boolean"},showExtensions:{type:"boolean"},compactView:{type:"boolean"},openTo:{type:"enum",values:["home","this-pc"]},confirmDelete:{type:"boolean"}},
    apps:{defaultBrowser:{type:"enum",values:["edge"]},defaultText:{type:"enum",values:["notepad"]},defaultImage:{type:"enum",values:["photos","paint"]},defaultMedia:{type:"enum",values:["mediaplayer"]}},
    storage:{cleanupEnabled:{type:"boolean"},recycleBinEnabled:{type:"boolean"}},
    accessibility:{textScale:{type:"integer",min:90,max:160},highContrast:{type:"boolean"},narrator:{type:"boolean"},stickyKeys:{type:"boolean"}},
    notifications:{enabled:{type:"boolean"},focusMode:{type:"enum",values:["off","priority","alarms"]}},
    system:{brightness:{type:"integer",min:30,max:100},volume:{type:"integer",min:0,max:100},snapEnabled:{type:"boolean"}},
    privacy:{location:{type:"boolean"},camera:{type:"boolean"},microphone:{type:"boolean"},diagnostics:{type:"boolean"}}
  };

  function clone(value){return structuredClone(value)}
  function plain(value){
    if(!value||typeof value!=="object"||Array.isArray(value))return false;
    const proto=Object.getPrototypeOf(value);
    return proto===Object.prototype||proto===null;
  }
  function checksum(value){
    const text=JSON.stringify(value);let h=2166136261;
    for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}
    return (h>>>0).toString(16).padStart(8,"0");
  }
  function validateValue(rule,value){
    if(rule.type==="boolean")return typeof value==="boolean";
    if(rule.type==="integer")return Number.isInteger(value)&&value>=rule.min&&value<=rule.max;

    if(rule.type==="enum")return rule.values.includes(value);
    return false;
  }
  function parsePath(path){
    const parts=Array.isArray(path)?path.map(String):String(path||"").split(".");
    if(parts.length!==2||parts.some(p=>!p||BLOCKED.has(p)))throw new TypeError("Settings path must be category.key.");
    const [category,key]=parts,rule=SCHEMA[category]?.[key];
    if(!rule)throw new RangeError("Unknown settings path: "+category+"."+key);
    return {category,key,rule,path:category+"."+key};
  }
  function strictData(input){
    if(!plain(input))throw new TypeError("Settings data must be an object.");
    for(const category of Object.keys(input)){
      if(BLOCKED.has(category)||!SCHEMA[category])throw new RangeError("Unknown settings category: "+category);
      if(!plain(input[category]))throw new TypeError("Settings category must be an object: "+category);
      for(const key of Object.keys(input[category])){
        if(BLOCKED.has(key)||!SCHEMA[category][key])throw new RangeError("Unknown settings key: "+category+"."+key);
      }
    }
    const out=clone(DEFAULTS);
    for(const [category,rules] of Object.entries(SCHEMA)){
      const source=input[category]||{};
      for(const [key,rule] of Object.entries(rules)){
        if(Object.prototype.hasOwnProperty.call(source,key)){
          if(!validateValue(rule,source[key]))throw new TypeError("Invalid setting value: "+category+"."+key);
          out[category][key]=source[key];
        }
      }
    }
    return out;
  }

  function fromLegacy(){
    const out=clone(DEFAULTS),p=state.personalizationV78||{},fs=state.explorerFilesystemV91||{};
    out.appearance.themeMode=["light","dark","system"].includes(p.themeMode)?p.themeMode:(state.theme==="dark"?"dark":"light");
    if(ACCENTS.includes(p.accent))out.appearance.accent=p.accent;
    out.appearance.transparency=p.transparency!==false;
    out.appearance.animations=p.animations!==false;
    out.appearance.wallpaperIndex=Math.max(0,Math.min(7,Number(p.wallpaperIndex??state.wallpaper)||0));
    out.taskbar.alignment=p.taskbarAlignment==="left"?"left":"center";
    out.explorer.showHidden=!!fs.showHidden;
    out.explorer.showExtensions=fs.showExtensions!==false;
    const a=state.accessibility||{},privacy=state.privacy||{},nc=state.notificationCenterV77||{};
    if(Number.isInteger(a.textScale)&&a.textScale>=90&&a.textScale<=160)out.accessibility.textScale=a.textScale;
    out.accessibility.highContrast=!!a.highContrast;
    out.accessibility.narrator=!!a.narrator;
    out.accessibility.stickyKeys=!!a.stickyKeys;
    out.notifications.enabled=privacy.notifications!==false;
    if(["off","priority","alarms"].includes(nc.focusMode))out.notifications.focusMode=nc.focusMode;
    if(Number.isInteger(state.brightness)&&state.brightness>=30&&state.brightness<=100)out.system.brightness=state.brightness;
    if(Number.isInteger(state.volume)&&state.volume>=0&&state.volume<=100)out.system.volume=state.volume;
    for(const key of ["location","camera","microphone","diagnostics"])if(typeof privacy[key]==="boolean")out.privacy[key]=privacy[key];
    return out;
  }
  function sanitizedData(input,fallback){
    const out=clone(fallback||DEFAULTS);
    if(!plain(input))return out;
    for(const [category,rules] of Object.entries(SCHEMA)){
      const source=plain(input[category])?input[category]:{};

      for(const [key,rule] of Object.entries(rules)){
        const value=source[key];
        if(validateValue(rule,value))out[category][key]=value;
      }
    }
    return out;
  }
  function ensureDoc(){
    const legacy=fromLegacy(),current=state.settingsV98;
    if(!plain(current)||Number(current.schemaVersion)!==SCHEMA_VERSION||!plain(current.data)){
      state.settingsV98={schemaVersion:SCHEMA_VERSION,revision:1,updatedAt:Date.now(),data:legacy};
      state.settingsV98.checksum=checksum(state.settingsV98.data);saveState();
      return state.settingsV98;
    }
    const clean=sanitizedData(current.data,legacy),sum=checksum(clean);
    const changed=JSON.stringify(clean)!==JSON.stringify(current.data)||current.checksum!==sum;
    current.schemaVersion=SCHEMA_VERSION;
    current.revision=Math.max(1,Number(current.revision)||1);
    current.updatedAt=Math.max(0,Number(current.updatedAt)||0);
    current.data=clean;current.checksum=sum;
    if(changed){current.revision++;current.updatedAt=Date.now();saveState()}
    return current;
  }
  function ensureLegacyObjects(){
    if(!plain(state.personalizationV78))state.personalizationV78={};
    if(!plain(state.explorerFilesystemV91))state.explorerFilesystemV91={schemaVersion:1,metadata:{}};
    if(!plain(state.accessibility))state.accessibility={};
    if(!plain(state.privacy))state.privacy={};
    if(!plain(state.notificationCenterV77))state.notificationCenterV77={};
  }

  function syncLegacy(path,value){
    ensureLegacyObjects();
    const [category,key]=path.split(".");
    if(category==="appearance"){
      const map={themeMode:"themeMode",accent:"accent",transparency:"transparency",animations:"animations",wallpaperIndex:"wallpaperIndex"};
      state.personalizationV78[map[key]]=value;
      if(key==="themeMode"&&value!=="system")state.theme=value;
      if(key==="wallpaperIndex")state.wallpaper=Math.min(2,value);
    }else if(category==="taskbar"&&key==="alignment")state.personalizationV78.taskbarAlignment=value;
    else if(category==="explorer"&&key==="showHidden")state.explorerFilesystemV91.showHidden=value;
    else if(category==="explorer"&&key==="showExtensions")state.explorerFilesystemV91.showExtensions=value;
    else if(category==="accessibility")state.accessibility[key]=value;
    else if(category==="notifications"&&key==="enabled")state.privacy.notifications=value;
    else if(category==="notifications"&&key==="focusMode")state.notificationCenterV77.focusMode=value;
    else if(category==="system"&&(key==="brightness"||key==="volume"))state[key]=value;
    else if(category==="privacy")state.privacy[key]=value;
  }
  function emitChange(change){
    const bus=globalThis.Win11SystemBus;
    if(!bus?.emit)return;
    bus.emit("settings:changed",change);
    bus.emit("settings:"+change.category+":changed",change);
  }
  function commit(changes,{source="api"}={}){
    const doc=ensureDoc(),prepared=[];
    for(const item of changes){
      const p=parsePath(item.path);
      if(!validateValue(p.rule,item.value))throw new TypeError("Invalid setting value: "+p.path);
      prepared.push({...p,value:item.value});
    }

    const unique=new Map();for(const item of prepared)unique.set(item.path,item);
    const applied=[];
    for(const item of unique.values()){
      const previous=doc.data[item.category][item.key];
      if(Object.is(previous,item.value))continue;
      applied.push({...item,previous});
    }
    if(!applied.length)return {changed:false,revision:doc.revision,changes:[]};
    for(const item of applied){
      doc.data[item.category][item.key]=item.value;
      syncLegacy(item.path,item.value);
    }
    doc.revision++;doc.updatedAt=Date.now();doc.checksum=checksum(doc.data);saveState();
    const publicChanges=applied.map(item=>({
      path:item.path,category:item.category,key:item.key,
      previous:clone(item.previous),value:clone(item.value),
      revision:doc.revision,source:String(source).slice(0,64)
    }));
    for(const change of publicChanges)emitChange(change);
    globalThis.Win11SystemBus?.emit?.("settings:committed",{
      revision:doc.revision,paths:publicChanges.map(c=>c.path),source:String(source).slice(0,64)
    });
    return {changed:true,revision:doc.revision,changes:clone(publicChanges)};
  }
  function get(path=null){
    const doc=ensureDoc();
    if(path===null||path===undefined)return clone(doc.data);
    if(typeof path==="string"&&!path.includes(".")){
      if(BLOCKED.has(path)||!SCHEMA[path])throw new RangeError("Unknown settings category: "+path);
      return clone(doc.data[path]);
    }
    const p=parsePath(path);return clone(doc.data[p.category][p.key]);
  }
  function set(path,value,options={}){return commit([{path,value}],options).changed}

  function update(category,patch,options={}){
    category=String(category||"");
    if(BLOCKED.has(category)||!SCHEMA[category])throw new RangeError("Unknown settings category: "+category);
    if(!plain(patch))throw new TypeError("Settings patch must be an object.");
    const changes=[];
    for(const [key,value] of Object.entries(patch)){
      if(BLOCKED.has(key)||!SCHEMA[category][key])throw new RangeError("Unknown settings key: "+category+"."+key);
      changes.push({path:category+"."+key,value});
    }
    return commit(changes,options);
  }
  function resetCategory(category,options={}){
    category=String(category||"");
    if(!DEFAULTS[category])throw new RangeError("Unknown settings category: "+category);
    return update(category,clone(DEFAULTS[category]),{...options,source:options.source||"reset-category"});
  }
  function resetAll(options={}){
    const changes=[];
    for(const [category,values] of Object.entries(DEFAULTS))for(const [key,value] of Object.entries(values))changes.push({path:category+"."+key,value});
    return commit(changes,{...options,source:options.source||"reset-all"});
  }
  function exportConfig(){
    const doc=ensureDoc(),data=clone(doc.data);
    return {
      kind:"win11-simulator-settings",version:VERSION,schemaVersion:SCHEMA_VERSION,
      exportedAt:Date.now(),data,integrity:{algorithm:"fnv1a32",value:checksum(data)}
    };
  }
  function importConfig(input,options={}){
    let parsed=input;
    if(typeof input==="string"){
      if(new TextEncoder().encode(input).byteLength>MAX_IMPORT_BYTES)throw new RangeError("Settings import exceeds 64 KB.");

      try{parsed=JSON.parse(input)}catch{throw new SyntaxError("Settings import is not valid JSON.")}
    }
    if(!plain(parsed)||parsed.kind!=="win11-simulator-settings")throw new TypeError("Unsupported settings import.");
    if(Number(parsed.schemaVersion)!==SCHEMA_VERSION)throw new RangeError("Unsupported settings schema version.");
    const data=strictData(parsed.data);
    if(parsed.integrity){
      if(parsed.integrity.algorithm!=="fnv1a32"||parsed.integrity.value!==checksum(data))throw new Error("Settings import integrity check failed.");
    }
    const changes=[];
    for(const [category,values] of Object.entries(data))for(const [key,value] of Object.entries(values))changes.push({path:category+"."+key,value});
    return commit(changes,{...options,source:options.source||"import"});
  }
  function metadata(){
    const doc=ensureDoc();
    return Object.freeze({
      version:VERSION,schemaVersion:SCHEMA_VERSION,revision:doc.revision,
      updatedAt:doc.updatedAt,checksum:doc.checksum,maxImportBytes:MAX_IMPORT_BYTES
    });
  }
  function schema(){
    return clone(SCHEMA);
  }
  function validate(path,value){
    try{const p=parsePath(path);return validateValue(p.rule,value)}catch{return false}
  }

  ensureDoc();
  globalThis.Win11SettingsStore=Object.freeze({
    version:VERSION,schemaVersion:SCHEMA_VERSION,
    get,set,update,resetCategory,resetAll,exportConfig,importConfig,metadata,schema,validate

  });
  globalThis.Win11SystemBus?.emit?.("settings:ready",metadata());
  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:31,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "settings-schema-v1","settings-profile-store","settings-validation",
      "settings-migration","settings-import-export","settings-integrity-check",
      "settings-atomic-commit","settings-change-events"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
