# Deployment integration

The approved artwork checkpoint `ee23a1d5b1a3a014b91c34746c5f61648b136e3d` was integrated on the existing `phase3-truthful-abilities` branch with GitHub `main` at `ef99f1a22e151834faefe1e36d97e81e177b4a18` before publishing. This preserves the newer traits, recruitment, progression, contract pools, permanent collections and dossier changes already on GitHub.

The sole merge conflict was `data/runtime/manifest.json`, a generated file. Rebuilding startup data resolved it using the merged modules, seven shared datasets and approved artwork manifest. No authored game rules or numerical balance values were changed during this integration. Original and first-pass artwork remain byte-identical. Unrelated untracked local notes and old bundles are excluded from the deployment commits.

Runtime artwork version: `727d0ad2fa4aa40f`. Integrated boot-data version: `dd5d9128c6b5531f`.

| Pre-deployment check | Result |
| --- | --- |
| Approved correction scope and original/first-pass preservation | 3 passed; all 242 selections checked |
| Artwork override fixtures and published selections | 11 passed |
| Current startup artifact check | Passed |
| Full-resolution portrait UI | 16 passed |
| Versioned image metadata and caching | 43 passed |
| Character modal | 10 passed; all 220 ranks covered |
| Modal DOM | 7 passed |
| Permanent-assets UI | 7 passed |
| Trait UI | Passed |
| Battle DOM | 20 passed |
| Boot / startup | 8 / 27 passed |
| Runtime-data parity and immutable build validation | Passed |
| Merge markers and whitespace | Passed |

The earlier finished-Skip failure recorded in the local artwork report is fixed by the newer GitHub changes; it passes in this integrated version. Browser screenshots are not claimed as fresh deployment checks. GitHub's Pages workflow provides the publication status, and the live manifest can be checked against the integrated boot version above.
