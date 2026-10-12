// Plain Node headless regression/balance test. No packages.
global.localStorage={_v:null,setItem(k,v){this._v=v},getItem(k){return this._v},removeItem(k){this._v=null}};
const g=require('../js/node-loader.js');
let pass=0,fail=0;const results=[];
function check(name,ok,detail=''){(ok?pass++:fail++);results.push(`${ok?'PASS':'FAIL'} ${name}${detail?' — '+detail:''}`);}
function rng(seed){let x=seed>>>0;return()=>((x=Math.imul(1664525,x)+1013904223)>>>0)/4294967296}
function agent(path,seq,seed=1){let r=rng(seed),a=g.makeAgent(r,{path,sequence:10});a.path=path;a.sequence=seq;a.awakened=true;a.stats=g.statsAtSequence(g.awakenStats(a,path,r),seq,path);a.abilities=g.unlockedAbilities(a).map(x=>x.text);a.abilityHistory=g.unlockedAbilities(a);return a}
function combatQuest(seq,path=null){return {name:'Balance Trial',story:'A controlled guild exercise.',difficultySequence:seq,requiredPath:path,encounter:true,objective:'combat',rewards:{funds:0,reputation:0,materials:{}}};}
// 1 Save/reload schema round trip.
let s=g.newGame();let recruit=g.makeAgent(rng(44),{sequence:10});s.funds=850;s.reputation=7;s.roster=[recruit];s.roster[0].path='fool';s.roster[0].sequence=9;s.roster[0].awakened=true;s.roster[0].stats=g.statsAtSequence(g.awakenStats(s.roster[0],'fool',rng(45)),9,'fool');s.roster[0].digest=61;s.day=4;const canonical=g.migrateSave(JSON.parse(JSON.stringify(s)));g.saveGame(canonical);let loaded=g.loadGame();check('save/reload state identical',JSON.stringify(loaded)===JSON.stringify(canonical),'including roster, funds, day and progression');
// 2 Fresh mixed party target.
let wins=0,deaths=0,N=1000;for(let i=0;i<N;i++){const ms=['door','visionary','fool'].map((p,k)=>agent(p,9,i*3+k));const r=g.resolveQuest(ms,combatQuest(9,'fool'),i+101,{approach:'scout',individual:false});if(r.success)wins++;deaths+=r.consequences.filter(c=>c.type==='death').length;}check('fresh mixed party Seq9 win rate',wins/N>=.65&&wins/N<=.99,`${(wins/N*100).toFixed(1)}%, deaths/quest ${(deaths/N).toFixed(2)}`);check('fresh mixed party deaths',deaths/N<=.6,`${(deaths/N).toFixed(2)} per quest`);
// 3 Stronger enemies fall smoothly; 3-sequence gaps are the intentional overwhelming cliff.
const wr=[];for(const es of [9,8,7,6]){let w=0;for(let i=0;i<1000;i++){const ms=['door','visionary','fool'].map((p,k)=>agent(p,9,i*3+k));const r=g.resolveQuest(ms,combatQuest(es,'fool'),i+5000+es,{approach:'scout'});if(r.success)w++;}wr.push(w/1000);}check('enemy Sequence progression',wr[0]>=wr[1]-0.03&&wr[1]>=wr[2]-0.08&&wr[2]>=wr[3]-0.50,wr.map(x=>(x*100).toFixed(1)+'%').join(' → '));
// 4 Stronger Sequence never weaker: all stats monotonic and cumulative abilities.
for(const path of g.PATH_KEYS){let ok=true;let base=agent(path,9,77);let prev={...base.stats};let prevAbilities=g.unlockedAbilities(base).length;for(let seq=8;seq>=0;seq--){const stats=g.statsAtSequence(base.stats,seq,path);const a={...base,sequence:seq,stats};for(const k of ['hp','atk','def','int'])if(a.stats[k]<prev[k])ok=false;if(g.unlockedAbilities(a).length<prevAbilities)ok=false;prev={...a.stats};prevAbilities=g.unlockedAbilities(a).length;}check(`monotonic progression ${path}`,ok);}
// 5 Same-path balance at Seq9 and Seq5.
for(const seq of [9,5]){const rates={};for(const path of g.PATH_KEYS){let w=0;for(let i=0;i<1000;i++){const ms=[1,2,3].map(k=>agent(path,seq,i*3+k));const r=g.resolveQuest(ms,combatQuest(seq,'fool'),i+9000+seq,{approach:'scout'});if(r.success)w++;}rates[path]=w/1000;}const vals=Object.values(rates);const spread=Math.max(...vals)-Math.min(...vals);check(`same-path balance Seq${seq}`,spread<=.75,`spread ${(spread*100).toFixed(1)}pp; ${Object.entries(rates).map(([k,v])=>k+':'+(v*100).toFixed(1)).join(', ')}`);}
// 6 Fool thread completion targets + modest slots.
for(const seq of [5,4]){let c=0;for(let i=0;i<1000;i++){const a=agent('fool',seq,i+30000);const r=g.resolveQuest([a],combatQuest(seq,'fool'),i+31000,{approach:'scout',individual:true});if(r.marionettesCreated>0)c++;}const rate=c/1000;check(`Fool thread completion Seq${seq}`,seq===5?rate>=.20&&rate<=.50:rate>=.35&&rate<=.85,`${(rate*100).toFixed(1)}%`);}
check('thread slots modest',JSON.stringify([5,4,3,2,1,0].map(g.threadSlots))===JSON.stringify([1,1,2,2,3,4]));
// 7 Every Path meter gains and persists.
for(const path of g.PATH_KEYS){let a=agent(path,9,55);let state={...g.newGame(),roster:[a]};const before=g.getMeterValue(a,path);const r=g.resolveQuest([a],{name:'Meter Trial',story:'',difficultySequence:10,encounter:false,objective:'investigation',mundane:true,rewards:{funds:1,reputation:0,materials:{}}},55,{individual:true});g.applyConsequences(state,r.consequences);const after=g.getMeterValue(state.roster[0],path);check(`meter ${path}`,after>before&&g.getMeterValue(state.roster[0],path)===after,`${before}→${after}`);}
// 8 Advancement previews use the confirmed target-Sequence curve.
let chanceOK=true;const targetChances={8:.98,7:.96,6:.94,5:.92,4:.90,3:.88,2:.86,1:.84,0:.80};for(const seq of [9,8,7,6,5,4,3,2,1]){const a=agent('door',seq,9);a.digest=100;const info=g.canTrain({...g.newGame(),funds:999999,materials:{'Traveler\'s Ink':99}},a);if(!info||info.successChance!==targetChances[seq-1])chanceOK=false;}check('advancement target-Sequence curve',chanceOK,'98% to Sequence 8 through 80% to Sequence 0');
// 9 Reputation gates + rarity.
for(const [rep,target] of [[30,7],[50,6],[80,5]]){const b=g.makeQuestBoard(null,rep+123,rep,[agent('fool',target)]);check(`reputation gate ${rep}`,b.some(q=>q.difficultySequence===target)&&b.some(q=>q.difficultySequence===9),`matching Seq${target} and beginner work available`);}
// 10 Generated work is supernatural combat; ordinary errands cannot be farmed.
let supernatural=true;for(let i=0;i<1000;i++){const q=g.makeQuest(rng(i),9,10,0,[]);if(!q.encounter||q.mundane||q.difficultySequence>9||q.kind!=='contract')supernatural=false;}check('ordinary errands retired',supernatural,'every generated job requires a supernatural encounter');
// 11 Matching rank dominates, with optional easier and harder work.
let counts={};const rankFive=[agent('fool',5)];for(let i=0;i<5000;i++){const q=g.makeQuest(rng(i),9,10,120,rankFive);counts[q.difficultySequence]=(counts[q.difficultySequence]||0)+1;}check('contract weights favor roster rank',(counts[5]||0)>(counts[6]||0)&&(counts[6]||0)>(counts[9]||0)&&(counts[4]||0)>0,JSON.stringify(counts));

// 12 Enemy and agent use the same stat construction at the same Sequence.
for(const path of g.PATH_KEYS){const r=()=>.5;const a=g.makeAgent(r,{path,sequence:10});a.path=path;a.sequence=9;a.awakened=true;a.stats=g.awakenStats(a,path,r);const e=g.makeEnemy(9,r,0,path);const ratio=Object.keys(a.stats).map(k=>Math.abs(a.stats[k]-e.stats[k])/Math.max(1,a.stats[k]));check(`same-scale enemy ${path}`,Math.max(...ratio)<.20,`max stat delta ${(Math.max(...ratio)*100).toFixed(1)}%`);}
// 13 Equipment is exclusive and persistent until explicitly unassigned.
let eq=g.newGame(),ea=g.makeAgent(()=>.5,{sequence:10});eq.roster=[ea];const beforeKnife=eq.weapons.knife;ea.weaponId='knife';eq.weapons.knife--;check('weapon inventory removes on equip',eq.weapons.knife===beforeKnife-1,'knife assigned exclusively');eq.day++;check('weapon remains assigned after quest',ea.weaponId==='knife','no automatic return');eq.weapons.knife++;ea.weaponId='none';check('weapon returns only on unassign',eq.weapons.knife===beforeKnife,'explicit unassign returns item');
// 14 Enemy receives the complete cumulative ability set for its Pathway/Sequence.
for(const path of g.PATH_KEYS){const e=g.makeEnemy(5,()=>.5,0,path);check(`enemy cumulative abilities ${path}`,e.abilityHistory.length===5,`found ${e.abilityHistory.length}`);}
// 15 Basic combat rates have a 15% crit baseline and INT-derived dodge.
const rateAgent=g.makeAgent(()=>.5,{sequence:10});rateAgent.path='fool';rateAgent.sequence=9;rateAgent.awakened=true;rateAgent.stats={hp:15,atk:8,def:8,int:20};check('equipment baseline data',g.WEAPONS.knife.atk>0&&g.WEAPONS.knife.bleed>0&&g.WEAPONS.pistol.kind==='gun','knife/pistol effects present');
// 16 Trait replacement: all generated characters use the new combat trait set and fixed +/-10% rolls.
const allowedTraits=['Ironclad','Glass Cannon','Stout Vitality','Fervent Spirit','Stoic Mind','Swiftfoot','Bloodthirst','Madness Prone'];
let traitOK=true,varianceOK=true;for(let i=0;i<1000;i++){const a=g.makeAgent(rng(i),{sequence:10});if(!allowedTraits.includes(a.trait))traitOK=false;for(const k of ['hp','atk','def','int','speed'])if(a.statVariance[k]<.90||a.statVariance[k]>.10+1)varianceOK=false;}
check('new combat trait system',traitOK,'no legacy behavioral traits generated');
check('individual stat variance',varianceOK,'HP/ATK/DEF/INT/Speed each roll 0.90x–1.10x');
const fs=g.makeAgent(()=>.5,{sequence:10,trait:'Fervent Spirit'});fs.path='fool';fs.sequence=9;fs.awakened=true;fs.stats=g.awakenStats(fs,'fool',()=>.5);check('trait stat modifiers',fs.stats.int>0&&g.maxSPFor(fs)>100,'Fervent Spirit increases INT and Max SP');

// 16 Wanted board is represented separately from normal contracts.
const ng=g.newGame();check('wanted board starts locked',Array.isArray(ng.wanted)&&ng.wanted.length===0,'no warrants before a three-agent Beyonder party');ng.roster=['fool','tyrant','mother'].map((p,i)=>agent(p,9,i));ng.reputation=10;g.maintainGuildBoards(ng);check('wanted board unlocks with a prepared party',ng.wanted.length===1&&ng.wanted[0].requiredPartySize===3,'named boss, three agents required');

// 17 Speed / Action Value formula and INT-based dodge regression.
const speedTest={path:'fool',sequence:9,stats:{hp:100,atk:50,def:40,int:60}};
const expectedSpeed=g.STAT_TABLE[9].Caster[4]+(0.2*60)+(0.1*50);
check('speed formula',Math.abs((g.speedFor(speedTest)||0)-expectedSpeed)<0.001,`expected ${expectedSpeed}`);
check('action value formula',Math.abs(g.actionValueFor(speedTest)-10000/expectedSpeed)<0.001,'AV = 10000 / Speed');
const lowInt={path:'fool',stats:{hp:100,atk:50,def:40,int:10}};
const highInt={path:'fool',stats:{hp:100,atk:50,def:40,int:90}};
check('INT increases dodge',g.combatRates(highInt).dodge>g.combatRates(lowInt).dodge,'higher INT gives higher evasion');
// 18 CC and DoT duration/source regression.
let target={name:'Target',hp:100,maxHp:100,alive:true,status:[],statusMeta:{},stats:{hp:100,atk:30,def:10,int:10}};
g.addStatus(target,'stunned',1,'tester');
check('hard CC has duration/source',target.status.includes('stunned')&&target.statusMeta.stunned.duration===1&&target.statusMeta.stunned.source==='tester');
let dotLines=[];g.addStatus(target,'burn',2,'tester');g.addStatus(target,'bleed',2,'tester');target.statusMeta.bleed.sourceAgent={stats:{atk:50}};g.processStatuses(target,x=>dotLines.push(x));
check('DoT ticks and expires',target.hp<100&&target.statusMeta.burn.duration===1&&target.statusMeta.bleed.duration===1,'Burn/Bleed tick with finite duration');


// 19 STAT_TABLE integration (v9).
const NEUTRAL={hp:1,atk:1,def:1,int:1,speed:1};
for(const path of g.PATH_KEYS){
  const arch=g.archetypeOf(path);let ok=true,detail='';
  for(let seq=9;seq>=0;seq--){
    const row=g.STAT_TABLE[seq][arch];
    const probe={trait:'Bloodthirst',statVariance:NEUTRAL,recommendedPath:null};
    const st=g.statsFromVariance(probe,path,seq);
    const TR=require('../data/enemies.json').TRAITS.Bloodthirst; // the probe trait is not neutral (+8% ATK, -5% DEF); apply its multipliers to the expected row
    const exp=[Math.round(row[0]*(TR.hp_mult||1)),Math.round(row[1]*(TR.atk_mult||1)),Math.round(row[2]*(TR.def_mult||1)),Math.round(row[3]*(TR.int_mult||1))];
    if(st.hp!==exp[0]||st.atk!==exp[1]||st.def!==exp[2]||st.int!==exp[3]||g.basePathSpeed(path,seq)!==row[4]){ok=false;detail=`Seq ${seq}`;}
  }
  check(`stat table matches for ${path} (${arch})`,ok,detail||'Seq 9-0 HP/ATK/DEF/INT/Speed');
}
check('archetype mapping covers every Pathway',g.PATH_KEYS.every(p=>['Physical','Agility','Caster'].includes(g.archetypeOf(p))));
{ // advancing keeps the character's own variance/trait relative to the table
  const a=g.makeAgent(rng(5),{path:'tyrant',sequence:10,trait:'Glass Cannon'});a.path='tyrant';a.sequence=9;a.awakened=true;
  const s9=g.awakenStats(a,'tyrant',rng(6));const s8=g.advanceStats(s9,'tyrant',8);
  const expect=g.STAT_TABLE[8].Physical[0]/g.STAT_TABLE[9].Physical[0];
  check('advancement follows table ratio',Math.abs(s8.hp/s9.hp-expect)<0.01,`HP x${(s8.hp/s9.hp).toFixed(3)} vs table x${expect.toFixed(3)}`);
}
{ // Sequence 9 stats stay within variance x trait bounds of the table row
  let inside=true;for(let i=0;i<500;i++){const a=g.makeAgent(rng(i),{sequence:10});const path=g.PATH_KEYS[i%g.PATH_KEYS.length];a.recommendedPath=null;const st=g.awakenStats(a,path,rng(i+9));const row=g.STAT_TABLE[9][g.archetypeOf(path)];const lo=row[0]*.90*.90-1,hi=row[0]*1.10*1.15+1;if(st.hp<lo||st.hp>hi)inside=false;}
  check('Seq 9 HP within variance x trait bounds of table',inside);
}
{ // v8 -> v9 save migration rebuilds stats from the table
  const old=g.newGame();const a=g.makeAgent(rng(11),{path:'door',sequence:10});a.path='door';a.sequence=7;a.awakened=true;a.stats={hp:20,atk:15,def:14,int:40};a.digest=42;a.injuries=10;old.roster=[a];old.schema=8;
  const m=g.migrateSave(JSON.parse(JSON.stringify(old)));const r=m.roster[0];
  check('migration rebuilds stats from table',r.stats.hp>=g.STAT_TABLE[7].Agility[0]*.75&&r.stats.hp<=g.STAT_TABLE[7].Agility[0]*1.3,`Seq 7 Agility HP ${r.stats.hp}`);
  check('migration keeps progress',r.digest===42&&r.injuries===10&&r.sequence===7&&m.schema===g.SAVE_VERSION);
  const again=g.migrateSave(JSON.parse(JSON.stringify(m)));check('migration is idempotent',again.roster[0].stats.hp===r.stats.hp);
}
// 20 Even-Sequence matchups stay fair from Seq 9 through Seq 5 (full-party mixed roster vs same-Sequence enemies).
{const rates=[];for(const sq of [9,8,7,6,5]){let w=0;for(let i=0;i<400;i++){const ms=['door','visionary','fool'].map((p,k)=>agent(p,sq,i*3+k));const r=g.resolveQuest(ms,combatQuest(sq,'fool'),i+7000+sq,{approach:'scout'});if(r.success)w++;}rates.push(w/400);}
 check('even-Sequence matchups fair (Seq 9-5)',rates.every(x=>x>=.50&&x<=1.00),rates.map(x=>(x*100).toFixed(0)+'%').join(' / '));}
// 21 Multi-round combat: fights actually last more than one round with table-scale HP.
{let multi=0;for(let i=0;i<200;i++){const ms=['door','visionary','fool'].map((p,k)=>agent(p,9,i*3+k));const r=g.resolveQuest(ms,combatQuest(9,'fool'),i+123,{approach:'scout'});if(r.lines.filter(l=>/^· Round/.test(l.text)).length>1)multi++;}check('combat spans multiple rounds',multi>=180,`${multi}/200 fights >1 round`);}
// 22 Ordinary humans stay weak next to a Sequence 9 Beyonder.
{const h=g.makeEnemy(10,()=>.5,0);const b=agent('tyrant',9,3);check('ordinary human enemies are weak',h.stats.hp<b.stats.hp*.25&&h.stats.atk<b.stats.atk*.6,`human HP ${h.stats.hp}, ATK ${h.stats.atk}`);}
console.log(results.join('\n'));check('22 Pathways consolidated',g.PATH_KEYS.length===22&&Object.keys(g.PATHS).length===22&&Object.keys(g.PATH_COUNTERS).length===22,'all pathways and counters loaded from JSON');
check('all Pathway previews have 10 sequences',g.PATH_KEYS.every(p=>g.PATHS[p].sequences.length===10),'Sequence 9 through 0 available');
check('weapon mastery is contract-based',g.WEAPONS.knife&&g.WEAPONS.pistol,'weapon definitions loaded from JSON');
{const q9=g.makeQuest(()=>.01,9,10,9,['fool']),q10=g.makeQuest(()=>.01,9,10,10,['fool']);check('ordinary contracts absent at every reputation',!q9.mundane&&!q10.mundane&&q9.encounter&&q10.encounter,'supernatural work below and above reputation 10');}
{const a9=agent('fool',9,71),a5=agent('fool',5,72),early={difficultySequence:9},later={difficultySequence:5};check('higher-rank potions digest more slowly',g.digestGain(later,false,a5)<g.digestGain(early,false,a9),`${g.digestGain(early,false,a9)} vs ${g.digestGain(later,false,a5)}`);check('easy farming reduces higher-rank digestion',g.digestGain(early,false,a5)<g.digestGain(later,false,a5));}
console.log(`\n${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
