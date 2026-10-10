'use strict';
const assert=require('node:assert/strict'),g=require('../js/node-loader');
const a=g.makeAgent(()=>.4,{path:'demoness',sequence:6});
Object.assign(a,{path:'demoness',sequence:6,awakened:true,corruption:63,recorded:['legacy record'],_signatureSoul:{spec:{id:'old'}},_mythicalAuthority:{used:false}});
delete a.affliction;
const before=g.newGame();before.schema=9;before.roster=[a];
const loaded=g.migrateSave(before),saved=loaded.roster[0];
assert.equal(saved.affliction,63,'legacy Demoness charge migrates without deleting harmful corruption');
assert.equal(saved.corruption,63);
assert.deepEqual(saved.recorded,['legacy record']);
assert.equal(saved._signatureSoul,undefined);
assert.equal(saved._mythicalAuthority,undefined);
assert.equal(saved.abilityHistory.find(x=>x.sequence===6)?.effectId,g.tierFor('demoness',6).abilities[0].effectId);
saved.affliction=12;
assert.equal(g.migrateSave(loaded).roster[0].affliction,12,'migration does not refill charge on subsequent loads');
for(const [path,sequence,oldId] of [['moon',8,'vampiric_claws'],['white_tower',8,'spell_imitation']]){
 const unit=g.makeAgent(()=>.4,{path,sequence});
 Object.assign(unit,{path,sequence,awakened:true,digest:73,injuries:12,weaponId:'knife',recorded:['legacy record']});
 unit.abilityHistory=g.pathOf(path).sequences.filter(t=>t.sequence>=sequence).map(t=>({sequence:t.sequence,effectId:t.sequence===sequence?oldId:t.abilities[0].effectId}));
 unit.abilities=unit.abilityHistory.slice();
 const stats={...unit.stats},save=g.newGame();save.schema=9;save.roster=[unit];
 const migrated=g.migrateSave(save).roster[0];
 assert.equal(migrated.abilityHistory.find(t=>t.sequence===sequence).effectId,g.tierFor(path,sequence).abilities[0].effectId,'same-length cached abilities update to the current rules');
 assert.deepEqual(migrated.stats,stats);assert.equal(migrated.digest,73);assert.equal(migrated.injuries,12);
 assert.equal(migrated.weaponId,'knife');assert.deepEqual(migrated.recorded,['legacy record']);
}
console.log('Phase 4 save migration: passed');
