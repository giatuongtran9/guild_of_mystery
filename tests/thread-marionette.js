// Thread Binding: battle-only Marionettes, slot counting, cooldown-on-resolve, both sides.
const assert=require('assert');const g=require('../js/node-loader.js');
const r=()=>0.99; // never resists / never procs
const generationR=()=>.4; // reproducible profiles; battle randomness remains seeded
const mkAgent=(path,seq,id)=>{const a=g.makeAgent(generationR,{sequence:seq,path,trait:'Stout Vitality'});Object.assign(a,{id,name:id,awakened:true,path,sequence:seq,injuries:0,weaponId:'none',weaponMastery:{}});g.restatAgent(a);a.sp=g.maxSPFor(a);a.maxSP=a.sp;a.cooldowns={};return a;};
const allyUnit=a=>({id:a.id,name:a.name,agent:a,hp:a.stats.hp,maxHp:a.stats.hp,alive:true,inCombat:true,status:[],statusMeta:{}});
const mkState=(allies,enemies)=>({allies,enemies,individual:false,createdMarionettes:[],battleMarionettes:[],rng:generationR,events:[],balanceTrace:[],currentRound:1,weaponUsage:{}});
const cast=lines=>lines.some(l=>/casts \[Thread Binding\]/.test(l.text));

// ---- player Fool (Seq 4 => 1 thread slot)
{const fool=mkAgent('fool',4,'Fool'),fu=allyUnit(fool);
 assert.strictEqual(g.threadSlots(4),1,'Sequence 4 retains one slot; a living marionette fills it');
 const e1=g.makeEnemy(8,generationR,0,'door'),e2=g.makeEnemy(8,generationR,1,'error');
 const st=mkState([fu],[e1,e2]);const lines=[];
 e1.thread={ownerId:fool.id,progress:4,required:5};fool.threadTargets=[e1.id];
 g.processSpiritThreads(st,lines);
 assert(!e1.alive,'thread kill must kill the target');
 const m=st.allies.find(x=>x.summoned);assert(m,'marionette must join the owner side');
 assert.strictEqual(m.agent.unitType,'marionette');
 assert.strictEqual(st.createdMarionettes.length,0,'no roster marionette');
 assert.strictEqual(g.threadUsage(st,fool),1,'living marionette occupies the slot');
 assert.strictEqual(fool.cooldowns.thread_binding,6,'cooldown starts when the thread resolves (5 + 1)');
 fool.cooldowns.thread_binding=0;const l2=[];g.powerEffect(fool,fu,e2,st,l2,r);
 assert(!cast(l2),'slots full: Fool must not cast Thread Binding again');
 m.alive=false;m.hp=0; assert.strictEqual(g.threadUsage(st,fool),0,'dead marionette frees the slot');
 // Isolate slot legality from the AI's preference for a lethal paid attack.
 for(const spec of g.activeSpecs(fool))if(spec.effectId!=='thread_binding')fool.cooldowns[spec.effectId]=99;
 e2.hp=e2.maxHp=1e8;e2.stats.int=e2.agent.stats.int=10000;
 const l3=[];g.powerEffect(fool,fu,e2,st,l3,r);assert(cast(l3),'slot free: Fool casts Thread Binding again');
 assert.strictEqual(fool.cooldowns.thread_binding,999,'locked while the new thread is active');}

// ---- enemy Fool converts a player unit into an enemy-side Marionette
{const fool=g.makeEnemy(4,generationR,0,'fool');const target=allyUnit(mkAgent('door',4,'DoorHero'));
 const st=mkState([target],[fool]);const lines=[];
 target.thread={ownerId:fool.id,progress:4,required:5};fool.threadTargets=[target.id];
 g.processSpiritThreads(st,lines);
 assert(!target.alive);const m=st.enemies.find(x=>x.summoned);assert(m,'enemy Fool must convert its target');
 assert.strictEqual(m.ownerId,fool.id);assert(m.hp>0&&m.alive);
 assert.strictEqual(g.threadUsage(st,fool),1);}

// ---- full battle: nothing is saved to the roster and results stay clean
{const q={id:'s',name:'x',brief:'',story:'',objective:'combat',difficultySequence:0,encounter:true,mundane:false,rewards:{funds:0,reputation:0,materials:{}},enemyCount:2,requiredPath:'door'};
 let created=0;for(let sd=1;sd<=60;sd++){const res=g.resolveQuest([mkAgent('fool',0,'F'),mkAgent('tyrant',0,'T')],q,sd,{individual:false,simulationOpponents:[{path:'door',sequence:0},{path:'error',sequence:0}]});
  assert.strictEqual(res.marionettes.length,0,'never persisted to roster');created+=res.marionettesCreated||0;
  assert(!res.consequences.some(c=>c.type==='death'&&String(c.agentId).startsWith('mar_')),'battle marionettes take no consequences');}
 console.log(`(${created} battle marionettes across 60 fights)`);}
console.log('PASS thread-marionette');
