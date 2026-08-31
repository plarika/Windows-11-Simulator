"use strict";
/* Windows 11 Simulator V7.7 — Notifications, Action Center & Background Services */
(function installNotificationsBackgroundV770(){
  const previousNotify=globalThis.notify;
  const previousBuildServices=globalThis.buildServices;
  const previousBuildTaskScheduler=globalThis.buildTaskScheduler;
  const previousRenderSettingsPage=globalThis.renderSettingsPageV5;
  const TASK_TICK_MS=5000;
  let schedulerTimer=null;
  let toastTimers=new Map();

  const DEFAULT_APP_RULES={
    "Windows Simulator":{enabled:true,banners:true,priority:true},
    "Windows Update":{enabled:true,banners:true,priority:true},
    "Segurança do Windows":{enabled:true,banners:true,priority:true},
    "Agendador de Tarefas":{enabled:true,banners:true,priority:false},
    "Explorador":{enabled:true,banners:true,priority:false},
    "Centro do dispositivo":{enabled:true,banners:true,priority:false}
  };

  function id(prefix="n"){
    return prefix+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
  }
  function now(){return Date.now()}
  function clone(v){try{return structuredClone(v)}catch{return JSON.parse(JSON.stringify(v))}}
  function ensureState(){
    state.notificationCenterV77=Object.assign({
      focusMode:"off",
      quietUntil:0,
      appRules:{},
      unread:0,
      historyLimit:120
    },state.notificationCenterV77||{});
    state.notificationCenterV77.appRules=Object.assign({},DEFAULT_APP_RULES,state.notificationCenterV77.appRules||{});
    state.notificationHistoryV77=Array.isArray(state.notificationHistoryV77)?state.notificationHistoryV77:[];
    state.backgroundActivityV77=Object.assign({
      enabled:true,
      lastTick:0,
      runs:[],
      maxRuns:80
    },state.backgroundActivityV77||{});
    state.notifications=Array.isArray(state.notifications)?state.notifications:[];
    state.notifications.forEach((n,i)=>{
      n.id=n.id||id("legacy");
      n.title=String(n.title||"Windows 11 Simulator");
      n.message=String(n.message||"");
      n.time=Number(n.time)||now();
      n.source=n.source||n.title;
      n.appId=n.appId||null;
      n.category=n.category||"general";
      n.priority=n.priority||"normal";
      n.read=Boolean(n.read);
      n.snoozedUntil=Number(n.snoozedUntil)||0;
      n.actions=Array.isArray(n.actions)?n.actions:[];
      n.sequence=Number(n.sequence)||i;
    });
    migrateTasks();
    migrateServices();
  }

  function migrateServices(){
    if(!Array.isArray(state.services))return;
    state.services.forEach((s,i)=>{
      s.startup=s.startup||"Manual";
      s.status=s.status||"Stopped";
      s.pid=Number(s.pid)||0;
      s.lastChanged=Number(s.lastChanged)||now()-i*1000;
      s.restarts=Number(s.restarts)||0;
      s.failureCount=Number(s.failureCount)||0;
      s.description=s.description||s.display||s.name;
    });
  }

  function defaultTaskMeta(task,index){
    const name=String(task.name||"").toLowerCase();
    if(name.includes("storage sense"))return {intervalMinutes:120,action:"storage-sense"};
    if(name.includes("update"))return {intervalMinutes:180,action:"update-check"};
    if(name.includes("maintenance"))return {intervalMinutes:60,action:"maintenance"};
    return {intervalMinutes:30+index*15,action:"notification"};
  }

  function migrateTasks(){
    if(!Array.isArray(state.scheduledTasks))state.scheduledTasks=[];
    state.scheduledTasks.forEach((t,i)=>{
      const meta=defaultTaskMeta(t,i);
      t.id=t.id||id("task");
      t.enabled=t.enabled!==false;
      t.status=t.status||"Ready";
      t.lastRun=Number(t.lastRun)||0;
      t.lastResult=t.lastResult||"Nunca executada";
      t.runCount=Number(t.runCount)||0;
      t.intervalMinutes=Math.max(1,Number(t.intervalMinutes)||meta.intervalMinutes);
      t.action=t.action||meta.action;
      t.nextRun=Number(t.nextRun)||(now()+t.intervalMinutes*60000);
      t.folder=t.folder||"\\FantaMK";
    });
  }

  function centerState(){ensureState();return state.notificationCenterV77}
  function ruleFor(source){
    const c=centerState(),key=String(source||"Windows Simulator");
    c.appRules[key]=Object.assign({enabled:true,banners:true,priority:false},c.appRules[key]||{});
    return c.appRules[key];
  }
  function isQuiet(){
    const c=centerState();
    return c.focusMode!=="off" || (Number(c.quietUntil)||0)>now();
  }
  function focusAllows(notification){
    const c=centerState();
    if(Number(c.quietUntil)>now()){
      return notification.priority==="high"||notification.category==="alarm"||ruleFor(notification.source).priority;
    }
    if(c.focusMode==="off")return true;
    if(c.focusMode==="alarms")return notification.category==="alarm";
    return notification.priority==="high"||notification.category==="alarm"||ruleFor(notification.source).priority;
  }
  function activeNotifications(){
    ensureState();
    const t=now();
    return state.notifications.filter(n=>!n.dismissed&&(!n.snoozedUntil||n.snoozedUntil<=t));
  }
  function syncUnread(save=true){
    const count=activeNotifications().filter(n=>!n.read).length;
    state.notificationCenterV77.unread=count;
    const btn=document.getElementById("notify-btn");
    if(btn){
      let badge=btn.querySelector(".notification-badge-v77");
      if(!badge){
        badge=document.createElement("span");
        badge.className="notification-badge-v77";
        btn.appendChild(badge);
      }
      badge.textContent=count>99?"99+":String(count);
      badge.hidden=count===0;
      btn.classList.toggle("has-unread-v77",count>0);
    }
    if(save)saveState();
    return count;
  }

  function logHistory(n,event="created"){
    state.notificationHistoryV77.unshift({
      id:n.id,title:n.title,message:n.message,source:n.source,appId:n.appId,
      category:n.category,priority:n.priority,event,time:now()
    });
    state.notificationHistoryV77=state.notificationHistoryV77.slice(0,centerState().historyLimit||120);
  }

  function showRichToast(n){
    const stack=document.getElementById("toast-stack");
    if(!stack)return;
    const t=document.createElement("div");
    t.className="toast notification-toast-v77 priority-"+n.priority;
    t.dataset.notificationId=n.id;
    const app=APPS?.[n.appId];
    t.innerHTML=
      '<div class="toast-v77-head"><span>'+escapeHTML(app?.icon||"●")+'</span><strong>'+escapeHTML(n.title)+'</strong><button data-toast-close>✕</button></div>'+
      '<div class="toast-v77-body">'+escapeHTML(n.message)+'</div>'+
      (n.actions?.length?'<div class="toast-v77-actions">'+n.actions.slice(0,2).map((a,i)=>'<button data-toast-action="'+i+'">'+escapeHTML(a.label||"Ação")+'</button>').join("")+'</div>':"");
    t.querySelector("[data-toast-close]").onclick=e=>{e.stopPropagation();dismissNotification(n.id);t.remove()};
    t.querySelectorAll("[data-toast-action]").forEach(b=>b.onclick=e=>{
      e.stopPropagation();runNotificationAction(n.id,Number(b.dataset.toastAction));t.remove();
    });
    t.onclick=()=>activateNotification(n.id);
    stack.appendChild(t);
    const timer=setTimeout(()=>{t.remove();toastTimers.delete(n.id)},5200);
    toastTimers.set(n.id,timer);
  }

  function normalizeOptions(title,options={}){
    const o=options&&typeof options==="object"?options:{};
    return {
      source:String(o.source||title||"Windows Simulator"),
      appId:o.appId||null,
      category:o.category||"general",
      priority:o.priority==="high"?"high":o.priority==="low"?"low":"normal",
      actions:Array.isArray(o.actions)?o.actions.slice(0,3).map(a=>({
        label:String(a.label||"Ação"),
        type:String(a.type||"open-app"),
        appId:a.appId||null,
        path:a.path||null,
        value:a.value??null
      })):[],
      silent:Boolean(o.silent),
      real:o.real!==false,
      replaceKey:o.replaceKey||null
    };
  }

  function pushNotification(title,message,options={}){
    ensureState();
    const o=normalizeOptions(title,options),rule=ruleFor(o.source);
    if(!rule.enabled)return null;
    const existing=o.replaceKey?state.notifications.find(n=>n.replaceKey===o.replaceKey&&!n.dismissed):null;
    const n=existing||{
      id:id("notif"),time:now(),read:false,dismissed:false,snoozedUntil:0,sequence:0
    };
    Object.assign(n,{
      title:String(title||"Windows 11 Simulator"),
      message:String(message||""),
      source:o.source,appId:o.appId,category:o.category,priority:o.priority,
      actions:o.actions,replaceKey:o.replaceKey,time:now(),read:false,dismissed:false,snoozedUntil:0
    });
    if(!existing)state.notifications.unshift(n);
    state.notifications=state.notifications.slice(0,80);
    logHistory(n,existing?"updated":"created");
    saveState();
    renderNotificationsV77();
    syncUnread();
    const showBanner=!o.silent&&rule.banners&&focusAllows(n);
    if(showBanner)showRichToast(n);
    if(showBanner&&o.real&&globalThis.RealPlatformBridge?.sendRealNotification){
      try{RealPlatformBridge.sendRealNotification(n.title,n.message)}catch{}
    }
    return n.id;
  }

  globalThis.notify=function(title,message,options){
    return pushNotification(title,message,options||{});
  };
  try{notify=globalThis.notify}catch{}

  function findNotification(id){return state.notifications.find(n=>n.id===id)}
  function markRead(id,read=true){
    const n=findNotification(id);if(!n)return false;
    n.read=Boolean(read);saveState();syncUnread(false);renderNotificationsV77();return true;
  }
  function markAllRead(){
    activeNotifications().forEach(n=>n.read=true);
    saveState();syncUnread(false);renderNotificationsV77();
  }
  function dismissNotification(id){
    const n=findNotification(id);if(!n)return false;
    n.dismissed=true;n.read=true;logHistory(n,"dismissed");
    saveState();syncUnread(false);renderNotificationsV77();return true;
  }
  function clearAll(){
    activeNotifications().forEach(n=>{n.dismissed=true;n.read=true;logHistory(n,"cleared")});
    saveState();syncUnread(false);renderNotificationsV77();
  }
  function snoozeNotification(id,minutes=15){
    const n=findNotification(id);if(!n)return false;
    n.snoozedUntil=now()+Math.max(1,Number(minutes)||15)*60000;
    n.read=true;logHistory(n,"snoozed");
    saveState();syncUnread(false);renderNotificationsV77();return true;
  }
  function activateNotification(id){
    const n=findNotification(id);if(!n)return false;
    n.read=true;saveState();syncUnread(false);
    if(n.appId&&APPS?.[n.appId]){closeOverlays();openApp(n.appId)}
    renderNotificationsV77();return true;
  }
  function runNotificationAction(id,index){
    const n=findNotification(id),a=n?.actions?.[index];if(!a)return false;
    n.read=true;logHistory(n,"action:"+a.type);
    if(a.type==="open-app"&&a.appId&&APPS?.[a.appId]){
      closeOverlays();openApp(a.appId,a.path||undefined);
    }else if(a.type==="open-path"&&a.path){
      closeOverlays();openApp("explorer",a.path);
    }else if(a.type==="dismiss"){
      n.dismissed=true;
    }else if(a.type==="snooze"){
      n.snoozedUntil=now()+Math.max(1,Number(a.value)||15)*60000;
    }else if(a.type==="device-center"&&globalThis.Win11DeviceCenter){
      Win11DeviceCenter.open();
    }
    saveState();syncUnread(false);renderNotificationsV77();return true;
  }

  function timeLabel(ts){
    const delta=Math.max(0,now()-Number(ts||0));
    if(delta<60000)return "agora";
    if(delta<3600000)return Math.floor(delta/60000)+" min";
    if(delta<86400000)return Math.floor(delta/3600000)+" h";
    return new Date(ts).toLocaleDateString("pt-PT",{day:"2-digit",month:"2-digit"});
  }
  function iconFor(n){return APPS?.[n.appId]?.icon||({alarm:"⏰",security:"🛡️",system:"⚙️"}[n.category]||"●")}

  function groupNotifications(items){
    const map=new Map();
    for(const n of items){
      const key=n.source||n.title;
      if(!map.has(key))map.set(key,[]);
      map.get(key).push(n);
    }
    return [...map.entries()];
  }

  function notificationCard(n){
    const actions=n.actions?.length?
      '<div class="notification-actions-v77">'+n.actions.map((a,i)=>'<button data-notification-action="'+i+'">'+escapeHTML(a.label)+'</button>').join("")+'</div>':"";
    return '<article class="notification-v77 '+(!n.read?"unread":"")+' priority-'+n.priority+'" data-notification-id="'+escapeHTML(n.id)+'">'+
      '<div class="notification-icon-v77">'+escapeHTML(iconFor(n))+'</div>'+
      '<div class="notification-content-v77">'+
        '<div class="notification-title-v77"><strong>'+escapeHTML(n.title)+'</strong><small>'+escapeHTML(timeLabel(n.time))+'</small></div>'+
        '<p>'+escapeHTML(n.message)+'</p>'+actions+
      '</div>'+
      '<div class="notification-menu-v77">'+
        '<button data-notification-snooze title="Adiar 15 minutos">◷</button>'+
        '<button data-notification-dismiss title="Dispensar">✕</button>'+
      '</div>'+
    '</article>';
  }

  function renderNotificationsV77(){
    ensureState();
    const list=document.getElementById("notification-list");if(!list)return;
    const c=centerState(),items=activeNotifications();
    const permission=("Notification" in window)?Notification.permission:"unsupported";
    const focusText=c.focusMode==="off"?(Number(c.quietUntil)>now()?"Não incomodar temporário":"Desativado"):c.focusMode==="priority"?"Apenas prioridade":"Apenas alarmes";
    list.innerHTML=
      '<div class="action-center-v77">'+
        '<div class="notification-toolbar-v77">'+
          '<div><strong>Centro de Notificações</strong><small>'+items.length+' ativa'+(items.length===1?"":"s")+' · '+c.unread+' não lida'+(c.unread===1?"":"s")+'</small></div>'+
          '<div><button data-mark-all>Marcar lidas</button><button data-clear-all>Limpar tudo</button></div>'+
        '</div>'+
        '<div class="focus-strip-v77">'+
          '<div><span>☾</span><div><strong>Não incomodar</strong><small>'+escapeHTML(focusText)+'</small></div></div>'+
          '<div class="focus-buttons-v77"><button data-focus="off" class="'+(c.focusMode==="off"&&!isQuiet()?"active":"")+'">Desligado</button><button data-focus="priority" class="'+(c.focusMode==="priority"?"active":"")+'">Prioridade</button><button data-focus="alarms" class="'+(c.focusMode==="alarms"?"active":"")+'">Alarmes</button><button data-quiet-1h>1 h</button></div>'+
        '</div>'+
        '<div class="real-notify-strip-v77"><span>Notificações do dispositivo: <strong>'+escapeHTML(permission==="granted"?(state.realNotificationsEnabled?"ativas":"permissão concedida"):permission==="denied"?"bloqueadas":"não autorizadas")+'</strong></span><button data-real-notify>'+(state.realNotificationsEnabled?"Desativar":"Ativar")+'</button></div>'+
        '<div class="notification-groups-v77">'+
          (items.length?groupNotifications(items).map(([source,group])=>
            '<section class="notification-group-v77"><header><strong>'+escapeHTML(source)+'</strong><span>'+group.length+'</span></header>'+
            group.map(notificationCard).join("")+'</section>'
          ).join(""):'<div class="notification-empty-v77"><span>✓</span><strong>Tudo em dia</strong><p>Não existem notificações ativas.</p></div>')+
        '</div>'+
      '</div>';

    list.querySelector("[data-mark-all]")?.addEventListener("click",markAllRead);
    list.querySelector("[data-clear-all]")?.addEventListener("click",clearAll);
    list.querySelectorAll("[data-focus]").forEach(b=>b.onclick=()=>{
      c.focusMode=b.dataset.focus;c.quietUntil=0;saveState();renderNotificationsV77();installQuickFocusTile();
    });
    list.querySelector("[data-quiet-1h]")?.addEventListener("click",()=>{
      c.focusMode="off";c.quietUntil=now()+3600000;saveState();renderNotificationsV77();installQuickFocusTile();
    });
    list.querySelector("[data-real-notify]")?.addEventListener("click",async()=>{
      if(state.realNotificationsEnabled){
        state.realNotificationsEnabled=false;saveState();renderNotificationsV77();
      }else if(globalThis.RealPlatformBridge?.requestNotificationPermission){
        await RealPlatformBridge.requestNotificationPermission();renderNotificationsV77();
      }
    });
    list.querySelectorAll("[data-notification-id]").forEach(card=>{
      const nid=card.dataset.notificationId;
      card.querySelector(".notification-content-v77").onclick=()=>activateNotification(nid);
      card.querySelector("[data-notification-dismiss]").onclick=e=>{e.stopPropagation();dismissNotification(nid)};
      card.querySelector("[data-notification-snooze]").onclick=e=>{e.stopPropagation();snoozeNotification(nid,15)};
      card.querySelectorAll("[data-notification-action]").forEach(b=>b.onclick=e=>{
        e.stopPropagation();runNotificationAction(nid,Number(b.dataset.notificationAction));
      });
    });
    syncUnread(false);
  }

  globalThis.renderNotifications=renderNotificationsV77;
  try{renderNotifications=globalThis.renderNotifications}catch{}

  function setFocusMode(mode){
    if(!["off","priority","alarms"].includes(mode))return false;
    const c=centerState();c.focusMode=mode;c.quietUntil=0;
    saveState();renderNotificationsV77();installQuickFocusTile();return true;
  }

  function serviceLog(service,action,message){
    state.events=Array.isArray(state.events)?state.events:[];
    state.events.push({
      level:"Information",source:"Service Control Manager",
      id:action==="stop"?7036:action==="restart"?7035:7036,
      message:message||service.display+": "+service.status,time:now()
    });
    if(state.events.length>200)state.events=state.events.slice(-200);
  }
  function changeService(name,action){
    ensureState();
    const s=state.services?.find(x=>x.name===name);if(!s)return false;
    if(action==="stop"){
      s.status="Stopped";s.pid=0;
    }else if(action==="restart"){
      s.status="Running";s.pid=s.pid||1800+state.services.indexOf(s)*41;s.restarts++; 
    }else{
      s.status="Running";s.pid=s.pid||1800+state.services.indexOf(s)*41;
    }
    s.lastChanged=now();
    serviceLog(s,action);
    saveState();
    pushNotification("Serviços",s.display+" · "+(s.status==="Running"?"Em execução":"Parado"),{
      source:"Serviços",appId:"services",category:"system",priority:"low",silent:true,real:false,
      replaceKey:"service:"+s.name
    });
    return true;
  }

  function actionDescription(task){
    return {
      "storage-sense":"Manutenção de armazenamento",
      "update-check":"Verificação do Windows Update",
      "maintenance":"Manutenção automática",
      "notification":"Notificação de tarefa"
    }[task.action]||task.action;
  }

  function recordTaskRun(task,result,manual=false){
    state.backgroundActivityV77.runs.unshift({
      id:id("run"),taskId:task.id,taskName:task.name,result,time:now(),manual:Boolean(manual)
    });
    state.backgroundActivityV77.runs=state.backgroundActivityV77.runs.slice(0,state.backgroundActivityV77.maxRuns||80);
  }

  async function executeTask(task,{manual=false}={}){
    if(!task||(!task.enabled&&!manual))return false;
    task.status="Running";saveState();
    let result="Concluída";
    try{
      if(task.action==="storage-sense"){
        if(globalThis.Win11Storage?.runStorageSense){
          const storageResult=await Win11Storage.runStorageSense({source:"background-storage-sense"});
          result=storageResult.ran
            ?(storageResult.freed?Win11Storage.formatBytes(storageResult.freed)+" libertados":"Nenhum ficheiro temporário para limpar")
            :"Sensor de Armazenamento desativado";
        }else{
          const bin=ensureFolder("Recycle Bin");
          const count=Object.keys(bin).length;
          result=count?count+" item(ns) encontrados na Reciclagem":"Nenhum item para limpar";
        }
        pushNotification("Sensor de Armazenamento",result,{
          source:"Sensor de Armazenamento",appId:"settings",category:"system",priority:"low",
          actions:[{label:"Abrir armazenamento",type:"open-app",appId:"settings"}]
        });
      }else if(task.action==="update-check"){
        state.update=state.update||{};
        state.update.lastChecked=now();
        result="Verificação concluída · sistema virtual atualizado";
        pushNotification("Windows Update",result,{
          source:"Windows Update",appId:"settings",category:"system",priority:"high",
          actions:[{label:"Abrir Windows Update",type:"open-app",appId:"settings"}],
          replaceKey:"background:update"
        });
      }else if(task.action==="maintenance"){
        result="Diagnóstico interno concluído sem problemas";
        pushNotification("Manutenção automática",result,{
          source:"Manutenção automática",appId:"taskmanager",category:"system",priority:"low"
        });
      }else{
        result="Tarefa executada com sucesso";
        pushNotification("Agendador de Tarefas",task.name+" · "+result,{
          source:"Agendador de Tarefas",appId:"taskscheduler",category:"system",priority:"normal"
        });
      }
    }catch(err){result="Erro: "+String(err?.message||err)}
    task.lastRun=now();task.runCount=(task.runCount||0)+1;
    task.lastResult=result;task.status="Ready";
    task.nextRun=now()+Math.max(1,Number(task.intervalMinutes)||30)*60000;
    recordTaskRun(task,result,manual);
    state.events=Array.isArray(state.events)?state.events:[];
    state.events.push({
      level:result.startsWith("Erro")?"Error":"Information",
      source:"TaskScheduler",id:result.startsWith("Erro")?101:102,
      message:task.name+": "+result,time:now()
    });
    saveState();
    return true;
  }

  async function schedulerTick(){
    ensureState();
    if(!state.backgroundActivityV77.enabled)return 0;
    const t=now();let ran=0;
    for(const task of state.scheduledTasks){
      if(task.enabled&&Number(task.nextRun)<=t){
        await executeTask(task,{manual:false});ran++;
      }
    }
    state.backgroundActivityV77.lastTick=t;saveState();
    return ran;
  }
  function startScheduler(){
    if(schedulerTimer)return;
    schedulerTimer=setInterval(()=>schedulerTick().catch(()=>{}),TASK_TICK_MS);
    schedulerTick().catch(()=>{});
  }
  function stopScheduler(){
    clearInterval(schedulerTimer);schedulerTimer=null;
  }

  globalThis.buildServices=function(wrap){
    ensureState();
    wrap.className="sys-page services-v77";
    let selected=null,filter="";
    function render(){
      const items=(state.services||[]).filter(s=>(s.display+" "+s.name).toLowerCase().includes(filter));
      const running=items.filter(s=>s.status==="Running").length;
      wrap.innerHTML=
        '<div class="admin-page-head-v77"><div><h2>Serviços</h2><p>'+running+' em execução · '+(items.length-running)+' parados</p></div><button class="sys-button" data-refresh>Atualizar</button></div>'+
        '<div class="services-toolbar"><input class="explorer-search" data-service-search placeholder="Pesquisar serviços"><button class="sys-button" data-start-service>Iniciar</button><button class="sys-button" data-stop-service>Parar</button><button class="sys-button" data-restart-service>Reiniciar</button></div>'+
        '<table class="services-table"><thead><tr><th>Nome</th><th>Descrição</th><th>Estado</th><th>Arranque</th><th>PID</th><th>Reinícios</th></tr></thead><tbody>'+
        items.map(s=>'<tr data-service="'+escapeHTML(s.name)+'" class="'+(selected===s.name?"selected":"")+'"><td>'+escapeHTML(s.name)+'</td><td>'+escapeHTML(s.display)+'</td><td class="'+(s.status==="Running"?"status-running":"status-stopped")+'">'+(s.status==="Running"?"Em execução":"Parado")+'</td><td>'+escapeHTML(s.startup)+'</td><td>'+(s.pid||"")+'</td><td>'+(s.restarts||0)+'</td></tr>').join("")+
        '</tbody></table>'+
        (selected?'<div class="service-detail-v77">'+serviceDetails(selected)+'</div>':"");
      wrap.querySelector("[data-service-search]").value=filter;
      wrap.querySelector("[data-service-search]").oninput=e=>{filter=e.target.value.toLowerCase();render()};
      wrap.querySelectorAll("[data-service]").forEach(r=>r.onclick=()=>{selected=r.dataset.service;render()});
      wrap.querySelector("[data-refresh]").onclick=render;
      wrap.querySelector("[data-start-service]").onclick=()=>doChange("start");
      wrap.querySelector("[data-stop-service]").onclick=()=>doChange("stop");
      wrap.querySelector("[data-restart-service]").onclick=()=>doChange("restart");
    }
    function serviceDetails(name){
      const s=state.services.find(x=>x.name===name);if(!s)return "";
      return '<strong>'+escapeHTML(s.display)+'</strong><span>'+escapeHTML(s.description||s.name)+'</span><small>Última alteração: '+new Date(s.lastChanged).toLocaleString("pt-PT")+'</small>';
    }
    function doChange(action){
      if(!selected)return notify("Serviços","Selecione um serviço.",{source:"Serviços",appId:"services"});
      changeService(selected,action);render();
    }
    render();
  };
  try{buildServices=globalThis.buildServices}catch{}

  globalThis.buildTaskScheduler=function(wrap){
    ensureState();
    wrap.className="scheduler-tree scheduler-v77";
    wrap.innerHTML='<nav class="scheduler-nav"><strong>Biblioteca do Agendador</strong><button class="active">Biblioteca</button><button>Microsoft</button><button>Windows</button><button>FantaMK</button><div class="scheduler-engine-state-v77" data-engine-state></div></nav><main class="scheduler-main"></main>';
    const main=wrap.querySelector(".scheduler-main");let selected=null;
    function render(){
      const t=selected==null?null:state.scheduledTasks[selected];
      wrap.querySelector("[data-engine-state]").innerHTML='<strong>Motor V7.7</strong><small>'+(state.backgroundActivityV77.enabled?"Ativo":"Pausado")+'</small><button data-engine-toggle>'+(state.backgroundActivityV77.enabled?"Pausar":"Retomar")+'</button>';
      wrap.querySelector("[data-engine-toggle]").onclick=()=>{state.backgroundActivityV77.enabled=!state.backgroundActivityV77.enabled;saveState();render()};
      main.innerHTML=
        '<div class="admin-page-head-v77"><div><h2>Agendador de Tarefas</h2><p>'+state.scheduledTasks.filter(x=>x.enabled).length+' tarefas ativas · motor de background '+(state.backgroundActivityV77.enabled?"ligado":"pausado")+'</p></div></div>'+
        '<div class="admin-toolbar"><button class="sys-button primary" data-create>Criar tarefa</button><button class="sys-button" data-run>Executar agora</button><button class="sys-button" data-toggle>Ativar/Desativar</button><button class="sys-button" data-edit>Editar intervalo</button><button class="sys-button danger" data-delete>Eliminar</button></div>'+
        '<table class="admin-table"><thead><tr><th>Nome</th><th>Estado</th><th>Próxima execução</th><th>Última execução</th><th>Resultado</th></tr></thead><tbody>'+
        state.scheduledTasks.map((x,i)=>'<tr data-task="'+i+'" class="'+(selected===i?"selected":"")+'"><td>'+escapeHTML(x.name)+'</td><td>'+(x.enabled?escapeHTML(x.status):"Desativada")+'</td><td>'+(x.enabled?new Date(x.nextRun).toLocaleString("pt-PT"):"—")+'</td><td>'+(x.lastRun?new Date(x.lastRun).toLocaleString("pt-PT"):"Nunca")+'</td><td>'+escapeHTML(x.lastResult||"—")+'</td></tr>').join("")+
        '</tbody></table>'+
        (t?'<div class="task-detail-v77"><strong>'+escapeHTML(t.name)+'</strong><span>'+escapeHTML(actionDescription(t))+'</span><small>Intervalo: '+t.intervalMinutes+' min · Execuções: '+t.runCount+' · '+escapeHTML(t.folder)+'</small></div>':"")+
        '<section class="background-history-v77"><h3>Atividade recente</h3>'+
        (state.backgroundActivityV77.runs.length?state.backgroundActivityV77.runs.slice(0,8).map(r=>'<div><span>'+new Date(r.time).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})+'</span><strong>'+escapeHTML(r.taskName)+'</strong><small>'+escapeHTML(r.result)+(r.manual?" · manual":" · background")+'</small></div>').join(""):'<p>Sem execuções nesta sessão.</p>')+
        '</section>';
      main.querySelectorAll("[data-task]").forEach(r=>r.onclick=()=>{selected=+r.dataset.task;render()});
      main.querySelector("[data-create]").onclick=createTask;
      main.querySelector("[data-run]").onclick=async()=>{if(selected==null)return;await executeTask(state.scheduledTasks[selected],{manual:true});render()};
      main.querySelector("[data-toggle]").onclick=()=>{if(selected==null)return;const x=state.scheduledTasks[selected];x.enabled=!x.enabled;if(x.enabled&&x.nextRun<now())x.nextRun=now()+x.intervalMinutes*60000;saveState();render()};
      main.querySelector("[data-edit]").onclick=()=>{if(selected==null)return;const x=state.scheduledTasks[selected];const v=prompt("Intervalo em minutos:",String(x.intervalMinutes));const m=Math.max(1,Number(v)||0);if(!m)return;x.intervalMinutes=m;x.nextRun=now()+m*60000;saveState();render()};
      main.querySelector("[data-delete]").onclick=()=>{if(selected==null)return;state.scheduledTasks.splice(selected,1);selected=null;saveState();render()};
    }
    function createTask(){
      const name=String(prompt("Nome da tarefa:","Nova Tarefa")||"").trim();if(!name)return;
      const mins=Math.max(1,Number(prompt("Executar a cada quantos minutos?","30"))||30);
      state.scheduledTasks.push({
        id:id("task"),name,folder:"\\FantaMK",enabled:true,status:"Ready",lastRun:0,
        lastResult:"Nunca executada",runCount:0,intervalMinutes:mins,action:"notification",
        nextRun:now()+mins*60000
      });
      saveState();selected=state.scheduledTasks.length-1;render();
    }
    render();
  };
  try{buildTaskScheduler=globalThis.buildTaskScheduler}catch{}

  function installQuickFocusTile(){
    const grid=document.querySelector("#quick-panel .quick-grid");if(!grid)return;
    let b=grid.querySelector("[data-focus-assist-v77]");
    if(!b){
      b=document.createElement("button");b.className="quick-tile";b.dataset.focusAssistV77="";
      b.innerHTML='☾<strong>Não incomodar</strong><small></small>';
      b.onclick=e=>{
        e.stopPropagation();
        const c=centerState();
        c.focusMode=c.focusMode==="off"?"priority":"off";c.quietUntil=0;
        saveState();renderNotificationsV77();installQuickFocusTile();
      };
      grid.appendChild(b);
    }
    const c=centerState();
    const active=isQuiet();
    b.classList.toggle("on",active);
    b.querySelector("small").textContent=c.focusMode==="priority"?"Prioridade":c.focusMode==="alarms"?"Alarmes":Number(c.quietUntil)>now()?"Temporário":"Desligado";
  }

  function installSettings(){
    if(typeof previousRenderSettingsPage!=="function")return;
    globalThis.renderSettingsPageV5=function(box,page){
      previousRenderSettingsPage(box,page);
      if(page!=="system"||box.querySelector("[data-notification-settings-v77]"))return;
      const c=centerState();
      const card=document.createElement("div");
      card.className="sys-card notification-settings-v77";
      card.dataset.notificationSettingsV77="";
      card.innerHTML=
        '<div><strong>Notificações e Não incomodar</strong><p>'+c.unread+' não lidas · modo '+escapeHTML(c.focusMode==="off"?"normal":c.focusMode)+'</p></div>'+
        '<div><button class="sys-button" data-open-notifications>Abrir Centro</button><button class="sys-button" data-toggle-focus>'+(isQuiet()?"Desativar Não incomodar":"Ativar Não incomodar")+'</button></div>';
      (box.querySelector(".sys-grid")||box).appendChild(card);
      card.querySelector("[data-open-notifications]").onclick=()=>{closeOverlays();toggleOverlay("notifications")};
      card.querySelector("[data-toggle-focus]").onclick=()=>{setFocusMode(isQuiet()?"off":"priority");globalThis.renderSettingsPageV5(box,page)};
    };
    try{renderSettingsPageV5=globalThis.renderSettingsPageV5}catch{}
  }

  function installNotificationButton(){
    const btn=document.getElementById("notify-btn");if(!btn)return;
    btn.title="Centro de Notificações";
    btn.addEventListener("click",()=>setTimeout(()=>{
      activeNotifications().forEach(n=>n.read=true);saveState();syncUnread(false);renderNotificationsV77();
    },80));
  }

  ensureState();
  installNotificationButton();
  installQuickFocusTile();
  installSettings();
  renderNotificationsV77();
  startScheduler();

  globalThis.Win11NotificationCenter=Object.freeze({
    version:"8.1.0",
    push:pushNotification,
    active:()=>clone(activeNotifications()),
    history:()=>clone(state.notificationHistoryV77),
    markRead,markAllRead,dismiss:dismissNotification,clearAll,snooze:snoozeNotification,
    activate:activateNotification,runAction:runNotificationAction,
    get focusMode(){return centerState().focusMode},
    setFocusMode,
    isQuiet,
    ruleFor
  });
  globalThis.Win11BackgroundEngine=Object.freeze({
    version:"8.1.0",
    tick:schedulerTick,
    runTask:async idOrIndex=>{
      const t=typeof idOrIndex==="number"?state.scheduledTasks[idOrIndex]:state.scheduledTasks.find(x=>x.id===idOrIndex);
      return executeTask(t,{manual:true});
    },
    changeService,
    start:startScheduler,stop:stopScheduler,
    get enabled(){return Boolean(state.backgroundActivityV77?.enabled)},
    get history(){return clone(state.backgroundActivityV77?.runs||[])}
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:"8.1.0",
    step:16,
    features:[
      ...(globalThis.Win11RealFunctions?.features||[]),
      "notification-center-v2","notification-groups","notification-actions","notification-snooze",
      "notification-unread-badge","focus-assist","do-not-disturb","per-source-notification-rules",
      "background-task-engine","scheduled-task-runtime","background-activity-history",
      "service-state-runtime","service-event-log","notification-background-integration"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
