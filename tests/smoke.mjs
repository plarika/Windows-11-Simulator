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
check(index.includes("./src/features/real-files-v640.js?v=8.1.0"), "Real file bridge loaded");
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
check(index.includes("./src/features/local-accounts-v670.js?v=8.1.0"), "Session module loaded");
check(index.includes("./styles/local-accounts-v670.css?v=8.1.0"), "Session styles loaded");
check(realContent.includes("ownerId:currentOwnerId()"), "IndexedDB blobs record ownerId");
check(realContent.includes("claimLegacyBlobs"), "Legacy IndexedDB ownership migration present");
check(realContent.includes("record.ownerId&&record.ownerId!==owner"), "IndexedDB owner isolation enforced");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("local-accounts-v670.js?v=8.1.0"), "Session module precached by service worker");
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
check(index.includes("./src/features/desktop-integration-v700.js?v=8.1.0"), "Desktop integration module loaded");
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
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("desktop-integration-v700.js?v=8.1.0"), "Desktop integration precached");
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
check(index.includes("./src/features/edge-internet-v720.js?v=8.1.0"), "Edge Internet module loaded");
check(index.includes("./styles/edge-internet-v720.css?v=8.1.0"), "Edge Internet styles loaded");
check(edgeInternet.includes("www.google.com/search?igu=1&q="), "Google search integration present");
check(edgeInternet.includes('url.searchParams.set("igu","1")'), "Google iframe compatibility flag present");
check(edgeInternet.includes("youtube.com/embed/"), "YouTube official video embed present");
check(edgeInternet.includes("youtube.com/embed/videoseries"), "YouTube playlist embed present");
check(edgeInternet.includes('["shorts","embed","live"]'), "YouTube shorts/embed/live URL parsing present");
check(edgeInternet.includes("youtu.be"), "YouTube short URL support present");
check(edgeInternet.includes("KNOWN_FRAME_BLOCKERS"), "Known iframe blocker compatibility mode present");
check(edgeInternet.includes("X-Frame-Options") || readFileSync(resolve(root, "SECURITY.md"), "utf8").includes("X-Frame-Options"), "Frame-policy disclosure present");
check(edgeInternet.includes("data-edge-shortcut"), "Edge new-tab Web shortcuts present");
check(edgeInternet.includes("data-youtube-external"), "YouTube external fallback present");
check(edgeInternet.includes("data-compat-open"), "Blocked-site external fallback present");
check(edgeInternet.includes('sandbox","allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"'), "Generic Web iframe remains sandboxed");
check(edgeInternet.includes("allowfullscreen"), "YouTube player fullscreen allowed");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("edge-internet-v720.js?v=8.1.0"), "Edge Internet module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("edge-internet-v720.css?v=8.1.0"), "Edge Internet CSS precached");
const edgeAdvanced=readFileSync(resolve(root, "src/features/edge-advanced-v730.js"), "utf8");
check(index.includes("./src/features/edge-advanced-v730.js?v=8.1.0"), "Edge Advanced module loaded");
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
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("edge-advanced-v730.js?v=8.1.0"), "Edge Advanced module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("edge-advanced-v730.css?v=8.1.0"), "Edge Advanced CSS precached");
const explorerPro=readFileSync(resolve(root, "src/features/explorer-pro-v740.js"), "utf8");
check(index.includes("./src/features/explorer-pro-v740.js?v=8.1.0"), "Explorer Pro module loaded");
check(index.includes("./styles/explorer-pro-v740.css?v=8.1.0"), "Explorer Pro styles loaded");
check(explorerPro.includes("explorer-multiselect"), "Explorer multi-select capability registered");
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
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-pro-v740.js?v=8.1.0"), "Explorer Pro module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("explorer-pro-v740.css?v=8.1.0"), "Explorer Pro CSS precached");
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
check(index.includes("./src/features/notifications-background-v770.js?v=8.1.0"), "Notifications Background V7.7 module loaded");
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
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("notifications-background-v770.js?v=8.1.0"), "Notifications Background V7.7 module precached");
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
check(index.includes("./src/features/start-search-taskbar-v810.js?v=8.1.0"), "Start Search Taskbar V8.1 module loaded");
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
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("start-search-taskbar-v810.js?v=8.1.0"), "Start Search V8.1 module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("start-search-taskbar-v810.css?v=8.1.0"), "Start Search V8.1 CSS precached");

if (failed) process.exit(1);
console.log("All smoke tests passed.");
