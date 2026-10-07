# AI & Data Ethics Toolkit

Nine browser-based labs for an undergraduate AI and data ethics course. Everything
runs client-side: no server, no accounts, no data leaves the machine.

Built for CSI 205 (AI and Data Ethics) in the Department of
Mathematics, Computer Science, and Statistics at Muhlenberg College.

Live at **https://aidataethics.github.io**

---

## Running it locally

The tools `fetch()` datasets and model files, which browsers block on `file://`.
Serve the directory over HTTP:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Nothing else is required — the JavaScript
libraries are vendored in `vendor/` and the stylesheet is pre-built, so the
toolkit works with no network connection.

The one exception is the **LLM Ethical Sandbox**, which needs WebGPU and
downloads roughly 1.2 GB of model weights from Hugging Face on first use. Plan
for that before running it with a full class on shared wifi.

Set a **secret to watch for** and every reply is checked for it, in the answer
and in the reasoning. A model that keeps a secret out of its answer but writes
it into a visible chain of thought has still leaked it, and the tool says so.

It runs a *reasoning* model: it writes a private `<think>` block before
answering, often 500–2000 tokens, so first replies can take a while. The
reasoning budget slider defaults to no cap, because a cap that fires mid-thought
aborts generation before any answer is written. If that does happen, the reply
offers a one-click retry that asks for a direct answer instead.

---

## The tools

| Tool | What it does |
| --- | --- |
| Word Embeddings Workbench | Vector arithmetic, WEAT bias measurement, and a debiasing demo that shows why projection does not work |
| Model Explainability Lab | A sampled LIME surrogate next to exact Shapley values, on text and tabular models |
| Dataset Bias Auditor | Selection-rate and error-rate fairness metrics from a real confusion matrix |
| Adversarial Robustness Sandbox | FGSM attacks against MobileNet v2, in the browser |
| Filter Bubble Simulator | Feed diversity under engagement optimisation, with a chronological control |
| Privacy & Anonymization Lab | k-anonymity lattice search, l-diversity, and a differential privacy budget you can exhaust |
| Value Alignment Tool | Twelve real AI dilemmas mapped across five ethical frameworks |
| Proxy Variable Detector | How strongly ordinary features encode protected attributes |
| LLM Ethical Sandbox | Red-teaming a small language model running locally via WebGPU, with automatic leak detection |

---

## Datasets

The three sample datasets are **synthetic** and generated from a documented
process in [`data/generate_samples.py`](data/generate_samples.py). Every
disparity a student finds traces back to a line in that file.

```bash
npm run data          # or: python3 data/generate_samples.py
```

`recidivism-sample.csv` reproduces the COMPAS impossibility result. The risk
score is a deterministic decile of each person's true probability, so it is
perfectly calibrated by construction — and its false positive rate is still
about 1.8× higher for Black defendants, matching the ratio ProPublica measured.
Calibration is enforced deliberately so the gap cannot be blamed on a bad model.
It follows from unequal base rates alone.

Each dataset carries both a **decision** column and a **ground-truth** column.
Error-rate fairness metrics need both; where ground truth is missing the auditor
reports those metrics as unavailable rather than as passing.

The word embeddings tool ships **two model tiers**, and the difference between
them is part of the lesson:

| Tier | Vocabulary | Dimensions | Size | Loads |
| --- | --- | --- | --- | --- |
| Small | 5,061 words | 50d | 1.0 MB | on page open |
| Large | 20,013 words | 100d | 7.6 MB | on demand |
| Full | 50,000 words | 300d | 57 MB | on demand, with a confirmation |
| Max | 80,000 words | 300d | 92 MB | on demand, with a confirmation |

The small model is ready immediately so nobody waits to start working. The others
are fetched when a student asks for them, all loaded tiers stay live, and
**Compare loaded models** runs the same query through each and shows the results
side by side. The Full tier is GloVe's 300-dimension vectors, the size people
actually deploy; it is a big download on purpose.

The gap is real, not decorative:

```
einstein - scientist + painter
  Small  not in vocabulary
  Large  picasso, painters, painting
  Full   picasso, painters, expressionist
  Max    picasso, painters, expressionist   <- same vectors as Full

paris - france + japan
  Small  tokyo, shanghai      <- wrong country on the second neighbour
  Large  tokyo, osaka
```

Full and Max hold the same 300d vectors and differ only in vocabulary size, so
they agree on any word both contain. The extra 30,000 words buy coverage, not
quality — which is the point of having both.

When a word is missing, the tool names the tier you are actually on, says how
many words it holds, checks the larger vocabularies (fetching only their word
lists, not their vectors) and offers to load the smallest model that has it.

And Caliskan's WEAT 6 cannot run at all on the small tier: seven of its eight female
target names fall outside a 5,000-word frequency cut while all eight male names
survive. The tool reports the test as unavailable and names the missing words,
rather than quietly running it on whatever is present — which is what an earlier
version of this toolkit did without saying so.

Regenerate both tiers with
[`data/generate_glove_subset.py`](data/generate_glove_subset.py), which downloads
~862 MB from Hugging Face the first time. **The archive and the extracted text
files are build inputs and are gitignored — delete them when you are done.**

---

## Session recording

Some labs ask students to submit a record of what they tried. The recorder in
[`shared/session.js`](shared/session.js) is deliberately local-first:

- Recording is **off** until the student turns it on. No pre-ticked boxes.
- Everything captured is visible in the Session Record panel under **Settings**.
- There is **no network call in the file** and no third-party script.
- No identity information is collected — no name, email, ID, IP or fingerprint.
- Event details are sanitised to primitives, so typed prose and uploaded rows
  cannot be captured even by accident.
- Students export a JSON file and hand it in, the same way they hand in a report.

This is a teaching decision as much as a privacy one. The toolkit teaches
surveillance, consent and telemetry; instrumenting students invisibly would be
the behaviour the privacy labs ask them to critique, and would raise FERPA and
IRB questions that a voluntarily submitted file does not.

---

## Shareable configurations

Tool state lives in the URL hash. Students can paste a link into a lab report and
you get their exact run back; you can also hand out pre-configured links:

```
tools/bias-auditor.html#dataset=recidivism&protectedAttr=Race&targetVar=PredictedRisk&favorableVal=Low&truthVar=Recidivated&truthPositiveVal=No
```

Every exported report embeds the link that reproduces it.

---

## Development

```bash
npm install           # Tailwind and its plugins (dev only)
npm run build:css     # rebuild shared/tailwind.css after editing markup
npm run watch:css     # rebuild on change
```

Colour utilities built at runtime from data are **safelisted** in
`tailwind.config.js`. If you add a tool colour or a new risk level, add it there
or the class will be purged and fail silently.

### Layout

```
shared/     toolkit.js (nav, footer, theme, URL state, reports)
            session.js (local-first recorder)
            toolkit.css (chrome, focus, print), tailwind.css (generated)
vendor/     pinned third-party libraries
data/       generators and synthetic datasets
build/      Tailwind entry point, one-off migration scripts
tools/      one page per lab tool
```

Page chrome is injected by `Toolkit.mountShell({ active: '<tool-id>' })`. Theme
resolution runs from a small inline script in `<head>` so the correct theme is
painted before first render.

---

## Course materials

Lecture decks, lab handouts, projects and the assessment bank live in a separate
**private** repository, because the assessment bank contains answer keys:
<https://github.com/hamedyaghoobian/ai-data-ethics-course>

---

## License

Code is MIT licensed. Course materials in the private repository are not covered
by this license.
