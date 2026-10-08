// Privacy & Anonymization Lab (tools/privacy-lab.html): what k-anonymity
// does to a table. Each tray is the same 36-patient table after the tool's
// lattice search has generalised it for a given k. Every sheet is one patient
// record; records that can no longer be told apart (same generalised Age and
// ZIP) are stacked together, so each stack is an equivalence class and its
// height is the class size. Records the search suppressed rather than
// over-generalise lie beside the tray as dashed sheets. Read left to right:
// as k rises the stacks merge and grow taller - fewer, larger crowds to hide
// in - and the information lost climbs.
//
// Data: computed by running the page's own findMinimalGeneralization(k, l=1,
// suppression=20%) over its SAMPLE_DATA (36 rows), then counting class sizes.
// k = 5, 6 and 7 produce the same table, as do k = 8 to 12, so those share a
// tray. If SAMPLE_DATA, the hierarchies or the search change, re-run and
// update STAGES.
(function () {
    const root = document.getElementById('kanon-figure');
    if (!root || !window.LineFigure) return;
    const { iso, el, svg: makeSvg, box, edgeLabel, nearest, interact, face, onNear, onEnd } = window.LineFigure;

    const STAGES = [
        { k: '1', age: 'exact ages', zip: 'full ZIP', sizes: Array(36).fill(1), suppressed: 0, loss: 0 },
        { k: '2', age: '5-year bins', zip: 'ZIP to 4 digits', sizes: [5, 5, 5, 4, 4, 4, 4, 3, 2], suppressed: 0, loss: 14.9 },
        { k: '3', age: '5-year bins', zip: 'ZIP to 4 digits', sizes: [5, 5, 5, 4, 4, 4, 4, 3], suppressed: 2, loss: 19.6 },
        { k: '4', age: '5-year bins', zip: 'ZIP to 4 digits', sizes: [5, 5, 5, 4, 4, 4, 4], suppressed: 5, loss: 26.7 },
        { k: '5–7', age: '10-year bins', zip: 'ZIP to 4 digits', sizes: [9, 9, 8, 7], suppressed: 3, loss: 27.6 },
        { k: '8–12', age: '20-year bins', zip: 'ZIP to 4 digits', sizes: [17, 16], suppressed: 3, loss: 38.7 },
    ];

    const TRAY = 36;      // tray side (u and v)
    const GAP = 14;       // gap between trays along u
    const T = 3;          // tray thickness
    const SHEET = 1.8;    // height one record adds to its stack
    const CELL = TRAY / 6; // the raw table needs a 6x6 grid; others use fewer cells
    const LIFT = 5;       // a picked tray's stacks rise this much

    const trayU = i => i * (TRAY + GAP);

    // Lay a stage's stacks on a square grid centred on its tray.
    function layout(stage, i) {
        const n = stage.sizes.length;
        const cols = Math.ceil(Math.sqrt(n));
        const rows = Math.ceil(n / cols);
        const pitch = Math.min(CELL * 1.6, (TRAY - 6) / Math.max(cols, rows));
        const foot = Math.min(pitch * 0.62, 7);
        const u0 = trayU(i) + (TRAY - cols * pitch) / 2;
        const v0 = (TRAY - rows * pitch) / 2;
        return stage.sizes.map((size, j) => ({
            size,
            u: u0 + (j % cols) * pitch + (pitch - foot) / 2,
            v: v0 + Math.floor(j / cols) * pitch + (pitch - foot) / 2,
            foot
        }));
    }

    const svg = makeSvg(root, '0 0 100 100',
        'Six trays left to right, each the same 36-record patient table generalised for a larger k. Every record is a ' +
        'thin sheet; records that share the same generalised age and ZIP are stacked. The first tray has 36 separate ' +
        'sheets; by k of 8 the table is two tall stacks of 17 and 16, with three records set aside, and information ' +
        'loss has risen from 0 to 38.7 percent.');

    const trays = [];
    // Farthest first: larger u is farther back.
    for (let i = STAGES.length - 1; i >= 0; i--) {
        const g = el('g', {}, svg);
        box(g, 'lf-solid').set(trayU(i), 0, -T, trayU(i) + TRAY, TRAY, 0);
        edgeLabel(g, `k = ${STAGES[i].k}`, trayU(i) + 2, TRAY, -T - 1.5, 'lf-text');

        // Stacks, farthest first within the tray. Each is one solid with a line
        // per record ruled on its two visible sides, like the edge of a closed
        // book, so a stack's records can be counted without drawing every sheet.
        const stacks = layout(STAGES[i], i)
            .sort((a, b) => (a.v - a.u) - (b.v - b.u))
            .map(st => {
                const sg = el('g', {}, g);
                const solid = box(sg, 'lf-solid');
                const near = face(sg, '');
                const end = face(sg, '');
                for (let k = 1; k < st.size; k++) {
                    el('line', { x1: 0, y1: k * SHEET, x2: st.foot, y2: k * SHEET, class: 'lf-line lf-faint' }, near);
                    el('line', { x1: 0, y1: k * SHEET, x2: st.foot, y2: k * SHEET, class: 'lf-line lf-faint' }, end);
                }
                return { ...st, solid, near, end };
            });

        // suppressed records: dashed sheets set aside in front of the tray
        const ghost = el('g', { class: 'lf-ghost' }, svg);
        const ghosts = Array.from({ length: STAGES[i].suppressed }, (_, j) => {
            const b = box(ghost, '');
            b.set(trayU(i) + 4 + j * 3.4, TRAY + 5, 0, trayU(i) + 7 + j * 3.4, TRAY + 9, SHEET);
            return b;
        });
        trays[i] = { g, stacks, ghost, ghosts };
    }

    const xs = STAGES.map((_, i) => iso(trayU(i) + TRAY / 2, TRAY / 2)[0]);

    function draw(glow, active) {
        trays.forEach((t, i) => {
            const lift = LIFT * glow[i];
            t.stacks.forEach(st => {
                const top = lift + st.size * SHEET;
                st.solid.set(st.u, st.v, lift, st.u + st.foot, st.v + st.foot, top);
                st.near.setAttribute('transform', onNear(st.u, st.v + st.foot, top));
                st.end.setAttribute('transform', onEnd(st.u, st.v, top));
            });
            t.g.classList.toggle('is-lit', i === active);
            t.ghost.classList.toggle('is-lit', i === active);
        });
    }

    // Fit the viewBox to what was drawn, plus room for a lifted tray. The
    // figure sits in a tab that is hidden on load, and getBBox() measures zero
    // inside display:none, so the fit waits until the figure has a size.
    draw(new Array(STAGES.length).fill(0), -1);
    const fit = () => {
        const b = svg.getBBox();
        if (!b.width) return false;
        svg.setAttribute('viewBox', [b.x - 6, b.y - 24, b.width + 12, b.height + 30].map(v => v.toFixed(1)).join(' '));
        return true;
    };
    if (!fit()) {
        const ro = new ResizeObserver(() => { if (fit()) ro.disconnect(); });
        ro.observe(root);
    }

    interact({
        root, svg, count: STAGES.length,
        rest: 'One table, generalised for larger k. Pick a tray to see what hiding in a crowd of k costs.',
        describe: i => {
            const s = STAGES[i];
            if (i === 0) return 'No generalisation · 36 classes of one: every record unique · information loss 0%';
            const smallest = Math.min(...s.sizes);
            return `k = ${s.k} · ${s.age}, ${s.zip} · ${s.sizes.length} classes, smallest ${smallest}` +
                (s.suppressed ? ` · ${s.suppressed} suppressed` : '') + ` · loss ${s.loss}%`;
        },
        pick: x => nearest(x, xs, 30),
        draw
    });
})();
