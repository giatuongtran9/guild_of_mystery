'use strict';
const assert=require('node:assert/strict'),g=require('../js/node-loader');
const copy=x=>JSON.parse(JSON.stringify(x));

// Retired metadata must never change newly calculated stats in any Pathway.
for(const path of g.PATH_KEYS){
 const agent=g.makeAgent(()=>.5,{sequence:9,path,traitId:'hardy'});
 agent.statVariance={hp:.94,atk:1.08,def:1.02,int:.97,speed:1.06};
 const ordinary=g.statsFromVariance(agent,path,9);
 agent.recommendedPath=path;
 assert.deepEqual(g.statsFromVariance(agent,path,9),ordinary,`${path}: no recommendation bonus`);
}
const recruit=g.makeAgent(()=>.5,{sequence:10,recommendedPath:'door',catalog:true});
assert.equal(recruit.path,null);assert(!('recommendedPath' in recruit));
assert(!/Recommended/i.test(recruit.history[0].text));
assert.deepEqual(recruit.abilities,[]);
for(const value of Object.values(recruit.statVariance))assert(value>=.9&&value<=1.1);

// Existing stats may include old bonuses and earned gains. Keep them exactly.
const save=g.newGame();save.schema=11;
const awakened=g.makeAgent(()=>.5,{sequence:7,path:'door',traitId:'glass_cannon'});
g.restatAgent(awakened);
awakened.recommendedPath='door';awakened.stats.int+=27;awakened.baseStats.int+=11;
awakened.digest=63;awakened.injuries=14;
awakened.history=[{day:1,text:'Joined the recruitment office as an ordinary clerk. Recommended Pathway: Door.'}];
recruit.recommendedPath='fool';recruit.path='fool';
save.roster=[awakened,copy(recruit)];save.recruitPool=[copy(recruit)];
const migrated=g.migrateSave(copy(save));
assert.equal(migrated.schema,g.SAVE_VERSION);
for(const field of ['stats','baseStats','statVariance','speedVariance','digest','injuries'])assert.deepEqual(migrated.roster[0][field],awakened[field],field);
assert.equal(migrated.roster[0].path,'door');
assert.equal(migrated.roster[0].history[0].text,'Joined the recruitment office as an ordinary clerk.');
for(const agent of [...migrated.roster,...migrated.recruitPool])assert(!('recommendedPath' in agent));
assert.equal(migrated.roster[1].path,null);assert.equal(migrated.recruitPool[0].path,null);
assert.deepEqual(g.migrateSave(copy(migrated)),migrated,'migration remains stable on subsequent loads');
console.log('Recruitment choice checks passed: all 22 pathways have no bonus, ordinary recruits have no pathway recommendation, saved stats and variance survive migration.');
