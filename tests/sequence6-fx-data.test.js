'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateBattleFx } = require('../js/data-loader.js');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const fx = read('fx.json'), pathways = read('pathways/index.json').order;
const ids = {
  magma_arrow: 'abyss', distort_impact: 'black_emperor', spiteful_strike: 'chained', dream_slumber: 'darkness',
  spirit_body_door: 'death', affliction_thread: 'demoness', combat_record: 'door', rust_siphon: 'error',
  combat_stance_mimicry: 'fool', depravity_mark: 'hanged_man', knowledge_arrow: 'hermit', interdiction_zone: 'justiciar',
  moonlight_shield: 'moon', life_seed: 'mother', alchemical_fire: 'paragon', reaper_s_harvest: 'red_priest',
  notarize: 'sun', light_of_dawn: 'twilight_giant', lightning_bolt: 'tyrant', battle_hypnosis: 'visionary',
  misfortune_aura: 'wheel_of_fortune', spell_imitation: 'white_tower'
};
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function rejects(name, mutate) { test(name, () => { const copy=JSON.parse(JSON.stringify(fx)); mutate(copy); assert.throws(() => validateBattleFx(copy,pathways), /data\/fx\.json:/); }); }

test('covers exactly the 22 active Sequence 6 abilities and pathway assignments', () => {
  assert.deepEqual(Object.keys(fx.sequence6Abilities).sort(), Object.keys(ids).sort());
  for (const [id,pathway] of Object.entries(ids)) assert.equal(fx.sequence6Abilities[id].pathway,pathway);
  for (const pathway of pathways) {
    const ability=read(`pathways/${pathway}.json`).sequences.find(tier=>tier.sequence===6).ability;
    assert.equal(ability.kind,'active'); assert.equal(Object.hasOwn(fx.sequence6Abilities,ability.id),true);
  }
});
test('each ability has distinct real transparent 256px PNG art and pathway palette', () => {
  const assets=new Set();
  for (const [id,spec] of Object.entries(fx.sequence6Abilities)) {
    assert.match(spec.color,/^#[0-9a-f]{6}$/i,id); assert(['travel','strike','support','caster'].includes(spec.mode),id);
    const rel=spec.asset.split('?')[0], bytes=fs.readFileSync(path.join(root,rel));
    assert.match(spec.asset,/^data\/assets\/effects\/sequence6\/sequence6-[a-z0-9-]+\.png\?v=[a-f0-9]{16}$/);
    assert(!assets.has(rel),id+' duplicate asset'); assets.add(rel);
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16),256); assert.equal(bytes.readUInt32BE(20),256);
    assert(bytes.includes(Buffer.from([0,0,0,0])),id+' has transparent pixels');
  }
  assert.equal(assets.size,22);
});
test('the three revised concepts use the final retained transparent PNGs',()=>{
  for(const id of ['magma_arrow','combat_record','spell_imitation']){
    const bytes=fs.readFileSync(path.join(root,fx.sequence6Abilities[id].asset.split('?')[0]));
    assert.equal(bytes.readUInt32BE(16),256);assert.equal(bytes.readUInt32BE(20),256);assert(bytes.includes(Buffer.from([0,0,0,0])));
  }
});
test('all metadata validates without mutating authored config',()=>{const before=JSON.stringify(fx);assert.equal(validateBattleFx(fx,pathways),fx);assert.equal(JSON.stringify(fx),before);});
rejects('missing or extra entries are rejected',d=>{delete d.sequence6Abilities.magma_arrow;});
rejects('unknown entry is rejected',d=>{d.sequence6Abilities.unlisted={...d.sequence6Abilities.magma_arrow};});
rejects('wrong pathway is rejected',d=>{d.sequence6Abilities.magma_arrow.pathway='door';});
rejects('unversioned or external asset path is rejected',d=>{d.sequence6Abilities.magma_arrow.asset='https://example.com/a.png';});
rejects('wrong per-ability asset path is rejected',d=>{d.sequence6Abilities.magma_arrow.asset=d.sequence6Abilities.lightning_bolt.asset;});
rejects('unknown presentation mode is rejected',d=>{d.sequence6Abilities.magma_arrow.mode='area';});
rejects('unsafe metadata keys are rejected',d=>{d.sequence6Abilities.constructor={...d.sequence6Abilities.magma_arrow};});
console.log(`Sequence 6 FX data regressions: ${passed} passed.`);
