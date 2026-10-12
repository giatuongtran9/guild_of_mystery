> Historical assessment of PR #3 before the requested fixes. See [CURRENT.md](CURRENT.md) for implemented rules, final validation and the pathway overview.

# Recruitment and progression review

The recruitment change hides ordinary characters' combat stats in recruitment, the roster and dossiers until awakening. It removes pathway recommendations and the 7% recommended-path ATK/INT bonus. Individual variation remains, and already-awakened agents retain their saved stats. Save schema 12 retires the recommendation metadata without recalculating those stats.

Contract, reputation, digestion and advancement balance changes are recommendations for review. Their gameplay numbers have not been changed.

## Findings that affect release

Removing the bonus exposes a campaign regression. With the existing prepared solo fixture, Error and Black Emperor each fall from **17/20 to 13/20** wins against Cantor Vale. The existing minimum is 14/20. Two test suites fail on the Error result; this is one underlying balance regression, not two independent defects.

A read-only experiment lowered this chapter enemy's HP from 500 to 475. Error reached 16/20, Black Emperor 15/20, and all 22 pathways met 14/20 on the same seeds. At 490 neither weak pathway improved enough; at 480 Black Emperor remained below target. This is a proposed **5% chapter-only HP adjustment**, not an applied change. It introduces no recommendation bonus or pathway-specific compensation. Twenty seeds per pathway establish the existing regression threshold, not a universal balance guarantee.

Keep the recruitment change in draft until this campaign adjustment or another reviewed remedy is accepted. Do not weaken the existing tests to hide the regression.

## Contract and reputation balance

The generator was sampled 10,000 times at each reputation band. Board availability was sampled across 2,000 complete boards per band, with an awakened Fool in the roster.

| Reputation | Board slots | Mean funds on success | Mean materials | Mean reputation | Boards containing a Sequence 9 combat contract |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 2 | £141 | 1.69 | 2.53 | 82.4% |
| 9 | 3 | £138 | 1.69 | 2.04 | 85.4% |
| 10 | 3 | £221 | 2.32 | 3.00 | 97.2% |
| 15 | 4 | £230 | 3.05 | 3.00 | **0%** |
| 30 | 4 | £308 | 3.09 | 3.50 | 23.2% |
| 50 | 5 | £383 | 3.26 | 3.80 | 22.5% |
| 80 | 6 | £452 | 3.42 | 3.80 | 15.9% |
| 150 | 6 | £452 | 3.42 | 3.80 | 15.9% |

**Beginner contracts disappear at reputation 15–29.** The configured Sequence 9 weight remains positive, but every available template is a mystery contract. `makeQuest` clamps those results to Sequence 8 or stronger. This contradicts `sequence_9_always_available` and makes replacements and fresh hires hard to develop. Above that band, a positive weight still does not guarantee a beginner contract on an individual board.

**Reputation grows faster than early potion digestion.** The opening chapter awards 12 reputation and 70% digestion. A successful mystery contract adds 3 reputation and only 12% party digestion: the guild reaches the troublesome 15 threshold while that agent has 82% digestion and cannot advance yet. Older jobs left on the board can cushion this transition, so it is a progression trap rather than a guaranteed hard lock in every save.

**Difficulty carries too little extra pay.** Mystery contracts pay the same £150–260 base range and 3 reputation whether the opponent is Sequence 9 or Sequence 6. Occult contracts similarly share a base reward range. Harder jobs give somewhat more material, but early higher-rank enemies can kill the entire party. Reputation scales funds only up to 80; later reputation adds no further economic growth or contract ranks beyond Sequence 5.

**Late materials are plentiful; late money is the main cost.** For example, Fool advancement costs increase from £166/1 material at 9→8 to £2,178/2 materials at 1→0. A high-reputation contract averages 3.42 materials, exceeding one agent's late advancement requirement in a single success. Higher difficulty therefore adds relatively little material scarcity. Buying material at £180 is principally an early shortage remedy. Party rewards remain shared, so maintaining three advancing agents requires substantially more funds than advancing one.

**Free declining allows unlimited board rerolls.** It avoids a permanently unusable board but rewards repeatedly rejecting threats until an easy job appears. It does not solve the zero-probability Sequence 9 band. At £50 per recruitment refresh, mean contract funds cover roughly 2.8 refreshes at reputation 0 and 9 at reputation 80, before hiring, healing and advancement expenses. The existing gacha odds can stay; balancing the economy should start with reward risk and progression access.

### Recommendations

1. Guarantee at least one actual Sequence 9 combat contract on every refreshed board, honoring the existing configuration. Preserve another suitable job for the guild's current roster rank rather than relying only on reputation.
2. Avoid making the first routine replacement contracts stronger merely because the opening case increased reputation. Use the existing rarity-of-difficulty weights and threat warnings to keep harder work an optional risk.
3. Scale rewards by enemy Sequence and the existing objective, not just reputation and template. Start with approximately +20–25% funds and a small additional reputation reward for each harder tier; verify net earnings after healing and replacement costs. These are tuning candidates, not measured optima.
4. Keep the existing reputation thresholds initially. Fix the board and reward behavior before changing the whole trust ladder. Reassess once late Sequence 4–0 contract coverage has been decided.

## Digestion by Sequence

The current runtime ignores `contract_base_by_difficulty` in `data/balance.json`. It instead uses 12/16/20 by contract difficulty, then increases gain by 22% for every rank below Sequence 9. Solo dispatch multiplies gain by 1.45. Ordinary errands use the same base as Sequence 9 combat.

| Agent Sequence | Contract used | Current party gain | Party successes to 100% | Current solo gain | Solo successes to 100% |
| --- | --- | ---: | ---: | ---: | ---: |
| 9 | 9 | 12% | 9 | 17% | 6 |
| 8 | 8 | 15% | 7 | 21% | 5 |
| 7 | 7 | 23% | 5 | 33% | 4 |
| 6 | 6 | 27% | 4 | 39% | 3 |
| 5 | 5 | 38% | 3 | 55% | 2 |
| 4 | 5 | 42% | 3 | 61% | 2 |
| 3 | 5 | 46% | 3 | 67% | 2 |
| 2 | 5 | 51% | 2 | 74% | 2 |
| 1 | 5 | 55% | 2 | 80% | 2 |

There are no generated Sequence 4–0 contracts. For those rows, Sequence 5 is the strongest regular generated job, so these are overleveled farming rewards. Sequence 1 can also gain 33% in a party or 48% solo from a Sequence 9 contract: only four or three successful easy jobs to finish its potion. Sequence 0 has no next potion to advance toward.

**The current curve is reversed:** early agents need the most victories, while stronger agents complete later potions much faster against weaker enemies. Combat danger and permanent advancement failure then dominate progression rather than potion digestion. Simply wiring in the unused 24/22/20/18/16 configuration would also reverse the intended challenge reward and would not resolve easy farming.

### Proposed starting pace, before risk and costs

Use the agent's potion rank for the base gain, then apply a separate challenge factor. Keep the existing 1.45 solo multiplier initially; show its actual 45% bonus in the UI.

| Current potion | Suggested on-rank party gain | Party victories | Suggested solo gain | Solo victories |
| --- | ---: | ---: | ---: | ---: |
| 9 | 20% | 5 | 29% | 4 |
| 8 | 18% | 6 | 26% | 4 |
| 7 | 15% | 7 | 22% | 5 |
| 6 | 12% | 9 | 17% | 6 |
| 5 | 10% | 10 | 15% | 7 |
| 4 | 8% | 13 | 12% | 9 |
| 3 | 7% | 15 | 10% | 10 |
| 2 | 6% | 17 | 9% | 12 |
| 1 | 5% | 20 | 7% | 15 |

Suggested challenge factors: matching-rank work ×1.0; one easier rank ×0.6; two easier ranks ×0.35; three or more easier ranks ×0.15; one harder rank ×1.2. Limit mundane errands to a small Sequence 9 contribution and no meaningful late-potion gain. Specify the rounding and minimum explicitly before implementation.

This aims for roughly 4–6 early solo victories, 6–10 in the middle, and 9–15 later. It is a proposed pace, not an already-validated replacement. Later tiers need suitable existing contract encounters added to the generated difficulty range or an explicit decision about the intended farming route. Do not impose a long late grind on the current 64% fatal final advancement roll without reviewing that risk too.

## Advancement risk

| Advancement | Shown chance at 100% digestion | Actual roll chance |
| --- | ---: | ---: |
| 9→8 | 94% | 94% |
| 8→7 | 87.5% | 90% |
| 7→6 | 81% | 86% |
| 6→5 | 74.5% | 81% |
| 5→4 | 68% | 75% |
| 4→3 | 61.5% | 68% |
| 3→2 | 55% | 58% |
| 2→1 | 48.5% | 48% |
| 1→0 | 42% | 36% |

The product of the actual nine success chances is **3.01%**, ignoring all combat deaths. Higher digestion cannot supply the displayed excess-digestion benefit because digestion is capped at 100. This is especially punishing for a rare recruit the player has already developed.

First use one shared chance function for the preview and roll. Then decide whether advancement should keep permanent death or use the already-supported Madness/Injury consequences for nonfatal failures. Keeping fatal failure while extending digestion would sharply increase lost investment; that combined change needs an explicit design decision.

## Confirmed issues and proposed order

| Priority | Issue | Evidence and next action |
| --- | --- | --- |
| Release blocker for this change | Prepared solo campaign regression after removing the bonus | Error and Black Emperor 13/20; test minimum 14/20. Review the measured 500→475 chapter HP adjustment. |
| High | Advancement preview and roll disagree | Different formulas in `canTrain` and `attemptTraining`; share the calculation. |
| High | Fresh guild is not saved at startup | `newGame` already has a schema, so the startup save branch does not run. Reloading before the first saved action rerolls the initial candidates for free. Persist the initial guild and handle save denial. |
| High | Most guild actions ignore save failure | Paid recruitment is transactional, but generic `commit` installs the new state before checking `saveGame`. A denied awakening save shows an awakened agent while storage still contains an ordinary agent. Extend the existing save-first approach to awakening, advancement, settlement and purchases. |
| High | Beginner board availability contradicts configured policy | No Sequence 9 generation at reputation 15–29; fix the mystery clamp and guarantee board coverage. |
| High | Failed combat still pays all material | A defeated Sequence 9 agent received £35 of a £100 reward, zero reputation, and all three Spirit Threads. Decide on failure salvage; withhold success-only material. |
| Medium | Scheduled free recruitment refresh only occurs after normal contract settlement | Awakening moved day 7 to day 8 with refresh due on day 8, but kept the old candidates. Run a shared day-advance refresh check. Preserve paid refresh and empty-pool refill. |
| Medium | Digestion configuration is unused and the curve accelerates late farming | Measured table above; replace the formula only after agreeing the pace and challenge factor. |
| Medium | Failed mundane work still grants full funds, material, digestion and mastery | A complication returned `success:false` but £100, three materials, 17% solo digestion and two mastery points. Define a consistent completion/failure policy. |
| Low | Solo bonus text is incorrect | Assignment says +50%; actual multiplier is 1.45. Display +45% if the number remains unchanged. |
| Low | Named wanted jobs all share the title The Red Knife | Elias Vane, Mara Quill and Jonas Rook use the same title; use target-specific existing content. |
| Needs rules alignment | Awakening cost data and action differ | Sequence 9 data lists a funds cost and zero material, while `choosePath` charges one material and no funds. Decide which existing rule is intended, then align the data and display. |

Unaffordable advancement was investigated and **ruled out**: its guard is present and the real UI left the save unchanged. There were no open GitHub issues when checked. That does not imply the code has no further defects.

## Combat evidence and limits

The paired assessment ran **21,000 complete battles**, with no runtime exceptions. Each matched rank/mode sampled all 22 pathways, 40 seeds per pathway, new catalog traits at the configured rarity odds, seeded individual variation, full starting SP, no equipment, no injuries and zero initial charge. Parties use three members of the same pathway; a separate mixed opening party uses Door/Visionary/Fool. Enemies are the real random contract enemies.

The baseline follows its recommendation. Paired fixtures otherwise share their trait rolls and stat variation, so differences show the effect of removing its 7% bonus. These fresh-encounter results do not measure healing, retained SP, consecutive contracts, every party composition, or each Epic/Legendary trait independently.

| Rank | Baseline solo success | Proposed solo success | Baseline same-path party success | Proposed same-path party success |
| --- | ---: | ---: | ---: | ---: |
| 9 | 30.3% | 23.6% | 74.4% | 66.4% |
| 8 | 39.5% | 35.3% | 76.1% | 73.5% |
| 7 | 32.7% | 28.5% | 73.4% | 68.2% |
| 6 | 36.0% | 31.8% | 70.3% | 66.8% |
| 5 | 28.0% | 25.5% | 66.7% | 61.7% |

Solo timeouts range from about 17% to 55% in the proposed version. The fixed 15-round limit substantially penalizes slower support and control pathways. A three-member opening party won 49.3% against random Sequence 9 opponents with 0.78 deaths per contract, and won none of the 150 samples against each stronger Sequence 8/7/6 tier. These are unarmed catalog recruits, unlike the older favorable fixed-Fool-enemy balance fixture. This demonstrates a real onboarding risk in the already-deployed gacha roster, not merely a new campaign-test failure.

Recheck equipped mixed parties, low SP after consecutive contracts, injuries, support damage and round-limit outcomes before applying broad combat tuning. Some same-path combinations are expected to be poor; do not make every support pathway a stronger damage dealer just to equalize one sample.

## Verification and reproduction

- All 40 Node/DOM suites were run: 38 passed; `campaign.test.js` and `phase4-balance.test.js` failed on the documented prepared Error regression. Their thresholds remain unchanged.
- Focused recruitment checks cover hidden stats in all ordinary-character views, all 22 awakening choices, removal of stale recommendation influence, preservation of saved stats and variance, and stats becoming visible after awakening.
- Runtime data generation and its consistency check passed. Save metadata and the runtime are both schema 12; the storage key remains compatible.
- Browser layout verification is recorded separately when available. The full-browser layout runner was blocked on this session's network permission, so no new Chromium layout pass is claimed.

Files: `assessment.json` contains measured generation, progression and battle rows; `ui-issues.json` contains real runtime issue reproductions; `campaign-options.json` records the chapter HP experiments; `verification-before.json` records suite outcomes.

Reproduce with:

```sh
node tests/recruitment-choice.test.js
NODE_PATH=/path/to/jsdom/node_modules node tests/trait-ui.test.js
node scripts/assess-progression.js --baseline=/path/to/38f252b-source
NODE_PATH=/path/to/jsdom/node_modules node scripts/assess-progression-ui.js
node scripts/build-runtime-data.js --check
```
