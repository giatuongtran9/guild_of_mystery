'use strict';
// Keep quantitative effect/trait tests independent of the global balance layer.
// Live modifiers, unchanged saves and actual encounter outcomes are exercised in
// global-combat.test.js, contract-pool.test.js and the production benchmarks.
module.exports=g=>{
 Object.assign(g.GLOBAL_COMBAT,{hp:1,stats:{},damage:1,healing:1,shield:1,roundRamp:0,intBasicFloor:0,ccGap:0,protectionTurns:0,evadeRate:1});
 for(const [path,p] of Object.entries(g.PATHS))for(const t of p.sequences)for(const a of t.abilities||[]){a.utilityStrike=0;a.text=g.abilityDescription(a,path,t.sequence);t.abilityText=t.ability=a.text;}
 return g;
};
