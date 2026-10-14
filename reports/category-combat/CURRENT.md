# Category combat and pathway AI

This release changes the shared combat engine used by the simulator, supernatural contracts and Wanted encounters. Each of the 22 pathways has a distinct action policy. Native abilities use their pathway's damage category; recorded, copied and soul abilities preserve their source formula and use the current caster's stats.

## Damage foundation

| Category | Basic attack power | Ordinary paid ability power |
| --- | --- | --- |
| Physical | ATK | 1.05 ATK + 0.30 INT |
| Agility | 0.75 ATK + 0.35 INT | 0.85 ATK + 0.55 INT |
| Caster | 0.80 INT | INT |

The basic attack adds weapon damage once. Paid abilities apply their authored multiplier to the category power. The six abilities with explicit additional damage components retain those components separately. Damage element, penetration, resistance, authority and critical hits remain separate parts of the calculation. Shared incoming damage is multiplied by two; HP, healing and shields use their full authored values. Battles have a 50-round safety limit, with no overtime damage escalation. Authored Evade and control durations remain unrestricted by a global cap; Dodge probability can reach 100%.

Pathway/Sequence compensation changes combat copies rather than saved character stats. Owner damage-received modifiers apply after shields. Summoned units and marionettes do not inherit those owner modifiers. Collection support is chosen at battle entry: losing a collection during the fight cannot grant an empty-inventory benefit. Fool's controller burden depends on the marionette slots occupied at entry. Native ability compensation does not apply to recorded, copied or soul versions.

## Action policies

Every policy compares a basic attack with legal, affordable skills. It considers cooldowns, silence, denial, real category damage, hit chance, shields, useful healing, redundant effects, observed opponent abilities, available collections and signature resources. Previewing a decision neither changes battle state nor spends resources. Extra actions select again and pay again.

| Pathway | Distinct priorities |
| --- | --- |
| Fool | Legal Thread Binding, occupied control slots and immediate damage; avoid banishing an attached target. |
| Door | Available recorded sources; avoid unnecessary single-target exile. |
| Error | Theft and parasitism; choose damaging paid skills again during native extra actions. |
| Visionary | Control before an opponent acts; use mental setups while they can still pay off. |
| Sun | Useful cleansing, purification, dispelling and INT offense. |
| Tyrant | Lightning and soaked-target combinations; value multi-enemy preparation when targets exist. |
| White Tower | Available copied sources, weakness analysis and shield pressure. |
| Hanged Man | Affordable captured powers; mark targets when a follow-up can benefit. |
| Darkness | Sleep/nightmare combinations and charged follow-ups. |
| Death | Usable prepared spirits, deployment duration and companion support. |
| Twilight Giant | Urgent protection and party wards; avoid low-value defensive loops. |
| Red Priest | Party commands and offensive pressure; defensive provocation when threatened. |
| Demoness | Useful afflictions, periodic damage and curse combinations. |
| Hermit | Prepared formulas and domain setups with time to benefit. |
| Paragon | Alchemical Fire with a usable device, armor penetration and charged wards. |
| Wheel of Fortune | Useful retries, calamity and actual beneficial historical rewinds. |
| Mother | Effective recovery, life seeds and native offensive growth; avoid healing full-health targets. |
| Moon | Companion commands, medicine and the existing self-attack fallback. |
| Abyss | Desire accumulation and charged release against the marked target. |
| Chained | Account for self-curse risk before preparing a charged release. |
| Black Emperor | Support redirection and weakening informed by observed opponent support. |
| Justiciar | Prohibition against observed support; execute without unnecessary late setup. |

## Power corrections

The audit corrected 27 direct native damage-formula mismatches and regenerated descriptions for all 220 ability tiers. Sun's early offensive passive and Visionary's Dream Tether now support their INT-based offense. Justiciar's psychic resistance applies additively, and Executioner Stance no longer advertises a defensive tag. Undead vulnerability targets explicitly undead creatures and spirits, rather than every human Death-pathway agent. Paragon's descriptions reflect automatic prepared devices and the current fire-command mechanic.

Mother's Origin of Life healing is once per battle and consumes its use only when it restores HP. Mother seed healing and recovery cooldowns, Error's shared parasite healing budget, and weak Tyrant, Hanged Man and Justiciar attacks were tuned. Parasite healing counts actual recovered HP or Hollow Saint ward across all hosts in the round, including healing modifiers. Snake of Mercury is now a legal AI attack even though it also grants self-revival; its description discloses the two-turn, 10% HP fate skin. Deferred lore mechanics were not introduced; descriptions describe the implemented effects.

## Measurement conditions

The prepared duel fixture uses equal Sequence, zero individual stat variation, Stout Vitality, full starting SP, zero starting signature charge, equal Rare Sword preparation and legal earned collections. Mirrors are excluded from pathway win rates. A draw is a non-win. Side-swapped checks verify parity and are not counted as additional independent samples. Results from empty collections and Legendary equipment are separate populations and do not establish prepared-fixture fairness.

The final independent validation results and encounter budgets follow below. Finite simulation samples are estimates, not guarantees for every enemy pairing, trait, weapon or party composition.

## Final measured results

Prepared PvP averages **8.55 rounds**; **204/40,480 battles (0.50%)** draw. Across all ten Sequences, each pathway averages **47.0%–51.1% wins**.

The per-Sequence 45–55% point-estimate target is **not fully met: 178/220 cohorts pass**. All marginal 95% Wilson intervals overlap that band, which does not prove simultaneous fairness. All **220 empty-collection cohorts exceed the diagnostic 35% floor** (minimum 35.1%).

Fresh targeted validation: Sun 5 **50.9%**, Darkness 8 **54.5%**, Wheel 1 **47.6%** and Wheel 0 **51.2%**. Wheel 1 has zero observed draws, down from 17.6% in the rejected diagnostic sample. Its native Reincarnation Loop cooldown is eight turns at Sequence 1; source copies and Sequence 0 keep four turns.

Sequences 8, 5, 1 and 0 were revalidated on new seeds after their repairs; the other six retain their independent results and unchanged Sequence configuration. The compilation records both source snapshots. [All 22 pathway rate matrices](final-pvp-v2-rates.md), [counts and intervals](final-pvp-v2.csv), [full PvP report](final-pvp-v2.md) and [effective combat profile](combat-profile.json) are included.

Remaining limits: individual matchups differ substantially; Error and Mother at Sequence 3 retain 6.5% draws. Later ranks have longer tails, and the earlier aspiration of 90% of every rank finishing by round 12 is not established. These measurements control Rare preparation; they do not establish balance for every catalog trait, Legendary loadout or party.

## Contracts and Wanted results

Ordinary matching-Sequence contracts clear **88.6%** across 7,744 current verification attempts (88.9% with equal weight per Sequence). Seven of ten Sequence point estimates lie in 85–90%; individual pathway cohorts span 68.2%–100.0%. One 30% whole-party retreat roll remains; all 254 observed retreats return at 99 injuries.

Wanted bosses average **88.2% clears**, with **zero permanent owner casualties in 1,152 attempts**. Five of six boss point estimates lie in 80–90%; Mirror is 91.1%. Final Last Hour clears 88.0% after the restored Wheel offense. Composition matters: this covers six fixed three-owner parties, not every possible party. Boss failures are predominantly safety-limit timeouts.

Four ordinary Sequences and Vacant Crown were freshly checked after the final repairs; Last Hour then received a separate health-only calibration and fresh verification. Unaffected blocks retain their earlier independent results. Prior rejected samples are classified as diagnostics and excluded from current totals. [Full PvE budgets, intervals and provenance](PVE-FINAL-OVERVIEW.md).

## Reproducing the checks

```sh
node scripts/measure-pathway-duels.js --seeds=16 --seed=291007919 --assets=rare --rounds=50 --output=/tmp/guild-pvp.json
node scripts/measure-contract-balance.js --samples=44 --seed=431744119 --output=/tmp/guild-contracts.json
node scripts/measure-wanted-balance.js --samples=32 --battle-seed=731744119 --output=/tmp/guild-wanted.json
node scripts/build-runtime-data.js --check
```

The shipped source contains the final profile. New runs use that complete current snapshot; the included compiled reports retain their recorded seeds and checkpoints. Source loads never modify the guild save.

## Verification and save compatibility

All **66 Node regression suites pass**. Four real-browser layout/flow suites cover mobile and desktop battle settlement, market/calendar, portraits and the nine collection dossiers. Final DOM checks verify all 220 descriptions and the native cooldown with trait-adjusted HP payment. Runtime generation and source-budget parity checks pass. [Verification record](verification.json).

The save schema and storage key are unchanged. Existing saved character stats, acquired collections, captured profiles, rarity factors and companion Sequence caps remain intact. Combat modifiers operate on encounter copies.
