from pathlib import Path
import re

root=Path(__file__).resolve().parents[1]
index=root/"index.html"
s=index.read_text(encoding="utf-8")

s=re.sub(r'\s*<link rel="stylesheet" href="\./styles/app-realism-v63\.css[^"]*">',"",s)
s=re.sub(r'\s*<script src="\./src/features/app-realism-v63\.js[^"]*"></script>',"",s)

s=re.sub(
    r'((?:src|href)="\./[^"?]+\.(?:js|css))(?:\?[^"]*)?"',
    lambda m:m.group(1)+'?v=6.3.0"',
    s
)

needle='<link rel="stylesheet" href="./styles/realism-v62.css?v=6.3.0">'
if needle not in s:
    raise SystemExit("realism stylesheet reference missing")
s=s.replace(needle,needle+'\n<link rel="stylesheet" href="./styles/app-realism-v63.css?v=6.3.0">',1)

boot='<script src="./src/core/boot.js?v=6.3.0"></script>'
if boot not in s:
    raise SystemExit("boot script reference missing")
s=s.replace(boot,'<script src="./src/features/app-realism-v63.js?v=6.3.0"></script>\n'+boot,1)

s=re.sub(r'<title>Windows 11 Simulator[^<]*</title>','<title>Windows 11 Simulator V6.3</title>',s)
index.write_text(s,encoding="utf-8")

pkg=root/"package.json"
p=pkg.read_text(encoding="utf-8")
p=re.sub(r'"version":\s*"[^"]+"','"version": "6.3.0"',p,count=1)
pkg.write_text(p,encoding="utf-8")

bootfile=root/"src/core/boot.js"
b=bootfile.read_text(encoding="utf-8")
b=re.sub(r'version:\s*"[^"]+"','version: "6.3.0"',b)
bootfile.write_text(b,encoding="utf-8")

readme=root/"README.md"
r=readme.read_text(encoding="utf-8")
r=re.sub(r'\*\*V6\.2 Realism Layer\*\*[^\n]*','**V6.3 App Realism** — Explorer, Edge, Task Manager, Settings e diálogos de ficheiros mais próximos do Windows 11 real.',r)
if "## V6.3 App Realism" not in r:
    r += """\n## V6.3 App Realism\n\n- Edge com vários separadores e Internet\n- Explorer com chrome, breadcrumbs e barra de estado mais realistas\n- Task Manager moderno com processos, desempenho, arranque, utilizadores, detalhes e serviços\n- Notepad com diálogos virtuais Abrir e Guardar como\n- Settings com identidade do dispositivo e pesquisa integrada\n"""
readme.write_text(r,encoding="utf-8")
print("V6.3 wiring complete")
