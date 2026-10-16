import re, glob, collections, subprocess


def body_of(path):
    rel = path
    raw = subprocess.check_output(['git', 'show', f'HEAD:{rel}'], text=True)
    return raw.split('</style>', 1)[1]


issues = collections.Counter()
samples = collections.defaultdict(list)
for f in sorted(glob.glob('light/*.html')) + sorted(glob.glob('dark/*.html')):
    body = body_of(f)
    for pat, name in [
        (r'\sstyle="', 'inline style='),
        (r'\svalue="', 'value='),
        (r'\s(checked|selected|disabled|required|open|hidden|readonly)\b', 'boolean attr'),
        (r'<textarea', 'textarea'),
        (r'<select', 'select'),
        (r'xmlns', 'xmlns'),
        (r'xlink', 'xlink'),
        (r'[a-zA-Z-]+="[^"]*[{}][^"]*"', 'braces in attr value'),
        (r'&quot;', '&quot;'),
        (r'<img', 'img'),
        (r'<br', 'br'),
        (r'<hr', 'hr'),
        (r'<svg[^>]*>', 'svg'),
        (r'\sdata-[a-z-]+="', 'data-attr'),
        (r'\saria-[a-z-]+="', 'aria-attr'),
        (r'<[a-z]+[^>]*/>', 'self-closing'),
        (r'<!--', 'comment'),
    ]:
        m = re.findall(pat, body)
        if m:
            issues[name] += len(m)
            if len(samples[name]) < 3:
                samples[name].append(re.findall(pat + r'[^>]{0,0}', body)[:1] or m[:1])

for k, v in issues.most_common():
    print(f'{k:22s} {v}')
print()
for k in ('inline style=', 'boolean attr', 'value=', 'braces in attr value', '&quot;', 'self-closing', 'textarea'):
    print(k, '->', samples.get(k))
# svg attribute names used, that need camelCasing
svgattrs = collections.Counter()
for f in sorted(glob.glob('light/*.html')):
    body = body_of(f)
    for m in re.finditer(r'<[a-z]+([^>]*)>', body):
        for a in re.findall(r'\s([a-zA-Z-]+)=', m.group(1)):
            if '-' in a:
                svgattrs[a] += 1
print()
print('hyphenated attributes used:', dict(svgattrs))
