"use strict";
/* ---------- Sticky Notes ---------- */
function buildStickyNotes(wrap){
  wrap.className="sticky-app";
  function render(){
    wrap.innerHTML=`<div class="sticky-toolbar"><button data-add-note>＋ Nova nota</button></div><div class="sticky-grid">${state.stickyNotes.map(n=>`<article class="sticky-note" data-note="${escapeHTML(n.id)}"><header><button data-del-note="${escapeHTML(n.id)}">✕</button></header><textarea>${escapeHTML(n.text)}</textarea></article>`).join("")}</div>`;
    wrap.querySelector("[data-add-note]").onclick=()=>{state.stickyNotes.unshift({id:"note-"+Date.now(),text:""});saveState();render()};
    wrap.querySelectorAll("[data-note] textarea").forEach(ta=>ta.oninput=()=>{const id=ta.closest("[data-note]").dataset.note;const n=state.stickyNotes.find(x=>x.id===id);if(n)n.text=ta.value;saveState()});
    wrap.querySelectorAll("[data-del-note]").forEach(b=>b.onclick=()=>{state.stickyNotes=state.stickyNotes.filter(n=>n.id!==b.dataset.delNote);saveState();render()});
  }render();
}
