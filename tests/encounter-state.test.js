'use strict';
const assert=require('node:assert/strict'),g=require('../js/node-loader');
const copy=x=>JSON.parse(JSON.stringify(x));
function conserve(s){for(const d of g.CONTRACT_POOL.definitions){const held=Number(s.pendingContract?.quest?.poolDefinitionId===d.id),posted=s.quests.filter(q=>q.poolDefinitionId===d.id&&q.id!==s.pendingContract?.quest?.id).length,cooling=s.contractPool.cooling.filter(c=>c.definitionId===d.id).length;assert.equal(s.contractPool.available[d.id]+held+posted+cooling,d.copies,d.id);}}
function finish(s,q){assert(g.reserveContractDispatch(s,q).ok);s.pendingContract={quest:copy(q),result:{success:true,consequences:[],marionettes:[],rewards:{funds:0,reputation:0,materials:{}}}};assert(g.settleContract(s).ok);conserve(s);}
const s=g.newGame();s.reputation=400;g.maintainGuildBoards(s);const day=s.day,quest=s.quests[0],size=s.quests.length,variant=copy(quest.encounterVariant);
assert(variant&&variant.name&&variant.description);const loaded=g.migrateSave(copy(s));assert.deepEqual(loaded.quests.find(q=>q.id===quest.id).encounterVariant,variant,'reload preserves the advertised encounter');
finish(s,quest);assert.equal(s.day,day);assert.equal(s.quests.length,size,'completing a contract immediately replaces its slot');assert(!s.quests.some(q=>q.id===quest.id));assert(s.contractPool.cooling.some(c=>c.definitionId===quest.poolDefinitionId&&c.readyDay===day+3));
// Unlimited actions cannot manufacture copies or bypass the three-real-day cooldown.
let completed=1;while(s.quests.length&&completed<300){finish(s,s.quests[0]);completed++;}
assert.equal(completed,196);assert.equal(s.day,day);assert.equal(s.contractPool.cooling.length,196);assert.equal(s.quests.length,0);assert.equal(Object.values(s.contractPool.available).reduce((n,v)=>n+v,0),0);const funds=s.funds;assert.equal(g.refreshContracts(s).ok,false);assert.equal(s.funds,funds,'an exhausted pool cannot charge a refresh fee');assert.equal(s.quests.length,0);
g.advanceGuildDay(s,0,g.dayjs(s.calendar.originDate).add(2,'day').valueOf());assert.equal(s.quests.length,0,'two days cannot return used copies');
g.advanceGuildDay(s,0,g.dayjs(s.calendar.originDate).add(3,'day').valueOf());assert.equal(s.contractPool.cooling.length,0);assert.equal(s.quests.length,size);conserve(s);assert(s.quests.some(q=>q.difficultySequence===9));
// Wanted rewards follow dispatched owners, including pathways outside the first roster slots.
const owner=path=>{const a=g.makeAgent(()=>.5,{path,sequence:9,trait:'Stout Vitality'});g.restatAgent(a);return a;},roster=['fool','door','tyrant','paragon','moon','hermit'].map(owner),wanted=g.makeWantedQuest(999,()=>.5,roster,'red_knife');
const rewards=g.wantedRewardsForParty(wanted,roster.slice(3));assert.deepEqual(Object.keys(rewards.materials).sort(),roster.slice(3).map(a=>g.pathOf(a.path).material).sort());assert(Object.values(rewards.materials).every(n=>n===2));assert.deepEqual(wanted.rewards.materials,{});
// A boss's DoT budget is separate from native PvP Poison and follows its source.
const victim=g.makeCombatUnit(owner('fool')),boss=g.makeBossEnemy(g.makeWantedQuest(999,()=>.5,roster,'black_mirror'),()=>.5),battle={allies:[victim],enemies:[boss],events:[],currentRound:1,rng:()=>.99};
boss.bossDefinition.statusDamageMultiplier=.65;g.addStatus(victim,'poison',2,boss.id);g.processStatuses(victim,()=>{},battle,false);const tick=battle.events.find(e=>e.isDot);assert.equal(tick.incoming,Math.round(victim.maxHp*.05*.65));
const ordinary=g.makeCombatUnit(owner('fool')),caster=g.makeCombatUnit(owner('demoness')),normalBattle={allies:[ordinary],enemies:[caster],events:[],currentRound:1,rng:()=>.99};
g.addStatus(ordinary,'poison',2,caster.id);g.processStatuses(ordinary,()=>{},normalBattle,false);assert.equal(normalBattle.events.find(e=>e.isDot).incoming,Math.round(ordinary.maxHp*.05));
console.log('Encounter state passed: immediate same-day refill, all 196 copies conserved, real-day exhaustion/recovery, stable variants and dispatched-party Wanted materials.');
