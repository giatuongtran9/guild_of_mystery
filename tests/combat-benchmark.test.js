'use strict';
const assert=require('node:assert/strict'),g=require('../js/node-loader');
const h=require('../scripts/combat-benchmark-helpers');
const fixture=require('../scripts/permanent-asset-loadouts');

// A mirror win must never rescue a weak non-mirror win rate. Timeouts remain
// in the denominator; a side-swap replay is kept out of this input entirely.
const base={sequence:5,seed:1,sample:0,reversed:false,rounds:5,winner:'a',winnerId:'Alpha0',winnerTeam:'allies',timeout:false,mutual:false};
const report=h.summarize([
 {...base,a:'sun',b:'sun'},
 {...base,a:'sun',b:'tyrant'},
 {...base,a:'sun',b:'tyrant',winner:null,winnerId:null,winnerTeam:null,timeout:true,rounds:50}
],['sun','tyrant'],[5]);
assert.equal(report.summary.battles,3);
assert.equal(report.summary.nonMirrorBattles,2);
const sun=report.rows.find(r=>r.pathway==='sun');
assert.equal(sun.battles,2);assert.equal(sun.winRate,.5);assert.equal(sun.drawRate,.5);
assert.equal(sun.decisiveWinRate,1);assert.equal(report.summary.completedBy12,2/3);

for(const sequence of [9,8,7,6,5,4,3,2,1,0])for(const pathway of g.PATH_KEYS){
 const a=h.preparedHero(g,pathway,sequence,'Alpha0',{assets:'rare'}),c=g.pathwayCollection(a);
 const assets=g.preparedPathwayAssets(a);
 assert.equal(a.weaponId,'rare_sword');
 assert.deepEqual(h.authoredProfile(a).weaponMastery,{});
 assert.deepEqual(h.authoredProfile(a).pathwayInventory,a.pathwayInventory||null);
 if(!c||sequence>c.unlock){assert.equal(assets.length,0);continue;}
 assert(assets.length<=g.pathwayPreparationLimit(a));
 assert(a.pathwayInventory.assets.length<=g.pathwayAssetCapacity(a));
 for(const asset of assets){
  assert(g.pathwayAssetUsable(a,asset));assert(asset.sequence>=sequence);
  if(['record','soul'].includes(c.kind)){
   const spec=g.pathwayAssetSpec(asset);assert(spec);
   if(c.kind==='soul')assert(g.soulAbilityEligible(spec));
   else {assert.equal(spec.type,'active');assert(!g.abilityEffects(spec).some(e=>e.type==='signature'));}
  }
 }
 if(c.kind==='soul')assert.equal(assets.length,5);
 if(c.kind==='record')assert.equal(assets.length,sequence===6?1:4);
 const before=JSON.stringify(a.pathwayInventory);
 h.authoredProfile(a).pathwayInventory.assets[0].condition='lost';
 assert.equal(JSON.stringify(a.pathwayInventory),before,'Enemy profiles must not share mutable source inventory.');
}

// A retained older companion remains capped by its acquired Sequence.
for(const pathway of ['moon','paragon','fool']){
 const a=h.preparedHero(g,pathway,0,'Alpha0',{assets:'legendary',assetAge:2});
 for(const asset of g.preparedPathwayAssets(a))assert.equal(asset.sequence,2);
}
assert.deepEqual(fixture.balancedAbilities(g,h.preparedHero(g,'hanged_man',0,'x'), 'soul',5)
 .map(x=>x.spec.effectId),fixture.balancedAbilities(g,h.preparedHero(g,'hanged_man',0,'y'),'soul',5).map(x=>x.spec.effectId));
console.log('Combat benchmark passed: mirror exclusion, draw denominators, immutable matched loadouts, all 220 legal pathway–Sequence fixtures, caps and older companions.');
