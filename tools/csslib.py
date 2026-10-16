"""Shared CSS parsing helpers for the Dugo+ design-system extraction tools."""
import re


def extract_style_block(html: str) -> str:
    m = re.search(r'<style[^>]*>(.*?)</style>', html, re.S)
    if not m:
        raise ValueError('no <style> block found')
    return m.group(1)


def split_top_level_rules(css: str):
    """Split CSS into top-level rules, preserving raw text verbatim.

    Returns a list of dicts: {'kind': 'rule'|'atrule'|'media', 'text': raw,
    'prelude': str, 'body': str (inner for rule/media, None for atrule)}.
    Handles strings, comments, and nested braces inside @media blocks.
    """
    rules = []
    i, n = 0, len(css)
    pending = ''  # whitespace/comments preceding the next rule (preserved verbatim)
    while i < n:
        # skip whitespace and comments, keeping them as pending prefix text
        while True:
            ws_start = i
            while i < n and css[i] in ' \t\r\n':
                i += 1
            if css.startswith('/*', i):
                j = css.find('*/', i + 2)
                if j == -1:
                    i = n
                    break
                i = j + 2
                pending += css[ws_start:i]
                continue
            pending += css[ws_start:i]
            break
        if i >= n:
            break
        start = i
        prefix = pending
        pending = ''
        # read prelude until '{' (rule) or ';' (statement at-rule)
        prelude_start = i
        in_str = None
        depth_paren = 0
        while i < n:
            c = css[i]
            if in_str:
                if c == '\\':
                    i += 2
                    continue
                if c == in_str:
                    in_str = None
                i += 1
                continue
            if c in '"\'':
                in_str = c
            elif c == '(':
                depth_paren += 1
            elif c == ')':
                depth_paren -= 1
            elif c == ';' and depth_paren == 0:
                break
            elif c == '{' and depth_paren == 0:
                break
            elif css.startswith('/*', i):
                j = css.find('*/', i + 2)
                i = (j + 2) if j != -1 else n
                continue
            i += 1
        if i >= n:
            break
        prelude = css[prelude_start:i]
        if css[i] == ';':  # statement at-rule (@import, @charset...)
            raw = prefix + css[start:i + 1]
            rules.append({'kind': 'atrule', 'text': raw, 'prelude': prelude, 'body': None})
            i += 1
            continue
        # read balanced block
        depth = 1
        body_start = i + 1
        i += 1
        in_str = None
        while i < n and depth > 0:
            c = css[i]
            if in_str:
                if c == '\\':
                    i += 2
                    continue
                if c == in_str:
                    in_str = None
                i += 1
                continue
            if c in '"\'':
                in_str = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
            elif css.startswith('/*', i):
                j = css.find('*/', i + 2)
                i = (j + 2) if j != -1 else n
                continue
            i += 1
        body = css[body_start:i - 1]
        raw = prefix + css[start:i]
        prelude_stripped = prelude.strip()
        if prelude_stripped.startswith('@media') or prelude_stripped.startswith('@supports'):
            rules.append({'kind': 'media', 'text': raw, 'prelude': prelude, 'body': body})
        elif prelude_stripped.startswith('@'):
            rules.append({'kind': 'atrule-block', 'text': raw, 'prelude': prelude, 'body': body})
        else:
            rules.append({'kind': 'rule', 'text': raw, 'prelude': prelude, 'body': body})
    if pending and rules:
        rules[-1]['text'] += pending
    return rules


FONT_URL_RE = re.compile(r'url\(data:font/[^;]+;base64,([A-Za-z0-9+/=]+)\)')


def parse_font_faces(rules):
    """Return list of {family, weight, style, raw_rule, base64} for @font-face rules."""
    out = []
    for r in rules:
        if r['kind'] != 'atrule-block' or not r['prelude'].strip().startswith('@font-face'):
            continue
        body = r['body']
        fam = re.search(r'font-family:\s*([^;]+);', body)
        wt = re.search(r'font-weight:\s*([^;]+);', body)
        st = re.search(r'font-style:\s*([^;]+);', body)
        m = FONT_URL_RE.search(body)
        out.append({
            'family': fam.group(1).strip() if fam else '?',
            'weight': wt.group(1).strip() if wt else 'normal',
            'style': st.group(1).strip() if st else 'normal',
            'raw': r['text'],
            'base64': m.group(1) if m else None,
        })
    return out
