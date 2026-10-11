"""Build the single-file Platform page from src/.

Usage: python3 build.py [out.html]      (default: dist/Julphar_Platform.html)
"""
import hashlib, os, re, sys

def build():
    page = open('src/page.html', encoding='utf-8').read()
    def inc(m):
        return open(os.path.join('src', m.group(1)), encoding='utf-8', newline='').read()
    out = re.sub(r'@@INCLUDE:([\w./-]+)@@', inc, page)
    assert '@@INCLUDE:' not in out
    return out

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'dist/Julphar_Platform.html'
    os.makedirs(os.path.dirname(target) or '.', exist_ok=True)
    html = build()
    with open(target, 'w', encoding='utf-8', newline='') as f:
        f.write(html)
    print(target, len(html.encode('utf-8')), 'bytes sha256', hashlib.sha256(html.encode('utf-8')).hexdigest()[:16])
