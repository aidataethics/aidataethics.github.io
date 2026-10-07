// Behavioral testing in the style of CheckList (Ribeiro, Wu, Guestrin & Singh,
// "Beyond Accuracy: Behavioral Testing of NLP Models with CheckList", ACL 2020;
// reference implementation github.com/marcotcr/checklist, MIT). A port of the
// method, not of the Python package: templates filled from small word lists
// (lexicons), and three kinds of test -
//
//   MFT  minimum functionality: each case has a right answer ("This is not a
//        good movie." is negative); a case fails when the model disagrees.
//   INV  invariance: a change that should not matter (a typo, a different
//        name); a case fails when the predicted label changes.
//   DIR  directional expectation: a change that should push one way (adding
//        "I hated it."); a case fails when the score moves the wrong way by
//        more than a tolerance.
//
// Results are failure rates, grouped by capability (vocabulary, negation,
// robustness, fairness, ...). Generation is seeded, so the same suite gives
// the same cases on every machine - the course handouts depend on that.
//
// Loads as window.CheckList in a page and via require() in Node.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.CheckList = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ------------------------------------------------------------- labels
    // The sentiment model returns a probability. 0.5 exactly means it found
    // no scored word at all, so it is reported as "neutral" (no opinion)
    // rather than forced to a side.
    const EPS = 1e-9;
    function label(prob) {
        if (Math.abs(prob - 0.5) < EPS) return 'neutral';
        return prob > 0.5 ? 'positive' : 'negative';
    }
    const EXPECT = {
        positive: l => l === 'positive',
        negative: l => l === 'negative',
        neutral: l => l === 'neutral',
        'not-negative': l => l !== 'negative',
        'not-positive': l => l !== 'positive',
    };
    const DIR_TOLERANCE = 0.1;   // CheckList's default for sentiment DIR tests

    // ------------------------------------------------------- seeded random
    function rng(seed) {   // mulberry32
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function hashSeed(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }

    // ---------------------------------------------------------- templates
    // "{pos_adj}" draws from lexicon pos_adj; "{pos_adj2}" draws from the same
    // lexicon as an independent slot. Every combination is generated, then a
    // seeded sample of n is kept if there are more.
    const SLOT = /\{([a-z_]+?)(\d*)\}/gi;
    function slots(template) {
        const seen = new Map();
        for (const m of template.matchAll(SLOT)) seen.set(m[0], m[1]);
        return [...seen.entries()].map(([token, lex]) => ({ token, lex }));
    }
    function expand(template, lexicons, n, seed) {
        const ss = slots(template);
        const missing = ss.filter(s => !lexicons[s.lex] || !lexicons[s.lex].length).map(s => s.lex);
        if (missing.length) throw new Error('No word list called ' + [...new Set(missing)].join(', '));
        const sizes = ss.map(s => lexicons[s.lex].length);
        const total = sizes.reduce((a, b) => a * b, 1);
        let picks = [...Array(total).keys()];
        if (total > n) {
            const r = rng(seed);
            for (let i = picks.length - 1; i > 0; i--) {   // seeded shuffle, keep first n
                const j = Math.floor(r() * (i + 1));
                [picks[i], picks[j]] = [picks[j], picks[i]];
            }
            picks = picks.slice(0, n).sort((a, b) => a - b);
        }
        return picks.map(k => {
            let text = template;
            const fill = {};
            ss.forEach((s, i) => {
                const word = lexicons[s.lex][k % sizes[i]];
                k = Math.floor(k / sizes[i]);
                fill[s.token] = word;
                text = text.split(s.token).join(word);
            });
            return { text: capitalise(text), fill };
        });
    }
    const capitalise = t => t.charAt(0).toUpperCase() + t.slice(1);

    // ------------------------------------------------------- perturbations
    // Each returns a list of variants of a sentence (possibly empty).
    const CONTRACTIONS = [
        ['is not', "isn't"], ['are not', "aren't"], ['was not', "wasn't"], ['do not', "don't"],
        ['does not', "doesn't"], ['did not', "didn't"], ['can not', "can't"], ['will not', "won't"],
        ['it is', "it's"], ['I am', "I'm"], ['I have', "I've"], ['would not', "wouldn't"],
    ];
    const PERTURB = {
        typo: {
            label: 'Swap two adjacent letters in one word',
            fn(text, r) {
                const words = text.split(' ');
                const idx = words.map((w, i) => i).filter(i => /^[a-z]{4,}/i.test(words[i]));
                if (!idx.length) return [];
                const out = [];
                for (let k = 0; k < 2; k++) {
                    const i = idx[Math.floor(r() * idx.length)];
                    const w = words[i];
                    const j = 1 + Math.floor(r() * (w.replace(/[^a-z]/gi, '').length - 2));
                    const v = w.slice(0, j) + w[j + 1] + w[j] + w.slice(j + 2);
                    const copy = words.slice(); copy[i] = v;
                    out.push(copy.join(' '));
                }
                return [...new Set(out)].filter(v => v !== text);
            }
        },
        contractions: {
            label: "Expand or contract (is not ↔ isn't)",
            fn(text) {
                const out = [];
                for (const [long, short] of CONTRACTIONS) {
                    const reL = new RegExp('\\b' + long + '\\b', 'i');
                    const reS = new RegExp('\\b' + short.replace("'", "'") + '(?![\\w])', 'i');
                    if (reL.test(text)) out.push(text.replace(reL, m => matchCase(m, short)));
                    else if (reS.test(text)) out.push(text.replace(reS, m => matchCase(m, long)));
                }
                return out;
            }
        },
        punctuation: {
            label: 'Change the final punctuation',
            fn(text) {
                const bare = text.replace(/[.!?]+$/, '');
                return [bare, bare + '!', bare + '...'].filter(v => v !== text);
            }
        },
        add_url: {
            label: 'Append a link or a handle',
            fn(text, r) {
                const id = Math.floor(r() * 1e6).toString(36);
                return [text + ' https://t.co/' + id, text + ' @user' + id.slice(0, 3)];
            }
        },
        change_names: {
            label: 'Replace the first name with others',
            uses: 'first_name',
            fn(text, r, lex) {
                return swapFrom(text, lex.first_name, r, 3);
            }
        },
        change_locations: {
            label: 'Replace the city with others',
            uses: 'city',
            fn(text, r, lex) {
                return swapFrom(text, lex.city, r, 3);
            }
        },
    };
    function matchCase(src, word) {
        return /^[A-Z]/.test(src) ? capitalise(word) : word;
    }
    function swapFrom(text, list, r, k) {
        if (!list) return [];
        const present = list.find(w => new RegExp('\\b' + w + '\\b').test(text));
        if (!present) return [];
        const others = list.filter(w => w !== present);
        const out = [];
        for (let i = 0; i < k && others.length; i++) {
            const j = Math.floor(r() * others.length);
            out.push(text.replace(new RegExp('\\b' + present + '\\b', 'g'), others.splice(j, 1)[0]));
        }
        return out;
    }
    // DIR: append each phrase from a lexicon to the sentence.
    function appendPhrases(text, phrases) {
        const base = text.replace(/\s+$/, '');
        return phrases.map(p => base + ' ' + p);
    }

    // ---------------------------------------------------------------- run
    // test: { id, capability, type, name, template, n, expect | perturb | phrases+direction }
    // predict(text) -> probability of positive
    // vocab (optional): Set of words the model scores; an INV test whose
    //   changes touch none of them is flagged `structural` - it cannot fail.
    function run(test, predict, lexicons, vocab) {
        const seed = hashSeed(test.id || test.template);
        const r = rng(seed ^ 0x9E3779B9);
        const lex = Object.assign({}, lexicons, test.lexicons || {});
        const base = expand(test.template, lex, test.n || 40, seed);
        const cases = [];
        let touched = false;
        for (const b of base) {
            const p = predict(b.text);
            const c = { text: b.text, prob: p, label: label(p) };
            if (test.type === 'MFT') {
                c.pass = EXPECT[test.expect](c.label);
            } else {
                const variants = test.type === 'INV'
                    ? PERTURB[test.perturb].fn(b.text, r, lex)
                    : appendPhrases(b.text, lex[test.phrases] || []);
                if (!variants.length) continue;   // nothing to perturb in this case
                c.variants = variants.map(v => {
                    const q = predict(v);
                    let pass;
                    if (test.type === 'INV') pass = label(q) === c.label;
                    else pass = test.direction === 'up' ? q >= p - DIR_TOLERANCE : q <= p + DIR_TOLERANCE;
                    if (vocab && !touched) touched = changedWords(b.text, v).some(w => vocab.has(w));
                    return { text: v, prob: q, label: label(q), pass };
                });
                c.pass = c.variants.every(v => v.pass);
            }
            cases.push(c);
        }
        const fails = cases.filter(c => !c.pass).length;
        return {
            test, cases, n: cases.length, fails,
            failRate: cases.length ? fails / cases.length : 0,
            structural: test.type === 'INV' && vocab ? !touched : false,
        };
    }
    function words(t) { return t.toLowerCase().replace(/[^\w\s']/g, '').split(/\s+/).filter(Boolean); }
    function changedWords(a, b) {
        const A = new Set(words(a)), B = new Set(words(b));
        return [...A].filter(w => !B.has(w)).concat([...B].filter(w => !A.has(w)));
    }

    return { label, expand, run, slots, PERTURB, EXPECT, DIR_TOLERANCE, hashSeed };
});
