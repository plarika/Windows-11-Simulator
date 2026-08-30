from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
source = root / "index.html"
html = source.read_text(encoding="utf-8")

style_match = re.search(r"<style>(.*?)</style>", html, re.S)
script_match = re.search(r"<script>(.*?)</script>", html, re.S)
if not style_match or not script_match:
    raise SystemExit("Could not find inline style/script blocks")

style = style_match.group(1)
script = script_match.group(1)

v4_css_marker = "/* =========================\n   V4 — Windows 11 content"
v5_css_marker = "/* ============================================================\n   V5 — Windows System Suite"
v4_css_pos = style.find(v4_css_marker)
v5_css_pos = style.find(v5_css_marker)
if not (v4_css_pos > 0 and v5_css_pos > v4_css_pos):
    raise SystemExit("CSS markers not found")

(root / "styles").mkdir(exist_ok=True)
(root / "src" / "core").mkdir(parents=True, exist_ok=True)
(root / "src" / "features").mkdir(parents=True, exist_ok=True)
(root / "src" / "apps").mkdir(parents=True, exist_ok=True)
(root / "tests").mkdir(exist_ok=True)

(root / "styles" / "base.css").write_text(style[:v4_css_pos].strip() + "\n", encoding="utf-8")
(root / "styles" / "system-v4.css").write_text(style[v4_css_pos:v5_css_pos].strip() + "\n", encoding="utf-8")
(root / "styles" / "system-suite-v5.css").write_text(style[v5_css_pos:].strip() + "\n", encoding="utf-8")

v4_js_marker = "/* =========================\n   V4 behavior overrides"
v5_js_marker = "/* ============================================================\n   V5 — Windows System Suite behavior"
v4_js_pos = script.find(v4_js_marker)
v5_js_pos = script.find(v5_js_marker)
if not (v4_js_pos > 0 and v5_js_pos > v4_js_pos):
    raise SystemExit("JavaScript markers not found")

base_js = script[:v4_js_pos].strip() + "\n"
v4_js = script[v4_js_pos:v5_js_pos].strip() + "\n"
v5_js = script[v5_js_pos:]

boot_line = "state.desktops=Array.isArray(state.desktops)&&state.desktops.length?state.desktops:['Ambiente 1'];state.currentDesktop=clamp(Number(state.currentDesktop)||0,0,state.desktops.length-1);applyState();renderRecommended();setTimeout(()=>{$('#boot').classList.add('hidden');$('#lock').classList.remove('hidden')},1000);"
if boot_line not in v5_js:
    raise SystemExit("Boot line not found")
v5_js = v5_js.replace(boot_line, "", 1).strip() + "\n"

(root / "src" / "core" / "runtime.js").write_text(base_js, encoding="utf-8")
(root / "src" / "features" / "system-v4.js").write_text('"use strict";\n' + v4_js, encoding="utf-8")

markers = [
    ("explorer-v5.js", "/* ---------- Explorer V5: copy/cut/paste, folders, sorting, DnD ---------- */"),
    ("settings-v5.js", "/* ---------- Settings V5 ---------- */"),
    ("windows-tools.js", "/* ---------- Windows Tools ---------- */"),
    ("services.js", "/* ---------- Services ---------- */"),
    ("disk-management.js", "/* ---------- Disk Management ---------- */"),
    ("task-scheduler.js", "/* ---------- Task Scheduler ---------- */"),
    ("system-info.js", "/* ---------- System Information ---------- */"),
    ("resource-monitor.js", "/* ---------- Resource Monitor ---------- */"),
    ("powershell.js", "/* ---------- PowerShell ---------- */"),
    ("optional-features.js", "/* ---------- Optional Features ---------- */"),
    ("backup-recovery.js", "/* ---------- Backup / Recovery ---------- */"),
    ("sticky-notes.js", "/* ---------- Sticky Notes ---------- */"),
    ("onedrive.js", "/* ---------- OneDrive ---------- */"),
    ("remote-desktop.js", "/* ---------- Remote Desktop ---------- */"),
    ("sound-recorder.js", "/* ---------- Sound Recorder ---------- */"),
    ("get-help.js", "/* ---------- Get Help ---------- */"),
    ("shell-integration.js", "/* ---------- Run / Terminal integration ---------- */"),
    ("search-v5.js", "/* ---------- Search aliases ---------- */"),
]

positions = []
for filename, marker in markers:
    pos = v5_js.find(marker)
    if pos < 0:
        raise SystemExit(f"Missing V5 marker: {marker}")
    positions.append((filename, marker, pos))
positions.sort(key=lambda item: item[2])

prelude = v5_js[:positions[0][2]].strip() + "\n"
(root / "src" / "apps" / "v5-runtime.js").write_text('"use strict";\n' + prelude, encoding="utf-8")

for i, (filename, marker, pos) in enumerate(positions):
    end = positions[i + 1][2] if i + 1 < len(positions) else len(v5_js)
    chunk = v5_js[pos:end].strip() + "\n"
    (root / "src" / "apps" / filename).write_text('"use strict";\n' + chunk, encoding="utf-8")

boot_js = '''"use strict";
(function bootWindowsSimulatorV6() {
  const required = ["openApp","applyState","renderRecommended","buildExplorerV5","buildSettingsV5","buildServices","buildDiskManagement","buildPowerShell"];
  const missing = required.filter((name) => typeof globalThis[name] !== "function");
  globalThis.Win11SimDiagnostics = {
    version: "6.0.0",
    run() {
      return {
        version: "6.0.0",
        missingFunctions: required.filter((name) => typeof globalThis[name] !== "function"),
        windowCount: document.querySelectorAll(".window").length,
        currentDesktop: Number(state.currentDesktop) || 0,
      };
    },
  };
  if (missing.length) {
    console.error("[V6] Missing modules:", missing);
    const boot = document.getElementById("boot");
    if (boot) boot.innerHTML = "<h2>Falha ao iniciar V6</h2><p>Consulte a consola.</p>";
    return;
  }
  state.desktops = Array.isArray(state.desktops) && state.desktops.length ? state.desktops : ["Ambiente 1"];
  state.currentDesktop = clamp(Number(state.currentDesktop) || 0, 0, state.desktops.length - 1);
  applyState();
  renderRecommended();
  setTimeout(() => {
    document.getElementById("boot")?.classList.add("hidden");
    document.getElementById("lock")?.classList.remove("hidden");
  }, 1000);
})();
'''
(root / "src" / "core" / "boot.js").write_text(boot_js, encoding="utf-8")

modular = re.sub(r"<style>.*?</style>", "", html, count=1, flags=re.S)
modular = re.sub(r"<script>.*?</script>", "", modular, count=1, flags=re.S)
modular = modular.replace("<title>Windows 11 Simulator V5</title>", "<title>Windows 11 Simulator V6</title>", 1)

css_links = """<link rel="stylesheet" href="./styles/base.css">
<link rel="stylesheet" href="./styles/system-v4.css">
<link rel="stylesheet" href="./styles/system-suite-v5.css">
"""
modular = modular.replace("</head>", css_links + "</head>", 1)

scripts = [
    "./src/core/runtime.js",
    "./src/features/system-v4.js",
    "./src/apps/v5-runtime.js",
    "./src/apps/explorer-v5.js",
    "./src/apps/settings-v5.js",
    "./src/apps/windows-tools.js",
    "./src/apps/services.js",
    "./src/apps/disk-management.js",
    "./src/apps/task-scheduler.js",
    "./src/apps/system-info.js",
    "./src/apps/resource-monitor.js",
    "./src/apps/powershell.js",
    "./src/apps/optional-features.js",
    "./src/apps/backup-recovery.js",
    "./src/apps/sticky-notes.js",
    "./src/apps/onedrive.js",
    "./src/apps/remote-desktop.js",
    "./src/apps/sound-recorder.js",
    "./src/apps/get-help.js",
    "./src/apps/shell-integration.js",
    "./src/apps/search-v5.js",
    "./src/core/boot.js",
]
tags = "\n".join(f'<script src="{src}"></script>' for src in scripts) + "\n"
modular = modular.replace("</body>", tags + "</body>", 1)
source.write_text(modular, encoding="utf-8")
print(f"V6 modular migration complete: {len(scripts)} scripts, 3 stylesheets")
