# Market, real calendar and global balance release

Latest companion behavior and measurements: [automatic companions](../automatic-companions/CURRENT.md). This report records the preceding market release.

The Market replenishes lost equipment and supplies any advancement material. One game day is now one real local calendar day, changing at midnight, with offline catch-up through Day.js 1.11.13. Contracts, awakening, advancement and treatment consume no days. Save schema 16 keeps the existing storage key, saved raw stats, individual variation, earned assets and unresolved outcomes. Old saves start the calendar at their existing day, preserving remaining timers.

## Purchases and resources

Four persistent weapon offers; £50 replaces all offers, local midnight refreshes them for free, and buying the last offer refills four for free. Purchases choose an offer. Epic unlocks at 80 reputation and Legendary at 300. Odds per offer are Normal/Rare/Epic/Legendary 74/20/5/1; before Epic unlock they are 80/20/0/0, and before Legendary unlock 75/20/5/0. Locked odds move to Normal.

Each of five weapon families has four qualities. Normal retains its original ATK, Rare adds 25%, Epic adds 45%, and Legendary adds 80%, rounded to whole points. Epic and Legendary each have family-specific effects and drawbacks: opening penetration/recoil, an opening critical/SP surcharge, protective wards/reduced healing, poison or lifesteal/defensive penalties, and armor breaking/speed penalties. Effects use the actual damage, healing, status and resource pipelines. Opening uses reset between encounters. Normal prices are £80–280; Rare costs 2.5x, Epic 10x and Legendary 30x. The unlimited material catalog has 21 distinct materials at £250 each. Moon and Mother share their existing material. Equipped weapons are lost when the owner is permanently lost.

Wanted materials are computed from the actual dispatched party, including agents outside the first three roster positions. Failed jobs award no materials or reputation. Routine failure retains 35% of funds; Wanted failure pays nothing. A fully defeated party gets one shared 30% retreat roll; returning ordinary owners have 99 injuries, and the job stays failed. Existing corruption and destroyed-companion consequences remain. A timeout with surviving party members ends the job without the full-defeat roll.

Completed contract slots refill immediately while the finite pool has stock. Used copies return after three real days; declined copies return immediately. Pool exhaustion is real and cannot charge a pointless paid refresh. Protected beginner/progression posts remain irrespective of reputation while corresponding stock exists. Recruitment refreshes every seven real days; beasts and spirits recover after three real days. Actions cannot accelerate those timers.

## Collections and encounter feedback

Chronometric Regulator has ATK/INT 1.40x, HP 1.10x and DEF 1.05x the Normal vessel. Once per owner per encounter, a qualifying native damaging skill on cooldown can overclock using its normal action: +25% damage, +50% SP and one extra native cooldown turn. The normal skill remains usable after its cooldown. Recall/redeployment cannot reset the allowance.

Eclipse Serpent has ATK 1.40x, INT 1.30x, HP 1.10x and DEF 1.05x. While deployed, up to two qualifying native damaging casts pay nonlethal owner HP instead of SP and gain +25% damage. Native charges, action and cooldown apply; unaffordable HP payment falls back to normal SP casting. Drop odds, fixed soul capacity and excluded pathways retain their approved rules.

Ten disclosed variations add shields, speed or stat tradeoffs within the existing five encounter families. The posted variation and enemy seed survive reload. Assignment previews show actual materials, injuries and effective HP. Results show funds/reputation/materials, each agent's digestion/injuries/permanent loss, retreat guidance, and collapsible weapon/collection events.

## Balance changes and measurements

Per-pathway, per-Sequence combat profiles apply globally, preserving saved raw stats. Native Death abilities now have affordable summon/offense costs and stronger upper-Sequence attacks; Moon's Sequence 5 transformation lasts three turns with 28% lifesteal and 20% speed, Sequence 4 offense is stronger/cheaper, and Sequence 3 healing/offense support is stronger/cheaper. Visionary Sequence 3 now has direct psychic damage; Darkness Sequence 8 has a small offensive lift. The existing uncapped dodge probabilities and original five-stage, 55%-stat Thread Binding conversion remain.

The ordinary enemy budget varies by Sequence. All Wanted bosses have a disclosed 15-round hunt deadline, their own HP/damage budget and their existing phase mechanic. Explicit signature backlash now obeys the source damage budget once; Broken Hour's redirected allied damage uses a 25% collateral budget. Black Mirror's lingering Poison deals 35% less than an ordinary application, with native PvP Poison unchanged.

Calibration used separate seeds. The final diagnostic uses fresh seeds 681217 for duels/solo; Wanted uses agent seed 829181 and battle seed 553211 (the last boss's final HP was checked against this same set). These are scripted engine measurements, not player telemetry or confidence guarantees. Swapped sides of the same seeded duel are parity checks and are not independent samples. The same-tier collection fixtures use fixed legal, representative libraries, not optimized or randomly earned histories. Duels use all 22 pathways at each equal Sequence, Stout Vitality, neutral variance, full SP, no weapon and zero initial charge. Solo/Wanted use live trait odds, individual variation, full SP, matching Sequence and basic equipment.

- **Rare collections:** 80,960 recorded duels; 7.77 mean rounds; 94.15% finished by round 12; 1.15% draws; 0 side-parity errors.
- **Legendary collections:** 40,480 recorded duels; 7.73 mean rounds; 94.13% finished by round 12; 1.23% draws; 0 side-parity errors.

All 22 Rare pathway averages are within 45–55%. **195/220 individual pathway/Sequence groups are in that band; the every-Sequence target remains incomplete.** The biggest remaining low groups are Hanged Man 0, Moon 2/1, Red Priest 4 and Chained 1. The full 220-group table is [pathway-sequences.csv](pathway-sequences.csv). Different traits, weapon qualities, recorded skills, party compositions and historical marionettes can alter these results.

| Pathway | Rare PvP wins | Legendary PvP wins | Ordinary solo wins |
| --- | ---: | ---: | ---: |
| Fool | 51.90% | 52.66% | 83.80% |
| Abyss | 51.25% | 50.43% | 85.60% |
| Wheel of Fortune | 51.09% | 50.82% | 90.00% |
| Paragon | 50.24% | 53.32% | 93.00% |
| Sun | 50.11% | 49.51% | 88.80% |
| Demoness | 50.05% | 49.02% | 87.60% |
| Black Emperor | 49.95% | 49.51% | 90.00% |
| White Tower | 49.84% | 50.71% | 86.20% |
| Mother | 49.84% | 49.78% | 92.40% |
| Visionary | 49.81% | 48.80% | 87.00% |
| Darkness | 49.67% | 47.88% | 88.70% |
| Red Priest | 49.67% | 50.11% | 87.80% |
| Death | 49.48% | 49.57% | 90.40% |
| Tyrant | 49.40% | 47.39% | 88.70% |
| Chained | 49.05% | 49.24% | 84.60% |
| Justiciar | 49.02% | 48.26% | 91.10% |
| Hermit | 48.70% | 48.37% | 86.10% |
| Door | 48.64% | 48.21% | 86.00% |
| Twilight Giant | 47.96% | 46.96% | 91.10% |
| Error | 47.72% | 46.74% | 85.20% |
| Hanged Man | 47.66% | 47.77% | 91.90% |
| Moon | 46.25% | 51.41% | 87.70% |

**Ordinary solo: 88.35% clears across 22,000 battles**, with all five encounter families and their ten variants. Sequence aggregates range from 85.91% to 89.91%, inside the requested 85–90% band. This is an aggregate prepared-agent target; individual pathway/Sequence/loadout groups can clear less often.

A second 22,000-battle check with **empty collections** cleared 87.19% overall; Sequence aggregates were 85.55–89.77%. Retained collections improve some advanced pathways; unprepared Fool 1/0 remains a difficult individual cohort despite the overall target being met.

| Wanted boss | Clears | Attempts with permanent casualty |
| --- | ---: | ---: |
| red_knife | 87.50% | 5.33% |
| black_mirror | 85.33% | 7.50% |
| broken_hour | 84.00% | 3.50% |
| ashen_choir | 86.33% | 3.00% |
| vacant_crown | 89.83% | 2.17% |
| last_hour | 87.50% | 4.50% |

Wanted has 600 attempts per boss across six fixed trios, including ordinary equipment and Rare collections. Each boss's aggregate meets 80–90% clears and at most 10% attempts with any permanently lost owner. Some individual trios still exceed the casualty target or fall below the clear target; these averages do not make every arbitrary party safe. Failed hunts often reach their deadline with survivors. Counted casualties include combat and corruption losses, even when the remaining party wins.

## Persistent economy

Thirty persistent guilds ran 60 real-calendar days with eight jobs/day, recruiting/replacing owners, equipping and upgrading through actual offers, treating injuries, legally advancing, retaining ordinary acquisitions and receiving the protected case's one-time supplies. Full storage offers are declined; there is no paid market refresh or Wanted income. The reproducible start date is 2026-10-13.

- 14,376 attempts, 87.38% clears, 563 retreats.
- 1251 combat/corruption losses and 82 advancement losses; 1423 recruits, 1829 successful advancements and 3782 treatments.
- £4,500,080 contract income across all 30 guilds; weapon/material/treatment spending £920,540/£74,250/£502,468.
- 0 unaffordable treatments; 6 dispatch stalls from unavailable suitable agents or stock; median ending treasury £73,904. Best-ever Sequence across guilds ranged 0–5.

The unlimited material catalog and replenishable weapon offers remove permanent resource dead ends. Premium prices and a smaller reputation reward bonus (maximum +20%, previously +80%) reduce late excess income while retaining replacement reserves. Long-lived guilds still accumulate cash: eight daily jobs are optional, there is no upkeep, and advancement survival deliberately limits veteran retention. This sample supports affordability rather than a permanently scarce treasury; it does not prove a casual player's pace or an optimal infinite farming strategy.

## Verification and reproduction

The 57 Node regression/behavior/balance suites passed, including the 154-check legacy balance script. Four artwork/runtime asset Python suites also passed after integrating the latest approved artwork. Focused checks cover DST/local midnight, offline rollover and failed-save rollback, locked odds, unique purchases, unlimited materials, every Epic/Legendary weapon, saved shared retreat, all 196 finite copies and three-day recovery, dispatched-party rewards, actual Poison/backlash budgets, inventory limits and once-per-owner overclock. Market browser checks cover purchases, quantity, reload, midnight rollover and repeated refresh clicks at 320/390/560/1440px. Inventory browser checks cover all nine collections at those four sizes, preparation, keyboard navigation, paid repair and reload.

```sh
node scripts/build-runtime-data.js --check
node tests/market-calendar.test.js
node tests/market-weapons.test.js
node tests/retreat.test.js
node tests/encounter-state.test.js
NODE_PATH=<jsdom> node tests/market-ui.test.js
NODE_PATH=<jsdom> node tests/encounter-feedback-ui.test.js
NODE_PATH=<playwright> CHROMIUM_PATH=/usr/bin/chromium node tests/market-layout.test.js
node scripts/measure-pathway-duels.js --seeds=16 --seed=681217 --assets=rare
node scripts/measure-pathway-duels.js --seeds=8 --seed=681217 --assets=legendary
node scripts/measure-contract-balance.js --samples=100 --seed=681217 --assets=rare --variants=live
node scripts/measure-contract-balance.js --samples=100 --seed=681217 --assets=empty --variants=live
node scripts/measure-wanted-balance.js --samples=100 --seed=829181 --battleSeed=553211 --assets=rare
node scripts/measure-persistent-guild-economy.js --guilds=30 --days=60 --jobs=8 --startDate=2026-10-13
```
