import re, sys, os, subprocess
sys.path.insert(0, 'tools')

raw = subprocess.check_output(['git', 'show', 'HEAD:light/admin-dashboard.html'], text=True)
dash = raw.split('</style>', 1)[1]
raw2 = subprocess.check_output(['git', 'show', 'HEAD:light/admin-blood-requests.html'], text=True)
req = raw2.split('</style>', 1)[1]
raw3 = subprocess.check_output(['git', 'show', 'HEAD:light/admin-inventory.html'], text=True)
inv = raw3.split('</style>', 1)[1]
raw4 = subprocess.check_output(['git', 'show', 'HEAD:light/admin-reports.html'], text=True)
rep = raw4.split('</style>', 1)[1]

def show(name, body, pattern, n=3, span=260):
    print(f'--- {name} ({pattern})')
    found = list(re.finditer(pattern, body, re.S))[:n]
    for m in found:
        print('   ', re.sub(r'\s+', ' ', m.group(0))[:span])
    print()

show('tabs', req, r'<div class="tabs".*?</div>\s*</div>', 2, 400)
show('field forms', req, r'<form class="field[^"]*"[^>]*>.*?</form>', 2, 320)
show('select', req, r'<select[^>]*>.*?</select>', 2, 320)
show('table', inv, r'<table class="table".*?</table>', 1, 700)
show('sparkline', dash, r'<svg class="sparkline".*?</svg>', 2, 400)
show('card generic', inv, r'<section class="card".*?</section>', 1, 400)
show('dot meter etc', rep, r'<div class="[^"]*dot[^"]*"[^>]*>.*?</div>', 3, 400)
show('radar', rep, r'<svg[^>]*radar[^>]*>.*?</svg>', 1, 600)
show('drawer', req, r'<div[^>]*drawer[^>]*>.*?</div></div>', 1, 500)
show('kpi card', dash, r'<div id="kpi-[^"]*" class="card">.*?</div></section>|<div id="kpi-[^"]*" class="card">.*?</div><div', 1, 700)
print("=== classes present in dashboard ===")
classes = sorted(set(re.findall(r'class="([^"]+)"', dash)))
allc = set()
for c in classes:
    for part in c.split():
        allc.add(part)
print(' '.join(sorted(allc)))
