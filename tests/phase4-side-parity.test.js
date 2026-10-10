'use strict';
const assert=require('node:assert/strict');
const g=require('../js/node-loader.js');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+error.message);}}
function profile(id){
 const agent=g.makeAgent(()=>.5,{path:'fool',sequence:9,trait:'Stout Vitality'});
 Object.assign(agent,{id,name:'Duplicate',path:'fool',sequence:9,awakened:true,injuries:0,madness:0,
  weaponId:'none',weaponMastery:{},cooldowns:{},stats:{hp:10,atk:100000,def:1,int:1},
  baseStats:{hp:10,atk:100000,def:1,int:1},statVariance:{hp:1,atk:1,def:1,int:1,speed:1},speedVariance:1});
 agent.sp=g.maxSPFor(agent);return agent;
}
function battle(allyId,enemyId){
 const ally=profile(allyId),enemy=profile(enemyId);
 const quest={name:'Equal initiative duel',encounter:true,difficultySequence:9,enemyCount:1,rewards:{},brief:'',dayCost:1};
 return g.resolveQuest([ally],quest,42,{individual:true,authoredOpponents:[{
  id:enemy.id,name:enemy.name,path:enemy.path,sequence:enemy.sequence,trait:enemy.trait,
  stats:{...enemy.stats},sp:enemy.sp,weaponId:'none'
 }]});
}
test('authored opponents preserve canonical combat IDs when display names match',()=>{
 const result=battle('Alpha','Beta');
 assert.deepEqual(result.battleSnapshot.initialUnits.map(unit=>unit.id),['Alpha','Beta']);
 assert.equal(result.battleSnapshot.enemies[0].id,'Beta');
});
test('equal-name and equal-initiative lethal duels preserve their winner when teams swap',()=>{
 const first=battle('Alpha','Beta'),swapped=battle('Beta','Alpha');
 for(const result of [first,swapped]){
  const initiative=result.events.find(event=>event.subtype==='initiative').details.match(/[0-9]+\.[0-9]+/g);
  assert.equal(initiative.length,2);assert.equal(initiative[0],initiative[1]);
  const living=[...result.battleSnapshot.allies,...result.battleSnapshot.enemies].filter(unit=>unit.alive);
  assert.equal(living.length,1);assert.equal(living[0].id,'Alpha');
  assert.deepEqual(result.battleSnapshot.initialUnits.map(unit=>unit.name),['Duplicate','Duplicate']);
 }
 assert.equal(first.success,true);assert.equal(swapped.success,false);
});
console.log(`Side parity regressions: ${passed} passed, ${failed} failed`);if(failed)process.exitCode=1;
