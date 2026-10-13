The current Market, real-calendar rules and measured combat/economy results are in [market-balance/CURRENT.md](../market-balance/CURRENT.md). The measurements below describe an earlier release.

# Permanent character collections

Implemented for Fool, Door, Hanged Man, Death, Hermit, White Tower, Paragon, Moon and Visionary. The other thirteen pathways retain their existing abilities and receive no new collection system.

## Using a collection

Open an awakened character's dossier and choose **Pathway Inventory**. Earn assets in supernatural contracts and Wanted encounters, choose a prepared loadout, and set automatic use to all encounters, Wanted only, or hold. Door starts with Wanted-only use to conserve its consumable records. Learned formulae, doctrines and conditioning are permanent knowledge; prepare one to apply its effect and drawback.

Collections belong to individual characters. Simulations and the protected opening chapter do not award them. Their battle effects still require ordinary actions, SP or HP, charge and cooldown where applicable. Storage does not grant free passive bonuses. An owner's final death removes their collection.

| Pathway | Permanent collection | Combat unlock | Acquisition and use |
| --- | --- | --- | --- |
| Fool | Marionettes | Sequence 5 | Surviving nonboss thread conversions retain a clean 55% profile. A paid deployment shares the existing 1/1/2/2/3/4 thread capacity at Sequences 5–0. Up to twenty stored profiles. |
| Door | Recorded powers | Sequence 6 | Witness compatible enemy spells; unused records carry into later battles. One slot at Sequence 6, four from Sequence 5. A paid replay consumes one record. |
| Hanged Man | Souls | Sequence 5 | A credited final kill supplies one random compatible active or passive power. Exactly five storage slots at every Sequence. Active powers are reusable paid casts; a passive costs 20 base SP plus 100 Depravity for a temporary two-turn manifestation. Only one manifested passive applies. |
| Death | Spirits | Sequence 7 | Credited final kills acquire Graveguard, Wailing Shade, Soul Reaper or Lantern Spirit. Prepare one spirit vessel; roles favor protection, disruption, finishing or SP restoration with explicit costs. Spirits can be collected before their deployment unlock. |
| Hermit | Mystic formulae | Sequence 6 | Every three successful contracts at the current Sequence or one easier learn a distinct formula. Prepare one to modify native spells. The existing scroll remains local to its battle. |
| White Tower | Tactical doctrines | Sequence 9 | The same three-contract milestone learns a researched tactic. Prepare one doctrine. Spell Imitation remains local to its battle. |
| Paragon | Devices | Sequence 6 | Eligible victories roll device loot; prepare one device and deploy through the native skill. |
| Moon | Beasts | Sequence 8 | Eligible victories roll beast loot; prepare one beast and deploy through the native skill. |
| Visionary | Mental conditioning | Sequence 6 | Three surviving encounters with successful hypnosis learn Aggression Pattern. A charged hypnosis can make the target favor damaging actions for one turn instead of commanding or skipping its action; costs 25% more SP and respects mental resistance and the shared control gap. |

Hanged Man and Death kills include their damage-over-time effects and owned companions. Captures survive a failed contract if their owner returns alive. Summons, allies, conversions and deaths that immediately revive are not capture sources. Full storage creates a saved replacement/decline choice before settlement, without a sixth carried soul or a reroll. Visionary also retains hypnosis learning from a failed encounter it survives; Hermit and White Tower require victories.

## Devices and beasts

There is one definition per tier in each family. A successful regular contract has a **50% family drop chance**; a Wanted victory guarantees that family's drop when an eligible surviving owner is present. Multiple same-family agents do not multiply the roll. Among drops: **Normal 74%, Rare 20%, Epic 5%, Legendary 1%**. The contract's Sequence limits vessel strength, so a beginner drop cannot become a high-Sequence vessel merely because its owner advances.

| Tier | Paragon device | Moon beast |
| --- | --- | --- |
| Normal | Copper Turret: balanced ordinary attacks. | Grey Hound: balanced ordinary melee attacks. |
| Rare | Glass-Lens Turret: +25% ATK/INT, but −30% HP and −15% DEF. | Nightfang Wolf: +25% ATK and +10% INT, but −25% HP and −10% DEF. |
| Epic | Mirror Battery: actual magical HP damage to its owner charges a capped bonus for its next ordinary shot; fragile and cannot charge from reflection. | Gravehound: consumes an existing Curse to strengthen its ordinary strike, sacrificing all remaining Curse ticks; lower ordinary stats. |
| Legendary | Chronometric Regulator: one paid cooldown bypass for a qualifying native damaging skill, then that skill locks for the encounter; weak ordinary attacks and no extra turn. | Eclipse Serpent: up to two qualifying native damaging spells can pay HP instead of SP while deployed; payments cannot be lethal, and the vessel is fragile. |

The unconditional Legendary chance is **0.5% per successful regular eligible contract** and **1% per eligible Wanted victory**. Lore roles do not create free full-pathway combatants: beast, device and spirit vessels use bounded ordinary profiles.

Destroyed marionettes are permanently lost. Wrecked devices cost **£50** to restore. Defeated beasts and spirits recover after **three game days**. Recall and expiry preserve ownership and remaining health; surviving wounded vessels do not heal merely by being redeployed. A damaged living marionette can also receive a £50 restoration, while living beasts/spirits can be sent to rest for three days.

## Learned modifiers

Hermit learns Warding Constellation (less damage and higher SP cost for a personal shield), Blood Inscription (two nonlethal HP-paid native attacks), Thorn Tale (less direct damage for a short cleansable Curse), then Fairy-Tale Escape (one native defensive cleanse, followed by an offensive SP surcharge; usable from Sequence 4).

White Tower learns Barrier Thesis (opening shield penetration, weaker against an unshielded target), Channeling Thesis (one armor-piercing ordinary attack after witnessing a paid enemy spell, with lower speed), Vitality Thesis (brief enemy healing suppression and lower personal healing received), then Feint Thesis (control resistance after observing control, with lower accuracy).

## Persistence and verification

Save schema 15 uses the existing browser save key. Existing individual stats, variance, earned progression and pending results are preserved. Permanent inventory is separate from cleared battle activations. Guild mutations and full-storage choices use save-before-commit handling; a saved outcome settles once and cannot be recorded with unresolved choices.

Validation: **51 regression suites passed**, **147 effect behavior checks and 154 legacy balance checks passed**, and **36 real-browser inventory views** passed at 320, 390, 560 and 1440 pixels, including keyboard navigation, preparation changes, reload, paid repair and game-day recovery. New coverage includes final-kill ownership, failed-contract captures, fixed soul capacity, paid passives, every special device/beast effect, learned modifiers, companion loss, and duplicate-name battle resources.

The implementation also fixes Death AI repeatedly selecting an unavailable summon, same-name companion HP displays sharing a record, duplicate mythical soul acquisition, premature Door archive capacity, and owned deployment/recast commands entering copying archives. Reproducible commands and measurements follow.

## Combat measurements

Both sides use the production combat engine and equal Sequences 9–0, neutral variance, Stout Vitality, full SP and no weapon in PvP. Mirror matchups are included; sides are swapped with the same seed. The representative prepared library is fixed rather than optimized: Door has one record at Sequence 6 and three from Sequence 5; Hanged Man has five compatible powers; Fool has legal ordinary retained Tyrant profiles; Death uses Soul Reaper; Hermit uses Blood Inscription; White Tower uses Channeling Thesis; Visionary uses Aggression Pattern. Device/beast quality follows the selected scenario. Excluded pathways receive no invented equivalent mechanic.

| PvP scenario | Battles | Mean rounds | Finished by round 12 | Draws | Side-parity errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| Rare collections, 0 starting charge | 20,240 | 7.83 | 92.94% | 1.88% | 0 |
| Legendary collections, 100 starting charge | 10,120 | 7.81 | 92.81% | 1.84% | 0 |

Pacing meets the requested overall targets in these samples. **The 45–55% fairness target at every pathway/Sequence is still unmet**: the Rare scenario has 15 of 22 pathway averages and 102 of 220 pathway/Sequence groups in range. The Legendary charged scenario has 14 averages and 94 groups in range. These are bounded diagnostics, not evidence for every trait, acquired power, spirit role or party combination. Legendary and Rare scenarios also differ in charge, so their results do not isolate the effect of rarity.

| Pathway | Rare, cold wins | Legendary, charged wins |
| --- | ---: | ---: |
| Darkness | 58.8% | 60.2% |
| Door | 58.7% | 50.0% |
| Wheel Of Fortune | 55.5% | 57.2% |
| Fool | 55.0% | 61.3% |
| Black Emperor | 52.7% | 54.1% |
| Red Priest | 52.0% | 49.6% |
| Tyrant | 50.9% | 48.9% |
| Chained | 50.3% | 52.8% |
| Demoness | 49.7% | 51.1% |
| Hermit | 49.1% | 45.2% |
| Mother | 49.1% | 49.8% |
| White Tower | 48.7% | 47.4% |
| Error | 48.0% | 50.2% |
| Justiciar | 47.9% | 45.9% |
| Sun | 47.8% | 47.0% |
| Abyss | 47.2% | 47.0% |
| Twilight Giant | 46.4% | 52.2% |
| Paragon | 45.7% | 43.5% |
| Hanged Man | 44.9% | 43.9% |
| Visionary | 43.7% | 41.1% |
| Moon | 40.1% | 43.5% |
| Death | 37.1% | 38.0% |

Matching-Sequence solo trials use equipped agents with a knife, live trait rarity/variance, full SP, zero injuries/mastery and a 45-round limit. Two 22,000-battle scenarios (empty collections and representative Rare collections) had a **91% minimum group win rate**, approximately **99.66% mean wins**, no group below 80%, and no engine errors. These routine contracts are considerably easier than an exact 80% average; this release preserves their existing difficulty instead of retuning the contract economy while adding collections.

The 1,440-battle Wanted trial used six different three-agent lineups across all six bosses. Group wins ranged from **62.5% to 100%**, with no timeouts. The Sequence 0 Last Hour remains the hardest sampled boss, ranging from 62.5% to 95% across those lineups. Wanted victories are intentionally not guaranteed by party size alone.

## Reproduce

```sh
node tests/permanent-assets.test.js
node tests/permanent-asset-combat.test.js
NODE_PATH=<jsdom node_modules> node tests/permanent-assets-ui.test.js
NODE_PATH=<Playwright node_modules> CHROMIUM_PATH=/usr/bin/chromium node tests/permanent-assets-layout.test.js
node tests/effects-behavior.js
node scripts/build-runtime-data.js --check
node scripts/measure-pathway-duels.js --seeds=4 --assets=rare --output=reports/permanent-assets/pvp-rare-cold.json
node scripts/measure-pathway-duels.js --seeds=2 --assets=legendary --charge=100 --output=reports/permanent-assets/pvp-legendary-warm.json
node scripts/measure-contract-balance.js --samples=100 --assets=empty --output=reports/permanent-assets/solo-empty.json
node scripts/measure-contract-balance.js --samples=100 --assets=rare --output=reports/permanent-assets/solo-rare.json
node scripts/measure-wanted-balance.js --samples=40 --assets=rare --output=reports/permanent-assets/wanted-rare.json
```

Full data is in this directory's JSON files; `pathway-overview.csv` is the exportable 22-pathway overview. Native Thread Binding retains its five-stage conversion and uncapped dodge rules.
