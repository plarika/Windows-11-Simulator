from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
index = root / "index.html"
s = index.read_text(encoding="utf-8")

def bust(match):
    base = match.group(1)
    return f'{base}?v=6.1.1"'

s = re.sub(r'((?:src|href)="\./[^"?]+\.(?:js|css))(?:\?[^"]*)?"', bust, s)
s = s.replace("<title>Windows 11 Simulator V6</title>", "<title>Windows 11 Simulator V6.1.1</title>")
index.write_text(s, encoding="utf-8")

test = root / "tests" / "smoke.mjs"
t = test.read_text(encoding="utf-8")
t = t.replace(
    'const refs = [...index.matchAll(/(?:src|href)="(\\.\\/[^"#?]+)"/g)].map(m => m[1]);',
    'const refs = [...index.matchAll(/(?:src|href)="(\\.\\/[^"#?]+)(?:\\?[^"]*)?"/g)].map(m => m[1]);'
)
test.write_text(t, encoding="utf-8")

package = root / "package.json"
p = package.read_text(encoding="utf-8").replace('"version": "6.1.0"', '"version": "6.1.1"')
package.write_text(p, encoding="utf-8")

boot = root / "src" / "core" / "boot.js"
b = boot.read_text(encoding="utf-8").replace("6.1.0", "6.1.1")
boot.write_text(b, encoding="utf-8")
print("Cache bust 6.1.1 applied")
