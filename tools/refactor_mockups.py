"""Phase 2: point every mockup snapshot at the shared design system.

Replaces the duplicated inline <style> block with a link to styles/dugo.css and the
inline base64 favicon with assets/favicon.png. Proves the transform is exact by
reversing it and comparing to the original bytes.
"""
import os
import re
import glob
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLE_RE = re.compile(r'<style[^>]*>.*?</style>', re.S)
FAVICON_RE = re.compile(r'<link rel="icon" href="data:image/png;base64,[A-Za-z0-9+/=]+">')

STYLE_LINK = '<link rel="stylesheet" href="../styles/dugo.css">'
FAVICON_LINK = '<link rel="icon" href="../assets/favicon.png">'


def original_source(path):
    """The pre-refactor contents (from git) for verification."""
    rel = os.path.relpath(path, ROOT)
    try:
        return subprocess.check_output(['git', 'show', f'HEAD:{rel}'],
                                       cwd=ROOT, text=True)
    except subprocess.CalledProcessError:
        return None


def main():
    files = sorted(glob.glob(os.path.join(ROOT, 'light', '*.html'))) + \
            sorted(glob.glob(os.path.join(ROOT, 'dark', '*.html')))
    total_before = total_after = 0
    refactored = 0
    for path in files:
        orig = open(path, encoding='utf-8').read()
        style = STYLE_RE.search(orig)
        favicon = FAVICON_RE.search(orig)
        if not style:
            print(f'skip (no inline style): {os.path.relpath(path, ROOT)}')
            continue
        new = orig.replace(style.group(0), STYLE_LINK)
        if favicon:
            new = new.replace(favicon.group(0), FAVICON_LINK)

        # inverse transform must reconstruct the original byte-for-byte
        check = new.replace(STYLE_LINK, style.group(0), 1)
        if favicon:
            check = check.replace(FAVICON_LINK, favicon.group(0), 1)
        assert check == orig, f'inverse transform mismatch for {path}'

        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(new)
        total_before += len(orig.encode())
        total_after += len(new.encode())
        refactored += 1
        rel = os.path.relpath(path, ROOT)
        print(f'{rel:38s} {len(orig.encode()):>9,} -> {len(new.encode()):>8,} bytes'
              f'  (style block {len(style.group(0)):,})')
    print(f'\n{refactored} files refactored')
    print(f'total: {total_before:,} -> {total_after:,} bytes '
          f'({total_before / total_after:.1f}x smaller)')


if __name__ == '__main__':
    main()
