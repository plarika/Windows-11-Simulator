"use strict";
/* ---------- PowerShell ---------- */
function buildPowerShell(wrap){
  wrap.className="ps-terminal";wrap.innerHTML='<div class="ps-toolbar"><button class="ps-tab">Windows PowerShell</button><span>＋</span></div><div class="ps-body"><div class="ps-line">Windows PowerShell virtual</div><div class="ps-line">Copyright (C) Microsoft Corporation — interface simulada.</div><br><div data-psout></div><div class="ps-inputrow"><span>PS C:\\Users\\User&gt;</span><input autocomplete="off" spellcheck="false"></div></div>';
  const input=wrap.querySelector("input"),out=wrap.querySelector("[data-psout]");input.focus();
  input.onkeydown=e=>{if(e.key==="Enter"){runPowerShellCommand(input.value,out);input.value="";wrap.querySelector(".ps-body").scrollTop=999999}};
}
function psWrite(out,text){const d=document.createElement("div");d.className="ps-line";d.textContent=String(text);out.appendChild(d)}
function runPowerShellCommand(raw,out){
  const cmd=raw.trim();if(!cmd)return;psWrite(out,`PS C:\\Users\\User> ${cmd}`);
  const [verb,...args]=cmd.split(/\s+/),c=verb.toLowerCase();let r="";
  if(c==="get-help")r="Get-Process, Get-Service, Get-ComputerInfo, Get-ChildItem, Get-Date, Get-Volume, Get-ScheduledTask, Get-NetIPConfiguration, Start-Process, Clear-Host";
  else if(c==="get-process")r=$$(".window").map(w=>`${String(w.dataset.pid).padEnd(7)} ${APPS[w.dataset.app]?.name||w.dataset.app}`).join("\n")||"Nenhum processo virtual.";
  else if(c==="get-service")r=state.services.map(s=>`${s.status.padEnd(10)} ${s.name.padEnd(22)} ${s.display}`).join("\n");
  else if(c==="get-computerinfo")r=`WindowsProductName : Windows 11 Simulator\nWindowsVersion     : 24H2 virtual\nOsBuildNumber      : ${state.update.version}\nCsName             : SIMULATOR-PC\nCsTotalPhysicalMemory : 8589934592 (virtual)`;
  else if(c==="get-childitem"||c==="dir"||c==="ls")r=Object.keys(ensureFolder("C:/Documents")).join("\n")||"";
  else if(c==="get-date")r=new Date().toString();
  else if(c==="get-volume")r=state.disks.flatMap(d=>d.partitions.filter(p=>p.letter).map(p=>`${p.letter.padEnd(4)} ${p.fs.padEnd(7)} ${p.name.padEnd(18)} ${p.size} GB`)).join("\n");
  else if(c==="get-scheduledtask")r=state.scheduledTasks.map(t=>`${t.enabled?"Ready":"Disabled"}  ${t.name}`).join("\n");
  else if(c==="get-netipconfiguration")r=`InterfaceAlias : Wi-Fi\nIPv4Address    : 192.168.56.101\nIPv4DefaultGateway : 192.168.56.1\nNetProfile.Name: ${state.wifiNetworks.find(n=>n.connected)?.ssid||"Disconnected"}\n(Simulado)`;
  else if(c==="start-process"){const name=(args[0]||"").toLowerCase().replace(/\.exe$/,""),map={notepad:"notepad",calc:"calc",explorer:"explorer",powershell:"powershell",msedge:"edge",taskmgr:"taskmanager",regedit:"registry"};if(map[name]){openApp(map[name]);r="Processo virtual iniciado."}else r="Processo não encontrado no simulador."}
  else if(c==="clear-host"||c==="cls"){out.innerHTML="";return}
  else r=`${verb}: o termo não é reconhecido como cmdlet virtual.`;
  psWrite(out,r);
}
