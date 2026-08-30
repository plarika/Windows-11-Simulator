"use strict";
/* ============================================================
   V5 — Windows System Suite behavior
   ============================================================ */
function v5MigrateState(){
  state.services=Array.isArray(state.services)?state.services:[
    {name:"AudioEndpointBuilder",display:"Windows Audio Endpoint Builder",status:"Running",startup:"Automatic",pid:812},
    {name:"Audiosrv",display:"Windows Audio",status:"Running",startup:"Automatic",pid:944},
    {name:"BITS",display:"Background Intelligent Transfer Service",status:"Stopped",startup:"Manual",pid:0},
    {name:"Dhcp",display:"DHCP Client",status:"Running",startup:"Automatic",pid:1100},
    {name:"Dnscache",display:"DNS Client",status:"Running",startup:"Automatic",pid:1180},
    {name:"EventLog",display:"Windows Event Log",status:"Running",startup:"Automatic",pid:724},
    {name:"Spooler",display:"Print Spooler",status:"Running",startup:"Automatic",pid:1480},
    {name:"SysMain",display:"SysMain",status:"Running",startup:"Automatic",pid:1524},
    {name:"WSearch",display:"Windows Search",status:"Running",startup:"Automatic (Delayed)",pid:1620},
    {name:"wuauserv",display:"Windows Update",status:"Stopped",startup:"Manual",pid:0}
  ];
  state.disks=Array.isArray(state.disks)?state.disks:[
    {id:0,name:"Disco 0",type:"SSD virtual",size:128,online:true,partitions:[
      {name:"Sistema EFI",letter:"",size:0.1,fs:"FAT32",type:"system"},
      {name:"Windows",letter:"C:",size:92,fs:"NTFS",type:"primary"},
      {name:"Recovery",letter:"",size:1.1,fs:"NTFS",type:"recovery"},
      {name:"Não alocado",letter:"",size:34.8,fs:"",type:"unallocated"}
    ]},
    {id:1,name:"Disco 1",type:"SSD virtual",size:256,online:true,partitions:[
      {name:"Dados",letter:"D:",size:180,fs:"NTFS",type:"primary"},
      {name:"Não alocado",letter:"",size:76,fs:"",type:"unallocated"}
    ]}
  ];
  state.scheduledTasks=Array.isArray(state.scheduledTasks)?state.scheduledTasks:[
    {name:"Windows Update Orchestrator",folder:"\\Microsoft\\Windows\\UpdateOrchestrator",enabled:true,status:"Ready",lastRun:Date.now()-86400000},
    {name:"Storage Sense",folder:"\\Microsoft\\Windows\\DiskCleanup",enabled:true,status:"Ready",lastRun:Date.now()-172800000},
    {name:"Simulator Maintenance",folder:"\\FantaMK",enabled:true,status:"Ready",lastRun:Date.now()-3600000}
  ];
  state.optionalFeatures=Object.assign({
    dotnet35:false,dotnet48:true,hyperv:false,sandbox:false,wsl:false,containers:false,iis:false,smb1:false,media:true,xps:false
  },state.optionalFeatures||{});
  state.backups=Array.isArray(state.backups)?state.backups:[];
  state.stickyNotes=Array.isArray(state.stickyNotes)?state.stickyNotes:[
    {id:"note-1",text:"Bem-vindo ao Sticky Notes virtual.\nPode editar esta nota."}
  ];
  state.fileClipboard=state.fileClipboard||null;
  state.wifiNetworks=Array.isArray(state.wifiNetworks)?state.wifiNetworks:[
    {ssid:"SIMULATOR-NET",signal:96,secure:true,connected:true},
    {ssid:"Home-5G",signal:81,secure:true,connected:false},
    {ssid:"Office-WiFi",signal:63,secure:true,connected:false},
    {ssid:"Guest",signal:45,secure:false,connected:false}
  ];
  state.bluetoothDevices=Array.isArray(state.bluetoothDevices)?state.bluetoothDevices:[
    {name:"Wireless Headphones",type:"Áudio",paired:true,connected:false},
    {name:"Bluetooth Mouse",type:"Entrada",paired:true,connected:true},
    {name:"Phone",type:"Telemóvel",paired:false,connected:false}
  ];
  state.power=Object.assign({battery:82,saver:false,screenOff:10,sleep:30,mode:"Balanced"},state.power||{});
  state.privacy=Object.assign({location:false,camera:true,microphone:true,notifications:true,diagnostics:false},state.privacy||{});
  state.accessibility=Object.assign({textScale:100,highContrast:false,narrator:false,stickyKeys:false},state.accessibility||{});
  state.remoteDesktop=Object.assign({enabled:false,lastHost:""},state.remoteDesktop||{});
  state.gameMode=state.gameMode!==false;
  ensureFolder("C:/OneDrive");
  ensureFolder("C:/OneDrive/Documents");
  saveState();
}
v5MigrateState();

function renderApp(appId,win,initialPath){
  const wrap=document.createElement("div");
  if(appId==="explorer"||appId==="recycle"){buildExplorerV5(wrap,win,appId==="recycle"?"Recycle Bin":(initialPath||"This PC"));return wrap}
  if(appId==="notepad"){buildNotepadV5(wrap);return wrap}
  if(appId==="calc"){buildCalc(wrap);return wrap}
  if(appId==="terminal"){buildTerminal(wrap);return wrap}
  if(appId==="edge"){buildEdge(wrap);return wrap}
  if(appId==="settings"){buildSettingsV5(wrap);return wrap}
  if(appId==="taskmanager"){renderTaskManager(wrap);return wrap}
  if(appId==="paint"){buildPaint(wrap);return wrap}
  if(appId==="photos"){buildPhotos(wrap);return wrap}
  if(appId==="camera"){buildCamera(wrap);return wrap}
  if(appId==="security"){buildSecurity(wrap);return wrap}
  if(appId==="devicemanager"){buildDeviceManager(wrap);return wrap}
  if(appId==="registry"){buildRegistry(wrap);return wrap}
  if(appId==="eventviewer"){buildEventViewer(wrap);return wrap}
  if(appId==="controlpanel"){buildControlPanel(wrap);return wrap}
  if(appId==="clock"){buildClock(wrap);return wrap}
  if(appId==="snipping"){buildSnipping(wrap);return wrap}
  if(appId==="mediaplayer"){buildMediaPlayer(wrap);return wrap}
  if(appId==="store"){buildStore(wrap);return wrap}
  if(appId==="windowstools"){buildWindowsTools(wrap);return wrap}
  if(appId==="services"){buildServices(wrap);return wrap}
  if(appId==="diskmgmt"){buildDiskManagement(wrap);return wrap}
  if(appId==="taskscheduler"){buildTaskScheduler(wrap);return wrap}
  if(appId==="systeminfo"){buildSystemInfo(wrap);return wrap}
  if(appId==="resmon"){buildResourceMonitor(wrap);return wrap}
  if(appId==="powershell"){buildPowerShell(wrap);return wrap}
  if(appId==="optionalfeatures"){buildOptionalFeatures(wrap);return wrap}
  if(appId==="backup"){buildBackup(wrap);return wrap}
  if(appId==="recovery"){buildRecovery(wrap);return wrap}
  if(appId==="stickynotes"){buildStickyNotes(wrap);return wrap}
  if(appId==="onedrive"){buildOneDrive(wrap);return wrap}
  if(appId==="remotedesktop"){buildRemoteDesktop(wrap);return wrap}
  if(appId==="soundrecorder"){buildSoundRecorder(wrap);return wrap}
  if(appId==="gethelp"){buildGetHelp(wrap);return wrap}
  wrap.className="sys-page";wrap.innerHTML="<h2>Aplicação virtual</h2><p>Conteúdo indisponível.</p>";return wrap;
}

function buildNotepadV5(wrap){
  wrap.className="notepad";
  wrap.innerHTML='<div class="app-toolbar"><button data-new>Novo</button><button data-open>Abrir</button><button data-save>Guardar</button><button data-saveas>Guardar como</button><button data-copy>Copiar</button><button data-cut>Cortar</button><button data-paste>Colar</button><span style="flex:1"></span><button data-time>Hora/Data</button></div><textarea spellcheck="false"></textarea>';
  const ta=wrap.querySelector("textarea");ta.value=state.notepadText||"";
  ta.oninput=()=>{state.notepadText=ta.value;saveState()};
  wrap.querySelector("[data-new]").onclick=()=>{ta.value="";state.notepadText="";saveState()};
  wrap.querySelector("[data-open]").onclick=()=>openApp("explorer","C:/Documents");
  wrap.querySelector("[data-save]").onclick=()=>saveNotepad(ta.value,"Notas.txt");
  wrap.querySelector("[data-saveas]").onclick=()=>{
    const name=prompt("Nome do ficheiro:","Documento.txt");if(!name)return;
    const safe=name.replace(/[\\/:*?"<>|]/g,"_");ensureFolder("C:/Documents")[safe]=ta.value;touchRecent("C:/Documents/"+safe);saveState();notify("Notas",safe+" guardado.");
  };
  wrap.querySelector("[data-copy]").onclick=()=>{const a=ta.selectionStart,b=ta.selectionEnd,text=ta.value.slice(a,b)||ta.value;addClipboard(text)};
  wrap.querySelector("[data-cut]").onclick=()=>{const a=ta.selectionStart,b=ta.selectionEnd;if(a===b)return;addClipboard(ta.value.slice(a,b));ta.setRangeText("",a,b,"start");state.notepadText=ta.value;saveState()};
  wrap.querySelector("[data-paste]").onclick=()=>{const text=(state.clipboard||[])[0]||"";ta.setRangeText(text,ta.selectionStart,ta.selectionEnd,"end");state.notepadText=ta.value;saveState()};
  wrap.querySelector("[data-time]").onclick=()=>{ta.setRangeText(new Date().toLocaleString("pt-PT"),ta.selectionStart,ta.selectionEnd,"end");state.notepadText=ta.value;saveState()};
}
