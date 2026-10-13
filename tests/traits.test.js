'use strict';
const assert=require('node:assert/strict');
const g=require('../js/node-loader');
require('./mechanics-fixture')(g);
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){console.error('FAIL '+name);throw e;}}
function agent(id,traitId=null,path='paragon',sequence=9){
 const a=g.makeAgent(()=>.5,{path,sequence,recommendedPath:path==='door'?'sun':'door',...(traitId?{traitId}:{trait:'Stout Vitality'})});
 a.id=id;a.name=id;a.awakened=true;g.restatAgent(a);a.sp=g.maxSPFor(a);a.maxSP=a.sp;return a;
}
function fixture(id,extra=false){
 const a=agent('hero',id);a.stats={hp:500,atk:100,def:20,int:100};a.baseStats={...a.stats};
 const b=agent('foe');b.stats={hp:5000,atk:10,def:20,int:30};b.baseStats={...b.stats};
 const hero=g.makeCombatUnit(a),foe=g.makeCombatUnit(b),ally=g.makeCombatUnit({...agent('friend'),stats:{hp:500,atk:20,def:20,int:30}});
 const state={allies:extra?[hero,ally]:[hero],enemies:[foe],events:[],balanceTrace:[],weaponUsage:{},currentRound:1,currentTurn:1,rng:()=>.4,traitDeployment:{ally:extra?2:1,enemy:1}};
 return {hero,foe,ally,state,lines:[]};
}
function spell(extra={}){return {id:'fixture_spell',effectId:'fixture_spell',name:'Fixture Spell',text:'Fixture Spell',type:'active',costSP:10,cooldown:1,damage:{scaling:'INT',multiplier:2,type:'elemental',element:'fire'},effects:[],...extra};}
function cast(w,spec=spell()){return g.applyStructuredAbility(w.hero.agent,w.hero,w.foe,w.state,w.lines,()=>.4,spec);}
function basic(w,r=()=>.4){return g.attackOnce(w.hero.agent,w.hero,w.foe,w.state,w.lines,r);}
function hit(w,damage,opt={}){return g.resolveIncoming(w.foe,w.hero,damage,w.state,w.lines,()=>.4,opt);}

test('catalog implements the 5/4/10/10 pools and the requested generation rates',()=>{
 assert.equal(Object.keys(g.TRAIT_DATA.entries).length,29);
 assert.deepEqual(g.TRAIT_DATA.weights,{normal:74,rare:20,epic:5,legendary:1});
 for(const [tier,n] of [['normal',5],['rare',4],['epic',10],['legendary',10]])assert.equal(Object.values(g.TRAIT_DATA.entries).filter(d=>d.tier===tier).length,n);
 for(const [n,t] of [[0,'normal'],[.739999,'normal'],[.74,'rare'],[.939999,'rare'],[.94,'epic'],[.989999,'epic'],[.99,'legendary'],[1,'legendary']])assert.equal(g.rollCatalogTrait(()=>n).traitTier,t);
 const broken=structuredClone(g.TRAIT_DATA);broken.entries.hardy.effect='made_up';assert.throws(()=>g.validateTraitCatalog(broken),/Unsupported trait/);
});
for(const [id,field,mult] of [['hardy','hp',1.08],['strong','atk',1.05],['resilient','def',1.08],['keen_mind','int',1.05],['quick','speed',1.05],['glass_cannon','atk',1.20],['ironclad','def',1.18],['swiftfoot','speed',1.18],['fervent_spirit','int',1.20]])test(id+' applies its distinct stat bonus once after awakening',()=>{
 const a=agent('stat',id),base=g.tableStats(a.path,9);
 if(field==='speed'){const raw={...a,traitSource:'legacy',trait:'Stout Vitality'};assert(Math.abs(g.speedFor(a)/g.speedFor(raw)-mult)<1e-9);}
 else assert.equal(a.stats[field],Math.round(base[field]*mult));
 const original={...a.stats};g.restatAgent(a);assert.deepEqual(a.stats,original);
 const human=g.makeAgent(()=>.5,{sequence:10,traitId:id});assert.equal(g.traitActive(human),false);assert.deepEqual(g.resolvedTraitModifiers(human),{});
});
test('Rare stat gains retain their real drawbacks and legacy values remain unchanged',()=>{
 const a=agent('rare','glass_cannon'),base=g.tableStats(a.path,9);assert.equal(a.stats.hp,Math.round(base.hp*.9));
 const old=agent('old');old.trait='Glass Cannon';delete old.traitSource;g.restatAgent(old);assert.equal(old.stats.atk,Math.round(base.atk*1.15));
 const fervent=agent('sp','fervent_spirit');assert.equal(g.maxSPFor(fervent),Math.round(g.spTableFor(fervent).max*1.15));
});
test('Wardbreaker refunds once for a real shield break and pays its HP penalty',()=>{
 const w=fixture('wardbreaker');w.hero.sp=0;g.grantShield(w.foe,10);basic(w);const refund=Math.round(w.hero.maxSP*.1);assert.equal(w.hero.sp,refund);
 g.grantShield(w.foe,10);basic(w);assert.equal(w.hero.sp,refund);
 const a=agent('a','wardbreaker');assert.equal(a.stats.hp,Math.round(g.tableStats(a.path,9).hp*.9));
});
test('Vengeful Echo empowers one damaging action and reduces received healing',()=>{
 const w=fixture('vengeful_echo');hit(w,30);const pending=w.hero._traitState.pendingBoost;assert.equal(pending,20);
 const before=w.foe.hp;basic(w);const empowered=before-w.foe.hp;const control=fixture('vengeful_echo');const old=control.foe.hp;basic(control);assert.equal(empowered,Math.round((old-control.foe.hp)*1.2));
 w.hero.hp=100;assert.equal(g.recoverHP(w.hero,100),75);assert.equal(w.hero._traitState.pendingBoost,0);
});
test('Runic Carapace charges the surcharge and grants one completed-cast shield',()=>{
 const w=fixture('runic_carapace'),old=w.hero.sp;assert(cast(w));assert.equal(old-w.hero.sp,12);assert.equal(w.hero.shield,40);
 w.hero.shield=0;w.hero.cooldowns={};assert(cast(w));assert.equal(w.hero.shield,0);
});
test('Cinder Touch applies bounded Burn and pays a DEF disadvantage',()=>{
 const w=fixture('cinder_touch');basic(w);assert(g.hasStatus(w.foe,'burn'));const a=agent('a','cinder_touch');assert.equal(a.stats.def,Math.round(g.tableStats(a.path,9).def*.9));
});
test('Nerve Pin slows the primary target for two holder turns and reduces ATK',()=>{
 const w=fixture('nerve_pin');assert(cast(w,spell({effects:[{type:'crit',amount:.9}]})));assert.equal(w.foe._traitState.nerveSlow.amount,.2);
 const slowed=g.speedFor(w.foe.agent);g.traitTurnEnd(w.foe,w.state,w.lines);assert.equal(g.speedFor(w.foe.agent),slowed);g.traitTurnEnd(w.foe,w.state,w.lines);assert(g.speedFor(w.foe.agent)>slowed);
 const a=agent('a','nerve_pin');assert.equal(a.stats.atk,Math.round(g.tableStats(a.path,9).atk*.92));
});
test('Merciful Touch weakens healing and cleanses only one ally DOT',()=>{
 const w=fixture('merciful_touch',true);w.ally.hp=10;g.addStatus(w.ally,'burn',3);g.addStatus(w.ally,'poison',2);
 assert.equal(g.recoverHP(w.ally,100,{source:w.hero,state:w.state,lines:w.lines}),80);assert(!g.hasStatus(w.ally,'burn'));assert(g.hasStatus(w.ally,'poison'));
 g.recoverHP(w.ally,100,{source:w.hero,state:w.state,lines:w.lines});assert(g.hasStatus(w.ally,'poison'));
});
test('Spiteful Shell reduces incoming shields and retaliates without a loop',()=>{
 const w=fixture('spiteful_shell');assert.equal(g.grantShield(w.hero,100),75);const hp=w.foe.hp;hit(w,90);assert(w.foe.hp<hp);assert.equal(w.state.events.filter(e=>e.subtype==='trait').length,1);
});
test('Break the Chain removes one remaining control after a lost action',()=>{
 const w=fixture('break_the_chain');g.addStatus(w.hero,'stunned',3);g.addStatus(w.hero,'bound',2);g.tickUnitStatuses(w.hero);g.traitTurnEnd(w.hero,w.state,w.lines,true);assert(!g.hasStatus(w.hero,'stunned'));assert(g.hasStatus(w.hero,'bound'));
 const a=agent('a','break_the_chain'),base={...a,traitSource:'legacy',trait:'Stout Vitality'};assert(Math.abs(g.speedFor(a)/g.speedFor(base)-.9)<1e-9);
});
test("Hunter's Opening makes one eligible attempted basic hit critical",()=>{
 const w=fixture('hunters_opening');basic(w);let hits=w.state.events.filter(e=>e.type==='damage'&&e.actorId===w.hero.id);assert.equal(hits[0].critical,true);
 w.foe.hp=w.foe.maxHp;basic(w);hits=w.state.events.filter(e=>e.type==='damage'&&e.actorId===w.hero.id);assert.equal(hits[1].critical,false);
});
test('Fractured Moment grants only one paid extra action in a real battle',()=>{
 const a=agent('burst','fractured_moment');a.stats={hp:5000,atk:20,def:100,int:10};const result=g.resolveQuest([a],{encounter:true,difficultySequence:9,rewards:{},name:'burst'},13,{authoredOpponents:[{path:'paragon',sequence:9,stats:{hp:5000,atk:10,def:10,int:10}}]});
 assert.equal(result.events.filter(e=>e.traitId==='fractured_moment').length,1);assert(result.events.filter(e=>e.type==='cast'&&e.actorId==='burst'&&e.round===1).length>=2);
 const w=fixture('fractured_moment');assert.equal(g.traitAbilityQuote(w.hero.agent,spell(),w.hero).amount,13);
});
test("Fate's Debt prevents one fatal hit but blocks healing and never blocks execution",()=>{
 const w=fixture('fates_debt');hit(w,9999);assert.equal(w.hero.hp,1);assert(w.hero.alive);assert.equal(w.hero.sp,0);assert.equal(g.recoverHP(w.hero,100),0);
 assert(!w.state.events.some(e=>e.type==='death'&&e.targetId===w.hero.id));hit(w,1);assert(!w.hero.alive);
 const x=fixture('fates_debt');hit(x,9999,{execute:true});assert(!x.hero.alive);
});
test("Martyr's Mantle redirects HP loss with a round cap and forbids shields",()=>{
 const w=fixture('martyrs_mantle',true);const hp=w.hero.hp;g.resolveIncoming(w.foe,w.ally,300,w.state,w.lines,()=>.4);assert.equal(hp-w.hero.hp,90);assert.equal(w.ally.hp,290);
 g.resolveIncoming(w.foe,w.ally,300,w.state,w.lines,()=>.4);assert.equal(hp-w.hero.hp,100);assert.equal(g.grantShield(w.hero,100),0);
});
test('Blood Script casts with HP at zero SP and cannot pay a lethal cost',()=>{
 const w=fixture('blood_script');w.hero.sp=0;const quote=g.traitAbilityQuote(w.hero.agent,spell(),w.hero),hp=w.hero.hp;assert.equal(quote.resource,'hp');assert(quote.ready);assert(cast(w));assert.equal(w.hero.hp,hp-quote.amount);assert.equal(w.hero.sp,0);assert.equal(g.recoverHP(w.hero,100),0);
 w.hero.cooldowns={};w.hero.hp=quote.amount;assert.equal(cast(w),false);
 assert(w.state.events.some(e=>e.type==='cast'&&e.costHP===quote.amount&&e.costSP===0));
});
test('Hollow Saint converts overhealing into capped wards, with no false heal event',()=>{
 const w=fixture('hollow_saint',true);const hp=w.ally.hp;assert.equal(g.recoverHP(w.ally,100,{source:w.hero,state:w.state,lines:w.lines}),0);assert.equal(w.ally.hp,hp);assert.equal(w.ally.shield,125);
 w.ally.shield=0;g.recoverHP(w.ally,100,{source:w.hero,state:w.state,lines:w.lines});assert.equal(w.ally.shield,0);
 w.state.currentRound=2;g.recoverHP(w.ally,100,{source:w.hero,state:w.state,lines:w.lines});assert.equal(w.ally.shield,125);
 w.hero.hp=10;assert.equal(g.recoverHP(w.hero,20,{source:w.ally,state:w.state,lines:w.lines}),20);
 assert(!w.state.events.some(e=>e.type==='heal'&&e.actorId===w.hero.id));
});
test('Unbroken Will spends SP once for simultaneous control without removing it',()=>{
 const w=fixture('unbroken_will');g.addStatus(w.hero,'stunned',2);g.addStatus(w.hero,'bound',2);const old=w.hero.sp;assert(g.traitCanActThroughControl(w.hero,w.state,w.lines));assert.equal(old-w.hero.sp,Math.ceil(w.hero.maxSP*.2));assert(g.actionDisabled(w.hero));
 assert(g.traitCanActThroughControl(w.hero,w.state,w.lines));assert.equal(old-w.hero.sp,Math.ceil(w.hero.maxSP*.2),'rechecking control does not charge twice');w.state.currentTurn++;w.hero.sp=0;assert.equal(g.traitCanActThroughControl(w.hero,w.state,w.lines),false);w.hero.sp=w.hero.maxSP;g.addStatus(w.hero,'banished',2);assert.equal(g.traitCanActThroughControl(w.hero,w.state,w.lines),false);
});
test('Lone Sovereign changes only an originally solo action schedule',()=>{
 const w=fixture('lone_sovereign');assert.equal(g.traitScheduledActions(w.hero,w.state),2);w.state.traitDeployment.ally=2;assert.equal(g.traitScheduledActions(w.hero,w.state),1);
 const a=agent('solo','lone_sovereign');a.stats={hp:5000,atk:20,def:100,int:10};const result=g.resolveQuest([a],{encounter:true,difficultySequence:9,rewards:{},name:'solo'},21,{authoredOpponents:[{path:'paragon',sequence:9,stats:{hp:5000,atk:10,def:10,int:10}}]});assert.equal(result.events.filter(e=>e.type==='cast'&&e.actorId==='solo'&&e.round===1).length,2);
});
test('Unbound Canticle expands only damage, keeps utility primary, and pays once',()=>{
 const w=fixture('unbound_canticle'),other=g.makeCombatUnit({...agent('second'),stats:{hp:5000,atk:10,def:20,int:30}});w.state.enemies.push(other);const before=w.hero.sp;
 assert(cast(w,spell({effects:[{type:'status',status:'poison',duration:2}]})));assert(w.foe.hp<w.foe.maxHp&&other.hp<other.maxHp);assert(g.hasStatus(w.foe,'poison'));assert(!g.hasStatus(other,'poison'));assert.equal(before-w.hero.sp,18);
 assert.equal(w.state.events.filter(e=>e.type==='cast'&&e.actorId===w.hero.id).length,1);
});
test('Spell Eater disables actives and caps SP burn/healing by actual removal',()=>{
 const w=fixture('spell_eater');w.hero.hp=10;assert.equal(cast(w),false);const sp=w.foe.sp;basic(w);assert.equal(sp-w.foe.sp,Math.round(w.foe.maxSP*.1));assert(w.hero.hp>10);
 basic(w);const capped=w.foe.sp;basic(w);assert.equal(w.foe.sp,capped);assert(w.hero.hp-10<=Math.round(w.hero.maxHp*.05));
 w.state.currentRound=2;w.foe.sp=0;const hp=w.hero.hp;basic(w);assert.equal(w.hero.hp,hp);
});
test('Chronal Engine quotes and pays cooldown debt while excluding control spells',()=>{
 const w=fixture('chronal_engine');w.hero.cooldowns.fixture_spell=2;const before=w.hero.sp;assert.equal(g.traitAbilityQuote(w.hero.agent,spell(),w.hero).amount,18);assert(cast(w));assert.equal(before-w.hero.sp,18);assert.equal(w.hero.cooldowns.fixture_spell,2);
 const controlled=spell({effects:[{type:'status',status:'stunned',duration:1}]});assert.equal(g.traitAbilityQuote(w.hero.agent,controlled,w.hero).ready,false);assert.equal(cast(w,controlled),false);
});
test('Spirit Bastion spends its casting SP before HP and cannot receive shields',()=>{
 const w=fixture('spirit_bastion'),hp=w.hero.hp,sp=w.hero.sp;const first=hit(w,200);assert.equal(first.hpLoss,0);assert.equal(first.spAbsorbed,200);assert.equal(sp-w.hero.sp,Math.ceil(200/(w.hero.maxHp*.5)*w.hero.maxSP));assert.equal(w.hero.hp,hp);assert.equal(g.grantShield(w.hero,100),0);
 const remaining=w.hero.sp,capacity=Math.floor(w.hero.maxHp*.5*remaining/w.hero.maxSP);const second=hit(w,200);assert.equal(second.hpLoss,200-capacity);assert.equal(w.hero.sp,0);
});
for(const id of ['unbroken_will','chronal_engine','spirit_bastion'])test(id+' actually halves ongoing SP regeneration',()=>{
 const w=fixture(id);w.hero.sp=0;g.startRoundCombatResources([w.hero],w.lines);assert.equal(w.hero.sp,Math.floor(g.spTableFor(w.hero.agent).regen*.5));
});
test('paid refresh charges exactly £50 for four saved candidates without advancing time',()=>{
 const s=g.newGame(),day=s.day,funds=s.funds,oldIds=s.recruitPool.map(a=>a.id);const result=g.refreshRecruitmentOffice(s,777);assert(result.ok);assert.equal(s.funds,funds-50);assert.equal(s.day,day);assert.equal(s.recruitPool.length,4);assert(s.recruitPool.every(a=>!oldIds.includes(a.id)));
 const before=structuredClone(s);s.funds=49;const low=structuredClone(s);assert(!g.refreshRecruitmentOffice(s,111).ok);assert.deepEqual(s,low);
 s.funds=before.funds;const selected=s.recruitPool[2],id=selected.id;assert(g.hireRecruitmentCandidate(s,id).ok);assert.equal(s.roster[0].traitId,selected.traitId);assert.equal(s.recruitPool.length,3);assert(!g.hireRecruitmentCandidate(s,id).ok);
 for(const a of [...s.recruitPool]){s.funds=1000;assert(g.hireRecruitmentCandidate(s,a.id).ok);}assert.equal(s.recruitPool.length,4);
});
test('schema migration preserves new identities, old effects, pending data, and removes budgets',()=>{
 const s=g.newGame();s.schema=10;const old=agent('old');old.trait='Glass Cannon';g.restatAgent(old);const stats={...old.stats};const modern=agent('new','fates_debt');modern._traitState={fateUsed:true};s.roster=[old,modern];const pool=s.recruitPool.map(a=>a.traitId);
 const migrated=g.migrateSave(structuredClone(s));assert.deepEqual(migrated.roster[0].stats,stats);assert.equal(migrated.roster[1].traitId,'fates_debt');assert.equal(migrated.roster[1]._traitState,undefined);assert.deepEqual(migrated.recruitPool.map(a=>a.traitId),pool);assert.deepEqual(g.migrateSave(structuredClone(migrated)),migrated);
 const future=structuredClone(modern);future.traitId='future_trait';assert(g.normalizeTrait(future));assert.equal(future.traitId,'future_trait');assert.match(g.traitDescription(future),/newer game version/);
});
test('all 29 traits execute in the real seeded battle engine and leave no saved budgets',()=>{
 for(const id of Object.keys(g.TRAIT_DATA.entries)){
  const a=agent('catalog-'+id,id);const result=g.resolveQuest([a],{encounter:true,difficultySequence:9,rewards:{},name:'catalog'},91,{individual:true});assert(result.battleOutcome,id);
  for(const c of result.consequences)if(c.agent)assert.equal(c.agent._traitState,undefined,id);
 }
});
console.log(`${passed} trait checks passed.`);
