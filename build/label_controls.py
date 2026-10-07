"""
One-off accessibility fix: give every form control an accessible name.

Run from the repo root:  python3 build/label_controls.py
For each unnamed control (found by checking .labels / aria-label in the live
DOM), pair it with the nearest preceding visible <label> that has no `for`;
where the page shows no label at all, add an aria-label from FALLBACK.
Prints every pairing so the result can be reviewed.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UNNAMED = {
    'tools/word-embeddings.html': ['word1', 'word2', 'word3', 'wordCategory', 'biasAxis', 'profCount'],
    'tools/explainability-lab.html': ['sentimentInput', 'loan-income', 'loan-credit', 'loan-dti', 'loan-emp',
                                      'loan-amount', 'loan-age', 'health-age', 'health-bmi', 'health-bp',
                                      'health-chol', 'health-exercise', 'health-smoker', 'compas-age',
                                      'compas-priors', 'compas-charge', 'compas-gender', 'compas-juv'],
    'tools/adversarial-sandbox.html': ['attackType', 'epsilon'],
    'tools/filter-bubble.html': ['engagementWeight', 'diversityFactor', 'homophily', 'algoMode'],
    'tools/privacy-lab.html': ['piiInput', 'dpQuery'],
    'tools/proxy-detector.html': ['protectedSelect'],
    'tools/llm-sandbox.html': ['temperature', 'userInput'],
}
# Controls whose meaning the page shows only through layout or placeholder text.
FALLBACK = {
    'word1': 'First word',
    'word2': 'Word to subtract',
    'word3': 'Word to add',
    'sentimentInput': 'Review text to analyse',
    'piiInput': 'Text to scan for personal data',
    'userInput': 'Message to the model',
}
WINDOW = 700  # how far back to look for a label


def fix(path, ids):
    p = ROOT / path
    s = p.read_text()
    for cid in ids:
        m = re.search(r'<(input|select|textarea)\b[^>]*\bid="%s"' % re.escape(cid), s)
        if not m:
            print(f'  {path}: {cid} NOT FOUND'); continue
        start = m.start()
        window = s[max(0, start - WINDOW):start]
        labels = list(re.finditer(r'<label\b(?![^>]*\bfor=)[^>]*>', window))
        # the label must not be closed by another control between it and ours
        chosen = None
        for lab in reversed(labels):
            between = window[lab.end():]
            if not re.search(r'<(input|select|textarea)\b', between) and cid not in FALLBACK:
                chosen = lab
                break
        if chosen:
            abs_pos = max(0, start - WINDOW) + chosen.start()
            text = re.sub(r'<[^>]+>', ' ', s[abs_pos:abs_pos + 300].split('</label>')[0])
            text = ' '.join(text.split())[:50]
            s = s[:abs_pos] + s[abs_pos:].replace('<label', f'<label for="{cid}"', 1)
            print(f'  {path}: {cid:18s} <- label "{text}"')
        else:
            name = FALLBACK.get(cid)
            if not name:
                print(f'  {path}: {cid} NO LABEL AND NO FALLBACK'); continue
            tag_end = s.index('>', m.start())
            s = s[:tag_end] + f' aria-label="{name}"' + s[tag_end:]
            print(f'  {path}: {cid:18s} <- aria-label "{name}"')
    p.write_text(s)


for path, ids in UNNAMED.items():
    fix(path, ids)
