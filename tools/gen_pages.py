"""Generate the React page bodies from the mockups (exact markup, converted to JSX).

Outputs:
  web/src/layout/shell.parts.txt   — sidebar + topbar JSX (raw material for AppShell.jsx)
  web/src/pages/DashboardBody.jsx  — <main id="page-content"> inner content  web/src/pages/LandingBody.jsx    — the whole .pub landing markup
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from htmltojsx import convert, strip_scripts, VOID, TAG_RE

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def extract_by_id(html: str, elem_id: str) -> str:
    """Inner HTML of the element carrying the given id."""
    for m in re.finditer(r'<([A-Za-z][\w-]*)((?:"[^"]*"|[^>"])*)>', html):
        if re.search(r'\bid="%s"' % re.escape(elem_id), m.group(2)):
            tag, start, depth = m.group(1), m.end(), 1
            for t in TAG_RE.finditer(html, start):
                if t.group(0).startswith('</'):
                    if t.group(1) == tag:
                        depth -= 1
                elif t.group(3) != '/' and t.group(1) not in VOID:
                    if t.group(1) == tag:
                        depth += 1
                if depth == 0:
                    return html[start:t.start()]
            raise ValueError(f'unclosed #{elem_id}')
    raise ValueError(f'#{elem_id} not found')


def body_of(path: str) -> str:
    html = open(path, encoding='utf-8').read()
    return html[html.index('</head>'):] if '</head>' in html else html


def component(name: str, jsx: str, comment: str, props: str = '', imports: str = '') -> str:
    return (f'// {comment}\n'
            f'// GENERATED from {name} mockup markup — faithful translation, do not hand-tidy\n'
            f'// whitespace (inline spacing is significant). New work should compose the\n'
            f'// components in web/src/components instead; see\n'
            f'// web/src/components/CONVENTIONS.md (and web/src/pages/Gallery.jsx for usage).\n\n'
            + imports +
            f'export function {name}({props}) {{\n'
            f'  return (\n    <>{jsx}</>\n  )\n}}\n')


def main():
    dash = body_of(os.path.join(ROOT, 'light', 'admin-dashboard.html'))
    landing = body_of(os.path.join(ROOT, 'light', 'landing.html'))

    # ---- admin shell parts (sidebar + topbar) for AppShell.jsx
    sidebar_jsx = convert('<aside id="sidebar">' + extract_by_id(dash, 'sidebar') + '</aside>')
    topbar_jsx = convert('<header id="topbar">' + extract_by_id(dash, 'topbar') + '</header>')
    shell_out = os.path.join(ROOT, 'web', 'src', 'layout')
    os.makedirs(shell_out, exist_ok=True)
    with open(os.path.join(shell_out, 'shell.parts.txt'), 'w', encoding='utf-8') as fh:
        fh.write('/* Sidebar (from light/admin-dashboard.html #sidebar) */\n')
        fh.write(sidebar_jsx + '\n\n')
        fh.write('/* Topbar (from light/admin-dashboard.html #topbar) */\n')
        fh.write(topbar_jsx + '\n')

    # ---- dashboard page content (inner of <main id="page-content">; AppShell owns <main>)
    dash_jsx = convert(extract_by_id(dash, 'page-content'))
    pages_out = os.path.join(ROOT, 'web', 'src', 'pages')
    os.makedirs(pages_out, exist_ok=True)
    with open(os.path.join(pages_out, 'DashboardBody.jsx'), 'w', encoding='utf-8') as fh:
        fh.write(component('DashboardBody', dash_jsx,
                           'Dashboard page content (from light/admin-dashboard.html)'))

    pub = extract_by_id(landing, 'root')
    pub = strip_scripts(pub)
    # the mockup's theme link becomes a React-driven toggle
    pub, n = re.subn(r'<a class="pub-theme".*?</a>', '<PubThemeToggle />', pub, flags=re.S)
    assert n == 1, f'expected 1 pub-theme link, replaced {n}'
    # The app has no sign-in band on the landing: signing in happens on /login,
    # which the nav's button and the footer's "Admin Login" open. The band is
    # dropped here (app-only; the mockup keeps the designed band) rather than in
    # light/landing.html
    pub, n = re.subn(r'<section id="signin".*?</section>', '', pub, count=1, flags=re.S)
    assert n == 1, f'expected the sign-in band, dropped {n}'
    assert 'id="signin"' not in pub, 'a #signin band survived the removal'
    pub_jsx = convert(pub)
    # With the band gone its two entry points are re-pointed at /login: the nav
    # button (was "Get started" scrolling to #signin) and the footer link. The
    # nav's own "Sign in" section link went with the band.
    pub_jsx, n = re.subn(
        r'<button type="button" className="pub-btn">Get started</button>',
        '<Link className="pub-btn" to="/login">Sign in</Link>',
        pub_jsx, count=1)
    assert n == 1, f'expected the nav "Get started" button, replaced {n}'
    pub_jsx, n = re.subn(r'<a href="#signin">Sign in</a>', '', pub_jsx, count=1)
    assert n == 1, f'expected the nav "Sign in" section link, removed {n}'
    pub_jsx, n = re.subn(
        r'<a href="#signin">Admin Login</a>',
        '<Link to="/login">Admin Login</Link>',
        pub_jsx, count=1)
    assert n == 1, f'expected the footer "Admin Login" link, replaced {n}'
    assert '#signin' not in pub_jsx, 'a #signin anchor survived the landing rewrites'
    # root wrapper carries the theme + a ref for the delegated event handlers
    pub_jsx, n = re.subn(r'data-theme="light"', 'data-theme={theme} ref={ref}', pub_jsx)
    assert n == 1, f'expected 1 data-theme placeholder, replaced {n}'
    with open(os.path.join(pages_out, 'LandingBody.jsx'), 'w', encoding='utf-8') as fh:
        fh.write(component(
            'LandingBody', pub_jsx,
            'Landing page (from light/landing.html)',
            imports="import { Link } from 'react-router-dom'\n\n"
            "import { PubThemeToggle } from '../components/PubThemeToggle'\n\n",
            props="{ theme, ref }"))

    for p in ('layout/shell.parts.txt', 'pages/DashboardBody.jsx', 'pages/LandingBody.jsx'):
        full = os.path.join(ROOT, 'web', 'src', p)
        print(f'{p:32s} {os.path.getsize(full):>9,} bytes')


if __name__ == '__main__':
    main()
