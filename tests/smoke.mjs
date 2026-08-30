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
  index.includes("./favicon.svg?v=7.2.0"),
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
check(index.includes("./src/features/real-files-v640.js?v=7.2.0"), "Real file bridge loaded");
check(index.includes("./styles/real-files-v640.css?v=7.2.0"), "Real file bridge styles loaded");



const realClipboard = readFileSync(resolve(root, "src/features/real-clipboard-v650.js"), "utf8");
check(realClipboard.includes("navigator.clipboard?.writeText"), "Real clipboard write integration present");
check(realClipboard.includes("navigator.clipboard?.readText"), "Real clipboard read integration present");
check(realClipboard.includes('document.execCommand("copy")'), "Clipboard copy fallback present");
check(realClipboard.includes("manualPasteDialog"), "Clipboard manual paste fallback present");
check(realClipboard.includes("Ler do dispositivo"), "Win+V real clipboard read control present");
check(realClipboard.includes("Copiar para dispositivo"), "Win+V real clipboard write control present");
check(realClipboard.includes("Copiar dispositivo"), "Notepad real clipboard copy control present");
check(realClipboard.includes("Colar dispositivo"), "Notepad real clipboard paste control present");
check(index.includes("./src/features/real-clipboard-v650.js?v=7.2.0"), "Real clipboard bridge loaded");
check(index.includes("./styles/real-clipboard-v650.css?v=7.2.0"), "Real clipboard styles loaded");



const realContent = readFileSync(resolve(root, "src/features/real-content-v660.js"), "utf8");
check(realContent.includes("indexedDB.open"), "IndexedDB real file store present");
check(realContent.includes("showDirectoryPicker"), "Real folder picker integration present");
check(realContent.includes("webkitdirectory"), "Folder picker fallback present");
check(realContent.includes("dragenter"), "Explorer drag and drop integration present");
check(realContent.includes("data-import-files"), "Explorer real import control present");
check(realContent.includes("data-export-file"), "Explorer real export control present");
check(realContent.includes("Abrir imagem do dispositivo"), "Photos real image control present");
check(realContent.includes("Abrir multimédia"), "Media Player real media control present");
check(index.includes("./src/features/real-content-v660.js?v=7.2.0"), "Real content module loaded");
check(index.includes("./styles/real-content-v660.css?v=7.2.0"), "Real content styles loaded");

const realPlatform = readFileSync(resolve(root, "src/features/real-platform-v660.js"), "utf8");
check(realPlatform.includes("Notification.requestPermission"), "Real notification permission integration present");
check(realPlatform.includes("new Notification"), "Real browser notification integration present");
check(realPlatform.includes("serviceWorker.register"), "PWA service worker registration present");
check(realPlatform.includes("beforeinstallprompt"), "PWA install prompt integration present");
check(index.includes("./manifest.webmanifest?v=7.2.0"), "PWA manifest loaded");
check(index.includes("./src/features/real-platform-v660.js?v=7.2.0"), "Real platform module loaded");
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
check(index.includes("./src/features/local-accounts-v670.js?v=7.2.0"), "Session module loaded");
check(index.includes("./styles/local-accounts-v670.css?v=7.2.0"), "Session styles loaded");
check(realContent.includes("ownerId:currentOwnerId()"), "IndexedDB blobs record ownerId");
check(realContent.includes("claimLegacyBlobs"), "Legacy IndexedDB ownership migration present");
check(realContent.includes("record.ownerId&&record.ownerId!==owner"), "IndexedDB owner isolation enforced");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("local-accounts-v670.js?v=7.2.0"), "Session module precached by service worker");
check(existsSync(resolve(root, "src/workers/auth-crypto-v673.js")), "Auth crypto worker exists");
const authWorkerSource=readFileSync(resolve(root, "src/workers/auth-crypto-v673.js"), "utf8");
const authWorkerCheck=spawnSync(process.execPath, ["--check", resolve(root, "src/workers/auth-crypto-v673.js")], {encoding:"utf8"});
check(authWorkerCheck.status===0, "Auth crypto worker syntax");
check(authWorkerSource.includes("crypto.subtle.deriveBits"), "Auth worker performs PBKDF2 off main thread");
check(sessions.includes("new Worker(AUTH_WORKER_URL)"), "Session login uses auth worker");
check(sessions.includes("const ITERATIONS=120000"), "New credentials use mobile-optimized PBKDF2 cost");
check(sessions.includes("upgradeCredentialIfNeeded"), "Legacy credential upgrade present");
check(sessions.includes("A verificar no dispositivo..."), "Slow auth progress state present");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("auth-crypto-v673.js?v=7.2.0"), "Auth worker precached by service worker");

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
check(index.includes("./src/features/real-device-tools-v680.js?v=7.2.0"), "Real device tools module loaded");
check(index.includes("./styles/real-device-tools-v680.css?v=7.2.0"), "Real device tools styles loaded");
check(readFileSync(resolve(root, "src/core/runtime.js"), "utf8").includes('camera:{name:"Câmara"'), "Camera app registered");
check(readFileSync(resolve(root, "src/apps/v5-runtime.js"), "utf8").includes('if(appId==="camera"){buildCamera(wrap);return wrap}'), "Camera renderer registered");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("real-device-tools-v680.js?v=7.2.0"), "Real device tools precached");
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
check(index.includes("./src/features/desktop-integration-v700.js?v=7.2.0"), "Desktop integration module loaded");
check(index.includes("./styles/desktop-integration-v700.css?v=7.2.0"), "Desktop integration styles loaded");
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
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("desktop-integration-v700.js?v=7.2.0"), "Desktop integration precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("desktop-integration-v700.css?v=7.2.0"), "Desktop integration CSS precached");
const realMounts=readFileSync(resolve(root, "src/features/real-folder-mounts-v710.js"), "utf8");
check(index.includes("./src/features/real-folder-mounts-v710.js?v=7.2.0"), "Real folder mounts module loaded");
check(index.includes("./styles/real-folder-mounts-v710.css?v=7.2.0"), "Real folder mounts styles loaded");
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
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("real-folder-mounts-v710.js?v=7.2.0"), "Real folder mounts precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("real-folder-mounts-v710.css?v=7.2.0"), "Real folder mounts CSS precached");
const edgeInternet=readFileSync(resolve(root, "src/features/edge-internet-v720.js"), "utf8");
check(index.includes("./src/features/edge-internet-v720.js?v=7.2.0"), "Edge Internet module loaded");
check(index.includes("./styles/edge-internet-v720.css?v=7.2.0"), "Edge Internet styles loaded");
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
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("edge-internet-v720.js?v=7.2.0"), "Edge Internet module precached");
check(readFileSync(resolve(root, "service-worker.js"), "utf8").includes("edge-internet-v720.css?v=7.2.0"), "Edge Internet CSS precached");

if (failed) process.exit(1);
console.log("All smoke tests passed.");
