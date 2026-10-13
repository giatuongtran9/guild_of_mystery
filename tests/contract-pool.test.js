'use strict';
const assert=require('node:assert/strict'),g=require('../js/node-loader');
const copy=x=>JSON.parse(JSON.stringify(x));
function actor(sequence){const a=g.makeAgent(()=>.5,{path:'fool',sequence,traitId:'hardy'});g.restatAgent(a);return a;}
function conserve(s){
 const p=s.contractPool,pending=s.pendingContract?.quest?.id;
 for(const d of g.CONTRACT_POOL.definitions){
  const posted=s.quests.filter(q=>q.poolDefinitionId===d.id&&q.id!==pending).length;
  const held=Number(s.pendingContract?.quest?.poolDefinitionId===d.id);
  const cooling=p.cooling.filter(c=>c.definitionId===d.id).length;
  assert.equal(p.available[d.id]+posted+held+cooling,d.copies,d.id);
  assert(p.available[d.id]>=0);
 }
 assert(s.quests.some(q=>q.difficultySequence===9),'permanent beginner access');
 const best=g.rosterProfile(s.roster).bestSequence;
 assert(s.quests.some(q=>q.difficultySequence===best||q.difficultySequence===Math.min(9,best+1)),'progression access');
}
const ranks=require('../data/contracts.json').system.reputation_ranks;
assert.equal(ranks.length,10);assert.equal(g.CONTRACT_POOL.definitions.length,50);
assert.equal(g.CONTRACT_POOL.definitions.reduce((n,d)=>n+d.copies,0),196);
for(const rank of ranks){assert.equal(Object.values(rank.sequenceOdds).reduce((n,w)=>n+w,0),100);assert.equal(g.reputationRank(rank.minimumReputation).name,rank.name);}
assert.equal(g.reputationRank(0).sequenceOdds[9],90);assert.equal(g.reputationRank(80).sequenceOdds[9],70);assert.equal(g.reputationRank(400).sequenceOdds[9],20);
for(let guild=1;guild<=30;guild++){
 const s=g.newGame();s.worldSeed=guild;s.funds=100000;
 for(let day=1;day<=100;day++){
  s.day=day;s.reputation=(day-1)*5;s.roster=[actor(Math.max(0,9-Math.floor(day/10)))];g.maintainGuildBoards(s);conserve(s);
  const restored=g.migrateSave(copy(s));assert.deepEqual(restored.contractPool,s.contractPool,'load preserves stock and RNG');assert.deepEqual(restored.quests,s.quests,'load preserves posts');
  const left=copy(s),right=copy(restored);g.refreshContracts(left);g.refreshContracts(right);
  assert.deepEqual(left.quests.map(q=>[q.poolDefinitionId,q.enemySeed,q.rewards]),right.quests.map(q=>[q.poolDefinitionId,q.enemySeed,q.rewards]),'next refresh is reproducible');
  const protectedIds=new Set([s.quests.find(q=>q.difficultySequence===9).id]);
  const random=s.quests.find(q=>!protectedIds.has(q.id)&&q.difficultySequence!==s.roster[0].sequence&&q.difficultySequence!==s.roster[0].sequence+1);
  if(random){const n=s.quests.length;assert(g.declineContract(s,random.id).ok);assert.equal(s.quests.length,n-1,'random declines wait for day/paid refill');conserve(s);}
  const quest=s.quests[0];assert(g.reserveContractDispatch(s,quest).ok);
  s.pendingContract={quest,result:{success:day%2===0,consequences:[],marionettes:[],rewards:{funds:0,reputation:0,materials:{}},dayCost:1}};
  g.maintainGuildBoards(s);conserve(s);assert.equal(s.contractPool.reservations[quest.id].location,'pending');
  assert(!g.declineContract(s,quest.id).ok);assert(!g.refreshContracts(s).ok);
  assert(g.settleContract(s).ok);conserve(s);assert(!g.settleContract(s).ok);
 }
}
const legacy=g.newGame();legacy.schema=13;delete legacy.contractPool;legacy.reputation=400;legacy.roster=[actor(0)];
legacy.quests=[{id:'stale',kind:'contract',difficultySequence:0,encounter:true,rewards:{}}];
const migrated=g.migrateSave(copy(legacy));assert.equal(migrated.schema,g.SAVE_VERSION);conserve(migrated);
legacy.pendingContract={quest:legacy.quests[0],result:{success:true,consequences:[],marionettes:[],rewards:{funds:100,reputation:0,materials:{}},dayCost:1}};
const pending=g.migrateSave(copy(legacy));assert.deepEqual(pending.pendingContract,legacy.pendingContract);conserve(pending);
const funds=pending.funds;assert(g.settleContract(pending).ok);assert.equal(pending.funds,funds+100);assert(!g.settleContract(pending).ok);conserve(pending);
const bad=copy(migrated);bad.contractPool.available[Object.keys(bad.contractPool.available)[0]]=-999;g.migrateSave(bad);conserve(bad);
const s=g.newGame();s.funds=1000;s.reputation=400;s.roster=[actor(0)];g.maintainGuildBoards(s);
const protectedPosts=s.quests.filter(q=>q.protectedPost),day=s.day;
assert(g.refreshContracts(s).ok);assert.equal(s.funds,975);assert.equal(s.day,day);
for(const q of protectedPosts)assert.deepEqual(s.quests.find(x=>x.id===q.id),q);
console.log('Finite contract pool passed: 3,000 guild-day transitions, conservation, all ranks, protected access, deterministic reload/refresh, pending legacy migration, cooldowns and one-time payouts.');
