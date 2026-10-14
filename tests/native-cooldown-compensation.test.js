'use strict';
const assert=require('node:assert/strict');
const g=require('../js/node-loader');
const clone=value=>JSON.parse(JSON.stringify(value));
const original=clone(g.GLOBAL_COMBAT);
const source=g.tierFor('wheel_of_fortune',2).abilities[0],before=clone(source);
function cast(sequence,flag){
 const a=g.makeAgent(()=>.5,{path:'wheel_of_fortune',sequence,trait:'Stout Vitality'});
 a.id='owner';g.restatAgent(a);a.sp=g.maxSPFor(a);
 const b=g.makeAgent(()=>.5,{path:'sun',sequence,trait:'Stout Vitality'});
 b.id='opponent';g.restatAgent(b);
 const u=g.makeCombatUnit(a),v=g.makeCombatUnit(b);
 u._formUsed=u.agent._formUsed=true;u.hp=Math.round(u.maxHp*.4);
 u._signatureHistory=[{round:1,hp:Math.round(u.maxHp*.8),fx:[]}];
 const state={allies:[u],enemies:[v],currentRound:3,events:[],balanceTrace:[],rng:()=>.99,weaponUsage:{}};
 const spec={...clone(source),...(flag?{[flag]:true}:{})};
 const sp=u.agent.sp,hp=u.hp;
 assert(g.applyStructuredAbility(u.agent,u,v,state,[],state.rng,spec));
 assert.equal(sp-u.agent.sp,source.costSP,'the override does not change SP payment');
 if(!flag)assert(u.hp>hp,'full authored native rewind recovery remains usable');
 const cd=g.nativeAbilityCooldown(u.agent,spec);
 assert.equal(u.agent.cooldowns.reincarnation_loop,cd+1,'the cast assigns the effective cooldown and action grace');
 assert.equal(state.events.find(e=>e.type==='cast').cooldown,cd,'battle feedback shows the actual cooldown');
 assert.equal(g.traitAbilityQuote(u.agent,spec,u).cooldownReady,false,'an immediate second cast remains unavailable');
 return cd;
}
try{
 g.GLOBAL_COMBAT.native_ability_cooldown_by_pathway_sequence={wheel_of_fortune:{1:{reincarnation_loop:6}}};
 assert.equal(cast(1),6);
 assert.equal(cast(0),4,'the native adjustment is specific to Sequence 1');
 assert.equal(cast(1,'_signatureCopied'),4,'copies retain source cooldowns');
 for(const flag of ['_signatureOwned','_assetOwned'])assert.equal(g.nativeAbilityCooldown({path:'wheel_of_fortune',sequence:1},{...source,[flag]:true}),4);
 assert.deepEqual(source,before,'native compensation never mutates the source ability');
}finally{
 for(const key of Object.keys(g.GLOBAL_COMBAT))delete g.GLOBAL_COMBAT[key];
 Object.assign(g.GLOBAL_COMBAT,original);
 g.bindBattle(null);
}
console.log('Native cooldown compensation: actual paid rewind, feedback, repeat prevention, source copies and other Sequences passed.');
