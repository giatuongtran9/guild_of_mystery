# Original-resolution portraits and phone inspection

This Phase 2 follow-up implements the requested no-detail-loss image delivery. Character portraits now request the exact original PNG bytes with content-versioned URLs. There is no resize, crop, palette reduction, recompression or duplicate full-resolution binary. All 242 originals, including 21 nonsquare images, retain their dimensions, transparency and SHA-256 hashes. The 484 earlier runtime derivatives and their immutable manifest also remain unchanged for compatibility with earlier releases.

## Visible changes

- Phone campaign portraits are 160px. Narrow cards stack their text beneath the artwork.
- Battle party portraits are 160px; the formation scrolls within the arena when it cannot fit. Enemy portraits retain their compact formation.
- Dossier artwork uses a centered canvas up to 280px, with progression and stats underneath. `object-fit: contain` preserves the whole figure.
- Tapping **Enlarge** opens an image viewer with **Fit**, **100%**, zoom buttons, a slider, pinch zoom and drag-to-pan. At 100%, one original image pixel corresponds to one CSS pixel; larger artwork is inspected by panning. Fit makes the whole canvas visible but does not display every source pixel separately on a small screen.
- The viewer traps keyboard focus, supports Escape, restores the dossier focus and scroll lock, and leaves the guild save and dossier DOM intact.

## Delivery and caching

Asset manifest version: `5c9bd0cd5ef82ab5`. Runtime data bundle: `data/runtime/data.a445eabff3fba0a9.json`.

The repeatable asset builder adds exact original metadata and a `?v=<source hash>` URL. The compact boot bundle includes this full-resolution variant. The UI defaults to it; explicitly requested 192px/384px variants remain compatible. Canonical original files remain the fallback if metadata is absent or a versioned request fails.

The service worker caches requested, versioned original PNGs within the application's origin and scope. It does not prefetch the entire artwork library. Unversioned artwork, unrelated requests, authenticated requests and range requests retain their existing behavior. Storage denial or quota failure falls back to the live response.

The first download is intentionally larger than the earlier resized portraits. For the earlier Fool/Door/Error Sequence 9 sample, full originals total 1,919,888 bytes, compared with 59,738 bytes for the 192px derivatives. These are file-size comparisons, not new timing measurements. Warm browser/service-worker caches can reuse originals; browsers may evict cached files. All 242 originals total 317,661,667 bytes, but only requested images are downloaded. Offscreen images remain lazy, decoding remains asynchronous, and only visible party portraits receive high priority.

## Verification

- Regression evidence was captured before implementation: portrait assertions failed 9 times, asset/cache metadata assertions failed 18 times, and real Chromium layout assertions failed 11 times.
- All **29 functional suites pass**, covering the existing Phase 1/Phase 2 checks, effects behavior, campaign, combat UI and the four new full-resolution suites.
- New suites pass: original assets **2/2**, full-resolution metadata/cache **35/35**, portrait/viewer behavior **13/13**, Chromium layouts **12/12** at 320, 390, 560 and 1440px.
- Independent Chromium verification passes **31/31 checks** at 320×740, 390×844 and 1440×1000, including actual original-image dimensions, two-finger pinch, panning with the remaining finger, mouse drag, slider/button zoom, focus trapping, Escape and unchanged saves. Phone and desktop screenshots are in `/workspace/game-audit/fullres/review/`.
- Balance: **150 passed, 2 failed**. The unchanged failures are fresh mixed-party casualties (1.00 versus the 0.60 limit) and Sequence 5 same-path spread (100 percentage points). Both remain deferred to Phase 4 as previously approved.
- JavaScript syntax, JSON parsing, Python syntax, runtime-build freshness and `git diff --check` pass. Source hashes stayed unchanged during the complete verification run.
- Independent SHA-256 comparison confirms **727 existing immutable files unchanged**: 242 originals, 484 derivatives and the earlier versioned asset manifest.
- Scoped V8 execution reached **24/24 changed/new JavaScript functions**, with **90.28% source-range execution**; UI alone reached 21/21 functions and 89.57%. These figures are not conventional branch or statement coverage. Python asset-builder line coverage is 87.5%.
- Independent security review found no blocking issues in image-path validation, HTML escaping, viewer cleanup or the service-worker cache scope and request exclusions.

At 320px, existing navigation buttons make the underlying document 370px wide. A separate browser context using the previous component stylesheets reproduces exactly the same overflow. The portrait cards and viewer stay within the viewport and do not increase it. This unrelated navigation issue was left unchanged to keep this follow-up focused on image clarity.

The requested Ponytail full workflow and ECC TDD, security-review and verification instructions were applied from their checked-out source files. This environment's earlier CLI plugin registration was blocked by its read-only Codex home; this report does not claim registered plugins.

## Files and scope

Production changes: `js/ui.js`, the modal/campaign/dungeon-arena component stylesheets, both runtime build scripts, `sw.js`, the latest and newly versioned asset manifests, the new runtime bundle, its manifest and stylesheet versions in `index.html`. Tests: four new `fullres-*` suites and three existing portrait/modal assertions updated for the requested full-resolution delivery. This report records the follow-up separately from the historical Phase 2 performance report.

Original artwork, authored gameplay JSON, combat mechanics, balance values and save schemas were not changed. No migration is needed. No open design questions remain; the larger first-download cost is the accepted tradeoff. The implementation is local and has not been pushed or deployed.
