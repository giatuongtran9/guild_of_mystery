# Phase 2: image delivery, startup and character inspection

Baseline: published Phase 1 revision `103c50d6aa582354e2f2aa822a1bf1f1c1b59e16`. Scope is image/startup performance, stable battle rendering and the approved compact character modal. All 242 original PNGs, all 29 authored JSON files, combat/progression/save/campaign modules and balance values remain byte-for-byte unchanged. No save migration is needed.

## Findings verified against the current code

- The original art totals 317,661,667 bytes; 221 of 242 images are 1254×1254. The 220 sequence originals average 1,250,346.50 bytes despite approximately 68px UI slots. The large-art transfer finding is confirmed.
- Existing HTTP caching already works. Rebuilding battle DOM creates image nodes and layout/decode work, but the original audit did **not** show another network download on every redraw. This phase fixes node churn without claiming repeated downloads.
- The original boot makes 29 uncached JSON requests. Pathway requests already run in parallel; the additional bottleneck is the subsequent sequential script download/execution. This phase bundles the data and preloads scripts together while retaining ordered execution and failure handling.
- The original set is not native 64px pixel art. Runtime generation preserves nearest-neighbor pixels and transparency; it does not redraw, quantize, crop or alter the source designs.

## Changes

### Runtime art

`scripts/build-runtime-assets.py` generates 192×192 portraits and 384×384 dossier images for all 220 ranks and 22 mythical forms. It preserves each full canvas and aspect ratio, centers nonsquare artwork on transparent padding, and compares optimized PNG with exact lossless WebP. All 484 current outputs selected WebP. Content-hashed filenames and both latest/versioned manifests are generated separately under `data/assets/runtime/characters/`; earlier runtime versions are retained.

| Art | Original mean bytes | 192px portrait mean bytes | 384px dossier mean bytes |
|---|---:|---:|---:|
| 220 sequence ranks | 1,250,346.50 | 36,788.77 | 117,553.19 |
| 22 mythical forms | 1,935,701.64 | 53,425.82 | 180,190.91 |
| All 242 images | 1,312,651.52 | 38,301.23 | 123,247.53 |

Portraits total 9,268,898 bytes, **97.08% below the originals**. Dossier images total 29,825,902 bytes, 90.61% below the originals. Asset manifest version: `48d4e6b077a8c898`. A full second build reproduced all 486 runtime files byte for byte; all 242 original SHA-256 hashes still match the pre-edit inventory.

The existing shared sprite helper selects the runtime size and adds intrinsic width/height, `decoding="async"` and lazy loading. Only party portraits inside the viewport receive eager/high priority, including after scrolling or resizing. The visible dossier uses its midsize variant with normal priority. Invalid/missing runtime metadata falls back to the untouched original, then the legacy path, then escaped initials.

### Startup and caching

`scripts/build-runtime-data.js` bundles the original pathway manifest, all 22 pathways and six shared datasets without changing their schema or content. A compact portrait lookup is embedded so startup does not download the full art metadata separately. The current bundle is `data/runtime/data.d4710646c28b715e.json` (223,339 bytes).

The release manifest is always revalidated. A cold boot requests the manifest and one bundle; warm boot requests only the manifest and reads the verified bundle from project-scoped CacheStorage. Seven engine/UI scripts preload concurrently and execute sequentially. Failed downloads or script execution stop startup and preserve the readable error screen.

CSS, bootstrap scripts, engine modules, runtime images and the data bundle use content versions. `sw.js` durably caches only same-origin, project-scoped, content-versioned public assets. It excludes HTML/navigation, mutable manifests, original images, arbitrary paths, non-GET, Authorization and Range requests. Cache denial, quota errors and malformed cached JSON retain live-fetch fallback. GitHub Pages still supplies its existing `max-age=600` headers; durable caching comes from the application, not a fabricated hosting configuration.

### Battle rendering

Playback, speed changes, skip and detail toggles retain arena, unit, portrait, toolbar and navigation nodes. HP/shields/resources, death classes, status/details and log text update within their existing containers. New log rows append in order, preserving a reader's scroll position and following the bottom when appropriate. Completion/skip and navigation clear the guarded playback timer; a failed battlefield image stays hidden.

The existing battle event schema does not record exact per-action SP/status snapshots. Resource presentation retains those existing semantics; this phase does not invent new combat events or gameplay rules.

### Character modal

The approved reference layout uses the game's olive/gold palette: portrait and digestion/progression, the existing weapon slot and selector, Active/Passive tabs, unlocked-rank selector, two-column effective stats, skill description and Close. Condition/treatment, advancement review, awakening choices, biography/history, individual variance, mastery and marionette restrictions remain available in expandable sections. Keyboard tabs, Escape, focus trapping and focus return are supported. Saved text and action identifiers remain escaped.

## Mobile measurements

Three independent cold/warm trials per revision, Chromium, 390×844 viewport, deterministic Sequence 9 Fool/Door/Error party, the campaign assignment view. Times start at navigation; the party is scrolled into view immediately when `G9` becomes ready. Cold contexts start without browser/storage caches; warm is a reload of the same context.

The local server applies an **aggregate 2 Mbps (250,000 B/s) response limit and 150ms response latency** to all HTTP requests, including service-worker fetches. Both versions use the same Pages-style `max-age=600` policy. Bytes below are actual uncompressed response bodies recorded at the server, excluding headers and measurement endpoints. Page-only CDP accounting was discarded because it missed worker downloads. This is a controlled local comparison, not a production CDN timing guarantee.

| Median metric | Before cold | After cold | Before warm | After warm |
|---|---:|---:|---:|---:|
| Boot ready | 5.20s | 3.70s | 2.16s | 0.67s |
| First visible decoded portrait | 10.26s | 4.04s | 2.20s | 0.67s |
| All three portraits decoded | 13.09s | 4.11s | 2.21s | 0.67s |
| Portrait payload bytes | 1,919,888 | 59,738 | 0 | 0 |
| Startup JSON requests | 29 | 2 | 29 | 1 |
| JSON payload bytes | 233,760 | 223,818 | 233,760 | 0 |
| Total measured payload bytes | 2,444,664 | 597,205 | 233,760 | 0 |

The three cold portraits transfer **96.89% fewer bytes**. Their warm requests use cached bytes in both versions. After warm reload, the document and release manifest make HTTP 304 validations; zero payload does **not** mean zero network requests. All six measured navigations per version completed without browser errors.

| Revision/trial | Cold boot | Cold first portrait | Warm boot | Warm first portrait |
|---|---:|---:|---:|---:|
| Before 1 | 5.243s | 10.275s | 2.141s | 2.197s |
| Before 2 | 5.198s | 10.263s | 2.158s | 2.208s |
| Before 3 | 5.154s | 10.227s | 2.158s | 2.204s |
| After 1 | 3.791s | 4.170s | 0.637s | 0.647s |
| After 2 | 3.684s | 4.042s | 0.666s | 0.675s |
| After 3 | 3.696s | 4.037s | 0.683s | 0.689s |

## Regression and security verification

The final run passes **25/25 functional suites**: all six Phase 1 suites, the ten original functional suites and all nine Phase 2 suites. Phase 2 contains 110 reported Node checks (including one aggregate builder check) and 15 Python asset tests. The six Phase 1 suites retain 325 passing checks; `effects-behavior` retains 150/150 passes. All source/test/data hashes remained stable during the final run.

The unchanged full balance suite reports **150 passed, 2 failed**: 1.00 deaths per fresh mixed-party quest against a 0.60 maximum, and a 100.0-percentage-point Sequence 5 pathway spread against a 75-point maximum. These match Phase 1 exactly and are explicitly deferred by the user to Phase 4. Assertions and balance values were not weakened. Node syntax checks, Python syntax parsing, JSON validation, generated-build freshness and `git diff --check` pass.

Private real-Chromium checks pass on desktop (1440×1000) and mobile (390×844): 16 checks total covering dialog/keyboard focus, 384px runtime portrait, injured stats matched to actual combat, tabs/rank selection, canceled advancement with an unchanged save, equipment changes, injury treatment, accessible biography/history and Escape/focus return. Both layouts fit their viewport without horizontal modal overflow, and neither reports a browser error. Preview screenshots and raw measurement/security/TDD logs are retained under `/workspace/game-audit/phase2/` outside the game deployment.

The nine added regression files cover exact pixels/palette/alpha and all 484 derivatives; immutable original hashes, repeatability and prior-version retention; build path/symlink confinement; all 29 authored datasets and 220 abilities; cold/warm cache behavior, stale manifests, malformed cache and storage denial; module ordering and load/execution failures; all 220 ranks in the modal, actual DOM actions/focus/escaping; viewport portrait priority/fallbacks; and stable battle/image nodes, scroll, skip, timers and settlement. RED failures were captured before their corresponding production fixes. The single phase commit follows the user's requested checkpoint granularity.

Independent review reproduced two implementation defects: startup execution errors could escape the loading failure UI, and the data builder could follow a repository output symlink. Both were fixed and independently rechecked; four independent probes pass. The final review found no unresolved material finding or credential-pattern match. No backend or production dependency was introduced.

Mapped V8 execution of the eight Node suites reaches 84/88 changed/new functions and 87.83% of their own non-whitespace source ranges (UI 86.02%, loader 87.22%, boot 98.59%, service worker 100%, builder 92.45%). Exact source text and stable hashes were checked. These are **source-range metrics, not conventional statement/branch coverage**. Unreached callbacks are documented: fallback quote escaping, marionette owner lookup, the legacy contract fast-step handler and CLI argument validation. Python trace covers 100/104 executable asset-builder lines (96.15%).

Ponytail full and ECC TDD/security-review/verification-loop instructions were applied from their official source copies. The requested CLI plugin installation was blocked by the read-only plugin home; these are not registered CLI plugin installations. There is no npm package/TypeScript/lint configuration in this static game: verification uses plain Node regressions, syntax checks, JSON validation, Python asset tests, generated-build freshness and diff checks.

## Files and rebuild commands

- Production: `js/ui.js`, `js/data-loader.js`, `js/boot.js`, `css/components/modals.css`, `index.html`, `sw.js`.
- Builders: `scripts/build-runtime-assets.py`, `scripts/build-runtime-data.js`.
- Generated: `data/assets/runtime/characters/` (484 images and two manifests), `data/runtime/` (one current bundle and release manifest).
- Tests: `tests/phase2-{battle,boot,cache,modal-dom,modal,portraits,runtime-data,startup}.test.js`, `tests/phase2-runtime-assets.test.py`.
- Documentation: this report.

```sh
python3 scripts/build-runtime-assets.py
node scripts/build-runtime-data.js
node scripts/build-runtime-data.js --check
python3 tests/phase2-runtime-assets.test.py
```

The verified encoders are Pillow 12.3.0 / libwebp 1.6.0. Different encoder versions may generate different bytes and therefore new content hashes. Rebuild runtime data after changing any authored JSON, runtime art manifest, game script, bootstrap script or CSS. Run the eight Node Phase 2 suites individually; DOM suites require externally supplied `jsdom` (this session used `NODE_PATH=/tmp/guild-ui-check/node_modules`). Keep the existing Phase 1 and original suites, including `node tests/balance.js`, in verification.

## Deferred items and open questions

No Phase 2 design question remains. All Phase 1 design/meter/category and approved balance deferrals remain for Phase 4; no Phase 3 work or new pathway mechanics were started. Native 64px redraws, gameplay-event redesign and hosting-provider changes are outside this phase. Browser storage may be evicted; live-fetch fallback remains available. Original art and earlier generated versions are not removed.

This phase is prepared as one local commit; no Phase 2 GitHub publication is claimed.
