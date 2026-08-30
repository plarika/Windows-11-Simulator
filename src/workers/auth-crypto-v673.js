"use strict";
/* Windows 11 Simulator V6.7.3 — authentication PBKDF2 worker */
function bytesToBase64(bytes){
  let s="";
  for(const b of bytes)s+=String.fromCharCode(b);
  return btoa(s);
}
function base64ToBytes(value){
  const raw=atob(value);
  const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
self.onmessage=async event=>{
  const {id,secret,saltBase64,iterations}=event.data||{};
  try{
    if(!crypto?.subtle)throw new Error("Web Crypto indisponível no worker.");
    const key=await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(String(secret??"")),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits=await crypto.subtle.deriveBits(
      {
        name:"PBKDF2",
        salt:base64ToBytes(String(saltBase64||"")),
        iterations:Number(iterations)||120000,
        hash:"SHA-256"
      },
      key,
      256
    );
    self.postMessage({id,ok:true,hash:bytesToBase64(new Uint8Array(bits))});
  }catch(err){
    self.postMessage({
      id,
      ok:false,
      error:err?.message||String(err||"Falha PBKDF2")
    });
  }
};
