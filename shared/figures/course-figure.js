// Home page (index.html): the course as a map. Weeks run left to right, the
// eleven tools top to bottom, and each lab is a node where its tool meets the
// week it is released. A tool used twice (Privacy, Explainability) has two
// nodes on its row; Group Project 3 spans weeks 10-12; Lab 11 uses two tools
// (text, then images and voice); the Lab 12 capstone in week 14 sends you back
// to four earlier tools at once.
//
// Picking a lab (pointer, or arrow keys in course order) says what you work
// out by hand in lecture that week and what the tool then measures at scale,
// with a link to open it - the two halves of every lab. Enter opens the tool.
//
// Data: weeks from tentative_schedule.md (lab release weeks); the by-hand and
// at-scale lines summarise each week's board activity and lab handout. Tool
// names, files and questions come from Toolkit.TOOLS, so this figure and the
// list beside it cannot disagree. If the schedule changes, edit LABS.
(function () {
    const root = document.getElementById('course-figure');
    const readout = document.getElementById('course-figure-readout');
    if (!root || !window.Toolkit) return;

    const LABS = [
        { id: '1', week: 2, tool: 'word-embeddings', topic: 'representation bias',
          hand: 'a cosine similarity, with a pencil, for one profession and he / she',
          scale: 'the same lean for thirty professions, on models of four sizes' },
        { id: '2', week: 3, tool: 'proxy-detector', topic: 'indirect discrimination',
          hand: 'guess race from one column of twelve loan applications',
          scale: 'how strongly every feature carries a protected attribute' },
        { id: '3', week: 4, tool: 'bias-auditor', topic: 'fairness metrics',
          hand: 'two confusion matrices from twenty cases: precision and false positive rate',
          scale: 'eight fairness metrics on 600 records, and why they disagree' },
        { id: '4', week: 5, tool: 'filter-bubble', topic: 'feedback loops',
          hand: 'one click of profile drift, and the entropy of three feeds',
          scale: 'a feed narrowing over a hundred steps, against a chronological control' },
        { id: '5', week: 6, tool: 'privacy-lab', topic: 'anonymisation',
          hand: 'link two tables to re-identify patients, then make eight rows 2-anonymous',
          scale: 'k-anonymity and l-diversity across all 36 patients' },
        { id: '6', week: 7, tool: 'privacy-lab', topic: 'differential privacy',
          hand: 'Laplace noise for one count, and an epsilon budget split three ways',
          scale: 'fifty noisy answers, and a budget that runs out' },
        { id: '7', week: 9, tool: 'explainability-lab', topic: 'tabular explanations',
          hand: 'Shapley values for a three-feature loan model, every order',
          scale: 'SHAP waterfalls for loan, health and recidivism decisions' },
        { id: '8', week: 10, tool: 'explainability-lab', topic: 'text explanations',
          hand: 'delete words from a review and re-score it yourself',
          scale: 'LIME against SHAP on a sentiment model, and counterfactuals' },
        { id: 'P3', week: 10, span: 3, tool: 'behavioral-testing', topic: 'CheckList tests, in groups',
          hand: 'label eight real test cases and compute a failure rate',
          scale: 'a whole behavioural test suite, then one your group writes' },
        { id: '9', week: 11, tool: 'adversarial-sandbox', topic: 'adversarial attacks',
          hand: 'an FGSM step on a 3 × 3 image',
          scale: 'the same attack on a real image classifier, MobileNet V2' },
        { id: '10', week: 12, tool: 'value-alignment', topic: 'ethical frameworks',
          hand: 'hack a reward function, then score one dilemma two ways',
          scale: 'twelve dilemmas across five frameworks, and your profile' },
        { id: '11', week: 13, tool: 'llm-sandbox', also: 'multimodal-sandbox', topic: 'red teaming',
          hand: 'draw the prompt stack, beat a word blacklist, and score one transcript\'s word error rate',
          scale: 'a system prompt and a secret to protect, attacked in words, in a picture and out loud' },
        { id: '12', week: 14, tool: 'capstone', topic: 'full pipeline audit',
          hand: 'impact ratios for a hiring audit, and one section of an impact statement',
          scale: 'one system through four tools, ending in an Algorithmic Impact Statement' },
    ];
    const CAPSTONE_USES = ['bias-auditor', 'proxy-detector', 'explainability-lab', 'adversarial-sandbox'];
    const MARKERS = [{ week: 8, text: 'midterm' }, { week: 15, text: 'showcase' }];

    const TOOLS = window.Toolkit.TOOLS;                 // in course order
    const byId = Object.fromEntries(TOOLS.map(t => [t.id, t]));
    const ROWS = TOOLS.map(t => t.id);
    const NS = 'http://www.w3.org/2000/svg';
    const LABEL_W = 156, COL = 27, ROW = 30, TOP = 32, R = 12;
    const W = LABEL_W + 15 * COL + 6;
    const H = TOP + ROWS.length * ROW + 46;
    const X = week => LABEL_W + (week - 0.5) * COL;
    const Y = row => TOP + (row + 0.5) * ROW;

    const el = (tag, attrs = {}, parent) => {
        const n = document.createElementNS(NS, tag);
        Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
        if (parent) parent.appendChild(n);
        return n;
    };
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: '0',
        'aria-label': 'Course map: fifteen weeks across, eleven tools down. Each lab is a dot where its tool meets the week it starts; '
            + 'Lab 12 in week 14 reuses four earlier tools.' }, root);
    svg.classList.add('course-map');

    // grid: week columns, tool rows
    for (let w = 1; w <= 15; w++) {
        el('line', { x1: X(w), y1: TOP - 4, x2: X(w), y2: TOP + ROWS.length * ROW, class: 'cm-grid' }, svg);
        el('text', { x: X(w), y: TOP - 13, 'text-anchor': 'middle', class: 'lf-label cm-week' }, svg).textContent = w;
    }
    el('text', { x: LABEL_W - 8, y: TOP - 13, 'text-anchor': 'end', class: 'lf-label cm-week' }, svg).textContent = 'week';
    const rowLabels = ROWS.map((id, r) => {
        el('line', { x1: LABEL_W, y1: Y(r), x2: X(15) + 6, y2: Y(r), class: 'cm-row' }, svg);
        const t = el('text', { x: LABEL_W - 8, y: Y(r) + 4.5, 'text-anchor': 'end', class: 'lf-label cm-tool' }, svg);
        t.textContent = byId[id].short;
        return t;
    });
    MARKERS.forEach(m => {
        el('text', { x: X(m.week), y: TOP + ROWS.length * ROW + 38, 'text-anchor': 'middle', class: 'lf-label cm-marker' }, svg).textContent = m.text;
    });

    // capstone threads: week 14, back to four tools' rows
    const capRows = CAPSTONE_USES.map(id => ROWS.indexOf(id));
    const threads = el('g', { class: 'cm-threads' }, svg);
    const capY = TOP + ROWS.length * ROW - 2;
    capRows.forEach(r => el('line', { x1: X(14), y1: Y(r), x2: X(14), y2: capY, class: 'cm-thread' }, threads));

    // nodes
    const nodes = LABS.map((lab, i) => {
        const g = el('g', { class: 'cm-node' }, svg);
        if (lab.tool === 'capstone') {
            capRows.forEach(r => el('circle', { cx: X(14), cy: Y(r), r: R - 3, class: 'cm-dot cm-cap' }, g));
            el('rect', { x: X(14) - R - 1, y: capY - 1, width: 2 * R + 2, height: 20, rx: 10, class: 'cm-dot' }, g);
            el('text', { x: X(14), y: capY + 13.5, 'text-anchor': 'middle', class: 'cm-num' }, g).textContent = '12';
        } else {
            const r = ROWS.indexOf(lab.tool);
            if (lab.span) {
                el('rect', { x: X(lab.week) - R, y: Y(r) - R, width: (lab.span - 1) * COL + 2 * R, height: 2 * R, rx: R, class: 'cm-dot' }, g);
            } else {
                el('circle', { cx: X(lab.week), cy: Y(r), r: R, class: 'cm-dot' }, g);
            }
            el('text', { x: X(lab.week + ((lab.span || 1) - 1) / 2), y: Y(r) + 4, 'text-anchor': 'middle', class: 'cm-num' }, g).textContent = lab.id;
            if (lab.also) {
                // the same lab on a second tool's row, joined by a thread
                const r2 = ROWS.indexOf(lab.also);
                el('line', { x1: X(lab.week), y1: Y(r) + R, x2: X(lab.week), y2: Y(r2) - R, class: 'cm-thread cm-pair' }, g);
                el('circle', { cx: X(lab.week), cy: Y(r2), r: R, class: 'cm-dot' }, g);
                el('text', { x: X(lab.week), y: Y(r2) + 4, 'text-anchor': 'middle', class: 'cm-num' }, g).textContent = lab.id;
            }
        }
        g.addEventListener('pointerenter', () => select(i));
        g.addEventListener('click', () => { select(i); open(i); });
        return g;
    });

    // ------------------------------------------------------------ readout
    const note = root.parentElement.querySelector('.project-figure__note');
    const rest = 'Fifteen weeks, eleven tools. Pick a lab to see what you work out by hand, and what the tool then measures.';
    let current = -1;

    function title(lab) {
        return lab.id === 'P3' ? 'Project 3' : `Lab ${lab.id}`;
    }
    function href(lab) {
        return 'tools/' + (lab.tool === 'capstone' ? byId['bias-auditor'].file : byId[lab.tool].file);
    }
    function select(i) {
        current = i;
        nodes.forEach((g, j) => g.classList.toggle('is-lit', j === i));
        const lab = LABS[i];
        rowLabels.forEach((t, r) => t.classList.toggle('is-lit', lab && (ROWS[r] === lab.tool || ROWS[r] === lab.also ||
            (lab.tool === 'capstone' && CAPSTONE_USES.includes(ROWS[r])))));
        threads.classList.toggle('is-lit', lab && lab.tool === 'capstone');
        if (!lab) { readout.textContent = rest; return; }
        const tool = lab.tool === 'capstone' ? 'Lab 12'
            : byId[lab.tool].name + (lab.also ? ' and the ' + byId[lab.also].name : '');
        readout.innerHTML = '';
        const head = document.createElement('strong');
        head.textContent = `${title(lab)} · week ${lab.week}${lab.span ? '–' + (lab.week + lab.span - 1) : ''} · ${lab.topic}`;
        const by = document.createElement('span');
        by.className = 'cm-line';
        by.textContent = `By hand: ${lab.hand}.`;
        const at = document.createElement('span');
        at.className = 'cm-line';
        at.textContent = `In ${tool}: ${lab.scale}.`;
        const a = document.createElement('a');
        a.href = href(lab);
        a.className = 'cm-open';
        a.textContent = lab.tool === 'capstone' ? 'Start with the Bias Auditor →' : `Open ${byId[lab.tool].short} →`;
        readout.append(head, by, at, a);
        if (lab.also) {
            const b = document.createElement('a');
            b.href = 'tools/' + byId[lab.also].file;
            b.className = 'cm-open';
            b.style.marginLeft = '1rem';
            b.textContent = `Open ${byId[lab.also].short} →`;
            readout.append(b);
        }
    }
    function open(i) { window.location.href = href(LABS[i]); }

    svg.addEventListener('keydown', e => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (step) { e.preventDefault(); select(current < 0 ? 0 : (current + step + LABS.length) % LABS.length); }
        else if (e.key === 'Enter' && current >= 0) open(current);
        else if (e.key === 'Escape') select(-1);
    });
    if (note) note.textContent = 'Arrow keys or pointer to pick a lab; Enter or click opens its tool.';
    select(-1);
})();
