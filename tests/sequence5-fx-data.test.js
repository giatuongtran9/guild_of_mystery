'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { validateBattleFx } = require('../js/data-loader.js');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const fx = read('fx.json'), pathways = read('pathways/index.json').order;
const ids = {
  corrupted_flesh: 'abyss', order_distortion: 'black_emperor', desire_control: 'chained',
  soul_pacification: 'darkness', zombie_transformation: 'death', mirror_substitution: 'demoness',
  blink_strike: 'door', logic_distortion: 'error', thread_binding: 'fool', soul_drain: 'hanged_man',
  constellation_constrain: 'hermit', law_enforcement: 'justiciar', vampire_transformation: 'moon',
  life_bloom: 'mother', matter_fortification: 'paragon', holy_sun_bolt: 'sun',
  guardian_stance: 'twilight_giant', ocean_calling: 'tyrant', dream_tether: 'visionary', prophetic_evade: 'white_tower'
};
const secondary = {
  corrupted_flesh: 'abyss_desire_mark', zombie_transformation: 'death_bone_guard',
  blink_strike: 'door_blink_portal', dream_tether: 'visionary_insight_halo'
};
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.stack); } }
function rejects(name, mutate) { test(name, () => { const copy = structuredClone(fx); mutate(copy); assert.throws(() => validateBattleFx(copy, pathways), /data\/fx\.json:/); }); }

// Decode PNG filters rather than mistaking zero bytes in a compressed chunk for transparency.
function rgbaPixels(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), 256); assert.equal(bytes.readUInt32BE(20), 256);
  assert.equal(bytes[24], 8); assert.equal(bytes[25], 6); assert.equal(bytes[28], 0);
  const compressed = [];
  for (let p = 8; p < bytes.length;) {
    const size = bytes.readUInt32BE(p), kind = bytes.toString('ascii', p + 4, p + 8);
    if (kind === 'IDAT') compressed.push(bytes.subarray(p + 8, p + 8 + size));
    p += size + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(compressed)), stride = 256 * 4, pixels = Buffer.alloc(stride * 256);
  assert.equal(raw.length, (stride + 1) * 256);
  const paeth = (a, b, c) => { const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
  for (let y = 0; y < 256; y++) {
    const filter = raw[y * (stride + 1)]; assert(filter <= 4, 'valid PNG row filter');
    for (let x = 0; x < stride; x++) {
      const p = y * stride + x, left = x >= 4 ? pixels[p - 4] : 0, up = y ? pixels[p - stride] : 0, diagonal = y && x >= 4 ? pixels[p - stride - 4] : 0;
      const delta = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, diagonal)][filter];
      pixels[p] = (raw[y * (stride + 1) + x + 1] + delta) & 255;
    }
  }
  return pixels;
}

test('covers exactly the twenty newly unlocked Sequence 5 active abilities', () => {
  assert.deepEqual(Object.keys(fx.sequence5Abilities).sort(), Object.keys(ids).sort());
  for (const [id, pathway] of Object.entries(ids)) assert.equal(fx.sequence5Abilities[id].pathway, pathway);
  const active = [];
  for (const pathway of pathways) {
    const ability = read(`pathways/${pathway}.json`).sequences.find(tier => tier.sequence === 5).ability;
    if (ability.kind === 'active') active.push(ability.id);
    else assert.equal(Object.hasOwn(fx.sequence5Abilities, ability.id), false, pathway + ' passive excluded');
  }
  assert.deepEqual(active.sort(), Object.keys(ids).sort());
  assert.equal(Object.hasOwn(fx.sequence5Abilities, 'iron_blood_vigor'), false);
  assert.equal(Object.hasOwn(fx.sequence5Abilities, 'reset_fate'), false);
});
test('all twenty-four distinct versioned assets are visible transparent 256px RGBA PNGs', () => {
  const assets = new Set();
  for (const [id, spec] of Object.entries(fx.sequence5Abilities)) {
    assert.match(spec.color, /^#[0-9a-f]{6}$/i, id);
    assert(['travel', 'strike', 'support', 'caster'].includes(spec.mode), id);
    assert.equal(Object.hasOwn(spec, 'secondaryAsset'), Object.hasOwn(secondary, id), id + ' secondary layer');
    for (const [key, assetId] of [['asset', id], ...(secondary[id] ? [['secondaryAsset', secondary[id]]] : [])]) {
      const expected = `data/assets/effects/sequence5/${assetId.replace(/_/g, '-')}.png`;
      const [relative, version] = spec[key].split('?v='); assert.equal(relative, expected);
      assert.match(version, /^[a-f0-9]{16}$/); assert(!assets.has(relative), 'duplicate asset ' + id); assets.add(relative);
      const bytes = fs.readFileSync(path.join(root, relative));
      assert.equal(version, crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16), id + ' content version');
      const pixels = rgbaPixels(bytes); let transparent = false, visible = false;
      for (let p = 3; p < pixels.length; p += 4) { transparent ||= pixels[p] === 0; visible ||= pixels[p] > 0; }
      assert(transparent && visible, id + ' needs real transparent and painted pixels');
    }
  }
  assert.equal(assets.size, 24);
});
test('all metadata validates without mutating the authored configuration', () => {
  const before = JSON.stringify(fx); assert.equal(validateBattleFx(fx, pathways), fx); assert.equal(JSON.stringify(fx), before);
});
rejects('missing Sequence 5 abilities are rejected', d => { delete d.sequence5Abilities.holy_sun_bolt; });
rejects('unlisted abilities are rejected', d => { d.sequence5Abilities.unlisted = { ...d.sequence5Abilities.holy_sun_bolt }; });
rejects('wrong pathway assignments are rejected', d => { d.sequence5Abilities.holy_sun_bolt.pathway = 'door'; });
rejects('external or unversioned assets are rejected', d => { d.sequence5Abilities.holy_sun_bolt.asset = 'https://example.com/bolt.png'; });
rejects('another ability asset cannot be substituted', d => { d.sequence5Abilities.holy_sun_bolt.asset = d.sequence5Abilities.ocean_calling.asset; });
rejects('wrong secondary art is rejected', d => { d.sequence5Abilities.blink_strike.secondaryAsset = d.sequence5Abilities.dream_tether.secondaryAsset; });
rejects('secondary layers cannot be added to unrelated abilities', d => { d.sequence5Abilities.holy_sun_bolt.secondaryAsset = d.sequence5Abilities.blink_strike.secondaryAsset; });
rejects('unknown presentation modes are rejected', d => { d.sequence5Abilities.holy_sun_bolt.mode = 'area'; });
rejects('unsafe metadata keys are rejected', d => { d.sequence5Abilities.constructor = { ...d.sequence5Abilities.holy_sun_bolt }; });
console.log(`Sequence 5 FX data regressions: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
