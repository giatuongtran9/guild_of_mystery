'use strict';
// Exercise the shipped browser runtime to document existing issues without fixing them.
// NODE_PATH=<jsdom node_modules> node scripts/assess-progression-ui.js
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),g=require('../js/node-loader');
const root=path.resolve(__dirname,'..'),key='guild-rpg-browser-v9';
async function fixture(save){
 const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test/guild_of_mystery/',runScripts:'dangerously'}),w=dom.window;
 w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,new URL(url).pathname.replace('/guild_of_mystery/',''))))});
 w.eval(fs.readFileSync(path.join(root,'js/data-loader.js'),'utf8'));w.G9_DATA=await w.G9DataLoader.load();
 w.scrollTo=()=>{};w.confirm=()=>true;w.matchMedia=()=>({matches:false});
 w.setTimeout=()=>1;w.clearTimeout=()=>{};
 if(save)w.localStorage.setItem(key,JSON.stringify(save));
 w.eval(['paths','v15','generate','traits','signatures','mythical','engine','state','campaign','ui'].map(name=>fs.readFileSync(path.join(root,`js/${name}.js`),'utf8')).join('\n'));
 return {dom,w,saved:()=>JSON.parse(w.localStorage.getItem(key))};
}
async function main(){
 const report={issues:{},ruledOut:{}};
 let f=await fixture();
 assert(f.w.G9);report.issues.freshGuildNotPersisted={savePresent:!!f.saved(),recruitCount:(f.w.G9.tab('recruit'),f.w.document.querySelectorAll('.recruit').length)};
 assert.equal(report.issues.freshGuildNotPersisted.savePresent,false);f.dom.window.close();
 const s=g.newGame(),a=g.makeAgent(()=>.5,{sequence:10,traitId:'hardy'});s.roster=[a];s.day=7;s.recruitRefreshDay=8;
 f=await fixture(s);f.w.G9.choosePath(a.id,'fool');
 report.issues.dayRefreshOnlyOnContractSettlement={day:f.saved().day,scheduledDay:f.saved().recruitRefreshDay,poolReplaced:JSON.stringify(f.saved().recruitPool.map(a=>a.id))!==JSON.stringify(s.recruitPool.map(a=>a.id))};
 assert.equal(f.saved().day,8);assert.equal(report.issues.dayRefreshOnlyOnContractSettlement.poolReplaced,false);f.dom.window.close();
 s.day=1;s.recruitRefreshDay=8;f=await fixture(s);f.w.G9.tab('hall');f.w.G9.dossier(a.id);
 f.w.Storage.prototype.setItem=()=>{throw new Error('storage denied');};f.w.G9.choosePath(a.id,'fool');
 report.issues.awakeningSaveFailure={savedAwakened:f.saved().roster[0].awakened,displayedAwakened:!!f.w.document.querySelector('.dossier-stats'),saveFailureReported:/could not be saved|storage/i.test(f.w.document.body.textContent)};
 assert.equal(report.issues.awakeningSaveFailure.savedAwakened,false);assert.equal(report.issues.awakeningSaveFailure.displayedAwakened,true);assert.equal(report.issues.awakeningSaveFailure.saveFailureReported,false);f.dom.window.close();
 const awake=g.makeAgent(()=>.5,{sequence:9,path:'fool',traitId:'hardy'});g.restatAgent(awake);awake.digest=100;
 const poor=g.newGame();poor.funds=0;poor.materials[g.pathOf('fool').material]=0;poor.roster=[awake];
 f=await fixture(poor);const before=f.w.localStorage.getItem(key);f.w.G9.advance(awake.id);
 report.ruledOut.unaffordableAdvancement={saveUnchanged:f.w.localStorage.getItem(key)===before,reasonDisplayed:/You need/.test(f.w.document.body.textContent)};
 assert(report.ruledOut.unaffordableAdvancement.saveUnchanged);assert(report.ruledOut.unaffordableAdvancement.reasonDisplayed);
 report.issues.wantedLabels=[.1,.5,.9].map(r=>{const q=f.w.makeWantedQuest(15,()=>r,['fool']);return {name:q.name,target:q.target};});
 assert.equal(new Set(report.issues.wantedLabels.map(q=>q.name)).size,1);assert.equal(new Set(report.issues.wantedLabels.map(q=>q.target)).size,3);f.dom.window.close();
 const q={name:'Mundane complication probe',objective:'investigation',encounter:false,mundane:true,difficultySequence:10,rewards:{funds:100,reputation:2,materials:{[g.pathOf('fool').material]:3}},dayCost:1};
 for(let seed=1;seed<100000;seed++){
  const result=g.resolveQuest([awake],q,seed,{individual:true});if(result.success)continue;
  const after=result.consequences.find(c=>c.type==='syncAgent').agent;
  report.issues.failedMundaneRewardPolicy={seed,success:result.success,funds:result.rewards.funds,materials:result.rewards.materials,digestion:after.digest-awake.digest,mastery:after.weaponMastery};break;
 }
 // Repeat with an undigested agent to measure potion gain, not its 100% cap.
 awake.digest=0;
 const result=g.resolveQuest([awake],q,report.issues.failedMundaneRewardPolicy.seed,{individual:true});
 report.issues.failedMundaneRewardPolicy.digestion=result.consequences.find(c=>c.type==='syncAgent').agent.digest;
 assert.equal(result.success,false);assert.equal(result.rewards.funds,100);assert(report.issues.failedMundaneRewardPolicy.digestion>0);
 const out=path.join(root,'reports/progression-review');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'ui-issues.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
