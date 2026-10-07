// Home page (index.html): the course as a climb. Each of the nine tools is a
// tray on a rising staircase, in the order the course reaches it; each lab is
// a card standing on its tool's tray (Privacy and Explainability carry two
// labs each). The last tray is the Lab 12 capstone, which reuses four earlier
// tools; when it is picked, dashed threads run back to the trays it draws on.
//
// Data: lab numbers and titles are the "## Lab N:" headings of the course's
// lab handouts (ai_ethics_course/labs/lab1..lab12), and Lab 12's four phases
// are its "Phase 1-4" headings (Bias Auditor, Proxy Detector, Explainability
// Lab, Adversarial Sandbox). Tool names, links and questions come from
// Toolkit.TOOLS in shared/toolkit.js, so the figure and the list under it
// cannot disagree. If the lab sequence changes, edit LABS below and the
// handouts.
(function () {
    const root = document.getElementById('course-figure');
    if (!root || !window.LineFigure || !window.Toolkit) return;
    const { iso, el, svg: makeSvg, box, nearest, interact } = window.LineFigure;

    // Lab -> tool, in course order. `lab` is the number on the handout.
    const LABS = [
        { lab: 1, tool: 'word-embeddings', topic: 'representation bias' },
        { lab: 2, tool: 'proxy-detector', topic: 'indirect discrimination' },
        { lab: 3, tool: 'bias-auditor', topic: 'fairness metrics' },
        { lab: 4, tool: 'filter-bubble', topic: 'feedback loops' },
        { lab: 5, tool: 'privacy-lab', topic: 'anonymisation' },
        { lab: 6, tool: 'privacy-lab', topic: 'differential privacy' },
        { lab: 7, tool: 'explainability-lab', topic: 'tabular explanations' },
        { lab: 8, tool: 'explainability-lab', topic: 'text explanations' },
        { lab: 9, tool: 'adversarial-sandbox', topic: 'gradient attacks' },
        { lab: 10, tool: 'value-alignment', topic: 'ethical frameworks' },
        { lab: 11, tool: 'llm-sandbox', topic: 'red teaming' },
        { lab: 12, tool: 'capstone', topic: 'full pipeline audit' },
    ];
    // Lab 12's phases, in order: the tools it sends the student back to.
    const CAPSTONE_USES = ['bias-auditor', 'proxy-detector', 'explainability-lab', 'adversarial-sandbox'];

    const TOOLS = Object.fromEntries(window.Toolkit.TOOLS.map(t => [t.id, t]));
    const TRAYS = [];                         // one per tool, in first-use order
    LABS.forEach(l => { if (!TRAYS.includes(l.tool)) TRAYS.push(l.tool); });

    const TRAY_W = 22;     // tray length along u (world units)
    const GAP = 5;         // gap between trays along u
    const DEPTH = 52;      // tray depth along v: deep enough that the climb reads as steps, not a sliver
    const T = 4;           // tray thickness
    const RISE = 10;       // each tray sits this much higher than the last: the climb
    const CARD_H = 36;     // height of a standing lab card
    const CARD_T = 2;      // card thickness along u
    const LIFT = 8;        // how far a picked card rises

    const trayU = i => i * (TRAY_W + GAP);
    const trayH = i => i * RISE;

    // Where each lab's card stands: centred on its tray, or two cards side by
    // side when a tool carries two labs. The capstone holds four thin sheets.
    const cards = LABS.map(l => {
        const ti = TRAYS.indexOf(l.tool);
        const siblings = LABS.filter(x => x.tool === l.tool);
        const k = siblings.indexOf(l);
        const u = trayU(ti) + (siblings.length === 1 ? TRAY_W / 2 : TRAY_W * (k === 0 ? 0.32 : 0.68)) - CARD_T / 2;
        return { ...l, ti, u, v0: 12, v1: DEPTH - 12, h: trayH(ti) };
    });

    const L = trayU(TRAYS.length - 1) + TRAY_W;
    const minY = (0 - L) * 0.5 - trayH(TRAYS.length - 1) - CARD_H - LIFT - 50;
    const maxY = (DEPTH - 0) * 0.5 + T + 10;
    const maxX = (L + DEPTH) * 0.866;
    const svg = makeSvg(root, `-10 ${minY.toFixed(1)} ${(maxX + 20).toFixed(1)} ${(maxY - minY).toFixed(1)}`,
        'A staircase of nine trays climbing from left to right, one per tool, in the order the course uses them. ' +
        'Twelve lab cards stand on the trays: Privacy and Explainability carry two labs each. The top tray is the ' +
        'Lab 12 capstone audit, which reuses the Bias Auditor, Proxy Detector, Explainability Lab and Adversarial Sandbox.');

    // Draw farthest first: larger u is farther back.
    const trayEls = [];
    const cardEls = [];
    for (let i = TRAYS.length - 1; i >= 0; i--) {
        const g = el('g', {}, svg);
        trayEls[i] = g;
        box(g, 'lf-solid').set(trayU(i), 0, trayH(i) - T, trayU(i) + TRAY_W, DEPTH, trayH(i));

        cards.filter(c => c.ti === i).forEach(c => {
            const cg = el('g', {}, svg);
            if (c.tool === 'capstone') {
                // four thin sheets, one per phase, fanned slightly
                const sheets = CAPSTONE_USES.map((_, k) => box(cg, 'lf-solid'));
                cardEls[cards.indexOf(c)] = { g: cg, sheets, c };
            } else {
                cardEls[cards.indexOf(c)] = { g: cg, card: box(cg, 'lf-solid'), c };
            }
        });
    }

    // Threads from the capstone back to the trays it reuses, drawn last so
    // they sit on top; hidden until Lab 12 is picked.
    const threads = el('g', { class: 'lf-ghost', opacity: 0 }, svg);
    const capTray = TRAYS.indexOf('capstone');
    const capTop = iso(trayU(capTray) + TRAY_W / 2, DEPTH / 2, trayH(capTray) + 4);
    const threadEls = CAPSTONE_USES.map(id => {
        const ti = TRAYS.indexOf(id);
        const p = iso(trayU(ti) + TRAY_W / 2, DEPTH / 2, trayH(ti) + 2);
        // a gentle arc above the staircase
        const mx = (capTop[0] + p[0]) / 2, my = Math.min(capTop[1], p[1]) - 44;
        return el('path', { class: 'lf-line', d: `M${p[0]},${p[1]} Q${mx},${my} ${capTop[0]},${capTop[1]}` }, threads);
    });

    // Lab numbers, set flat in screen space and centred under each tray's
    // front edge, drawn last so no tray line runs through them. (Printed on
    // the 4-unit tray edge, they were cut by its lines.) The nearer tray, one
    // step down-left, ends at least 14 units left of each label, so they stay
    // clear.
    const NUM_DROP = 15;  // baseline below the front-bottom edge midpoint; the edge slopes, so a label needs ~6 more than its height
    const numEls = TRAYS.map((id, i) => {
        const [x, y] = iso(trayU(i) + TRAY_W / 2, DEPTH, trayH(i) - T);
        const t = el('text', { x, y: y + NUM_DROP, 'text-anchor': 'middle', class: 'lf-text' }, svg);
        t.textContent = LABS.filter(l => l.tool === id).map(l => l.lab).join('–');
        return t;
    });

    const xs = cards.map(c => iso(c.u + CARD_T / 2, DEPTH / 2, 0)[0]);

    const name = c => c.tool === 'capstone' ? 'Capstone audit' : TOOLS[c.tool].name;
    const go = i => {
        const c = LABS[i];
        const target = c.tool === 'capstone' ? 'tools/bias-auditor.html' : 'tools/' + TOOLS[c.tool].file;
        window.location.href = target;
    };

    // Fit the viewBox to what was actually drawn (threads included), leaving
    // headroom for a lifted card, instead of the loose corner estimate above.
    const fit = () => {
        const b = svg.getBBox();
        svg.setAttribute('viewBox', [b.x - 6, b.y - LIFT - 6, b.width + 12, b.height + LIFT + 12].map(v => v.toFixed(1)).join(' '));
    };

    let current = -1;
    interact({
        root, svg, count: LABS.length,
        onChange: i => { current = i; root.style.cursor = i >= 0 ? 'pointer' : ''; },
        rest: 'Twelve labs on nine tools, climbing in course order. Pick a lab to see its topic.',
        describe: i => {
            const c = LABS[i];
            if (c.tool === 'capstone') {
                return 'Lab 12 · capstone audit · reuses the Bias Auditor, Proxy Detector, Explainability Lab and Adversarial Sandbox';
            }
            return `Lab ${c.lab} · ${TOOLS[c.tool].short} · ${c.topic}`;
        },
        pick: x => nearest(x, xs, 28),
        draw: (glow, active) => {
            cardEls.forEach((ce, i) => {
                const { c } = ce;
                const lift = LIFT * glow[i];
                if (ce.sheets) {
                    ce.sheets.forEach((sh, k) => {
                        const u = c.u - 6 + k * 4.4;
                        sh.set(u, c.v0 + k * 1.2, c.h + lift * (1 - k * 0.12), u + 1.4, c.v1 + k * 1.2, c.h + CARD_H * 0.8 + lift * (1 - k * 0.12));
                    });
                } else {
                    ce.card.set(c.u, c.v0, c.h + lift, c.u + CARD_T, c.v1, c.h + CARD_H + lift);
                }
                ce.g.classList.toggle('is-lit', i === active);
            });
            const activeTray = active >= 0 ? cards[active].ti : -1;
            trayEls.forEach((g, ti) => {
                const lit = ti === activeTray ||
                    (active >= 0 && LABS[active].tool === 'capstone' && CAPSTONE_USES.includes(TRAYS[ti]));
                g.classList.toggle('is-lit', lit);
                numEls[ti].classList.toggle('is-lit', lit);
            });
            const capIdx = LABS.findIndex(l => l.tool === 'capstone');
            threads.setAttribute('opacity', (glow[capIdx] || 0).toFixed(2));
            threads.classList.toggle('is-lit', active === capIdx);
        }
    });

    // Opening a tool from the figure: Enter on the keyboard, or a mouse click
    // on the lit card. Touch picks on the first tap and does not navigate, so
    // a finger can explore; the list under the figure carries the links.
    fit();

    root.addEventListener('keydown', e => {
        if (e.key === 'Enter' && current >= 0) go(current);
    });
    root.addEventListener('click', e => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (current >= 0) go(current);
    });
})();
