import re, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_pages import extract_by_id, body_of

body = body_of('light/admin-dashboard.html')
sidebar = extract_by_id(body, 'sidebar')
items = []
for m in re.finditer(r'<a id="(nav-[^"]+)"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', sidebar, re.S):
    inner = m.group(3)
    svg = re.search(r'<svg.*?</svg>', inner, re.S)
    label = re.search(r'<span>([^<]*)</span>', inner)
    badge = re.search(r'<span id="([^"]*)" class="badge" data-status="([^"]*)">([^<]*)</span>', inner)
    items.append({
        'id': m.group(1),
        'href': m.group(2),
        'label': label.group(1) if label else '',
        'badge': {'id': badge.group(1), 'status': badge.group(2), 'text': badge.group(3)} if badge else None,
        'svg': re.sub(r'\s+', ' ', svg.group(0)) if svg else '',
    })
print(json.dumps(items, indent=1))

# theme-toggle icons in light vs dark landing
for f in ('light/landing.html', 'dark/landing.html'):
    b = body_of(f)
    m = re.search(r'<a class="pub-theme"[^>]*>(.*?)</a>', b, re.S)
    print(f, '->', re.sub(r'\s+', ' ', m.group(1)) if m else None)
    m2 = re.search(r'<a class="pub-theme"[^>]*aria-label="([^"]*)"', b)
    print('   aria-label:', m2.group(1) if m2 else None)
