'use strict';
const assert=require('node:assert/strict'),g=require('../js/node-loader');
const make=i=>{const a=g.makeAgent(()=>.5,{path:'fool',sequence:9,trait:'Stout Vitality'});a.id='weak_'+i;a.stats={hp:1,atk:1,def:1,int:1};a.sp=0;a.weaponId='sword';return a;};
const party=[make(0),make(1),make(2)],quest=g.makeWantedQuest(999,()=>.5,party,'red_knife');let retreats=0,failed=0,savedRetreat;
for(let seed=1;seed<=600;seed++){
 const result=g.resolveQuest(party,quest,seed);assert(!result.success);assert(result.retreat.attempted);failed++;
 if(result.retreat.success){retreats++;savedRetreat=result;assert.equal(result.retreat.agentIds.length,3);assert.equal(result.consequences.filter(c=>c.type==='death').length,0);for(const c of result.consequences.filter(c=>c.type==='syncAgent'))assert.equal(c.agent.injuries,99);}
 else assert.equal(result.consequences.filter(c=>c.type==='death').length,3);
 assert.deepEqual(result.rewards.materials,{});assert.equal(result.rewards.reputation,0);assert.equal(result.rewards.funds,0);
}
assert(Math.abs(retreats/failed-.3)<.04,`retreat rate ${retreats/failed}`);
const state=g.newGame();state.roster=party;state.weapons.sword=0;state.pendingContract={quest,result:savedRetreat};assert(g.settleContract(state).ok);assert.equal(state.roster.length,3);assert(state.roster.every(a=>a.injuries===99&&a.weaponId==='sword'));assert.equal(state.weapons.sword,0);assert(!g.settleContract(state).ok,'saved retreat cannot settle twice');
const original=JSON.stringify(party);g.resolveQuest(party,{...quest,kind:'simulation',requiredPartySize:null},811);assert.equal(JSON.stringify(party),original);
console.log(`Retreat passed: ${retreats}/${failed} defeated parties returned together with 99 injuries; failed rewards, saved outcomes and equipped weapons behave correctly.`);
