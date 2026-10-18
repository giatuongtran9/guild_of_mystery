// Authored Sequence 8 presentation data stays tied to the actual pathway powers.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateBattleFx } = require('../js/data-loader.js');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const original = read('fx.json'), pathways = read('pathways/index.json').order;
const sequence8 = pathways.map(key => ({ pathway: key,
  ability: read(`pathways/${key}.json`).sequences.find(tier => tier.sequence === 8).ability }));
const active = sequence8.filter(entry => entry.ability.kind === 'active');
let passed = 0;
function test(name, run) { run(); passed++; console.log('PASS ' + name); }
function rejects(name, mutate) {
  test(name, () => {
    const data = JSON.parse(JSON.stringify(original));
    mutate(data);
    assert.throws(() => validateBattleFx(data, pathways), /data\/fx\.json:/);
  });
}

test('the authored table covers exactly all twenty active Sequence 8 abilities', () => {
  assert.equal(active.length, 20);
  assert.deepEqual(Object.keys(original.sequence8Abilities).sort(), active.map(entry => entry.ability.id).sort());
  for (const { pathway, ability } of active) assert.equal(original.sequence8Abilities[ability.id].pathway, pathway);
  for (const { ability } of sequence8.filter(entry => entry.ability.kind === 'passive')) {
    assert.equal(Object.hasOwn(original.sequence8Abilities, ability.id), false, 'passive powers do not acquire cast animations');
  }
});
test('every ability has its own local PNG and a valid palette color', () => {
  const assets = new Set();
  for (const { ability } of active) {
    const entry = original.sequence8Abilities[ability.id];
    assert.deepEqual(Object.keys(entry).sort(), (ability.id === 'beast_command' ? ['pathway', 'asset', 'color', 'mode', 'fallbackAsset'] : ['pathway', 'asset', 'color', 'mode']).sort());
    assert.equal(entry.asset, `data/assets/effects/sequence8/${ability.id.replace(/_/g, '-')}.png`);
    if (ability.id === 'beast_command') assert.equal(entry.fallbackAsset, 'data/assets/effects/sequence8/beast-command-claw.png');
    assert.match(entry.color, /^#[a-f0-9]{6}$/i);
    assert(['travel', 'strike', 'support', 'caster'].includes(entry.mode));
    assets.add(entry.asset);
  }
  assert.equal(assets.size, active.length, 'abilities cannot accidentally share their primary PNG');
  assert.notEqual(original.sequence8Abilities.beast_command.fallbackAsset, original.sequence8Abilities.beast_command.asset);
});
test('the authored modes respect support recipients and stationary target strikes', () => {
  for (const id of ['deceptive_feint', 'midnight_requiem', 'instigation', 'desire_ignition', 'madness_curse', 'mystic_spell'])
    assert.equal(original.sequence8Abilities[id].mode, 'strike', id + ' resolves directly on the target');
  assert.equal(original.sequence8Abilities.beast_command.mode, 'support', 'companion support remains recipient-targeted');
  assert.equal(original.sequence8Abilities.bad_luck_curse.mode, 'caster', 'intent does not claim the crit restriction succeeded');
  assert.equal(original.sequence8Abilities.provocation.mode, 'caster', 'intent does not claim an immune target was taunted');
  assert.equal(original.sequence8Abilities.nature_growth.mode, 'strike', 'growth is an attack rather than a healing cue');
  assert.equal(original.sequence8Abilities.heavy_cleave.mode, 'travel', 'the single-target cleave travels to its target without becoming an area wave');
});
test('colors retain established pathway identities rather than generic physical orange', () => {
  const entries = original.sequence8Abilities;
  assert.equal(entries.paper_card_dagger.color, '#c5badf');
  assert.equal(entries.elemental_spark.color, '#91d1df');
  assert.equal(entries.crafted_blade.color, '#e7bc79');
  assert.equal(entries.beast_command.color, '#c8b9e8');
  assert.equal(entries.madness_curse.color, '#b998d0');
  assert.equal(entries.nature_growth.color, original.damageColors.nature);
  assert.equal(entries.undying_touch.color, original.damageColors.death);
  assert.equal(entries.bad_luck_curse.color, original.damageColors.fate);
});
test('shared validation accepts authored metadata without mutating it', () => {
  const before = JSON.stringify(original);
  assert.equal(validateBattleFx(original, pathways), original);
  assert.equal(JSON.stringify(original), before);
});
rejects('missing Sequence 8 metadata is rejected', data => { delete data.sequence8Abilities; });
rejects('null Sequence 8 metadata is rejected', data => { data.sequence8Abilities = null; });
rejects('array Sequence 8 metadata is rejected', data => { data.sequence8Abilities = Object.values(data.sequence8Abilities); });
rejects('missing active ability entries are rejected', data => { delete data.sequence8Abilities.paper_card_dagger; });
rejects('extra ability entries are rejected', data => { data.sequence8Abilities.unlisted = { ...data.sequence8Abilities.paper_card_dagger }; });
rejects('duplicate pathway assignments are rejected', data => { data.sequence8Abilities.elemental_spark.pathway = 'fool'; });
rejects('unknown pathway assignments are rejected', data => { data.sequence8Abilities.paper_card_dagger.pathway = 'unknown'; });
rejects('incomplete effect records are rejected', data => { delete data.sequence8Abilities.paper_card_dagger.mode; });
rejects('null effect records are rejected', data => { data.sequence8Abilities.paper_card_dagger = null; });
rejects('array effect records are rejected', data => { data.sequence8Abilities.paper_card_dagger = []; });
rejects('raw markup in effect records is rejected', data => { data.sequence8Abilities.paper_card_dagger.svg = '<svg/>'; });
rejects('fallback artwork is restricted to Beast Command claw art', data => { data.sequence8Abilities.paper_card_dagger.fallbackAsset = 'data/assets/effects/sequence8/paper-card-dagger-claw.png'; });
rejects('unknown playback modes are rejected', data => { data.sequence8Abilities.paper_card_dagger.mode = 'area'; });
rejects('non-string playback modes are rejected', data => { data.sequence8Abilities.paper_card_dagger.mode = ['travel']; });
rejects('external asset URLs are rejected', data => { data.sequence8Abilities.paper_card_dagger.asset = 'https://example.test/paper-card-dagger.png'; });
rejects('parent-directory asset paths are rejected', data => { data.sequence8Abilities.paper_card_dagger.asset = 'data/assets/effects/sequence8/../paper-card-dagger.png'; });
rejects('asset paths for another ability are rejected', data => { data.sequence8Abilities.paper_card_dagger.asset = data.sequence8Abilities.elemental_spark.asset; });
rejects('non-PNG assets are rejected', data => { data.sequence8Abilities.paper_card_dagger.asset = 'data/assets/effects/sequence8/paper-card-dagger.svg'; });
rejects('asset query strings are rejected', data => { data.sequence8Abilities.paper_card_dagger.asset += '?remote=1'; });
rejects('CSS color fragments are rejected', data => { data.sequence8Abilities.paper_card_dagger.color = '#c5badf;background:red'; });
rejects('CSS variable colors are rejected', data => { data.sequence8Abilities.paper_card_dagger.color = 'var(--color)'; });
rejects('short hex colors are rejected', data => { data.sequence8Abilities.paper_card_dagger.color = '#abc'; });
rejects('non-string colors are rejected', data => { data.sequence8Abilities.paper_card_dagger.color = 0xc5badf; });
rejects('unsafe ability keys are rejected', data => {
  const effect = data.sequence8Abilities.paper_card_dagger;
  delete data.sequence8Abilities.paper_card_dagger;
  data.sequence8Abilities.constructor = { ...effect, asset: 'data/assets/effects/sequence8/constructor.png' };
});
rejects('path-like ability keys are rejected', data => {
  const effect = data.sequence8Abilities.paper_card_dagger;
  delete data.sequence8Abilities.paper_card_dagger;
  data.sequence8Abilities['../paper_card_dagger'] = effect;
});

console.log(`Sequence 8 FX data regressions: ${passed} passed.`);
