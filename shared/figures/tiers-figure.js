// Word Embeddings Workbench (tools/word-embeddings.html): the four model sizes
// as four blocks lined up from a common left edge. A block's length is its
// vocabulary (words) and its height is its dimensions, so its face area - and
// the block's bulk - is proportional to the file you download
// (words x dims x 4 bytes). Full and Max are the same height (300d) and differ
// only in length: they hold the same vectors, Max just keeps more words.
//
// Data: data/glove-tiers.json (written by data/generate_glove_subset.py) for
// words, dimensions and megabytes; WEAT 6 coverage from checking Caliskan's
// word sets against each tier's vocabulary file; the analogy answers are what
// each tier returns in the tool (verified against the vocabulary files).
// If the tiers are regenerated, update TIERS.
(function () {
    const root = document.getElementById('tiers-figure');
    if (!root || !window.LineFigure) return;
    const { iso, el, svg: makeSvg, box, interact } = window.LineFigure;

    const TIERS = [
        { name: 'Small', words: 5061, dims: 50, mb: 0.97,
          note: 'cannot run WEAT 6: 7 of its 8 female names are missing' },
        { name: 'Large', words: 20013, dims: 100, mb: 7.63,
          note: 'runs WEAT 6 · paris − france + japan → tokyo, osaka' },
        { name: 'Full', words: 50000, dims: 300, mb: 57.22,
          note: 'the 300-dimension vectors people deploy' },
        { name: 'Max', words: 80000, dims: 300, mb: 91.553,   // 96,000,000 bytes / 2^20
          note: 'same vectors as Full, 30,000 more words' },
    ];

    const U_PER_KWORD = 1.9;  // block length per thousand words
    const H_PER_DIM = 0.3;    // block height per dimension
    const DEPTH = 14;         // every block's depth (v)
    const ROW = 26;           // spacing between blocks along v
    const LIFT = 6;           // a picked block rises this much

    // Biggest farthest back so the smaller blocks in front stay visible.
    const blocks = TIERS.map((t, i) => {
        const v0 = (TIERS.length - 1 - i) * ROW;
        return { ...t, u1: t.words / 1000 * U_PER_KWORD, h1: t.dims * H_PER_DIM, v0, v1: v0 + DEPTH };
    });

    const svg = makeSvg(root, '0 0 100 100',
        'Four blocks from a common left edge, one per model size. Length is vocabulary and height is dimensions, so ' +
        'bulk tracks file size: Small, 5,061 words at 50 dimensions, 1 megabyte; Large, 20,013 at 100, 7.6 megabytes; ' +
        'Full, 50,000 at 300, 57 megabytes; Max, 80,000 at 300, 92 megabytes.');

    // floor plate under all four
    const L = blocks[blocks.length - 1].u1 + 8;
    box(svg, 'lf-solid').set(-6, -6, -3, L, ROW * (TIERS.length - 1) + DEPTH + 6, 0);

    // draw farthest (largest v0 is nearest, so iterate from the back row)
    const order = blocks.map((b, i) => i).sort((a, b) => blocks[a].v0 - blocks[b].v0);
    const marks = [];
    order.forEach(i => {
        const b = blocks[i];
        const g = el('g', {}, svg);
        const solid = box(g, 'lf-solid');
        marks[i] = { g, solid };
    });

    const centres = blocks.map(b => iso(b.u1 / 2, b.v1, b.h1 / 2));

    // Names set flat in screen space, just left of each block's front corner,
    // drawn after the blocks so none is hidden. (Text painted on the faces came
    // out too small to read at page size.)
    const nameEls = blocks.map(b => {
        const [x, y] = iso(-6, b.v1, -1.5);   // just off the plate's left edge
        const t = el('text', { x: x - 3, y: y + 2, 'text-anchor': 'end', class: 'lf-text' }, svg);
        t.textContent = `${b.name} · ${b.mb < 1.5 ? '1' : b.mb.toFixed(b.mb < 10 ? 1 : 0)} MB`;
        return t;
    });

    function draw(glow, active) {
        blocks.forEach((b, i) => {
            const lift = LIFT * glow[i];
            marks[i].solid.set(0, b.v0, lift, b.u1, b.v1, b.h1 + lift);
            marks[i].g.classList.toggle('is-lit', i === active);
            nameEls[i].classList.toggle('is-lit', i === active);
        });
    }

    draw(new Array(blocks.length).fill(0), -1);
    const fit = () => {
        const bb = svg.getBBox();
        if (!bb.width) return false;
        svg.setAttribute('viewBox', [bb.x - 4, bb.y - LIFT - 4, bb.width + 8, bb.height + LIFT + 8].map(v => v.toFixed(1)).join(' '));
        return true;
    };
    if (!fit()) {
        const ro = new ResizeObserver(() => { if (fit()) ro.disconnect(); });
        ro.observe(root);
    }

    interact({
        root, svg, count: blocks.length,
        rest: 'Length is vocabulary, height is dimensions: bulk is the download. Pick a block.',
        describe: i => {
            const b = blocks[i];
            return `${b.name} · ${b.words.toLocaleString()} words × ${b.dims}d · ${b.mb < 1.5 ? '1.0' : b.mb.toFixed(1)} MB · ${b.note}`;
        },
        // 2-D nearest to each block's near-face centre: the blocks overlap in x
        pick: (x, y) => {
            let best = -1, bestD = 90 * 90;
            centres.forEach(([cx, cy], i) => {
                const d = (x - cx) ** 2 + (y - cy) ** 2;
                if (d < bestD) { bestD = d; best = i; }
            });
            return best;
        },
        draw
    });
})();
