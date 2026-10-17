// Authored visual data is validated identically in browser, build and Node.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateBattleFx } = require('../js/data-loader.js');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const original = read('fx.json'), paths = read('pathways/index.json').order;
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
function rejects(name, mutate) {
  test(name, () => {
    const data = JSON.parse(JSON.stringify(original)); mutate(data);
    assert.throws(() => validateBattleFx(data, paths), /data\/fx\.json:/);
  });
}

test('all 22 pathways and eight renderer-owned families have valid authored FX data', () => {
  const before = JSON.stringify(original);
  assert.equal(validateBattleFx(original, paths), original);
  assert.deepEqual(Object.keys(original.pathwayDefaults).sort(), [...paths].sort());
  assert.deepEqual(Object.keys(original.families), ['slash', 'bolt', 'beam', 'orb', 'shard', 'wisp', 'thread', 'wave']);
  assert.equal(JSON.stringify(original), before, 'validation cannot mutate authored data');
});
test('every canonical damage type retains an authored six-digit color', () => {
  const { elements, aliases } = read('balance.json').element_resistance_rules;
  for (const name of [...elements, 'elemental', 'true']) assert.match(original.damageColors[name], /^#[a-f0-9]{6}$/i, name);
  for (const key of paths) for (const tier of read(`pathways/${key}.json`).sequences) {
    let type = tier.ability.damageType;
    const seen = new Set();
    while (aliases[type] && !seen.has(type)) { seen.add(type); type = aliases[type]; }
    if (type) assert(original.damageColors[type], `${key}: ${type} has a damage color`);
  }
});
test('basic attack families distinguish weapons and caster pathways', () => {
  assert.equal(original.basicAttack.melee, 'slash');
  assert.equal(original.basicAttack.unarmed, 'slash');
  assert.equal(original.basicAttack.gun, 'bolt');
  assert.equal(original.basicAttack.caster, 'orb');
  assert.equal(original.basicAttack.pathways.fool, 'thread');
  assert.equal(original.basicAttack.pathways.tyrant, 'bolt');
});
test('impact and chip settings retain the requested readable timings', () => {
  assert.equal(original.impact.frames, 4);
  assert.equal(original.impact.durationMs, 160);
  assert(original.impact.critScale > 1);
  assert.equal(original.abilityChipMs, 500);
});
test('critical feedback uses stronger orange bursts and larger numbers without a hit-stop setting', () => {
  assert.equal(original.impact.critColor, '#ffa64d');
  assert.equal(original.impact.critScale, 1.5);
  assert.equal(original.impact.critNumberScale, 1.25);
  assert.equal(Object.hasOwn(original.impact, 'critHitStopMs'), false);
});
test('basic caster pathway overrides are optional', () => {
  const data = JSON.parse(JSON.stringify(original)); delete data.basicAttack.pathways;
  assert.equal(validateBattleFx(data, paths), data);
});
rejects('unknown schema is rejected', data => { data.schema = 'guild.battle-fx.v2'; });
rejects('unknown top-level settings are rejected', data => { data.html = '<script>bad</script>'; });
rejects('missing damage color fallback is rejected', data => { delete data.damageColors.default; });
rejects('CSS color fragments are rejected', data => { data.damageColors.fire = 'red;background:url(test)'; });
rejects('CSS function colors are rejected', data => { data.damageColors.fire = 'var(--color)'; });
rejects('unsafe damage type keys are rejected', data => { data.damageColors.constructor = '#abcdef'; });
rejects('missing effect family is rejected', data => { delete data.families.wave; });
rejects('unknown effect families are rejected', data => { data.families.custom = data.families.orb; });
rejects('raw renderer markup is rejected', data => { data.families.orb.svg = '<path/>'; });
rejects('mismatched shape names are rejected', data => { data.families.orb.shape = 'beam'; });
rejects('unknown travel path is rejected', data => { data.families.orb.path = 'custom'; });
rejects('oversized shape is rejected', data => { data.families.orb.size = 200; });
rejects('zero travel speed is rejected', data => { data.families.orb.speedPxPerMs = 0; });
rejects('non-finite travel speed is rejected', data => { data.families.orb.speedPxPerMs = Infinity; });
rejects('negative travel duration is rejected', data => { data.families.orb.minMs = -1; });
rejects('inverted travel duration range is rejected', data => { data.families.orb.maxMs = data.families.orb.minMs - 1; });
rejects('fractional travel duration is rejected', data => { data.families.orb.maxMs = 499.5; });
rejects('excessive travel duration is rejected', data => { data.families.orb.maxMs = 5000; });
rejects('unbounded afterimages are rejected', data => { data.families.orb.afterimages = 100; });
rejects('fractional afterimage count is rejected', data => { data.families.orb.afterimages = 1.5; });
rejects('missing pathway default is rejected', data => { delete data.pathwayDefaults.fool; });
rejects('unlisted pathway defaults are rejected', data => { data.pathwayDefaults.unknown = 'orb'; });
rejects('unlisted default family is rejected', data => { data.pathwayDefaults.fool = 'custom'; });
rejects('unlisted pathway overrides are rejected', data => { data.pathwayDamageOverrides.unknown = { fire: 'bolt' }; });
rejects('uncolored damage overrides are rejected', data => { data.pathwayDamageOverrides.fool.custom = 'bolt'; });
rejects('unlisted damage override family is rejected', data => { data.pathwayDamageOverrides.fool.physical = 'custom'; });
rejects('array override records are rejected', data => { data.pathwayDamageOverrides.fool = []; });
rejects('unlisted basic family is rejected', data => { data.basicAttack.gun = 'custom'; });
rejects('unlisted basic pathway is rejected', data => { data.basicAttack.pathways.unknown = 'orb'; });
rejects('unlisted basic pathway family is rejected', data => { data.basicAttack.pathways.fool = 'custom'; });
rejects('invalid impact frame count is rejected', data => { data.impact.frames = 20; });
rejects('unbounded critical scale is rejected', data => { data.impact.critScale = 50; });
rejects('obsolete critical hit-stop settings are rejected even when zero', data => { data.impact.critHitStopMs = 0; });
rejects('missing critical colors are rejected', data => { delete data.impact.critColor; });
rejects('critical CSS color fragments are rejected', data => { data.impact.critColor = 'orange;background:url(test)'; });
rejects('critical CSS function colors are rejected', data => { data.impact.critColor = 'var(--color)'; });
rejects('short critical hex colors are rejected', data => { data.impact.critColor = '#fa6'; });
rejects('missing critical number scale is rejected', data => { delete data.impact.critNumberScale; });
rejects('critical numbers cannot shrink below normal size', data => { data.impact.critNumberScale = .5; });
rejects('unbounded critical number sizes are rejected', data => { data.impact.critNumberScale = 3; });
rejects('non-finite critical number sizes are rejected', data => { data.impact.critNumberScale = Infinity; });
rejects('string critical number sizes are rejected', data => { data.impact.critNumberScale = '1.25'; });
rejects('string durations are rejected', data => { data.support.durationMs = '500'; });
rejects('unbounded ability chips are rejected', data => { data.abilityChipMs = 10000; });
test('Node bootstrap accepts the same authored FX without a browser global', () => {
  const game = require('../js/node-loader.js');
  assert.equal(game.PATH_KEYS.length, 22);
});
console.log(`Battle FX data regressions: ${passed} passed.`);
