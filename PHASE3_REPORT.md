# Phase 3: truthful descriptions and real-battle verification

Implemented the approved recommendations, including the custom Fool Thread Binding rule. The two whole Error abilities explicitly deferred by the user remain unchanged. This phase has not been deployed.

## Changes

- Generated 218 live descriptions from normalized effect data, damage formulas and shared duration rules. Dossier and pathway preview use the same descriptions and damage summaries; old saved ability-history prose no longer overrides current rules. Lore names remain intact. Costs, damage terms, resistance scope and expiry are explicit.
- Corrected passive DEF penetration on skills without doubling basic attacks; explicit numeric status-resistance bypass; shared vulnerability for real damage; timed Vampire Lifesteal; published Iron Blood Vigor Max HP, War Command Speed and Misfortune accuracy; Escape prohibition during Root; stance-only Executioner activation and temporary bypass; Dark/Shadow-only Dawn Radiance; backing-record corruption detection; and reset skills retaining their own cooldown.
- Fool Thread Binding removes one stack when its victim loses **more than 30% of its Max HP cumulatively in one combatant turn**, at most once per turn. Shields do not count. Direct hits, damage over time, reflection and actual nonlethal HP siphoning share the counter. Remaining-stage penalties update immediately. Existing ownership, slots, SP, cooldown and conversion rules are preserved.
- Fixed a conversion identity error exposed by real-cast tests: human marionettes remain non-Beyonders. Fixed the normal-contract HP bar to include the restored passive Max HP, matching combat and dossier values.
- Rebuilt the versioned runtime data/script manifest. Originals, save schema, progression tables and numerical balance assertions remain unchanged.

[PHASE3_ABILITY_REVIEW.csv](PHASE3_ABILITY_REVIEW.csv) covers all 220 unique pathway/rank rows, with baseline evidence, final decisions, generated text and regression references. Baseline review identified 38 rows already fixed by earlier phases; they did not receive duplicate behavior fixes. Final dispositions: 13 ranks with existing-rule corrections plus generated text, 205 with generated text preserving current mechanics, and two whole-ability deferrals. Shared fixes also apply to inherited abilities.

## Regression evidence

| New suite | Before | After |
|---|---:|---:|
| Generated descriptions | 0/9 | 10/10 |
| Existing-rule corrections | 1/13 | 13/13 |
| Thread damage interruption | 3/13 | 14/14 |
| Browser tooltip surfaces | 0/7 | 8/8 |
| Per-ability actual casts | Missing API failure | 218/218 blocking ranks; all 220 exercised on both teams |

Additional RED cases reproduced mixed-element tooltip omissions, human-marionette awakening and the normal-contract HP-bar mismatch before their corrections. The actual-cast suite makes **8,690 quantitative assertions**, including real passive triggers, numerical damage, SP, cooldowns, duration expiry, copied-spec ownership and team symmetry. The two excluded Error abilities run as explicit `DEFERRED_PHASE4` diagnostics rather than green implementation claims.

Final verification:

- **34/34 functional suites passed**, including the existing effects-behavior suite (150/150), generic effects, actual full battles, campaign, browser modal/battle, image and cache tests.
- **Balance: 150 passed / 2 failed**, with unchanged assertions and the two previously approved Phase 4 deferrals: fresh mixed-party casualties **1.00 per quest** versus the **0.60** maximum; Sequence 5 same-path spread **100 percentage points** versus the **75-point** maximum. Sequence 9 spread still passes. No balance numbers were tuned.
- Syntax, all JSON, deterministic runtime-build `--check` and `git diff --check` pass. Reviewed production/test hashes remain stable. All **242 originals and 484 portrait/dossier variants** are byte-identical to their unchanged manifests.
- Independent security/compatibility review: **9/9 aggregate probes passed**, including 220 idempotent migrations, 66 finite real battles, copied spell ownership, bounded reflection, transient cleanup, passive HP persistence and pre-shield vulnerability. Independent settled DOM checks: **8/8 passed**. No blocking security or save-compatibility finding remains.
- Exact-source V8 collection across 18 genuine suites reached **43/43 changed/new functions** and **91.63%** of their non-whitespace executed source ranges (70,229/76,645 UTF-16 units). This is **not conventional statement or branch coverage**; it demonstrates execution reach and supplements the numerical regressions.

Evidence: [full verification](/workspace/game-audit/phase3/final-verification/final-verification.json), [actual-cast results](/workspace/game-audit/phase3/actual-casts-green.json), [security review](/workspace/game-audit/phase3/security-review.md), and [coverage mapping](/workspace/game-audit/phase3/coverage/coverage.md).

## Phase 4 boundaries

- **Error Sequence 5 Logic Distortion:** existing compelled ATK strike/stun remains; its promised primary-skill redirection and description are wholly deferred.
- **Error Sequence 4 Parasitic Contagion:** existing one-time SP drain/heal remains; periodic drain and description are wholly deferred.
- Previously approved deferrals remain: pathway meters, Spiritual Exhaustion action restrictions, Snake of Mercury's separate fatal protection, Hermit's spell-only bonus, Tyrant's melee-only reflection and balancing.
- Ambiguous scope expansions remain deferred: historical rewinds/replays, summons/substitutes, periodic recovery/resources, broader cleanse/buff categories, Light/Holy mapping, single-skill evade charges, timed immunity, mechanical movement/range and persistent transformations. Current descriptions state the implemented scopes. [PHASE3_DECISIONS.md](PHASE3_DECISIONS.md) records the accepted boundaries.

No open question blocks the approved Phase 3 scope. Phase 4 mechanics require separate design decisions.

## Files changed

- Combat/generation: `js/engine.js`, `js/v15.js`, `js/paths.js`.
- Loading/exports/UI: `js/data-loader.js`, `js/node-loader.js`, `js/exports.js`, `js/ui.js`.
- Existing effect data: `data/pathways/{justiciar,moon,red_priest,sun,wheel_of_fortune}.json`.
- Deployment metadata: `data/runtime/manifest.json`, additive versioned runtime bundle and `index.html` script version.
- Tests: five `phase3-*.test.js` suites, shared `phase3-test-helpers.js`, and the old Dawn Radiance assertion in `tests/effects-behavior.js` corrected to test Dark/Shadow scope.
- Documentation: this report, decision record and 220-row review CSV.

## Workflow and reproduction

Applied [Ponytail full](/workspace/requested-workflows/ponytail/skills/ponytail/SKILL.md) and ECC's [TDD](/workspace/requested-workflows/ecc/skills/tdd-workflow/SKILL.md), [security review](/workspace/requested-workflows/ecc/skills/security-review/SKILL.md) and [verification loop](/workspace/requested-workflows/ecc/skills/verification-loop/SKILL.md) instructions from their official source copies. CLI plugin registration is not claimed. No project dependency was added.

```sh
node tests/phase3-descriptions.test.js
node tests/phase3-existing-rules.test.js
node tests/phase3-thread-damage.test.js
node tests/phase3-actual-casts.test.js
NODE_PATH=/tmp/guild-ui-check/node_modules node tests/phase3-description-dom.test.js
node tests/effects-behavior.js
node tests/balance.js
node scripts/build-runtime-data.js --check
git diff --check
```

Browser tests use the same external jsdom/Chromium setup as the existing Phase 2 suites. Production and tests were not instrumented or altered for coverage. This plain-JavaScript repository has no configured TypeScript or lint task; syntax, JSON, deterministic build and diff checks serve those applicable verification steps.
