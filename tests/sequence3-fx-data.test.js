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
  "devil_mutation": "abyss",
  "chaos_field": "black_emperor",
  "zombie_legion": "chained",
  "concealment_realm": "darkness",
  "underworld_domain": "death",
  "despair_thread": "demoness",
  "spatial_concealment": "door",
  "deceive_impact": "error",
  "historical_summoning": "fool",
  "flesh_creation": "hanged_man",
  "mystic_domain": "hermit",
  "strict_prohibition": "justiciar",
  "lunar_blessing": "moon",
  "flesh_mutation": "mother",
  "energy_cannon": "paragon",
  "war_command": "red_priest",
  "exorcism_charter": "sun",
  "thunder_god_stance": "tyrant",
  "dream_prison": "visionary",
  "chaos_probability": "wheel_of_fortune"
};
const modes = {
  "devil_mutation": "caster",
  "chaos_field": "support",
  "zombie_legion": "caster",
  "concealment_realm": "strike",
  "underworld_domain": "support",
  "despair_thread": "travel",
  "spatial_concealment": "caster",
  "deceive_impact": "caster",
  "historical_summoning": "caster",
  "flesh_creation": "caster",
  "mystic_domain": "caster",
  "strict_prohibition": "support",
  "lunar_blessing": "caster",
  "flesh_mutation": "caster",
  "energy_cannon": "travel",
  "war_command": "caster",
  "exorcism_charter": "travel",
  "thunder_god_stance": "caster",
  "dream_prison": "strike",
  "chaos_probability": "support"
};
const secondary = { concealment_realm: 'darkness-concealment-veil' };
const approvedHashes = {
  "devil_mutation": "639430f2400414fa67bd8ef7005e1754fdddf5df007bea702efe5e68098e8496",
  "chaos_field": "a71b0dffad1961d9523873c5c25c8530a9aea7e66ceba4452414982e4a2d9d9d",
  "zombie_legion": "6e46610d6f6f2742c67222c8fca2999ec89960af379485a3fc93ee75bc5c5220",
  "concealment_realm": "295edeeda57328d715ad6bb2fda0d0bcbcdfac2209089a3f6d7198b5c09344ef",
  "underworld_domain": "6be5b1885513e61d94270fbc5d7a531eafd96b804f27d4aa90dfe2579a1cbf96",
  "despair_thread": "eba16ffaa2319a8dddb90d10b7bee86a5f37d647d5cb501b2fcbe634eb6307f1",
  "spatial_concealment": "74db15626344b5026d308544cc5c8760efd20d4ba0a1da9ef093a1cceaa2b9a7",
  "deceive_impact": "ac4e3ef38f3fed54de057ecbe3fc0fdc69a426f8584955fbd239184299bbf5b2",
  "historical_summoning": "b2a453543d77ff1952833f514666f9abd589668a4a76a7b6675a2d3d4bfaaa6b",
  "flesh_creation": "5981b5d9d845d911fd141d608c93d775a161dde27e6b7db9b81acb1e3b54f340",
  "mystic_domain": "24ac63d719e3a4723796d0a1fba802c860862d2bc07fed57d1884a8ab22597f5",
  "strict_prohibition": "9f74b6d4f4225225a01d3f9fec8dcbe155d5ab9a5a737632d3eac4784aee6461",
  "lunar_blessing": "b137c028ca1404b7cdf83c1ff46f049f2bb8f6472a42dfa31544b1f86988265a",
  "flesh_mutation": "e97232b895fac101a6c7a4689f04ba23e64202aa0cdb2e40a6838861246bc8df",
  "energy_cannon": "f4dc428d591a5db8667224d20a324fd2ebef9965cf5083958369a875eaa80e9f",
  "war_command": "72bd885063d57a9fc76fb5bc949dbf9567ec77fcd55b68142ce4665a2334202b",
  "exorcism_charter": "b1440a520ac046042b47cd494c636868a4c23d63157b95851897130ab5c88b37",
  "thunder_god_stance": "cf992d0e72e1e44697950360a13055631f2e675888f553ae725903beb4c851c4",
  "dream_prison": "15689d192852bb59a39aa1eb6b4095a1010183157f017fe874ce5486a18419a9",
  "chaos_probability": "1a04704519a617e7b34e76c11795b32b84647ff1349e0ed776574e643c7d01a1",
  "darkness_concealment_veil": "bff74c8b46d1bbd03060a648e19220054d9ff642d36f5c89e8f0883b38ed13c9"
};
const motion = { anticipationMs: 280, activationMs: 180, sustainMs: 500, dissipateMs: 290, stationaryWidth: 120, travelWidth: 108 };
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

test('covers exactly the twenty newly unlocked Sequence 3 active abilities', () => {
  assert.deepEqual(Object.keys(fx.sequence3Abilities).sort(), Object.keys(ids).sort());
  const active = [], passive = [];
  for (const pathway of pathways) {
    const ability = read(`pathways/${pathway}.json`).sequences.find(tier => tier.sequence === 3).ability;
    (ability.kind === 'active' ? active : passive).push(ability.id);
  }
  assert.deepEqual(active.sort(), Object.keys(ids).sort());
  assert.deepEqual(passive.sort(), ['giant_s_might', 'omniscient_eye']);
  for (const [id, pathway] of Object.entries(ids)) {
    assert.equal(fx.sequence3Abilities[id].pathway, pathway);
    assert.equal(fx.sequence3Abilities[id].mode, modes[id]);
  }
});
test('all twenty-one distinct versioned assets match approved transparent 256px exports', () => {
  const assets = new Set();
  for (const [id, spec] of Object.entries(fx.sequence3Abilities)) {
    assert.match(spec.color, /^#[0-9a-f]{6}$/i, id);
    assert.equal(Object.hasOwn(spec, 'secondaryAsset'), Object.hasOwn(secondary, id), id + ' secondary layer');
    for (const [key, assetId] of [['asset', id], ...(secondary[id] ? [['secondaryAsset', 'darkness_concealment_veil']] : [])]) {
      const expected = `data/assets/effects/sequence3/${assetId.replace(/_/g, '-')}.png`;
      const [relative, version] = spec[key].split('?v='); assert.equal(relative, expected);
      assert.match(version, /^[a-f0-9]{16}$/); assert(!assets.has(relative), 'duplicate asset ' + id); assets.add(relative);
      const bytes = fs.readFileSync(path.join(root, relative)), hash = crypto.createHash('sha256').update(bytes).digest('hex');
      assert.equal(version, hash.slice(0, 16), id + ' content version');
      assert.equal(hash, approvedHashes[assetId], id + ' matches the selected Exalted export');
      const pixels = rgbaPixels(bytes); let transparent = false, visible = false;
      for (let p = 3; p < pixels.length; p += 4) { transparent ||= pixels[p] === 0; visible ||= pixels[p] > 0; }
      assert(transparent && visible, id + ' needs real transparent and painted pixels');
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
        if (x < 8 || x >= 248 || y < 8 || y >= 248) assert.equal(pixels[(y * 256 + x) * 4 + 3], 0, id + ' has a transparent margin');
      }
    }
  }
  assert.equal(assets.size, 21);
});
test('the approved four-phase profile and larger frames stay exact', () => {
  assert.deepEqual(fx.sequence3Motion, motion);
  assert.equal(['anticipationMs', 'activationMs', 'sustainMs', 'dissipateMs'].reduce((sum, key) => sum + fx.sequence3Motion[key], 0), 1250);
});
test('all metadata validates without mutating authored data', () => {
  const before = JSON.stringify(fx); assert.equal(validateBattleFx(fx, pathways), fx); assert.equal(JSON.stringify(fx), before);
});
rejects('missing Sequence 3 abilities are rejected', d => { delete d.sequence3Abilities.historical_summoning; });
rejects('missing Sequence 3 metadata is rejected', d => { delete d.sequence3Abilities; });
rejects('unlisted abilities are rejected', d => { d.sequence3Abilities.unlisted = { ...d.sequence3Abilities.historical_summoning }; });
rejects('passive abilities cannot receive active metadata', d => { delete d.sequence3Abilities.historical_summoning; d.sequence3Abilities.omniscient_eye = { ...fx.sequence3Abilities.historical_summoning }; });
rejects('wrong pathway assignments are rejected', d => { d.sequence3Abilities.historical_summoning.pathway = 'door'; });
rejects('external assets are rejected', d => { d.sequence3Abilities.exorcism_charter.asset = 'https://example.com/bolt.png'; });
rejects('unversioned assets are rejected', d => { d.sequence3Abilities.exorcism_charter.asset = 'data/assets/effects/sequence3/exorcism-charter.png'; });
rejects('path traversal is rejected', d => { d.sequence3Abilities.exorcism_charter.asset = 'data/assets/effects/sequence3/../sequence4/unshadowed-execution.png?v=0123456789abcdef'; });
rejects('another ability asset cannot be substituted', d => { d.sequence3Abilities.exorcism_charter.asset = d.sequence3Abilities.energy_cannon.asset; });
rejects('wrong secondary art is rejected', d => { d.sequence3Abilities.concealment_realm.secondaryAsset = d.sequence3Abilities.devil_mutation.asset; });
rejects('the Darkness secondary layer cannot be omitted', d => { delete d.sequence3Abilities.concealment_realm.secondaryAsset; });
rejects('secondary layers cannot be added to unrelated abilities', d => { d.sequence3Abilities.exorcism_charter.secondaryAsset = d.sequence3Abilities.concealment_realm.secondaryAsset; });
rejects('unknown presentation modes are rejected', d => { d.sequence3Abilities.exorcism_charter.mode = 'area'; });
rejects('caster wards cannot become projectiles', d => { d.sequence3Abilities.deceive_impact.mode = 'travel'; });
rejects('unsafe metadata keys are rejected', d => { d.sequence3Abilities.constructor = { ...d.sequence3Abilities.exorcism_charter }; });
rejects('unknown effect properties are rejected', d => { d.sequence3Abilities.exorcism_charter.onCast = 'alert(1)'; });
rejects('missing motion profile is rejected', d => { delete d.sequence3Motion; });
rejects('missing motion phases are rejected', d => { delete d.sequence3Motion.sustainMs; });
rejects('unreviewed motion fields are rejected', d => { d.sequence3Motion.onComplete = 'alert(1)'; });
rejects('negative phase times are rejected', d => { d.sequence3Motion.anticipationMs = -1; });
rejects('nonfinite phase times are rejected', d => { d.sequence3Motion.anticipationMs = Infinity; });
rejects('string phase times are rejected', d => { d.sequence3Motion.anticipationMs = '280'; });
rejects('changed approved timing is rejected', d => { d.sequence3Motion.activationMs = 800; });
rejects('changed approved frame sizes are rejected', d => { d.sequence3Motion.stationaryWidth = 800; });
console.log(`Sequence 3 FX data regressions: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
