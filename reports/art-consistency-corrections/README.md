# Character proportion corrections

[Deployment integration](deployment-integration.md) records the later merge with GitHub's newer game changes and its updated startup version. The completion and verification details below describe the original local artwork checkpoint.

Completed locally on `phase3-truthful-abilities`, against the first-pass artwork inventory at `b2aba18`. Nothing was pushed or deployed. This report supersedes the first pass's assessment of the 66 clear outliers; the first-pass report remains frozen for preservation checks.

**66 selections corrected, 176 left unchanged.** Fool Sequence 9 remains the unchanged ruler for natural head size, compact head/body proportions and apparent humanoid height. Large hats, crowns, wings, weapons and auras are judged separately from anatomy. The seven approved pathways—Error, Justiciar, Hermit, Paragon, Darkness, Abyss and Wheel of Fortune—remain entirely unchanged in this pass. Minor variations elsewhere were retained.

## Previews

- [Comparison gallery](preview.html): Fool reference, previous selection and current selection, at larger size and actual 64px. Filter by pathway or include all unchanged designs.
- All 66 corrections: [sheet 1](selected-1.png), [sheet 2](selected-2.png), [sheet 3](selected-3.png), [sheet 4](selected-4.png), [sheet 5](selected-5.png).
- [Complete decisions and hashes](review.json), with [CSV](review.csv).
- [Verification results](verification.json).

| Pathway | Corrected ranks |
| --- | --- |
| Fool | 0 |
| Door | 9, 8, 7, 6, 0 |
| Twilight Giant | 0 |
| Sun | 9, 8, 7, 6, 5, 4, 3 |
| Death | 9, 8, 7, 6, 2 |
| Visionary | 5 |
| Demoness | 8, 7, 3 |
| Moon | 9, 8, 7, 6, 5, 4, 3, 2 and mythical form |
| Mother | 9, 8, 7, 6, 4, 3, 2 |
| White Tower | 2, 1, 0 |
| Hanged Man | 6, 1 |
| Black Emperor | 6 |
| Chained | 4 |
| Red Priest | All ten sequence characters |
| Tyrant | All ten sequence characters |

Fool Sequence 0 now has tentacles beneath the cloak, with no trousers, legs, boots or feet. Its upper cloak, mask, card and fog remain recognizable. Red Priest's mythical form, including the restored ring behind it, remains unchanged. Moon's mythical form retains its humanoid, bat-membrane wings and phantom moon. Door 0, White Tower 1 and Hanged Man 1 received additional framing revisions after their initial drafts still made the person too small beneath the effects.

This is visual alignment with the approved Fool proportions, rather than a claim of mathematically identical anatomy across different costumes, stances and creature shapes. The 24-color limit was not imposed. Image generation can alter small garment pixels; full-size before/after links are available for review.

## Preservation and implementation

- All 242 canonical originals and every source selected by the first pass remain byte-identical. Previous runtime outputs and full-art URLs remain available.
- The 66 new selections are copied directly from generated PNGs into separate content-hashed filenames under `data/assets/revisions/`. The generated source bytes were not resized or edited during integration.
- Each new selected source is transparent RGBA, 1254 × 1254, with no appreciably opaque border pixels. All were visually checked beside Fool and at 64px.
- The override map now contains 119 active revisions in total. Three of this pass's selections supersede earlier revisions without overwriting their files. The other 123 active designs use their original sources.
- The existing image build script generates the 192px and 384px runtime variants with nearest-neighbor sizing and lossless encoding. Original provenance and exact full-resolution selected bytes remain in the manifest.
- Hash-named revisions use the existing logical character identity. The loader, data builder and service worker validate their identity/hash rather than accepting arbitrary paths. Legacy revision URLs remain supported.
- Battle portraits remain 64 × 64px, with existing horizontal phone scrolling, visible-image prioritization and lazy offscreen loading. Dossier layout and full-art zoom remain unchanged. No combat rules, balance numbers, save schema or production dependency changed.

Runtime asset version: `727d0ad2fa4aa40f`. Boot data version: `f513d0e85377d599`.

## Verification

Regression tests were added before implementation. The versioned-source cases failed before the small loader changes and pass afterward. The selection regression initially failed for all 66 targets, including the known Fool 0 revision with legs; all three integrated checks now pass.

| Check | Result |
| --- | --- |
| Exact approved selection scope and original/first-pass preservation | 3 passed; covers all 242 designs |
| Artwork overrides and published source validation | 11 passed |
| Full-resolution source preservation | 2 passed |
| Runtime image generation and pixel parity | 15 passed |
| Full-resolution portrait UI | 16 passed |
| Metadata, versioned revision URLs and cache validation | 43 passed |
| Boot data parity and stale-build validation | Passed |
| Boot / cache / startup | 8 / 20 / 27 passed |
| Runtime portrait behavior | 18 passed |
| Modal / modal DOM behavior | 10 / 6 passed |
| Effects behavior | 147 passed |
| Sprite coverage | All 22 pathways and 220 ranks passed |
| Battle DOM | 19 passed, 1 existing failure |

The existing battle DOM failure is the completed Skip control remaining visible under the toolbar stylesheet. It was reproduced at the pre-artwork base `d50670b` and was left unchanged. Balance simulations were not rerun for this artwork-only change.

Fresh Chromium screenshots were not obtained: sandbox socket restrictions prevent Chromium from launching, and the requested additional-permission runs were interrupted. The [browser check](browser-check.js) is supplied for a permitted local browser environment; its results are not claimed as passed. The gallery and five contact sheets are the delivered local visual previews.

Security review covers same-character paths, filename/content hash agreement, traversal and symlink rejection, preserved source bytes, durable independent caches and bypasses for authenticated, range and non-GET requests. No user save was used for preview fixtures.

## Reproduce

```sh
python scripts/build-runtime-assets.py
node scripts/build-runtime-data.js
python tests/art-consistency-corrections.test.py
python tests/artwork-overrides.test.py
python tests/fullres-assets.test.py
python tests/phase2-runtime-assets.test.py
node tests/fullres-cache-data.test.js
NODE_PATH=/tmp/guild-ui-check/node_modules node tests/fullres-portraits.test.js
```

Open `preview.html` through a local server from the repository root. The optional Chromium fixture expects that server at `http://127.0.0.1:8111` and Playwright on `NODE_PATH`; it uses an isolated sample save rather than a user's existing guild.
