"""
One-off migration to the "ink on paper" visual system (toolkit v3.2.0).

Run once from the repo root:  python3 build/paper_and_ink.py
Kept in the repo, like extract_shell.py, so the change is auditable.

What it does to every page:
  - drops the per-page scrollbar <style> rules (shared/toolkit.css owns them)
    and the Google Fonts links (fonts are now self-hosted in vendor/fonts);
  - replaces the theme bootstrap with one that follows the operating-system
    preference until the student picks a theme, instead of forcing dark;
  - raises every arbitrary 9-11px text size to the text-xs floor (12.5px);
  - fixes the heading outline on tool pages, which jumped h1 -> h3;
  - swaps emoji used as interface glyphs for words or ink symbols;
  - swaps the emoji favicon for an ink mark;
  - bumps the shared-asset version so browsers fetch the new stylesheet.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OLD_V, NEW_V = '3.1.0', '3.2.0'

PAGES = ['index.html', 'legal.html', 'settings.html', 'user-guide.html'] + \
        sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'tools').glob('*.html'))

THEME_SNIPPET = """    <script>
        // Paint the theme before first render. Until the student chooses one,
        // follow the operating system's light/dark preference (and keep
        // following it if it changes); an explicit choice from the toggle wins.
        (function () {
            var root = document.documentElement;
            var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
            function saved() { try { return localStorage.getItem('ethicsToolkitTheme'); } catch (e) { return null; } }
            function apply(dark) {
                root.classList.toggle('dark', dark);
                root.classList.toggle('light', !dark);
            }
            var s = saved();
            apply(s ? s === 'dark' : !!(mq && mq.matches));
            if (mq && mq.addEventListener) {
                mq.addEventListener('change', function (e) {
                    if (!saved()) {
                        apply(e.matches);
                        document.dispatchEvent(new CustomEvent('toolkit:themechange', { detail: { dark: e.matches } }));
                    }
                });
            }
            window.__setToolkitTheme = function (dark) {
                apply(dark);
                try { localStorage.setItem('ethicsToolkitTheme', dark ? 'dark' : 'light'); } catch (e) { }
            };
        })();
    </script>
"""

# An ink mark: two hairline strokes crossing a baseline, in the accent blue.
FAVICON = ('<link rel="icon" href="data:image/svg+xml,'
           "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
           "%3Crect width='32' height='32' rx='6' fill='%23f8f5ee'/%3E"
           "%3Cpath d='M6 24h20M9 24l7-15 7 15M12 18h8' fill='none' stroke='%232749b8' "
           "stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\" />")

EMOJI = [
    # explainability lab token roles
    ('🚫 ${token}', '<span class="text-primary font-mono text-xs mr-0.5" aria-hidden="true">¬</span>${token}'),
    ('⚡ ${token}', '<span class="text-primary font-mono text-xs mr-0.5" aria-hidden="true">×</span>${token}'),
    ('⚖️ ${token}', '<span class="text-primary font-mono text-xs mr-0.5" aria-hidden="true">|</span>${token}'),
    ("const icon = cf.flipped ? '🔄' : '→';", "const icon = cf.flipped ? '⇄' : '→';"),
    # filter bubble share tag
    ('🔗 ${sharedBy[0].name} shared', 'shared by ${sharedBy[0].name}'),
    # bias auditor report heading
    ('<h1>📊 Dataset Bias Audit Report</h1>', '<h1>Dataset Bias Audit Report</h1>'),
]


def strip_scrollbar_rules(text):
    # Remove ::-webkit-scrollbar* rule blocks inside inline <style> elements.
    text = re.sub(r'\n[ \t]*::-webkit-scrollbar[\w:-]*\s*\{[^}]*\}\n', '\n', text)
    # Drop a <style> element left empty.
    return re.sub(r'[ \t]*<style>\s*</style>\n', '', text)


def migrate(path):
    p = ROOT / path
    s = original = p.read_text()
    log = []

    s, n = re.subn(r'[ \t]*<link href="https://fonts\.googleapis\.com[^>]*?>\n', '', s, flags=re.S)
    s, n2 = re.subn(r'[ \t]*<link\s+href="https://fonts\.googleapis\.com[^"]*"\s*\n?\s*rel="stylesheet"\s*/>\n', '', s)
    if n + n2: log.append(f'google-fonts -{n + n2}')

    before = s
    s = strip_scrollbar_rules(s)
    if s != before: log.append('scrollbar css')

    s, n = re.subn(r'[ \t]*<script>\s*\n\s*// Paint the saved theme.*?</script>\n', THEME_SNIPPET, s, count=1, flags=re.S)
    if n: log.append('theme follows OS')
    s = s.replace('<html class="dark" lang="en">', '<html lang="en">')

    s, n = re.subn(r'<link rel="icon" href="data:image/svg\+xml,[^"]*" />', FAVICON, s)
    if n: log.append('favicon')

    s, n = re.subn(r'text-\[(?:9|10|11)px\]', 'text-xs', s)
    if n: log.append(f'tiny text x{n}')

    s = s.replace(f'?v={OLD_V}', f'?v={NEW_V}')

    s = s.replace("'Space Grotesk'", "'IBM Plex Sans'").replace('"Space Grotesk"', '"IBM Plex Sans"')

    for a, b in EMOJI:
        if a in s:
            s = s.replace(a, b)
            log.append('emoji')

    if path.startswith('tools/'):
        # Fix the outline: section titles were h3 under the page h1.
        s = re.sub(r'<(/?)h4(\b)', r'<\1h3\2', s.replace('<h3', '<h2').replace('</h3>', '</h2>'))
        log.append('headings h3->h2, h4->h3')

    if s != original:
        p.write_text(s)
    print(f'  {path:36s} {", ".join(log) or "no change"}')


if __name__ == '__main__':
    for page in PAGES:
        migrate(page)
    sys.exit(0)
