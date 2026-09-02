"use strict";
/* Windows 11 Simulator V6.6 — Real Notifications + PWA */
(function installRealPlatformV660(){
  let installPrompt=null;
  let swRegistration=null;
  const notificationSupported="Notification" in window;

  async function requestNotificationPermission(){
    if(!notificationSupported){
      notify("Notificações","Este navegador não suporta notificações do sistema.");
      return false;
    }
    const result=await Notification.requestPermission();
    state.realNotificationsEnabled=result==="granted";
    saveState();
    renderNotifications();
    notify("Notificações",result==="granted"?"Notificações reais ativadas.":"Permissão de notificações não concedida.");
    return result==="granted";
  }

  function sendRealNotification(title,message){
    if(!notificationSupported||Notification.permission!=="granted"||!state.realNotificationsEnabled)return false;
    try{
      const n=new Notification(String(title||"Windows 11 Simulator"),{
        body:String(message||""),
        icon:"./icons/icon-192.png",
        badge:"./icons/icon-192.png",
        tag:"win11sim-"+Date.now(),
        silent:false
      });
      n.onclick=()=>{
        window.focus();
        try{n.close()}catch{}
      };
      return true;
    }catch{
      return false;
    }
  }

  const baseNotify=globalThis.notify;
  globalThis.notify=function(title,message){
    baseNotify(title,message);
    sendRealNotification(title,message);
  };

  const baseRenderNotifications=globalThis.renderNotifications;
  globalThis.renderNotifications=function(){
    baseRenderNotifications();
    const list=document.querySelector("#notification-list");
    if(!list||list.querySelector(".real-notification-tools"))return;
    const tools=document.createElement("div");
    tools.className="real-notification-tools";
    const permission=notificationSupported?Notification.permission:"unsupported";
    tools.innerHTML=
      '<div><strong>Notificações do dispositivo</strong><small>'+
      (permission==="granted"?(state.realNotificationsEnabled?"Ativas":"Permissão concedida · desativadas no simulador"):permission==="denied"?"Bloqueadas no navegador":"Permissão ainda não concedida")+
      '</small></div>'+
      '<div class="real-notification-actions">'+
      '<button class="sys-button" data-notify-enable>'+(state.realNotificationsEnabled?"Desativar":"Ativar")+'</button>'+
      '<button class="sys-button" data-notify-test>Testar</button>'+
      '</div>';
    list.prepend(tools);

    tools.querySelector("[data-notify-enable]").onclick=async()=>{
      if(state.realNotificationsEnabled){
        state.realNotificationsEnabled=false;
        saveState();
        renderNotifications();
        return;
      }
      await requestNotificationPermission();
    };
    tools.querySelector("[data-notify-test]").onclick=()=>{
      if(!notificationSupported||!state.realNotificationsEnabled||Notification.permission!=="granted"){
        notify("Notificações","Ative primeiro as notificações reais.");
        return;
      }
      sendRealNotification("Windows 11 Simulator","Teste de notificação real concluído.");
    };
  };

  async function registerServiceWorker(){
    if(!("serviceWorker" in navigator))return {supported:false};
    try{
      const registration=await navigator.serviceWorker.register("./service-worker.js?v=10.2.0",{scope:"./"});
      swRegistration=registration;
      return {supported:true,registration};
    }catch(err){
      console.warn("[PWA] Service worker registration failed",err);
      return {supported:true,error:err};
    }
  }

  async function installApp(){
    if(!installPrompt){
      notify("Instalar aplicação","A instalação não está disponível neste momento. No Android/Edge, use também o menu do navegador > Instalar aplicação.");
      return false;
    }
    installPrompt.prompt();
    const result=await installPrompt.userChoice;
    if(result?.outcome==="accepted"){
      notify("Instalar aplicação","Windows 11 Simulator instalado.");
      installPrompt=null;
      return true;
    }
    return false;
  }

  window.addEventListener("beforeinstallprompt",e=>{
    e.preventDefault();
    installPrompt=e;
    state.pwaInstallAvailable=true;
    saveState();
  });
  window.addEventListener("appinstalled",()=>{
    installPrompt=null;
    state.pwaInstallAvailable=false;
    saveState();
    notify("Windows 11 Simulator","Aplicação instalada com sucesso.");
  });

  const baseRenderSettingsPage=globalThis.renderSettingsPageV5;
  globalThis.renderSettingsPageV5=function(box,page){
    baseRenderSettingsPage(box,page);
    if(page!=="apps"&&page!=="system")return;
    if(box.querySelector("[data-pwa-card]"))return;
    const card=document.createElement("div");
    card.className="sys-card clickable real-pwa-card";
    card.dataset.pwaCard="";
    card.innerHTML='<strong>▣ Instalar Windows 11 Simulator</strong><p>Instalar como aplicação no Windows/Android, com arranque independente do separador do browser.</p><button class="sys-button primary" data-install-pwa>Instalar aplicação</button>';
    const grid=box.querySelector(".sys-grid")||box;
    grid.appendChild(card);
    card.querySelector("[data-install-pwa]").onclick=e=>{
      e.stopPropagation();
      installApp();
    };
  };

  registerServiceWorker();

  globalThis.RealPlatformBridge=Object.freeze({
    version:"8.1.0",
    notificationSupported,
    requestNotificationPermission,
    sendRealNotification,
    installApp,
    registerServiceWorker,
    get registration(){return swRegistration},
    get installAvailable(){return Boolean(installPrompt)}
  });
})();
