# Reputation, contract pools and global combat implementation

Implemented the accepted prototype with the proposed 35% dodge ceiling and the extra 35%-HP thread conversion requirement removed. This report describes the production engine, not the experimental loader.

## Gameplay

- Ten guild reputation ranks use the agreed Sequence odds: 90% Sequence 9 initially, 70% at Renowned, and 20% at Mythic before stock depletion and protected-post guarantees. Ranks give no stat or character-rarity bonus.
- Each guild has 50 contract definitions and 196 copies, covering Sequences 9–0. Used copies return after three game days; declined copies return immediately. Refreshes are free each new game day, or £25 without advancing time. Paid refreshes retain protected beginner/progression work. A declined random slot waits until the next day or paid refresh.
- Every board preserves Sequence 9 and matching/one-easier work for the strongest active agent. Contract rewards, enemy pathway and variant seed freeze when posted. The board UI distinguishes nominal random odds from protected posts and shows remaining stock.
- Save schema 14 persists stock, reservations, cooldowns and RNG. Every load validates beginner/progression access. Legacy unaccepted posts migrate once; already accepted outcomes settle once outside the pool. Paid refresh, dispatch and settlement use the existing save-before-install UI transactions.
- Global combat uses the accepted HP table, 1.7× damage, 0.5× healing, 0.6× shield grants, a 65% INT basic fallback, one-turn hard control with a three-round reapplication gap, bounded protection windows and seeded initiative ties. Damage rises by 20 percentage points per round from round 6.
- Utility follow-ups are explicit ability metadata and visible descriptions. They cannot replace a missed damaging spell or immediately wake newly applied Sleep. Black Emperor and Darkness gain the measured attacks. Thread stages, interrupts and conversion remain intact, including conversion at full HP. Summons inherit balanced stats exactly once.
- Earned character stats remain in saves; balance applies to combat copies. Campaign playback uses real starting snapshots. The opening campaign retains its prepared solo success gate across all pathways.
- Wanted bosses retain exactly-three-agent dispatch, stories, phases, one-time payouts and enhanced digestion. Early/final bosses have 20% less burst and 15% more HP; three easier middle bosses have 20% more HP. Generic party enemy damage falls from 1.30× to 1.25× to preserve the opening casualty gate.

## Measured results

Neutral automatic 1v1 benchmark: 30,360 full duels, every equal Sequence, all 22 pathways and pairings including mirrors, six paired seeds and both team assignments. Same seed set as the proposal. Full SP, no weapons, neutral variance, Stout Vitality, zero starting charge/injuries/madness. Paired sides produce identical final states. The two team assignments are paired checks, not independent extra samples.

| Metric | Result | Goal |
| --- | ---: | ---: |
| Average rounds | 7.86 | Fewer than 15 |
| Draws | 2.30% | <5% overall |
| Finished by round 12 | 92.62% | ≥90% |
| Finished before round 15 | 96.34% | Most fights |
| Pathway averages in 45–55% wins | 16/22 | 22/22 |
| Pathway–Sequence combinations in 45–55% wins | 90/220 | 220/220 |

The timing targets pass. **The strict per-Sequence fairness target remains unmet.** Individual pathway–Sequence win rates range from 20.3% to 79.7%. Some pathways still exceed 5% draws individually. Implementing the accepted prototype does not mean these remaining tuning goals have been met.

| Pathway | Wins | Draws |
| --- | ---: | ---: |
| Darkness | 58.70% | 0.80% |
| Door | 55.00% | 0.14% |
| White Tower | 53.62% | 0.14% |
| Wheel of Fortune | 52.54% | 7.54% |
| Fool | 51.52% | 1.38% |
| Paragon | 51.23% | 0.29% |
| Black Emperor | 51.16% | 0.43% |
| Red Priest | 50.29% | 0.14% |
| Hanged Man | 50.07% | 1.67% |
| Visionary | 50.00% | 3.19% |
| Demoness | 49.64% | 0.07% |
| Sun | 49.35% | 1.01% |
| Abyss | 48.33% | 0.07% |
| Tyrant | 46.96% | 0.51% |
| Hermit | 46.45% | 0.22% |
| Mother | 45.51% | 6.01% |
| Moon | 45.29% | 2.10% |
| Chained | 44.78% | 0.00% |
| Death | 43.99% | 5.58% |
| Error | 43.77% | 8.41% |
| Twilight Giant | 43.41% | 5.22% |
| Justiciar | 43.12% | 5.65% |

Equipped solo contracts: **44,000 battles**, 200 seeded samples for all 220 pathway–Sequence groups, full SP, knife, no injuries and live recruitment trait odds. Lowest group success: **89%**; mean 99.64%; no group below 80% and no runtime exceptions. This is a viability floor, not an exact 80% average; deaths are recorded separately in the data.

Wanted probe: 1,440 battles, six mixed parties per boss, 40 samples per party. Party preparation is full SP and two knives/one sword, with live trait variance.

| Boss | Completion range | Casualties across 240 fights |
| --- | ---: | ---: |
| Red Knife | 82.5–100.0% | 179 |
| Black Mirror | 92.5–100.0% | 96 |
| Broken Hour | 100.0–100.0% | 29 |
| Ashen Choir | 92.5–100.0% | 90 |
| Vacant Crown | 97.5–100.0% | 55 |
| Last Hour | 75.0–100.0% | 138 |

Middle bosses remain easier than the first/final boss; future tuning should add meaningful phase decisions before raising lethal damage. Shorter fights also reduce the frequency of completing five-stage threads; reachability and all original conversion rules are tested independently rather than retaining conversion-frequency bands from the slower battle system.

## Validation and reproduction

47 regression suites, including real browser layout checks, pass. Every one of the 220 abilities passes the quantitative cast harness; the effect audit covers 147 assertions and 53 effect types. Low-level effect fixtures neutralize common balance modifiers to isolate their stated coefficients; live global modifiers and saved-stat preservation are separately tested in `tests/global-combat.test.js` and these production benchmarks.

The finite-pool test exercises 3,000 guild-day transitions, including conservation, rank changes, reloads, repeat settlement, protected access and legacy pending battles. Browser tests cover denied paid-refresh and dispatch saves. Runtime assets/data cache checks and the rebuilt versioned bundle are verified.

```sh
node scripts/measure-pathway-duels.js --seeds=6 --seed=1933371 --output=reports/reputation-combat/pvp.json
node scripts/measure-contract-balance.js --samples=200 --seed=931071 --output=reports/reputation-combat/solo.json
node scripts/measure-wanted-balance.js --samples=40 --output=reports/reputation-combat/bosses.json
node tests/contract-pool.test.js
node tests/global-combat.test.js
node tests/balance.js
node tests/effects-behavior.js
node scripts/build-runtime-data.js --check
```

Full evidence: [PvP](pvp.json), [all pathways](pathway-overview.csv), [all 220 pathway–Sequence combinations](pathway-sequences.csv), [solo contracts](solo.json), [wanted bosses](bosses.json).
