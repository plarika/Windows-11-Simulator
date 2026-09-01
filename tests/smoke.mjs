import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const index = readFileSync(resolve(root, "index.html"), "utf8");
let failed = 0;

const check = (ok, name) => {
  console.log((ok ? "PASS " : "FAIL ") + name);
  if (!ok) failed++;
};

check(!/<style[ >]/i.test(index), "No inline style block");
check(!/<script(?![^>]*src=)[^>]*>/i.test(index), "No inline script block");

const refs = [...index.matchAll(/(?:src|href)="(\.\/[^"#?]+)(?:\?[^"]*)?"/g)].map(m => m[1]);

for (const ref of refs) {
  check(existsSync(resolve(root, ref.slice(2))), "Asset " + ref);
}

const jsRefs = refs.filter(x => x.endsWith(".js"));
for (const ref of jsRefs) {
  const file = resolve(root, ref.slice(2));
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  check(result.status === 0, "Syntax " + ref);
}

const allJs = jsRefs
  .map(ref => readFileSync(resolve(root, ref.slice(2)), "utf8"))
  .join("\n");

for (const forbidden of [
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /\bchild_process\b/,
]) {
  check(!forbidden.test(allJs), "Forbidden API absent " + forbidden);
}

const appRealism = readFileSync(
  resolve(root, "src/features/app-realism-v63.js"),
  "utf8"
);

check(
  appRealism.includes("pathObserver.disconnect()"),
  "Explorer breadcrumb observer guarded"
);
check(
  /gridObserver\.observe\(grid,\{childList:true,subtree:true,attributes:true/.test(appRealism),
  "Explorer selection observer watches child classes"
);
check(
  appRealism.includes("name+=accept"),
  "Save dialog appends required extension"
);
check(
  index.includes("./favicon.svg?v=8.1.0"),
  "Versioned favicon reference"
);

const encodingTargets = [
  "index.html",
  "README.md",
  ...refs.filter(x => /\.(?:js|css)$/.test(x)).map(x => x.slice(2)),
];

const classicMojibake = [
  "\u00C3\u00A3",
  "\u00C3\u00A1",
  "\u00C3\u00A9",
  "\u00C3\u00AA",
  "\u00C3\u00B3",
  "\u00C3\u00BA",
  "\u00C3\u00A7",
  "\u00C3\u00B5",
  "\u00C2\u00B0",
  "\u00E2\u20AC\u201D",
  "\u00E2\u20AC\u201C",
  "\u00E2\u20AC\u02DC",
  "\u00E2\u20AC\u2122",
  "\u00E2\u20AC\u0153",
  "\u00E2\u20AC\u009D",
  "\u00E2\u20AC\u00B9",
  "\u00E2\u20AC\u00BA",
  "\u00E2\u201E\u00A2",
  "\u00E2\u20AC\u00A2",
];

for (const rel of [...new Set(encodingTargets)]) {
  const text = readFileSync(resolve(root, rel), "utf8");
  check(!text.includes("\uFFFD"), "No replacement character: " + rel);
  check(!/[\u0080-\u009F]/.test(text), "No C1 control mojibake: " + rel);
  check(
    !classicMojibake.some(token => text.includes(token)),
    "No classic mojibake: " + rel
  );
}



const realFiles = readFileSync(resolve(root, "src/features/real-files-v640.js"), "utf8");
check(realFiles.includes("showOpenFilePicker"), "Real file native open integration present");
check(realFiles.includes("showSaveFilePicker"), "Real file native save integration present");
check(realFiles.includes('input.type="file"'), "Real file open fallback present");
check(realFiles.includes("URL.createObjectURL"), "Real file download fallback present");
check(realFiles.includes("createWritable"), "Real file writable handle support present");
check(realFiles.includes("Abrir do dispositivo"), "Notepad real open control present");
check(realFiles.includes("Guardar no dispositivo"), "Notepad real save control present");
check(index.includes("./src/features/real-files-v640.js?v=9.6.0"), "Real file bridge loaded");
check(index.includes("./styles/real-files-v640.css?v=8.1.0"), "Real file bridge styles loaded");



const realClipboard = readFileSync(resolve(root, "src/features/real-clipboard-v650.js"), "utf8");
check(realClipboard.includes("navigator.clipboard?.writeText"), "Real clipboard write integration present");
check(realClipboard.includes("navigator.clipboard?.readText"), "Real clipboard read integration present");
check(realClipboard.includes('document.execCommand("copy")'), "Clipboard copy fallback present");
check(realClipboard.includes("manualPasteDialog"), "Clipboard manual paste fallback present");
check(realClipboard.includes("Ler do dispositivo"), "Win+V real clipboard read control present");
check(realClipboard.includes("Copiar para dispositivo"), "Win+V real clipboard write control present");
check(realClipboard.includes("Copiar dispositivo"), "Notepad real clipboard copy control present");
check(realClipboard.includes("Colar dispositivo"), "Notepad real clipboard paste control present");
check(index.includes("./src/features/real-clipboard-v650.js?v=8.1.0"), "Real clipboard bridge loaded");
check(index.includes("./styles/real-clipboard-v650.css?v=8.1.0"), "Real clipboard styles loaded");



const realContent = readFileSync(resolve(root, "src/features/real-content-v660.js"), "utf8");
check(realContent.includes("indexedDB.open"), "IndexedDB real file store present");
check(realContent.includes("showDirectoryPicker"), "Real folder picker integration present");
check(realContent.includes("webkitdirectory"), "Folder picker fallback present");
check(realContent.includes("dragenter"), "Explorer drag and drop integration present");
check(realContent.includes("data-import-files"), "Explorer real import control present");
check(realContent.includes("data-export-file"), "Explorer real export control present");
check(realContent.includes("Abrir imagem do dispositivo"), "Photos real image control present");
check(realContent.includes("Abrir multimédia"), "Media Player real media control present");
check(index.includes("./src/features/real-content-v660.js?v=8.1.0"), "Real content module loaded");
check(index.includes("./styles/real-content-v660.css?v=8.1.0"), "Real content styles loaded");

const realPlatform = readFileSync(resolve(root, "src/features/real-platform-v660.js"), "utf8");
check(realPlatform.includes("Notification.requestPermission"), "Real notification permission integration present");
check(realPlatform.includes("new Notification"), "Real browser notification integration present");
check(realPlatform.includes("serviceWorker.register"), "PWA service worker registration present");
check(realPlatform.includes("beforeinstallprompt"), "PWA install prompt integration present");
check(index.includes("./manifest.webmanifest?v=8.1.0"), "PWA manifest loaded");
check(index.includes("./src/features/real-platform-v660.js?v=8.1.0"), "Real platform module loaded");
check(existsSync(resolve(root, "manifest.webmanifest")), "PWA manifest exists");
check(existsSync(resolve(root, "service-worker.js")), "Service worker exists");
check(existsSync(resolve(root, "icons/icon-192.png")), "PWA 192 icon exists");
check(existsSync(resolve(root, "icons/icon-512.png")), "PWA 512 icon exists");
const swCheck = spawnSync(process.execPath, ["--check", resolve(root, "service-worker.js")], { encoding: "utf8" });
check(swCheck.status === 0, "Service worker syntax");
let manifestOk = false;
try {
  const manifest = JSON.parse(readFileSync(resolve(root, "manifest.webmanifest"), "utf8"));
  manifestOk = manifest.name === "Windows 11 Simulator" && manifest.start_url === "./" && Array.isArray(manifest.icons) && manifest.icons.length >= 2;
} catch {}
check(manifestOk, "PWA manifest JSON and required fields");
check(realContent.includes("cleanupVirtualFolder"), "IndexedDB cleanup integration present");



const sessions = readFileSync(resolve(root, "src/features/local-accounts-v670.js"), "utf8");
check(sessions.includes("PBKDF2"), "Session credentials use PBKDF2");
check(sessions.includes("SHA-256"), "Session credentials use SHA-256");
check(sessions.includes("crypto.getRandomValues"), "Session credentials use random salt");
check(sessions.includes("win11-sim-profile-v67:"), "Per-user profile storage prefix present");
check(sessions.includes("sessionStorage"), "Active session uses sessionStorage");
check(sessions.includes("BroadcastChannel"), "Concurrent session detection present");
check(sessions.includes("Terminar sessão"), "Sign out control present");
check(sessions.includes("Mudar de utilizador"), "Switch user control present");
check(sessions.includes("legacy-backup-v67"), "Legacy migration backup present");
check(!/localStorage\.setItem\([^;]*secret/i.test(sessions), "Secrets are not stored directly");
check(index.includes("./src/features/local-accounts-v670.js?v=9.9.2"), "Session module loaded through V9.9.2 cache key");
check(index.includes("./styles/local-accounts-v670.css?v=8.1.0"), "Session styles loaded");
check(realContent.includes("ownerId:currentOwnerId()"), "IndexedDB blobs record ownerId");
check(realContent.includes("claimLegacyBlobs"), "Legacy IndexedDB ownership migration present");
check(realContent.includes("record.ownerId&&record.ownerId!==owner"), "IndexedDB owner isolation enforced");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("local-accounts-v670.js?v=9.9.2"), "Session module precached by service worker with V9.9.2 cache key");
check(existsSync(resolve(root, "src/workers/auth-crypto-v673.js")), "Auth crypto worker exists");
const authWorkerSource=readFileSync(resolve(root, "src/workers/auth-crypto-v673.js"), "utf8");
const authWorkerCheck=spawnSync(process.execPath, ["--check", resolve(root, "src/workers/auth-crypto-v673.js")], {encoding:"utf8"});
check(authWorkerCheck.status===0, "Auth crypto worker syntax");
check(authWorkerSource.includes("crypto.subtle.deriveBits"), "Auth worker performs PBKDF2 off main thread");
check(sessions.includes("new Worker(AUTH_WORKER_URL)"), "Session login uses auth worker");
check(sessions.includes("const ITERATIONS=120000"), "New credentials use mobile-optimized PBKDF2 cost");
check(sessions.includes("upgradeCredentialIfNeeded"), "Legacy credential upgrade present");
check(sessions.includes("A verificar no dispositivo..."), "Slow auth progress state present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("auth-crypto-v673.js?v=8.1.0"), "Auth worker precached by service worker");

const runtimeSource = readFileSync(resolve(root, "src/core/runtime.js"), "utf8");
const bootSource = readFileSync(resolve(root, "src/core/boot.js"), "utf8");
check(runtimeSource.includes("if(Array.isArray(accounts)&&accounts.length)return null"), "No shared state key when accounts exist without session");
check(runtimeSource.includes("if(!key)return defaultState()"), "Unauthenticated runtime loads default state only");
check(runtimeSource.includes("if(!key)return;localStorage.setItem"), "Unauthenticated runtime does not persist shared state");
check(bootSource.includes("const sessionBoot = globalThis.Win11SessionManager?.handleBootComplete"), "Session manager starts during boot");
check(bootSource.indexOf("await sessionBoot") < bootSource.indexOf('document.getElementById("boot")?.classList.add("hidden")'), "Boot waits for session preparation before hiding");
check(index.includes('<div id="lock"><div>'), "Initial lock surface is ready under boot");
const scriptTags=[...index.matchAll(/<script([^>]*)src="([^"]+)"[^>]*><\/script>/g)];
check(scriptTags.length>20, "Expected modular script set present");
check(scriptTags.every(m=>/\bdefer\b/.test(m[1])), "All external scripts use defer for parallel first-load downloads");
check(index.includes('id="boot-status">A preparar sessão...</div>'), "Boot shows session preparation status");



const sessionCss=readFileSync(resolve(root, "styles/local-accounts-v670.css"), "utf8");
check(sessionCss.includes("#lock.session-lock.hidden{display:none!important}"), "Session lock hidden CSS override present");
check(readFileSync(resolve(root, "tools/browser_audit.mjs"), "utf8").includes('getComputedStyle(lock).display==="none"'), "Browser audit checks computed lock visibility");
const realDevice=readFileSync(resolve(root, "src/features/real-device-tools-v680.js"), "utf8");
check(realDevice.includes("navigator.mediaDevices.getUserMedia({audio:true,video:false})"), "Real microphone capture integration present");
check(realDevice.includes("new MediaRecorder"), "MediaRecorder integration present");
check(realDevice.includes("video:{facingMode:{ideal:facing}}"), "Real camera integration present");
check(realDevice.includes("navigator.mediaDevices.getDisplayMedia"), "Real screen capture integration present");
check(realDevice.includes("navigator.storage.persist()"), "Persistent storage integration present");
check(realDevice.includes('navigator.wakeLock.request("screen")'), "Wake Lock integration present");
check(realDevice.includes("document.documentElement.requestFullscreen"), "Fullscreen integration present");
check(realDevice.includes("navigator.storage.estimate()"), "Real storage diagnostics present");
check(realDevice.includes("navigator.hardwareConcurrency"), "Real CPU diagnostics present");
check(realDevice.includes("navigator.deviceMemory"), "Real memory diagnostics present");
check(realDevice.includes('RealContentBridge.importFileToVirtual(file,"C:/Music")'), "Recorder stores audio in user filesystem");
check(realDevice.includes('RealContentBridge.importFileToVirtual(file,"C:/Pictures")'), "Camera and snipping store images in user filesystem");
check(index.includes("./src/features/real-device-tools-v680.js?v=8.1.0"), "Real device tools module loaded");
check(index.includes("./styles/real-device-tools-v680.css?v=8.1.0"), "Real device tools styles loaded");
check(readFileSync(resolve(root, "src/core/runtime.js"), "utf8").includes('camera:{name:"Câmara"'), "Camera app registered");
check(readFileSync(resolve(root, "src/apps/v5-runtime.js"), "utf8").includes('if(appId==="camera"){buildCamera(wrap);return wrap}'), "Camera renderer registered");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("real-device-tools-v680.js?v=8.1.0"), "Real device tools precached");
check(sessions.includes("updateAccountName"), "Account rename integration present");
check(sessions.includes("setAccountAvatar"), "Profile avatar integration present");
check(sessions.includes("changeCurrentCredential"), "Credential change integration present");
check(sessions.includes("deleteAccount"), "Account deletion integration present");
check(sessions.includes("buildCurrentProfileBackup"), "Profile backup builder present");
check(sessions.includes("restoreCurrentProfileBackup"), "Profile restore integration present");
check(sessions.includes('schema:"win11-simulator-profile"'), "Profile backup schema present");
check(sessions.includes("scheduleInactivityLock"), "Automatic inactivity lock integration present");
check(sessions.includes('new CustomEvent("win11-session-end")'), "Session-end privacy event present");
check(realContent.includes("exportOwnerBackup"), "IndexedDB profile backup export present");
check(realContent.includes("importOwnerBackup"), "IndexedDB profile backup restore present");
check(realContent.includes("idMap[item.sourceId]=newId"), "Backup blob IDs are remapped");
check(realDevice.includes('window.addEventListener("win11-session-end",onSessionEnd)'), "Sensitive media stops on session end");
check(readFileSync(resolve(root, "styles/local-accounts-v670.css"), "utf8").includes(".session-avatar.has-image"), "Avatar image styles present");
check(readFileSync(resolve(root, "styles/local-accounts-v670.css"), "utf8").includes(".profile-management-card"), "Profile management styles present");
check(realDevice.includes('"profile-backup"') && realDevice.includes('"auto-lock"'), "V6.9 profile capabilities registered");
const desktopIntegration=readFileSync(resolve(root, "src/features/desktop-integration-v700.js"), "utf8");
check(index.includes("./src/features/desktop-integration-v700.js?v=9.8.5"), "Desktop integration module loaded");
check(index.includes("./styles/desktop-integration-v700.css?v=8.1.0"), "Desktop integration styles loaded");
check(desktopIntegration.includes("DEFAULT_ASSOCIATIONS"), "Default file associations present");
check(desktopIntegration.includes("showOpenWith"), "Open With integration present");
check(desktopIntegration.includes("navigator.share"), "Native share integration present");
check(desktopIntegration.includes("navigator.canShare"), "File sharing capability check present");
check(desktopIntegration.includes("contentWindow?.print()"), "Real print dialog integration present");
check(desktopIntegration.includes("printableTextDocument"), "Safe text print renderer present");
check(desktopIntegration.includes("escapeHTML(text)"), "Print text is HTML escaped");
check(desktopIntegration.includes("state.fileAssociations"), "Associations persist in per-user state");
check(desktopIntegration.includes("data-real-network"), "Real network Quick Settings tile present");
check(desktopIntegration.includes("navigator.onLine"), "Real online/offline state integration present");
check(desktopIntegration.includes("data-real-fullscreen"), "Real fullscreen Quick Settings present");
check(desktopIntegration.includes("data-real-wake"), "Real Wake Lock Quick Settings present");
check(desktopIntegration.includes("browser não pode alterar o Wi‑Fi real"), "Virtual versus real Wi-Fi disclosure present");
check(readFileSync(resolve(root, "src/apps/explorer-v5.js"), "utf8").includes('["Abrir com...",()=>Win11DesktopIntegration.showOpenWith'), "Explorer Open With action present");
check(readFileSync(resolve(root, "src/apps/explorer-v5.js"), "utf8").includes('["Partilhar",()=>Win11DesktopIntegration.shareFile'), "Explorer Share action present");
check(readFileSync(resolve(root, "src/apps/explorer-v5.js"), "utf8").includes('["Imprimir",()=>Win11DesktopIntegration.printFile'), "Explorer Print action present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("desktop-integration-v700.js?v=9.8.5"), "Desktop integration precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("desktop-integration-v700.css?v=8.1.0"), "Desktop integration CSS precached");
const realMounts=readFileSync(resolve(root, "src/features/real-folder-mounts-v710.js"), "utf8");
check(index.includes("./src/features/real-folder-mounts-v710.js?v=8.1.0"), "Real folder mounts module loaded");
check(index.includes("./styles/real-folder-mounts-v710.css?v=8.1.0"), "Real folder mounts styles loaded");
check(realMounts.includes('showDirectoryPicker({mode:"readwrite"})'), "Directory picker requests read/write access");
check(realMounts.includes('indexedDB.open(DB_NAME,DB_VERSION)'), "Mount handles use IndexedDB persistence");
check(realMounts.includes('store.createIndex("ownerId","ownerId"'), "Mount persistence indexed by ownerId");
check(realMounts.includes('queryPermission({mode})'), "Mount permission query present");
check(realMounts.includes('requestPermission({mode})'), "Mount permission re-request present");
check(realMounts.includes("getDirectoryHandle(segment,{create})"), "Mounted directory traversal present");
check(realMounts.includes("getFileHandle(clean,{create:true})"), "Mounted real file creation present");
check(realMounts.includes("removeEntry(oldName)"), "Mounted real file rename removes old entry");
check(realMounts.includes('removeEntry(safeEntryName(name),{recursive:kind==="directory"})'), "Mounted real deletion present");
check(realMounts.includes("RealNotepadPending"), "Mounted text opens into writable Notepad flow");
check(realMounts.includes("Win11DesktopIntegration.shareFile"), "Mounted files integrate with native share");
check(realMounts.includes("Win11DesktopIntegration.printFile"), "Mounted files integrate with real print");
check(realMounts.includes("mountButton.dataset.mountReal"), "Explorer mount button integration present");
check(realMounts.includes("card.dataset.realMountCard"), "This PC mounted-folder card integration present");
check(realMounts.includes("data-real-mount-settings"), "Settings mounted-folder management present");
check(realMounts.includes("mem.ownerId===owner") && realMounts.includes("record?.ownerId===owner"), "Mounted folder access is owner-isolated");
check(sessions.includes("Win11RealMounts?.purgeOwnerMounts"), "Account deletion purges mount references");
check(realFiles.includes("RealNotepadPending"), "Notepad consumes mounted real file handles");
check(desktopIntegration.includes("value instanceof Blob"), "Desktop integration accepts direct mounted files");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("real-folder-mounts-v710.js?v=8.1.0"), "Real folder mounts precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("real-folder-mounts-v710.css?v=8.1.0"), "Real folder mounts CSS precached");
const edgeInternet=readFileSync(resolve(root, "src/features/edge-internet-v720.js"), "utf8");
check(index.includes("./src/features/edge-internet-v720.js?v=8.1.2"), "Edge Internet module loaded");
check(index.includes("./styles/edge-internet-v720.css?v=8.1.2"), "Edge Internet styles loaded");
check(edgeInternet.includes("www.google.com/search?igu=1&newwindow=1&q="), "Google search integration present");
check(edgeInternet.includes('url.searchParams.set("igu","1")'), "Google iframe compatibility flag present");
check(edgeInternet.includes('url.searchParams.set("newwindow","1")'), "Google result new-window mode present");
check(edgeInternet.includes('url.searchParams.delete("igu")'), "Google external fallback removes iframe-only flag");
check(edgeInternet.includes("allow-popups allow-popups-to-escape-sandbox"), "Google result popups permitted by sandbox");
check(!edgeInternet.includes("allow-top-navigation"), "Edge iframe cannot top-navigate simulator");
check(edgeInternet.includes('const OUVIR_MUSICA_URL="https://www.ouvirmusica.com.br/"'), "Ouvir Música integration URL present");
check(edgeInternet.includes('edge-shortcut-icon ouvir') && !edgeInternet.includes('data-edge-shortcut="edge://youtube"'), "Ouvir Música replaces YouTube shortcut");
check(edgeInternet.includes('frame.setAttribute("allow","autoplay; encrypted-media")'), "Ouvir Música iframe audio permissions present");
check(edgeInternet.includes('value.startsWith("edge://youtube")') && edgeInternet.includes("OUVIR_MUSICA_URL"), "Legacy YouTube route migration present");
check(edgeInternet.includes("KNOWN_FRAME_BLOCKERS"), "Known iframe blocker compatibility mode present");
check(edgeInternet.includes("X-Frame-Options") || readFileSync(resolve(root, "SECURITY.md"), "utf8").includes("X-Frame-Options"), "Frame-policy disclosure present");
check(edgeInternet.includes("data-edge-shortcut"), "Edge new-tab Web shortcuts present");
check(edgeInternet.includes('edgeUrl==="edge://ouvirmusica"'), "Ouvir Música external fallback present");
check(edgeInternet.includes("data-compat-open"), "Blocked-site external fallback present");
check(edgeInternet.includes("allow-forms allow-scripts allow-same-origin") && edgeInternet.includes("allow-storage-access-by-user-activation"), "Generic Web iframe remains sandboxed");
check(edgeInternet.includes("autoplay; encrypted-media"), "Music iframe media permission is bounded");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("edge-internet-v720.js?v=8.1.2"), "Edge Internet module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("edge-internet-v720.css?v=8.1.2"), "Edge Internet CSS precached");
const edgeAdvanced=readFileSync(resolve(root, "src/features/edge-advanced-v730.js"), "utf8");
check(index.includes("./src/features/edge-advanced-v730.js?v=9.8.5"), "Edge Advanced module loaded");
check(index.includes("./styles/edge-advanced-v730.css?v=8.1.0"), "Edge Advanced styles loaded");
check(edgeAdvanced.includes("edge://favorites"), "Edge Favorites page present");
check(edgeAdvanced.includes("edge://history"), "Edge History page present");
check(edgeAdvanced.includes("edge://downloads"), "Edge Downloads page present");
check(edgeAdvanced.includes("edge://settings"), "Edge Settings page present");
check(edgeAdvanced.includes("state.edgeBrowser"), "Edge state persists in current profile");
check(edgeAdvanced.includes("restoreTabs"), "Edge restore-tabs setting present");
check(edgeAdvanced.includes("showFavoritesBar"), "Edge favorites-bar setting present");
check(edgeAdvanced.includes("closedTabs"), "Edge closed-tab stack present");
check(edgeAdvanced.includes("reopenClosedTab"), "Edge reopen closed tab present");
check(edgeAdvanced.includes("duplicateTab"), "Edge duplicate tab present");
check(edgeAdvanced.includes("setPinned"), "Edge pinned tabs present");
check(edgeAdvanced.includes("closeOthers"), "Edge close-others action present");
check(edgeAdvanced.includes("closeRight"), "Edge close-right action present");
check(edgeAdvanced.includes('key==="t"&&!e.shiftKey'), "Edge Ctrl+T shortcut present");
check(edgeAdvanced.includes('key==="w"&&!e.shiftKey'), "Edge Ctrl+W shortcut present");
check(edgeAdvanced.includes('key==="t"&&e.shiftKey'), "Edge Ctrl+Shift+T shortcut present");
check(edgeAdvanced.includes('key==="l"'), "Edge Ctrl+L shortcut present");
check(edgeAdvanced.includes('key==="r"'), "Edge Ctrl+R shortcut present");
check(edgeAdvanced.includes('key==="tab"'), "Edge Ctrl+Tab shortcut present");
check(edgeAdvanced.includes('fetch(normalized,{mode:"cors"'), "Edge direct downloads respect CORS");
check(edgeAdvanced.includes("showSaveFilePicker"), "Edge downloads use File System Access when available");
check(edgeAdvanced.includes("recordDownload"), "Edge download history present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("edge-advanced-v730.js?v=9.8.5"), "Edge Advanced module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("edge-advanced-v730.css?v=8.1.0"), "Edge Advanced CSS precached");
const explorerPro=readFileSync(resolve(root, "src/features/explorer-pro-v740.js"), "utf8");
check(index.includes("./src/features/explorer-pro-v740.js?v=9.6.0"), "Explorer Pro module loaded");
check(index.includes("./styles/explorer-pro-v740.css?v=8.1.0"), "Explorer Pro styles loaded");
check(explorerPro.includes("explorer-multiselect"), "Explorer multi-select capability registered");
check(explorerPro.includes("__explorerProV740") && explorerPro.includes("refresh:()=>setTimeout(decorate,0)"), "Explorer Pro exposes safe refresh integration");
check(explorerPro.includes(".file-grid,.file-list,.thispc-grid"), "Explorer Pro installs from This PC grid mode");
check(explorerPro.includes("event.shiftKey&&anchorName"), "Explorer Shift range selection present");
check(explorerPro.includes("selectionBox"), "Explorer selection rectangle present");
check(explorerPro.includes('key==="a"'), "Explorer Ctrl+A present");
check(explorerPro.includes('key==="c"'), "Explorer Ctrl+C present");
check(explorerPro.includes('key==="x"'), "Explorer Ctrl+X present");
check(explorerPro.includes('key==="v"'), "Explorer Ctrl+V present");
check(explorerPro.includes("copyFileAdvanced"), "Explorer advanced file copy present");
check(explorerPro.includes("copyFolderAdvanced"), "Explorer advanced folder copy present");
check(explorerPro.includes("moveFolderToRecycle"), "Explorer folder recycle support present");
check(explorerPro.includes("restoreRecycleItem"), "Explorer recycle restore support present");
check(explorerPro.includes("permanentlyDeleteVirtual"), "Explorer permanent delete support present");
check(explorerPro.includes("RealContentBridge.putBlob"), "Explorer real Blob copies are duplicated");
check(explorerPro.includes("application/x-win11sim-v74"), "Explorer multi-item drag payload present");
check(explorerPro.includes("showSelectedProperties"), "Explorer advanced properties present");
check(explorerPro.includes("type:") && explorerPro.includes("ext:") && explorerPro.includes("size:"), "Explorer advanced search filters present");
check(explorerPro.includes("explorer-pro-thumb"), "Explorer image thumbnails present");
check(explorerPro.includes('wrap.classList.contains("real-mount-mode")'), "Explorer Pro guards real mount mode");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-pro-v740.js?v=9.6.0"), "Explorer Pro module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-pro-v740.css?v=8.1.0"), "Explorer Pro CSS precached");
const explorerNavigation=readFileSync(resolve(root, "src/features/explorer-navigation-v820.js"), "utf8");
check(index.includes("./src/features/explorer-navigation-v820.js?v=9.8.6"), "Explorer Navigation V9.3 module loaded through V9.8.6 cache key");
check(index.includes("./styles/explorer-navigation-v820.css?v=8.3.0"), "Explorer Navigation V8.3 styles loaded");
check(explorerNavigation.includes('version:"9.3.0"'), "Explorer Navigation V9.3 bridge present");
check(explorerNavigation.includes('"explorer-tabs"') && explorerNavigation.includes('"explorer-tab-history"'), "Explorer tab capabilities registered");
check(explorerNavigation.includes("explorerNavigationV83") && explorerNavigation.includes("explorerNavigationV821"), "Explorer V8.2.1 state migration present");
check(explorerNavigation.includes("togglePinTab") && explorerNavigation.includes('"explorer-pinned-tabs"'), "Explorer pinned tabs present");
check(explorerNavigation.includes("reorderTab") && explorerNavigation.includes("application/x-win11-explorer-tab"), "Explorer tab drag reorder present");
check(explorerNavigation.includes("quickAccess") && explorerNavigation.includes("Acesso rápido"), "Explorer Quick Access present");
check(explorerNavigation.includes("addQuickAccess") && explorerNavigation.includes("removeQuickAccess"), "Explorer Quick Access actions present");
check(explorerNavigation.includes("!t.pinned") && explorerNavigation.includes('"explorer-pinned-tab-protection"'), "Explorer pinned tabs protected from bulk close");
check(explorerNavigation.includes('key.toLowerCase()==="t"'), "Explorer Ctrl+T shortcut present");
check(explorerNavigation.includes('key.toLowerCase()==="w"'), "Explorer Ctrl+W shortcut present");
check(explorerNavigation.includes('e.key==="Tab"'), "Explorer Ctrl+Tab shortcut present");
check(explorerNavigation.includes('e.altKey&&e.key==="ArrowLeft"') && explorerNavigation.includes('e.altKey&&e.key==="ArrowRight"'), "Explorer Alt history shortcuts present");
check(explorerNavigation.includes('key.toLowerCase()==="l"'), "Explorer Ctrl+L editable address shortcut present");
check(explorerNavigation.includes('e.shiftKey&&e.key.toLowerCase()==="t"'), "Explorer Ctrl+Shift+T reopen shortcut present");
check(explorerNavigation.includes("explorerNavigationV83") && explorerNavigation.includes("lastSession"), "Explorer tab session persists in profile state");
check(explorerNavigation.includes("closedTabs") && explorerNavigation.includes("reopenClosedTab"), "Explorer closed-tab stack present");
check(explorerNavigation.includes("duplicateTab") && explorerNavigation.includes("Duplicar separador"), "Explorer duplicate-tab action present");
check(explorerNavigation.includes("closeOtherTabs") && explorerNavigation.includes("closeTabsToRight"), "Explorer tab context close actions present");
check(explorerNavigation.includes("pathExists") && explorerNavigation.includes("O caminho não existe"), "Explorer address validation present");
check(explorerNavigation.includes('wrap.classList.contains("real-mount-mode")'), "Explorer Navigation guards real mount mode");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-navigation-v820.js?v=9.8.6"), "Explorer Navigation V9.3 module precached with V9.8.6 cache key");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-navigation-v820.css?v=8.3.0"), "Explorer Navigation V8.3 CSS precached");
const explorerMultiWindow=readFileSync(resolve(root, "src/features/explorer-multiwindow-v930.js"), "utf8");
check(index.includes("./src/features/explorer-multiwindow-v930.js?v=9.3.0"), "Explorer Multi-Window V9.3 module loaded");
check(index.includes("./styles/explorer-multiwindow-v930.css?v=9.3.0"), "Explorer Multi-Window V9.3 styles loaded");
check(explorerMultiWindow.includes('version:VERSION') && explorerMultiWindow.includes('VERSION="9.3.0"'), "Explorer Multi-Window V9.3 bridge present");
check(runtimeSource.includes("function openAppNewWindow") && runtimeSource.includes("globalThis.openAppNewWindow"), "Runtime explicit new-window API present");
check(runtimeSource.includes('document.querySelectorAll("#window-layer > .window")') && runtimeSource.includes('document.querySelector(`#window-layer > .window[data-id="'), "Runtime window lookup is scoped to real window layer");
check(index.includes("./src/core/runtime.js?v=9.9.2") && readFileSync(resolve(root, "service-worker.js"), "utf8").includes("src/core/runtime.js?v=9.9.2"), "Runtime cache-busted to V9.9.2");
check(runtimeSource.includes('makeWindow(appId,initialPath,true)') && runtimeSource.includes('explorerExplicitStart="1"') && explorerNavigation.includes('explorerExplicitStart!=="1"'), "Explorer explicit new-window path overrides tab-session restore");
check(explorerNavigation.includes("windowSessions") && explorerNavigation.includes("sessionKey") && explorerNavigation.includes("isPrimaryWindow"), "Explorer per-window tab sessions present");
check(explorerNavigation.includes("sessionEntries.length>16"), "Explorer window session state is bounded");
check(explorerMultiWindow.includes("data-new-window-v930") && explorerMultiWindow.includes("Ctrl+N"), "Explorer new-window command present");
check(explorerMultiWindow.includes("application/x-win11-explorer-window-v930") && explorerMultiWindow.includes("transferAcross"), "Explorer cross-window drag-and-drop present");
check(explorerMultiWindow.includes("explorer-task-group-lead-v930") && explorerMultiWindow.includes("showGroup"), "Explorer taskbar grouping present");
check(explorerMultiWindow.includes('wrap.classList.contains("real-mount-mode")'), "Explorer Multi-Window protects real mount mode");
check(readFileSync(resolve(root, "src/features/start-search-taskbar-v810.js"), "utf8").includes('["Nova janela",()=>globalThis.Win11ExplorerMultiWindow?.open?.("This PC")]'), "Explorer taskbar jump list new-window action present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-multiwindow-v930.js?v=9.3.0"), "Explorer Multi-Window V9.3 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-multiwindow-v930.css?v=9.3.0"), "Explorer Multi-Window V9.3 CSS precached");
const explorerHistory=readFileSync(resolve(root, "src/features/explorer-history-v940.js"), "utf8");
check(index.includes("./src/features/explorer-history-v940.js?v=9.5.0"), "Explorer History V9.4 module loaded");
check(index.includes("./styles/explorer-history-v940.css?v=9.4.0"), "Explorer History V9.4 styles loaded");
check(explorerHistory.includes('VERSION="9.4.0"') && explorerHistory.includes("Win11ExplorerHistory"), "Explorer History V9.4 bridge present");
check(explorerHistory.includes("explorerHistoryV94") && explorerHistory.includes("MAX=50"), "Explorer History profile state is bounded");
check(explorerHistory.includes('kind:"copy"') || explorerHistory.includes('kind:mode==="move"?"move":"copy"'), "Explorer History transfer actions present");
check(explorerHistory.includes('kind:"rename"') && explorerHistory.includes('kind:"delete"'), "Explorer History rename/delete actions present");
check(explorerHistory.includes('k==="z"') && explorerHistory.includes('k==="y"'), "Explorer History keyboard shortcuts present");
check(explorerHistory.includes("undoCopy") && explorerHistory.includes("redoCopy") && explorerHistory.includes("reverseMoveItems"), "Explorer History copy/move undo engines present");
check(explorerHistory.includes("undoDelete") && explorerHistory.includes("redoDelete"), "Explorer History recycle undo engine present");
check(explorerHistory.includes("reason:reversible===false"), "Explorer destructive replacement is marked non-undoable");
check(explorerPro.includes("Win11ExplorerHistory?.recordDelete") && explorerPro.includes("Win11ExplorerHistory?.recordRename"), "Explorer Pro History hooks integrated");
check(readFileSync(resolve(root, "src/features/explorer-operations-v900.js"), "utf8").includes("Win11ExplorerHistory?.recordTransfer"), "Explorer Operations History hook integrated");
check(explorerPro.includes("originalName:name") && explorerPro.includes("entry.originalName||("), "Recycle Bin preserves original file name");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-history-v940.js?v=9.5.0"), "Explorer History V9.4 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-history-v940.css?v=9.4.0"), "Explorer History V9.4 CSS precached");
const explorerRecycle=readFileSync(resolve(root, "src/features/explorer-recycle-v950.js"), "utf8");
check(index.includes("./src/features/explorer-recycle-v950.js?v=9.5.0"), "Explorer Recycle V9.5 module loaded");
check(index.includes("./styles/explorer-recycle-v950.css?v=9.5.0"), "Explorer Recycle V9.5 styles loaded");
check(explorerRecycle.includes('VERSION="9.5.0"') && explorerRecycle.includes("Win11ExplorerRecycle"), "Explorer Recycle V9.5 bridge present");
check(explorerRecycle.includes("restoreSelected") && explorerRecycle.includes("restoreAll") && explorerRecycle.includes("confirmEmpty"), "Explorer Recycle batch commands present");
check(explorerRecycle.includes("data-recycle-restore-selected") && explorerRecycle.includes("data-recycle-empty"), "Explorer Recycle toolbar present");
check(explorerRecycle.includes("originalPath") && explorerRecycle.includes("deletedAt") && explorerRecycle.includes("recycle-meta-v950"), "Explorer Recycle metadata decoration present");
check(explorerRecycle.includes('policy==="skip"') && explorerRecycle.includes('policy="keep"') && explorerPro.includes('policy==="replace"'), "Explorer Recycle conflict policies present");
check(explorerRecycle.includes("Fazer o mesmo para os conflitos seguintes") && explorerRecycle.includes("applyAll"), "Explorer Recycle apply-to-all conflict option present");
check(explorerRecycle.includes("permanentlyDeleteVirtual") && explorerRecycle.includes("Esvaziar Reciclagem"), "Explorer Recycle permanent empty flow present");
check(explorerHistory.includes("invalidateRecycleItems"), "Explorer History recycle invalidation API present");
check(explorerPro.includes("restoreRecycleItemAdvanced") && explorerPro.includes('policy==="replace"'), "Explorer Pro advanced recycle restore present");
check(explorerPro.includes("getSelectedItems") && explorerPro.includes("restoreSelectedRecycle"), "Explorer Pro selection bridge for Recycle V9.5 present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-recycle-v950.js?v=9.5.0"), "Explorer Recycle V9.5 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-recycle-v950.css?v=9.5.0"), "Explorer Recycle V9.5 CSS precached");
const explorerVersions=readFileSync(resolve(root, "src/features/explorer-versions-v960.js"), "utf8");
check(index.includes("./src/features/explorer-versions-v960.js?v=9.6.0"), "Explorer Versions V9.6 module loaded");
check(index.includes("./styles/explorer-versions-v960.css?v=9.6.0"), "Explorer Versions V9.6 styles loaded");
check(explorerVersions.includes('VERSION="9.6.0"') && explorerVersions.includes("Win11ExplorerVersions"), "Explorer Versions V9.6 bridge present");
check(explorerVersions.includes("MAX_PER_FILE=8") && explorerVersions.includes("MAX_GLOBAL=80"), "Explorer Versions count limits present");
check(explorerVersions.includes("MAX_SNAPSHOT_BYTES=131072") && explorerVersions.includes("MAX_TOTAL_BYTES=1572864"), "Explorer Versions storage limits present");
check(explorerVersions.includes('typeof value!=="string"||value.startsWith("data:")'), "Explorer Versions excludes heavy/non-text snapshots");
check(explorerVersions.includes("beforeWrite") && explorerVersions.includes("reason:\"duplicate\""), "Explorer Versions save capture and dedupe present");
check(explorerVersions.includes("moveBinding") && explorerVersions.includes("moveTree"), "Explorer Versions move/rename bindings present");
check(explorerVersions.includes("detachTree") && explorerVersions.includes("attachTree"), "Explorer Versions recycle tree bindings present");
check(explorerVersions.includes("purgeId") && explorerVersions.includes("purgePath") && explorerVersions.includes("purgeTree"), "Explorer Versions purge lifecycle present");
check(explorerVersions.includes("Antes de restaurar versão") && explorerVersions.includes("data-version-restore"), "Explorer Versions restore UI present");
check(readFileSync(resolve(root, "src/features/real-files-v640.js"), "utf8").includes("Win11ExplorerVersions?.beforeWrite"), "Notepad captures previous versions before save");
check(explorerPro.includes("Win11ExplorerVersions?.moveBinding") && explorerPro.includes("Win11ExplorerVersions?.detach"), "Explorer Pro file version lifecycle integrated");
check(explorerPro.includes("Win11ExplorerVersions?.attachTree") && explorerPro.includes("Win11ExplorerVersions?.purgeId"), "Explorer Pro recycle version lifecycle integrated");
check(readFileSync(resolve(root, "src/features/explorer-operations-v900.js"), "utf8").includes("Antes de substituir") && readFileSync(resolve(root, "src/features/explorer-operations-v900.js"), "utf8").includes("replacementVersionId"), "Explorer replace conflict snapshots previous version");
check(explorerPro.includes("data-open-versions-v960") && explorerPro.includes("Versões anteriores"), "Explorer Properties previous versions integration present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-versions-v960.js?v=9.6.0"), "Explorer Versions V9.6 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-versions-v960.css?v=9.6.0"), "Explorer Versions V9.6 CSS precached");
const explorerDetails=readFileSync(resolve(root, "src/features/explorer-details-v840.js"), "utf8");
check(index.includes("./src/features/explorer-details-v840.js?v=9.8.6"), "Explorer Details V8.4 module loaded through V9.8.6 cache key");
check(index.includes("./styles/explorer-details-v840.css?v=8.4.0"), "Explorer Details V8.4 styles loaded");
check(explorerDetails.includes('version:"8.4.0"'), "Explorer Details V8.4 bridge present");
check(explorerDetails.includes("previewMarkup") && explorerDetails.includes("explorer-detail-text-v840"), "Explorer text preview present");
check(explorerDetails.includes("data:image/") && explorerDetails.includes("explorer-detail-image-v840"), "Explorer image preview present");
check(explorerDetails.includes("folderStats") && explorerDetails.includes("thispc-folders-v840"), "Explorer folder and This PC summaries present");
check(explorerDetails.includes("pré-visualização automática desativada"), "Explorer real imported content preview privacy guard present");
check(explorerDetails.includes('wrap.classList.contains("real-mount-mode")'), "Explorer Details guards real mount mode");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-details-v840.js?v=9.8.6"), "Explorer Details V8.4 module precached with V9.8.6 cache key");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-details-v840.css?v=8.4.0"), "Explorer Details V8.4 CSS precached");
const explorerContext=readFileSync(resolve(root, "src/features/explorer-context-v850.js"), "utf8");
check(index.includes("./src/features/explorer-context-v850.js?v=9.1.0"), "Explorer Context V9.1 module loaded");
check(index.includes("./styles/explorer-context-v850.css?v=8.5.0"), "Explorer Context V8.5 styles loaded");
check(explorerContext.includes('version:"9.1.0"'), "Explorer Context V9.1 bridge present");
check(explorerContext.includes("explorer-context-quick-v850") && explorerContext.includes("Mostrar mais opções"), "Explorer modern context menu present");
check(explorerContext.includes("Partilhar") && explorerContext.includes("Mudar nome"), "Explorer quick context actions present");
check(explorerContext.includes("showClassicMore") && explorerContext.includes("Copiar caminho"), "Explorer More Options and copy path present");
check(explorerContext.includes("data-prop-tab") && explorerContext.includes("data-prop-panel"), "Explorer rich properties tabs present");
check(explorerContext.includes('wrap.classList.contains("real-mount-mode")'), "Explorer Context guards real mount mode");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-context-v850.js?v=9.1.0"), "Explorer Context V9.1 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-context-v850.css?v=8.5.0"), "Explorer Context V8.5 CSS precached");
const explorerViews=readFileSync(resolve(root, "src/features/explorer-views-v860.js"), "utf8");
check(index.includes("./src/features/explorer-views-v860.js?v=8.6.0"), "Explorer Views V8.6 module loaded");
check(index.includes("./styles/explorer-views-v860.css?v=8.6.0"), "Explorer Views V8.6 styles loaded");
check(explorerViews.includes('version:"8.6.0"'), "Explorer Views V8.6 bridge present");
check(explorerViews.includes('["large","medium","small","details"]'), "Explorer four view modes present");
check(explorerViews.includes('["none","type"]'), "Explorer grouping modes present");
check(explorerViews.includes("explorerViewsV86") && explorerViews.includes("saveState()"), "Explorer view preferences persist per profile");
check(explorerViews.includes('wrap.classList.contains("real-mount-mode")'), "Explorer grouping guards real mount mode");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-views-v860.js?v=8.6.0"), "Explorer Views V8.6 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-views-v860.css?v=8.6.0"), "Explorer Views V8.6 CSS precached");
const explorerSidebar=readFileSync(resolve(root, "src/features/explorer-sidebar-v870.js"), "utf8");
check(index.includes("./src/features/explorer-sidebar-v870.js?v=8.7.0"), "Explorer Sidebar V8.7 module loaded");
check(index.includes("./styles/explorer-sidebar-v870.css?v=9.3.0"), "Explorer Sidebar V8.7 styles loaded");
check(explorerSidebar.includes('version:"8.7.0"'), "Explorer Sidebar V8.7 bridge present");
check(explorerSidebar.includes("explorerSidebarV87") && explorerSidebar.includes("saveState()"), "Explorer sidebar preferences persist per profile");
check(explorerSidebar.includes("explorer-sidebar-resize-v870"), "Explorer sidebar resize handle present");
check(explorerSidebar.includes("toggleCompact") && explorerSidebar.includes("toggleSection"), "Explorer sidebar compact and sections present");
check(explorerSidebar.includes('e.key==="ArrowDown"') && explorerSidebar.includes('e.key==="ArrowUp"'), "Explorer sidebar keyboard navigation present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-sidebar-v870.js?v=8.7.0"), "Explorer Sidebar V8.7 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-sidebar-v870.css?v=9.3.0"), "Explorer Sidebar V8.7 CSS precached");
const explorerCommand=readFileSync(resolve(root, "src/features/explorer-command-v880.js"), "utf8");
check(index.includes("./src/features/explorer-command-v880.js?v=8.8.0"), "Explorer Command V8.8 module loaded");
check(index.includes("./styles/explorer-command-v880.css?v=8.8.0"), "Explorer Command V8.8 styles loaded");
check(explorerCommand.includes('version:"8.8.0"'), "Explorer Command V8.8 bridge present");
check(explorerCommand.includes("ResizeObserver") && explorerCommand.includes("command-compact-v880"), "Explorer adaptive command bar present");
check(explorerCommand.includes("explorer-select-checkbox-v880") && explorerCommand.includes("setCheckboxes"), "Explorer checkbox selection present");
check(explorerCommand.includes("explorer-selection-pill-v880"), "Explorer selection indicator present");
check(explorerCommand.includes('wrap.classList.contains("real-mount-mode")'), "Explorer checkbox selection guards real mount mode");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-command-v880.js?v=8.8.0"), "Explorer Command V8.8 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-command-v880.css?v=8.8.0"), "Explorer Command V8.8 CSS precached");
const explorerColumns=readFileSync(resolve(root, "src/features/explorer-columns-v890.js"), "utf8");
check(index.includes("./src/features/explorer-columns-v890.js?v=9.1.0"), "Explorer Columns V8.9 module loaded");
check(index.includes("./styles/explorer-columns-v890.css?v=8.9.0"), "Explorer Columns V8.9 styles loaded");
check(explorerColumns.includes('version:"8.9.0"'), "Explorer Columns V8.9 bridge present");
check(explorerColumns.includes('["name","type","size","date"]'), "Explorer sort fields present");
check(explorerColumns.includes('["none","type","size","date"]'), "Explorer Pro grouping fields present");
check(explorerColumns.includes("explorerColumnsV89") && explorerColumns.includes("widths"), "Explorer column state persists per profile");
check(explorerColumns.includes("explorer-column-resize-v890") && explorerColumns.includes("setColumnWidth"), "Explorer resizable columns present");
check(explorerColumns.includes('wrap.classList.contains("real-mount-mode")'), "Explorer Columns guards real mount mode");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-columns-v890.js?v=9.1.0"), "Explorer Columns V8.9 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-columns-v890.css?v=8.9.0"), "Explorer Columns V8.9 CSS precached");
const explorerOperations=readFileSync(resolve(root, "src/features/explorer-operations-v900.js"), "utf8");
check(index.includes("./src/features/explorer-operations-v900.js?v=9.7.0"), "Explorer Operations V9.0 module loaded");
check(index.includes("./styles/explorer-operations-v900.css?v=9.0.0"), "Explorer Operations V9.0 styles loaded");
check(explorerOperations.includes('version:"9.0.0"'), "Explorer Operations V9.0 bridge present");
check(explorerOperations.includes("explorer-file-operation-progress") && explorerOperations.includes("explorer-file-operation-pause"), "Explorer operation progress and pause present");
check(explorerOperations.includes("explorer-conflict-replace") && explorerOperations.includes("explorer-conflict-skip") && explorerOperations.includes("explorer-conflict-keep-both"), "Explorer conflict policies present");
check(explorerOperations.includes("data-conflict-all") && explorerOperations.includes("applyAll"), "Explorer apply-to-all conflict option present");
check(explorerOperations.includes("activeByWrap") && explorerOperations.includes('reason:"busy"'), "Explorer concurrent operation guard present");
check(explorerOperations.includes('wrap.classList.contains("real-mount-mode")'), "Explorer Operations guards real mount mode");
check(explorerPro.includes("Win11ExplorerOperations?.handlePaste"), "Explorer Pro delegates paste to V9.0");
check(explorerPro.includes('(move&&srcPath===dstPath)'), "Explorer same-folder copy is allowed while same-folder move stays blocked");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-operations-v900.js?v=9.7.0"), "Explorer Operations V9.0 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-operations-v900.css?v=9.0.0"), "Explorer Operations V9.0 CSS precached");
const explorerSidebarCss=readFileSync(resolve(root, "styles/explorer-sidebar-v870.css"), "utf8");
check(explorerSidebarCss.includes("V9.0 readability pass"), "Explorer Quick Access readability pass present");
check(explorerSidebarCss.includes("V9.3 mobile/dark Quick Access button reset") && explorerSidebarCss.includes("-webkit-appearance:none") && explorerSidebarCss.includes("background:transparent"), "Explorer Quick Access button reset present");
const explorerFilesystem=readFileSync(resolve(root, "src/features/explorer-filesystem-v910.js"), "utf8");
check(index.includes("./src/features/explorer-filesystem-v910.js?v=9.2.0"), "Explorer Filesystem V9.1 module loaded");
check(index.includes("./styles/explorer-filesystem-v910.css?v=9.1.0"), "Explorer Filesystem V9.1 styles loaded");
check(explorerFilesystem.includes('version:"9.1.0"'), "Explorer Filesystem V9.1 bridge present");
check(explorerFilesystem.includes("explorerFilesystemV91") && explorerFilesystem.includes("metadata:{}"), "Explorer Filesystem metadata state present");
check(explorerFilesystem.includes("showHidden:false") && explorerFilesystem.includes("showExtensions:true"), "Explorer hidden and extension preferences present");
check(explorerFilesystem.includes("__virtualShortcutV91") && explorerFilesystem.includes("createShortcut"), "Explorer virtual shortcuts present");
check(explorerFilesystem.includes("onTransfer") && explorerFilesystem.includes("onRename") && explorerFilesystem.includes("onDelete"), "Explorer metadata lifecycle hooks present");
check(explorerFilesystem.includes('wrap.classList.contains("real-mount-mode")'), "Explorer Filesystem guards real mount mode");
check(explorerPro.includes("Win11ExplorerFilesystem?.onTransfer") && explorerPro.includes("Win11ExplorerFilesystem?.onRename") && explorerPro.includes("Win11ExplorerFilesystem?.onDelete"), "Explorer Pro metadata hooks integrated");
check(explorerContext.includes("Win11ExplorerFilesystem?.getMetadata") && explorerContext.includes("Destino do atalho"), "Explorer Properties V9.1 metadata integration present");
const startSearchV81=readFileSync(resolve(root, "src/features/start-search-taskbar-v810.js"), "utf8");
check(startSearchV81.includes("Win11ExplorerFilesystem?.shortcutTarget") && startSearchV81.includes("meta?.hidden"), "Search V9.1 hidden and shortcut integration present");
const realFilesV64=readFileSync(resolve(root, "src/features/real-files-v640.js"), "utf8");
check(realFilesV64.includes("Win11ExplorerFilesystem?.touch"), "Notepad virtual save updates V9.1 metadata");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-filesystem-v910.js?v=9.2.0"), "Explorer Filesystem V9.1 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-filesystem-v910.css?v=9.1.0"), "Explorer Filesystem V9.1 CSS precached");
const windowManager=readFileSync(resolve(root, "src/features/window-manager-v750.js"), "utf8");
check(index.includes("./src/features/window-manager-v750.js?v=8.1.0"), "Window Manager V7.5 module loaded");
check(index.includes("./styles/window-manager-v750.css?v=8.1.0"), "Window Manager V7.5 styles loaded");
check(windowManager.includes("halves:") && windowManager.includes("thirds:") && windowManager.includes("quarters:"), "Window Manager multiple Snap layouts present");
check(windowManager.includes("showSnapAssist"), "Snap Assist present");
check(windowManager.includes("refreshSnapGroups"), "Snap Groups present");
check(windowManager.includes("edgeTarget("), "Edge drag snap detection present");
check(windowManager.includes("buildWindowPreview"), "Live window preview builder present");
check(windowManager.includes("showAltTabV750"), "Alt+Tab V7.5 present");
check(windowManager.includes("showTaskbarWindowPreview"), "Taskbar window previews present");
check(windowManager.includes("moveWindowToDesktop"), "Move window between virtual desktops present");
check(windowManager.includes("renameDesktop"), "Virtual desktop rename present");
check(windowManager.includes("closeDesktopV750"), "Virtual desktop close present");
check(windowManager.includes('e.key.toLowerCase()==="d"'), "Win+Ctrl+D shortcut present");
check(windowManager.includes('e.key==="F4"'), "Win+Ctrl+F4 shortcut present");
check(windowManager.includes('ensureFolder("C:/Desktop")'), "Desktop virtual files integration present");
check(windowManager.includes("desktopIconPositions"), "Desktop icon positions persist");
check(windowManager.includes("Novo documento de texto"), "Desktop context menu V2 present");
check(windowManager.includes("iframe,video,audio,canvas"), "Window previews strip active media embeds");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("window-manager-v750.js?v=8.1.0"), "Window Manager V7.5 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("window-manager-v750.css?v=8.1.0"), "Window Manager V7.5 CSS precached");
const taskbarWindowV97=readFileSync(resolve(root, "src/features/taskbar-window-v970.js"), "utf8");
check(index.includes("./src/features/taskbar-window-v970.js?v=9.7.0"), "Taskbar Window V9.7 module loaded");
check(index.includes("./styles/taskbar-window-v970.css?v=9.7.0"), "Taskbar Window V9.7 styles loaded");
check(taskbarWindowV97.includes('VERSION="9.7.0"') && taskbarWindowV97.includes("Win11TaskbarWindowPro"), "Taskbar Window V9.7 bridge present");
check(taskbarWindowV97.includes("taskbar-group-lead-v970") && taskbarWindowV97.includes("taskbar-group-hidden-v970"), "Taskbar general app grouping present");
check(taskbarWindowV97.includes("data-min-all") && taskbarWindowV97.includes("data-restore-all") && taskbarWindowV97.includes("data-close-all"), "Taskbar group actions present");
check(taskbarWindowV97.includes("safePreview") && taskbarWindowV97.includes("taskbar-group-preview-clone-v970"), "Taskbar group live previews present");
check(taskbarWindowV97.includes("windowManagerV97") && taskbarWindowV97.includes("placements"), "Window placement profile state present");
check(taskbarWindowV97.includes("savePlacement") && taskbarWindowV97.includes("applyPlacement"), "Window placement persistence present");
check(taskbarWindowV97.includes("MAX")===false && taskbarWindowV97.includes("entries.length>60"), "Window placement state bounded");
check(taskbarWindowV97.includes("explorer-operation-progress-v970") && taskbarWindowV97.includes("task-progress-v970"), "Taskbar Explorer progress integration present");
check(readFileSync(resolve(root, "src/features/explorer-operations-v900.js"), "utf8").includes("explorer-operation-progress-v970"), "Explorer Operations emits taskbar progress events");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("taskbar-window-v970.js?v=9.7.0"), "Taskbar Window V9.7 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("taskbar-window-v970.css?v=9.7.0"), "Taskbar Window V9.7 CSS precached");
const systemBusV981=readFileSync(resolve(root, "src/features/system-bus-v981.js"), "utf8");
const settingsCoreV981=readFileSync(resolve(root, "src/features/settings-core-v981.js"), "utf8");
const settingsPersonalizationV982=readFileSync(resolve(root, "src/features/settings-personalization-v982.js"), "utf8");
const taskbarSystemV983=readFileSync(resolve(root, "src/features/taskbar-system-v983.js"), "utf8");
const settingsExplorerV984=readFileSync(resolve(root, "src/features/settings-explorer-v984.js"), "utf8");
const resourceMonitorV9841=readFileSync(resolve(root, "styles/resource-monitor-v9841.css"), "utf8");
const appsDefaultsV985=readFileSync(resolve(root, "src/features/apps-defaults-v985.js"), "utf8");
const appsDefaultsCssV985=readFileSync(resolve(root, "styles/apps-defaults-v985.css"), "utf8");
const storageV986=readFileSync(resolve(root, "src/features/storage-v986.js"), "utf8");
const storageCssV986=readFileSync(resolve(root, "styles/storage-v986.css"), "utf8");
const systemHealthV987=readFileSync(resolve(root, "src/features/system-health-v987.js"), "utf8");
const systemHealthCssV987=readFileSync(resolve(root, "styles/system-health-v987.css"), "utf8");
const shellIntentsV990=readFileSync(resolve(root, "src/features/shell-intents-v990.js"), "utf8");
const shellIntegrationV990=readFileSync(resolve(root, "src/apps/shell-integration.js"), "utf8");
const powerShellV990=readFileSync(resolve(root, "src/apps/powershell.js"), "utf8");
const appSessionsV991=readFileSync(resolve(root, "src/features/app-sessions-v991.js"), "utf8");
const appSessionsCssV991=readFileSync(resolve(root, "styles/app-sessions-v991.css"), "utf8");
const sessionRestoreV992=readFileSync(resolve(root, "src/features/session-restore-v992.js"), "utf8");
const sessionRestoreCssV992=readFileSync(resolve(root, "styles/session-restore-v992.css"), "utf8");
check(index.includes("./src/features/system-bus-v981.js?v=9.8.1"), "System Bus V9.8.1 module loaded");
check(index.includes("./src/features/settings-core-v981.js?v=9.8.7"), "Settings Core V9.8.1 module loaded through V9.8.7 cache key");
check(index.includes("./src/features/settings-personalization-v982.js?v=9.8.3"), "Settings Personalization V9.8.2 module loaded through V9.8.3 cache key");
check(index.includes("./styles/settings-personalization-v982.css?v=9.8.2"), "Settings Personalization V9.8.2 styles loaded");
check(index.includes("./src/features/taskbar-system-v983.js?v=9.8.3"), "Taskbar System V9.8.3 module loaded");
check(index.includes("./styles/taskbar-system-v983.css?v=9.8.3"), "Taskbar System V9.8.3 styles loaded");
check(index.includes("./src/features/settings-explorer-v984.js?v=9.8.4"), "Explorer Settings V9.8.4 module loaded");
check(index.includes("./styles/settings-explorer-v984.css?v=9.8.4"), "Explorer Settings V9.8.4 styles loaded");
check(index.includes("./styles/resource-monitor-v9841.css?v=9.8.4-hotfix.1"), "Resource Monitor V9.8.4.1 contrast hotfix loaded");
check(systemBusV981.includes('VERSION="9.8.1"') && systemBusV981.includes("Win11SystemBus"), "System Bus V9.8.1 bridge present");
check(systemBusV981.includes("HISTORY_LIMIT=80") && systemBusV981.includes("ERROR_LIMIT=20"), "System Bus histories bounded");
check(systemBusV981.includes("Invalid system bus topic") && systemBusV981.includes("payload must be serializable"), "System Bus validates topics and payloads");
check(settingsCoreV981.includes('VERSION="9.8.1"') && settingsCoreV981.includes("Win11SettingsStore"), "Settings Core V9.8.1 bridge present");
check(settingsCoreV981.includes("SCHEMA_VERSION=1") && settingsCoreV981.includes("MAX_IMPORT_BYTES=65536"), "Settings schema and import budget present");
check(settingsCoreV981.includes("__proto__") && settingsCoreV981.includes("prototype") && settingsCoreV981.includes("constructor"), "Settings prototype pollution guard present");
check(settingsCoreV981.includes("strictData") && settingsCoreV981.includes("validateValue") && settingsCoreV981.includes("commit(changes"), "Settings validation and atomic commit present");
check(settingsCoreV981.includes("fromLegacy") && settingsCoreV981.includes("settingsV98"), "Settings legacy migration present");
check(settingsCoreV981.includes("fnv1a32") && settingsCoreV981.includes("integrity check failed"), "Settings import integrity verification present");
check(settingsCoreV981.includes('bus.emit("settings:changed"') && settingsCoreV981.includes('"settings:committed"'), "Settings change events present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("system-bus-v981.js?v=9.8.1"), "System Bus V9.8.1 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("settings-core-v981.js?v=9.8.7"), "Settings Core V9.8.1 module precached with V9.8.7 cache key");
check(settingsPersonalizationV982.includes('VERSION="9.8.2"') && settingsPersonalizationV982.includes("Win11Personalization"), "Settings Personalization V9.8.2 bridge present");
check(settingsPersonalizationV982.includes("Win11SettingsStore") && settingsPersonalizationV982.includes("Win11SystemBus"), "Personalization consumes Settings Core and System Bus");
check(settingsPersonalizationV982.includes("settings-ui-v982") && !settingsPersonalizationV982.includes("saveState()"), "Personalization UI persists only through Settings Store");
check(settingsPersonalizationV982.includes("accessibility.textScale") && settingsPersonalizationV982.includes("taskbar.groupWindows"), "Personalization scale and Taskbar controls present");
check(taskbarWindowV97.includes("taskbarPrefs()") && taskbarWindowV97.includes("showBadges") && taskbarWindowV97.includes("showProgress") && taskbarWindowV97.includes("prefs.previews"), "Taskbar consumes V9.8.2 preferences");
check(readFileSync(resolve(root, "src/features/explorer-multiwindow-v930.js"), "utf8").includes('prefs.groupWindows!=="never"'), "Explorer grouping consumes V9.8.2 Taskbar preference");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("settings-personalization-v982.js?v=9.8.3"), "Settings Personalization V9.8.2 module precached with V9.8.3 cache key");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("settings-personalization-v982.css?v=9.8.2"), "Settings Personalization V9.8.2 CSS precached");
check(taskbarSystemV983.includes('VERSION="9.8.3"') && taskbarSystemV983.includes("Win11TaskbarSystem"), "Taskbar System V9.8.3 bridge present");
check(taskbarSystemV983.includes("taskbar-auto-hide") && taskbarSystemV983.includes("taskbar-show-desktop") && taskbarSystemV983.includes("taskbar-clock-seconds"), "Taskbar System V9.8.3 capabilities registered");
check(taskbarSystemV983.includes("taskbar-reveal-v983") && taskbarSystemV983.includes("toggleDesktop") && taskbarSystemV983.includes("desktopShownIndex"), "Taskbar auto-hide reveal and desktop-scoped Show Desktop engines present");
check(settingsPersonalizationV982.includes("taskbar.autoHide") && settingsPersonalizationV982.includes("taskbar.showDesktop") && settingsPersonalizationV982.includes("taskbar.showSeconds"), "Taskbar V9.8.3 Settings controls present");
check(readFileSync(resolve(root, "src/core/runtime.js"), "utf8").includes("taskbar.showSeconds") && readFileSync(resolve(root, "src/core/runtime.js"), "utf8").includes("second:'2-digit'"), "Taskbar clock consumes Settings showSeconds");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("taskbar-system-v983.js?v=9.8.3"), "Taskbar System V9.8.3 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("taskbar-system-v983.css?v=9.8.3"), "Taskbar System V9.8.3 CSS precached");
check(settingsExplorerV984.includes('VERSION="9.8.4"') && settingsExplorerV984.includes("Win11ExplorerSettings"), "Explorer Settings V9.8.4 bridge present");
check(settingsExplorerV984.includes("explorer.showHidden") && settingsExplorerV984.includes("explorer.showExtensions") && settingsExplorerV984.includes("explorer.compactView") && settingsExplorerV984.includes("explorer.openTo") && settingsExplorerV984.includes("explorer.confirmDelete"), "Explorer Settings V9.8.4 schema consumers present");
check(settingsExplorerV984.includes("settings:explorer:changed") && settingsExplorerV984.includes("Win11ExplorerFilesystem?.refreshAll"), "Explorer Settings V9.8.4 System Bus refresh present");
check(settingsExplorerV984.includes("quickAccessHome") && settingsExplorerV984.includes("C:/Documents") && settingsExplorerV984.includes('"This PC"'), "Explorer openTo Home and This PC resolver present");
check(settingsExplorerV984.includes("explorer-compact-v984") && settingsExplorerV984.includes("applyWrap"), "Explorer Compact View integration present");
check(readFileSync(resolve(root, "src/apps/settings-v5.js"), "utf8").includes('["explorer","📁 Explorador de Ficheiros"]'), "Explorer Settings navigation entry present");
check(readFileSync(resolve(root, "src/apps/v5-runtime.js"), "utf8").includes("explorerInitialPathV984") && readFileSync(resolve(root, "src/apps/v5-runtime.js"), "utf8").includes('explorer.openTo'), "Explorer initial path consumes Settings Store");
check(readFileSync(resolve(root, "src/features/explorer-filesystem-v910.js"), "utf8").includes("writeExplorerSetting") && readFileSync(resolve(root, "src/features/explorer-filesystem-v910.js"), "utf8").includes("explorer-filesystem-v910-compat"), "Explorer Filesystem V9.1 writes hidden/extensions through Settings Store");
check(readFileSync(resolve(root, "src/features/explorer-pro-v740.js"), "utf8").includes('explorer.confirmDelete') && readFileSync(resolve(root, "src/features/explorer-pro-v740.js"), "utf8").includes("deleteSelection(permanent=false,confirmed=false)"), "Explorer delete confirmation consumes Settings Store");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("settings-explorer-v984.js?v=9.8.4"), "Explorer Settings V9.8.4 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("settings-explorer-v984.css?v=9.8.4"), "Explorer Settings V9.8.4 CSS precached");
check(resourceMonitorV9841.includes("#app.theme-dark .resmon-body") && resourceMonitorV9841.includes("#app.theme-dark .resmon-tabs button.active"), "Resource Monitor dark theme contrast rules present");
check(resourceMonitorV9841.includes("#app.theme-dark .resmon .admin-table") && resourceMonitorV9841.includes(".resmon-body h2"), "Resource Monitor table and heading contrast rules present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("resource-monitor-v9841.css?v=9.8.4-hotfix.1"), "Resource Monitor V9.8.4.1 CSS precached");
check(index.includes("./src/features/apps-defaults-v985.js?v=9.8.5"), "Apps & Defaults V9.8.5 module loaded");
check(index.includes("./styles/apps-defaults-v985.css?v=9.8.5"), "Apps & Defaults V9.8.5 styles loaded");
check(appsDefaultsV985.includes('VERSION="9.8.5"') && appsDefaultsV985.includes("Win11AppRegistry") && appsDefaultsV985.includes("Win11DefaultApps"), "Apps & Defaults V9.8.5 public bridges present");
check(appsDefaultsV985.includes("Win11FileAssociations") && appsDefaultsV985.includes("Win11ProtocolRegistry"), "File Association and Protocol Registry bridges present");
check(settingsCoreV981.includes("txtApp") && settingsCoreV981.includes("htmlApp") && settingsCoreV981.includes("pngApp") && settingsCoreV981.includes("jpgApp") && settingsCoreV981.includes("mp3App") && settingsCoreV981.includes("mp4App") && settingsCoreV981.includes("pdfApp"), "Settings Core exact file association schema present");
check(settingsCoreV981.includes("httpApp") && settingsCoreV981.includes("httpsApp") && settingsCoreV981.includes("protocolAssociations"), "Settings Core protocol association schema and legacy bridge present");
check(appsDefaultsV985.includes("candidatesForExtension") && appsDefaultsV985.includes("setForFile") && appsDefaultsV985.includes("setForProtocol"), "Apps registry validation and setters present");
check(appsDefaultsV985.includes("sanitizeHtmlDocument") && appsDefaultsV985.includes("Content-Security-Policy") && appsDefaultsV985.includes('setAttribute("sandbox","")'), "Safe local HTML/PDF Edge preview protections present");
check(appsDefaultsV985.includes("settings:apps:changed") && appsDefaultsV985.includes("syncLegacySnapshot"), "Apps Settings events and compatibility synchronization present");
check(readFileSync(resolve(root, "src/features/desktop-integration-v700.js"), "utf8").includes("Win11DefaultApps?.forFile") && readFileSync(resolve(root, "src/features/desktop-integration-v700.js"), "utf8").includes("Win11AppRegistry?.candidatesForFile"), "Desktop Integration delegates defaults to V9.8.5 registry");
check(readFileSync(resolve(root, "src/features/edge-advanced-v730.js"), "utf8").includes("wrap.__edgeV730=Object.freeze") && readFileSync(resolve(root, "src/features/edge-advanced-v730.js"), "utf8").includes("navigate:(url,options={})") && readFileSync(resolve(root, "src/features/edge-advanced-v730.js"), "utf8").includes("newTab:(url,options={})"), "Edge exposes bounded navigation/new-tab bridge");
check(shellIntegrationV990.includes("Win11Shell?.canOpen") && shellIntegrationV990.includes('source:"run"') && shellIntegrationV990.includes('source:"terminal-start"'), "Run and Terminal consume Windows Shell intent router");
check(appsDefaultsCssV985.includes(".apps-registry-grid-v985") && appsDefaultsCssV985.includes(".edge-local-document-v985"), "Apps Settings and Edge local document styles present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("apps-defaults-v985.js?v=9.8.5"), "Apps & Defaults V9.8.5 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("apps-defaults-v985.css?v=9.8.5"), "Apps & Defaults V9.8.5 CSS precached");
check(index.includes("./src/features/desktop-integration-v700.js?v=9.8.5") && index.includes("./src/features/edge-advanced-v730.js?v=9.8.5") && index.includes("./src/apps/shell-integration.js?v=9.9.0"), "V9.8.5 consumers remain valid and shell integration advances to V9.9.0");
check(index.includes("./src/features/storage-v986.js?v=9.8.6"), "Storage V9.8.6 module loaded");
check(index.includes("./styles/storage-v986.css?v=9.8.6"), "Storage V9.8.6 styles loaded");
check(storageV986.includes('VERSION="9.8.6"') && storageV986.includes("Win11Storage"), "Storage V9.8.6 bridge present");
check(storageV986.includes("CAPACITY_BYTES=128*1024*1024*1024") && storageV986.includes("CATEGORY_META"), "Storage virtual capacity and categories present");
check(storageV986.includes("C:/Temp") && storageV986.includes("C:/Windows/Temp") && storageV986.includes("C:/AppData/Local/Temp"), "Storage temporary roots present");
check(storageV986.includes("cleanupTemporary") && storageV986.includes("runStorageSense"), "Storage cleanup and Storage Sense engines present");
check(storageV986.includes("RealContentBridge?.cleanupVirtualValue") && storageV986.includes("Win11ExplorerRecycle?.empty"), "Storage cleanup respects real-content and Recycle engines");
check(storageV986.includes('bus.emit("storage:changed"') && storageV986.includes('bus.on("settings:storage:changed"'), "Storage System Bus integration present");
check(storageV986.includes('page==="storage"') && storageV986.includes("data-storage-clean-v986"), "Storage Settings page and manual cleanup present");
check(readFileSync(resolve(root, "src/apps/settings-v5.js"), "utf8").includes('["storage","💽 Armazenamento"]'), "Storage Settings navigation entry present");
check(readFileSync(resolve(root, "src/apps/explorer-v5.js"), "utf8").includes("Win11Storage?.snapshot") && readFileSync(resolve(root, "src/features/explorer-details-v840.js"), "utf8").includes("Win11Storage?.snapshot"), "Explorer consumes Storage V9.8.6 snapshot");
check(readFileSync(resolve(root, "src/features/notifications-background-v770.js"), "utf8").includes("Win11Storage.runStorageSense"), "Background Storage Sense consumes Storage V9.8.6");
check(storageCssV986.includes(".storage-category-v986") && storageCssV986.includes("#app.theme-dark .storage-hero-v986"), "Storage V9.8.6 responsive light/dark styles present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("storage-v986.js?v=9.8.6"), "Storage V9.8.6 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("storage-v986.css?v=9.8.6"), "Storage V9.8.6 CSS precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes('win11-simulator-v9.9.3'), "PWA cache bumped to V9.9.3");
check(index.includes("./src/apps/settings-v5.js?v=9.8.7") && index.includes("./src/apps/explorer-v5.js?v=9.8.6") && index.includes("./src/features/explorer-details-v840.js?v=9.8.6") && index.includes("./src/features/notifications-background-v770.js?v=9.8.6"), "V9.8.6 consumers remain cache-busted and Settings advances to V9.8.7");
check(index.includes("./src/features/system-health-v987.js?v=9.8.7"), "System Health V9.8.7 module loaded");
check(index.includes("./styles/system-health-v987.css?v=9.8.7"), "System Health V9.8.7 styles loaded");
check(systemHealthV987.includes('VERSION="9.8.7"') && systemHealthV987.includes("Win11SystemHealth"), "System Health V9.8.7 bridge present");
check(systemHealthV987.includes("diagnose") && systemHealthV987.includes("reconcile") && systemHealthV987.includes("exportDiagnostics"), "System Health diagnostics, reconcile and export APIs present");
check(systemHealthV987.includes("HISTORY_LIMIT=20") && systemHealthV987.includes("bounded-health-history"), "System Health history is bounded");
check(systemHealthV987.includes("legacyBridgeIssues") && systemHealthV987.includes("settings-legacy-reconcile"), "System Health bridge reconciliation present");
check(settingsCoreV981.includes("function reconcileLegacy") && settingsCoreV981.includes('"settings:reconciled"'), "Settings Core exposes legacy reconciliation");
check(settingsCoreV981.includes("function legacyDigest") && settingsCoreV981.includes("if(changed)saveState()"), "Settings Core legacy reconciliation writes only on change");
check(settingsCoreV981.includes('htmlApp:[".html",".htm"]') && settingsCoreV981.includes('jpgApp:[".jpg",".jpeg"]'), "Settings Core exact alias bridges cover HTM and JPEG");
check(!settingsCoreV981.includes('defaultImage")for(const ext of [".jpeg"'), "JPEG removed from generic image fallback bridge");
check(systemHealthV987.includes("Win11TaskbarWindowPro?.repairTaskButtons") && systemHealthV987.includes("Win11SearchV920?.invalidate"), "System Health safe repair reuses audited consumers");
check(systemHealthV987.includes('kind:"win11-simulator-system-health"') && !systemHealthV987.includes("activeUserId"), "System Health export omits account identifiers");
check(systemHealthV987.includes('page==="health"') && systemHealthV987.includes("data-health-reconcile-v987"), "System Health Settings page and reconcile control present");
check(readFileSync(resolve(root, "src/apps/settings-v5.js"), "utf8").includes('["health","🩺 Integridade do sistema"]'), "System Health Settings navigation entry present");
check(systemHealthCssV987.includes(".health-hero-v987") && systemHealthCssV987.includes("#app.theme-dark .health-hero-v987"), "System Health responsive light/dark styles present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("system-health-v987.js?v=9.8.7"), "System Health V9.8.7 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("system-health-v987.css?v=9.8.7"), "System Health V9.8.7 CSS precached");
check(index.includes("./src/features/shell-intents-v990.js?v=9.9.0"), "Shell Intents V9.9.0 module loaded");
check(shellIntentsV990.includes('VERSION="9.9.0"') && shellIntentsV990.includes("Win11Shell") && shellIntentsV990.includes("Win11AppLifecycle"), "Shell Intents V9.9.0 public bridges present");
check(shellIntentsV990.includes("SETTINGS_ROUTES") && shellIntentsV990.includes("SHELL_FOLDERS"), "Shell Intents V9.9.0 deep-link allowlists present");
check(shellIntentsV990.includes("ms-settings:") && shellIntentsV990.includes("shell:") && shellIntentsV990.includes("app:"), "Shell Intents V9.9.0 supported schemes present");
check(shellIntentsV990.includes("normalizeVirtualPath") && shellIntentsV990.includes("Segmentos relativos não são permitidos"), "Virtual path intents reject relative traversal");
check(shellIntentsV990.includes("INTENT_HISTORY_LIMIT=60") && shellIntentsV990.includes("LIFECYCLE_HISTORY_LIMIT=100"), "Shell and lifecycle histories are bounded");
check(shellIntentsV990.includes('bus.emit("shell:intent-') && shellIntentsV990.includes('bus.emit("app:"+type'), "Shell and lifecycle events use System Bus");
check(shellIntentsV990.includes("MutationObserver") && shellIntentsV990.includes('attributeFilter:["class","data-desktop"]'), "App lifecycle observes window state transitions");
check(shellIntentsV990.includes("syncSettingsWindow") && shellIntentsV990.includes("state.settingsPage=page"), "ms-settings deep links update existing Settings window");
check(shellIntentsV990.includes("openFileIntent") && shellIntentsV990.includes("Win11DefaultApps.forFile"), "Virtual file intents use default-app registry");
check(shellIntentsV990.includes("Win11ProtocolRegistry.open") && shellIntentsV990.includes('["http:","https:"]'), "URL intents remain restricted to HTTP/HTTPS");
check(shellIntegrationV990.includes('source:"run"') && shellIntegrationV990.includes('source:"terminal-start"'), "Run and Terminal source-tag shell intents");
check(powerShellV990.includes("Win11Shell?.canOpen") && powerShellV990.includes('source:"powershell-start-process"'), "PowerShell Start-Process consumes shell intent router");
check(index.includes("./src/apps/powershell.js?v=9.9.0") && index.includes("./src/apps/shell-integration.js?v=9.9.0"), "V9.9.0 shell consumers cache-busted");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("shell-intents-v990.js?v=9.9.0"), "Shell Intents V9.9.0 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("powershell.js?v=9.9.0") && readFileSync(resolve(root, "service-worker.js"), "utf8").includes("shell-integration.js?v=9.9.0"), "V9.9.0 shell consumers precached");
check(index.includes("./src/features/app-sessions-v991.js?v=9.9.1"), "App Sessions V9.9.1 module loaded");
check(index.includes("./styles/app-sessions-v991.css?v=9.9.1"), "App Sessions V9.9.1 styles loaded");
check(appSessionsV991.includes('VERSION="9.9.1"') && appSessionsV991.includes("Win11AppSessions"), "App Sessions V9.9.1 bridge present");
check(appSessionsV991.includes("SINGLE=new Set") && appSessionsV991.includes('"settings"') && appSessionsV991.includes('"taskmanager"') && appSessionsV991.includes('"security"'), "Single-instance policy set present");
check(appSessionsV991.includes('mode==="single"') && appSessionsV991.includes("allowMultiple"), "Single/multi instance policy resolver present");
check(appSessionsV991.includes("function activate(") && appSessionsV991.includes("function openNew(") && appSessionsV991.includes("function activateWindow("), "App session activation APIs present");
check(appSessionsV991.includes("function closeApp(") && appSessionsV991.includes("function snapshot(") && appSessionsV991.includes("function diagnostics("), "App session close, snapshot and diagnostics APIs present");
check(appSessionsV991.includes("HISTORY_LIMIT=80") && appSessionsV991.includes("bounded-session-history"), "App session history bounded");
check(appSessionsV991.includes("openAppNewWindowV991") && appSessionsV991.includes("globalThis.openAppNewWindow=openAppNewWindowV991"), "openAppNewWindow is policy-aware");
check(appSessionsV991.includes('page==="apps"') && appSessionsV991.includes("data-app-sessions-v991"), "App Sessions Settings integration present");
check(appSessionsV991.includes('bus.emit("app-session:"') && appSessionsV991.includes('"app:launched"') && appSessionsV991.includes('"app:closed"'), "App Sessions System Bus integration present");
check(appSessionsCssV991.includes(".app-session-row-v991") && appSessionsCssV991.includes("#app.theme-dark .app-session-row-v991"), "App Sessions responsive light/dark styles present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("app-sessions-v991.js?v=9.9.1"), "App Sessions V9.9.1 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("app-sessions-v991.css?v=9.9.1"), "App Sessions V9.9.1 CSS precached");
check(index.includes("./src/features/session-restore-v992.js?v=9.9.3"), "Session Restore core loaded through V9.9.3 cache key");
check(index.includes("./styles/session-restore-v992.css?v=9.9.2"), "Session Restore V9.9.2 styles loaded");
check(sessionRestoreV992.includes('VERSION="9.9.3"') && sessionRestoreV992.includes("Win11SessionRestore"), "Session Restore V9.9.3 bridge present");
check(sessionRestoreV992.includes("MAX_WINDOWS=24") && sessionRestoreV992.includes("MAX_PER_APP_DESKTOP=4") && sessionRestoreV992.includes("MAX_AGE_MS=30*24*60*60*1000"), "Session Restore bounds and age limit present");
check(sessionRestoreV992.includes("SAFE_EXPLORER_PATHS") && sessionRestoreV992.includes('"C:/Documents"') && sessionRestoreV992.includes('"Recycle Bin"'), "Session Restore safe Explorer path allowlist present");
check(sessionRestoreV992.includes("function capture(") && sessionRestoreV992.includes("function restore(") && sessionRestoreV992.includes("function setEnabled("), "Session Restore capture/restore/settings APIs present");
check(sessionRestoreV992.includes("win11-session-saving") && sessionRestoreV992.includes("win11-session-start"), "Session Restore account lifecycle hooks present");
check(sessions.includes("function emitSessionSaving") && sessions.includes("function emitSessionStart"), "Local Accounts emits neutral session lifecycle hooks");
check(sessions.includes('emitSessionSaving("sign-out")') && sessions.includes('emitSessionSaving("power")') && sessions.includes('emitSessionStart("boot-resume")'), "Local Accounts session save/start integration present");
check(!sessionRestoreV992.includes("activeUserId") && !sessionRestoreV992.includes("notepadText") && !sessionRestoreV992.includes("edge-real-address"), "Session snapshot omits account/content/URL identifiers");
check(sessionRestoreV992.includes('page==="accounts"') && sessionRestoreV992.includes("data-session-restore-v992"), "Session Restore Accounts Settings UI present");
check(sessionRestoreV992.includes("session-restore:captured") && sessionRestoreV992.includes("session-restore:restored") && sessionRestoreV992.includes("session-restore:enabled"), "Session Restore System Bus events present");
check(sessionRestoreCssV992.includes(".session-restore-v992") && sessionRestoreCssV992.includes("#app.theme-dark .session-restore-head-v992"), "Session Restore responsive light/dark styles present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("session-restore-v992.js?v=9.9.3"), "Session Restore core precached with V9.9.3 cache key");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("session-restore-v992.css?v=9.9.2"), "Session Restore V9.9.2 CSS precached");
check(sessionRestoreV992.includes("SCHEMA_VERSION=2") && sessionRestoreV992.includes("schemaVersion:SCHEMA_VERSION"), "Session Restore V9.9.3 schema 2 exposed");
check(sessionRestoreV992.includes("function safeRectOf") && sessionRestoreV992.includes("function sanitizeRect") && sessionRestoreV992.includes("function applyRect"), "Session Restore V9.9.3 safe geometry pipeline present");
check(sessionRestoreV992.includes("viewportW") && sessionRestoreV992.includes("viewportH") && sessionRestoreV992.includes("viewportW/Math.max(1,rect.viewportW)"), "Session Restore geometry adapts to viewport changes");
check(sessionRestoreV992.includes("function safeSnapOf") && sessionRestoreV992.includes("function sanitizeSnap") && sessionRestoreV992.includes("Win11WindowManager?.applyLayoutSlot"), "Session Restore V9.9.3 Snap restore reuses Window Manager");
check(sessionRestoreV992.includes("DUPLICATE_RESTORE_MS=2200") && sessionRestoreV992.includes('reason:"duplicate"') && sessionRestoreV992.includes('session-restore:skipped'), "Session Restore duplicate-start guard and skip event present");
check(sessionRestoreV992.includes("restoredWindows") && sessionRestoreV992.includes("focusWindow(item.win)") && sessionRestoreV992.includes("focus-order-restore"), "Session Restore active-desktop focus order restoration present");
check(sessionRestoreV992.includes('"session-snapshot-schema-2"') && sessionRestoreV992.includes('"window-geometry-session-restore"') && sessionRestoreV992.includes('"snap-session-restore"'), "Session Restore V9.9.3 capability markers present");
check(sessionRestoreV992.includes("step:41"), "Session Restore V9.9.3 RealFunctions step 41 present");







const settingsV5Compat=readFileSync(resolve(root, "src/apps/settings-v5.js"), "utf8");
const backupRecoveryV982=readFileSync(resolve(root, "src/apps/backup-recovery.js"), "utf8");
check(settingsV5Compat.includes('Win11SettingsStore.set("accessibility.textScale"') && settingsV5Compat.includes("settings-v5-compat"), "Accessibility V5 writes through Settings Store");
check(settingsV5Compat.includes('Win11SettingsStore.validate(path,next)'), "Accessibility legacy toggles validate through Settings Store");
check(backupRecoveryV982.includes("settingsConfig") && backupRecoveryV982.includes("Win11SettingsStore?.exportConfig") && backupRecoveryV982.includes("Win11SettingsStore.importConfig"), "Backup V9.8.2 stores and restores Settings export");
check(backupRecoveryV982.includes("backup-legacy-restore") && backupRecoveryV982.includes("restauração foi cancelada"), "Backup V9.8.2 legacy migration and invalid-config abort present");
const deviceCenter=readFileSync(resolve(root, "src/features/real-device-integration-v760.js"), "utf8");
check(index.includes("./src/features/real-device-integration-v760.js?v=8.1.0"), "Real Device Integration V7.6 module loaded");
check(index.includes("./styles/real-device-integration-v760.css?v=8.1.0"), "Real Device Integration V7.6 styles loaded");
check(deviceCenter.includes("collectSnapshot"), "Device Center snapshot collector present");
check(deviceCenter.includes("permissionSnapshot"), "Device permission center present");
check(deviceCenter.includes("navigator.permissions.query"), "Permissions API integration present");
check(deviceCenter.includes("navigator.storage.estimate"), "Storage diagnostics present");
check(deviceCenter.includes("navigator.getBattery"), "Battery monitoring fallback present");
check(deviceCenter.includes("navigator.connection") || deviceCenter.includes("mozConnection"), "Network Information integration present");
check(deviceCenter.includes("navigator.mediaDevices.enumerateDevices"), "Media device summary present");
check(deviceCenter.includes("device-center-btn"), "Device Center taskbar integration present");
check(deviceCenter.includes("data-device-center-v760"), "Device Center Quick Settings tile present");
check(deviceCenter.includes("data-device-center-settings-v760"), "Device Center Settings integration present");
check(deviceCenter.includes("data-device-center-info-v760"), "Device Center System Information integration present");
check(deviceCenter.includes("requestPermission"), "Explicit permission request actions present");
check(deviceCenter.includes("Nenhuma permissão é pedida automaticamente"), "No automatic permission prompt disclosure present");
check(deviceCenter.includes("sanitizedReport"), "Sanitized diagnostic report present");
check(!deviceCenter.includes("coords.latitude") && !deviceCenter.includes("coords.longitude"), "Diagnostic report does not collect location coordinates");
check(!deviceCenter.includes("navigator.clipboard.readText()"), "Diagnostic report does not read clipboard contents");
check(deviceCenter.includes("devicechange") && deviceCenter.includes("online") && deviceCenter.includes("offline"), "Live device event monitoring present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("real-device-integration-v760.js?v=8.1.0"), "Real Device Integration V7.6 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("real-device-integration-v760.css?v=8.1.0"), "Real Device Integration V7.6 CSS precached");
const notificationBg=readFileSync(resolve(root, "src/features/notifications-background-v770.js"), "utf8");
check(index.includes("./src/features/notifications-background-v770.js?v=9.8.6"), "Notifications Background V7.7 module loaded through V9.8.6 cache key");
check(index.includes("./styles/notifications-background-v770.css?v=8.1.0"), "Notifications Background V7.7 styles loaded");
check(notificationBg.includes("Win11NotificationCenter"), "Notification Center V7.7 bridge present");
check(notificationBg.includes("notification-groups"), "Grouped notification capability registered");
check(notificationBg.includes("snoozeNotification"), "Notification snooze present");
check(notificationBg.includes("runNotificationAction"), "Notification actions present");
check(notificationBg.includes("notification-badge-v77"), "Unread notification badge present");
check(notificationBg.includes("focusMode") && notificationBg.includes("alarms") && notificationBg.includes("priority"), "Do Not Disturb modes present");
check(notificationBg.includes("quietUntil"), "Temporary Do Not Disturb present");
check(notificationBg.includes("appRules"), "Per-source notification rules present");
check(notificationBg.includes("data-focus-assist-v77"), "Quick Settings focus tile present");
check(notificationBg.includes("Win11BackgroundEngine"), "Background engine bridge present");
check(notificationBg.includes("schedulerTick"), "Scheduled background tick present");
check(notificationBg.includes("nextRun") && notificationBg.includes("lastResult") && notificationBg.includes("runCount"), "Scheduled task runtime metadata present");
check(notificationBg.includes("storage-sense") && notificationBg.includes("update-check") && notificationBg.includes("maintenance"), "Built-in background actions present");
check(notificationBg.includes("changeService"), "Service runtime controls present");
check(notificationBg.includes("Service Control Manager"), "Service Event Log integration present");
check(notificationBg.includes("backgroundActivityV77.runs"), "Background activity history present");
check(!/function ensureState\(\)[\s\S]*?syncUnread\(/.test(notificationBg.match(/function ensureState\(\)[\s\S]*?\n  }/m)?.[0]||""), "Notification state initialization avoids unread recursion");
check(!notificationBg.includes("child_process") && !notificationBg.includes("new Function") && !notificationBg.includes("eval("), "Background engine cannot execute arbitrary host code");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("notifications-background-v770.js?v=9.8.6"), "Notifications Background V7.7 module precached with V9.8.6 cache key");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("notifications-background-v770.css?v=8.1.0"), "Notifications Background V7.7 CSS precached");
const settingsSecurity=readFileSync(resolve(root, "src/features/settings-security-v780.js"), "utf8");
check(index.includes("./src/features/settings-security-v780.js?v=8.1.0"), "Settings Security V7.8 module loaded");
check(index.includes("./styles/settings-security-v780.css?v=8.1.0"), "Settings Security V7.8 styles loaded");
check(settingsSecurity.includes("Win11Personalization"), "Personalization V7.8 bridge present");
check(settingsSecurity.includes("Win11SecurityCenter"), "Security Center V7.8 bridge present");
check(settingsSecurity.includes('["light","dark","system"]') || settingsSecurity.includes('"system"'), "System theme mode present");
check(settingsSecurity.includes("ACCENTS") && settingsSecurity.includes("accent-grid-v78"), "Accent color personalization present");
check(settingsSecurity.includes("taskbarAlignment") && settingsSecurity.includes("taskbar-left-v78"), "Taskbar alignment personalization present");
check(settingsSecurity.includes("transparency") && settingsSecurity.includes("animations"), "Transparency and animation controls present");
check(settingsSecurity.includes("WALLPAPERS_V78") && settingsSecurity.includes("wallpaperCount"), "Extended wallpaper personalization present");
check(settingsSecurity.includes("scanVirtualFiles") && settingsSecurity.includes("state.files"), "Virtual filesystem security scanner present");
check(settingsSecurity.includes("WIN11_SIMULATOR_TEST_THREAT"), "Harmless security test marker present");
check(settingsSecurity.includes("scanHistory") && settingsSecurity.includes("protectionHistory"), "Security scan and protection history present");
check(settingsSecurity.includes("realTime") && settingsSecurity.includes("cloudProtection") && settingsSecurity.includes("tamperProtection"), "Virtual protection controls present");
check(settingsSecurity.includes("firewall:{domain:true,private:true,public:true}"), "Virtual firewall profiles present");
check(settingsSecurity.includes("smartScreen") && settingsSecurity.includes("puaProtection"), "Virtual reputation protection present");
check(settingsSecurity.includes("ransomwareProtection"), "Virtual ransomware protection present");
check(settingsSecurity.includes("healthScore"), "Security health score present");
check(settingsSecurity.includes('source:"Segurança do Windows"'), "Security notification integration present");
check(!settingsSecurity.includes("showDirectoryPicker") && !settingsSecurity.includes("showOpenFilePicker") && !settingsSecurity.includes("RealFolderMounts"), "Security scanner cannot traverse mounted or host folders");
check(!settingsSecurity.includes("child_process") && !settingsSecurity.includes("new Function") && !settingsSecurity.includes("eval("), "Security center cannot execute arbitrary host code");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("settings-security-v780.js?v=8.1.0"), "Settings Security V7.8 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("settings-security-v780.css?v=8.1.0"), "Settings Security V7.8 CSS precached");
const runtimeShell=readFileSync(resolve(root, "src/core/runtime.js"), "utf8");
const wmShell=readFileSync(resolve(root, "src/features/window-manager-v750.js"), "utf8");
check(index.includes("./styles/shell-icons-v781.css?v=8.1.0"), "Shell Icons V8.1.0 styles loaded");
check(runtimeShell.includes("function desktopIconSvg(kind)"), "Desktop SVG icon library present");
check(runtimeShell.includes('globalThis.desktopIconSvg=desktopIconSvg'), "Desktop SVG icon library exported");
check(runtimeShell.includes('desktopIconSvg(iconKind)'), "Base desktop uses SVG icon library");
check(wmShell.includes('icon("thispc")') && wmShell.includes('icon("edge")') && wmShell.includes('icon("recycle")') && wmShell.includes('icon("settings")'), "Window Manager system desktop icons use SVG library");
check(wmShell.includes('icon("image")') && wmShell.includes('icon("media")') && wmShell.includes('icon("text")'), "Virtual desktop file types use SVG icons");
check(!wmShell.includes('label:"Este PC",icon:"🖥️"') && !wmShell.includes('label:"Documentos",icon:"📁"') && !wmShell.includes('label:"Microsoft Edge",icon:"🌐"') && !wmShell.includes('label:"Reciclagem",icon:"🗑️"') && !wmShell.includes('label:"Definições",icon:"⚙️"'), "System desktop shortcuts do not depend on emoji");
check(index.includes('id="power-btn" title="Energia" aria-label="Energia"'), "Power button has accessible label");
check(index.includes('class="power-symbol-v781"'), "Power button uses CSS power symbol");
check(!index.includes('id="power-btn">⏻'), "Power button no longer depends on Unicode power glyph");
check(readFileSync(resolve(root, "styles/shell-icons-v781.css"), "utf8").includes(".power-symbol-v781::before"), "CSS power symbol present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("shell-icons-v781.css?v=8.1.0"), "Shell Icons V8.1.0 CSS precached");
const trayQuick=readFileSync(resolve(root, "src/features/system-tray-quick-v790.js"), "utf8");
check(index.includes("./src/features/system-tray-quick-v790.js?v=8.1.0"), "System Tray V7.9 module loaded");
check(index.includes("./styles/system-tray-quick-v790.css?v=8.1.0"), "System Tray V7.9 styles loaded");
check(trayQuick.includes("Win11SystemTray"), "System Tray V7.9 bridge present");
check(trayQuick.includes("system-tray-v2") && trayQuick.includes("quick-settings-v2"), "System Tray and Quick Settings V2 capabilities registered");
check(trayQuick.includes("navigator.onLine") && trayQuick.includes("navigator.connection"), "Real browser network status integration present");
check(trayQuick.includes("navigator.getBattery") || trayQuick.includes("batterySnapshot"), "Real browser battery status integration present");
check(trayQuick.includes("virtual-volume-control") && trayQuick.includes("virtual-brightness-control"), "Virtual volume and brightness controls registered");
check(trayQuick.includes("virtual-bluetooth-toggle"), "Virtual Bluetooth control registered");
check(trayQuick.includes("night-light-visual"), "Night Light visual effect registered");
check(trayQuick.includes("focus-assist-quick-toggle"), "Focus Assist V7.9 integration present");
check(trayQuick.includes("fullscreen-quick-toggle") && trayQuick.includes("wake-lock-quick-toggle"), "Fullscreen and Wake Lock quick controls registered");
check(trayQuick.includes("tray-overflow"), "Tray overflow integration present");
check(trayQuick.includes("privacy-media-indicator"), "Camera and microphone privacy indicator registered");
check(trayQuick.includes('e.key.toLowerCase()==="a"') && trayQuick.includes('e.key.toLowerCase()==="n"'), "Win+A and Win+N shortcuts present");
check(trayQuick.includes("Rede/bateria: browser") && trayQuick.includes("Som/brilho/Bluetooth/luz noturna: simulador"), "Real versus virtual Quick Settings disclosure present");
check(!trayQuick.includes("navigator.bluetooth.requestDevice") && !trayQuick.includes("getUserMedia({audio:true") && !trayQuick.includes("getUserMedia({video:true"), "System Tray does not request Bluetooth or media permissions automatically");
check(!trayQuick.includes("child_process") && !trayQuick.includes("new Function") && !trayQuick.includes("eval("), "System Tray cannot execute arbitrary host code");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("system-tray-quick-v790.js?v=8.1.0"), "System Tray V7.9 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("system-tray-quick-v790.css?v=8.1.0"), "System Tray V7.9 CSS precached");
check(readFileSync(resolve(root, "src/features/desktop-integration-v700.js"), "utf8").includes("globalThis.Win11SystemTray?.refresh"), "Legacy Quick Settings delegates tray updates to V7.9");
const winExp=readFileSync(resolve(root, "src/features/windows-experience-v800.js"), "utf8");
const swV8=readFileSync(resolve(root, "service-worker.js"), "utf8");
check(index.includes("./src/features/windows-experience-v800.js?v=8.1.0"), "Windows Experience V8.0 module loaded");
check(index.includes("./styles/windows-experience-v800.css?v=8.1.0"), "Windows Experience V8.0 styles loaded");
check(winExp.includes("Win11Experience"), "Windows Experience V8.0 bridge present");
check(winExp.includes("two-stage-lock-screen") && winExp.includes("windows-hello-visual"), "Two-stage lock and Windows Hello visual capabilities registered");
check(winExp.includes("lock-clock-stage-v800") && winExp.includes("revealSignIn"), "Two-stage sign-in implementation present");
check(winExp.includes("Visual apenas · sem acesso biométrico"), "Windows Hello biometric boundary disclosure present");
check(!winExp.includes("PublicKeyCredential") && !winExp.includes("credentials.create") && !winExp.includes("credentials.get"), "Windows Hello visual does not invoke biometric/WebAuthn APIs");
check(winExp.includes("navigator.onLine") && (winExp.includes("batterySnapshot") || winExp.includes("navigator.getBattery")), "Lock screen browser status integration present");
check(winExp.includes("Win11UpdateCoordinator"), "PWA Update Coordinator bridge present");
check(winExp.includes("checkForUpdate") && winExp.includes("activateUpdate"), "Explicit PWA update actions present");
check(winExp.includes('postMessage({type:"SKIP_WAITING"})'), "Update activation sends SKIP_WAITING after explicit action");
check(!swV8.includes(".then(()=>self.skipWaiting())"), "Service Worker install does not force skipWaiting");
check(swV8.includes('event.data?.type==="SKIP_WAITING"' ) && swV8.includes("self.skipWaiting()"), "Service Worker accepts explicit SKIP_WAITING message");
check(winExp.includes("data-update-card-v800"), "Windows Update Settings card present");
check(winExp.includes("pageshow") && winExp.includes("visibilitychange") && winExp.includes("recoverShell"), "Shell recovery hooks present");
check(readFileSync(resolve(root, "src/features/real-platform-v660.js"), "utf8").includes('service-worker.js?v=8.1.0'), "PWA registration references V8.0 Service Worker");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("windows-experience-v800.js?v=8.1.0"), "Windows Experience V8.0 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("windows-experience-v800.css?v=8.1.0"), "Windows Experience V8.0 CSS precached");
check(readFileSync(resolve(root, "src/features/realism-v62.js"), "utf8").includes("globalThis.Win11SystemTray?.refresh") && readFileSync(resolve(root, "src/features/realism-v62.js"), "utf8").includes("notify&&!globalThis.Win11SystemTray"), "Legacy V6.2 tray delegates to modern System Tray");
const startSearch=readFileSync(resolve(root, "src/features/start-search-taskbar-v810.js"), "utf8");
check(index.includes("./src/features/start-search-taskbar-v810.js?v=9.3.0"), "Start Search Taskbar V8.1 module loaded");
check(index.includes("./styles/start-search-taskbar-v810.css?v=8.1.0"), "Start Search Taskbar V8.1 styles loaded");
check(startSearch.includes("Win11StartSearch"), "Start Search V8.1 bridge present");
check(startSearch.includes("state.startSearchV81") && startSearch.includes("pinned") && startSearch.includes("recentApps") && startSearch.includes("searchHistory"), "Per-profile Start and Search state present");
check(startSearch.includes("application/x-win11-start-app") && startSearch.includes("reorderPinned"), "Start pin drag reorder present");
check(startSearch.includes("localeCompare") && startSearch.includes("allapps-letter-v81"), "Alphabetical All Apps implementation present");
check(startSearch.includes("renderRecommendedV810") && startSearch.includes("recentFileEntries") && startSearch.includes("recentApps"), "Smart recommended items present");
check(startSearch.includes("collectSearchResultsV810") && startSearch.includes("SETTINGS_INDEX"), "Categorized local search index present");
check(startSearch.includes("slice(0,4000)"), "Search content indexing is bounded");
check(startSearch.includes("normalize(\"NFD\")") && startSearch.includes("\\u0300-\\u036f"), "Accent-insensitive search normalization present");
check(startSearch.includes("search-preview-v81") && startSearch.includes("search-preview-actions-v81"), "Search preview actions present");
check(startSearch.includes("ArrowDown") && startSearch.includes("ArrowUp") && startSearch.includes("moveSearchSelection"), "Search keyboard navigation present");
check(startSearch.includes("showTaskbarJumpList") && startSearch.includes("jumpItems") && startSearch.includes("contextmenu"), "Taskbar jump lists present");
check(startSearch.includes("C:/Documents") && startSearch.includes("C:/Desktop") && startSearch.includes("C:/Pictures"), "Explorer jump destinations present");
check(!startSearch.includes("showDirectoryPicker") && !startSearch.includes("RealFolderMounts") && !startSearch.includes("navigator.clipboard"), "Search does not inspect real mounts or clipboard");
check(!startSearch.includes("fetch(") && !startSearch.includes("XMLHttpRequest"), "Search does not send queries to external services");
check(!startSearch.includes("child_process") && !startSearch.includes("new Function") && !startSearch.includes("eval("), "Start Search cannot execute arbitrary host code");
check(startSearch.includes("start-menu-v3") && startSearch.includes("search-v3") && startSearch.includes("taskbar-jump-lists"), "V8.1 capabilities registered");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("start-search-taskbar-v810.js?v=9.3.0"), "Start Search V8.1 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("start-search-taskbar-v810.css?v=8.1.0"), "Start Search V8.1 CSS precached");
const searchV920=readFileSync(resolve(root, "src/features/search-v920.js"), "utf8");
check(index.includes("./src/features/search-v920.js?v=9.2.0"), "Search V9.2 module loaded");
check(index.includes("./styles/search-v920.css?v=9.2.0"), "Search V9.2 styles loaded");
check(searchV920.includes('version:VERSION') && searchV920.includes('VERSION="9.2.0"'), "Search V9.2 bridge present");
check(searchV920.includes("tokenizeQuery") && searchV920.includes("filters.type") && searchV920.includes("filters.ext"), "Search V9.2 query parser present");
check(searchV920.includes("parseBytes") && searchV920.includes("matchModified") && searchV920.includes("matchSize"), "Search V9.2 size and date filters present");
check(searchV920.includes("type:folder") && searchV920.includes("type:image") && searchV920.includes("in:Documents"), "Search V9.2 quick filters and suggestions present");
check(searchV920.includes("indexCache") && searchV920.includes("dirty=true") && searchV920.includes("invalidate"), "Search V9.2 cached index present");
check(searchV920.includes('kind:"folder"') && searchV920.includes("folderSize"), "Search V9.2 folder indexing present");
check(searchV920.includes("renderControls") && searchV920.includes("search-active-filters-v920"), "Search V9.2 filter chips present");
check(startSearch.includes("Win11SearchV920?.collect") && startSearch.includes("Win11SearchV920?.renderControls"), "Start Search delegates to Search V9.2");
check(readFileSync(resolve(root, "src/features/explorer-filesystem-v910.js"), "utf8").includes("Win11SearchV920?.invalidate"), "Filesystem invalidates Search V9.2 index");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("search-v920.js?v=9.2.0"), "Search V9.2 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("search-v920.css?v=9.2.0"), "Search V9.2 CSS precached");

if (failed) process.exit(1);
console.log("All smoke tests passed.");
