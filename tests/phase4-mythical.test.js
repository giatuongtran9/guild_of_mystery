'use strict';
const assert=require('node:assert/strict');
const g=require('../js/node-loader.js');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+error.message);}}
function unit(path,sequence,id){
 const a=g.makeAgent(()=>.4,{path:path||'fool',sequence,trait:'Stout Vitality'});
 Object.assign(a,{id,name:id,path,sequence,awakened:!!path,stats:{hp:1000,atk:100,def:0,int:100},baseStats:{hp:1000,atk:100,def:0,int:100},injuries:0,weaponId:'none',weaponMastery:{},cooldowns:{},sp:1000,maxSP:1000});
 const u=g.makeCombatUnit(a,{maxHp:1000,hp:1000});u.agent.stats={hp:1000,atk:100,def:0,int:100};u.sp=u.maxSP=g.maxSPFor(u.agent);u._formUsed=true;return u;
}
function world(path,sequence=4,side='ally'){
 const owner=unit(path,sequence,'owner'),ally=unit(null,sequence,'friend'),foe=unit(null,sequence,'foe'),other=unit(null,sequence,'other');
 const state={allies:side==='ally'?[owner,ally]:[foe,other],enemies:side==='ally'?[foe,other]:[owner,ally],events:[],balanceTrace:[],weaponUsage:{},currentRound:1,currentTurn:1,rng:()=>.99,battleMarionettes:[],createdMarionettes:[]};
 owner._formUsed=false;owner.hp=490;return{owner,ally,foe,other,state,lines:[]};
}
function awaken(w){g.tryMythicalForm(w.owner.agent,w.owner,w.state,w.lines,()=>.99);w.owner.shield=0;return w;}
function hit(w,attacker,defender,amount=100,opt={}){return g.resolveIncoming(attacker,defender,amount,w.state,w.lines,()=>.99,{execute:true,damageType:'physical',...opt});}
function cast(w,caster,victim,effects,damage=null){const spec={id:'fixture_spell',effectId:'fixture_spell',name:'Fixture spell',text:'Fixture spell',type:'active',costSP:10,cooldown:1,effects,damage};return g.applyStructuredAbility(caster.agent,caster,victim,w.state,w.lines,()=>.99,spec);}

test('all 22 mythical rules have a description from the live rule configuration',()=>{
 assert.equal(typeof g.mythicalDescription,'function');
 assert.deepEqual(Object.keys(g.MYTHICAL_AUTHORITIES).sort(),g.PATH_KEYS.slice().sort());
 for(const path of g.PATH_KEYS){assert(g.mythicalDescription(path,4).length>20,path);assert(g.mythicalDescription(path,0).length>20,path);}
});
test('Darkness description limits revealing attacks to successful direct damage',()=>{
 assert(g.mythicalDescription('darkness',4).includes('revealed when dealing direct damage'));
 for(const side of ['ally','enemy']){
  const w=awaken(world('darkness',4,side));
  hit(w,w.ally,w.foe,100,{indirect:true});assert.equal(hit(w,w.foe,w.ally).hpLoss,0);
  hit(w,w.ally,w.foe,100,{reflect:true});assert.equal(hit(w,w.foe,w.ally).hpLoss,0);
  hit(w,w.ally,w.foe);assert.equal(hit(w,w.foe,w.ally).hpLoss,100);
 }
});
for(const side of ['ally','enemy']){
 test(`${side}: common awakening retains threshold, shield and damage boost`,()=>{
  const w=world('fool',4,side);w.owner.hp=501;g.tryMythicalForm(w.owner.agent,w.owner,w.state,w.lines,()=>.99);assert(!w.owner._inForm);
  w.owner.hp=500;g.tryMythicalForm(w.owner.agent,w.owner,w.state,w.lines,()=>.99);assert(w.owner._inForm);assert.equal(w.owner.shield,300);assert.equal(w.owner._formBoost,1.2);assert.equal(w.owner._mythicalAuthority,undefined);
 });
 test(`${side}: 70% pollution targets actual Sequences 5–9 only`,()=>{
  const w=world('fool',4,side),victims=side==='ally'?w.state.enemies:w.state.allies;victims.splice(0,victims.length,...[4,5,9,0,10].map((seq,i)=>unit(null,seq,'victim'+i)));
  g.tryMythicalForm(w.owner.agent,w.owner,w.state,w.lines,()=>.69);
  assert.deepEqual(victims.map(v=>g.hasStatus(v,'stunned')),[false,true,true,false,false]);
  const high=world('fool',4,side);high.foe.sequence=5;g.tryMythicalForm(high.owner.agent,high.owner,high.state,[],()=>.70);assert(!g.hasStatus(high.foe,'stunned'));
 });
 test(`${side}: Door shelter negates targeted hits but allows area and indirect damage`,()=>{
  const w=awaken(world('door',4,side));assert.equal(hit(w,w.foe,w.ally).hpLoss,0);assert.equal(hit(w,w.foe,w.ally,100,{area:true}).hpLoss,100);assert.equal(hit(w,w.foe,w.ally,100,{indirect:true}).hpLoss,100);
  g.mythicalTurnEnd(w.owner,w.state,w.lines,()=>.99);assert.equal(hit(w,w.foe,w.ally).hpLoss,100);
 });
 test(`${side}: angelic Door exiles one resistible enemy for two turns`,()=>{
  const w=awaken(world('door',2,side));const target=[w.foe,w.other].find(v=>g.hasStatus(v,'banished'));assert(target);assert.equal(target.statusMeta.banished.duration,2);assert.equal(target._skipTurns,2);
 });
 test(`${side}: Error steals one scheduled enemy action and grants a paid extra action`,()=>{
  const w=awaken(world('error',1,side));assert.equal(g.mythicalTryAction(w.owner,w.state,w.lines,()=>.99),false);assert.equal(w.owner._extraTurns,1);const target=[w.foe,w.other].find(v=>v._mythicalStolenTurn);assert(target);assert.equal(g.mythicalTryAction(target,w.state,w.lines,()=>.99),true);assert.equal(g.mythicalTryAction(target,w.state,w.lines,()=>.99),false);g.mythicalTryAction(w.owner,w.state,w.lines,()=>.99);assert.equal(w.owner._extraTurns,1);
 });
 test(`${side}: parasite Error escapes one lethal direct hit through its live host`,()=>{
  const w=awaken(world('error',4,side));w.owner._signatureParasite={hostId:w.foe.id,turns:2};w.owner.hp=10;hit(w,w.other,w.owner,100);assert.equal(w.owner.alive,true);assert.equal(w.owner.hp,10);assert(w.foe.hp<1000);hit(w,w.other,w.owner,100);assert.equal(w.owner.alive,false);
 });
 test(`${side}: Error cannot parasitize itself through a confused self-targeted cast`,()=>{
  const w=awaken(world('error',4,side)),spec=g.unlockedAbilities(w.owner.agent).find(s=>g.abilityEffects(s).some(e=>e.rule==='error_parasite'));assert(spec);
  g.applyStructuredAbility(w.owner.agent,w.owner,w.owner,w.state,w.lines,()=>.99,spec);
  assert.equal(w.owner._signatureParasite,undefined);assert.equal(w.owner._signatureParasites?.length||0,0);
  w.owner.hp=10;const result=hit(w,w.foe,w.owner,100);assert.equal(result.dead,!w.owner.alive);assert.equal(w.owner.alive,false);
 });
 test(`${side}: Error's fatal redirect requires another living parasite host`,()=>{
  for(const self of [true,false]){const w=awaken(world('error',4,side));w.owner.hp=10;w.foe.alive=false;w.foe.hp=0;w.owner._signatureParasite={hostId:self?w.owner.id:w.foe.id,turns:2};
   const result=hit(w,w.other,w.owner,100);assert.equal(result.dead,!w.owner.alive);assert.equal(w.owner.alive,false);assert.equal(w.owner.hp,0);
  }
 });
 test(`${side}: Visionary dream ends on HP damage with one psychic backlash`,()=>{
  const w=awaken(world('visionary',4,side)),target=[w.foe,w.other].find(v=>g.hasStatus(v,'sleep'));assert(target);assert.equal(target.statusMeta.sleep.duration,2);const backlash=g.v15Damage('pure_caster_ability',{agent:w.owner.agent,actor:w.owner,target,abilityMult:1,damageSpec:{scaling:'INT',type:'elemental',element:'psychic',multiplier:1}});hit(w,w.ally,target,100);assert(!g.hasStatus(target,'sleep'));assert.equal(target.hp,900-backlash);hit(w,w.ally,target,100);assert.equal(target.hp,800-backlash);
 });
 test(`${side}: Sun cleanses and protects allies from poison and curse for two own turns`,()=>{
  const w=world('sun',4,side);g.addStatus(w.ally,'poison',3,'fixture');g.addStatus(w.ally,'curse',3,'fixture');awaken(w);assert(!g.hasStatus(w.ally,'poison'));assert(!g.hasStatus(w.ally,'curse'));g.addStatus(w.ally,'poison',2,'fixture');assert(!g.hasStatus(w.ally,'poison'));g.mythicalTurnEnd(w.owner,w.state,w.lines,()=>.99);g.addStatus(w.ally,'curse',2,'fixture');assert(!g.hasStatus(w.ally,'curse'));g.mythicalTurnEnd(w.owner,w.state,w.lines,()=>.99);g.addStatus(w.ally,'curse',2,'fixture');assert(g.hasStatus(w.ally,'curse'));
 });
 test(`${side}: Sun aura stops protecting allies when its owner dies`,()=>{
  const w=awaken(world('sun',4,side));hit(w,w.foe,w.owner,2000);assert(!w.owner.alive);g.addStatus(w.ally,'poison',2,'fixture');assert(g.hasStatus(w.ally,'poison'));
  assert(!w.lines.filter(l=>l.text.includes('ends;')).some(l=>l.text.includes('remains active')));
 });
 test(`${side}: a qualifying marionette's Sun aura ends on its final death`,()=>{
  const w=awaken(world('sun',4,side));w.owner.summoned=true;hit(w,w.foe,w.owner,2000);assert(!w.owner.alive);g.addStatus(w.ally,'poison',2,'fixture');assert(g.hasStatus(w.ally,'poison'));
 });
 test(`${side}: mythical dream survives a hit absorbed entirely by shield`,()=>{
  const w=awaken(world('visionary',4,side)),target=[w.foe,w.other].find(v=>g.hasStatus(v,'sleep'));assert(target);target.shield=10000;assert(g.attackOnce(w.ally.agent,w.ally,target,w.state,w.lines,()=>.99));assert(g.hasStatus(target,'sleep'));assert.equal(target.hp,1000);
 });
 test(`${side}: Tyrant delivers exactly two team-wide Lightning pulses`,()=>{
  const w=awaken(world('tyrant',4,side));const before=w.foe.hp;g.mythicalTurnStart(w.owner,w.state,w.lines,()=>.99);assert(w.foe.hp<before&&w.other.hp<1000);g.mythicalTurnEnd(w.owner,w.state,w.lines,()=>.99);g.mythicalTurnStart(w.owner,w.state,w.lines,()=>.99);const second=w.foe.hp;g.mythicalTurnEnd(w.owner,w.state,w.lines,()=>.99);g.mythicalTurnStart(w.owner,w.state,w.lines,()=>.99);assert.equal(w.foe.hp,second);
 });
 test(`${side}: White Tower decodes one spell, never true damage`,()=>{
  const w=awaken(world('white_tower',4,side));assert.equal(hit(w,w.foe,w.owner,50,{damageType:'true',trueDamage:true}).hpLoss,50);assert.equal(hit(w,w.foe,w.owner,100,{damageType:'fire',ability:{id:'enemy_spell',type:'active',effects:[]}}).hpLoss,0);assert.equal(hit(w,w.foe,w.owner,100,{damageType:'fire'}).hpLoss,100);
 });
 test(`${side}: Hanged Man devours a final enemy death once without taking an allied soul`,()=>{
  const w=awaken(world('hanged_man',4,side));w.owner.hp=100;hit(w,w.foe,w.ally,2000);assert.equal(w.owner.hp,100);w.foe.path='sun';w.foe.awakened=true;w.foe.sequence=9;hit(w,w.owner,w.foe,2000);assert.equal(w.owner.hp,600);hit(w,w.owner,w.other,2000);assert.equal(w.owner.hp,600);
 });
 test(`${side}: Darkness concealment breaks when each ally attacks`,()=>{
  const w=awaken(world('darkness',4,side));assert.equal(hit(w,w.foe,w.ally).hpLoss,0);hit(w,w.ally,w.foe);assert.equal(hit(w,w.foe,w.ally).hpLoss,100);assert.equal(hit(w,w.foe,w.owner).hpLoss,0);
 });
 test(`${side}: Darkness keeps allies concealed when a damaging spell misses or is negated`,()=>{
  const w=awaken(world('darkness',4,side));w.ally._nextAttackMiss=1;
  assert(cast(w,w.ally,w.foe,[],{scaling:'INT',type:'elemental',element:'fire',multiplier:1}));
  assert.equal(hit(w,w.foe,w.ally).hpLoss,0);
  w.foe._reflect={mode:'share',share:0,negate:true};assert.equal(hit(w,w.ally,w.foe).hpLoss,0);
  assert.equal(hit(w,w.foe,w.ally).hpLoss,0);
  delete w.foe._reflect;w.foe.shield=100;assert.equal(hit(w,w.ally,w.foe).absorbed,100);
  assert.equal(hit(w,w.foe,w.ally).hpLoss,100);
 });
 test(`${side}: Door and Darkness party protection ends on its owner's final death`,()=>{
  for(const path of ['door','darkness']){const w=awaken(world(path,4,side));assert.equal(hit(w,w.foe,w.ally).hpLoss,0);hit(w,w.foe,w.owner,2000,{area:true});assert(!w.owner.alive);assert.equal(hit(w,w.foe,w.ally).hpLoss,100);}
 });
 test(`${side}: cleansing a mythical dream does not leave a later damage backlash`,()=>{
  const w=awaken(world('visionary',4,side)),target=[w.foe,w.other].find(v=>g.hasStatus(v,'sleep'));assert(target);
  target.status=target.status.filter(s=>s!=='sleep');delete target.statusMeta.sleep;
  hit(w,w.ally,target);assert.equal(target.hp,900);
 });
 test(`${side}: cleansing mythical control removes its marker before a foreign sleep or freeze`,()=>{
  for(const [path,status,key] of [['visionary','sleep','_mythicalDream'],['demoness','frozen','_mythicalPetrified']]){
   const w=awaken(world(path,4,side)),target=[w.foe,w.other].find(v=>g.hasStatus(v,status));assert(target);
   assert(cast(w,target,w.owner,[{type:'cleanse'}]));assert.equal(target[key],undefined);
   assert(cast(w,w.ally,target,[{type:'status',status,duration:2}]));hit(w,w.ally,target);assert.equal(target.hp,900);
   if(status==='frozen')assert(g.hasStatus(target,status));
  }
 });
 test(`${side}: Death recalls one fallen ally at 35% HP and retains survival counters`,()=>{
  const w=world('death',4,side);w.ally.alive=false;w.ally.hp=0;w.ally._revived=true;g.addStatus(w.ally,'no_heal',3,'fixture');awaken(w);assert(w.ally.alive);assert.equal(w.ally.hp,350);assert.equal(w.ally._revived,true);g.mythicalTurnStart(w.owner,w.state,w.lines,()=>.99);assert.equal(w.ally.hp,350);
 });
 test(`${side}: Twilight Giant intercepts 50% of direct ally damage only`,()=>{
  const w=awaken(world('twilight_giant',4,side));const before=w.owner.hp;assert.equal(hit(w,w.foe,w.ally).hpLoss,50);assert.equal(before-w.owner.hp,50);assert.equal(hit(w,w.foe,w.ally,100,{indirect:true}).hpLoss,100);
 });
 test(`${side}: Red Priest cleaves one additional foe from actual HP damage`,()=>{
  const w=awaken(world('red_priest',4,side));hit(w,w.ally,w.foe,100);assert.equal(w.other.hp,950);hit(w,w.ally,w.foe,100,{indirect:true});assert.equal(w.other.hp,950);
 });
 test(`${side}: Demoness petrifies one target until HP damage breaks it`,()=>{
  const w=awaken(world('demoness',4,side)),target=[w.foe,w.other].find(v=>g.hasStatus(v,'frozen'));assert(target);assert.equal(target.statusMeta.frozen.duration,2);target.shield=100;hit(w,w.ally,target,50);assert(g.hasStatus(target,'frozen'));hit(w,w.ally,target,100);assert(!g.hasStatus(target,'frozen'));
 });
 test(`${side}: Hermit revelation penetrates nonphysical spells but preserves shield damage order`,()=>{
  const w=world('hermit',4,side);w.foe.def=100;w.foe.resistances={fire:80};const spell={scaling:'INT',type:'elemental',element:'fire',multiplier:1,formula:'pure_caster_ability'};const before=g.v15Damage('pure_caster_ability',{agent:w.owner.agent,actor:w.owner,target:w.foe,damageSpec:spell});awaken(w);const after=g.v15Damage('pure_caster_ability',{agent:w.owner.agent,actor:w.owner,target:w.foe,damageSpec:spell});assert(after>before);w.foe.shield=100;assert.equal(hit(w,w.owner,w.foe,after,{damageType:'fire'}).absorbed,Math.min(100,after));
 });
 test(`${side}: Hermit revelation adds 50 points of spell DEF bypass and halves elemental resistance only`,()=>{
  const w=awaken(world('hermit',4,side));w.foe.agent.stats.def=w.foe.def=100;w.foe.resistances={fire:80,physical:30};
  const fireTrace={},physicalTrace={},trueTrace={};
  g.v15Damage('pure_caster_ability',{agent:w.owner.agent,actor:w.owner,target:w.foe,damageSpec:{scaling:'INT',type:'elemental',element:'fire',multiplier:1},trace:fireTrace});
  g.v15Damage('empowered_hybrid_physical',{agent:w.owner.agent,actor:w.owner,target:w.foe,damageSpec:{scaling:'ATK',type:'physical',element:'physical',multiplier:1},trace:physicalTrace});
  g.v15Damage('pure_caster_ability',{agent:w.owner.agent,actor:w.owner,target:w.foe,damageSpec:{scaling:'INT',type:'true',element:'fire',multiplier:1},trace:trueTrace});
  assert.equal(fireTrace.resistance,40);assert.equal(physicalTrace.resistance,30);assert.equal(trueTrace.resistance,0);
  assert.equal(g.mythicalDamageOptions(w.owner,w.foe,{type:'elemental',element:'fire'}).defPen,.5);
  assert.deepEqual(g.mythicalDamageOptions(w.owner,w.foe,{type:'physical',element:'physical'}),{});
  assert.deepEqual(g.mythicalDamageOptions(w.owner,w.foe,{type:'true',element:'fire'}),{});
  g.mythicalTurnEnd(w.owner,w.state,w.lines);g.mythicalTurnEnd(w.owner,w.state,w.lines);
  const expiredTrace={};g.v15Damage('pure_caster_ability',{agent:w.owner.agent,actor:w.owner,target:w.foe,damageSpec:{scaling:'INT',type:'elemental',element:'fire',multiplier:1},trace:expiredTrace});
  assert.equal(expiredTrace.resistance,80);assert.equal(fireTrace.defPen-expiredTrace.defPen,.5);
 });
 test(`${side}: Paragon manifests one historical machine for three owner turns`,()=>{
  const w=awaken(world('paragon',4,side));const machine=(side==='ally'?w.state.allies:w.state.enemies).find(v=>v.summoned);assert(machine);assert.equal(machine._signatureOwnerId,w.owner.id);assert.equal(machine._signatureLifetime,3);assert.equal(machine._formUsed,true);
  assert.equal(machine.agent.stats.atk,w.owner.agent.stats.atk);assert.equal(machine.agent.stats.int,w.owner.agent.stats.int);
  for(let i=0;i<3;i++){g.signatureTurnEnd(machine,w.state,w.lines,()=>.99);g.mythicalTurnEnd(machine,w.state,w.lines);}
  assert(machine.alive);assert.equal(machine._signatureLifetime,3);
  for(let i=0;i<2;i++){g.signatureTurnEnd(w.owner,w.state,w.lines,()=>.99);g.mythicalTurnEnd(w.owner,w.state,w.lines);assert(machine.alive);}
  g.signatureTurnEnd(w.owner,w.state,w.lines,()=>.99);g.mythicalTurnEnd(w.owner,w.state,w.lines);assert(!machine.alive);
 });
 test(`${side}: Paragon's historical machine expires with its owner's final death`,()=>{
  const w=awaken(world('paragon',4,side)),machine=[...w.state.allies,...w.state.enemies].find(v=>v._signatureCompanionKind==='historical_machine');assert(machine);
  hit(w,w.foe,w.owner,2000);assert(!w.owner.alive);assert(!machine.alive);assert.equal(machine.inCombat,false);
 });
 test(`${side}: Fortune high-rank fatal rewind restores only historical HP once`,()=>{
  const w=awaken(world('wheel_of_fortune',1,side));w.owner.hp=400;g.mythicalTurnStart(w.owner,w.state,w.lines,()=>.99);w.owner.hp=10;w.owner.sp=20;w.owner.cooldowns.fixture=2;w.owner._revived=true;hit(w,w.foe,w.owner,100);assert.equal(w.owner.hp,400);assert.equal(w.owner.sp,20);assert.equal(w.owner.cooldowns.fixture,2);assert.equal(w.owner._revived,true);hit(w,w.foe,w.owner,1000);assert.equal(w.owner.alive,false);
 });
 test(`${side}: Mother living earth heals 10% Max HP over three owner turns and obeys no-heal`,()=>{
  const w=awaken(world('mother',4,side));w.ally.hp=100;g.addStatus(w.owner,'no_heal',4,'fixture');const before=w.owner.hp;for(let i=0;i<3;i++){g.mythicalTurnStart(w.owner,w.state,w.lines,()=>.99);g.mythicalTurnEnd(w.owner,w.state,w.lines,()=>.99);}assert.equal(w.ally.hp,400);assert.equal(w.owner.hp,before);g.mythicalTurnStart(w.owner,w.state,w.lines,()=>.99);assert.equal(w.ally.hp,400);
 });
 test(`${side}: Moon converts 30% party HP damage to healing, bounded per turn`,()=>{
  const w=awaken(world('moon',4,side));w.ally.hp=100;hit(w,w.owner,w.foe,100);assert.equal(w.ally.hp,130);w.foe.shield=100;hit(w,w.owner,w.foe,100);assert.equal(w.ally.hp,130);g.addStatus(w.ally,'no_heal',3,'fixture');hit(w,w.owner,w.foe,100);assert.equal(w.ally.hp,130);
 });
 test(`${side}: Abyss punishes an enemy active cast once per action`,()=>{
  const w=awaken(world('abyss',4,side));const before=w.foe.hp;assert(cast(w,w.foe,w.owner,[{type:'buff',stat:'atk',amount:.1,duration:1}]));assert(w.foe.hp<before);const after=w.foe.hp;g.mythicalAfterCast(w.foe,w.owner,w.state,w.lines,()=>.99,{type:'active'});assert.equal(w.foe.hp,after);
 });
 test(`${side}: Abyss action limit accepts a saved ID matching a prototype key`,()=>{
  const w=awaken(world('abyss',4,side));w.foe.id=w.foe.agent.id='__proto__';
  assert(cast(w,w.foe,w.owner,[{type:'buff',stat:'atk',amount:.1,duration:1}]));const after=w.foe.hp;
  g.mythicalAfterCast(w.foe,w.owner,w.state,w.lines,()=>.99,{type:'active'});assert.equal(w.foe.hp,after);
 });
 test(`${side}: mythical INT backlash uses normal defense and elemental resistance`,()=>{
  const w=awaken(world('abyss',4,side));w.foe.resistances={fire:80};w.foe.def=100;
  const expected=g.v15Damage('pure_caster_ability',{agent:w.owner.agent,actor:w.owner,target:w.foe,abilityMult:1,damageSpec:{scaling:'INT',type:'elemental',element:'fire',multiplier:1}}),before=w.foe.hp;
  assert(cast(w,w.foe,w.owner,[{type:'buff',stat:'atk',amount:.1,duration:1}]));assert.equal(before-w.foe.hp,expected);
 });
 test(`${side}: unaffordable support casts do not steal or trigger court judgment`,()=>{
  for(const path of ['black_emperor','justiciar']){const w=awaken(world(path,4,side));w.foe.sp=0;const before=w.foe.hp;assert.equal(cast(w,w.foe,w.owner,[{type:'shield',maxHpRatio:.2}]),false);assert.equal(w.foe.hp,before);assert.equal(w.owner._mythicalAuthority.used,false);assert.equal(w.owner.shield,0);}
 });
 test(`${side}: Chained echoes direct HP loss through a cleansable curse link`,()=>{
  const w=awaken(world('chained',4,side)),target=[w.foe,w.other].find(v=>v._mythicalCurseLink);assert(target);hit(w,w.foe,w.owner,100);assert.equal(target.hp,900);target.status=target.status.filter(s=>s!=='curse_link');delete target.statusMeta.curse_link;hit(w,w.foe,w.owner,100);assert.equal(target.hp,900);
 });
 test(`${side}: Black Emperor steals one active support spell with its original SP cost`,()=>{
  const w=awaken(world('black_emperor',4,side));const sp=w.foe.sp;assert(cast(w,w.foe,w.owner,[{type:'shield',maxHpRatio:.2}]));assert.equal(w.owner.shield,200);assert.equal(w.foe.shield||0,0);assert.equal(w.foe.sp,sp-10);w.foe.cooldowns={};assert(cast(w,w.foe,w.owner,[{type:'shield',maxHpRatio:.3}]));assert.equal(w.foe.shield,300);
 });
 test(`${side}: Justiciar blocks enemy heal and shield effects but retains paid damage`,()=>{
  const w=awaken(world('justiciar',4,side));w.foe.hp=100;const sp=w.foe.sp;assert(cast(w,w.foe,w.owner,[{type:'heal',maxHpRatio:.3},{type:'shield',maxHpRatio:.2}]));assert(w.foe.hp<=100);assert.equal(w.foe.shield||0,0);assert.equal(w.foe.sp,sp-10);
 });
 test(`${side}: Justiciar's court blocks paid signature medicine, seeds and guardian shields`,()=>{
  for(const [path,rule] of [['moon','moon_medicine'],['mother','mother_seed'],['twilight_giant','giant_guardian']]){
   const w=awaken(world('justiciar',4,side));w.foe.path=path;w.foe.agent.awakened=true;w.foe.sp=w.foe.maxSP=g.maxSPFor(w.foe.agent);w.foe.hp=400;g.setMeterValue(w.foe.agent,path,100);
   const spec=g.unlockedAbilities(w.foe.agent).find(s=>g.abilityEffects(s).some(e=>e.rule===rule)),sp=w.foe.sp,before=w.foe.hp,ownerBefore=w.owner.hp;
   const judgment=g.v15Damage('pure_caster_ability',{agent:w.owner.agent,actor:w.owner,target:w.foe,abilityMult:1,damageSpec:{scaling:'INT',type:'elemental',element:'holy',multiplier:1}});
   assert(g.applyStructuredAbility(w.foe.agent,w.foe,w.owner,w.state,w.lines,()=>.99,spec));
   assert.equal(w.foe.sp,sp-Number(spec.costSP));assert.equal(w.foe.hp,before-judgment);
   assert(![...w.state.allies,...w.state.enemies].some(u=>u._signatureSeed));assert.equal(w.foe.shield||0,0);assert.equal(w.other.shield||0,0);
   if(spec.damage)assert(w.owner.hp<ownerBefore,'offensive damage remains');
  }
 });
 test(`${side}: Black Emperor steals paid signature medicine, seeds and guardian shields`,()=>{
  for(const [path,rule] of [['moon','moon_medicine'],['mother','mother_seed'],['twilight_giant','giant_guardian']]){
   const w=awaken(world('black_emperor',4,side));w.owner.hp=200;w.foe.path=path;w.foe.agent.awakened=true;w.foe.sp=w.foe.maxSP=g.maxSPFor(w.foe.agent);w.foe.hp=400;g.setMeterValue(w.foe.agent,path,100);
   const spec=g.unlockedAbilities(w.foe.agent).find(s=>g.abilityEffects(s).some(e=>e.rule===rule)),sp=w.foe.sp,before=w.foe.hp,ownerBefore=w.owner.hp;
   assert(g.applyStructuredAbility(w.foe.agent,w.foe,w.owner,w.state,w.lines,()=>.99,spec));
   assert.equal(w.foe.sp,sp-Number(spec.costSP));assert.equal(w.foe.hp,before);assert(w.owner._mythicalAuthority.used);
   if(rule==='moon_medicine')assert.equal(w.owner.hp,ownerBefore+270);
   if(rule==='mother_seed'){assert(w.owner._signatureSeed);assert.equal(w.foe._signatureSeed,undefined);assert(w.owner.hp<ownerBefore,'offensive damage retains its original target');}
   if(rule==='giant_guardian'){assert.equal(w.owner.shield,200);assert.equal(w.ally.shield||0,0);assert.equal(w.foe.shield||0,0);assert.equal(w.other.shield||0,0);}
  }
 });
 test(`${side}: Justiciar blocks Blood Siphon's active healing while its damage remains`,()=>{
  const w=awaken(world('justiciar',4,side));w.owner.hp=450;w.foe.path='moon';w.foe.agent.awakened=true;w.foe.hp=400;g.setMeterValue(w.foe.agent,'moon',100);
  const spec=g.unlockedAbilities(w.foe.agent).find(s=>s.effectId==='blood_siphon'),sp=w.foe.sp;
  const judgment=g.v15Damage('pure_caster_ability',{agent:w.owner.agent,actor:w.owner,target:w.foe,abilityMult:1,damageSpec:{scaling:'INT',type:'elemental',element:'holy',multiplier:1}});
  assert(g.applyStructuredAbility(w.foe.agent,w.foe,w.owner,w.state,w.lines,()=>.99,spec));assert.equal(w.foe.sp,sp-30);assert.equal(w.foe.hp,400-judgment);assert(w.owner.hp<450);
 });
 test(`${side}: Black Emperor steals Blood Siphon's active healing while retaining its offensive target`,()=>{
  const w=awaken(world('black_emperor',4,side));w.owner.hp=450;w.foe.path='moon';w.foe.agent.awakened=true;w.foe.hp=400;g.setMeterValue(w.foe.agent,'moon',100);
  const spec=g.unlockedAbilities(w.foe.agent).find(s=>s.effectId==='blood_siphon'),sp=w.foe.sp;
  assert(g.applyStructuredAbility(w.foe.agent,w.foe,w.owner,w.state,w.lines,()=>.99,spec));
  const event=w.state.events.find(e=>e.type==='damage'&&e.actorId===w.foe.id&&e.targetId===w.owner.id&&!e.isReflect);assert(event&&event.hpLoss>0);
  assert.equal(w.foe.sp,sp-30);assert.equal(w.foe.hp,400);assert.equal(w.owner.hp,450+150-event.hpLoss+Math.round(event.hpLoss*.3));
 });
}
console.log(`Mythical authority tests: ${passed} passed, ${failed} failed`);if(failed)process.exitCode=1;
