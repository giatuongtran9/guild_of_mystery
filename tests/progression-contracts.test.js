'use strict';
const assert=require('node:assert/strict'),g=require('../js/node-loader');
const copy=x=>JSON.parse(JSON.stringify(x));
const seed=seed=>{let x=seed>>>0;return()=>((x=Math.imul(1664525,x)+1013904223)>>>0)/4294967296;};
function agent(sequence=9,path='fool',id='test'){const a=g.makeAgent(()=>.5,{path,sequence,traitId:'hardy'});a.id=id;g.restatAgent(a);a.weaponId='knife';a.sp=g.maxSPFor(a);return a;}
const chances={9:1,8:.98,7:.96,6:.94,5:.92,4:.9,3:.88,2:.86,1:.84,0:.8};
for(const [target,chance]of Object.entries(chances))assert.equal(g.advancementChance(Number(target)),chance);
for(let seq=9;seq>0;seq--){
 const a=agent(seq);a.digest=100;const s=g.newGame();s.funds=999999;s.materials[g.pathOf(a.path).material]=99;
 assert.equal(g.canTrain(s,a).successChance,chances[seq-1]);
 const r=seed(seq*19391);let wins=0;for(let i=0;i<10000;i++)wins+=Number(g.attemptTraining(a,Math.floor(r()*4294967296)).ok);
 assert(Math.abs(wins/10000-chances[seq-1])<.012,`Sequence ${seq-1}: actual chance matches preview`);
}
assert.equal(g.canTrain(g.newGame(),g.makeAgent(()=>.5,{sequence:10})),null);
let previous=100;
for(let seq=9;seq>0;seq--){
 const a=agent(seq),q={kind:'contract',difficultySequence:seq};
 const gain=g.digestGain(q,false,a);assert(gain<=previous);previous=gain;
 assert(g.digestGain({...q,kind:'wanted'},false,a)>g.digestGain(q,true,a));
 if(seq<9)assert(g.digestGain({...q,difficultySequence:9},true,a)<g.digestGain(q,true,a));
}
assert.equal(g.digestGain({kind:'contract',difficultySequence:9},true,agent(9)),29);
assert.equal(g.digestGain({kind:'contract',difficultySequence:1},true,agent(1)),7);
assert.equal(g.digestGain({kind:'contract',difficultySequence:0},true,agent(0)),0);
const encounterRules=require('../data/balance.json').contract_encounters;
for(const path of g.PATH_KEYS){let previous=null;for(let seq=9;seq>=0;seq--){const table=g.tableStats(path,seq),mult=encounterRules.enemy_stat_multiplier_by_sequence[seq],stats=Object.fromEntries(['hp','atk','def','int'].map(k=>[k,Math.round(table[k]*mult)]));if(previous)for(const key of Object.keys(stats))assert(stats[key]>=previous[key],`${path}: stronger NPC rank preserves ${key}`);previous=stats;}}

for(const reputation of [0,15,30,80,170,400])for(const seq of [9,8,5,0])for(let i=0;i<20;i++){
 const roster=[agent(seq)],board=g.makeQuestBoard(null,i*991+67,reputation,roster);
 assert(board.some(q=>q.difficultySequence===9));assert(board.some(q=>q.difficultySequence===seq));
 assert(board.every(q=>q.kind==='contract'&&q.encounter&&!q.mundane&&q.difficultySequence<=9));
 assert(!board.some(q=>/Missing Cat|Stolen Heirloom/.test(q.name)));
}
const failQuest={id:'failure',kind:'contract',name:'Failure probe',encounter:true,difficultySequence:5,requiredPath:'darkness',rewards:{funds:100,reputation:5,materials:{'Spirit Thread':3}}};
const failed=g.resolveQuest([agent(9)],failQuest,1009,{individual:true});assert.equal(failed.success,false);assert.deepEqual(failed.rewards.materials,{});assert.equal(failed.rewards.reputation,0);
const s=g.newGame();s.day=7;s.recruitRefreshDay=8;const ids=s.recruitPool.map(a=>a.id);g.advanceGuildDay(s,1);assert.equal(s.day,8);assert.equal(s.recruitRefreshDay,15);assert(s.recruitPool.every(a=>!ids.includes(a.id)));
const stable=copy(s.recruitPool);g.advanceGuildDay(s,0);assert.deepEqual(s.recruitPool,stable);

const trio=[agent(9,'fool','a'),agent(9,'tyrant','b'),agent(9,'mother','c')];
s.roster=trio;s.reputation=10;g.maintainGuildBoards(s);
assert.equal(s.wanted.length,1);assert.equal(s.wanted[0].bossId,'red_knife');
const boss=s.wanted[0];assert.equal(boss.requiredPartySize,3);assert(boss.story.length>100);assert(boss.rewards.funds>g.makeQuest(()=>.5,9,10,10,trio).rewards.funds);
s.bossDeferrals={red_knife:s.day};g.maintainGuildBoards(s);assert(!s.wanted.some(q=>q.bossId==='red_knife'));
g.advanceGuildDay(s,1);g.maintainGuildBoards(s);assert(s.wanted.some(q=>q.bossId==='red_knife'),'a declined warrant returns on the next game day');
const bosses=require('../data/contracts.json').WANTED_TARGETS;assert.equal(bosses.length,6);assert.equal(new Set(bosses.map(b=>b.title)).size,6);
assert.throws(()=>g.resolveQuest(trio.slice(0,2),boss,1),/three awakened/);
assert.throws(()=>g.resolveQuest([trio[0],trio[0],trio[0]],boss,1),/three awakened/);
const result=g.resolveQuest(trio,boss,1);assert.equal(result.battleSnapshot.enemies[0].name,'Elias Vane');
s.pendingContract={quest:boss,result:{success:true,consequences:[],marionettes:[],rewards:boss.rewards,dayCost:1}};
const funds=s.funds;assert(g.settleContract(s).ok);assert.equal(s.funds,funds+boss.rewards.funds);assert(s.defeatedBosses.includes('red_knife'));assert(!s.wanted.some(q=>q.bossId==='red_knife'));
assert(!g.settleContract(s).ok);assert.equal(s.funds,funds+boss.rewards.funds);

const legacy=g.newGame();legacy.schema=12;legacy.quests=[{id:'cat',name:'A Missing Cat',difficultySequence:10,encounter:false}];legacy.wanted=[{id:'fake',name:'Wanted: A Missing Cat'}];
const migrated=g.migrateSave(legacy);assert(migrated.quests.every(q=>q.kind==='contract'&&q.encounter));assert.equal(migrated.wanted.length,0);
const due=g.newGame();due.day=8;due.recruitRefreshDay=8;let raw=JSON.stringify(due),deny=true;
global.localStorage={getItem:()=>raw,setItem:(key,value)=>{if(deny)throw new Error('storage denied');raw=value;}};
const beforeIds=due.recruitPool.map(a=>a.id),unchanged=g.loadGame();assert.deepEqual(unchanged.recruitPool.map(a=>a.id),beforeIds);assert.equal(raw,JSON.stringify(due));
deny=false;const refreshed=g.loadGame();assert(refreshed.recruitPool.every(a=>!beforeIds.includes(a.id)));assert.equal(refreshed.recruitRefreshDay,15);assert.deepEqual(JSON.parse(raw).recruitPool,refreshed.recruitPool);
console.log('Progression and contract checks passed: shared advancement curve, slower higher-rank digestion, no errands, safe boards, failure rewards, day refresh, boss party requirements, and one-time settlement.');
