import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from csslib import extract_style_block, split_top_level_rules
from extract_design_system import classify_rule, rule_properties

css = extract_style_block(open('light/admin-dashboard.html').read())
rules = split_top_level_rules(css)

PATTERNS = ['.muted', '.k,', 'table.table', 'justify-content']
for i, r in enumerate(rules):
    if r['kind'] == 'media':
        continue
    pre = r['prelude'].strip()
    if any(p in pre or p in r['body'][:200] for p in PATTERNS):
        if re.search(r'\.muted|table\.table', pre) or ('justify-content' in r['body'] and '.btn' in pre):
            print(f"[{i:3d}] {classify_rule(r):11s} {pre[:120]}")
            print(f"        {{{r['body'][:300]}}}")
