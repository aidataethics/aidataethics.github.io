// Privacy & Anonymization Lab (tools/privacy-lab.html): hiding in a crowd of k.
//
// A flat drawing of the lab's 36-patient table after k-anonymisation. Each box
// is one crowd (equivalence class): everyone whose released age band and ZIP
// match, so an attacker who knows your age and ZIP is left guessing among the
// people in your box. Each token is one patient, marked with their condition.
// Patients the search set aside (suppressed) wait in a dashed box.
//
// Nothing is precomputed. The figure calls the page's own
// findMinimalGeneralization, applyGeneralization and computeEquivalenceClasses
// on SAMPLE_DATA, so it always agrees with the Anonymize button below it. The
// suppression budget is fixed at 20%, the lab's default.
//
// What the interaction is for:
//   - the k slider shows crowds merging and loss climbing as k rises;
//   - the l = 2 switch shows what k alone misses: a crowd where everyone has
//     the same condition (outlined in red) gives the diagnosis away;
//   - hovering a token, or moving through crowds with the arrow keys, reads
//     out one patient's real row next to what is released about them;
//   - "Run this in the lab" hands the same settings to the full table below.
(function () {
    const root = document.getElementById('kanon-figure');
    const readout = document.getElementById('kanon-figure-readout');
    if (!root || typeof findMinimalGeneralization !== 'function') return;

    const SUPPRESSION = 0.20;
    const CODE = { Allergy: 'Al', Asthma: 'As', Cancer: 'Ca', Diabetes: 'Di', Flu: 'Fl', 'Heart Disease': 'HD' };
    // The viewBox width follows the figure's real width on screen, so one
    // unit is one CSS pixel and the labels below render at their stated size
    // at any window width; the crowds reflow instead of shrinking.
    let W = 660;
    const TOK = 30;         // token size
    const GAP = 4;          // between tokens
    const PAD = 8;          // inside a crowd box
    const PER_ROW = 6;      // tokens per row in a crowd
    const HEAD = 36;        // label space above each box
    const CROWD_GAP = 16;   // between boxes
    const NS = 'http://www.w3.org/2000/svg';

    const el = (tag, attrs = {}, parent) => {
        const n = document.createElementNS(NS, tag);
        Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
        if (parent) parent.appendChild(n);
        return n;
    };

    // ---------------------------------------------------------- controls
    root.insertAdjacentHTML('beforebegin', `
        <div class="kanon-controls text-left flex flex-wrap items-center gap-x-5 gap-y-2 mb-3 text-sm">
            <label class="flex items-center gap-2">
                <span class="font-semibold">k</span>
                <input id="kanonK" type="range" min="1" max="12" step="1" value="3" class="w-40 accent-primary"
                       aria-describedby="kanon-figure-readout">
                <output id="kanonKOut" for="kanonK" class="tabular-nums font-semibold w-6">3</output>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
                <input id="kanonL" type="checkbox" class="accent-primary">
                <span>every crowd needs 2 different conditions (l&nbsp;=&nbsp;2)</span>
            </label>
            <button id="kanonRun" type="button" class="text-primary hover:underline" style="margin-left:auto">Run this in the lab below</button>
        </div>`);
    const kInput = document.getElementById('kanonK');
    const kOut = document.getElementById('kanonKOut');
    const lInput = document.getElementById('kanonL');

    const svg = el('svg', { viewBox: `0 0 ${W} 200`, role: 'img', tabindex: '0',
        'aria-label': 'The 36 patients grouped into crowds that share a released age band and ZIP code.' }, root);
    svg.style.overflow = 'visible';

    let crowds = [];        // { key, age, zip, members:[{row, released}], homogeneous, g }
    let active = -1;
    let summary = '';

    function compute() {
        const k = +kInput.value;
        const l = lInput.checked ? 2 : 1;
        const res = findMinimalGeneralization(k, l, SUPPRESSION);
        if (!res) return { k, l, none: true };
        // res.generalized is SAMPLE_DATA generalised in the same order, and
        // res.kept holds the very objects that survived suppression.
        const index = new Map(res.generalized.map((g, i) => [g, i]));
        const kept = new Set(res.kept);
        const out = [];
        const setAside = [];
        Object.entries(computeEquivalenceClasses(res.generalized)).forEach(([key, members]) => {
            const rows = members.map(m => ({ row: SAMPLE_DATA[index.get(m)], released: m }));
            if (members.every(m => kept.has(m))) out.push({ key, age: members[0].Age, zip: members[0].ZIP, members: rows });
            else setAside.push(...rows);
        });
        out.sort((a, b) => parseInt(a.age) - parseInt(b.age) || a.zip.localeCompare(b.zip));
        out.forEach(c => { c.homogeneous = c.members.length > 1 && new Set(c.members.map(m => m.row.Condition)).size === 1; });
        if (setAside.length) out.push({ key: 'suppressed', suppressed: true, members: setAside });
        return { k, l, res, crowds: out };
    }

    function draw() {
        W = Math.max(280, Math.round(root.clientWidth || W));
        kOut.textContent = kInput.value;
        const r = compute();
        svg.replaceChildren();
        if (r.none) {
            crowds = [];
            el('text', { x: 0, y: 30, class: 'lf-label' }, svg).textContent =
                `No setting reaches k = ${r.k}${r.l > 1 ? ' with l = 2' : ''} without setting aside more than 20% of patients.`;
            svg.setAttribute('viewBox', `0 0 ${W} 50`);
            summary = 'No release possible at these settings.';
            readout.textContent = summary;
            return;
        }
        crowds = r.crowds;
        // flow layout
        let x = 0, y = 0, rowH = 0;
        crowds.forEach(c => {
            const n = c.members.length;
            const cols = Math.min(n, PER_ROW), rows = Math.ceil(n / PER_ROW);
            const bw = Math.max(cols * (TOK + GAP) - GAP + 2 * PAD, c.suppressed ? 120 : 96);
            const bh = rows * (TOK + GAP) - GAP + 2 * PAD;
            if (x + bw > W && x > 0) { x = 0; y += rowH + CROWD_GAP; rowH = 0; }
            c.x = x; c.y = y; c.w = bw; c.h = bh;
            x += bw + CROWD_GAP;
            rowH = Math.max(rowH, HEAD + bh);
        });
        const height = y + rowH;
        svg.setAttribute('viewBox', `0 0 ${W} ${height + 4}`);

        crowds.forEach((c, i) => {
            const g = el('g', { class: 'kanon-crowd' + (c.homogeneous ? ' is-homogeneous' : '') + (c.suppressed ? ' is-suppressed' : '') }, svg);
            c.g = g;
            const head = el('text', { x: c.x, y: c.y + 14, class: 'lf-label kanon-head' }, g);
            head.textContent = c.suppressed ? 'set aside' : `${c.age} · ${c.zip}`;
            const sub = el('text', { x: c.x, y: c.y + 29, class: 'lf-label kanon-sub' }, g);
            sub.textContent = c.suppressed ? `${c.members.length} suppressed`
                : c.homogeneous ? `all ${c.members[0].row.Condition}` : `${c.members.length} ${c.members.length === 1 ? 'alone' : 'together'}`;
            el('rect', { x: c.x, y: c.y + HEAD, width: c.w, height: c.h, rx: 5, class: 'kanon-box' }, g);
            c.members.forEach((m, j) => {
                const tx = c.x + PAD + (j % PER_ROW) * (TOK + GAP);
                const ty = c.y + HEAD + PAD + Math.floor(j / PER_ROW) * (TOK + GAP);
                const t = el('g', { class: 'kanon-token' }, g);
                el('rect', { x: tx, y: ty, width: TOK, height: TOK, rx: 3 }, t);
                el('text', { x: tx + TOK / 2, y: ty + TOK / 2 + 4.5, 'text-anchor': 'middle' }, t).textContent = CODE[m.row.Condition] || '?';
                t.addEventListener('pointerenter', () => { select(i, false); readout.textContent = describePatient(c, m); });
            });
            g.addEventListener('pointerenter', () => select(i, false));
        });

        const sizes = crowds.filter(c => !c.suppressed).map(c => c.members.length);
        const set = crowds.find(c => c.suppressed);
        const leaks = crowds.filter(c => c.homogeneous).length;
        const ageW = AGE_LEVELS[r.res.ageLevel], zipK = ZIP_LEVELS[r.res.zipLevel];
        const how = `${ageW === 1 ? 'exact ages' : ageW === null ? 'age removed' : ageW + '-year bands'}, ${zipK === 5 ? 'full ZIP' : zipK === 0 ? 'ZIP removed' : 'ZIP to ' + zipK + ' digits'}`;
        summary = `k = ${r.k}${r.l > 1 ? ', l = 2' : ''} · ${how} · ${sizes.length} crowds, smallest ${Math.min(...sizes)}` +
            (set ? ` · ${set.members.length} set aside` : '') + ` · information loss ${(r.res.loss * 100).toFixed(1)}%` +
            (leaks ? ` · ${leaks} crowd${leaks > 1 ? "s give" : " gives"} away the diagnosis` : "");
        active = -1;
        readout.textContent = summary;
    }

    function describePatient(c, m) {
        const p = m.row;
        if (c.suppressed) return `${p.Name}, ${p.Age}, ${p.ZIP}, ${p.Condition}: set aside, not released at all.`;
        const n = c.members.length;
        const same = c.members.filter(o => o.row.Condition === p.Condition).length;
        return `${p.Name}, ${p.Age}, ${p.ZIP}, ${p.Condition} → released as ${c.age} · ${c.zip}. ` +
            (n === 1 ? 'Alone in the crowd: anyone who knows the age and ZIP finds this row.'
                : `1 of ${n} who look alike; ${same === n ? 'all have ' + p.Condition + ', so the diagnosis leaks anyway' : same + ' of ' + n + ' have ' + p.Condition}.`);
    }

    function describeCrowd(c) {
        if (c.suppressed) return `Set aside: ${c.members.map(m => m.row.Name.split(' ')[0]).join(', ')}. Suppressed rather than blur everyone else further.`;
        const counts = {};
        c.members.forEach(m => { counts[m.row.Condition] = (counts[m.row.Condition] || 0) + 1; });
        return `${c.age} · ${c.zip}: ${c.members.length} patient${c.members.length > 1 ? 's' : ''} (${c.members.map(m => m.row.Name.split(' ')[0]).join(', ')}). ` +
            Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') + (c.homogeneous ? '. Same diagnosis for all: k hides who, not what.' : '.');
    }

    function select(i, announce = true) {
        active = i;
        crowds.forEach((c, j) => c.g && c.g.classList.toggle('is-lit', j === i));
        if (announce && crowds[i]) readout.textContent = describeCrowd(crowds[i]);
    }

    svg.addEventListener('pointerleave', () => { select(-1, false); readout.textContent = summary; });
    svg.addEventListener('keydown', e => {
        if (!crowds.length) return;
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (e.key in keys) {
            e.preventDefault();
            select(active < 0 ? 0 : (active + keys[e.key] + crowds.length) % crowds.length);
        } else if (e.key === 'Escape') { select(-1, false); readout.textContent = summary; }
    });
    // redraw when the width changes (window resize, or the tab first shown)
    let lastW = 0;
    new ResizeObserver(() => {
        const w = Math.round(root.clientWidth);
        if (w && Math.abs(w - lastW) > 4) { lastW = w; draw(); }
    }).observe(root);
    kInput.addEventListener('input', draw);
    lInput.addEventListener('change', draw);
    document.getElementById('kanonRun').addEventListener('click', () => {
        const set = (id, v) => { const n = document.getElementById(id); if (!n) return; n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); };
        set('kValue', kInput.value);
        set('lValue', lInput.checked ? 2 : 1);
        set('suppressValue', SUPPRESSION * 100);
        if (typeof applyAnonymization === 'function') applyAnonymization();
        document.getElementById('anonResult')?.closest('div')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    draw();
})();
