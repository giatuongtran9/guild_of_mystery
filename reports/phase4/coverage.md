# Phase 4 mapped V8 coverage

Baseline: `0734c07`. Node: `v24.19.0`.

40 genuine JavaScript regression suites and two Python artwork suites executed; 0 failed. Production JavaScript and genuine test hashes remained unchanged during collection. CSS and runtime JSON deployment manifests are outside this scoped run.

Changed/new functions reached: **231/243**. Named: 117/117; anonymous: 114/126.
Non-whitespace executed source ranges: **90.72%** (161657/178202 UTF-16 units).

**These metrics are not conventional statement or branch coverage.** Exact inspector source text validates mappings for CommonJS, VM and full jsdom evaluations; no production/test instrumentation was edited.

| Production file | Changed functions reached | Executed source ranges |
|---|---:|---:|
| `js/engine.js` | 47/49 | 92.05% |
| `js/ui.js` | 35/38 | 80.43% |
| `js/paths.js` | 1/1 | 78.63% |
| `js/v15.js` | 2/2 | 94.09% |
| `js/data-loader.js` | 1/1 | 100.0% |
| `js/signatures.js` | 93/98 | 95.92% |
| `js/mythical.js` | 50/52 | 98.15% |
| `js/state.js` | 2/2 | 69.59% |

Files without changed/new functions have no scoped coverage denominator and are omitted from the table.

Whole-file source-range execution (UI omitted to avoid counting its unchanged game screens):

| Production file | Executed source ranges |
|---|---:|
| `js/engine.js` | 82.22% |
| `js/paths.js` | 68.76% |
| `js/v15.js` | 84.88% |
| `js/node-loader.js` | 84.89% |
| `js/data-loader.js` | 87.15% |
| `js/exports.js` | 100.0% |
| `js/signatures.js` | 96.01% |
| `js/mythical.js` | 98.26% |
| `js/state.js` | 69.81% |

Unreached functions:

- `js/engine.js:8` <anonymous:8:26> (0.0% executed ranges).
- `js/engine.js:9` <anonymous:9:27> (0.0% executed ranges).
- `js/ui.js:355` <anonymous:355:42> (0.0% executed ranges).
- `js/ui.js:957` <anonymous:957:1112> (0.0% executed ranges).
- `js/ui.js:958` <anonymous:958:136> (0.0% executed ranges).
- `js/signatures.js:73` <anonymous:73:256> (0.0% executed ranges).
- `js/signatures.js:113` <anonymous:113:341> (0.0% executed ranges).
- `js/signatures.js:120` <anonymous:120:463> (0.0% executed ranges).
- `js/signatures.js:126` <anonymous:126:307> (0.0% executed ranges).
- `js/signatures.js:126` <anonymous:126:396> (0.0% executed ranges).
- `js/mythical.js:43` <anonymous:43:19> (0.0% executed ranges).
- `js/mythical.js:173` <anonymous:173:19> (0.0% executed ranges).

Limitations:

- This is not standard statement or branch coverage.
- The source-range metric counts non-whitespace UTF-16 source units of changed/new functions, including comments and signatures.
- Nested function spans are removed from their parent denominator and counted separately; unchanged functions and immediate-invocation wrappers are excluded.
- Full production sources, exact concatenated sources and the exact portrait-prefix evaluation are mapped; synthetic dossier slices and framework/test code are excluded.
- V8 execution reach does not prove correctness; regression assertions are reported separately.
- Top-level statements outside changed/new functions are not part of this metric.
