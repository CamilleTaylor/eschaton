# ESCHATON: Prophecy Alignment Engine

A static web app that asks one question of the news: **is this an unusual period, or do people always read their present through the same archetypes?**

- **Daily archetype index (flagship):** every item on Wikipedia's Current Events portal since 2016 (about 61,000 items) is scored on its own for 23 archetypes and 30 prophecies. Each week is ranked against every week of 2016–2025.
- **Align:** compare any event, or a list of events, with 30 sourced prophecies from seven tradition families, keeping **symbolic resemblance** apart from **predictive evidence**.
- **Prediction ledger** of documented predictions and their outcomes, and an **interactive archetype network**.

Plain HTML, CSS, JavaScript and JSON. No build step, no backend, no paid APIs.

## Design principle

Plain language on screen, full method one click away. Every screen answers its question in a sentence first ("Busier than usual", "Some overlap"), and the scoring details sit behind *Show the scoring* and *How it works*.

## Run it

- **GitHub Pages:** push this folder to a repository, then go to Settings → Pages → Deploy from branch → `main` / root. The `.nojekyll` file is already included.
- **Locally:** `python3 -m http.server` in this folder, then open http://localhost:8000.
- **Straight from disk:** opening `index.html` also works, because `data/bundle.js` carries a copy of the JSON for `file://` use.

## Keeping the index current (free)

`.github/workflows/daily-index.yml` runs every day at 06:17 UTC on GitHub Actions (free for public repositories). It fetches the newest Current Events pages, re-scores the last five days (Wikipedia editors keep adding items), rebuilds `data/index.json` and commits it. Turn it on in **Settings → Actions → General → Workflow permissions → Read and write**.

The first run has no `data/daily.json` yet, so it rebuilds everything from 2016 (about 80 requests, a few minutes). After editing a lexicon, run the workflow manually with **rebuild** ticked so the baseline is recomputed under the new rules.

Locally: `node tools/ingest.mjs` (update) or `node tools/ingest.mjs --rebuild`.

The same daily run also issues and resolves the monthly forecasts (`tools/forecast.mjs`), timestamps the registry with OpenTimestamps (`tools/stamp.sh`), and, if you add an NYT key, extends the long-range archive.

### One-time setup checklist (all free)

1. **Settings → Actions → General → Workflow permissions → Read and write.**
2. Run **Daily archetype index** once by hand (Actions tab → Run workflow). The first run rebuilds the full history with separate (non-overlapping) baseline weeks and the decoy control test, which the shipped data doesn't have yet. To start earlier than 2016, type a date such as `2010-01-01` in **start** and tick **rebuild**.
3. Push the repository **before 1 December 2026** so the December forecasts already in `data/registry.json` (entry #1) are timestamped by git and OpenTimestamps before the month starts.
4. Optional, for decades of history: get a free key at https://developer.nytimes.com (enable the Archive API) and add it under **Settings → Secrets and variables → Actions** as `NYT_API_KEY`. The daily run then loads about 60 months a day until it reaches 1945.
5. Optional: create the labels `prediction` and `register` (Issues → Labels). If the site isn't served from `owner.github.io/repo`, put `{"repo": "owner/repo"}` in `data/config.json` so the **Register publicly** buttons know where to go.

## Files

```
index.html            all five views (Align, Library, Ledger, Network, Method)
css/style.css         theme and layout
js/engine.js          matching, negation, proper-noun handling, scoring (also runs in Node)
js/wiki.js            parser for Portal:Current events daily pages
js/indexer.js         builds the index, its disjoint-week baseline, the monthly check and trends
js/forecast.js        monthly forecasting models + out-of-sample backtest (Brier scores)
js/registry.js        append-only hash chain + pure-JS SHA-256 (Node and browser)
js/control.js         decoy prophecies for the control test
data/registry.json    public forecast/prediction registry (append-only, never edit by hand)
data/stamps/          registry head hashes and their OpenTimestamps proofs (.ots)
data/longrange.json   optional NYT monthly theme counts (created when NYT_API_KEY is set)
data/config.json      optional {"repo": "owner/name"} for the public-register buttons
tools/forecast.mjs    issues next month's forecasts, resolves finished months
tools/register-issue.mjs  GitHub issue form → registry entry
tools/resolve.mjs     records the outcome of a registered prediction
tools/stamp.sh        OpenTimestamps + commit helper used by the workflows
tools/longrange-nyt.mjs   resumable NYT Archive ingest (free key)
.github/ISSUE_TEMPLATE/prediction.yml  the "Register a prediction" form
data/index.json       the daily archetype index (generated)
data/daily.json       one compact row per day, created by the first Action run
tools/ingest.mjs      fetch + score + rebuild (Node 18+, no API keys)
.github/workflows/    daily-index.yml (ingest, forecasts, stamps) and registry.yml (issues, outcomes)
js/graph.js           force-directed SVG network, no libraries
js/app.js             data loading, views, ledger, source drawer
data/prophecies.json  the 30 prophecy records
data/archetypes.json  23 archetypes and their keyword lexicons
data/ledger.json      17 documented historical predictions with outcomes
data/bundle.js        generated copy of the three JSON files (for file://)
tools/bundle.mjs      regenerates bundle.js: node tools/bundle.mjs
```

## Scoring (also explained in the app's Method view)

| Component | How it is computed |
|---|---|
| Negation scope | Words after a negation or denial cue, or before a dismissal ("…is false"), within the same clause, are excluded from matching |
| Theme overlap T (0–100) | 100 × (0.65 × cosine(event archetypes, prophecy archetypes) + 0.35 × min(1, keywords found ÷ 3)) |
| Concrete details S (0–100) | 20 × specificity rating (1–5) × (0.15 + 0.85 × share of concrete markers found): how specifically the *event* matches |
| Source strength E (20–100) | 20 × evidence rating (1–5) |
| Points against P (0–45) | 15 per triggered contradiction + 6 per unmet precondition |
| Match strength (0–100) | (T ÷ 100) × √(S × E) − P |

These are deterministic heuristic indices, **not probabilities**. Even the highest verdict ("close match") is a match found after the fact. The score is called *match strength*, not a prediction score, because it measures resemblance rather than foresight. Only ledger entries recorded before the outcome, with criteria that could fail, count as predictive evidence.

## How the index is computed

- Each news item is scored separately, with its topic line as context. Items are never concatenated.
- A week's share for an archetype = items carrying it ÷ items that week. Shares, not counts, because editing volume varies by year.
- Each archetype's share is ranked against **separate, non-overlapping** 7-day calendar blocks from the start date (2016-01-01 by default) to 2025-12-31.
- **Running high** = above the theme's own 90th percentile *and* carried by at least two items that week (so near-silent themes can't be tipped over by one item).
- **Themes running high at once** = how many themes are running high at the same time, ranked against the same count in baseline weeks. With 23 archetypes about 2.3 are elevated in a typical week by chance; convergence is what tests whether a week is unusual.
- **Matching item** = best prophecy match with match strength ≥ 20.
- **Month check:** the same convergence test on calendar months (min. 3 items per theme), ranked against baseline months. Months never overlap and it runs on the shipped monthly table.
- **Control test:** every item is also scored against 30 decoy prophecies built from shuffled parts of the real ones (`js/control.js`). `baseline.control` stores the real vs. decoy match rates.

Known limits: Wikipedia editors choose what to log; coverage varies by region and year; lexicons are hand-built. "Unusual" means unusual *in this record, by these rules*.

## Rising, perennial, or just feels new

Each theme is sorted by its share of each year's news (full months only): **rising** (robust Theil–Sen trend ≥ +4%/yr of its average, last 3 years ≥ 1.4× the first 3, and 3 of the last 4 years above the median), **fading** (the mirror image), **comes in waves** (busiest month ≥ 8× a typical month, or large year-to-year swings), **always with us** (steady), or **too rare to tell** (< 0.2% of items). Computed in the browser from `data/index.json` by `trends()` in `js/indexer.js`.

Note: `data/index.json` as shipped was built with overlapping weekly windows, before the control test existed. The page says so until the Action's first run rebuilds it (automatic when `data/daily.json` is missing).

## Forecasts, registry and timestamps

- **Forecasts** (`js/forecast.js`): for each theme averaging ≥ 0.5% of news, P(next month's share > the theme's median month), plus P(3+ themes running high at once). Three models: base rate, momentum (conditioned on last month), momentum + convergence. Laplace-smoothed frequencies; no fitted parameters.
- **Backtest** (rolling origin, Jan 2019 to Oct 2026, 1,190 theme forecasts): Brier 0.250 base rate, **0.215 momentum (14% skill)**, 0.220 momentum + convergence (2% *worse* than momentum). Convergence describes a month; it doesn't predict the next one. The app recomputes this live.
- **Live forecasts** are issued in the last 5 days of each month and resolved automatically once the month's data is in. December 2026 is registry entry #1, SHA-256 `736008f1ab75be40eacf892ed9a9aa634cc2a745a02ed9ee2b3a34be876480bb`, recorded 2026-11-26.
- **Registry** (`js/registry.js`): each entry's hash = SHA-256(canonical JSON of seq, type, issued, body, prev hash). Changing any entry breaks all later links; the Predictions page re-verifies the whole chain in the browser. Each new head is stamped with OpenTimestamps (Bitcoin-anchored, free); check with `pip install opentimestamps-client && ots verify data/stamps/head-00001.txt.ots`.
- **Public predictions**: file the *Register a prediction* issue form. Owner/collaborator issues register immediately; others when a maintainer adds the `register` label. Record an outcome from Actions → *Prediction registry* → Run workflow (seq, outcome, evidence).

## Editing the database

Each record in `data/prophecies.json` has: `source` (work, locator, edition), `excerpt` (`quotation` from a public-domain edition, or `paraphrase`), `archetypes` (weights 0–1), `keywords`, `markers` (concrete testable signs), `specificity` and `evidence` (score plus written rationale), `contradictions`, `preconditions`, `parallels`, `interpretations` and `links`.

After editing any JSON file, run `node tools/bundle.mjs` so the file:// fallback stays in sync.

## Sourcing rules

- Every record names a work, a precise locator and an edition or translation.
- Quotations come only from public-domain editions (KJV, Bellows 1923, Evelyn-White 1914, original Latin and French, Collier's 1926, Hindley 1862) or are kept under fifteen words. Everything else is labelled as a paraphrase.
- Oral, late or contested traditions say so, and their evidence rating reflects it.
- Ratings are editorial judgments, shown with their rationale so they can be argued with.

## Ledger storage

Seed records ship in `data/ledger.json`. Drafts a visitor writes are stored in that visitor's browser (localStorage) with a creation timestamp and a SHA-256 fingerprint; editing keeps the earlier fingerprints. They can be exported/imported as JSON, and each pending draft has a **Register publicly** button that opens the issue form prefilled.
