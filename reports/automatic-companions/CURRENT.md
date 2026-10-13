# Automatic prepared companions — measured release

Prepared, usable marionettes, beasts and devices enter before round-one initiative without SP, meter payment or an action. Auto, Wanted-only and Hold policies apply; stored, unprepared, damaged or locked assets do not enter. Current thread and prepared-vessel limits apply on both sides. Beasts and devices remain until defeated or battle end. Death spirits keep their existing paid invocation and lifetime.

The opening formation shows the entering companions and their actual partial HP. Extra units remain accessible through the horizontally scrolling party row. Companion presence does not change solo digestion, solo traits or the requirement for three actual awakened agents on Wanted hunts. Saved pending battles replay and settle once; they are not rerolled or given new entrants after reload. Save schema 16 and the existing storage key remain unchanged.

## Abilities and companion consequences

| Ability | Current behavior |
|---|---|
| Deploy Marionette | Removed from the active action pool. Prepared retained marionettes enter free. |
| Thread Binding | Original five stages, shared capacity, interruption rules and 55% captured stats remain. |
| Beast Command | 15 SP, one-turn authored cooldown. A living beast's next landed basic strike uses a 2.5× multiplier, without an extra turn. Full Blood Moon can heal a wounded beast for a base 25% Max HP. Without a usable live beast, the owner makes one paid basic attack at 2.5× strength, using normal accuracy, forced-miss, critical, weapon and mastery rules. |
| Alchemical Fire | 45 SP, three-turn authored cooldown. Keeps 160% INT Fire damage. A live turret's next landed shot at the marked target gains 20 percentage points DEF penetration. Full Innovation also grants the owner a base 10% Max HP shield. |

Command bonuses do not stack, are consumed by a successful scheduled attack, and cannot spawn replacements. Fire-marked shots prefer their marked legal target while respecting Taunt. Healing and shields use the shared modifiers and obey prohibition rules. Higher Moon offenses take priority over renewing a beast command when useful.

Eclipse Serpent retains two nonlethal HP-paid uses and a 25% offensive bonus; Beast Command can now use this bonus for its commanded strike. Chronometric Regulator still overclocks one qualifying native cooldown once per owner per encounter. A historical machine temporarily recalls an automatic turret; the surviving turret can return with its remaining HP, without refreshing its overclock allowance.

Destroyed marionettes are permanently lost. Wrecked devices require £50 repair. Defeated beasts recover after three real days. Recall or battle end preserves surviving ownership and remaining HP. Owner loss, shared retreat and captured-kill attribution retain their existing rules.

## Scaling and global tuning

[Scaling proof](scaling-proof.json) verifies identical raw stat tables, global stat profiles, vessel stat formulas, acquired-Sequence ceilings, tier multipliers, marionette capture/deployment formulas and save code. Owner advancement does not add a new scaling rule.

Opponents favor a legal marionette controller when its puppets are active. A prepared Fool army adds controller exposure for that battle: at Sequence 3 a full army receives 1.10× HP damage after shields, and at Sequence 0 a full army receives 3.00×; fewer deployed prepared marionettes reduce this adjustment proportionally. An empty army gets no exposure penalty. The dossier and battle-entry messages disclose this cost.

Owner-only incoming-damage adjustments are Moon 8: 0.88×, 7: 1.08×, 6: 1.03×, 1: 1.20×, 0: 1.10×; Paragon 1: 1.10×. These affect both sides and encounters globally, exclude companions, and change no stat value used to create them. Vacant Crown's damage budget is 0.20 and Last Hour's is 0.08. Original uncapped Dodge and Thread Binding conversion rules remain.

## Measured results

| Test | Result |
|---|---|
| Rare-collection equal-Sequence PvP | 80,960 recorded duels; all 22 pathway averages 47.80–51.58% wins |
| PvP duration | 7.65 mean rounds; 94.60% finish by round 12; 1.17% draws |
| Sequence fairness | 186/220 pathway/Sequence cohorts within 45–55%; 34 remain outside |
| Legendary-collection PvP | 20,240 recorded duels; 94.84% finish by 12; 1.12% draws |
| Equipped matching-Sequence solos | 22,000 attempts; 88.48% clears |
| Empty-collection equipped solos | 22,000 attempts; 87.06% clears; individual cohorts vary |
| Persistent guilds | 30 guilds × 60 simulated real calendar days × eight jobs/day; 14,372 dispatches, 87.04% clears, no unaffordable treatment |

| Wanted boss | Clears | Attempts with a permanent casualty |
|---|---:|---:|
| red_knife | 86.17% | 7.67% |
| black_mirror | 87.67% | 6.83% |
| broken_hour | 84.33% | 4.50% |
| ashen_choir | 88.83% | 2.33% |
| vacant_crown | 86.00% | 4.83% |
| last_hour | 89.83% | 5.00% |

| Pathway | Average PvP wins |
|---|---:|
| abyss | 50.08% |
| black_emperor | 48.70% |
| chained | 50.46% |
| darkness | 49.86% |
| death | 49.40% |
| demoness | 48.67% |
| door | 47.80% |
| error | 48.64% |
| fool | 49.81% |
| hanged_man | 47.91% |
| hermit | 48.18% |
| justiciar | 48.94% |
| moon | 50.43% |
| mother | 48.99% |
| paragon | 51.41% |
| red_priest | 48.32% |
| sun | 49.97% |
| twilight_giant | 48.89% |
| tyrant | 49.65% |
| visionary | 49.65% |
| wheel_of_fortune | 51.58% |
| white_tower | 49.78% |

PvP uses equally prepared, neutral-trait, full-SP, unarmed heroes at every equal Sequence with fixed legal collections and zero starting charge. Sixteen seeds per matchup use held-out seed 920021; Legendary uses four. Same-seed side swaps validate parity and repeat the battle rather than doubling independent evidence. Both suites have zero parity mismatches. The collection fixture is authored in `scripts/permanent-asset-loadouts.js`; it is not an acquisition or stat change.

Solo tests use live trait rarity/variation, a Normal knife, matching Sequence and actual encounter variants. Wanted tests use 100 seeds for each of six fixed trios per boss, counting any permanent casualty even on victory. Pool/board posts, inventories, currency, losses, advancement, purchases and treatment persist in the guild benchmark, with a fixed calendar; it does not farm Wanted rewards or buy paid market refreshes. Median final funds are £69,340; nine dispatches stalled across the whole run. This remains a surplus-oriented economy, not proof that every play pattern is equally safe.

The strict 45–55% target at every Sequence is still incomplete. The weakest measured cohort is Hanged Man 0 (38.86%); strongest is Door 7 (58.70%). Individual matchups, party compositions, historical captures and equipment can differ substantially from the aggregate figures. The per-Sequence PvP matrix and all individual solo and Wanted rows are included for review.

Verification: 58 Node suites pass, including all 220 authored abilities and 15 new automatic-companion regressions. Browser tests cover opening companion formations and reload/settlement at 320, 390 and 1440 px, plus all nine dossier inventories at four widths. Runtime data, syntax and whitespace checks pass.
