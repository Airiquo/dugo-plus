import re, subprocess, glob

def body_of(p):
    raw = subprocess.check_output(['git', 'show', f'HEAD:{p}'], text=True)
    return raw.split('</style>', 1)[1]

def find(p, pat, n=2, span=600):
    b = body_of(p)
    out = []
    for m in list(re.finditer(pat, b, re.S))[:n]:
        out.append(re.sub(r'\s+', ' ', m.group(0))[:span])
    return out

print('== inventory tab container ==')
for s in find('light/admin-inventory.html', r'.{120}class="tab[^"]*".{300}', 3):
    print('  ', s)
print('== landing tabs ==')
for s in find('light/landing.html', r'<div class="tabs".*?</div>', 1, 500):
    print('  ', s)
print('== field usage (donor-registry) ==')
for s in find('light/admin-donor-registry.html', r'<label[^>]*class="field".*?</label>|<div class="field">.*?</div>', 3, 320):
    print('  ', s)
print('== field usage (blood-requests filters) ==')
for s in find('light/admin-blood-requests.html', r'<div id="requests-filters".*?</div>\s*</div>', 1, 1200):
    print('  ', s)
print('== dot-row (dashboard) ==')
for s in find('light/admin-dashboard.html', r'<div class="dot-row">.*?</div></div>', 2, 320):
    print('  ', s)
print('== dot-columns (dashboard) ==')
for s in find('light/admin-dashboard.html', r'<div class="dot-columns">.{0,1400}', 1, 1400):
    print('  ', s)
print('== page-header with actions (blood-requests) ==')
for s in find('light/admin-blood-requests.html', r'<div id="page-header">.*?</div></div></div>', 1, 800):
    print('  ', s)
print('== drawer (blood-requests new-request) ==')
for s in find('light/admin-blood-requests.html', r'<div id="new-request-backdrop".{0,1600}', 1, 1600):
    print('  ', s)
print('== toast usage ==')
for p in glob.glob('light/*.html'):
    b = body_of(p)
    m = re.search(r'<div id="toast-root">.*?</div></div></div>', b, re.S)
    if m and len(m.group(0)) > 40:
        print('  ', p, re.sub(r'\s+', ' ', m.group(0))[:600])
