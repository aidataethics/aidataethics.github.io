/**
 * Shared chrome for every page in the AI & Data Ethics Toolkit.
 *
 * Before this existed the sidebar, footer, theme handling and mobile menu were
 * copy-pasted into ten files and had already drifted apart: setTheme differed
 * between pages, and the light-mode scrollbar rule existed only on index.html,
 * so every tool page rendered a dark scrollbar against a white background.
 *
 * Pages now supply only their own <main> content and call:
 *
 *     Toolkit.mountShell({ active: 'bias-auditor' });
 *
 * Theme resolution deliberately does NOT live here. It runs from a small
 * inline script in <head> so the correct theme is painted before first render;
 * loading it as an external file would reintroduce the flash of dark content
 * that light-mode users used to see on every page load.
 */
(function (global) {
    'use strict';

    // ---------------------------------------------------------------- tools

    const TOOLS = [
        {
            id: 'word-embeddings',
            name: 'Word Embeddings Workbench',
            short: 'Word Embeddings',
            icon: 'scatter_plot',
            color: 'blue',
            category: 'word-spaces',
            file: 'word-embeddings.html',
            lab: 'Lab 1',
            order: 1,
            question: 'What does a model learn about people from the words that surround them?',
            description: 'Explore vector arithmetic, measure gender bias with WEAT, and watch debiasing fail to remove it.'
        },
        {
            id: 'explainability-lab',
            name: 'Model Explainability Lab',
            short: 'Explainability Lab',
            icon: 'visibility',
            color: 'purple',
            category: 'explainability',
            file: 'explainability-lab.html',
            lab: 'Labs 7–8',
            order: 7,
            question: 'When a model decides, can we say why — and do two explanations agree?',
            description: 'Compare a sampled LIME surrogate against exact Shapley values on text, lending, health and risk-scoring models.'
        },
        {
            id: 'bias-auditor',
            name: 'Dataset Bias Auditor',
            short: 'Bias Auditor',
            icon: 'saved_search',
            color: 'orange',
            category: 'fairness',
            file: 'bias-auditor.html',
            lab: 'Lab 3',
            order: 3,
            question: 'Who is the model wrong about — and can it be fair to everyone at once?',
            description: 'Compute selection-rate and error-rate fairness metrics from a real confusion matrix, and see why they conflict.'
        },
        {
            id: 'adversarial-sandbox',
            name: 'Adversarial Robustness Sandbox',
            short: 'Adversarial Sandbox',
            icon: 'security',
            color: 'red',
            category: 'safety',
            file: 'adversarial-sandbox.html',
            lab: 'Lab 9',
            order: 9,
            question: 'How little must an image change before a classifier sees something else?',
            description: 'Run gradient-based FGSM attacks against MobileNet v2 in the browser and find the perturbation budget that breaks it.'
        },
        {
            id: 'filter-bubble',
            name: 'Filter Bubble Simulator',
            short: 'Filter Bubble Sim',
            icon: 'bubble_chart',
            color: 'teal',
            category: 'fairness',
            file: 'filter-bubble.html',
            lab: 'Lab 4',
            order: 4,
            question: 'How does a feed that learns from your clicks narrow what you see?',
            description: 'Watch an engagement-optimised feed narrow over time, with a chronological control to compare against.'
        },
        {
            id: 'privacy-lab',
            name: 'Privacy & Anonymization Lab',
            short: 'Privacy Lab',
            icon: 'vpn_key',
            color: 'indigo',
            category: 'privacy',
            file: 'privacy-lab.html',
            lab: 'Labs 5–6',
            order: 5,
            question: 'How much must a dataset be blurred before no one in it can be found?',
            description: 'Search the k-anonymity generalization lattice and spend a differential privacy budget until it runs out.'
        },
        {
            id: 'value-alignment',
            name: 'Value Alignment Tool',
            short: 'Value Alignment',
            icon: 'balance',
            color: 'pink',
            category: 'safety',
            file: 'value-alignment.html',
            lab: 'Lab 10',
            order: 10,
            question: 'When values conflict, which one does your design choose?',
            description: 'Work through 12 real AI dilemmas and see your choices mapped across five ethical frameworks.'
        },
        {
            id: 'proxy-detector',
            name: 'Proxy Variable Detector',
            short: 'Proxy Detector',
            icon: 'find_replace',
            color: 'cyan',
            category: 'fairness',
            file: 'proxy-detector.html',
            lab: 'Lab 2',
            order: 2,
            question: 'If race is deleted from the data, can a model still see it?',
            description: 'Measure how strongly ordinary features encode protected attributes, using the right statistic for each pair.'
        },
        {
            id: 'behavioral-testing',
            name: 'Behavioral Testing Lab',
            short: 'Behavioral Testing',
            icon: 'checklist',
            color: 'teal',
            category: 'explainability',
            file: 'behavioral-testing.html',
            lab: 'Project 3',
            // A group project between the explainability labs and the
            // adversarial lab: it tests the same sentiment model Labs 7-8 explain.
            order: 8.5,
            question: 'Which simple sentences does a model get wrong, and would accuracy ever tell you?',
            description: 'Write CheckList tests from templates and word lists, and measure where a sentiment model fails.'
        },
        {
            id: 'llm-sandbox',
            name: 'LLM Ethical Sandbox',
            short: 'LLM Ethical Sandbox',
            icon: 'chat',
            color: 'emerald',
            category: 'safety',
            file: 'llm-sandbox.html',
            lab: 'Lab 11',
            order: 11,
            question: 'Can a written rule stop a language model from doing what it is asked?',
            description: 'Red-team a small language model running entirely in your browser via WebGPU.'
        }
    ];

    // Teaching order: the sidebar and the overview list tools in the order the
    // course uses them, not in the order they happened to be built.
    TOOLS.sort((a, b) => a.order - b.order);

    const CATEGORIES = {
        'word-spaces': 'Word Spaces',
        'explainability': 'Explainability',
        'fairness': 'Fairness Lab',
        'privacy': 'Privacy',
        'safety': 'Safety'
    };

    const VERSION = '3.2.0';

    // Pages live either at the repo root or one level down in /tools.
    const inToolsDir = /\/tools\//.test(global.location.pathname);
    const base = inToolsDir ? '../' : '';
    const toolHref = tool => (inToolsDir ? '' : 'tools/') + tool.file;

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    // ---------------------------------------------------------------- shell

    function sidebarMarkup(active) {
        const item = (href, icon, label, isActive, extra = '') => `
            <a href="${href}"
               ${isActive ? 'aria-current="page"' : ''}
               class="flex items-center px-3 py-2 rounded-lg text-sm transition-colors group ${isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-dark-lighter hover:text-slate-900 dark:hover:text-white'}">
                <span class="material-icons-outlined mr-3 text-lg ${isActive ? '' : 'group-hover:text-primary transition-colors'}"
                      aria-hidden="true">${icon}</span>
                <span>${esc(label)}</span>${extra}
            </a>`;

        return `
        <div class="fixed inset-0 bg-black/50 z-40 hidden transition-opacity opacity-0" id="mobileOverlay" hidden></div>
        <aside id="sidebar" aria-label="Toolkit navigation"
            class="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 transform -translate-x-full md:translate-x-0">
            <div class="h-20 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800">
                <a href="${base}index.html" class="wordmark" aria-label="AI and Data Ethics Toolkit, home">
                    <span class="wm-line" aria-hidden="true">AI <span class="wm-amp">&amp;</span> Data Ethics</span>
                    <span class="wm-sub" aria-hidden="true">Toolkit</span>
                </a>
                <button id="closeSidebar" type="button" aria-label="Close navigation"
                    class="md:hidden text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    <span class="material-icons-outlined" aria-hidden="true">close</span>
                </button>
            </div>
            <nav class="flex-1 overflow-y-auto py-6 px-3 space-y-1" aria-label="Tools">
                ${item(base + 'index.html', 'grid_view', 'All tools', active === 'overview')}
                <div class="pt-4 pb-2 px-3">
                    <h2 class="eyebrow">Labs, in course order</h2>
                </div>
                ${TOOLS.map(t => item(toolHref(t), t.icon, t.short, active === t.id,
                    `<span class="ml-auto pl-2 text-xs tabular-nums text-slate-400">${esc(t.lab.replace(/^Labs? /, '').replace(/^Project /, 'P'))}</span>`)).join('')}
            </nav>
            <div class="border-t border-slate-200 dark:border-slate-800 p-4">
                <p class="text-xs text-slate-400 mb-2">© 2026
                    <a href="https://hamedyaghoobian.com" class="text-primary hover:underline"
                       target="_blank" rel="noopener">Hamed Yaghoobian</a></p>
                <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Version ${VERSION}</span>
                    <a class="hover:text-primary transition-colors" href="${base}legal.html">Legal</a>
                </div>
            </div>
        </aside>`;
    }

    function footerMarkup() {
        return `
        <footer class="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800">
            <div class="text-center text-xs text-slate-400 dark:text-slate-500 px-4 leading-relaxed">
                <p>AI &amp; Data Ethics Toolkit &copy; 2026 Hamed Yaghoobian.<br>
                    Developed for the Department of Mathematics, Computer Science, and Statistics at Muhlenberg College.<br>
                    Feedback: <a href="mailto:hamedyaghoobian@muhlenberg.edu"
                        class="hover:text-primary transition-colors">hamedyaghoobian@muhlenberg.edu</a></p>
            </div>
        </footer>`;
    }

    // ------------------------------------------------------------- behaviour

    function wireMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobileOverlay');
        const openBtn = document.getElementById('openSidebar');
        const closeBtn = document.getElementById('closeSidebar');
        if (!sidebar || !overlay) return;

        let open = false;
        function setOpen(next) {
            open = next;
            sidebar.classList.toggle('-translate-x-full', !open);
            if (open) {
                overlay.hidden = false;
                overlay.classList.remove('hidden');
                requestAnimationFrame(() => overlay.classList.remove('opacity-0'));
            } else {
                overlay.classList.add('opacity-0');
                setTimeout(() => { overlay.classList.add('hidden'); overlay.hidden = true; }, 300);
            }
            if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
            if (open) closeBtn?.focus(); else openBtn?.focus();
        }

        openBtn?.addEventListener('click', () => setOpen(true));
        closeBtn?.addEventListener('click', () => setOpen(false));
        overlay.addEventListener('click', () => setOpen(false));
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) setOpen(false); });

        if (openBtn) {
            openBtn.setAttribute('aria-expanded', 'false');
            openBtn.setAttribute('aria-controls', 'sidebar');
        }
    }

    // The head script owns initial paint; this only wires the toggle control.
    function wireThemeToggle() {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;
        // The control was a bare icon; give it a name a screen reader announces.
        toggle.setAttribute('aria-label', 'Dark theme');
        toggle.setAttribute('role', 'switch');
        const sync = () => { toggle.checked = document.documentElement.classList.contains('dark'); };
        sync();
        toggle.addEventListener('change', () => {
            global.__setToolkitTheme(toggle.checked);
            document.dispatchEvent(new CustomEvent('toolkit:themechange', {
                detail: { dark: toggle.checked }
            }));
        });
        // The OS can change the theme too (see the <head> script).
        document.addEventListener('toolkit:themechange', sync);
    }

    // ------------------------------------------------------------- charts
    //
    // Plotly charts were written with hard-coded hex colours chosen for the
    // old dark dashboard, decided once at render time, so switching theme left
    // them in the wrong colours. Every newPlot/react/relayout now passes
    // through a mapper that resolves each colour to a role (series 1-4,
    // pass/fail/caution, axis, grid, text) and then to the current theme's
    // value; on a theme change every live chart is re-mapped in place. The
    // mapping is idempotent, so a chart drawn before this file loaded is
    // fixed up too.

    const CHART = {
        light: { c1: '#2749b8', c2: '#8a3d7e', c3: '#6d5bb0', c4: '#1f7a72', warn: '#9a5a00',
                 success: '#2e7d4f', danger: '#b3261e', neutral: '#6e6d70', axis: '#5f5f66',
                 grid: '#e6e1d4', text: '#1b2030', surface: '#fffdf8' },
        dark:  { c1: '#8ea6f0', c2: '#d08ac4', c3: '#b3a6ee', c4: '#6cc2b3', warn: '#e3b04b',
                 success: '#7cc79c', danger: '#ef8a7f', neutral: '#8b8a90', axis: '#9a968c',
                 grid: '#2a2f3c', text: '#e8e4d8', surface: '#151a25' }
    };
    const ROLE = {};
    [['c1', '#137fec #3b82f6 #2563eb #0f6bd1 #4da3f5'],
     ['c2', '#ec4899 #f472b6'],
     ['c3', '#8b5cf6 #a855f7 #7c3aed #6366f1'],
     ['c4', '#06b6d4 #14b8a6 #0891b2'],
     ['warn', '#f59e0b #ca8a04 #eab308 #f97316 #fde047 #fdba74'],
     ['success', '#22c55e #15803d #10b981'],
     ['danger', '#ef4444 #dc2626 #b91c1c #991b1b #fca5a5'],
     ['neutral', '#64748b'],
     ['axis', '#475569 #94a3b8'],
     ['grid', '#e2e8f0 #1e293b #334155 #cbd5e1 #f1f5f9 #0f172a'],
     ['surface', '#f8fafc #ffffff']
    ].forEach(([role, list]) => list.split(' ').forEach(h => { ROLE[h] = role; }));
    Object.values(CHART).forEach(pal => Object.entries(pal).forEach(([role, h]) => { ROLE[h] = role; }));

    const isDark = () => document.documentElement.classList.contains('dark');

    function mapColor(value, key, inFont) {
        const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
        if (!m) return value;
        let role = ROLE['#' + m[1].toLowerCase()];
        if (!role) return value;
        if (/gridcolor|zerolinecolor|linecolor|bordercolor/i.test(key)) role = 'grid';
        else if (inFont && (role === 'grid' || role === 'axis')) role = 'text';
        return CHART[isDark() ? 'dark' : 'light'][role] + (m[2] || '');
    }

    function mapSpec(node, key = '', inFont = false) {
        if (typeof node === 'string') return mapColor(node, key, inFont);
        if (Array.isArray(node)) return node.map(v => mapSpec(v, key, inFont));
        if (node && typeof node === 'object' && Object.getPrototypeOf(node) === Object.prototype) {
            const out = {};
            Object.entries(node).forEach(([k, v]) => {
                if (k.startsWith('_')) return;
                out[k] = mapSpec(v, k, inFont || /font$/i.test(k));
            });
            return out;
        }
        return node;
    }

    // Fill in the colours a chart left to Plotly's defaults (dark grey text,
    // pale grid), which are built for a white page and vanish or glare on the
    // dark one. Colours a page sets itself are kept, mapped by mapSpec above.
    function themedLayout(layout) {
        const l = mapSpec(layout || {});
        const pal = CHART[isDark() ? 'dark' : 'light'];
        l.font = Object.assign({ color: pal.text }, l.font, { family: '"IBM Plex Sans", system-ui, sans-serif' });
        const axis = a => Object.assign({ gridcolor: pal.grid, zerolinecolor: pal.grid, linecolor: pal.grid }, a);
        const axisKeys = new Set(['xaxis', 'yaxis', ...Object.keys(l).filter(k => /^[xy]axis\d*$/.test(k))]);
        axisKeys.forEach(k => { l[k] = axis(l[k]); });
        if (l.scene) ['xaxis', 'yaxis', 'zaxis'].forEach(k => { l.scene[k] = axis(l.scene[k]); });
        if (l.polar) ['radialaxis', 'angularaxis'].forEach(k => { l.polar[k] = axis(l.polar[k]); });
        return l;
    }

    function installChartTheme() {
        const P = global.Plotly;
        if (!P || P.__toolkitThemed) return;
        P.__toolkitThemed = true;
        const wrap = name => {
            const orig = P[name].bind(P);
            P[name] = (gd, data, layout, config) => orig(gd, mapSpec(data), themedLayout(layout), config);
        };
        wrap('newPlot');
        wrap('react');
        const relayout = P.relayout.bind(P);
        P.relayout = (gd, update, ...rest) =>
            relayout(gd, typeof update === 'object' ? mapSpec(update) : update, ...rest);

        const retheme = () => document.querySelectorAll('.js-plotly-plot').forEach(gd => {
            if (gd.data) P.react(gd, gd.data, gd.layout);
        });
        document.addEventListener('toolkit:themechange', retheme);
        retheme();   // charts drawn before this file loaded
    }

    // The question a tool answers, set under its title. Kept in TOOLS so the
    // sidebar, the overview and each page say the same thing.
    function mountQuestion(active) {
        const tool = TOOLS.find(t => t.id === active);
        const h1 = document.querySelector('main h1');
        if (!tool || !h1 || document.querySelector('.tool-question')) return;
        const eyebrow = document.createElement('p');
        eyebrow.className = 'eyebrow mb-1';
        eyebrow.textContent = tool.lab;
        h1.parentNode.insertBefore(eyebrow, h1);
        const q = document.createElement('p');
        q.className = 'tool-question mt-1 mb-1';
        q.textContent = tool.question;
        h1.insertAdjacentElement('afterend', q);
    }

    function mountShell(options = {}) {
        const { active = null } = options;

        document.body.insertAdjacentHTML('afterbegin', sidebarMarkup(active));

        const main = document.querySelector('main');
        if (main && !main.querySelector('footer')) {
            main.insertAdjacentHTML('beforeend', footerMarkup());
        }

        wireMobileMenu();
        wireThemeToggle();
        mountQuestion(active);
        installChartTheme();

        if (global.ToolkitSession && active && active !== 'overview') {
            global.ToolkitSession.startTool(active);
        }
    }

    // ------------------------------------------------------- shareable state
    //
    // Tool configuration is mirrored into the URL hash so a student can paste a
    // link into a lab report and you get their exact run back, and so labs can
    // hand out pre-configured links ("open the auditor already set to
    // Race x PredictedRisk"). Values are read on load and written on change.

    const stateApi = {
        read() {
            const hash = global.location.hash.replace(/^#/, '');
            if (!hash) return {};
            const out = {};
            new URLSearchParams(hash).forEach((v, k) => { out[k] = v; });
            return out;
        },

        write(values) {
            const params = new URLSearchParams();
            Object.entries(values).forEach(([k, v]) => {
                if (v !== null && v !== undefined && v !== '') params.set(k, v);
            });
            const next = params.toString();
            // replaceState keeps the back button meaning "previous page", not
            // "previous slider position".
            history.replaceState(null, '', next ? '#' + next : global.location.pathname + global.location.search);
        },

        /**
         * Two-way bind a set of controls to the URL hash.
         *
         * @param {string[]} ids   element ids to sync
         * @param {object}   opts  onRestore() runs after values are applied
         * @returns {{capture: function, link: function}}
         */
        bind(ids, opts = {}) {
            const els = () => ids.map(id => document.getElementById(id)).filter(Boolean);
            const valueOf = el => el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value;

            // Snapshot the incoming link ONCE. Restoring dispatches change
            // events, which trigger sync, which would otherwise overwrite the
            // hash with whatever is currently in the controls - wiping values
            // meant for dropdowns that have not been populated yet.
            const incoming = stateApi.read();
            let restoring = false;

            const capture = () => {
                const out = {};
                els().forEach(el => { out[el.id] = valueOf(el); });
                return out;
            };

            // Merge rather than replace: keys written by the page outside this
            // bound set (a dataset choice, a scenario name) must survive.
            const sync = () => {
                if (restoring) return;
                stateApi.write(Object.assign(stateApi.read(), capture()));
            };

            // Safe to call repeatedly. Options that arrive asynchronously (CSV
            // columns, scenario attributes) only become settable once their
            // dropdown has been populated, so pages call this again afterwards.
            const restore = () => {
                restoring = true;
                let applied = 0;
                els().forEach(el => {
                    if (!(el.id in incoming)) return;
                    const wanted = incoming[el.id];
                    if (el.type === 'checkbox') {
                        el.checked = wanted === '1';
                    } else {
                        const options = el.tagName === 'SELECT' ? [...el.options].map(o => o.value) : null;
                        if (options && !options.includes(wanted)) return;   // not populated yet
                        el.value = wanted;
                    }
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    applied++;
                });
                restoring = false;
                return applied;
            };

            els().forEach(el => {
                el.addEventListener('change', sync);
                if (el.type === 'range' || el.tagName === 'INPUT') el.addEventListener('input', sync);
            });

            const applied = restore();
            if (applied && typeof opts.onRestore === 'function') {
                setTimeout(() => opts.onRestore(applied), 0);
            }

            return { capture, restore, sync, incoming, link: () => global.location.href };
        },

        /** Wire a "copy link to this configuration" button. */
        wireCopyButton(buttonId) {
            const btn = document.getElementById(buttonId);
            if (!btn) return;
            btn.addEventListener('click', async () => {
                const original = btn.textContent;
                try {
                    await navigator.clipboard.writeText(global.location.href);
                    btn.textContent = 'Link copied';
                } catch (e) {
                    btn.textContent = 'Copy failed — use the address bar';
                }
                global.ToolkitSession?.record('share.link', {});
                setTimeout(() => { btn.textContent = original; }, 2200);
            });
        }
    };

    // ------------------------------------------------------------- reporting
    //
    // A shared, self-contained HTML report so every tool can produce lab
    // evidence. It carries its own stylesheet: exported files must not depend
    // on Tailwind or an icon font being present, which an earlier DOM-scraping
    // export did, and which rendered icon ligature names as body text.

    const REPORT_CSS = `
  :root { color-scheme: light; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
         max-width: 880px; margin: 2.5em auto; padding: 0 1.5em; color: #1e293b; line-height: 1.6; }
  h1 { color: #0f172a; font-size: 1.7rem; margin-bottom: .15em; }
  h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: .06em; color: #475569;
       border-bottom: 2px solid #0f172a; padding-bottom: .4em; margin-top: 2.2em; }
  .sub { color: #64748b; margin-top: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: .9rem; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
  th { background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: .78rem;
       text-transform: uppercase; letter-spacing: .05em; color: #475569; }
  td.num, .num { font-variant-numeric: tabular-nums; text-align: right; }
  img { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 6px; margin: 1em 0; }
  .note { background: #f8fafc; border-left: 3px solid #94a3b8; padding: 10px 14px;
          font-size: .88rem; color: #475569; margin: 1em 0; }
  .link { word-break: break-all; font-family: ui-monospace, Menlo, monospace; font-size: .78rem; color: #2563eb; }
  footer { margin-top: 3em; padding-top: 1em; border-top: 1px solid #e2e8f0;
           font-size: .8rem; color: #94a3b8; }`;

    const reportApi = {
        /** Render a Plotly chart to a PNG data URI, or null if unavailable. */
        async chartImage(elementId, opts = {}) {
            const el = document.getElementById(elementId);
            if (!el || !global.Plotly || !el.data) return null;
            try {
                return await global.Plotly.toImage(el, {
                    format: 'png',
                    width: opts.width || 900,
                    height: opts.height || 450,
                    scale: 2
                });
            } catch (e) {
                return null;
            }
        },

        /**
         * @param {object} o
         * @param {string} o.tool     tool id, used in the filename
         * @param {string} o.title    report heading
         * @param {object} o.config   key/value rows describing the configuration
         * @param {Array}  o.sections [{ heading, html }]
         */
        download(o) {
            const rows = Object.entries(o.config || {})
                .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
            const body = (o.sections || [])
                .filter(s => s && s.html)
                .map(s => `<h2>${esc(s.heading)}</h2>\n${s.html}`).join('\n');

            const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(o.title)}</title>
<style>${REPORT_CSS}</style></head><body>
<h1>${esc(o.title)}</h1>
<p class="sub">${new Date().toLocaleString()}</p>
${rows ? `<h2>Configuration</h2><table>${rows}</table>` : ''}
${body}
<h2>Reproduce this run</h2>
<p class="note">Open this link to restore the exact configuration above:<br>
<span class="link">${esc(global.location.href)}</span></p>
<footer>Generated by the AI &amp; Data Ethics Toolkit v${VERSION}. Sample datasets are synthetic;
see <code>data/generate_samples.py</code> for the generating process.</footer>
</body></html>`;

            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${o.tool || 'toolkit'}_report.html`.replace(/[^\w.\-]/g, '_');
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            global.ToolkitSession?.record('export', { kind: 'report', tool: o.tool });
        }
    };

    global.Toolkit = { TOOLS, CATEGORIES, VERSION, mountShell, esc, base, toolHref,
                       state: stateApi, report: reportApi };
})(window);
