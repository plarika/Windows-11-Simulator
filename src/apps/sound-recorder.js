"use strict";
/* ---------- Sound Recorder ---------- */
function buildSoundRecorder(wrap){
  wrap.className="soundrec";wrap.innerHTML='<div class="soundrec-card"><h2>Gravador de Som</h2><div class="mic-circle" data-rec>🎙️</div><div data-rec-time>00:00</div><div class="wave"></div><p style="font-size:12px;color:#68717b">Não é pedido acesso ao microfone real. A gravação é apenas uma animação visual.</p></div>';
  const wave=wrap.querySelector(".wave");for(let i=0;i<40;i++){const b=document.createElement("i");b.style.height="8px";wave.appendChild(b)}
  let rec=false,secs=0,id=null;
  wrap.querySelector("[data-rec]").onclick=()=>{rec=!rec;if(rec&&!id){id=setInterval(()=>{secs++;wrap.querySelector("[data-rec-time]").textContent=`${String(Math.floor(secs/60)).padStart(2,"0")}:${String(secs%60).padStart(2,"0")}`;[...wave.children].forEach((b,i)=>b.style.height=(8+((i*17+secs*13)%55))+"px");if(!wrap.isConnected){clearInterval(id);id=null}},1000)}else if(!rec&&id){clearInterval(id);id=null;[...wave.children].forEach(b=>b.style.height="8px");notify("Gravador de Som","Gravação visual terminada; nenhum áudio real foi capturado.")}};
}
