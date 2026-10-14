'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom'),g=require('../js/node-loader'),loadout=require('../scripts/permanent-asset-loadouts');
const root=path.resolve(__dirname,'..'),key='guild-rpg-browser-v9',copy=x=>JSON.parse(JSON.stringify(x));
async function fixture(s){const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test/guild_of_mystery/',runScripts:'dangerously'}),w=dom.window;w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,new URL(url).pathname.replace('/guild_of_mystery/','')),'utf8'))});w.eval(fs.readFileSync(path.join(root,'js/data-loader.js'),'utf8'));w.G9_DATA=await w.G9DataLoader.load();w.setInterval=()=>1;w.clearInterval=()=>{};w.scrollTo=()=>{};w.confirm=()=>true;w.matchMedia=()=>({matches:false});let n=0;const timers=new Map();w.setTimeout=fn=>{timers.set(++n,fn);return n;};w.clearTimeout=id=>timers.delete(id);w.localStorage.setItem(key,JSON.stringify(s));w.eval(['vendor/dayjs.min','paths','v15','generate','traits','market','pathway-assets','signatures','mythical','battle-ai','engine','state','campaign','ui'].map(n=>fs.readFileSync(path.join(root,`js/${n}.js`),'utf8')).join('\n'));return {dom,w,saved:()=>JSON.parse(w.localStorage.getItem(key))};}
(async()=>{
 for(const [p,seq]of [['fool',3],['moon',8],['paragon',6]]){
  const save=g.newGame(),a=g.makeAgent(()=>.5,{path:p,sequence:seq,trait:'Stout Vitality'});a.id='owner';a.name='Entry owner';g.restatAgent(a);a.sp=g.maxSPFor(a);loadout(g,a,'rare');save.roster=[a];save.campaign={...save.campaign,unlocked:true};
  const f=await fixture(save);let pending;
  try{
   f.w.G9.dossier(a.id);f.w.G9.dossierSkillTab('inventory');assert.match(f.w.document.querySelector('.pathway-inventory').textContent,/enter automatically without SP or an action/);assert(!f.w.document.body.textContent.includes('Deployment takes a paid action'));
   f.w.G9.closeDossier();f.w.G9.tab('quests');const q=f.saved().quests.find(q=>q.encounter);assert(q);f.w.G9.plan(q.id);f.w.G9.selectedIds=[a.id];f.w.G9.launch();pending=f.saved().pendingContract;assert(pending,'launch must save one resolved outcome');
   const companions=pending.initialAllies.filter(u=>u.summoned);assert.equal(companions.length,p==='fool'?g.threadSlots(seq):1);assert(pending.isSolo,'companions cannot turn a solo job into a party job');assert(pending.result.battleSnapshot.initialUnits.some(u=>u.summoned));for(const u of companions)assert(f.w.document.body.textContent.includes(u.name),'opening HP strip must include '+u.name);
  }finally{f.dom.window.close();}
  const reload=await fixture({...save,pendingContract:pending});try{assert.deepEqual(reload.saved().pendingContract.result,pending.result,'reload must not reroll a saved battle');reload.w.G9.skipTicker();reload.w.G9.closeQuest();const settled=copy(reload.saved());assert.equal(settled.pendingContract,null);reload.w.G9.closeQuest();assert.deepEqual(reload.saved(),settled,'result cannot settle twice');}finally{reload.dom.window.close();}
 }
 console.log('Automatic companion UI passed: free-entry instructions, opening companion HP strips, solo classification, saved replay and one settlement.');
})().catch(e=>{console.error(e);process.exitCode=1});
