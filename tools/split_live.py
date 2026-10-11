"""One-off recovery: split a published Platform page into editable source files.

Usage: python3 tools/split_live.py live/<page>.html
Writes src/page.html (the page with include markers) plus src/css, src/vendor,
src/store.js and src/app.js. build.py reassembles them.
"""
import os, re, sys

WRAP_END = '</body></html>'
src = open(sys.argv[1], encoding='utf-8').read()

# The artifact host wraps the published page in its own skeleton; keep only ours.
start = src.find('<!doctype html>', 10)
assert start > 0 and src.endswith(WRAP_END)
page = src[start:len(src) - len(WRAP_END)]

blocks = []  # (start, end, path)
names = {'ap-v33': 'css/ap-v33.css'}
css_n = 0
for m in re.finditer(r'<(script|style)\b([^>]*)>', page):
    tag, attrs = m.group(1), m.group(2)
    if blocks and m.start() < blocks[-1][1]:
        continue  # match inside a previous block (e.g. text in a comment)
    end = page.find('</%s>' % tag, m.end())
    body = page[m.end():end]
    if tag == 'style':
        css_n += 1
        ident = re.search(r'id="([^"]+)"', attrs)
        path = names.get(ident.group(1)) if ident else 'css/%02d.css' % css_n
    elif 'application/json' in attrs:
        continue  # seed stays inline (it is empty in the live build)
    elif body.startswith('/* Chart.js'):
        path = 'vendor/chart-4.4.1.min.js'
    elif 'V40 Store' in body[:200]:
        path = 'store.js'
    else:
        path = 'app.js'
    blocks.append((m.end(), end, path))

out, pos = [], 0
for s0, e0, path in blocks:
    full = os.path.join('src', path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    assert not os.path.exists(full), full + ' already exists'
    with open(full, 'w', encoding='utf-8', newline='') as f:
        f.write(page[s0:e0])
    out.append(page[pos:s0])
    out.append('@@INCLUDE:%s@@' % path)
    pos = e0
out.append(page[pos:])
with open('src/page.html', 'w', encoding='utf-8', newline='') as f:
    f.write(''.join(out))
print('split into', [b[2] for b in blocks])
