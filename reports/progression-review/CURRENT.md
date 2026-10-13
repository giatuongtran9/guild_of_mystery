The current Market, real-calendar rules and measured combat/economy results are in [market-balance/CURRENT.md](../market-balance/CURRENT.md). The measurements below describe an earlier release.

The latest implementation and measurements are in [reputation-combat/CURRENT.md](../reputation-combat/CURRENT.md). The measurements below describe the previous release.

# Implemented progression and contract update

Ordinary recruits hide combat stats until awakening. Pathway recommendations and their 7% bonus are removed for future awakening; existing awakened saved stats and individual variance are preserved. Recruitment remains £50 to replace all four candidates, £150 to hire the chosen candidate, and 74% Normal / 20% Rare / 5% Epic / 1% Legendary. The existing 29 traits activate after awakening.

## Advancement and digestion

Chances apply to the **Sequence being reached**, and both the preview and the roll use the same table. Awakening costs one material and has no failure roll. Advancement still requires 100% digestion, its normal funds/material costs, and loses the agent to corruption on a failed roll.

| Target Sequence | Success chance per attempt |
| --- | ---: |
| 9 | 100% |
| 8 | 98% |
| 7 | 96% |
| 6 | 94% |
| 5 | 92% |
| 4 | 90% |
| 3 | 88% |
| 2 | 86% |
| 1 | 84% |
| 0 | 80% |

Digestion uses the agent's current potion rank. These are successful matching-rank contracts from 0% digestion, before costs, deaths, opening-chapter rewards or existing progress. Solo jobs apply ×1.45 and wanted bosses apply ×2.5 to the party base. Values round to the nearest whole percent; easier work applies ×0.6, ×0.35 or ×0.15 for one, two or at least three easier ranks. Harder work gives ×1.2 for one harder rank and caps at ×1.4. Sequence 0 has no next potion and gains no digestion.

| Current Sequence | Party gain | Solo gain | Solo successes to 100% | Boss gain |
| --- | ---: | ---: | ---: | ---: |
| 9 | 20% | 29% | 4 | 50% |
| 8 | 18% | 26% | 4 | 45% |
| 7 | 15% | 22% | 5 | 38% |
| 6 | 12% | 17% | 6 | 30% |
| 5 | 10% | 15% | 7 | 25% |
| 4 | 8% | 12% | 9 | 20% |
| 3 | 7% | 10% | 10 | 18% |
| 2 | 6% | 9% | 12 | 15% |
| 1 | 5% | 7% | 15 | 13% |

## Contracts, reputation and persistence

Ordinary errands are removed, including the missing cat and stolen heirloom. Supernatural boards always retain beginner Sequence 9 work and a job matching the strongest active Beyonder. Remaining jobs favor ranks present in the roster, with easier work and occasional explicitly harder threats. Reputation unlocks optional harder work through Sequence 0; it does not remove access to beginner or matching-rank work.

Regular success pays a £170–250 base, increased by 25% per harder Sequence and by reputation up to 400. Reputation rewards are 3–7 and material rewards are 1–3, scaling with rank. Regular failure retains the existing 35% funds retainer but grants **no materials, reputation, digestion or weapon mastery**. Failed wanted hunts pay nothing.

Every guild mutation saves a cloned draft before installing it. Storage failure leaves funds, materials, inventory, agents, days and results unchanged. Corrupt saves are protected until an explicit reset successfully writes a fresh save. Recruitment candidates refresh on each day-changing action, empty-pool refill, and loading an overdue save; a refresh that cannot save does not replace the current pool.

Contract outcomes are saved before playback. Reload resumes the stored battle, and settlement consumes it once. Failed settlement keeps that outcome for retry. Removed the extra UI-only solo digestion bonus so displayed results and saved progress agree. Save schema 13 removes obsolete jobs/warrants without recalculating existing awakened stats.

## Solo combat results

Measured **44,000 fights**: 200 independent release seeds for each of 22 pathways at all ten Sequences, one agent with a knife, zero mastery/injuries, full initial SP, normal live trait rarity and individual variation, against a routine enemy at the same Sequence. Release seed base 1719381 differs from calibration seeds. Regular encounters use a 45-round cap, one opponent and a rank-specific NPC stat budget; authored chapter bosses, wanted bosses and the PvP simulator retain their own full profiles.

The 80% target is treated as a minimum for each pathway/rank cohort. **All 220 cohorts meet it** in this sample; overall success is **98.4%**, so this is a generous routine-contract baseline rather than an exact 80% average. These results do not guarantee the same rate with injuries, depleted SP, harder contracts, every trait combination or other equipment.

| Sequence | Lowest measured solo success | Pathway at the minimum | Highest |
| --- | ---: | --- | ---: |
| 9 | 80.0% | Black Emperor | 100.0% |
| 8 | 98.0% | Death | 100.0% |
| 7 | 94.5% | Black Emperor | 100.0% |
| 6 | 99.0% | Darkness | 100.0% |
| 5 | 93.5% | Error | 100.0% |
| 4 | 88.0% | Error | 100.0% |
| 3 | 85.5% | Error | 100.0% |
| 2 | 84.0% | Error | 100.0% |
| 1 | 83.0% | Error | 100.0% |
| 0 | 90.5% | Wheel of Fortune | 100.0% |

The AI avoids unnecessary defensive/cleanse casts when healthy or already buffed and prioritizes finishing an injured opponent. Black Emperor's Sequence 6 Distort Impact now combines 110% ATK Disorder damage with its existing incoming-damage protection. Cantor Vale's base HP is reduced from 500 to 475 to compensate for retiring the recommendation bonus; the existing minimum 14/20 prepared solo wins is unchanged and all 22 pathways pass.

Raw results: [solo-contracts-final.json](solo-contracts-final.json). Reproduce with `node scripts/measure-contract-balance.js --samples=200 --seed=1719381 --output=reports/progression-review/solo-contracts-final.json`.

## Wanted bosses

Six fixed targets have personal histories and a phase at half health. A warrant appears only when the guild has the required reputation and three active Beyonders at the boss's rank or stronger. Launch requires **exactly three distinct awakened Beyonders**; marionettes cannot fill these three slots. Combat summons remain usable. Each target can be defeated once. Declining a warrant defers it until the next game day. Materials are announced per pathway and match the posted payout.

| Boss | Sequence / reputation | Phase | Funds / reputation | Materials per announced pathway | Measured party success range |
| --- | --- | --- | ---: | ---: | ---: |
| The Red Knife — Elias Vane | 9 / 10 | Below half health, his frenzy grants a second action and 15% more damage. | £1,100 / +10 | 2 | 66–100% |
| The Black Mirror — Mara Quill | 7 / 30 | At half health, she raises a shield worth 25% of maximum HP and deals 15% more damage. | £1,900 / +14 | 3 | 96–100% |
| The Broken Hour — Jonas Rook | 5 / 80 | At half health, he drains 15% of each agent’s maximum SP and deals 20% more damage. | £2,900 / +18 | 3 | 100–100% |
| The Ashen Choir — Sister Agatha Bell | 3 / 170 | At half health, her nightmare frightens every agent for one turn and increases damage by 20%. | £4,300 / +22 | 4 | 100–100% |
| The Vacant Crown — Lord Edran Voss | 1 / 300 | At half health, his decree drains 20% of maximum SP from every agent and increases damage by 20%. | £6,200 / +28 | 4 | 98–100% |
| The Last Hour — Archivist Ione Vale | 0 / 400 | At half health, she gains a second action and a shield worth 20% of maximum HP. | £8,500 / +35 | 5 | 48–100% |

- **Elias Vane (The Red Knife):** Elias once escorted dockworkers home through the fog. When the canal syndicate abandoned his brother after an accident, he turned that duty into a private war. Merchants now vanish along the towpath, marked with the same red cut. He has learned to provoke a crowd into fighting itself. Three agents must corner him before another shift ends.
- **Mara Quill (The Black Mirror):** A celebrated portrait restorer, Mara promised grieving families one final glimpse of the dead. Her black mirrors began keeping those families instead. She now moves between abandoned shop windows while poison spreads through their rooms. The guild has traced every mirror to her workshop; three agents are needed to break the escape routes and face her together.
- **Jonas Rook (The Broken Hour):** Jonas repaired the district clocks until a guild patron erased his name from the commission ledger. Now the clocks lose an hour whenever he steals, and witnesses cannot agree which doors were open. His stolen records hold entire households in debt. A three-agent warrant team must force him into the same moment long enough to end the thefts.
- **Sister Agatha Bell (The Ashen Choir):** Agatha kept vigil over patients no physician could save. She found a hymn that eased their fear, but the choir it awakened never stopped singing. The hospice now sleeps through every sunrise and its lost patients walk in shared dreams. Three agents must enter the vigil, protect one another from its lullaby, and bring the waking bell back to the ward.
- **Lord Edran Voss (The Vacant Crown):** Voss bought the courts that stripped his family of its title. He then changed the meaning of every oath sworn inside them. Petitioners arrive seeking justice and leave owing him their names. His vacant crown still commands guards who no longer remember him. A three-agent party must withstand the court’s decrees and break his authority together.
- **Archivist Ione Vale (The Last Hour):** Ione catalogued disasters that had not happened yet. When she tried to spare the city its final calamity, she bound herself to an hour that never arrives. The observatory now repeats the deaths of everyone who crosses its threshold. Three agents must share the burden of that hour and confront its keeper before the city becomes another entry.

Boss measurement covers 1,800 fights: six bosses × six mixed parties × 50 seeded runs, matching Sequence, two knives and one sword, full SP, zero injuries and live rolled traits. The early Red Knife and final Last Hour are composition-sensitive; middle targets are generous against prepared three-agent parties. A 100% sampled completion rate can still include casualties. These are stronger encounters than routine solo NPCs, but the sample does not establish a universal boss win rate.

Raw results: [wanted-balance-final.json](wanted-balance-final.json). Reproduce with `node scripts/measure-wanted-balance.js --samples=50 --output=reports/progression-review/wanted-balance-final.json`.

## All-pathway 1v1 overview

Before is deployed main commit `38f252bacafa727ad4d7f688d6acfd2e1e11a2dc`; after is this implementation. Each measurement ran **15,180 complete duels**, all 22 pathways against every pathway including mirrors, three paired seeds per matchup, both team assignments and all ten Sequences. Both sides use neutral variance, the same Stout Vitality trait, no weapon, full SP, zero injuries/madness and zero starting pathway charge. The simulator retains its **15-round cap**. Rank stats, innate powers and ability sets remain pathway-specific.

Win means the opponent is defeated while that side survives. Draw includes surviving the round cap or simultaneous defeat; it is counted separately and is not a loss. Aggregate rows weight all ten Sequences equally. Mirrored fixtures add observations to the same pathway row; each row has 1,380 side observations. Three seeds give direction, not a precise tournament ranking. The final run recorded zero swapped-state or starting-profile mismatches.

| Pathway | Before wins | After wins | After draws | Seq 9 wins | Seq 5 wins | Seq 0 wins |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Fool | 46.1% | 46.2% | 35.1% | 0.0% | 50.7% | 66.7% |
| Abyss | 23.0% | 22.6% | 65.7% | 78.3% | 11.6% | 1.4% |
| Chained | 19.3% | 20.7% | 56.7% | 7.2% | 21.7% | 8.7% |
| White Tower | 20.6% | 19.3% | 62.6% | 0.0% | 21.7% | 14.5% |
| Door | 18.3% | 19.0% | 68.8% | 0.0% | 31.9% | 24.6% |
| Hermit | 15.9% | 16.7% | 71.7% | 0.0% | 18.8% | 2.9% |
| Paragon | 14.9% | 16.1% | 75.1% | 0.0% | 21.7% | 1.4% |
| Twilight Giant | 13.5% | 13.3% | 80.6% | 26.1% | 4.3% | 0.0% |
| Red Priest | 12.0% | 12.9% | 64.9% | 2.9% | 20.3% | 4.3% |
| Demoness | 9.3% | 10.3% | 73.2% | 7.2% | 20.3% | 1.4% |
| Mother | 9.0% | 9.7% | 88.7% | 1.4% | 11.6% | 0.0% |
| Moon | 6.7% | 9.7% | 88.3% | 0.0% | 11.6% | 0.0% |
| Sun | 6.5% | 7.8% | 80.6% | 1.4% | 7.2% | 7.2% |
| Tyrant | 5.9% | 6.4% | 76.4% | 7.2% | 8.7% | 0.0% |
| Hanged Man | 6.8% | 6.4% | 83.3% | 5.8% | 2.9% | 0.0% |
| Error | 3.6% | 4.9% | 87.1% | 0.0% | 4.3% | 34.8% |
| Justiciar | 2.9% | 3.3% | 87.5% | 5.8% | 5.8% | 1.4% |
| Death | 1.9% | 2.0% | 91.5% | 4.3% | 15.9% | 0.0% |
| Darkness | 1.4% | 1.4% | 92.6% | 0.0% | 0.0% | 0.0% |
| Wheel of Fortune | 2.9% | 1.4% | 93.2% | 0.0% | 5.8% | 0.0% |
| Visionary | 1.2% | 1.2% | 89.3% | 0.0% | 0.0% | 0.0% |
| Black Emperor | 0.3% | 0.4% | 83.5% | 0.0% | 1.4% | 2.9% |

**Balance finding:** Fool has the highest aggregate win rate, particularly after acquiring Spirit Body Threads and higher-rank powers. Abyss dominates early offensive duels but has many draws at high ranks. Chained, White Tower and Door follow Fool/Abyss in aggregate. Black Emperor, Visionary, Darkness and Death seldom finish opponents in this neutral 15-round setup. Defensive and support kits repeatedly sustain or control, and the timer hides part of their strength. Overall draws are **78.0% before and 77.1% after**. The PvE changes meet the requested solo viability floor but do not make all pathways equally strong in PvP.

Recommended next PvP work: choose a duel duration/scoring rule, then measure timeouts and matchup tables before adding global damage buffs. A separate 45-round 1v1 benchmark and weapon/trait sensitivity runs would distinguish slow wins from true inability to finish. Preserve each pathway's support identity instead of forcing every support kit to win half its duels. No new PvP scoring or timer rule is introduced in this update.

Full rank CSVs: [before](../phase4/pvp-before-neutral.csv), [after](../phase4/pvp-after-neutral.csv). Aggregate CSV: [pathway-overview.csv](pathway-overview.csv). Reproduce after with `node tests/phase4-balance.js --phase=pvp-after --seeds=3 --charges=0 --sizes=1 --modes=normal`. To reproduce before, use the same runner with `--game-dir=<checkout of 38f252b>` and `--phase=pvp-before`.

## Validation

All 42 Node/DOM regression suites passed, along with 154 broader balance checks, 147 effect-behavior checks and the runtime/data-loader audits. See [verification.json](verification.json) for the final automated results. The regression suites cover actual ability casts, combat resources/resistance, traits, campaign viability, cache/startup, DOM UI, save failures, reload/settlement, progression and boss party gates. The historical pre-fix assessment remains in [README.md](README.md) for comparison. Chromium visual checks could not complete because this execution sandbox blocks Chromium socket operations; DOM interaction checks do run.
