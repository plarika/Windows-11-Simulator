"use strict";
/* ---------- Run / Terminal integration ---------- */
function executeRun(){
  const cmd=$("#run-input").value.trim().toLowerCase();
  const map={
    notepad:"notepad",calc:"calc",calculator:"calc",explorer:"explorer",cmd:"terminal",terminal:"terminal",powershell:"powershell",
    settings:"settings",taskmgr:"taskmanager",paint:"paint",mspaint:"paint",photos:"photos",edge:"edge",msedge:"edge",
    control:"controlpanel",regedit:"registry","regedit.exe":"registry","devmgmt.msc":"devicemanager",devmgmt:"devicemanager",
    "eventvwr.msc":"eventviewer",eventvwr:"eventviewer","services.msc":"services",services:"services",
    "diskmgmt.msc":"diskmgmt",diskmgmt:"diskmgmt","taskschd.msc":"taskscheduler",taskschd:"taskscheduler",
    msinfo32:"systeminfo",resmon:"resmon",optionalfeatures:"optionalfeatures",mstsc:"remotedesktop",
    sdclt:"backup",recovery:"recovery",stickynotes:"stickynotes",onedrive:"onedrive","soundrecorder":"soundrecorder",
    store:"store","windows tools":"windowstools","control.exe":"controlpanel","ms-settings:":"settings"
  };
  if(map[cmd]){openApp(map[cmd]);closeRun();return}
  if(cmd==="winver"){showSystemDialog("Acerca do Windows",`<h2>Windows 11 Simulator V5</h2><p>Versão 24H2 virtual</p><p>Compilação ${escapeHTML(state.update.version)}</p><p>Browser Sandbox — sem acesso ao Windows real.</p>`);closeRun();return}
  notify("Executar",`O Windows Simulator não encontrou "${cmd}".`);
}
function runVirtualCommand(raw,out){
  const cmd=raw.trim();if(!cmd)return;const q=document.createElement("div");q.className="term-line";q.textContent=`C:\\Users\\User>${cmd}`;out.appendChild(q);
  const parts=cmd.split(/\s+/),command=(parts.shift()||"").toLowerCase(),args=parts;let r="";
  const launch={notepad:"notepad",calc:"calc",explorer:"explorer",taskmgr:"taskmanager",control:"controlpanel",regedit:"registry","devmgmt.msc":"devicemanager","eventvwr.msc":"eventviewer","services.msc":"services","diskmgmt.msc":"diskmgmt","taskschd.msc":"taskscheduler",msinfo32:"systeminfo",resmon:"resmon",powershell:"powershell",msedge:"edge",mstsc:"remotedesktop",optionalfeatures:"optionalfeatures"};
  if(command==="start"&&args[0]){const x=launch[args[0].toLowerCase()]||args[0].toLowerCase();if(APPS[x]){openApp(x);r="Aplicação virtual iniciada."}else r="Aplicação não encontrada."}
  else if(launch[command]){openApp(launch[command]);r="Aplicação virtual iniciada."}
  else switch(command){
    case"help":r="help, dir, cd, mkdir, copy, move, del, echo, type, cls, tasklist, systeminfo, ipconfig, sc, schtasks, diskpart, ver, winver, whoami, date, time, start";break;
    case"dir":r=Object.keys(ensureFolder("C:/Documents")).join("\n")||"Pasta vazia.";break;
    case"cd":r=args.length?"Diretório virtual alterado para "+args.join(" "):"C:\\Users\\User";break;
    case"mkdir":if(args[0]){ensureFolder("C:/Documents/"+args.join(" "));saveState();r="Diretório virtual criado."}else r="Falta o nome.";break;
    case"echo":r=args.join(" ");break;
    case"type":r=ensureFolder("C:/Documents")[args.join(" ")]??"Ficheiro não encontrado.";break;
    case"del":{const n=args.join(" ");const f=ensureFolder("C:/Documents");if(n in f){delete f[n];saveState();r="Ficheiro virtual eliminado."}else r="Ficheiro não encontrado.";break}
    case"cls":out.innerHTML="";return;
    case"tasklist":r=$$(".window").map(w=>`${(APPS[w.dataset.app]?.name||w.dataset.app).padEnd(28)} ${w.dataset.pid}`).join("\n")||"Sem processos.";break;
    case"systeminfo":r=`Windows 11 Simulator V5\nVersão 24H2 virtual\nBuild ${state.update.version}\nHost: SIMULATOR-PC\nCPU: Virtual CPU @ 3.40 GHz\nRAM: 8 GB virtual\nBrowser Sandbox: ativo`;break;
    case"ipconfig":r=`Wi-Fi\n  IPv4 . . . . . . . : 192.168.56.101\n  Gateway . . . . . : 192.168.56.1\n  SSID . . . . . . . : ${state.wifiNetworks.find(n=>n.connected)?.ssid||"Disconnected"}\n(Dados simulados)`;break;
    case"sc":r=state.services.map(s=>`${s.name}: ${s.status}`).join("\n");break;
    case"schtasks":r=state.scheduledTasks.map(t=>`${t.enabled?"Ready":"Disabled"} ${t.name}`).join("\n");break;
    case"diskpart":openApp("diskmgmt");r="DISKPART virtual encaminhado para Gestão de Discos.";break;
    case"ver":r=`Microsoft Windows [Version 10.0.${state.update.version}]`;break;
    case"winver":showSystemDialog("Acerca do Windows",`<h2>Windows 11 Simulator V5</h2><p>24H2 virtual · ${escapeHTML(state.update.version)}</p>`);r="winver aberto.";break;
    case"whoami":r="simulator\\user";break;
    case"date":r=new Date().toLocaleDateString("pt-PT");break;
    case"time":r=new Date().toLocaleTimeString("pt-PT");break;
    default:r=`'${command}' não é reconhecido como comando virtual.`;
  }
  const el=document.createElement("div");el.className="term-line";el.textContent=String(r);out.appendChild(el);
}
