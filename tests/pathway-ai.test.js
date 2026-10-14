'use strict';
const assert=require('node:assert/strict');
const g=require('../js/node-loader');
const loadout=require('../scripts/permanent-asset-loadouts');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}
function hero(path,sequence,id){const a=g.makeAgent(()=>.5,{path,sequence,trait:'Stout Vitality'});Object.assign(a,{id,name:id,path,sequence,awakened:true,injuries:0,madness:0,corruption:0,weaponId:'none',weaponMastery:{},cooldowns:{},statVariance:{hp:1,atk:1,def:1,int:1,speed:1},speedVariance:1,recommendedPath:null});g.restatAgent(a);a.sp=g.maxSPFor(a);return a;}
function world(path,seq=5,opponent='tyrant'){
 const actor=g.makeCombatUnit(hero(path,seq,'owner')),enemy=g.makeCombatUnit(hero(opponent,seq,'foe'));
 const state={allies:[actor],enemies:[enemy],currentRound:1,events:[],balanceTrace:[],createdMarionettes:[],battleMarionettes:[],weaponUsage:{}};
 return {actor,enemy,a:actor.agent,state};
}
function skill(w,id){const s=g.activeSpecs(w.a,w.actor,w.state).find(s=>(s.effectId||s.id)===id);assert(s,id+' exists');return s;}
function evaluate(w,id){return g.battleAIEvaluate(g.battleAIContext(w.a,w.actor,w.enemy,w.state,{}),skill(w,id));}
function prepared(w,tier='rare'){loadout(g,w.a,tier);g.initializePathwayBattle(w.state,{kind:'contract',id:'test',name:'Test'},1);g.deployPreparedPathwayCompanions(w.state,[]);return w;}
function choose(w,context={}){return g.choosePathwayBattleAction(w.a,w.actor,w.enemy,w.state,context);}
function snapshot(w){return JSON.stringify({a:w.a,state:w.state,paths:g.PATHS});}

test('all 22 pathways have an explicit strategy',()=>assert.deepEqual(Object.keys(g.PATHWAY_BATTLE_POLICIES).sort(),g.PATH_KEYS.slice().sort()));
test('Snake of Mercury remains a legal paid attack despite its self-revival effect',()=>{
 for(const seq of [1,0]){
  const w=world('wheel_of_fortune',seq),s=skill(w,'snake_of_mercury');
  assert(g.battleAIReady(w.a,w.actor,w.enemy,w.state,s));
  assert(evaluate(w,'snake_of_mercury').damage>0);
  for(const other of g.activeSpecs(w.a,w.actor,w.state))if(other.effectId!=='snake_of_mercury')w.a.cooldowns[other.effectId]=99;
  const action=choose(w);assert.equal(action.spec?.effectId,'snake_of_mercury');
  const before=w.a.sp;g.powerEffect(w.a,w.actor,w.enemy,w.state,[],()=>.99);
  assert.equal(before-w.a.sp,s.costSP);assert(w.actor._fateSkin);
  w.actor._formUsed=w.a._formUsed=true;
  const fatal=g.resolveIncoming(w.enemy,w.actor,w.actor.maxHp*100,w.state,[],()=>.99,{indirect:true,trueDamage:true});
  assert(fatal.revived&&w.actor.alive);assert.equal(w.actor.hp,Math.round(w.actor.maxHp*.1));assert(!w.actor._fateSkin);
  assert(/fate skin/.test(g.abilityDescription(s,w.a.path,seq)));
 }
});
for(const path of g.PATH_KEYS)test(path+' selection is deterministic, read-only and legal across all Sequences',()=>{
 for(let seq=9;seq>=0;seq--){const w=world(path,seq);g.setMeterValue(w.a,path,100);const before=snapshot(w),x=choose(w),again=choose(w);assert.equal(x.kind,again.kind);assert.equal(x.spec?.effectId,again.spec?.effectId);assert.equal(x.score,again.score);assert.equal(snapshot(w),before,'selection must not spend or initialize runtime state');assert(Number.isFinite(x.score));if(x.kind==='ability')assert(g.battleAIReady(w.a,w.actor,w.enemy,w.state,x.spec));if(x.kind==='thread')assert(g.battleAIThreadCandidate(g.battleAIContext(w.a,w.actor,w.enemy,w.state,{})));}
});
test('same state gives the same action and score after swapping battle sides',()=>{for(const path of g.PATH_KEYS){const w=world(path,3),before=choose(w);[w.state.allies,w.state.enemies]=[w.state.enemies,w.state.allies];const after=choose(w);assert.equal(after.kind,before.kind,path);assert.equal(after.spec?.effectId,before.spec?.effectId,path);assert.equal(after.score,before.score,path);}});
test('all unaffordable spells leave a genuine free basic candidate',()=>{const w=world('door',0);w.a.sp=0;assert.equal(choose(w).kind,'basic');assert.equal(g.chooseStructuredAbility(w.a,w.actor,w.enemy,w.state),null);});
test('silence and denied abilities cannot be selected',()=>{const w=world('door',0);g.addStatus(w.actor,'silenced',3,'foe');assert.equal(choose(w).kind,'basic');g.removeStatus(w.actor,'silenced');w.actor._signatureDeniedSkills={conceptual_unseal_seal:3};assert(!g.battleAIReady(w.a,w.actor,w.enemy,w.state,skill(w,'conceptual_unseal_seal')));assert.notEqual(choose(w).spec?.effectId,'conceptual_unseal_seal');});
test('rooted Escape and thread-target banishment are illegal',()=>{const w=world('door',3);g.addStatus(w.actor,'root',3,'foe');assert(!g.battleAIReady(w.a,w.actor,w.enemy,w.state,skill(w,'spatial_concealment')));const hi=world('door',2);hi.enemy.thread={ownerId:'friendly',progress:2};assert(!g.battleAIReady(hi.a,hi.actor,hi.enemy,hi.state,skill(hi,'spatial_exile')));});
test('actual stat scaling can reverse raw multiplier rankings',()=>{const w=world('death',8);w.a.stats.atk=500;w.a.stats.int=10;const c=g.battleAIContext(w.a,w.actor,w.enemy,w.state,{});const low={type:'active',id:'physical_probe',costSP:1,damage:{formula:'empowered_hybrid_physical',scaling:'ATK',multiplier:1,type:'physical'},effects:[]},high={...low,id:'caster_probe',damage:{formula:'pure_caster_ability',scaling:'INT',multiplier:3,type:'physical'}};assert(g.battleAIEvaluate(c,low).damage>g.battleAIEvaluate(c,high).damage);});
test('expected basic calculation uses the category calculator and includes weapon mastery',()=>{const w=world('sun',9);w.enemy.hp=w.enemy.maxHp=1e6;w.enemy.stats.def=1;w.a.stats.atk=5;w.a.stats.int=500;const base=g.battleAIBasicDamage(w.a,w.actor,w.enemy,w.state);assert(base>100,'Caster basic must scale from INT');w.a.weaponMastery.unarmed=10;assert(g.battleAIBasicDamage(w.a,w.actor,w.enemy,w.state)>base);});
test('guaranteed authored Evade makes damage zero while a full-duration protective effect keeps value',()=>{const w=world('door',5);g.addStatus(w.enemy,'evade',2,'foe',{dodgeRate:1});assert.equal(g.battleAIHitChance(w.a,w.actor,w.enemy),0);assert.equal(evaluate(w,'blink_strike').damage,0);g.removeStatus(w.enemy,'evade');const c=g.battleAIContext(w.a,w.actor,w.enemy,w.state,{}),s={type:'active',id:'protected_probe',costSP:0,effects:[{type:'status',status:'evade',dodgeRate:1,duration:1}]};const one=g.battleAIEvaluate(c,s).defense;s.effects[0].duration=3;assert.equal(g.battleAIEvaluate(c,s).defense,one*3);});
test('normal recovery preview respects healing output, received modifiers and missing HP',()=>{const w=world('moon',9);w.actor.hp=w.actor.maxHp-7;assert.equal(g.battleAIPreviewHeal(w.actor,w.actor,10000,w.state),7);g.addStatus(w.actor,'no_heal',3,'foe');assert.equal(g.battleAIPreviewHeal(w.actor,w.actor,10000,w.state),0);});
test('Origin of Life retains damage after its one recovery is used',()=>{const w=world('mother',0);w.actor.hp=Math.round(w.actor.maxHp*.25);const unused=evaluate(w,'origin_of_life');assert(unused.heal>0);const e=skill(w,'origin_of_life').effects.find(e=>e.type==='heal');w.actor._signatureOnceHeals={[e.oncePerBattle]:true};const used=evaluate(w,'origin_of_life');assert.equal(used.heal,0);assert(used.damage>0);assert(used.score<unused.score);});
test('Mother values seed recovery only for actual wounded allies or useful renewal',()=>{const w=world('mother',6);g.setMeterValue(w.a,'mother',0);const full=evaluate(w,'life_seed');assert.equal(full.heal,0);assert(full.damage>0);w.actor.hp=Math.round(w.actor.maxHp*.5);const hurt=evaluate(w,'life_seed');assert(hurt.heal>0);w.actor._signatureSeedTargetId=w.actor.id;w.actor._signatureSeed={ownerId:w.actor.id,turns:3,amount:.08};assert.equal(evaluate(w,'life_seed').heal,0);});
test('Sun avoids empty purification and values genuine harmful cleanse',()=>{const w=world('sun',7);const clean=evaluate(w,'purification_halo');assert.equal(clean.heal+clean.cleanse+clean.strip,0);g.addStatus(w.actor,'poison',3,'foe');const poisoned=evaluate(w,'purification_halo');assert(poisoned.cleanse>0);assert(poisoned.score>clean.score);});
test('Notarize and Abolish earn stripping only for protection actually present',()=>{for(const [p,id]of [['sun','notarize'],['black_emperor','abolish_rules']]){const w=world(p,p==='sun'?6:1),clear=evaluate(w,id);assert.equal(clear.strip,0);w.enemy.shield=w.enemy.maxHp*.2;assert(evaluate(w,id).strip>0);}});
test('Justiciar judges witnessed support without inspecting an unobserved inventory',()=>{const w=world('justiciar',6);const unseen=evaluate(w,'interdiction_zone');assert.equal(unseen.control,0);const heal=g.tierFor('moon',9).abilities[0];w.state._abilityHistoryByUnit={[w.enemy.id]:[{spec:heal,sequence:9,round:1}]};assert(evaluate(w,'interdiction_zone').control>0);});
test('a mixed heal remains a legal attack under no-heal',()=>{const w=world('abyss',5);g.addStatus(w.actor,'no_heal',3,'foe');w.actor.hp=Math.round(w.actor.maxHp*.3);const s=skill(w,'corrupted_flesh');assert(g.battleAIReady(w.a,w.actor,w.enemy,w.state,s));assert.equal(evaluate(w,'corrupted_flesh').heal,0);});
test('Time Theft waits for pending actions and Error spends normally on its follow-up',()=>{const w=world('error',1);w.enemy._actedThisRound=true;assert(!g.battleAIReady(w.a,w.actor,w.enemy,w.state,skill(w,'time_theft')));w.enemy._actedThisRound=false;const action=choose(w,{origin:'native_extra'});assert(action.kind==='basic'||action.damage>0);const sp=w.a.sp;g.powerEffect(w.a,w.actor,w.enemy,w.state,[],()=>.99,{origin:'native_extra'});const cast=w.state.events.find(e=>e.type==='cast'&&e.actorId===w.actor.id);assert(cast);if(cast.costSP>0){assert.equal(w.a.sp,sp-cast.costSP);assert(w.a.cooldowns[cast.abilityId]>0);}else assert.equal(w.a.sp,sp);});
test('Moon commands only one actual prepared beast strike, and handles an empty collection',()=>{const w=world('moon',8);g.ensurePathwayInventory(w.a);const empty=evaluate(w,'beast_command');assert(empty.damage>0);assert.equal(empty.command,0);prepared(w);const beast=w.state.allies.find(u=>u._assetOwnerId===w.actor.id);assert(beast);const ready=evaluate(w,'beast_command');assert(ready.command>0);assert.equal(ready.damage,0);beast._assetBeastCommand=1.5;assert.equal(evaluate(w,'beast_command').command,0);assert.equal(choose(w).kind,'basic');});
test('Paragon values a real device mark and does not fabricate one',()=>{const w=world('paragon',6);const empty=evaluate(w,'alchemical_fire');assert(empty.damage>0);assert.equal(empty.command,0);prepared(w);const full=evaluate(w,'alchemical_fire');assert(full.command>=0);const device=w.state.allies.find(u=>u._assetOwnerId===w.actor.id);device._assetFireCommand={targetId:w.enemy.id,penetration:.2};assert.equal(evaluate(w,'alchemical_fire').command,0);});
test('Death cannot summon empty or Hold inventory and evaluates an owned spirit',()=>{const w=world('death',7);g.ensurePathwayInventory(w.a);assert(!g.battleAIReady(w.a,w.actor,w.enemy,w.state,skill(w,'necromancy_summon')));prepared(w);assert(g.battleAIReady(w.a,w.actor,w.enemy,w.state,skill(w,'necromancy_summon')));assert(evaluate(w,'necromancy_summon').summon>0);w.a.pathwayInventory.policy='hold';assert(!g.battleAIReady(w.a,w.actor,w.enemy,w.state,skill(w,'necromancy_summon')));});
test('Hanged Man compares prepared soul effects and rejects manifested passive redundancy',()=>{const w=prepared(world('hanged_man',5));g.setMeterValue(w.a,'hanged_man',100);const souls=g.pathwayAssetAbilities(w.a,w.actor,w.state);assert(souls.length>0);for(const s of souls){const x=g.battleAIEvaluate(g.battleAIContext(w.a,w.actor,w.enemy,w.state,{}),s);assert(Number.isFinite(x.score));if(s.effects.some(e=>e.action==='manifest_soul')){w.a._assetManifestation={assetId:s._assetId,turns:2,effects:[]};assert(!g.battleAIReady(w.a,w.actor,w.enemy,w.state,s));delete w.a._assetManifestation;}}});
test('Door evaluates the actual stored first record without consuming it',()=>{const w=prepared(world('door',5));g.setMeterValue(w.a,'door',100);const before=snapshot(w);assert(w.a._signatureRecords.length);const x=evaluate(w,'combat_record');assert(x.copy);assert(x.damage+x.defense+x.heal+x.setup+x.control>0);assert.equal(snapshot(w),before);});
test('White Tower cannot imitate a spell until it is witnessed twice',()=>{const w=world('white_tower',6),s=skill(w,'spell_imitation'),observed=g.tierFor('tyrant',8).abilities[0];g.setMeterValue(w.a,'white_tower',100);w.state._abilityHistoryByUnit={[w.enemy.id]:[{spec:observed,sequence:8}]};assert(!g.battleAIReady(w.a,w.actor,w.enemy,w.state,s));w.state._abilityHistoryByUnit[w.enemy.id].push({spec:observed,sequence:8});assert(g.battleAIReady(w.a,w.actor,w.enemy,w.state,s));assert(evaluate(w,'spell_imitation').copy);});
test('Fool can choose binding only for real free slots, range and payment',()=>{const w=world('fool',5);const c=()=>g.battleAIContext(w.a,w.actor,w.enemy,w.state,{});assert(g.battleAIThreadCandidate(c()));w.enemy.distance=100;assert.equal(g.battleAIThreadCandidate(c()),null);w.enemy.distance=5;w.a.sp=0;assert.equal(g.battleAIThreadCandidate(c()),null);w.a.sp=g.maxSPFor(w.a);prepared(w);assert.equal(g.battleAIThreadCandidate(c()),null,'prepared army occupies its shared cap');});
test('Tyrant does not invent a second-target lightning chain in solo battle',()=>{const w=world('tyrant',6);g.setMeterValue(w.a,'tyrant',100);w.enemy._signatureSoaked={turns:2};const solo=evaluate(w,'lightning_bolt');const other=g.makeCombatUnit(hero('sun',6,'other'));w.state.enemies.push(other);assert(evaluate(w,'lightning_bolt').damage>solo.damage);});
test('Wheel rewind does not receive imaginary HP benefit or reset cooldowns',()=>{const w=world('wheel_of_fortune',2);w.state.currentRound=4;w.actor._signatureHistory=[{round:2,hp:Math.round(w.actor.hp*.5),fx:[]}];g.setMeterValue(w.a,'wheel_of_fortune',0);const before=snapshot(w),x=evaluate(w,'reincarnation_loop');assert.equal(x.heal,0);assert(x.risk>0);assert.equal(snapshot(w),before);});
test('Red Priest command earns more payoff from actual allied attackers',()=>{const w=world('red_priest',3);g.setMeterValue(w.a,'red_priest',100);const solo=evaluate(w,'war_command');w.state.allies.push(g.makeCombatUnit(hero('tyrant',3,'friend')));assert(evaluate(w,'war_command').setup>solo.setup);});
test('Demoness cannot count fresh curse ticks on an already cursed target',()=>{const w=world('demoness',7);assert(evaluate(w,'witch_s_curse').dot>0);g.addStatus(w.enemy,'curse',3,'owner');assert.equal(evaluate(w,'witch_s_curse').dot,0);});
test('Darkness does not value resisted sleep against an immune enemy',()=>{const w=world('darkness',8,'darkness');assert.equal(evaluate(w,'midnight_requiem').control,0);});
test('prepared collections and commands remain untouched by repeated AI preview',()=>{for(const p of ['fool','door','hanged_man','death','paragon','moon','hermit','white_tower','visionary']){const w=prepared(world(p,3));g.setMeterValue(w.a,p,100);w.actor.hp=Math.round(w.actor.maxHp*.5);const before=snapshot(w);choose(w);choose(w,{origin:'native_extra'});assert.equal(snapshot(w),before,p);}});
test('catalog Fate\'s Debt teammates stay read-only during signature healing previews',()=>{
 for(const path of ['moon','mother','error']){
  const w=world(path,6),ally=g.makeCombatUnit(hero('sun',6,'teammate'));
  Object.assign(ally.agent,{traitId:'fates_debt',traitSource:'catalog_v1',traitTier:'legendary'});delete ally.agent._traitState;
  ally.hp=Math.round(ally.maxHp*.2);w.state.allies.push(ally);g.setMeterValue(w.a,path,100);
  const before=snapshot(w);choose(w);choose(w,{origin:'native_extra'});assert.equal(snapshot(w),before,path+' must not initialize a teammate trait runtime');assert.equal(ally.agent._traitState,undefined);
  ally.agent._traitState={turns:2,healBlockedUntil:3};const blocked=snapshot(w);choose(w);assert.equal(snapshot(w),blocked);assert.equal(g.battleAIPreviewHeal(w.actor,ally,1000,w.state),0);
 }
});
test('all catalog traits preserve chooser purity on owners and visible opponents',()=>{
 for(const traitId of Object.keys(g.TRAIT_DATA.entries))for(const path of g.PATH_KEYS){
  const w=world(path,5);
  for(const u of [w.actor,w.enemy]){Object.assign(u.agent,{traitId,traitSource:'catalog_v1',traitTier:g.TRAIT_DATA.entries[traitId].tier});delete u.agent._traitState;}
  w.actor.hp=Math.round(w.actor.maxHp*.3);g.setMeterValue(w.a,path,100);
  const before=snapshot(w);choose(w);assert.equal(snapshot(w),before,path+' / '+traitId+' must not create runtime, spend a budget or change combat state');
 }
});

test('a charged seed uses its authored 1.5 multiplier and cannot renew an equal strong seed for imaginary healing',()=>{
 const w=world('mother',6);w.actor.hp=Math.round(w.actor.maxHp*.2);g.setMeterValue(w.a,'mother',100);
 const e=skill(w,'life_seed').effects.find(e=>e.rule==='mother_seed'),amount=e.amount*e.chargedMultiplier;
 const expected=g.battleAIPreviewHeal(w.actor,w.actor,w.actor.maxHp*amount,w.state)*Math.min(2,e.duration);
 assert.equal(evaluate(w,'life_seed').heal,expected);
 w.actor._signatureSeedTargetId=w.actor.id;w.actor._signatureSeed={ownerId:w.actor.id,turns:2,amount};
 assert.equal(evaluate(w,'life_seed').heal,0);
});
test('contagion counts feeding hosts but shares the owner healing cap and remaining round budget',()=>{
 const w=world('error',4);w.actor.hp=Math.round(w.actor.maxHp*.1);g.setMeterValue(w.a,'error',100);
 const e=skill(w,'parasitic_contagion').effects.find(e=>e.rule==='error_parasite'),cap=Math.floor(w.actor.maxHp*e.healingRoundCap);
 const one=evaluate(w,'parasitic_contagion');assert.equal(one.heal,cap*2);
 for(let n=0;n<3;n++)w.state.enemies.push(g.makeCombatUnit(hero('tyrant',4,'host'+n)));
 assert.equal(evaluate(w,'parasitic_contagion').heal,one.heal,'extra hosts must not multiply capped recovery');
 w.actor._signatureParasiteHealing={round:1,used:cap};assert.equal(evaluate(w,'parasitic_contagion').heal,cap);
 for(const h of w.state.enemies)h.agent.sp=0;
 assert.equal(evaluate(w,'parasitic_contagion').heal,0);assert.equal(evaluate(w,'parasitic_contagion').setup,0);
});
test('copied source payment, source cooldown and source category remain legal selection requirements',()=>{
 const w=world('door',6);g.setMeterValue(w.a,'door',100);
 const source={type:'active',id:'source_physical',effectId:'source_physical',name:'Source strike',costSP:37,cooldown:2,effects:[],damage:{formula:'empowered_hybrid_physical',scaling:'ATK',multiplier:4,type:'true'}};
 w.a._signatureRecords=[{spec:source,sourceId:'real_source',sequence:6}];
 const record=skill(w,'combat_record');w.a.sp=36;
 assert(!g.battleAIReady(w.a,w.actor,w.enemy,w.state,record),'wrapper cost must not hide original payment');
 w.a.sp=37;assert(g.battleAIReady(w.a,w.actor,w.enemy,w.state,record));
 w.a.cooldowns['record:source_physical']=1;assert(!g.battleAIReady(w.a,w.actor,w.enemy,w.state,record));
 delete w.a.cooldowns['record:source_physical'];
 const direct=g.battleAIDamage(w.a,w.actor,w.enemy,w.state,source),x=evaluate(w,'combat_record');assert.equal(x.damage,direct);
 assert.equal(w.a._signatureRecords[0].spec.damage.formula,'empowered_hybrid_physical');
});
test('Error can spend a borrowed source skill on its native extra action, with original SP and cooldown',()=>{
 const w=world('error',5);const source={type:'active',id:'paid_source',effectId:'paid_source',name:'Paid source',costSP:37,cooldown:2,effects:[],damage:{formula:'empowered_hybrid_physical',scaling:'ATK',multiplier:8,type:'true'}};
 w.a._signatureBorrowed={spec:source,sourceId:'victim',sequence:5};w.a.sp=37;
 for(const s of g.activeSpecs(w.a,w.actor,w.state))if(!s._signatureOwned)w.a.cooldowns[s.effectId||s.id]=99;
 const before=snapshot(w),action=choose(w,{origin:'native_extra'});assert.equal(action.spec?._signatureOwned,'error');assert.equal(snapshot(w),before);
 g.powerEffect(w.a,w.actor,w.enemy,w.state,[],()=>.99,{origin:'native_extra'});
 const cast=w.state.events.find(e=>e.type==='cast'&&e.actorId===w.actor.id);assert.equal(cast.costSP,37);assert.equal(cast.abilityId,'error:paid_source');
 assert.equal(w.a.sp,0);assert.equal(w.a.cooldowns['error:paid_source'],3);assert.equal(w.a._signatureBorrowed,null);
 assert.equal(choose(w,{origin:'native_extra'}).kind,'basic','exhausted paid action must fall back to a real basic');
});
test('native offense buffs are valued by ATK and INT contribution rather than giving both full credit',()=>{
 for(const [path,atk,int]of [['tyrant',1.05,.30],['darkness',.85,.55],['sun',0,1]]){
  const w=world(path,9);w.a.stats.atk=300;w.a.stats.int=100;
  const c=g.battleAIContext(w.a,w.actor,w.enemy,w.state,{}),probe=stat=>({type:'active',id:'buff_'+stat,costSP:0,effects:[{type:'buff',stat,amount:.2,duration:2}]}),total=300*atk+100*int;
  const av=g.battleAIEvaluate(c,probe('atk')).setup,iv=g.battleAIEvaluate(c,probe('int')).setup;
  assert(Math.abs(av-c.unit*.4*(300*atk/total))<1e-8,path+' ATK fraction');
  assert(Math.abs(iv-c.unit*.4*(100*int/total))<1e-8,path+' INT fraction');
  assert(Math.abs(av+iv-c.unit*.4)<1e-8,path+' fractions must sum to one');
 }
});
test('timed lifesteal earns at most two upcoming basic impacts and no duplicate active gain',()=>{
 const w=world('moon',5);w.actor.hp=1;const c=g.battleAIContext(w.a,w.actor,w.enemy,w.state,{}),probe={type:'active',id:'lifesteal_probe',costSP:0,effects:[{type:'lifesteal',ratio:.28,duration:1}]};
 const one=g.battleAIEvaluate(c,probe).heal;assert.equal(one,g.battleAIPreviewHeal(w.actor,w.actor,c.basic*.28,w.state));
 probe.effects[0].duration=2;const two=g.battleAIEvaluate(c,probe).heal;assert.equal(two,g.battleAIPreviewHeal(w.actor,w.actor,c.basic*.28*2,w.state));
 probe.effects[0].duration=8;assert.equal(g.battleAIEvaluate(c,probe).heal,two,'bounded horizon avoids imaginary long-fight healing');
 w.actor._lifestealBonus=.28;assert.equal(g.battleAIEvaluate(c,probe).heal,0,'same active buff has no marginal gain');
 g.addStatus(w.actor,'no_heal',2,'foe');delete w.actor._lifestealBonus;assert.equal(g.battleAIEvaluate(c,probe).heal,0);
});
test('expected damage matches actual paid strikes across categories, source formulas, components and shields',()=>{
 for(const [path,formula]of [['tyrant','empowered_hybrid_physical'],['darkness','empowered_hybrid_agility'],['sun','pure_caster_ability']]){
  const w=world(path,9,'door');w.enemy.hp=w.enemy.maxHp=1e6;w.enemy.shield=50;
  const spec={type:'active',id:'damage_probe',effectId:'damage_probe',name:'Damage probe',costSP:1,cooldown:0,damage:{formula,scaling:'ATK',multiplier:1.6,type:'physical'},effects:[{type:'damage_component',stat:'INT',multiplier:.3}]};
  const preview=g.battleAIDamage(w.a,w.actor,w.enemy,w.state,spec),hit=g.battleAIHitChance(w.a,w.actor,w.enemy),rates=g.combatRates(w.a,w.actor);
  const actual=crit=>{const clone=structuredClone(w),rolls=[.99,.99,crit?0:.99];assert(g.applyStructuredAbility(clone.a,clone.actor,clone.enemy,clone.state,[],()=>rolls.length?rolls.shift():.99,spec));return clone.state.events.find(e=>e.type==='damage'&&e.actorId===clone.actor.id).amount;};
  const expected=hit*((1-rates.crit)*actual(false)+rates.crit*actual(true));
  assert(Math.abs(preview-expected)<=2,path+' expected impact '+preview+' vs '+expected);
 }
});
test('an empty Moon command previews the actual category basic route rather than its synthetic ATK spec',()=>{
 const w=world('moon',8);g.ensurePathwayInventory(w.a);w.enemy.hp=w.enemy.maxHp=1e6;w.a.stats.atk=10;w.a.stats.int=800;
 const spec=skill(w,'beast_command'),preview=evaluate(w,'beast_command').damage,hit=g.battleAIHitChance(w.a,w.actor,w.enemy,true),rates=g.combatRates(w.a,w.actor);
 const actual=crit=>{const clone=structuredClone(w),rolls=[.99,.99,crit?0:.99];assert(g.applyStructuredAbility(clone.a,clone.actor,clone.enemy,clone.state,[],()=>rolls.length?rolls.shift():.99,spec));return clone.state.events.find(e=>e.type==='damage'&&e.actorId===clone.actor.id).amount;};
 const expected=hit*((1-rates.crit)*actual(false)+rates.crit*actual(true));assert(Math.abs(preview-expected)<=2,preview+' vs '+expected);assert(preview>1000);
});
console.log(`Pathway AI: ${passed} passed; ${failed} failed.`);if(failed)process.exitCode=1;
