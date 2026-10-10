# Phase 4 regression evidence

The final phase commit follows the user's per-phase checkpoint instruction. RED/GREEN runs were retained as logs during implementation; this index preserves the concrete failures and corresponding tests. No Git history was rewritten and no checkpoint was pushed.

| Regression | Observed RED result | Final GREEN check |
| --- | --- | --- |
| Fool full-charge attachment | Charged attachment retained a resistance floor; Sequence 5 did not apply the approved 20-point penetration | `phase4-core.test.js`: both sides, zero floor, no skipped thread stages |
| Authoritative combat resources | Damage events did not separate shield loss and HP loss; action snapshots disagreed | `phase4-core.test.js` and `phase4-ui.test.js`: real HP/shield/SP and grouped reactions |
| Error Logic Distortion | The new rule was unsupported; redirected paid casts were absent | `phase4-signatures.test.js`: both sides, one paid cast, normal source SP/cooldown, immunity, expiry and paid misfire |
| Desire's actual payment | Expected paid-SP accumulation differed when the cast changed its own cost penalty | `phase4-signatures.test.js`: captured payment before effects rather than recalculating afterward |
| Charged damaging signatures | Abyss and Darkness dealt damage despite a paid forced miss; 43 passed, 2 failed | `phase4-signatures.test.js`: 45 passed; shared hit rules and no fabricated primary hit |
| Canonical identity in initiative ties | Equal-name/equal-initiative lethal duels changed winner after swapping teams; 0 passed, 2 failed | `phase4-side-parity.test.js`: 2 passed; persistent authored IDs retained |
| Save migration | `legacy Demoness charge migrates without deleting harmful corruption` failed | `phase4-saves.test.js`: legacy data preserved, new charge separated and cached changed ability IDs refreshed |
| New combat UI | 0 passed, 12 failed; displayed invented MP, incorrect HP after shield-only hits and normal artwork during a form | `phase4-ui.test.js`: 21 passed; actual resources, stable nodes, runtime mythical art, controls and result outcomes |
| Phone first viewport | Chromium assertion: `mobile: allied HP, shield and SP must fit in the initial paused viewport` | `browser-qa.js`: phone and desktop resource visibility passes after responsive layout correction |
| Copied-skill dossier costs | Mandatory Door copy header showed wrapper cost; 8 passed, 1 failed | `phase3-description-dom.test.js`: 9 passed; Door/White Tower say stored skill SP and cooldown |
| Darkness concealment description | Text omitted its direct-damage restriction; 87 passed, 1 failed | `phase4-mythical.test.js`: 88 passed; indirect/reflected damage retains concealment, successful direct damage reveals |

Additional regressions cover owned copies and two-battle isolation, actual host-turn SP siphons, self-parasitism rejection, resurrection/host redirection, summoned-owner aura cleanup, historical machine expiry, timed statuses, reactive healing attribution, no-heal/no-shield paid support, prototype-shaped IDs, escaped counters, one-action pause/step and round-limit outcomes. Final suite results and source hashes are in `verification.json`.

## Balance RED/GREEN

The original `tests/balance.js` assertions are unchanged. The verified baseline had 150 passing and two failing checks: opening casualties **1.00** per quest against **≤0.60**, and Sequence 5 spread **100** percentage points against **≤75**. The final run passes **152/152**, with casualties **0.35** and Sequence 5 spread **70** points. Sequence 9 spread was already passing and remains passing at **67.3** points.

The prepared Error campaign regression also retains its original **14/20** boss-win requirement. It failed at **13/20** after the shared dodge correction and passes at **17/20** after the approved ability-theft tuning. Chained's legal cooldown/release regression failed before extending its contained curse to four turns. `balance-tuning.md` records the numerical changes and their checks.

## Local log evidence

The original failure logs remain in the execution workspace under `/tmp/phase4-*-red.log`; examples include `phase4-desire-paid-red.log`, `phase4-signature-hit-red.log`, `phase4-side-parity-red.log`, `phase4-mobile-visibility-red.log`, `phase4-copy-cost-ui-red.log` and `phase4-darkness-tooltip-red.log`. These temporary files are not required by the game or test suite. The test code and results above are committed so the expected behavior and reproduction commands remain reviewable.
