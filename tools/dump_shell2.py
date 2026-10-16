import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_pages import extract_by_id, body_of

body = body_of('light/admin-dashboard.html')
shell = extract_by_id(body, 'app-shell')
# show only top-level structure of app-shell
print("=== app-shell full skeleton (tags only, truncated) ===")
skel = re.sub(r'>[^<]+<', '><', shell)
print(skel[:900])
print()
print("=== direct children of #app-shell ===")
# simple depth-1 scan
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
depth = 0
for m in re.finditer(r'</?([A-Za-z][\w:-]*)((?:"[^"]*"|[^>"])*)>', shell):
    closing = m.group(0).startswith('</')
    name = m.group(1)
    if closing:
        depth -= 1
    else:
        if depth == 0:
            print("   ", m.group(0)[:130])
        if name not in VOID and not m.group(2).rstrip().endswith('/'):
            depth += 1
print()
print("=== :root tokens sample ===")
raw = body_of('light/admin-dashboard.html')
print("head has nothing relevant")
