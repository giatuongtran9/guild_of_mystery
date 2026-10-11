# Fool-based character consistency

Completed locally on `phase3-truthful-abilities`, using repository base `d50670bcd1fdf07df3db14dbe933cad46b7164e3`. Nothing was pushed or deployed.

All 242 designs were reviewed: **56 revised, 186 retained**. This follows the approved six pilots and the instruction to retain matching designs. The 56 selections comprise 54 sequence characters and two mythical forms. Fool Sequence 9 remains the unchanged reference; Red Priest's mythical ring remains behind the creature.

## Review

- [Comparison gallery](preview.html): Fool reference, original and selected design at larger size and actual 64px. Filter by pathway and include retained designs.
- [Complete decisions](review.csv), with matching [JSON records](review.json): all 242 designs, selection reasons and source hashes.
- Contact sheets: [1](selected-1.png), [2](selected-2.png), [3](selected-3.png), [4](selected-4.png).
- Phone: [battle](battle-390.png), [scrolled formation](battle-390-scrolled.png), [dossier](dossier-390.png), [full-art viewer](full-art-390.png), [comparison](comparison-390.png).
- Desktop: [battle](battle-1440.png), [dossier](dossier-1440.png), [comparison](comparison-1440.png).

| Pathway | Revised designs |
| --- | --- |
| Fool | Sequences 8, 7, 5, 4, 3, 2, 1, 0 |
| Door | Sequences 5, 4, 3, 2, 1, 0 |
| Twilight Giant | Sequences 6, 5, 4, 3, 2, 1, 0 |
| Justiciar | All ten sequence characters |
| Sun | Sequences 2, 1, 0 |
| Mother | Sequences 5, 1, 0 |
| Death | Sequences 3, 1, 0 |
| Visionary | Sequences 9, 8, 7, 6, 4, 3, 2, 1, 0 |
| Demoness | Sequences 2, 1, 0 and mythical form |
| Moon | Sequences 1, 0 |
| Red Priest | Mythical form, including restored ring |

Other designs were retained after visual comparison. Anatomy is judged separately from hats, crowns, wings, weapons and auras. Nonhumanoid forms retain their creature shapes. Proportions are visually aligned with the approved reference, rather than enforcing identical outlines or numeric anatomy across differently clothed figures. The 24-color limit was not imposed.

## Delivery and preservation

- All 242 files under `data/assets/characters/` remain byte-identical to the starting inventory. No original artwork or previous runtime release was removed.
- The 56 selected PNGs live separately in `data/assets/revisions/`. Each is transparent, 1254 × 1254, with no appreciably opaque pixels touching its border.
- `data/assets/character-overrides.json` selects revisions under the existing original logical IDs. Removing a selection restores its original on the next build.
- The asset manifest retains original provenance alongside the selected artwork's hash. Full-art URLs deliver the exact selected PNG bytes. The existing 192px and 384px runtime variants are generated losslessly with nearest-neighbor resizing.
- Existing 64px battle dimensions, horizontal phone scrolling, visible portrait prioritization, lazy offscreen loading, dossier layout and full-art zoom are preserved. Full-resolution battle art retains its existing bandwidth tradeoff; this task does not claim smaller initial full-art downloads.
- No combat rules, progression data, save format or layout stylesheet was changed.

Runtime asset version: `9c227728fb4c7539`. Boot data version: `0fb7020c7266a74f`.

## Verification

Regression tests were added before implementation for separate source selection, exact full-art delivery, revision validation and published selections. They failed before their required code/data changes and pass with the integrated revision map.

| Check | Result |
| --- | --- |
| Artwork override fixtures and published selections | 9 passed |
| Full-resolution source preservation | 2 passed |
| Runtime image generation and all-242 pixel parity | 15 passed |
| Full-resolution portrait UI | 15 passed |
| Full-resolution metadata and cache validation | 40 passed |
| Runtime boot data parity and version validation | Passed |
| Boot, cache and startup suites | Passed |
| Modal rendering | 10 passed |
| Modal DOM and accessibility behavior | 6 passed |
| Existing runtime portrait behavior | 18 passed |
| Effects behavior | 147 passed |
| Combat sprite coverage | 22 pathways / 220 sequences passed |
| Actual Chromium preview | 390px and 1440px; 8 screenshots; no page errors |
| Syntax checks and whitespace review | Passed |

Python tracing executed all 21 changed non-comment lines in the asset builder. New URL and metadata cases exercise the UI, data builder and service-worker changes. The preview checks confirm six selected ally portraits at 64 × 64px, both revised mythical portraits at 64 × 64px with their full-resolution source loaded, phone scrolling without page overflow, full-resolution dossier/viewer delivery and all 242 gallery records. [Browser measurements](browser-check.json) are retained.

One existing test remains failing: `tests/phase2-battle.test.js` reports **19 passed, 1 failed**, for the finished Skip control remaining visible under the toolbar stylesheet. The same failure was reproduced using files from the pre-task base `d50670b`; it is unrelated to artwork selection and was left unchanged. Balance simulations were not rerun for this artwork-only task.

Security review checked exact character identities, same-origin versioned URLs, traversal and symlink rejection, unchanged original hashes, and cache bypass for authenticated, range and non-GET requests. No production dependency was added.

## Reproduce

From the repository root:

```sh
python scripts/build-runtime-assets.py
node scripts/build-runtime-data.js
python tests/artwork-overrides.test.py
python tests/fullres-assets.test.py
python tests/phase2-runtime-assets.test.py
node tests/fullres-cache-data.test.js
NODE_PATH=/tmp/guild-ui-check/node_modules node tests/fullres-portraits.test.js
python -m http.server 8111 --bind 127.0.0.1
```

Open `/reports/art-consistency/preview.html`. Optional screenshot assertions use `node reports/art-consistency/browser-check.js` with Playwright available through `NODE_PATH` and Chromium at `/usr/bin/chromium`; run them while the server is active. Dependencies are verification tools only.

## Remaining limitations

Generated revisions can vary minute fabric, hair and ornament pixels. Major outfits, identity props, palette relationships and approved silhouettes were checked visually; original files and comparison records remain available for further review. Visual consistency is an art judgment, and pixel/alpha tests alone do not prove identical anatomy. No deployment is authorized yet.
