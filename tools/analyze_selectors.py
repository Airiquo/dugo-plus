"""Analyze selector inventory: which ids/classes in CSS belong to landing vs admin pages."""
import sys, re, collections, glob
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from csslib import extract_style_block, split_top_level_rules

css = extract_style_block(open('light/admin-dashboard.html').read())
rules = split_top_level_rules(css)

def preludes(rs, acc):
    for r in rs:
        if r['kind'] == 'media':
            preludes(split_top_level_rules(r['body']), acc)
        elif r['kind'] in ('rule', 'atrule-block'):
            acc.append(r['prelude'])

acc = []
preludes(rules, acc)
prelude_blob = '\n'.join(acc)

css_ids = set(re.findall(r'#([A-Za-z][\w+-]*)', prelude_blob))
css_classes = set(re.findall(r'\.([A-Za-z][\w-]*)', prelude_blob))

def html_ids_classes(path):
    s = open(path).read().split('</style>', 1)[1]
    ids = set(re.findall(r'id="([^"]+)"', s))
    classes = set()
    for m in re.finditer(r'class="([^"]+)"', s):
        classes.update(m.group(1).split())
    return ids, classes

landing_ids, landing_cls = html_ids_classes('light/landing.html')
admin_ids, admin_cls = set(), set()
for f in glob.glob('light/admin-*.html'):
    i, c = html_ids_classes(f)
    admin_ids |= i
    admin_cls |= c

# normalize ids: CSS may use id prefixes; compare on full id and prefix
print('== CSS ids (%d) ==' % len(css_ids))
landing_only_ids = sorted(x for x in css_ids if x in landing_ids and x not in admin_ids)
admin_only_ids = sorted(x for x in css_ids if x in admin_ids and x not in landing_ids)
both_ids = sorted(x for x in css_ids if x in landing_ids and x in admin_ids)
unknown_ids = sorted(x for x in css_ids if x not in landing_ids and x not in admin_ids)
print('landing-only ids in CSS:', landing_only_ids)
print('admin-only ids in CSS (%d):' % len(admin_only_ids), admin_only_ids)
print('shared ids in CSS:', both_ids)
print('CSS ids not found as exact HTML id (prefixes/wildcards):', unknown_ids)

print()
print('== CSS classes (%d) ==' % len(css_classes))
print('landing-only classes:', sorted(x for x in css_classes if x in landing_cls and x not in admin_cls))
print('shared classes:', sorted(x for x in css_classes if x in landing_cls and x in admin_cls))
print('unknown classes:', sorted(x for x in css_classes if x not in landing_cls and x not in admin_cls))

# element-only selectors
print()
print('== element-ish top-level rules ==')
for r in rules:
    if r['kind'] == 'rule' and not re.search(r'[.#\[]', r['prelude']):
        print('   ', r['prelude'].strip()[:120])
