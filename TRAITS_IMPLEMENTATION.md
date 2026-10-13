# Trait rarity and paid recruitment refresh

Recruitment now offers a £50 refresh of all four visible candidates. The player chooses a candidate and hires them for £150. The existing free seven-day refresh and empty-office refill remain. Paid refresh does not advance the game day, and a failed save changes neither the visible candidates nor funds.

Each newly generated candidate independently rolls a tier, then one of that tier's traits. There is no random-hire action or additional rarity stat multiplier.

| Tier | Candidate generation chance | Traits | Identity |
|---|---:|---:|---|
| Normal | 74% | 5 | A simple 5–8% stat buff, without a penalty |
| Rare | 20% | 4 | A 15–20% stat advantage with the existing drawback |
| Epic | 5% | 10 | A bounded tactical trigger and a disadvantage |
| Legendary | 1% | 10 | A change to combat rules with an ongoing cost or restriction |

The 1% Legendary chance applies to each candidate, not to a four-candidate batch. Traits within a tier have equal generation weight. New traits appear during recruitment and activate after awakening; their identities do not reroll during progression.

## Stat traits

| Normal | Buff |
|---|---|
| Hardy | +8% Max HP |
| Strong | +5% ATK |
| Resilient | +8% DEF |
| Keen Mind | +5% INT |
| Quick | +5% Speed |

| Rare | Benefit | Drawback |
|---|---|---|
| Glass Cannon | +20% ATK | −10% Max HP |
| Ironclad | +18% DEF | −5% Speed |
| Swiftfoot | +18% Speed | −5% DEF |
| Fervent Spirit | +20% INT, +15% Max SP | −10% DEF |

## Special traits

Epic traits: Wardbreaker, Vengeful Echo, Runic Carapace, Cinder Touch, Nerve Pin, Merciful Touch, Spiteful Shell, Break the Chain, Hunter's Opening, and Fractured Moment.

Legendary traits: Fate's Debt, Martyr's Mantle, Blood Script, Hollow Saint, Unbroken Will, Lone Sovereign, Unbound Canticle, Spell Eater, Chronal Engine, and Spirit Bastion.

`data/traits.json` is the authored source for names, tiers, parameters, penalties, and rates. `js/traits.js` resolves descriptions and implements the rules. The combat engine carries actual HP/SP payments, source-aware healing, shield eligibility, direct-damage origin, scheduled-turn actions, and replay events through the same trait rules. Temporary use counts and budgets remain local to an encounter.

Important limits include one round-capped refund or tactical proc, one Fate's Debt survival per battle, no recursive transfer/retaliation, unchanged Sequence restrictions, and no trait protection from advancement failure. Blood Script requires enough HP to survive its payment. Hollow Saint converts ordinary healing and overhealing into shields while leaving resurrection intact. Lone Sovereign requires original solo deployment, not merely becoming the last survivor. Unbound Canticle expands damage while keeping utility and execution on the original target.

## Compatibility and presentation

The save schema is 13, using the existing `guild-rpg-browser-v9` storage key. Old agents and candidates retain their old effects, stats, variance, and progress. New catalog IDs and source metadata survive load, awakening, and advancement. Unsupported future IDs are preserved rather than randomly replaced. Existing enemies and summons do not receive new rolled traits automatically.

Recruit cards, the roster, dossiers, and both simulator teams expose the catalog. Costs in replay distinguish HP from SP; conversions and protective payments produce recorded outcomes. Refresh results are saved before the short card reveal. A reveal-time repeat-click guard prevents an accidental second charge. Reduced motion disables the reveal animation. Navigation and recruitment fit a 320px viewport.

## Validation

The feature adds `tests/traits.test.js` and `tests/trait-ui.test.js`, alongside the existing combat, campaign, save, loader, UI, cache, portrait, and balance checks. Run DOM tests with jsdom installed and available through `NODE_PATH` as documented in existing UI tests.

```sh
node tests/traits.test.js
NODE_PATH=/tmp/guild-trait-check/node_modules node tests/trait-ui.test.js
node scripts/build-runtime-data.js
node scripts/build-runtime-data.js --check
```

The runtime builder includes the trait catalog, the new module hash, and the updated CSS hashes. Commit its generated bundle, manifest, and index updates together with authored changes. The browser and Node loaders use the same catalog.

Behavior verification includes every trait, paid-refresh storage failure and repeated clicks, direct hiring, save migration, and simulator isolation. A seeded integration matrix completed 1,102 battles across all 22 pathways at Sequence 9 and eight representative pathways at Sequences 5 and 0 without runtime exceptions. Normal versus Rare ATK/HP comparisons confirmed the intended distinction on all 22 pathways. No relevant early active skill became universally unaffordable under the cost-penalty traits.

These checks verify behavior and guard against regressions. The numerical values remain playtest balance choices, particularly for party combinations and advanced pathway interactions.
