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
  index.includes("./favicon.svg?v=6.6.0"),
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
check(index.includes("./src/features/real-files-v640.js?v=6.6.0"), "Real file bridge loaded");
check(index.includes("./styles/real-files-v640.css?v=6.6.0"), "Real file bridge styles loaded");



const realClipboard = readFileSync(resolve(root, "src/features/real-clipboard-v650.js"), "utf8");
check(realClipboard.includes("navigator.clipboard?.writeText"), "Real clipboard write integration present");
check(realClipboard.includes("navigator.clipboard?.readText"), "Real clipboard read integration present");
check(realClipboard.includes('document.execCommand("copy")'), "Clipboard copy fallback present");
check(realClipboard.includes("manualPasteDialog"), "Clipboard manual paste fallback present");
check(realClipboard.includes("Ler do dispositivo"), "Win+V real clipboard read control present");
check(realClipboard.includes("Copiar para dispositivo"), "Win+V real clipboard write control present");
check(realClipboard.includes("Copiar dispositivo"), "Notepad real clipboard copy control present");
check(realClipboard.includes("Colar dispositivo"), "Notepad real clipboard paste control present");
check(index.includes("./src/features/real-clipboard-v650.js?v=6.6.0"), "Real clipboard bridge loaded");
check(index.includes("./styles/real-clipboard-v650.css?v=6.6.0"), "Real clipboard styles loaded");



const realContent = readFileSync(resolve(root, "src/features/real-content-v660.js"), "utf8");
check(realContent.includes("indexedDB.open"), "IndexedDB real file store present");
check(realContent.includes("showDirectoryPicker"), "Real folder picker integration present");
check(realContent.includes("webkitdirectory"), "Folder picker fallback present");
check(realContent.includes("dragenter"), "Explorer drag and drop integration present");
check(realContent.includes("data-import-files"), "Explorer real import control present");
check(realContent.includes("data-export-file"), "Explorer real export control present");
check(realContent.includes("Abrir imagem do dispositivo"), "Photos real image control present");
check(realContent.includes("Abrir multimédia"), "Media Player real media control present");
check(index.includes("./src/features/real-content-v660.js?v=6.6.0"), "Real content module loaded");
check(index.includes("./styles/real-content-v660.css?v=6.6.0"), "Real content styles loaded");

const realPlatform = readFileSync(resolve(root, "src/features/real-platform-v660.js"), "utf8");
check(realPlatform.includes("Notification.requestPermission"), "Real notification permission integration present");
check(realPlatform.includes("new Notification"), "Real browser notification integration present");
check(realPlatform.includes("serviceWorker.register"), "PWA service worker registration present");
check(realPlatform.includes("beforeinstallprompt"), "PWA install prompt integration present");
check(index.includes("./manifest.webmanifest?v=6.6.0"), "PWA manifest loaded");
check(index.includes("./src/features/real-platform-v660.js?v=6.6.0"), "Real platform module loaded");
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

if (failed) process.exit(1);
console.log("All smoke tests passed.");
