const assert=require('assert');
const fs=require('fs'),path=require('path');
const g=require('../js/node-loader');
const copy=x=>JSON.parse(JSON.stringify(x));
let checks=0;
function test(label,fn){fn();checks++;console.log(`PASS ${label}`);}
function fixture(paths=['fool']){
 const s=g.newGame();s.roster=paths.map((p,i)=>{const a=g.makeAgent(()=>.5,{path:p,sequence:9,trait:'Stout Vitality'});a.id=`agent_${i}`;a.name=`Agent ${i}`;a.weaponId='knife';g.restatAgent(a);return a;});return s;
}
function settleMission(s,id,choice=null,ids=s.roster.map(a=>a.id),seed=1){const started=g.campaignStart(s,id,ids,choice,seed);assert(started.ok,started.reason);return g.campaignSettle(s);}
function prepare(s,lead='interviews',support='ward'){settleMission(s,'open_doors');settleMission(s,'follow_whispers',lead);settleMission(s,'seal_and_supply',support);return s;}

test('chapter data exposes five original, ordered missions and authored Sequence 9 threat',()=>{
 assert.strictEqual(g.CAMPAIGN.missions.length,5);assert.deepStrictEqual(g.CAMPAIGN.missions.map(m=>m.number),[1,2,3,4,5]);
 assert.strictEqual(g.CAMPAIGN.missions[3].enemy.name,'Cantor Vale');assert.strictEqual(g.CAMPAIGN.missions[3].enemy.sequence,9);
 assert.strictEqual(g.CAMPAIGN.missions[3].enemy.path,'darkness');assert(g.CAMPAIGN.missions.every(m=>m.rewards.digestion>0));
});
test('new guild derives recruitment, awakening and equipment readiness without granting progress',()=>{
 const s=g.newGame();assert.strictEqual(s.schema,9);let st=g.campaignStatus(s);assert(!st.ready);assert(st.requirements.every(r=>!r.done));
 const a=g.makeAgent(()=>.5,{sequence:10});s.roster=[a];assert(g.campaignStatus(s).requirements[0].done);assert(!g.campaignStart(s,'open_doors').ok);
 a.awakened=true;a.path='fool';a.sequence=9;g.restatAgent(a);assert(!g.campaignStatus(s).ready);a.weaponId='knife';assert(g.campaignStatus(s).ready);
 assert.deepStrictEqual(s.campaign.completed,[]);
});
test('v9 saves gain chapter state without replacing contracts, resources, roster or progression',()=>{
 const s=fixture(['hermit']);delete s.campaign;s.funds=432;s.day=28;s.roster[0].sequence=6;g.restatAgent(s.roster[0]);s.roster[0].digest=77;s.roster[0].injuries=31;
 const before=copy(s),loaded=g.migrateSave(copy(s));assert(loaded.campaign);assert(g.campaignStatus(loaded).ready);
 for(const key of ['funds','day','reputation','materials','weapons','quests','wanted','teams'])assert.deepStrictEqual(loaded[key],before[key],key);
 assert.strictEqual(loaded.roster[0].sequence,6);assert.strictEqual(loaded.roster[0].digest,77);assert.strictEqual(loaded.roster[0].injuries,31);assert.deepStrictEqual(loaded.roster[0].stats,before.roster[0].stats);
});
test('mission order, required choices and valid party size are enforced',()=>{
 const s=fixture();assert(!g.campaignStart(s,'last_bell',['agent_0']).ok);assert(!g.campaignStart(s,'open_doors',['missing']).ok);assert(!g.campaignStart(s,'open_doors',['agent_0','agent_0']).ok);
 settleMission(s,'open_doors');assert(!g.campaignStart(s,'follow_whispers',['agent_0']).ok);assert(!g.campaignStart(s,'follow_whispers',['agent_0'],'invalid').ok);
 assert(!g.campaignStart(s,'follow_whispers',['agent_0','b','c','d'],'interviews').ok);
 settleMission(s,'follow_whispers','interviews');settleMission(s,'seal_and_supply','ward');assert(!g.campaignStart(s,'last_bell',[]).ok);
});
test('narrative outcomes persist across reload, block rerolls and reward only once',()=>{
 const s=fixture();const started=g.campaignStart(s,'open_doors',[],null,71);assert(started.ok);const result=copy(started.pending);
 const loaded=g.migrateSave(copy(s));assert.deepStrictEqual(loaded.campaign.pending,result);const funds=loaded.funds;
 assert(!g.campaignStart(loaded,'open_doors',[],null,72).ok);assert.deepStrictEqual(loaded.campaign.pending,result);
 assert(g.campaignSettle(loaded).success);assert.strictEqual(loaded.funds,funds+40);assert.strictEqual(loaded.roster[0].digest,5);
 assert(!g.campaignSettle(loaded).ok);assert(!g.campaignStart(loaded,'open_doors').ok);assert.strictEqual(loaded.funds,funds+40);
});
test('investigation and preparation alter the actual boss profile or party reserve',()=>{
 const ward=prepare(fixture(),'interviews','ward'),supplies=prepare(fixture(),'ledger','supplies');
 const w=g.campaignStart(ward,'last_bell',['agent_0'],null,42).pending,p=g.campaignStart(supplies,'last_bell',['agent_0'],null,42).pending;
 assert.strictEqual(ward.campaign.clues[0].id,'counter_chant');assert.strictEqual(supplies.campaign.clues[0].id,'hidden_anchor');
 assert.strictEqual(w.initialEnemies[0].maxHp,500);assert.strictEqual(p.initialEnemies[0].maxHp,425);
 assert(w.result.lines.some(l=>l.text.includes('Cantor Vale · HP 500 · ATK 31')));
 assert.strictEqual(p.initialAllies[0].maxHp,Math.round(supplies.roster[0].stats.hp*1.25));
 assert.strictEqual(w.initialEnemies[0].path,'darkness');assert.strictEqual(w.initialEnemies[0].sequence,9);
});
test('failed chapter combat protects agents and resources, retains the current mission and allows retry',()=>{
 const s=prepare(fixture(['paragon']));const a=s.roster[0];a.stats={hp:1,atk:1,def:1,int:1};a.madness=99;a.corruption=88;a.injuries=94;a.cooldowns={old:7};a.statusEffects={old:{duration:4}};
 const before=copy(a),funds=s.funds,materials=copy(s.materials),completed=copy(s.campaign.completed);
 const pending=g.campaignStart(s,'last_bell',[a.id],null,1).pending;assert.strictEqual(pending.result.success,false);assert.deepStrictEqual(pending.result.consequences,[]);assert.deepStrictEqual(pending.result.rewards,{funds:0,reputation:0,materials:{},digestion:0});
 const loaded=g.migrateSave(copy(s));assert.deepStrictEqual(loaded.campaign.pending,pending);assert(!g.campaignStart(loaded,'last_bell',[a.id],null,999).ok);
 const settled=g.campaignSettle(s);assert(!settled.success);assert.deepStrictEqual(s.roster[0],before);assert.strictEqual(s.funds,funds);assert.deepStrictEqual(s.materials,materials);assert.deepStrictEqual(s.campaign.completed,completed);assert.strictEqual(g.campaignStatus(s).current.id,'last_bell');
 assert(g.campaignStart(s,'last_bell',[a.id],null,2).ok);assert.strictEqual(s.campaign.attempts.last_bell,2);
});
test('success keeps persistent stats, injuries and cooldowns while adding experience once',()=>{
 const s=prepare(fixture(['twilight_giant']),'ledger','supplies'),a=s.roster[0];a.injuries=45;a.madness=80;a.corruption=30;a.cooldowns={old:8};a.statusEffects={};const before=copy(a);
 const pending=g.campaignStart(s,'last_bell',[a.id],null,1).pending;assert(pending.result.success);assert(pending.result.events.length>0);assert.strictEqual(pending.initialAllies[0].maxHp,Math.round(before.stats.hp*1.25));
 const loaded=g.migrateSave(copy(s));assert.deepStrictEqual(loaded.campaign.pending,pending);const reward=g.campaignSettle(loaded);assert(reward.success);
 const after=loaded.roster[0];for(const key of ['stats','injuries','madness','corruption','cooldowns','statusEffects'])assert.deepStrictEqual(after[key],before[key],key);
 assert.strictEqual(after.digest,before.digest+18);const funds=loaded.funds;assert(!g.campaignSettle(loaded).ok);assert.strictEqual(loaded.funds,funds);
});
test('full chapter grants the case file, progression supplies and no premature next chapter',()=>{
 const s=fixture(['fool','mother','mother']),funds=s.funds,materials=copy(s.materials),quests=copy(s.quests),wanted=copy(s.wanted);
 prepare(s);assert(settleMission(s,'last_bell').success);assert(settleMission(s,'daybreak').success);
 assert(g.campaignStatus(s).complete);assert.strictEqual(g.campaignStatus(s).current,null);assert.strictEqual(s.campaign.caseFile.title,'The Whispering District');assert.strictEqual(s.campaign.caseFile.badge,'Case Closed');
 assert.strictEqual(s.funds,funds+660);assert.strictEqual(s.reputation,12);assert(s.roster.every(a=>a.digest===70));
 for(const p of ['fool','mother'])assert.strictEqual(s.materials[g.pathOf(p).material],materials[g.pathOf(p).material]+3);
 assert.deepStrictEqual(s.quests,quests);assert.deepStrictEqual(s.wanted,wanted);assert(!g.campaignStart(s,'open_doors').ok);assert(!g.campaignStart(s,'daybreak').ok);
 assert.deepStrictEqual(g.migrateSave(copy(s)).campaign.caseFile,s.campaign.caseFile);
});
test('authored enemy hook leaves normal contract random generation and death rules unchanged',()=>{
 const s=fixture(['paragon']);const a=s.roster[0];a.stats={hp:1,atk:1,def:1,int:1};
 const q={id:'normal',name:'Ordinary contract',story:'Normal rules',objective:'combat',difficultySequence:9,encounter:true,mundane:false,enemyCount:1,requiredPath:'darkness',rewards:{funds:100,reputation:2,materials:{}},dayCost:1};
 const res=g.resolveQuest(copy([a]),q,1,{individual:true});assert(!res.success);assert(res.consequences.some(c=>c.type==='death'));assert.strictEqual(res.rewards.funds,35);assert.notStrictEqual(res.battleSnapshot.enemies[0].name,'Cantor Vale');
 const baseline=fs.readFileSync(path.join(__dirname,'..','js','engine.js'),'utf8');assert(baseline.includes('authoredOpponents'));
});
test('every pathway can attempt and finish the opening boss with a Sequence 9 starter',()=>{
 const metrics=[];for(const p of g.PATH_KEYS){let wins=0;for(let seed=1;seed<=20;seed++){const s=prepare(fixture([p]));const run=g.campaignStart(s,'last_bell',['agent_0'],null,seed);assert(run.ok,`${p}: ${run.reason}`);if(run.pending.result.success)wins++;}assert(wins>=14,`${p}: only ${wins}/20 prepared solo wins`);metrics.push(`${p} ${wins}/20`);}
 console.log(`Prepared solo Sequence 9 fixture: ${metrics.join('; ')}`);
});
console.log(`${checks} campaign checks passed.`);
