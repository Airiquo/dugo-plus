import re, subprocess, glob, collections

files = sorted(glob.glob('light/*.html'))
def body_of(p):
    raw = subprocess.check_output(['git', 'show', f'HEAD:{p}'], text=True)
    return raw.split('</style>', 1)[1]

tokens = ['tabs', 'tab', 'table', 'radar', 'drawer', 'toast', 'modal', 'dot-columns',
          'dot-meter', 'dot-row', 'row-between', 'cmd', 'field', 'chip', 'pill', 'badge', 'card']
counts = collections.defaultdict(lambda: collections.Counter())
for p in files:
    b = body_of(p)
    for t in tokens:
        n = len(re.findall(r'class="[^"]*\b%s\b[^"]*"' % re.escape(t), b))
        if n:
            counts[t][p.split('/')[-1]] = n
for t in tokens:
    if counts[t]:
        print(f'{t:14s}', dict(counts[t]))

# print example markup for a few
print('\n=== example: .table ===')
for p in files:
    b = body_of(p)
    m = re.search(r'<table[^>]*class="[^"]*table[^"]*"[^>]*>.*?</table>', b, re.S)
    if m:
        print(p, '->', re.sub(r'\s+', ' ', m.group(0))[:500])
        break

print('\n=== example: .tabs / .tab ===')
for p in files:
    b = body_of(p)
    m = re.search(r'<div class="tabs".*?</div>', b, re.S)
    if m:
        print(p, '->', re.sub(r'\s+', ' ', m.group(0))[:400])
        break

print('\n=== example: .radar ===')
for p in files:
    b = body_of(p)
    m = re.search(r'<svg[^>]*class="[^"]*radar[^"]*".*?</svg>', b, re.S)
    if m:
        print(p, '->', re.sub(r'\s+', ' ', m.group(0))[:800])
        break

print('\n=== example: .dot-columns ===')
for p in files:
    b = body_of(p)
    m = re.search(r'<div class="dot-columns".*?(?=<div class="dot-columns"|</section>)', b, re.S)
    if m:
        print(p, '->', re.sub(r'\s+', ' ', m.group(0))[:600])
        break

print('\n=== example: .dot-meter ===')
for p in files:
    b = body_of(p)
    m = re.search(r'<div class="dot-meter"[^>]*>.*?</div>\s*</div>', b, re.S)
    if m:
        print(p, '->', re.sub(r'\s+', ' ', m.group(0))[:500])
        break

print('\n=== example: .toast ===')
for p in files:
    b = body_of(p)
    m = re.search(r'<div[^>]*toast[^>]*>.*?</div>\s*</div>', b, re.S)
    if m:
        print(p, '->', re.sub(r'\s+', ' ', m.group(0))[:400])
        break

print('\n=== example: .modal / drawer ===')
for p in files:
    b = body_of(p)
    m = re.search(r'<div id="[^"]*(modal|drawer|backdrop)[^"]*"[^>]*>.*?</div>\s*</div>\s*</div>', b, re.S)
    if m:
        print(p, '->', re.sub(r'\s+', ' ', m.group(0))[:600])
        break
