Guild of Mystery — v17 JSON Data Layer

Opening campaign: The Whispering District
  The Campaign tab introduces Sequence 9 play through five ordered missions:
  recruit/awaken/equip, investigate, prepare, confront Cantor Vale, close the case.
  Existing guild recruits and equipment count. Investigation clues and preparation
  change the actual boss encounter. Choose 1–3 active, awakened agents per mission.
  Chapter battles use rested copies: defeat never kills or injures persistent agents.
  Saved pending outcomes resume after reload and settle once. Supernatural contracts and
  advancement keep their existing risks. Finishing grants a case-file badge and
  supplies toward Sequence 8; advancement still requires full potion digestion.
  Story and rewards: data/campaign.json. Runtime: js/campaign.js.
  Campaign verification: node tests/campaign.test.js.

Run on GitHub Pages:
  Open index.html through a static host such as GitHub Pages.
  The browser bootstrap loads data/pathways/index.json first, then fetches all
  22 pathway files plus the shared JSON files asynchronously before loading
  the game engine.

Data architecture:
  data/pathways/index.json — manifest: schema, ordered pathway keys and the
                             22-key counter map. GitHub Pages cannot list a
                             directory, so this is the source of truth.
  data/pathways/<key>.json — exactly one Pathway per file, with its metadata,
                             meter, Sequence 9→0 names and one editable ability
                             block per Sequence.
  data/items.json          — weapons and item definitions only; Pathway abilities are authoritative in data/pathways/*.json.
  data/enemies.json        — enemy name pools, human names/occupations/weapons,
                             traits and threat/name tables.
  data/contracts.json      — contract templates, wanted targets, tags and
                             reputation/sequence contract settings.
  data/formulas.json       — damage formulas and mythical-form rules.
  data/balance.json        — global balance tables, stat progression, archetypes,
                             Pathway tuning, element resistance rules and
                             progression costs. Ability-specific modifiers live
                             in their Pathway ability block, not here.

Startup loader:
  js/data-loader.js first fetches data/pathways/index.json.
  It validates the manifest, then fetches all 22 Pathway files in parallel.
  It then fetches items.json, enemies.json, contracts.json, formulas.json and
  balance.json in parallel. Loading progress reports pathway progress as
  "Loading pathways N/22" and identifies the failing file on errors.
  Fetches use a timeout, retries and a cache-bypass query on retry for static
  hosting reliability.

Runtime compatibility:
  The loader assembles PATHS, PATH_KEYS, PATH_COUNTERS and PATH_METERS in the
  exact manifest order so the rest of the engine and UI do not need to know
  that Pathways are stored as separate files. The old system/characters data
  surfaces are assembled as runtime compatibility objects from balance.json
  and enemies.json; no duplicate source tables are maintained.

Adding a 23rd Pathway:
  1. Create data/pathways/<new_key>.json using the pathway.v1 shape.
  2. Add <new_key> to data/pathways/index.json order at the desired position.
  3. Add a counter entry for <new_key> and update the existing counter mapping
     so the counter relationship includes the new key.
  4. Add the Pathway's progression costs to balance.json if it uses advancement
     costs not already represented there.
  5. Run the manifest/data-layer tests before publishing.

Tests:
  node tests/node-loader.js
  node tests/generic-effects.js
  node tests/effects-behavior.js   (runs every effect type through the real engine)
  node tests/balance.js

Current progression, combat measurements and known 1v1 balance limitations are
documented in reports/progression-review/CURRENT.md. The balance regression
script also checks the current advancement and supernatural-board rules.

Ability data ownership:
  Pathway ability definitions, including active/passive modifiers and secondary
  effects, live in their individual data/pathways/<key>.json files. items.json
  no longer contains a duplicate ability_data table. balance.json contains
  global combat rules/tables only. Each ability uses a generic effects[]
  array; every effect type is interpreted by the combat engine.

Trait notes:
  Bloodthirst keeps its special 8% lifesteal effect in addition to its stat changes.
  Madness Prone now applies -15% INT, +15% INT resistance and +10% ATK.

GitHub Pages note:
  The loader resolves data relative to the current index.html with './', so
  project Pages URLs such as https://<user>.github.io/<repo>/ correctly request
  <repo>/data/pathways/index.json rather than the site root.

Battle Simulator
----------------
The Guild Hall now includes a Battle Simulator tab. Select 1v1 or 2v2, choose any of the 22 Pathways and any Sequence 9 through 0 for each combatant, then run the simulation. The simulator uses the same combat engine, ability/effect JSON and resistance/damage rules as contracts and does not modify the guild save.

Effect Audits
-------------
tests/generic-effects.js only checks that each effect type name appears in the engine source, so it cannot catch handlers that never run.
tests/effects-behavior.js is the real audit: it runs every effect type used by the 22 Pathway JSON files through the engine and asserts an observable combat change (129 checks). It FAILS if a new effect type is added to the data without a behaviour scenario, so a modifier cannot silently become display-only again.

Effect durations
----------------
Every timed effect on an active ability carries its own timer, written in the ability's JSON on that effect:
  { "type": "steal_stat", "stat": "atk", "amount": 0.2, "duration": 3 }
  duration = number of rounds (1 = the rest of the cast round only, 2 = the cast round and the next, ...)
           or "next_turn" = until the unit holding the effect takes its next action.
Applies to: buff, debuff, steal_stat (atk/def/int), vulnerability*, outgoing_damage, dodge, counter, damage_taken, reflect, taunt, debuff_hit,
and defense_penetration on abilities that deal no damage themselves. A missing duration falls back to data/balance.json "effect_durations".
To change a duration later, edit that one number (and the number in the description text; tests/effects-behavior.js fails if they disagree).
status / status_chance / sp_cost_increase / cooldown_increase / no_heal / movement_block already used their own duration field.

Incoming damage pipeline (engine.js resolveIncoming): reflect-buff negate -> shield absorbs -> damage reduction (passive and active) applies to the remainder -> HP loss -> reflect. Basic attacks, abilities, counters and mind-control hits all use it.

Trait rarity and paid recruitment refresh
---------------------------------------
Refresh all four visible recruits for £50, then choose whom to hire for £150.
Each new candidate rolls Normal 74%, Rare 20%, Epic 5%, or Legendary 1%.
Free seven-day refresh and empty-office refill remain. Paid refresh costs no day.
New traits are revealed before awakening and activate at Sequence 9.
Ordinary candidates and agents hide combat stats until awakening. Choose any
Pathway: there are no recommendations or recommended-Pathway stat bonuses.
Individual stat variation remains +/-10% at awakening. Existing awakened agents
keep their saved stats when loading older saves.
Normal buffs are 5–8%; Rare advantages are 15–20% with existing drawbacks.
Epic traits add tactical triggers; Legendary traits change combat rules.
The 29 definitions and rates live in data/traits.json; details and validation
are documented in TRAITS_IMPLEMENTATION.md. Old agents keep their old effects.
Run node tests/traits.test.js and the documented DOM trait-ui test.
After changing data or code, run node scripts/build-runtime-data.js and
node scripts/build-runtime-data.js --check before publishing.

Progression and wanted bosses
----------------------------
Awakening to Sequence 9 is guaranteed. Success when reaching Sequences
8/7/6/5/4/3/2/1/0 is 98/96/94/92/90/88/86/84/80 percent.
On-rank solo digestion takes 4/4/5/6/7/9/10/12/15 successful contracts
for potions 9 through 1. Easier jobs grant less digestion.
Ordinary errands are retired. Boards retain beginner work and jobs matching
the strongest active agent, with optional harder threats as reputation grows.
Six named wanted bosses require three awakened Beyonders and award greater
funds, materials and 2.5x base digestion to each survivor. Each boss can be
defeated once; declining hides the warrant until the next game day.
Failed jobs grant no materials or reputation. Routine failures retain 35%
of funds; failed boss hunts pay nothing.
Guild changes take effect only after the save succeeds. A saved battle resumes
after reload and settles once. Free recruitment refresh checks every day change.

Verification:
  node tests/progression-contracts.test.js
  NODE_PATH=<jsdom installation> node tests/persistence-contracts-ui.test.js
  node scripts/measure-contract-balance.js --samples=200 --seed=1719381
  node scripts/measure-wanted-balance.js --samples=50
  node tests/phase4-balance.js --phase=pvp-after --seeds=3 --charges=0 --sizes=1 --modes=normal
Full results, benchmark conditions and the 22-pathway overview are in
reports/progression-review/CURRENT.md.

Permanent character collections
------------------------------
Fool, Door, Hanged Man, Death, Hermit, White Tower, Paragon, Moon and Visionary
now have a collapsible Pathway Inventory section in the character dossier.
Active and passive skills share a collapsible Abilities section. Assets come from
credited kills, witnessed spells, contract drops or earned learning milestones.
Hanged Man stores five souls at every Sequence. Devices and beasts have one
Normal/Rare/Epic/Legendary definition per tier and retain their own drawbacks.
Preparation, paid combat use, saved replacement choices and companion recovery
are documented with measured balance limits in reports/permanent-assets/CURRENT.md.
