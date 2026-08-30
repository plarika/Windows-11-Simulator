from pathlib import Path

root = Path(__file__).resolve().parents[1]
runtime = root / "src" / "core" / "runtime.js"
s = runtime.read_text(encoding="utf-8")

start = s.index("function buildEdge(wrap){")
end = s.index("function buildPaint", start)

replacement = r'''function buildEdge(wrap){
  wrap.className="edge";
  wrap.innerHTML=`<div class="edge-tabs"><button class="edge-tab">Novo separador</button></div>
  <div class="edge-bar">
    <button data-back title="Voltar">←</button>
    <button data-forward title="Avançar">→</button>
    <button data-reload title="Atualizar">↻</button>
    <button data-home title="Página inicial">⌂</button>
    <input class="edge-address" value="edge://newtab" aria-label="Barra de endereço">
    <button data-go>Ir</button>
    <button data-external title="Abrir no navegador real">↗</button>
  </div>
  <div class="edge-page"></div>`;

  const address=wrap.querySelector(".edge-address");
  const page=wrap.querySelector(".edge-page");
  let history=["edge://newtab"];
  let historyIndex=0;
  let currentUrl="edge://newtab";

  function setAddress(v){ currentUrl=v; address.value=v; }

  function normalizeInput(raw){
    const v=raw.trim();
    if(!v) return "edge://newtab";
    if(v==="edge://newtab" || v.startsWith("local:")) return v;
    if(/^https?:\/\//i.test(v)) return v;
    if(/^[a-z]+:/i.test(v)) return "blocked:"+v;
    if(!/\s/.test(v) && /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return "https://"+v;
    return "https://www.google.com/search?igu=1&q="+encodeURIComponent(v);
  }

  function pushHistory(url){
    history=history.slice(0,historyIndex+1);
    history.push(url);
    historyIndex=history.length-1;
  }

  function home(push=true){
    setAddress("edge://newtab");
    if(push && history[historyIndex]!=="edge://newtab") pushHistory("edge://newtab");
    page.innerHTML=`<div class="edge-home">
      <div class="edge-logo">🌐</div>
      <h1>Microsoft Edge</h1>
      <p>Internet ativada no Windows 11 Simulator.</p>
      <div class="edge-search"><input placeholder="Pesquisar na Web ou introduzir endereço"><button>Pesquisar</button></div>
      <div class="edge-cards">
        <div class="edge-card"><strong>Internet</strong><p>Abra páginas HTTPS diretamente dentro do Edge quando o site permitir incorporação.</p></div>
        <div class="edge-card"><strong>Pesquisa Web</strong><p>Pesquisas normais são enviadas para a Internet.</p></div>
        <div class="edge-card"><strong>Pesquisa local</strong><p>Use <code>local: termo</code> para procurar apenas no simulador.</p></div>
      </div>
    </div>`;
    const input=page.querySelector(".edge-search input");
    const button=page.querySelector(".edge-search button");
    const go=()=>navigate(normalizeInput(input.value));
    button.onclick=go;
    input.onkeydown=e=>{if(e.key==="Enter")go()};
  }

  function localSearch(q,push=true){
    const url="local:"+q;
    setAddress(url);
    if(push) pushHistory(url);
    const rs=collectSearchResults(q);
    page.innerHTML=`<div class="edge-local-results"><h2>Resultados locais para “${escapeHTML(q)}”</h2><p>Resultados do Windows Simulator.</p><div class="search-results" style="color:inherit"></div></div>`;
    const box=page.querySelector(".search-results");
    rs.forEach(r=>{
      const b=document.createElement("button");
      b.className="search-result";
      b.style.color="inherit";
      b.innerHTML=`<span class="sr-icon">${r.icon}</span><span><strong>${escapeHTML(r.name)}</strong><small>${escapeHTML(r.detail)}</small></span>`;
      b.onclick=()=>launchSearchResult(r);
      box.appendChild(b);
    });
    if(!rs.length) box.innerHTML="<p>Sem resultados locais.</p>";
  }

  function showBlocked(url,push=true){
    setAddress(url.replace(/^blocked:/,""));
    if(push) pushHistory(url);
    page.innerHTML=`<div class="edge-web-message"><h2>Endereço bloqueado</h2><p>Por segurança, o simulador só permite endereços <strong>http://</strong> e <strong>https://</strong>.</p><code>${escapeHTML(url.replace(/^blocked:/,""))}</code></div>`;
  }

  function showWeb(url,push=true){
    setAddress(url);
    if(push) pushHistory(url);
    page.innerHTML="";
    const shell=document.createElement("div");
    shell.className="edge-web-shell";
    const notice=document.createElement("div");
    notice.className="edge-web-notice";
    notice.innerHTML='<span>🔒 Navegação Web isolada</span><span>Alguns sites podem bloquear incorporação.</span>';
    const frame=document.createElement("iframe");
    frame.className="edge-web-frame";
    frame.src=url;
    frame.title="Conteúdo Web";
    frame.referrerPolicy="no-referrer";
    frame.setAttribute("sandbox","allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads");
    const fallback=document.createElement("div");
    fallback.className="edge-web-fallback";
    fallback.innerHTML='<span>Se a página não aparecer, o próprio site poderá estar a bloquear iframes.</span><button class="sys-button primary" data-open-external>Abrir externamente ↗</button>';
    shell.append(notice,frame,fallback);
    page.appendChild(shell);
    fallback.querySelector("[data-open-external]").onclick=()=>openExternal(url);
  }

  function navigate(input,push=true){
    const url=normalizeInput(input);
    if(url==="edge://newtab"){home(push);return}
    if(url.startsWith("local:")){localSearch(url.slice(6).trim(),push);return}
    if(url.startsWith("blocked:")){showBlocked(url,push);return}
    showWeb(url,push);
  }

  function openExternal(url=currentUrl){
    if(!/^https?:\/\//i.test(url)){
      notify("Microsoft Edge","Abra primeiro um endereço HTTP ou HTTPS.");
      return;
    }
    const w=window.open(url,"_blank","noopener,noreferrer");
    if(!w) notify("Microsoft Edge","O browser bloqueou a nova janela. Autorize pop-ups para este site.");
  }

  wrap.querySelector("[data-home]").onclick=()=>home(true);
  wrap.querySelector("[data-go]").onclick=()=>navigate(address.value,true);
  wrap.querySelector("[data-external]").onclick=()=>openExternal();
  wrap.querySelector("[data-reload]").onclick=()=>navigate(currentUrl,false);
  address.onkeydown=e=>{if(e.key==="Enter")navigate(address.value,true)};
  wrap.querySelector("[data-back]").onclick=()=>{
    if(historyIndex<=0)return;
    historyIndex--;
    navigate(history[historyIndex],false);
  };
  wrap.querySelector("[data-forward]").onclick=()=>{
    if(historyIndex>=history.length-1)return;
    historyIndex++;
    navigate(history[historyIndex],false);
  };

  home(false);
}

'''
runtime.write_text(s[:start] + replacement + s[end:], encoding="utf-8")
print("Edge Internet patch applied")
