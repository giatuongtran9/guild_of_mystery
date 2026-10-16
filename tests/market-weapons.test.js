'use strict';
const {g,assert,world}=require('./phase3-test-helpers');
function battle(id){const w=world('fool',9);w.a.weaponId=id;w.u.hp=w.u.maxHp=100000;w.v.hp=w.v.maxHp=1000000;w.a.sp=g.maxSPFor(w.a);g.bindBattle(w.state,[]);return w;}
for(const base of ['knife','club','sword','pistol','revolver']){const normal=g.WEAPONS[base];for(const tier of ['rare','epic','legendary']){const item=g.WEAPONS[tier+'_'+base];assert(item.atk>normal.atk);assert(item.price>normal.price);assert.equal(item.kind,normal.kind);if(tier!=='rare')assert(item.rule&&item.text);}}
for(const id of ['epic_revolver','legendary_revolver']){const w=battle(id),before=w.u.hp;assert(g.attackOnce(w.a,w.u,w.v,w.state,[],()=>.99));assert(w.u.hp<before&&w.u.hp>0);const after=w.u.hp;g.attackOnce(w.a,w.u,w.v,w.state,[],()=>.99);assert.equal(w.u.hp,after,'recoil is once per battle');assert(w.state.events.some(e=>e.subtype==='weapon'));}
{
 const w=battle('epic_revolver');
 g.addStatus(w.u,'curse',1,w.v.name);
 g.processStatuses(w.u,()=>{},w.state,false);
 const before=w.u.hp;
 assert(g.attackOnce(w.a,w.u,w.v,w.state,[],()=>.99));
 assert.equal(before-w.u.hp,Math.ceil(w.u.maxHp*.02),'opening recoil still costs exactly 2% Max HP');
 const rows=g.groupEventsToRows(w.state.events).flatMap(round=>round.rows);
 const curse=rows.find(row=>row.ability==='Curse'),weapon=rows.find(row=>row.ability==='Runebore Revolver');
 assert(curse&&weapon,'the periodic tick and the weapon attack remain separate rows');
 assert(!curse.subrows.some(note=>note.text?.includes('recoil')),'recoil cannot attach to the previous Curse tick');
 const recoil=weapon.timeline.findIndex(step=>step.event.text?.includes('recoil costs'));
 const damage=weapon.timeline.findIndex(step=>step.type==='damage');
 assert(recoil>=0&&damage>recoil,'opening recoil appears inside the weapon row, before its direct damage');
 const castIndex=w.state.events.findIndex(event=>event.type==='cast'&&event.ability==='Runebore Revolver');
 const recoilIndex=w.state.events.findIndex(event=>event.text?.includes('recoil costs'));
 assert(castIndex>=0&&recoilIndex>castIndex,'the successful attack opens before pre-attack weapon hooks');
}
for(const id of ['epic_pistol','legendary_pistol']){const w=battle(id);g.attackOnce(w.a,w.u,w.v,w.state,[],()=>.99);assert(w.state.events.some(e=>e.type==='damage'&&e.actorId===w.u.id&&e.critical));const spell=g.tierFor('fool',8).abilities[0];assert(g.effectiveAbilityCost(w.a,spell)>spell.costSP);}
for(const id of ['epic_sword','legendary_sword']){const w=battle(id);if(id.startsWith('legendary'))w.u.hp=Math.round(w.u.maxHp*.3);const before=w.u.hp;g.resolveIncoming(w.v,w.u,100,w.state,[],()=>.99,{damageType:'physical'});assert(w.u.hp===before,'a real shield absorbs the hit');assert(w.state.events.some(e=>e.subtype==='weapon'&&e.text.includes('shield')));const count=w.state.events.filter(e=>e.subtype==='weapon').length;g.resolveIncoming(w.v,w.u,100,w.state,[],()=>.99,{damageType:'physical'});assert.equal(w.state.events.filter(e=>e.subtype==='weapon').length,count);}
let w=battle('epic_knife'),roll=0;g.attackOnce(w.a,w.u,w.v,w.state,[],()=>++roll===4?.1:.99);assert(g.hasStatus(w.v,'poison'));assert(g.passiveCombatModifier(w.a).damageTaken>1);
w=battle('legendary_knife');w.u.hp=Math.round(w.u.maxHp*.5);const hp=w.u.hp;g.attackOnce(w.a,w.u,w.v,w.state,[],()=>.99);assert(w.u.hp>hp);assert(g.hasStatus(w.v,'curse'));assert(g.passiveCombatModifier(w.a).def<1);
w=battle('epic_club');const slow=g.speedFor(w.a);w.a.weaponId='club';assert(g.speedFor(w.a)>slow);w.a.weaponId='epic_club';g.attackOnce(w.a,w.u,w.v,w.state,[],()=>.99);assert(w.v._debuffs.def<1);
w=battle('legendary_club');w.v.shield=300000;g.attackOnce(w.a,w.u,w.v,w.state,[],()=>.99);assert(w.v.shield<100000);assert(w.v._vulnerability>1);
const source=g.makeAgent(()=>.5,{path:'fool',sequence:9,trait:'Stout Vitality'});source.weaponId='legendary_pistol';g.restatAgent(source);const original=JSON.stringify(source);const unit=g.makeCombatUnit(source);g.attackOnce(unit.agent,unit,battle('club').v,{allies:[unit],enemies:[],events:[],balanceTrace:[],weaponUsage:{},currentRound:1},[],()=>.99);assert.equal(JSON.stringify(source),original,'equipment effects do not mutate the persistent source');assert(!g.makeCombatUnit(unit.agent).agent._weaponState,'opening triggers reset in the next encounter');
g.bindBattle(null);console.log('Market weapons passed: all five families, ten distinct Epic/Legendary rules, paid drawbacks, real damage/shield/status effects, source immutability and encounter reset.');
