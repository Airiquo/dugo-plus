import sys, re
sys.path.insert(0, 'tools')
from csslib import split_top_level_rules

WANT = ['.card', '.chip', '.badge', '.pill', '.btn', '.tab', '.tabs', '.field', '.table',
        '.sparkline', '.dot-meter', '.dot-columns', '.dot-row', '.dot-on', '.dot-off',
        '.dot-axis', '.dot-hot', '.radar', '.row', '.k', '.muted', '.dv', '.cmd', '.sr-only',
        '.dot-map', '.plus', '.app-mark', '.dot-row-value']

for f in ('styles/base.css', 'styles/components.css', 'styles/charts.css', 'styles/shell.css', 'styles/overlays.css', 'styles/pages.css'):
    try:
        txt = open(f).read()
    except FileNotFoundError:
        continue
    printed_header = False
    for r in split_top_level_rules(txt):
        pre = r['prelude'].strip()
        if pre.startswith('@'):
            continue
        sels = [s.strip() for s in pre.split(',')]
        hit = any(re.match(r'^' + re.escape(w) + r'(\b|:|\[|\.|>)', s) for s in sels for w in WANT)
        if hit:
            if not printed_header:
                print(f'######## {f}')
                printed_header = True
            body = re.sub(r'\s+', ' ', r['body']).strip()
            print(f'  {pre}')
            print(f'      {{{body[:220]}}}')
