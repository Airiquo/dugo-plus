"""Phase 1: extract the shared mockup stylesheet into a real design system.

Reads the inline <style> block from the mockups (byte-identical across all 20 files),
splits its rules verbatim into section files under styles/, decodes the embedded
fonts to files under fonts/, and writes a shared favicon.

Deterministic + verified:
  * rule texts are moved verbatim (checked by multiset comparison)
  * fonts round-trip against the original base64
  * cross-section cascade tie report (same-specificity rules whose order changed)
"""
import base64
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from csslib import extract_style_block, split_top_level_rules, parse_font_faces

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'light', 'admin-dashboard.html')

# ---------------------------------------------------------------- classification

SHELL_RE = re.compile(
    r'#(?:root|app-shell|sidebar[\w-]*|nav-[\w-]+|topbar[\w-]*|page-(?:header|body|content|title|tag|actions|divider))\b')
OVERLAY_RE = re.compile(
    r'(?:#(?:[\w-]*(?:drawer|modal|backdrop|toast|overlay)[\w-]*|overlay-root|toast-root)|'
    r'\.(?:overlay-panel|modal|toast|scrim|drawer|backdrop)\b|\[id\$=-drawer\]|#discard-dialog\b)')
CHART_CLS = ('sparkline', 'dot-on', 'dot-off', 'dot-hot', 'dot-axis', 'dot-map', 'dot-columns',
             'dot-row', 'dot-meter', 'dot-row-value', 'dot-ph', 'radar', 'radar-dot', 'radar-ring',
             'radar-sweep', 'radar-center', 'radar-hot', 'radar-label', 'chart-box',
             'donations-by-type-bar')
CHART_RE = re.compile(r'\.' + r'|\.'.join(re.escape(c) for c in CHART_CLS) + r'\b')
ELEMENT_ONLY = re.compile(r'^[^.#\[]*$')


def classify_selector(sel: str) -> str:
    """Category for a single (comma-split) sub-selector."""
    if re.search(r'\.pub\b', sel):
        return 'public'
    # co-location: table + label/heading groups interleave with shell/overlay
    # rules in the original sheet, so keep each group in one file (components)
    # to preserve their relative order (and therefore the cascade).
    if re.search(r'table\.table\b|\.table-scroll\b', sel):
        return 'components'
    if re.search(r'\.k\b|\.muted\b', sel):
        return 'components'
    if OVERLAY_RE.search(sel):
        return 'overlays'
    if SHELL_RE.search(sel):
        return 'shell'
    if CHART_RE.search(sel):
        return 'charts'
    # element-only rules: form controls belong with components, the rest with base
    stripped = sel.strip()
    if ELEMENT_ONLY.match(stripped) and not stripped.startswith('@'):
        if re.match(r'^(input|select|textarea|button|option|fieldset|label)\b', stripped):
            return 'components'
        return 'base'
    # any remaining id selector => page-specific markup
    if '#' in sel:
        return 'pages'
    return 'components'


def classify_rule(rule) -> str:
    """Category for a whole top-level (or media-inner) rule."""
    prelude = rule['prelude'].strip()
    if prelude.startswith('@font-face'):
        return 'fonts'
    if prelude.startswith('@keyframes'):
        return 'base'
    if rule['kind'] == 'rule' and prelude.startswith(':root'):
        body = rule['body'].lstrip()
        if body.startswith('--'):          # token definition block
            return 'tokens'
        return 'base'                      # :root usage (font/color)
    if rule['kind'] != 'rule':
        return 'components'
    cats = []
    for sel in split_selector_list(prelude):
        c = classify_selector(sel)
        if c not in cats:
            cats.append(c)
    # highest-priority category wins when a rule spans several
    for pref in ('public', 'overlays', 'shell', 'pages', 'charts', 'tokens'):
        if pref in cats:
            return pref
    if 'components' in cats:   # mixed element+component rules co-locate with components
        return 'components'
    if 'base' in cats:
        return 'base'
    return 'components'


def split_selector_list(prelude: str):
    """Split a prelude on top-level commas (ignores commas inside () and [])."""
    out, depth, cur = [], 0, []
    for ch in prelude:
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(''.join(cur))
            cur = []
        else:
            cur.append(ch)
    out.append(''.join(cur))
    return [s.strip() for s in out if s.strip()]


def specificity(sel: str):
    """(ids, classes, elements) heuristic; lower tuple compares first."""
    s = re.sub(r'\([^)]*\)', '', sel)              # strip :is(...)/:not(...) args
    ids = len(re.findall(r'#[\w-]+', s))
    classes = len(re.findall(r'\.[\w-]+', s)) + len(re.findall(r'\[[^\]]*\]', s))
    classes += len(re.findall(r':(?!:)[\w-]+', s))
    elements = len(re.findall(r'(?:^|[\s>+~])([a-zA-Z][\w-]*)', s))
    elements += len(re.findall(r'::[\w-]+', s))
    return (ids, classes, elements)


# ---------------------------------------------------------------- fonts

def decode_fonts(font_faces, fonts_dir):
    """Decode embedded base64 fonts to files. Returns list of rewritten @font-face texts."""
    os.makedirs(fonts_dir, exist_ok=True)
    used, out = set(), []
    for f in font_faces:
        if not f['base64']:
            raise ValueError('font without base64 payload: %r' % f)
        data = base64.b64decode(f['base64'])
        # round-trip proof
        assert base64.b64encode(data).decode() == f['base64'], 'font base64 mismatch'
        m = re.search(r'url\(data:(font/[\w+]+);base64,', f['raw'])
        mime = m.group(1)
        ext = 'woff2' if mime.endswith('woff2') else 'woff'
        fam = re.sub(r'[^A-Za-z0-9]+', '', f['family'])
        wt = re.sub(r'[^0-9]+', '-', f['weight']).strip('-') or 'normal'
        name = f'{fam}-{wt}.{ext}'
        base = name
        n = 2
        while name in used:
            name = base.replace(f'.{ext}', f'-{n}.{ext}')
            n += 1
        used.add(name)
        with open(os.path.join(fonts_dir, name), 'wb') as fh:
            fh.write(data)
        rewritten = re.sub(r'url\(data:font/[^;]+;base64,[A-Za-z0-9+/=]+\)',
                           f'url(../fonts/{name})', f['raw'])
        out.append((name, len(data), rewritten))
    return out


# ---------------------------------------------------------------- ordering

SECTIONS = ['fonts', 'tokens', 'base', 'shell', 'components', 'charts',
            'overlays', 'public', 'pages']


def assign_positions(rules, positions, cats_seen, idx=[0]):
    """Walk rules; fill positions[cat] = list of (orig_index, rule) (media inner rules
    keep their media's index). Returns per-rule classification structure for writing."""
    struct = []
    for r in rules:
        i = idx[0]
        idx[0] += 1
        if r['kind'] == 'media':
            inner = split_top_level_rules(r['body'])
            groups = {}   # cat -> [inner raw texts] in original order
            order = []
            for ir in inner:
                c = classify_rule(ir)
                groups.setdefault(c, []).append(ir['text'])
                if c not in order:
                    order.append(c)
                positions.setdefault(c, []).append(i)
                cats_seen.setdefault(c, []).append(i)
            prefix = r['text'][:len(r['text']) - len(r['prelude']) - len(r['body']) - 2]
            struct.append({'kind': 'media', 'prelude': r['prelude'], 'prefix': prefix,
                           'raw': r['text'],
                           'groups': [(c, ''.join(groups[c])) for c in order]})
        else:
            c = classify_rule(r)
            positions.setdefault(c, []).append(i)
            cats_seen.setdefault(c, []).append(i)
            struct.append({'kind': 'plain', 'cat': c, 'text': r['text']})
    return struct


def rule_properties(body):
    """Set of property names declared in a rule body."""
    if not body:
        return set()
    props = set()
    for decl in re.split(r'[;{}]', body):
        decl = decl.strip()
        if not decl or decl.startswith('/*'):
            continue
        m = re.match(r'^(--[\w-]+|[\w-]+)\s*:', decl)
        if m:
            props.add(m.group(1))
    return props


def tie_report(rules):
    """List same-specificity cross-category rule pairs whose order may flip,
    restricted to pairs that share at least one property (the only ones that
    can actually conflict)."""
    entries = []  # (index, category, [(spec, subselector)], prelude, props)
    for i, r in enumerate(rules):
        if r['kind'] == 'media':
            inner = split_top_level_rules(r['body'])
            for ir in inner:
                c = classify_rule(ir)
                specs = [(specificity(s), s) for s in split_selector_list(ir['prelude'])]
                entries.append((i, c, specs, ir['prelude'].strip()[:70],
                                rule_properties(ir['body'])))
        else:
            c = classify_rule(r)
            specs = [(specificity(s), s) for s in split_selector_list(r['prelude'])]
            entries.append((i, c, specs, r['prelude'].strip()[:70],
                            rule_properties(r['body'])))
    return entries


def rightmost_compound(sel):
    """Last compound selector (after the rightmost top-level combinator)."""
    depth, last = 0, 0
    for i, ch in enumerate(sel):
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        elif ch in ' >+~' and depth == 0:
            last = i + 1
    return sel[last:].strip()


def ancestor_ids(sel):
    """IDs mentioned outside the rightmost compound (i.e. required ancestors)."""
    cut = len(sel) - len(rightmost_compound(sel))
    return set(re.findall(r'#([\w-]+)', sel[:cut]))


def dom_ancestor_chains(paths):
    """For every element in the mockups: the set of ids on its ancestor chain."""
    from html.parser import HTMLParser
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
            'meta', 'param', 'source', 'track', 'wbr'}

    chains = []

    class Parser(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.stack = []

        def handle_starttag(self, tag, attrs):
            if tag in VOID:
                ids = {x for x in self.stack if x} | ({dict(attrs)['id']} if 'id' in dict(attrs) else set())
                chains.append(ids)
                return
            self.stack.append(dict(attrs).get('id'))
            chains.append({x for x in self.stack if x})

        def handle_endtag(self, tag):
            if tag in VOID:
                return
            if self.stack:
                self.stack.pop()

    for path in paths:
        p = Parser()
        p.feed(open(path, encoding='utf-8').read())
    return chains


def exclusive_ancestors(chain_sets, a_ids, b_ids):
    """True when no element in the DOM can sit under both id sets."""
    if not a_ids or not b_ids:
        return False
    for chain in chain_sets:
        if a_ids <= chain and b_ids <= chain:
            return False
    return True


def rightmost_key(sel):
    """Normalized rightmost compound — two rules with the same key and the same
    specificity can match the same element (and therefore collide)."""
    return re.sub(r'\s+', ' ', rightmost_compound(sel))


def pair_weight(ea, eb):
    """Conflict weight between two rules: #subselector pairs with equal
    specificity, identical rightmost compound, and a shared property."""
    if not (ea[4] & eb[4]):
        return 0
    w = 0
    for sa, sela in ea[2]:
        for sb, selb in eb[2]:
            if sa == sb and rightmost_key(sela) == rightmost_key(selb):
                w += 1
    return w


def optimize_order(entries, fixed_first):
    """Find section order minimizing flipped conflicting ties (hill climbing on
    adjacent swaps; `fixed_first` sections stay pinned at the head)."""
    cats = sorted({e[1] for e in entries})
    head = [c for c in fixed_first if c in cats]
    free = [c for c in cats if c not in head]
    free.sort(key=lambda c: min(e[0] for e in entries if e[1] == c))

    pairs = []
    for a in range(len(entries)):
        for b in range(a + 1, len(entries)):
            ea, eb = entries[a], entries[b]
            if ea[1] == eb[1]:
                continue
            w = pair_weight(ea, eb)
            if w:
                pairs.append((ea, eb, w))

    def cost(order):
        rank = {c: n for n, c in enumerate(order)}
        total = 0
        for ea, eb, w in pairs:
            if (rank[ea[1]] > rank[eb[1]]) == (ea[0] < eb[0]):
                total += w
        return total

    order = head + free
    improved = True
    while improved:
        improved = False
        best = cost(order)
        for i in range(len(order) - 1):
            cand = order[:]
            cand[i], cand[i + 1] = cand[i + 1], cand[i]
            c = cost(cand)
            if c < best:
                best, order, improved = c, cand, True
    return order, cost(order), len(pairs), sum(p[2] for p in pairs)


def main():
    html = open(SOURCE, encoding='utf-8').read()
    css = extract_style_block(html)
    rules = split_top_level_rules(css)
    print(f'source rules: {len(rules)}')

    # ---- fonts
    faces = parse_font_faces(rules)
    fonts_dir = os.path.join(ROOT, 'fonts')
    font_out = decode_fonts(faces, fonts_dir)
    print(f'fonts decoded: {len(font_out)}')
    for name, size, _ in font_out:
        print(f'   {name:28s} {size:>8,} bytes')

    # ---- favicon
    fav = re.search(r'<link rel="icon" href="data:image/png;base64,([A-Za-z0-9+/=]+)">', html)
    if fav:
        os.makedirs(os.path.join(ROOT, 'assets'), exist_ok=True)
        png = base64.b64decode(fav.group(1))
        with open(os.path.join(ROOT, 'assets', 'favicon.png'), 'wb') as fh:
            fh.write(png)
        print(f'favicon extracted: {len(png):,} bytes')

    # ---- classify + cascade-safe ordering
    positions, seen = {}, {}
    struct = assign_positions(rules, positions, seen)
    entries = tie_report(rules)
    order, residual, npairs, total_w = optimize_order(
        entries, fixed_first=['fonts', 'tokens'])
    rank = {c: n for n, c in enumerate(order)}
    print('\nsection order (cascade-optimized):')
    for c in order:
        print(f'   {c:12s} first@{min(positions[c]) if c in positions else "-"}'
              f'  rules={len(positions.get(c, []))}')
    print(f'\ncascade check: {npairs} conflicting cross-section tie pairs '
          f'(weight {total_w}), residual flipped weight: {residual}')

    import glob
    chains = dom_ancestor_chains(sorted(glob.glob(os.path.join(ROOT, '*', '*.html'))))

    flips, harmless = [], []
    for a in range(len(entries)):
        for b in range(a + 1, len(entries)):
            ea, eb = entries[a], entries[b]
            if ea[1] == eb[1] or not pair_weight(ea, eb):
                continue
            if (rank[ea[1]] > rank[eb[1]]) == (ea[0] < eb[0]):
                identical = any(sa == sb and rightmost_key(sela) == rightmost_key(selb)
                                for sa, sela in ea[2] for sb, selb in eb[2])
                # provably harmless when the required ancestors can never co-occur
                exc = any(exclusive_ancestors(chains, ancestor_ids(sela), ancestor_ids(selb))
                          for sa, sela in ea[2] for sb, selb in eb[2]
                          if sa == sb and rightmost_key(sela) == rightmost_key(selb))
                (harmless if exc else flips).append((identical, ea, eb))
    print(f'   residual flips: {len(flips)} '
          f'(identical-selector: {sum(1 for f in flips if f[0])})')
    for identical, ea, eb in flips[:20]:
        print(f'   {"!!" if identical else "~ "} {ea[3]} [{ea[1]}]  <->  {eb[3]} [{eb[1]}]')
        print(f'        shared properties flipped: {sorted(ea[4] & eb[4])}')
    unaffected = sum(1 for _ in flips)
    for identical, ea, eb in harmless:
        print(f'   ok (mutually exclusive ancestors) {ea[3]} [{ea[1]}] <-> {eb[3]} [{eb[1]}]')
    if flips:
        print('   !! real cascade changes detected — review before proceeding')

    # ---- write section files
    styles_dir = os.path.join(ROOT, 'styles')
    os.makedirs(styles_dir, exist_ok=True)
    written = {c: [] for c in SECTIONS}
    for item in struct:
        if item['kind'] == 'plain':
            written[item['cat']].append(item['text'])
        elif len(item['groups']) == 1:
            # single-category media block: emit the original block verbatim
            c, _ = item['groups'][0]
            written[c].append(item['raw'])
        else:
            for n, (c, txt) in enumerate(item['groups']):
                lead = item['prefix'] if n == 0 else ''
                written[c].append(f"{lead}{item['prelude'].rstrip()}{{{txt}}}")
    # fonts section: rewritten @font-face rules (original order, data URIs -> files)
    written['fonts'] = [t for _, _, t in font_out]

    headers = {
        'fonts': 'dugo+ design system — @font-face (files in ../fonts/)',
        'tokens': 'dugo+ design system — design tokens (--d-*), light + dark via [data-theme]',
        'base': 'dugo+ design system — reset, globals, keyframes',
        'shell': 'dugo+ design system — app shell (#app-shell, sidebar, topbar, page frame)',
        'components': 'dugo+ design system — component vocabulary (.card .chip .btn .field .table …)',
        'charts': 'dugo+ design system — data viz (sparkline, dot-matrix, radar)',
        'overlays': 'dugo+ design system — modals, drawers, toasts, backdrops',
        'public': 'dugo+ design system — public/landing site (.pub-*)',
        'pages': 'dugo+ design system — page-specific layout (#dashboard-*, #requests-* …)',
    }
    for c in SECTIONS:
        body = ''.join(written.get(c, []))
        path = os.path.join(styles_dir, f'{c}.css')
        if written.get(c):
            with open(path, 'w', encoding='utf-8') as fh:
                fh.write(f'/* {headers[c]} */\n{body}')
            print(f'wrote styles/{c}.css ({os.path.getsize(path):,} bytes)')
        elif os.path.exists(path):
            os.remove(path)

    # ---- manifest
    imports = [c for c in order if written.get(c)]
    manifest = ['/* dugo+ design system — single source of truth.',
                '   Import this one file (mockups and React both do).',
                '   Sections are ordered to preserve the cascade of the original',
                '   single-file stylesheet (see tools/extract_design_system.py). */']
    manifest += [f'@import url("{c}.css");' for c in imports]
    with open(os.path.join(styles_dir, 'dugo.css'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(manifest) + '\n')
    print('wrote styles/dugo.css: ' + ' -> '.join(imports))

    # ---- verification: flattened, media-context-aware rule multiset equality
    def norm(t):
        t = re.sub(r'/\*.*?\*/', '', t, flags=re.S)
        return re.sub(r'\s+', ' ', t).strip()

    orig_flat = []
    for r in rules:
        if r['prelude'].strip().startswith('@font-face'):
            continue  # intentionally rewritten to font files
        if r['kind'] == 'media':
            for ir in split_top_level_rules(r['body']):
                orig_flat.append((norm(r['prelude']), norm(ir['text'])))
        else:
            orig_flat.append(('', norm(r['text'])))

    new_flat = []
    for c in imports:
        path = os.path.join(styles_dir, f'{c}.css')
        if c == 'fonts':
            continue
        for r in split_top_level_rules(open(path, encoding='utf-8').read()):
            if r['kind'] == 'media':
                for ir in split_top_level_rules(r['body']):
                    new_flat.append((norm(r['prelude']), norm(ir['text'])))
            else:
                new_flat.append(('', norm(r['text'])))

    same = sorted(orig_flat) == sorted(new_flat)
    print(f'\nVERIFICATION flattened rule multiset identical: {same}  '
          f'(orig {len(orig_flat)} vs new {len(new_flat)})')
    if not same:
        so, sn = set(orig_flat), set(new_flat)
        for x in list(so - sn)[:6]:
            print('  ONLY IN ORIGINAL:', str(x)[:170])
        for x in list(sn - so)[:6]:
            print('  ONLY IN NEW     :', str(x)[:170])
        raise SystemExit(1)
    print('VERIFICATION fonts round-trip: OK (asserted during decode)')


if __name__ == '__main__':
    main()
