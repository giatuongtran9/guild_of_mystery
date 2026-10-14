'use strict';
const assert=require('node:assert/strict'),g=require('../js/node-loader');
const clone=x=>JSON.parse(JSON.stringify(x));
function world(path,sequence){
 const make=(p,id)=>{const a=g.makeAgent(()=>.5,{path:p,sequence,trait:'Stout Vitality'});Object.assign(a,{id,name:id,path:p,sequence,awakened:true,stats:{hp:10000,atk:200,def:100,int:100},injuries:0,madness:0,weaponId:'none',weaponMastery:{},cooldowns:{}});a.sp=g.maxSPFor(a);return g.makeCombatUnit(a);};
 const u=make(path,'owner'),v=make('fool','foe');u._formUsed=v._formUsed=true;
 return {u,v,state:{allies:[u],enemies:[v],currentRound:1,events:[],balanceTrace:[],weaponUsage:{},rng:()=>.99}};
}
{
 const w=world('mother',2),spec=g.tierFor('mother',6).abilities[0];
 assert.equal(g.nativeAbilityDamageMultiplier(w.u.agent,spec),1.3);
 for(const flag of ['_signatureCopied','_assetOwned','_signatureOwned'])assert.equal(g.nativeAbilityDamageMultiplier(w.u.agent,{...spec,[flag]:true}),1);
 assert.equal(g.nativeAbilityDamageMultiplier({...w.u.agent,path:'error'},spec),1);
 assert.equal(g.nativeAbilityDamageMultiplier({...w.u.agent,sequence:3},spec),1);
 const incoming=copied=>{const x=world('mother',2),s={...clone(spec),_signatureCopied:copied};assert(g.applyStructuredAbility(x.u.agent,x.u,x.v,x.state,[],()=>.99,s));return x.state.balanceTrace.find(t=>t.abilityId==='life_seed').incoming;};
 const original=incoming(true),native=incoming(false);
 assert(Math.abs(native-original*1.3)<=1,'native compensation applies once to a real inherited cast; copies keep original output');
}
{
 const original=clone(g.GLOBAL_COMBAT);
 try{
  g.GLOBAL_COMBAT.incoming_by_pathway_sequence={paragon:{6:1.4},fool:{5:3}};
  g.GLOBAL_COMBAT.empty_collection_incoming_by_pathway_sequence={paragon:{6:.8},fool:{5:.75}};
  const empty=world('paragon',6);g.initializePathwayBattle(empty.state,{kind:'contract'},1);
  assert.equal(empty.u._assetHadPreparedCollection,false);assert.equal(g.pathwayIncomingDamageScale(empty.u),.8);
  const full=world('paragon',6);require('../scripts/permanent-asset-loadouts')(g,full.u.agent,'rare');
  g.initializePathwayBattle(full.state,{kind:'contract'},1);assert(full.u._assetHadPreparedCollection);assert.equal(g.pathwayIncomingDamageScale(full.u),1.4);
  full.u.agent.pathwayInventory.assets=[];assert.equal(g.pathwayIncomingDamageScale(full.u),1.4,'losing a vessel during battle never grants the empty-entry benefit');
  const held=world('paragon',6);require('../scripts/permanent-asset-loadouts')(g,held.u.agent,'rare');held.u.agent.pathwayInventory.policy='hold';
  g.initializePathwayBattle(held.state,{kind:'contract'},1);assert.equal(g.pathwayIncomingDamageScale(held.u),.8,'Hold enters as an empty usable preparation');
  const fool=world('fool',5);g.initializePathwayBattle(fool.state,{kind:'contract'},1);assert.equal(g.pathwayIncomingDamageScale(fool.u),.75);
  fool.u._assetStartingMarionettes=1;assert.equal(g.pathwayIncomingDamageScale(fool.u),3,'the full army retains its own burden');
  const summoned={...full.u,summoned:true};assert.equal(g.pathwayIncomingDamageScale(summoned),1,'companion stats and damage intake do not inherit owner compensation');
 }finally{for(const k of Object.keys(g.GLOBAL_COMBAT))delete g.GLOBAL_COMBAT[k];Object.assign(g.GLOBAL_COMBAT,original);}
}
console.log('Sequence compensation: source-only real casts, empty/prepared entry, frozen recovery rules and companion isolation passed.');
