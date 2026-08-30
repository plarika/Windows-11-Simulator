from pathlib import Path
import re

root=Path(__file__).resolve().parents[1]
index=root/"index.html"
s=index.read_text(encoding="utf-8")

# Remove prior realism refs if this script is rerun.
s=re.sub(r'\s*<link rel="stylesheet" href="\./styles/realism-v62\.css[^"]*">', "", s)
s=re.sub(r'\s*<script src="\./src/features/realism-v62\.js[^"]*"></script>', "", s)

# Version every local CSS/JS asset so mobile browsers cannot reuse old shell code.
s=re.sub(
    r'((?:src|href)="\./[^"?]+\.(?:js|css))(?:\?[^"]*)?"',
    lambda m: m.group(1)+'?v=6.2.0"',
    s
)

s=s.replace(
    '<link rel="stylesheet" href="./styles/system-suite-v5.css?v=6.2.0">',
    '<link rel="stylesheet" href="./styles/system-suite-v5.css?v=6.2.0">\n<link rel="stylesheet" href="./styles/realism-v62.css?v=6.2.0">'
)
s=s.replace(
    '<script src="./src/core/boot.js?v=6.2.0"></script>',
    '<script src="./src/features/realism-v62.js?v=6.2.0"></script>\n<script src="./src/core/boot.js?v=6.2.0"></script>'
)
s=re.sub(r'<title>Windows 11 Simulator[^<]*</title>','<title>Windows 11 Simulator V6.2</title>',s)
index.write_text(s,encoding="utf-8")

package=root/"package.json"
p=package.read_text(encoding="utf-8")
p=re.sub(r'"version":\s*"[^"]+"','"version": "6.2.0"',p,count=1)
package.write_text(p,encoding="utf-8")

boot=root/"src/core/boot.js"
b=boot.read_text(encoding="utf-8")
b=re.sub(r'version:\s*"[^"]+"','version: "6.2.0"',b)
boot.write_text(b,encoding="utf-8")

readme=root/"README.md"
r=readme.read_text(encoding="utf-8")
r=re.sub(r'\*\*V6\.1 Modular\*\*[^\n]*','**V6.2 Realism Layer** — shell visual mais fiel ao Windows 11, mantendo a arquitetura modular e o Edge com Internet.',r)
if "Realism Layer" not in r:
    r += "\n## V6.2 Realism Layer\n\nA V6.2 melhora Taskbar, Start, janelas, ícones, system tray, lock screen, menus e animações sem alterar o modelo de segurança do simulador.\n"
readme.write_text(r,encoding="utf-8")
print("V6.2 wiring complete")
