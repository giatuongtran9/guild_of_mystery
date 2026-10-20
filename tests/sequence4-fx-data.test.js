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
  desire_ignition_burst: 'abyss', magnify_disorder: 'black_emperor', spiteful_shackles: 'chained',
  horror_domain: 'darkness', undying_rebirth_aura: 'death', unaging_mirror_clone: 'demoness',
  door_of_concealment: 'door', parasitic_contagion: 'error', bizarro_transformation: 'fool',
  shadow_sword_execution: 'hanged_man', fairy_tale_spell: 'hermit', imperator_s_decree: 'justiciar',
  scarlet_blood_domain: 'moon', nature_s_growth_surge: 'mother', alchemical_overclock: 'paragon',
  iron_blood_steel_body: 'red_priest', unshadowed_execution: 'sun', dawn_guardian_barrier: 'twilight_giant',
  interdiction_roar: 'tyrant', psychological_invisibility: 'visionary', misfortune_inversion: 'wheel_of_fortune',
  prophetic_intervention: 'white_tower'
};
const secondary = {
  bizarro_transformation: 'fool_bizarro_shimmer', undying_rebirth_aura: 'death_undying_ward',
  nature_s_growth_surge: 'mother_growth_bloom', scarlet_blood_domain: 'moon_sp_siphon',
  shadow_sword_execution: 'hanged_man_recovery_motes'
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

test('covers exactly the twenty-two newly unlocked Sequence 4 active abilities', () => {
  assert.deepEqual(Object.keys(fx.sequence4Abilities).sort(), Object.keys(ids).sort());
  for (const [id, pathway] of Object.entries(ids)) assert.equal(fx.sequence4Abilities[id].pathway, pathway);
  const active = [];
  for (const pathway of pathways) {
    const ability = read(`pathways/${pathway}.json`).sequences.find(tier => tier.sequence === 4).ability;
    assert.equal(ability.kind, 'active', pathway + ' is active'); active.push(ability.id);
  }
  assert.deepEqual(active.sort(), Object.keys(ids).sort());
});
test('all twenty-seven distinct versioned assets are visible transparent 256px RGBA PNGs', () => {
  const assets = new Set();
  for (const [id, spec] of Object.entries(fx.sequence4Abilities)) {
    assert.match(spec.color, /^#[0-9a-f]{6}$/i, id);
    assert(['travel', 'strike', 'support', 'caster'].includes(spec.mode), id);
    assert.equal(Object.hasOwn(spec, 'secondaryAsset'), Object.hasOwn(secondary, id), id + ' secondary layer');
    for (const [key, assetId] of [['asset', id], ...(secondary[id] ? [['secondaryAsset', secondary[id]]] : [])]) {
      const expected = `data/assets/effects/sequence4/${assetId.replace(/_/g, '-')}.png`;
      const [relative, version] = spec[key].split('?v='); assert.equal(relative, expected);
      assert.match(version, /^[a-f0-9]{16}$/); assert(!assets.has(relative), 'duplicate asset ' + id); assets.add(relative);
      const bytes = fs.readFileSync(path.join(root, relative));
      assert.equal(version, crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16), id + ' content version');
      const pixels = rgbaPixels(bytes); let transparent = false, visible = false;
      for (let p = 3; p < pixels.length; p += 4) { transparent ||= pixels[p] === 0; visible ||= pixels[p] > 0; }
      assert(transparent && visible, id + ' needs real transparent and painted pixels');
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
        if (x < 8 || x >= 248 || y < 8 || y >= 248) assert.equal(pixels[(y * 256 + x) * 4 + 3], 0, id + ' has a transparent margin');
      }
    }
  }
  assert.equal(assets.size, 27);
});
test('all metadata validates without mutating the authored configuration', () => {
  const before = JSON.stringify(fx); assert.equal(validateBattleFx(fx, pathways), fx); assert.equal(JSON.stringify(fx), before);
});
rejects('missing Sequence 4 abilities are rejected', d => { delete d.sequence4Abilities.unshadowed_execution; });
rejects('missing Sequence 4 metadata is rejected', d => { delete d.sequence4Abilities; });
rejects('unlisted abilities are rejected', d => { d.sequence4Abilities.unlisted = { ...d.sequence4Abilities.unshadowed_execution }; });
rejects('wrong pathway assignments are rejected', d => { d.sequence4Abilities.unshadowed_execution.pathway = 'door'; });
rejects('external assets are rejected', d => { d.sequence4Abilities.unshadowed_execution.asset = 'https://example.com/bolt.png'; });
rejects('unversioned assets are rejected', d => { d.sequence4Abilities.unshadowed_execution.asset = 'data/assets/effects/sequence4/unshadowed-execution.png'; });
rejects('path traversal is rejected', d => { d.sequence4Abilities.unshadowed_execution.asset = 'data/assets/effects/sequence4/../sequence5/holy-sun-bolt.png?v=0123456789abcdef'; });
rejects('another ability asset cannot be substituted', d => { d.sequence4Abilities.unshadowed_execution.asset = d.sequence4Abilities.imperator_s_decree.asset; });
rejects('wrong secondary art is rejected', d => { d.sequence4Abilities.bizarro_transformation.secondaryAsset = d.sequence4Abilities.undying_rebirth_aura.secondaryAsset; });
rejects('required secondary layers cannot be omitted', d => { delete d.sequence4Abilities.scarlet_blood_domain.secondaryAsset; });
rejects('secondary layers cannot be added to unrelated abilities', d => { d.sequence4Abilities.unshadowed_execution.secondaryAsset = d.sequence4Abilities.bizarro_transformation.secondaryAsset; });
rejects('unknown presentation modes are rejected', d => { d.sequence4Abilities.unshadowed_execution.mode = 'area'; });
rejects('unsafe metadata keys are rejected', d => { d.sequence4Abilities.constructor = { ...d.sequence4Abilities.unshadowed_execution }; });
rejects('unknown effect properties are rejected', d => { d.sequence4Abilities.unshadowed_execution.onCast = 'alert(1)'; });
console.log(`Sequence 4 FX data regressions: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
