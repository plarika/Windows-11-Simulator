from pathlib import Path

root=Path(__file__).resolve().parents[1]
p=root/"src/features/realism-v62.js"
s=p.read_text(encoding="utf-8")

a=s.index("  populateStart=function(){")
b=s.index("  createTaskButton=function",a)
replacement=r'''  let startAllApps=false;
  function renderStartApps(showAll=false){
    const g=$("#start-grid");g.innerHTML="";
    const priority=["edge","explorer","notepad","calc","settings","store","photos","paint","terminal","taskmanager","security","clock","stickynotes","onedrive","mediaplayer","snipping","powershell","windowstools"];
    const pinned=priority.filter(k=>APPS[k]).slice(0,18);
    const keys=showAll
      ? Object.keys(APPS).sort((a,b)=>APPS[a].name.localeCompare(APPS[b].name,"pt"))
      : pinned;
    keys.forEach(k=>{
      const a=APPS[k];
      const b=document.createElement("button");
      b.className="start-app";
      b.dataset.app=k;
      b.innerHTML=iconFor(k)+'<span>'+esc(a.name)+'</span>';
      b.addEventListener("click",()=>{openApp(k);closeOverlays()});
      g.appendChild(b);
    });
    const title=$("#start-menu .section-head h3");
    const all=$("#all-apps-btn");
    if(title)title.textContent=showAll?"Todas as aplicações":"Afixadas";
    if(all)all.textContent=showAll?"‹ Voltar":"Todas as aplicações ›";
    const rec=$("#start-menu .start-recommended");
    if(rec)rec.style.display=showAll?"none":"";
  }

  populateStart=function(){
    startAllApps=false;
    renderStartApps(false);
  };

  const allAppsButton=$("#all-apps-btn");
  if(allAppsButton){
    allAppsButton.onclick=e=>{
      e.stopPropagation();
      startAllApps=!startAllApps;
      renderStartApps(startAllApps);
    };
  }

'''
s=s[:a]+replacement+s[b:]

# Expand the system tray to include battery and replace shell glyphs.
old='''    const quick=$("#quick-btn");
    if(quick){
      quick.innerHTML='<span class="win11-tray"><span class="tray-glyph" title="Rede">'+svg('<path fill="currentColor" d="M3 19a18 18 0 0 1 26 0l-2.3 2.2a14.8 14.8 0 0 0-21.4 0zM8 23a11 11 0 0 1 16 0l-2.3 2.2a7.8 7.8 0 0 0-11.4 0zM13 27a4.2 4.2 0 0 1 6 0l-3 3z"/>')+'</span><span class="tray-glyph" title="Volume">'+svg('<path fill="currentColor" d="M5 13h6l6-5v16l-6-5H5zm15-2a8 8 0 0 1 0 10l2 1.6a10.6 10.6 0 0 0 0-13.2z"/>')+'</span></span>';
      quick.setAttribute("aria-label","Rede e volume");
    }
'''
new='''    const quick=$("#quick-btn");
    if(quick){
      quick.innerHTML='<span class="win11-tray"><span class="tray-glyph" title="Rede">'+svg('<path fill="currentColor" d="M3 19a18 18 0 0 1 26 0l-2.3 2.2a14.8 14.8 0 0 0-21.4 0zM8 23a11 11 0 0 1 16 0l-2.3 2.2a7.8 7.8 0 0 0-11.4 0zM13 27a4.2 4.2 0 0 1 6 0l-3 3z"/>')+'</span><span class="tray-glyph" title="Volume">'+svg('<path fill="currentColor" d="M5 13h6l6-5v16l-6-5H5zm15-2a8 8 0 0 1 0 10l2 1.6a10.6 10.6 0 0 0 0-13.2z"/>')+'</span><span class="tray-glyph" title="Bateria 82%">'+svg('<rect x="4" y="9" width="22" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="27" y="13" width="2" height="6" rx="1" fill="currentColor"/><rect x="7" y="12" width="15" height="8" rx="1" fill="currentColor"/>')+'</span></span>';
      quick.setAttribute("aria-label","Rede, volume e bateria");
    }
    const search=$("#search-btn");
    if(search){
      search.innerHTML='<span class="tray-glyph">'+svg('<circle cx="14" cy="14" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m19.5 19.5 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>')+'</span>';
      search.setAttribute("aria-label","Pesquisar");
    }
    const taskview=$("#taskview-btn");
    if(taskview){
      taskview.innerHTML='<span class="tray-glyph">'+svg('<rect x="5" y="8" width="13" height="16" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="5" width="13" height="16" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/>')+'</span>';
      taskview.setAttribute("aria-label","Vista de tarefas");
    }
'''
if old not in s:
    raise SystemExit("tray block not found")
s=s.replace(old,new,1)
p.write_text(s,encoding="utf-8")

css=root/"styles/realism-v62.css"
c=css.read_text(encoding="utf-8")
if 'Segoe UI Variable Text' not in c:
    c+='\nbody{font-family:"Segoe UI Variable Text","Segoe UI Variable","Segoe UI",system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}\n'
css.write_text(c,encoding="utf-8")
print("Realism refinements applied")
