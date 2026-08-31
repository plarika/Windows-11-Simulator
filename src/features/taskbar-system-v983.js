"use strict";
(function installTaskbarSystemV983(){
  const VERSION="9.8.3";
  const store=globalThis.Win11SettingsStore;
  const bus=globalThis.Win11SystemBus;
  const app=document.getElementById("app");
  const taskbar=document.getElementById("taskbar");
  const layer=document.getElementById("window-layer");
  if(!store||!bus||!app||!taskbar||!layer)throw new Error("Taskbar System V9.8.3 requires Settings Core, System Bus and shell.");

  let hideTimer=0;
  let desktopShowing=false;
  let desktopShownIndex=null;
  let restoreIds=[];

  function prefs(){
    try{return store.get("taskbar")}
    catch{return {autoHide:false,showDesktop:true,showSeconds:false}}
  }
  function currentDesktop(){return Number(state.currentDesktop)||0}
  function realWindows(){
    return [...layer.children].filter(n=>n.classList?.contains("window")&&Number(n.dataset.desktop||0)===currentDesktop());
  }
  function ensureShowDesktopButton(){
    let button=document.getElementById("show-desktop-v983");
    if(button)return button;
    button=document.createElement("button");
    button.id="show-desktop-v983";
    button.className="show-desktop-v983";
    button.type="button";
    button.title="Mostrar ambiente de trabalho";
    button.setAttribute("aria-label","Mostrar ambiente de trabalho");
    button.addEventListener("click",e=>{e.stopPropagation();toggleDesktop()});
    taskbar.querySelector(".task-right")?.appendChild(button);
    return button;
  }
  function ensureRevealStrip(){
    let strip=document.getElementById("taskbar-reveal-v983");
    if(strip)return strip;
    strip=document.createElement("div");
    strip.id="taskbar-reveal-v983";
    strip.className="taskbar-reveal-v983";
    strip.setAttribute("aria-hidden","true");
    strip.addEventListener("pointerenter",reveal);
    strip.addEventListener("pointerdown",reveal);
    app.appendChild(strip);
    return strip;
  }

  function visibleWindows(){return realWindows().filter(w=>!w.classList.contains("hidden"))}
  function toggleDesktop(){
    if(desktopShowing&&desktopShownIndex!==currentDesktop()){
      desktopShowing=false;desktopShownIndex=null;restoreIds=[];
    }
    if(desktopShowing){
      const ids=new Set(restoreIds);
      const wins=realWindows().filter(w=>ids.has(w.dataset.id));
      wins.forEach(w=>w.classList.remove("hidden"));
      if(wins.length)try{focusWindow(wins[wins.length-1])}catch{}
      desktopShowing=false;desktopShownIndex=null;restoreIds=[];
    }else{
      const wins=visibleWindows();
      restoreIds=wins.map(w=>w.dataset.id);
      wins.forEach(w=>{try{minimizeWindow(w)}catch{w.classList.add("hidden")}});
      desktopShowing=restoreIds.length>0;
      desktopShownIndex=desktopShowing?currentDesktop():null;
    }
    syncShowDesktopButton();
    globalThis.Win11TaskbarWindowPro?.refresh?.();
    return true;
  }
  function syncShowDesktopButton(){
    const button=ensureShowDesktopButton();
    const enabled=Boolean(prefs().showDesktop);
    button.hidden=!enabled;
    button.classList.toggle("active",desktopShowing);
    button.title=desktopShowing?"Restaurar janelas":"Mostrar ambiente de trabalho";
    button.setAttribute("aria-label",button.title);
  }

  function overlaysOpen(){
    return Boolean(document.querySelector(".overlay.open,#taskbar-group-v970.open,#explorer-task-group-v930.open"));
  }
  function shouldStayVisible(){
    if(!prefs().autoHide)return true;
    if(taskbar.matches(":hover")||taskbar.matches(":focus-within"))return true;
    if(overlaysOpen())return true;
    return false;
  }
  function reveal(){
    clearTimeout(hideTimer);
    app.classList.remove("taskbar-auto-hidden-v983");
    if(prefs().autoHide)hideTimer=setTimeout(hideIfIdle,850);
    return true;
  }
  function hideIfIdle(){
    clearTimeout(hideTimer);
    if(!prefs().autoHide||shouldStayVisible())return;
    app.classList.add("taskbar-auto-hidden-v983");
  }
  function scheduleHide(delay=700){
    clearTimeout(hideTimer);
    if(!prefs().autoHide)return;
    hideTimer=setTimeout(hideIfIdle,delay);
  }

  function apply(){
    const p=prefs(),strip=ensureRevealStrip();
    app.classList.toggle("taskbar-autohide-v983",Boolean(p.autoHide));
    strip.hidden=!p.autoHide;
    if(!p.showDesktop&&desktopShowing)toggleDesktop();
    syncShowDesktopButton();
    if(p.autoHide)scheduleHide(900);
    else{
      clearTimeout(hideTimer);
      app.classList.remove("taskbar-auto-hidden-v983");
    }
    app.dataset.taskbarSystem="9.8.3";
    return true;
  }

  taskbar.addEventListener("pointerenter",reveal);
  taskbar.addEventListener("pointerleave",()=>scheduleHide(650));
  taskbar.addEventListener("focusin",reveal);
  taskbar.addEventListener("focusout",()=>scheduleHide(500));
  document.addEventListener("pointermove",e=>{
    if(prefs().autoHide&&e.clientY>=innerHeight-7)reveal();
  },{passive:true});
  document.addEventListener("keydown",e=>{
    if(e.key==="Meta"||e.metaKey)reveal();
  });
  document.addEventListener("pointerdown",e=>{
    if(!e.target.closest("#taskbar,#taskbar-reveal-v983"))scheduleHide(600);
  });

  const overlayObserver=new MutationObserver(()=>{
    if(overlaysOpen())reveal();else scheduleHide(500);
  });
  document.querySelectorAll(".overlay,#taskbar-group-v970,#explorer-task-group-v930").forEach(n=>
    overlayObserver.observe(n,{attributes:true,attributeFilter:["class"]})
  );

  const shellObserver=new MutationObserver(()=>{
    if(desktopShowing&&visibleWindows().length){
      desktopShowing=false;desktopShownIndex=null;restoreIds=[];syncShowDesktopButton();
    }
  });
  shellObserver.observe(layer,{childList:true});

  bus.on("settings:taskbar:changed",event=>{
    const path=String(event.detail?.path||"");
    if(path==="taskbar.autoHide"||path==="taskbar.showDesktop"||path==="taskbar.showSeconds")apply();
  });
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible")apply();
  });

  ensureRevealStrip();
  ensureShowDesktopButton();
  apply();

  globalThis.Win11TaskbarSystem=Object.freeze({
    version:VERSION,
    apply,
    reveal,
    hide:hideIfIdle,
    showDesktop:toggleDesktop,
    get state(){
      return Object.freeze({
        autoHide:Boolean(prefs().autoHide),
        showDesktop:Boolean(prefs().showDesktop),
        showSeconds:Boolean(prefs().showSeconds),
        desktopShowing,
        restoreCount:restoreIds.length
      });
    }
  });

  globalThis.Win11RealFunctions=Object.freeze({
    version:VERSION,step:33,
    features:[...(globalThis.Win11RealFunctions?.features||[]),
      "taskbar-system-integration","taskbar-auto-hide","taskbar-show-desktop",
      "taskbar-clock-seconds","taskbar-settings-live"
    ].filter((v,i,a)=>a.indexOf(v)===i)
  });
})();
