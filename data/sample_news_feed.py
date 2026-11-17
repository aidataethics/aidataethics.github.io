"""
Build data/news-feed.json, the stories shown in the Filter Bubble Simulator.

Source: the Article-Bias-Prediction dataset (Baly, Da San Martino, Glass and
Nakov, "We Can Detect Your Bias: Predicting the Political Ideology of News
Articles", EMNLP 2020), https://github.com/ramybaly/Article-Bias-Prediction,
released under Apache-2.0. Its 37,554 articles were collected from AllSides,
and each carries AllSides' left / center / right label.

The dataset is NOT kept in this repo (133 MB). To rebuild:

    git clone https://github.com/ramybaly/Article-Bias-Prediction /tmp/abp
    python3 -I data/sample_news_feed.py /tmp/abp/data/jsons

What ships, per story: outlet name, outlet domain, date, link, lean label,
topic, headline, and a short opening excerpt (one sentence, at most ~180
characters). Article bodies, authors and the processed text are dropped:
the simulator needs a headline and a teaser, not the article.

Sampling is stratified and seeded, so the file is reproducible:
8 topics x 3 leans x PER_CELL stories. The eight topics keep the simulator's
arithmetic (eight equal topics, H = log2 8 = 3 bits) and keep Sports, the
topic the week-5 board works by hand. Swap a topic by editing TOPICS.
"""

import json
import random
import re
import sys
from pathlib import Path

SEED = 205
PER_CELL = 12

# dataset topic -> simulator key, label
TOPICS = {
    'sports':                     ('sports', 'Sports'),
    'immigration':                ('immigration', 'Immigration'),
    'healthcare':                 ('health', 'Health care'),
    'gun_control_and_gun_rights': ('guns', 'Guns'),
    'environment':                ('environment', 'Environment'),
    'economy_and_jobs':           ('economy', 'Economy'),
    'education':                  ('education', 'Education'),
    'technology':                 ('tech', 'Technology'),
}

# Bylines that are not an outlet, or are an aggregator of other outlets.
SKIP_SOURCES = {'Guest Writer - Left', 'Guest Writer - Right', 'Guest Writer - Center', 'Guest Writer',
                'The Flip Side', ''}
CLEAN_SOURCE = [(r'\s*\((Web News|Online News|Opinion)\)$', ''), (r'\s*-\s*News$', ''),
                (r'^Fox Online News$', 'Fox News'), (r'^NPR Online News$', 'NPR'),
                (r'\s+Online News$', ''), (r'^TheBlaze\.com$', 'TheBlaze')]
MIN_OUTLET_ARTICLES = 50          # real outlets only, not one-off columnists
GLUED = re.compile(r'[a-z]{4,}[A-Z][a-z]{3,}')   # two scraped headlines run together
# Openings that are scaffolding, not the story: page furniture, labels,
# datelines, photo credits. Applied repeatedly until none matches.
LEADS = [r'^(CLOSE|SHARE THIS ARTICLE( Share)?( Tweet)?( Post)?( Email)?|LISTEN TO ARTICLE \d+:\d+|POLITICO Pro)\s+',
         r'^(ANALYSIS/OPINION|OPINION|ANALYSIS|EXCLUSIVE|BREAKING)\s*:\s*',
         r'^[A-Z][A-Z .,\'’-]{2,40}(\([^)]{1,30}\))?\s*[-—–]+\s*',      # TIJUANA, Mexico (Reuters) -
         r'^\(?\w*\)\s*[-—–]?\s*',                                      # ") - " left by a dateline
         r'^\([^)]{0,60}\)\s*',                                          # (Brian Snyder/Reuters)
         r'^\[[^\]]*\]?[^.]*\.\s*',                                      # [Get more stories like this…]
         r'^.{0,160}?toggle caption\s+(\S+(?:\s\S+){0,5}?)\s+\1\s+']      # NPR: caption, credit, credit
ABBREV = re.compile(r'\b(Sen|Rep|Gov|Mr|Mrs|Ms|Dr|St|Jr|Sr|Lt|Gen|Col|Sgt|Prof|Inc|Co|vs|U\.S|D\.C|No)\.$')
JUNK = re.compile(r'Enlarge this image|toggle caption|SHARE THIS|Share Tweet|newsletter|Leer en español|years ago Updated|^Updated |rush transcript|Story highlights|is a (senior )?(staff|contributing) writer|is a columnist', re.I)
DATE = re.compile(r'^(201[2-9]|2020)-\d{2}-\d{2}$')


def clean_source(name):
    for pat, rep in CLEAN_SOURCE:
        name = re.sub(pat, rep, name)
    return name.strip()


def excerpt(text, outlet, title, limit=180):
    text = re.sub(r'\s+', ' ', text or '').strip()
    for _ in range(4):
        before = text
        for pat in LEADS:
            text = re.sub(pat, '', text)
        # the headline repeated as the first line
        if title and text.lower().startswith(title.lower()):
            text = text[len(title):].lstrip(' -—–:')
        # a byline run into the text: "Mike Snider USA TODAY The latest..."
        i = text.find(outlet)
        if 0 <= i < 45 and len(text) > i + len(outlet) + 40:
            text = text[i + len(outlet):].lstrip(' -—–:')
        if text == before:
            break
    if JUNK.search(text[:200]) or not re.match(r'^[A-Z“"‘\'0-9]', text):
        return ''
    # first sentence, not stopping at "Sen." or "U.S."
    for m in re.finditer(r'[.!?]["”’)]?(?=\s|$)', text):
        end = m.end()
        if end > limit:
            break
        if end >= 40 and not ABBREV.search(text[:m.start() + 1]):
            return text[:end].strip()
    if len(text) < 40:
        return ''
    cut = text[:limit].rsplit(' ', 1)[0]
    return cut.rstrip(',;:') + '…'


def main(folder):
    rng = random.Random(SEED)
    cells = {}
    articles = [json.loads(f.read_text()) for f in sorted(Path(folder).glob('*.json'))]
    per_outlet, domains = {}, {}
    for a in articles:
        per_outlet[a['source']] = per_outlet.get(a['source'], 0) + 1
        d = re.sub(r'^https?://(www\d?\.)?|/.*$', '', a.get('url', ''))
        domains.setdefault(a['source'], {}).setdefault(d, 0)
        domains[a['source']][d] += 1
    # each outlet's own domain is the one most of its articles live on
    home = {src: max(ds, key=ds.get) for src, ds in domains.items()}
    root = lambda d: '.'.join(d.split('.')[-2:])
    for a in articles:
        if per_outlet[a['source']] < MIN_OUTLET_ARTICLES:
            continue
        if a['topic'] not in TOPICS or a['source'] in SKIP_SOURCES:
            continue
        if not DATE.match(a.get('date', '')) or not a.get('url', '').startswith('http'):
            continue
        # drop stories filed under the wrong outlet (an NPR story on cnn.com)
        d = re.sub(r'^https?://(www\d?\.)?|/.*$', '', a['url'])
        if root(d) != root(home[a['source']]) and not d.endswith(('foxbusiness.com', 'bloombergview.com', 'pagesix.com')):
            continue
        title = re.sub(r'\s+', ' ', a.get('title', '')).strip()
        if not (15 <= len(title) <= 150) or GLUED.search(title) or re.match(r'^[a-z]+[A-Z]', title):
            continue
        cells.setdefault((a['topic'], a['bias_text']), []).append(a)

    posts = []
    for topic, (key, _) in TOPICS.items():
        for lean in ('left', 'center', 'right'):
            pool = cells.get((topic, lean), [])
            if len(pool) < PER_CELL:
                sys.exit(f'only {len(pool)} usable {lean} stories for {topic}')
            for a in rng.sample(pool, PER_CELL):
                posts.append({
                    'id': a['ID'],
                    'topic': key,
                    'lean': lean,
                    'outlet': clean_source(a['source']),
                    'domain': root(home[a['source']]),
                    'date': a['date'],
                    'url': a['url'],
                    'title': re.sub(r'\s+', ' ', a['title']).strip(),
                    'excerpt': excerpt(a.get('content_original', ''), clean_source(a['source']),
                                       re.sub(r'\s+', ' ', a['title']).strip()),
                })
    posts.sort(key=lambda p: p['date'])
    out = {
        'source': 'Article-Bias-Prediction (Baly et al., EMNLP 2020), Apache-2.0; '
                  'lean labels from AllSides',
        'topics': {key: label for key, label in TOPICS.values()},
        'posts': posts,
    }
    dest = Path(__file__).resolve().parent / 'news-feed.json'
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print(f'{len(posts)} stories -> {dest} ({dest.stat().st_size / 1024:.0f} KB)')


if __name__ == '__main__':
    main(sys.argv[1])
