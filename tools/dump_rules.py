"""Dump the top-level rule inventory of the shared mockup stylesheet (for classification)."""
import sys, re, collections
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from csslib import extract_style_block, split_top_level_rules

css = extract_style_block(open('light/admin-dashboard.html').read())
rules = split_top_level_rules(css)

print('total top-level entries:', len(rules))
print(collections.Counter(r['kind'] for r in rules))

# Reassemble + byte-compare as sanity check
def reassemble(rs):
    return ''.join(r['text'] for r in rs)

print('roundtrip identical:', reassemble(rules) == css)

idx = 0
for r in rules:
    idx += 1
    if r['kind'] == 'media':
        inner = split_top_level_rules(r['body'])
        print(f"{idx:3d} MEDIA {r['prelude'].strip()[:60]}  ({len(inner)} inner)")
        for ir in inner:
            print(f"        - {ir['prelude'].strip()[:110]}")
    elif r['kind'].startswith('atrule'):
        print(f"{idx:3d} AT    {r['prelude'].strip()[:110]}")
    else:
        print(f"{idx:3d} RULE  {r['prelude'].strip()[:150]}")
