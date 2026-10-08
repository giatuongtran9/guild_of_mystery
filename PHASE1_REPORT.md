# Phase 1: shared combat correctness

Scope: correctness in the common combat engine and save/display compatibility. The baseline tree matched GitHub main `6f082a0d626783656aa93aa297b22b64dc073dbc`. Findings were reproduced against that source before implementation. This phase does not change original artwork, image delivery, progression tables, damage coefficients or balance thresholds.

## Audit disposition

| Finding | Verified change |
| --- | --- |
| CORE-01, CORE-09 | Both teams use one noncyclic combat wrapper and a persistent character record. Actual pathway/Sequence determines authority, counters, initiative and the Sequence 4+ basic-attack lock. Enemy attacks no longer read an undefined defender Sequence. |
| CORE-02 | Casts and witnessed copied abilities own deep-cloned specifications. Copies preserve their actual target scope and effects without changing shared pathway definitions or leaking into subsequent battles. |
| CORE-03, CORE-04 | Enemy SP persists and pays the effective cost; drains and penalties change the resource used for casting. Readiness, spending and logs use the same cost. Cooldowns retain their remainders. |
| CORE-05 | Elemental resistance maps consistently use percentage points. Fractional authored entries were corrected to their stated percentages; aliases canonicalize, duplicate aliases within one grant do not stack, and separate defaults/passives add. Fear/Curse protection uses the existing status-resistance ratio contract. All 22 pathway JSON files were scanned. |
| CORE-06 | Deferred to Phase 4 by the user. The data does not supply complete gain amounts, spending costs or empowerment strength. Fool thread slots, Door records and Demoness corruption also conflict with a generic charge meter. Existing meter behavior is retained. |
| CORE-07 | One fatal-damage pipeline handles attacks, skills, counters, reflection, DoT and mind control on either team. Fool revives once at 25% HP, consumes remaining SP and receives the authored exhaustion marker. Reset Fate is one automatic 35% revival. |
| CORE-08 | DoT ticks before expiry. Numerical durations count affected-unit turns; effects applied during that unit's current turn receive expiry grace. One-turn banishment no longer skips two turns based on initiative order. |
| CORE-10 | Living-unit recovery consistently respects `no_heal`; resurrection is an explicit approved exception. `no_shield` controls barriers separately. Recovery and battle receipts use actual capped amounts. |
| CORE-11 | Mythical awakening rolls its 20% action-loss chance independently for every eligible living opponent. Its shield and damage values remain unchanged. |
| CORE-12 | Real advancement updates current-rank base Speed. Schema-9 saves repair stale derived Speed/resistance caches without rebuilding earned stats or rerolling variance. |
| CORE-13 | Effective injured HP/ATK/DEF/INT feed combat, mitigation and weighted Speed. The actual dossier/roster display now uses the same effective stats and applies passives/equipment once. Persistent raw stats remain intact. |

Additional corrections include shared damaging-skill accuracy/dodge/forced-miss rules, per-cast failure token ownership, true/true-psychic precedence, independently specified damage-component coefficients, single application of outgoing/form modifiers, physical reflection filtering, execution receipts, Freeze/frozen parity, and useful newer skills within the existing AI role priorities. The AI also avoids prohibited pure healing/shield casts while preserving useful mixed effects.

Temporary buffs, debuffs, party effects and thread attempt/target state clear at battle boundaries, save reload and consequence merge. Pending Thread Binding sentinel cooldowns resolve to their authored cooldown; ordinary cooldowns, SP, equipment, progression and chapter outcomes remain intact. Counter/reflection receipts and DoT rows preserve their actual battle-log ownership.

## Approved combat rules

- Both teams choose random eligible targets. The previous enemy-only low-HP targeting safeguard is removed by explicit user choice.
- Converted marionettes start at full SP on both sides. Ordinary generated enemies retain the existing zero-SP ramp-up; authored encounters can supply explicit starting SP.
- Damage resolves shield first, then reduction, including periodic damage. Reflect/reduction wards retain expiry at the caster's next turn.
- Healing prohibition blocks living recovery and permits resurrection.
- Reset Fate is automatic and does not spend a manual activation turn or cost. Snake of Mercury does not add another automatic revival in this phase.
- School-specific defenses use an explicit incoming category. Magic means all nonphysical, non-true damage; reflected output elements remain independent from incoming filters. Unrestricted wards remain unrestricted.

## Verified qualifications and deferred work

The audit was qualified where the original code already behaved correctly: shields preceded reduction, reflect/reduction wards expired at next own turn, enemy cooldowns already persisted, and live mythical activation cost was 0 SP despite a stale 50-SP comment. Intentional configured hybrid formulas remain unchanged; the defect was multiplying separately stated components by the primary coefficient again.

CORE-13's evidence used the effective-stat calculation, but the actual rendered dossier helper still used raw stats. The browser reproduced that additional display mismatch; both the engine and the shipped display are corrected rather than assuming the old screen already matched the helper.

The user explicitly deferred:

- CORE-06 meter design for all 22 pathways.
- Spiritual Exhaustion's behavioral restriction. The one-turn marker exists, but this phase does not block active casts or stun the whole turn.
- Snake of Mercury's separate fatal protection; inherited Reset Fate supplies one 35% revival.
- Hermit's spell-only outgoing bonus and Tyrant's melee-only reflection trigger. Their current broader behavior remains and needs explicit category/trigger design in Phase 4.
- Casualty balancing and the known same-path balance spread. Assertions and values are unchanged.

Local pathway mechanics absent from the authored effects—such as historical rewind, complete stat transfer, new summons, crafting and meter payoffs—remain outside this shared-engine phase. Images/performance belong to later work. No later phase was started.

## Regression evidence and verification

Every production correction has a corresponding regression that failed before the correction and passed afterward. Tests use normalized shipped abilities, real `resolveQuest` encounters and the actual advancement/display handlers rather than replacement implementations.

The six new suites are:

- `tests/phase1-combat-units.test.js`: all 22 pathways at Sequences 9, 5 and 0, both sides, exact mirrored outcomes, repeated battles, defined identity/stat/resource snapshots and unchanged shared/caller state; also real quest/save/reload regressions.
- `tests/phase1-casting.test.js`: immutable copying, real costs/drains, targeting, hit/failure token rules, execution and capped recovery.
- `tests/phase1-lifecycle.test.js`: fatal sources on both sides, status timing, prohibitions, independent awakening, typed defenses and structured receipts.
- `tests/phase1-progression-resistance.test.js`: resistance data/aliases, migration preservation, actual advancement, injured damage and actual rendered dossier values.
- `tests/phase1-damage-pipeline.test.js`: separate components, true damage and outgoing/form multiplier isolation.
- `tests/phase1-ai.test.js`: advanced skill use, resource-aware selection, observed-copy gates and prohibited pure recovery.

Existing effects, generic-effects, campaign, thread/marionette, reflection, mythical-order, sprite, battle-log, browser-DOM and loader suites are included in verification. The two existing fixture adjustments preserve their assertions: damaging-effect probes explicitly roll a hit after the approved accuracy change; reflection cast counts exclude independent DoT events.

| Check | Result |
| --- | --- |
| New Phase 1 regressions | 325 passed: combat units 158, casting 39, lifecycle/categories 57, progression/resistance/display 31, AI 32, damage pipeline 8 |
| Functional suites | All 16 passed, including existing effects-behavior (150 checks), campaign, reflection, mythical order, sprites, battle logs and browser DOM |
| Full balance suite | 150 passed, 2 failed: fresh-party casualties and Sequence 5 pathway spread, both explicitly deferred to Phase 4 |
| Independent compatibility | 9/9 aggregate checks passed, including all 220 rank migrations, serialization and saved pending chapter outcomes |
| Independent category probes | 3/3 aggregate checks passed, including 16 actual true-psychic casts |
| Private Chromium smoke | Desktop 1440×1000 and mobile 390×844 passed: actual dossier, simulator, save reload, no page errors |
| Mapped V8 execution | 53/54 changed functions reached; 90.98% nonwhitespace source-range execution; 72.64% observed V8 subranges reached. These are not statement/standard branch coverage percentages |
| Static/security/diff | JavaScript syntax, all 29 data JSON files, hash-bound security review and `git diff --check` passed |

The unchanged full balance suite reports 1.00 deaths per fresh mixed-party quest against the 0.60 maximum, and a 100.0-percentage-point Sequence 5 pathway win-rate spread against the 75-point maximum. Both remain failing assertions under the approved Phase 4 deferrals. Sequence 9 spread passes at 73.9 points. Fool thread completion now passes at 35.0% for Sequence 5 and 39.3% for Sequence 4; DoT expiry also passes. No source, data or test file changed during the final runs.

Reproduce functional checks with plain Node against the listed six new suites and the ten existing suites: `node-loader.js`, `effects-behavior.js`, `generic-effects.js`, `campaign.test.js`, `thread-marionette.js`, `reflect-order.test.js`, `mythical-order.test.js`, `combat-sprite.test.js`, `battle-log.test.js`, `battle-ui.test.js`. The DOM suite uses its documented `jsdom` dependency; this session supplied it externally through `NODE_PATH`. Run `node tests/balance.js` separately to see the unchanged balance gates.

## Files changed

- Shared runtime: `js/engine.js`, `js/v15.js`, `js/exports.js`.
- Save/advancement/display: `js/state.js`, `js/ui.js`.
- Existing data contracts: resistance aliases in `data/balance.json`; resistance/status-resistance entries in Abyss, Chained, Darkness, Death, Hermit, Mother, Paragon, Twilight Giant and Tyrant; revival metadata in Fool and Wheel of Fortune; incoming-category metadata in Hermit, White Tower, Mother and Paragon.
- Six regression suites listed above; narrow fixture corrections in `tests/effects-behavior.js` and `tests/reflect-order.test.js`; this report.

## Workflow and compatibility

Ponytail full and ECC's TDD, security-review and verification-loop instructions were applied directly from their official source copies. The requested CLI plugin installation was blocked by the read-only Codex plugin home; these are not registered plugin installations. No dependency or test framework was added to the game.

The save key and schema remain version 9. Security review covers copied-data isolation, malformed authored profiles, resistance alias/value boundaries, finite bounded battles, serialization, consequence merging and preserved pending chapter results. A private Chromium context verifies desktop/mobile dossiers, simulator playback and reload without changing a user's save. Syntax/JSON parsing and diff checks supplement behavior tests; this plain JavaScript project has no build, TypeScript or package lint command.

Mapped V8 execution measures changed engine/state functions in the anonymous concatenated Node loader. It is explicitly not standard statement or branch coverage, and does not claim coverage of all UI or JSON data. RED/GREEN logs, private-browser artifacts, mapped coverage and independent review reports are retained outside the checkout in `/workspace/game-audit/phase1`.

There are no unresolved Phase 1 questions. The deferred design decisions above remain for Phase 4; Phase 2 has not started.
