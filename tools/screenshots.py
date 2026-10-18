#!/usr/bin/env python3
"""Render every mockup to a JPEG for the README.

Maintainer tool — the app neither needs nor imports it. Screenshots are
documentation, so they go stale as soon as a mockup changes: re-run this after
touching `light/`, `dark/` or `styles/`.

    pip3 install --user playwright pillow
    python3 -m playwright install chromium
    python3 tools/screenshots.py                 # every screen, both themes
    python3 tools/screenshots.py landing         # just one screen

Output: `docs/screenshots/<theme>/<screen>.jpg`, 1200px wide, JPEG q82. Captures
happen at 2x and are downsampled, which keeps text crisp at the smaller width.
"""

import io
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parent.parent
THEMES = ('light', 'dark')
OUT_DIR = REPO / 'docs' / 'screenshots'

VIEWPORT = {'width': 1600, 'height': 1000}
SCALE = 2  # capture at 2x, then downsample to OUTPUT_WIDTH
OUTPUT_WIDTH = 1200
JPEG_QUALITY = 82


def screens():
    """Every screen in light/, in a stable order, as `(name, {theme: path})`."""
    found = []
    for path in sorted((REPO / 'light').glob('*.html')):
        name = path.stem
        found.append((name, {theme: REPO / theme / f'{name}.html' for theme in THEMES}))
    return found


def capture(page, html_path, theme):
    """Screenshot one mockup full-page, downsampled, as JPEG bytes."""
    page.goto(html_path.as_uri(), wait_until='load')
    page.evaluate('document.fonts.ready')  # self-hosted webfonts must be painted
    actual = page.evaluate('document.documentElement.dataset.theme')
    if actual != theme:
        raise SystemExit(f'{html_path.name}: expected data-theme="{theme}", got "{actual}"')
    raw = page.screenshot(full_page=True, type='png')

    image = Image.open(io.BytesIO(raw))
    image = image.resize(
        (OUTPUT_WIDTH, round(image.height * OUTPUT_WIDTH / image.width)), Image.LANCZOS
    )
    out = io.BytesIO()
    image.convert('RGB').save(out, format='JPEG', quality=JPEG_QUALITY, optimize=True)
    return out.getvalue(), image.size


def main(argv):
    wanted = set(argv[1:])
    found = screens()
    names = [name for name, _ in found]

    if not names:
        print('no mockups found in light/', file=sys.stderr)
        return 1
    unknown = wanted - set(names)
    if unknown:
        print(f'unknown screen(s): {", ".join(sorted(unknown))}', file=sys.stderr)
        print(f'available: {", ".join(names)}', file=sys.stderr)
        return 1

    selected = [(name, themed) for name, themed in found if not wanted or name in wanted]
    missing = [
        f'{theme}/{name}.html'
        for name, themed in selected
        for theme, path in themed.items()
        if not path.exists()
    ]
    if missing:
        print(f'missing light/dark counterpart: {", ".join(missing)}', file=sys.stderr)
        return 1

    written = 0
    total = 0
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport=VIEWPORT, device_scale_factor=SCALE)
        try:
            for name, themed in selected:
                for theme in THEMES:
                    data, size = capture(page, themed[theme], theme)
                    target = OUT_DIR / theme / f'{name}.jpg'
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data)
                    written += 1
                    total += len(data)
                    rel = target.relative_to(REPO)
                    print(f'  {rel}  {size[0]}x{size[1]}  {len(data) / 1024:.0f} KB')
        finally:
            browser.close()

    print(f'\n{written} images, {total / 1024 / 1024:.1f} MB total in docs/screenshots/')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
