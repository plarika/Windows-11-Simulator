"use strict";
/* Windows 11 Simulator V9.9.7 — Edge Search Experience Pro */
(function installEdgeSearchV997(){
  const VERSION="9.9.7";
  const BASE=globalThis.Win11EdgeInternet;
  if(!BASE)throw new Error("Edge Search V9.9.7 requires Win11EdgeInternet.");
  const YOUTUBE_API="https://www.googleapis.com/youtube/v3/search";
  const GOOGLE_CSE_SRC="https://cse.google.com/cse.js";
  const YOUTUBE_SESSION_KEY="win11-edge-youtube-api-key-v997";
  const DEFAULT_MAX_RESULTS=12;
  let googleLoadPromise=null;
  let googleLoadedCx="";
  let googleRenderSeq=0;

  function clone(value){
    try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}
  }
  function safeString(value,max=300){
    return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);
  }
  function safeCx(value){
    const cx=safeString(value,120);
    return /^[A-Za-z0-9:_-]{6,120}$/.test(cx)?cx:"";
  }
  function safeApiKey(value){
    const key=safeString(value,120);
    return /^[A-Za-z0-9_-]{20,120}$/.test(key)?key:"";
  }
  function safePageToken(value){
    const token=safeString(value,240);
    return /^[A-Za-z0-9_-]{1,240}$/.test(token)?token:"";
  }
  function ensureState(){
    const raw=state.edgeSearchV997;
    if(!raw||typeof raw!=="object"||Array.isArray(raw))state.edgeSearchV997={};
    const s=state.edgeSearchV997;
    s.schemaVersion=1;
    s.googleCx=safeCx(s.googleCx);
    s.googleResultMode=s.googleResultMode==="external"?"external":"embed";
    s.regionCode=/^[A-Z]{2}$/.test(String(s.regionCode||"").toUpperCase())
      ?String(s.regionCode).toUpperCase():"PT";
    s.relevanceLanguage=/^[a-z]{2,3}(?:-[A-Za-z]{2,8})?$/.test(String(s.relevanceLanguage||""))
      ?String(s.relevanceLanguage):"pt";
    s.safeSearch=["moderate","strict","none"].includes(s.safeSearch)?s.safeSearch:"moderate";
    return s;
  }
  function getGoogleCx(){
    return safeCx(globalThis.WIN11_EDGE_GOOGLE_CX)||ensureState().googleCx;
  }
  function setGoogleCx(value){
    const cx=safeCx(value);
    ensureState().googleCx=cx;
    saveState();
    return cx;
  }
  function getGoogleResultMode(){
    return ensureState().googleResultMode;
  }
  function setGoogleResultMode(value){
    const mode=value==="embed"?"embed":"external";
    ensureState().googleResultMode=mode;
    saveState();
    return mode;
  }
  function getYouTubeApiKey(){
    const deployment=safeApiKey(globalThis.WIN11_EDGE_YOUTUBE_API_KEY);
    if(deployment)return deployment;
    try{return safeApiKey(sessionStorage.getItem(YOUTUBE_SESSION_KEY))}catch{return ""}
  }
  function setYouTubeApiKey(value){
    const key=safeApiKey(value);
    try{
      if(key)sessionStorage.setItem(YOUTUBE_SESSION_KEY,key);
      else sessionStorage.removeItem(YOUTUBE_SESSION_KEY);
    }catch{}
    return key;
  }
  function clearYouTubeApiKey(){
    try{sessionStorage.removeItem(YOUTUBE_SESSION_KEY)}catch{}
    return true;
  }

  function providerStatus(){
    const stateValue=ensureState();
    return Object.freeze({
      version:VERSION,
      google:Object.freeze({
        configured:Boolean(getGoogleCx()),
        source:safeCx(globalThis.WIN11_EDGE_GOOGLE_CX)?"deployment":stateValue.googleCx?"profile":"none",
        resultMode:stateValue.googleResultMode
      }),
      youtube:Object.freeze({
        configured:Boolean(getYouTubeApiKey()),
        source:safeApiKey(globalThis.WIN11_EDGE_YOUTUBE_API_KEY)?"deployment":getYouTubeApiKey()?"session":"none"
      }),
      regionCode:stateValue.regionCode,
      relevanceLanguage:stateValue.relevanceLanguage,
      safeSearch:stateValue.safeSearch
    });
  }

  function googleRoute(query){
    const q=safeString(query,500);
    return q?"edge://google?q="+encodeURIComponent(q):"edge://google";
  }
  function googleExternalUrl(query){
    const q=safeString(query,500);
    const url=new URL("https://www.google.com/search");
    if(q)url.searchParams.set("q",q);
    return url.href;
  }
  function youtubeRoute(query,{pageToken=""}={}){
    const q=safeString(query,500);
    const params=new URLSearchParams();
    if(q)params.set("query",q);
    const token=safePageToken(pageToken);
    if(token)params.set("pageToken",token);
    return "edge://youtube"+(params.toString()?"?"+params.toString():"");
  }

  function sanitizeYoutubeItem(item){
    const videoId=BASE.safeYouTubeVideoId?.(item?.id?.videoId);
    if(!videoId)return null;
    const snippet=item?.snippet&&typeof item.snippet==="object"?item.snippet:{};
    const thumbs=snippet.thumbnails&&typeof snippet.thumbnails==="object"?snippet.thumbnails:{};
    const thumb=thumbs.medium?.url||thumbs.high?.url||thumbs.default?.url||"";
    let thumbnail="";
    try{
      const url=new URL(thumb);
      if(url.protocol==="https:"&&(url.hostname==="i.ytimg.com"||url.hostname.endsWith(".ytimg.com")))thumbnail=url.href;
    }catch{}
    const publishedAt=Number.isNaN(Date.parse(snippet.publishedAt||""))?"":new Date(snippet.publishedAt).toISOString();
    return Object.freeze({
      videoId,
      title:safeString(snippet.title,240)||"Vídeo do YouTube",
      thumbnail,
      publishedAt
    });
  }

  async function youtubeSearch(query,{pageToken="",signal}={}){
    const q=safeString(query,500);
    if(!q)throw Object.assign(new Error("Introduza uma pesquisa."),{code:"EMPTY_QUERY"});
    const key=getYouTubeApiKey();
    if(!key)throw Object.assign(new Error("Configure uma chave da YouTube Data API v3 nas Definições do Edge."),{code:"YOUTUBE_KEY_REQUIRED"});
    const settings=ensureState();
    const params=new URLSearchParams({
      part:"snippet",
      type:"video",
      q,
      key,
      maxResults:String(DEFAULT_MAX_RESULTS),
      videoEmbeddable:"true",
      videoSyndicated:"true",
      safeSearch:settings.safeSearch,
      regionCode:settings.regionCode,
      relevanceLanguage:settings.relevanceLanguage
    });
    const token=safePageToken(pageToken);
    if(token)params.set("pageToken",token);
    const ownController=!signal&&typeof AbortController==="function"?new AbortController():null;
    const timer=ownController?setTimeout(()=>ownController.abort(),12000):0;
    let response;
    try{
      response=await fetch(YOUTUBE_API+"?"+params.toString(),{
        method:"GET",
        mode:"cors",
        credentials:"omit",
        referrerPolicy:"strict-origin-when-cross-origin",
        signal:signal||ownController?.signal
      });
    }finally{
      if(timer)clearTimeout(timer);
    }
    let body={};
    try{body=await response.json()}catch{}
    if(!response.ok){
      const reason=safeString(body?.error?.message||("HTTP "+response.status),180);
      throw Object.assign(new Error("YouTube API: "+reason),{code:"YOUTUBE_API_ERROR",status:response.status});
    }
    const items=(Array.isArray(body.items)?body.items:[]).map(sanitizeYoutubeItem).filter(Boolean);
    return Object.freeze({
      query:q,
      items:Object.freeze(items),
      nextPageToken:safePageToken(body.nextPageToken),
      prevPageToken:safePageToken(body.prevPageToken),
      regionCode:/^[A-Z]{2}$/.test(String(body.regionCode||""))?body.regionCode:settings.regionCode
    });
  }

  function waitForGoogleApi(timeoutMs=10000){
    const started=Date.now();
    return new Promise((resolve,reject)=>{
      const poll=()=>{
        if(globalThis.google?.search?.cse?.element?.render)return resolve(true);
        if(Date.now()-started>=timeoutMs)return reject(Object.assign(new Error("O Google Programmable Search não respondeu a tempo."),{code:"GOOGLE_CSE_TIMEOUT"}));
        setTimeout(poll,60);
      };
      poll();
    });
  }

  async function loadGoogleProgrammableSearch(){
    const cx=getGoogleCx();
    if(!cx)throw Object.assign(new Error("Configure o ID cx do Google Programmable Search nas Definições do Edge."),{code:"GOOGLE_CX_REQUIRED"});
    if(googleLoadedCx&&googleLoadedCx!==cx){
      throw Object.assign(new Error("O ID cx foi alterado. Recarregue o simulador para ativar o novo motor Google."),{code:"GOOGLE_CX_CHANGED"});
    }
    if(globalThis.google?.search?.cse?.element?.render){
      googleLoadedCx=googleLoadedCx||cx;
      return true;
    }
    if(googleLoadPromise)return googleLoadPromise;
    googleLoadedCx=cx;
    googleLoadPromise=new Promise((resolve,reject)=>{
      globalThis.__gcse=globalThis.__gcse||{};
      globalThis.__gcse.parsetags="explicit";
      let script=document.getElementById("win11-google-cse-v997");
      if(!script){
        script=document.createElement("script");
        script.id="win11-google-cse-v997";
        script.async=true;
        script.src=GOOGLE_CSE_SRC+"?cx="+encodeURIComponent(cx);
        script.referrerPolicy="strict-origin-when-cross-origin";
        document.head.appendChild(script);
      }
      const fail=()=>reject(Object.assign(new Error("Não foi possível carregar o Google Programmable Search."),{code:"GOOGLE_CSE_LOAD"}));
      script.addEventListener("error",fail,{once:true});
      if(script.dataset.loaded==="1"){
        waitForGoogleApi().then(resolve,reject);
      }else{
        script.addEventListener("load",()=>{
          script.dataset.loaded="1";
          waitForGoogleApi().then(resolve,reject);
        },{once:true});
      }
    }).catch(err=>{googleLoadPromise=null;throw err});
    return googleLoadPromise;
  }

  function safeResultHref(value){
    try{
      const url=new URL(String(value||""));
      if(!["http:","https:"].includes(url.protocol))return "";
      if(url.username||url.password)return "";
      return url.href;
    }catch{return ""}
  }

  function installGoogleResultRouting(container,onResult){
    if(!(container instanceof Element)||typeof onResult!=="function")return ()=>{};
    const handler=event=>{
      const anchor=event.target?.closest?.("a[href]");
      if(!anchor||!container.contains(anchor))return;
      const href=safeResultHref(anchor.href);
      if(!href)return;
      let host="";
      try{host=new URL(href).hostname.toLowerCase()}catch{}
      if(host==="cse.google.com"||host.endsWith(".googleusercontent.com"))return;
      event.preventDefault();
      event.stopPropagation();
      onResult(href,event);
    };
    container.addEventListener("click",handler,true);
    return ()=>container.removeEventListener("click",handler,true);
  }

  async function renderGoogleResults(container,query,{onResult}={}){
    if(!(container instanceof Element))throw new TypeError("Google results container is required.");
    const q=safeString(query,500);
    if(!q)throw Object.assign(new Error("Introduza uma pesquisa."),{code:"EMPTY_QUERY"});
    await loadGoogleProgrammableSearch();
    container.innerHTML="";
    const host=document.createElement("div");
    host.className="edge-google-cse-host-v997";
    host.id="edge-google-cse-"+(++googleRenderSeq)+"-"+Date.now().toString(36);
    container.appendChild(host);
    const gname="edgeGoogle"+googleRenderSeq;
    installGoogleResultRouting(host,onResult||(()=>{}));
    globalThis.google.search.cse.element.render({
      div:host,
      tag:"searchresults-only",
      gname,
      attributes:{linkTarget:"_self",mobileLayout:"enabled",safeSearch:"active"}
    });
    let element=globalThis.google.search.cse.element.getElement(gname);
    if(!element){
      const all=globalThis.google.search.cse.element.getAllElements?.()||{};
      element=Object.values(all).find(item=>item?.gname===gname)||Object.values(all).at(-1);
    }
    if(!element?.execute)throw Object.assign(new Error("O componente de resultados Google não ficou disponível."),{code:"GOOGLE_CSE_RENDER"});
    element.execute(q);
    return Object.freeze({rendered:true,query:q,gname,cx:getGoogleCx()});
  }

  globalThis.Win11EdgeSearch=Object.freeze({
    version:VERSION,
    youtubeApiEndpoint:YOUTUBE_API,
    googleCseEndpoint:GOOGLE_CSE_SRC,
    providerStatus,
    getGoogleCx,
    setGoogleCx,
    getGoogleResultMode,
    setGoogleResultMode,
    getYouTubeApiKey,
    setYouTubeApiKey,
    clearYouTubeApiKey,
    googleRoute,
    googleExternalUrl,
    youtubeRoute,
    youtubeSearch,
    loadGoogleProgrammableSearch,
    renderGoogleResults,
    installGoogleResultRouting,
    safeResultHref,
    get state(){return Object.freeze(clone(ensureState()))},
    limits:Object.freeze({youtubeResultsPerPage:DEFAULT_MAX_RESULTS})
  });
})();
