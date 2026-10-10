# Phase 4: pathway identity, mythical forms and combat readability

Implemented the approved ability-based signatures for all 22 pathways. Fool retains its existing thread stages, control slots, marionettes, conversion strength and damage interruption rule. Full charge lowers attachment resistance by 20 percentage points, with a zero floor. There is no separate generic burst skill.

Work remains on `phase3-truthful-abilities`. The Phase 4 commit is local; it has not been pushed or deployed.

## Implemented identities

Charge is separate from stored skills, control slots and harmful corruption. The normal gain is 20 for a completed action plus one eligible 10-point signature gain per round, capped at 100. Door gains by witnessing eligible enemy casts; Error gains from successful deception or theft. Battle-only owned skills pay the original source cost/cooldown, use the owner's stats and never mutate shared definitions.

| Pathway | Ability-based tactical identity | Distinct mythical authority |
|---|---|---|
| Fool | Five thread stages, damage interruption and marionette conversion; charged attachment penetrates resistance | Existing Spirit Body Threads and marionettes preserved; fog-cloak artwork |
| Door | Witness from Sequence 6; replay one stored skill at full charge, preserving record capacity | Targeted party shelter at 4–3; one resistible two-turn exile at 2–0 |
| Error | Successful theft/deception; steal a witnessed skill from 6, deny its owner one turn and gain one paid use; parasitize from 4 | Escape one fatal direct hit through a living host at 4–2; steal one action and gain a paid extra action at 1–0 |
| Visionary | Observation and charged Hypnosis command the victim's next action | Resistible dream prison; HP damage wakes the victim and causes one Psychic backlash |
| Darkness | Sleep enables charged dream damage; waking closes dream access | Party concealment against targeted attacks; each attacker reveals itself |
| Death | One temporary undead companion, sustained at full charge | Recall one fallen nonsummoned ally at 35% HP without resetting survival counters |
| Twilight Giant | Charged Guardian protection and one retaliation | Intercept half of direct single-target damage aimed at another ally |
| Red Priest | War Command grants one follow-up per ally | Party direct HP damage cleaves one additional enemy for 50% Fire damage |
| Sun | Holy damage and purification; charged cleanse and removal of one dark protection | Cleanse allies and protect against Poison/Curse for two owner turns |
| Tyrant | Soak a target; charged Lightning consumes Soaked and chains to another foe | Two owner-turn team-wide Lightning pulses |
| Demoness | Curse ticks build separate Affliction; charged spread reaches one other victim | One resistible petrification, broken by HP damage |
| Wheel of Fortune | Retry one failed contest, punish failed offense with Calamity, restore HP/buffs from two rounds earlier | Temporary Dodge at 4–2; one fatal HP snapshot rewind at 1–0 |
| Black Emperor | Redirect one beneficial enemy spell at full charge | Steal the next enemy beneficial active spell within two owner turns |
| Justiciar | Paid healing/shield prohibition and judgment | Forbid enemy active healing/shields for two owner turns and punish violations |
| Hanged Man | Retain one final defeated Beyonder's eligible skill; charged paid soul release | Devour one final enemy Beyonder death, recover 50% HP and replace the soul slot |
| Hermit | Prepare one owned spell scroll; charged paid release independent of source cooldown | Nonphysical, non-true spells gain 50 points of DEF bypass and halve elemental resistance |
| White Tower | Analyze repeated casts and imitate one paid skill from Sequence 6 | Decode/cancel one direct nonphysical, non-true hit and retain one eligible paid imitation |
| Paragon | Maintain one device, renewed with charge | Manifest one historical machine for three owner turns |
| Mother | Maintain one ally's life seed; full charge strengthens its recovery | Heal living allies by 10% Max HP at each of three owner-turn starts |
| Moon | Medicine from 9, beast from 8, Sanguine recovery from 7 | Party direct HP damage heals an eligible ally, with a per-turn cap |
| Abyss | Track the SP a Desire victim actually pays; charged detonation uses that expenditure | Punish enemy active casts with bounded Fire backlash |
| Chained | Contain a self-curse, gain endurance charge, then release before backlash | Link one cleansable curse and echo actual direct HP damage without recursion |

These are compact tactical interpretations of the supplied lore, rather than simulations of every high-Sequence authority. Rank gates and all temporary numbers appear in generated descriptions.

Error Sequence 5 now applies the separately approved rule: one resistible effect redirects the victim's next paid damaging ability to its own side within two victim turns. It neither strikes nor stuns immediately. The cast keeps normal SP, cooldown and hit rules; a paid misfire consumes the redirection. Error Sequence 4 now siphons SP actually available on host turns. Self-parasitism is rejected and cannot recurse during fatal protection.

## Mythical forms and combat presentation

The common once-per-battle awakening at Sequence 4 or better and at 50% HP retains its 30% Max HP shield and 20% outgoing damage bonus. Transformation now independently attempts a **70% one-action stun only against actual Sequence 5–9 enemies**, respecting immunity. Each bounded authority has an explicit lifetime/use count; the transformed artwork remains until battle end. New temporary companions cannot awaken their own forms.

Active forms use existing versioned 192px runtime artwork. Original artwork and the full-resolution portrait viewer are preserved. Unit and image nodes stay stable during HP, status and form updates.

Both teams display actual HP, shield, SP and charge, with Fool slots/binding stages and Door record counts separate. Damage rows distinguish shield absorption from HP loss. Reactions and recovery retain their real source and recipient. Results count final casualties, exclude successful revivals and distinguish victory, defeat and the 15-round limit. A stalemate does not claim the contract completed.

Pause/Resume, one-action Step and a slower Read pace were added. Existing faster speeds remain. Buttons have 44px minimum targets and resource text remains readable on phones. Expired summons stay in their existing nodes and appear inactive even when their last HP snapshot is nonzero.

## Balance changes

All existing numerical acceptance thresholds remain unchanged. Neutral matched battles retain equal damage; the PvE party-enemy multiplier changes from 1.5 to 1.3 to address opening casualties. The relative INT contribution to the shared dodge contest changes from 0.25 to 0.10; innate dodge and other defenses remain.

| Existing field | Before | After |
|---|---:|---:|
| Death Zombie Transformation SP / scale | 45 / 1.7 | 25 / 2.3 |
| Death undead strength / lifetime | 0.35 / 3 turns | 0.75 / 4 turns |
| Darkness Dream Slumber SP / charged INT multiplier | 35 / 0.75 | 25 / 2.0 |
| Darkness Midnight Requiem scale | 1.2 | 1.8 |
| Fortune Misfortune Aura SP / backlash / mark duration | 35 / 0.75 / 2 | 25 / 1.5 / 3 |
| Black Emperor Order Distortion SP / scale | 45 / 1.5 | 20 / 2.3 |
| Error Combat Theft ATK/DEF theft | 10% | 15% |

Death's four-turn companion also makes legal sustain reachable after its existing cooldown. Chained's contained curse lasts four turns so the existing cooldown can resolve before release. Neither change adds an extra action or bypasses SP/cooldown payment.

The unchanged balance suite now passes **152/152 checks**. Opening mixed-party wins rose from 68.7% to 84.2%, and deaths fell from 1.00 to **0.35 per quest**, below the unchanged 0.60 limit. Sequence 5 same-path spread fell from 100 to **70 percentage points**; Sequence 9 spread was already passing and fell from 73.9 to **67.3 points**. Both unchanged 75-point spread limits pass. Prepared Error starters initially regressed to 13/20 campaign boss wins after the shared dodge adjustment; the existing 14/20 threshold was preserved and the theft tuning restores **17/20**.

The all-rank sweep completed **45,540 battles**, covering all 22 pathways at Sequences 9–0, 1v1/3v3, initial charge 0/50/100 and controlled form entry. It found **zero resource-fixture mismatches and zero swapped final-state mismatches**. [Contract rates](reports/phase4/contract-balance.md) and [all-rank rates](reports/phase4/after-neutral.md) distinguish PvE success from neutral win/draw outcomes; the [CSV](reports/phase4/after-neutral.csv) contains all 1,980 combinations.

## Regression tests and verification

New tests were written against failing behavior before the associated fixes. Evidence covers initial missing signatures, charge/resource ownership, school-specific protection, paid support restrictions, victim-turn expiry, fatal redirection, exact paid SP, forced misses on charged damage, identical-name initiative ties, shield/HP accounting and stable browser controls. Per-rank checks now cover **all 220 abilities on both sides with no deferred diagnostics**; browser and Node descriptions also have parity for all 220 ranks.

The final functional run passes **42/42 suites**: 40 JavaScript suites and two Python artwork suites. No production or test source changed during collection. The unchanged full balance suite passes separately. The [verification record](reports/phase4/verification.json) contains individual results and source hashes; [coverage evidence](reports/phase4/coverage.md) reports **90.72% mapped V8 source-range execution** and **231/243 changed/new functions reached**. This is not conventional statement/branch coverage. [TDD evidence](reports/phase4/tdd-evidence.md) records the concrete RED/GREEN failures and fixes.

Key checks include 9,322 quantitative assertions across all 220 abilities on both teams, 45 signature regressions, 88 mythical-authority regressions, 17 shared-combat checks and 21 combat-UI checks. The final review corrected Darkness's concealment tooltip to say it breaks on direct damage; a failing-then-passing test verifies that indirect damage and reflection preserve concealment. Save migration, copied-skill isolation, generated-description parity and both earlier-phase suites remain covered. Artwork tests preserve all 242 originals and validate the existing runtime variants.

Real Chromium checks cover 320, 390, 560 and 1440px layouts. Separate [phone](reports/phase4/preview-mobile.png) and [desktop](reports/phase4/preview-desktop.png) previews verify stable mythical artwork, visible HP/shield/SP, pause/resume, one-action stepping, readable text, 44px controls, no page overflow and no browser errors. See [UI evidence](reports/phase4/ui-verification.md). Runtime build freshness, JavaScript syntax, JSON parsing and diff checks also pass. No TypeScript/lint task or production dependency manifest exists in this repository.

## Compatibility and security review

Save schema 10 retains the existing storage key and migrates older saves. Legacy Demoness corruption is preserved as an affliction; its new usable Affliction charge starts from the legacy value once. Updated cached ability IDs are refreshed even when the number of unlocked abilities is unchanged. Stats, injuries, digestion, equipment, progression and legacy records are retained. Battle-only copies, summons and authority state are cleared from persisted agents.

The engine uses owned deep copies for recorded, stolen, grazed and imitated skills; recursive copy/summon/form/revival sources are excluded. Fatal host redirection cannot target its own caster. Damage reactions are bounded and cannot trigger themselves. Combat identity uses actual IDs, including a final initiative tie-break independent of team when names match. Resource/history dictionaries safely handle prototype-shaped IDs. Dynamic combat text/counters are escaped and mythical image sources use the existing validated runtime manifest. No external service, credential, production dependency or repository setting was introduced.

Already-correct earlier-phase rules were retained: shield before damage reduction, duration data and next-turn buff expiry, automatic revivals, effective injured stats, original-art preservation, versioned caches and generated descriptions. The original audits' earlier claims were not treated as fresh defects after those fixes.

## Preserved boundaries and open questions

No open design decision blocks the approved implementation. Fool's one-turn Spiritual Exhaustion remains its existing marker because the user explicitly asked to keep Fool as before. Hermit's old general outgoing bonus and Tyrant's old general reflection retain their existing broader, truthfully described scopes; the approved new signature/form rules do not invent additional restrictions for those inherited effects. Mechanical movement/range, full fictional time travel and permanent transformations are outside the approved compact mechanics.

The neutral sweep is a deterministic interaction and side-parity check with a small independent-seed count; it cannot establish precise competitive rankings. At Sequence 9, 18 of 22 pathways draw in at least 91% of normal zero-charge 3v3 matches, while Abyss wins 78.26%. Frequent draws and low-rank Abyss dominance remain material balance concerns despite passing the existing PvE gates. Support pathways need mixed-party role coverage before broader competitive tuning. Draws and controlled low-HP form entry are reported separately. Larger seed counts can be run with the same script; changing the 15-round limit would require a separate design decision.

## Files and reproduction

- New combat modules: `js/signatures.js`, `js/mythical.js`; integration in `js/engine.js`, `js/v15.js`, `js/paths.js`, loaders and exports.
- Identity, costs and approved tuning: all 22 `data/pathways/*.json`, `data/balance.json`, `data/formulas.json`.
- Save migration: `js/state.js`.
- Combat UI: `js/ui.js`, `css/components/battle-log.css`, `css/components/dungeon-arena.css`.
- Versioned deployment data: `data/runtime/manifest.json`, additive runtime bundles, `index.html`, `scripts/build-runtime-data.js`.
- New `tests/phase4-*.test.js`, the paired simulator `tests/phase4-balance.js`, and existing fixtures updated for actual paid copies, the two new Error rules and module loading. Existing balance assertions were not weakened.
- Evidence and previews: `reports/phase4/` and this report.

Applied [Ponytail full](/workspace/requested-workflows/ponytail/skills/ponytail/SKILL.md) and ECC's [TDD](/workspace/requested-workflows/ecc/skills/tdd-workflow/SKILL.md), [security review](/workspace/requested-workflows/ecc/skills/security-review/SKILL.md) and [verification loop](/workspace/requested-workflows/ecc/skills/verification-loop/SKILL.md) from the official source copies already available. CLI plugin registration is not claimed.

```sh
node tests/phase3-actual-casts.test.js
node tests/phase4-signatures.test.js
node tests/phase4-mythical.test.js
node tests/phase4-core.test.js
node tests/phase4-side-parity.test.js
node tests/phase4-saves.test.js
node tests/phase4-balance.test.js
node tests/balance.js
node tests/phase4-balance.js --phase=after --seeds=1
NODE_PATH=/path/to/node_modules node tests/phase4-ui.test.js
NODE_PATH=/path/to/node_modules CHROMIUM_PATH=/usr/bin/chromium node reports/phase4/browser-qa.js
node scripts/build-runtime-data.js --check
git diff --check
```

This plain JavaScript repository has no configured TypeScript or lint task. Applicable checks are syntax, JSON validation, tests, deterministic build freshness, exact-source execution coverage, security review and diff inspection.
