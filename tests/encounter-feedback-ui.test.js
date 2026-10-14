'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom'),g=require('../js/node-loader');
const root=path.resolve(__dirname,'..'),key='guild-rpg-browser-v9';
(async()=>{
 const save=g.newGame();save.roster=Array.from({length:3},(_,i)=>{const a=g.makeAgent(()=>.5,{path:'fool',sequence:9,trait:'Stout Vitality'});a.id='returning_'+i;a.name='Returning agent '+i;a.stats={hp:1,atk:1,def:1,int:50};a.sp=0;a.weaponId='legendary_revolver';return a;});save.reputation=10;g.maintainGuildBoards(save);const quest=save.wanted[0];let result;
 for(let seed=1;seed<100;seed++){const candidate=g.resolveQuest(save.roster,quest,seed);if(candidate.retreat.success&&candidate.events.some(e=>e.subtype==='weapon')){result=candidate;break;}}
 assert(result);assert(result.events.some(e=>e.subtype==='weapon'));save.pendingContract={quest,result,initialAllies:result.battleSnapshot.initialUnits.filter(u=>u.team==='ally'),initialEnemies:result.battleSnapshot.initialUnits.filter(u=>u.team==='enemy'),turnRows:[],currentTurn:0};
 const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test/guild_of_mystery/',runScripts:'dangerously'}),w=dom.window;
 try{
  w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,new URL(url).pathname.replace('/guild_of_mystery/','')),'utf8'))});w.eval(fs.readFileSync(path.join(root,'js/data-loader.js'),'utf8'));w.G9_DATA=await w.G9DataLoader.load();w.scrollTo=()=>{};w.setTimeout=()=>1;w.setInterval=()=>1;w.localStorage.setItem(key,JSON.stringify(save));w.eval(['vendor/dayjs.min','paths','v15','generate','traits','market','pathway-assets','signatures','mythical','battle-ai','engine','state','campaign','ui'].map(n=>fs.readFileSync(path.join(root,'js/'+n+'.js'),'utf8')).join('\n'));
  assert.match(w.document.querySelector('.retreat-result').textContent,/99 injuries/);const panel=w.document.querySelector('.encounter-feedback');assert.match(panel.textContent,/£0 · \+0 reputation/);assert.match(panel.textContent,/Returning agent 0 · \+0% digestion · 99\/100 injuries/);assert.equal(panel.querySelector('details').open,false);assert.match(panel.querySelector('details').textContent,/Last Witness/);
  w.G9.closeQuest();const after=JSON.parse(w.localStorage.getItem(key));assert.equal(after.roster.length,3);assert(after.roster.every(a=>a.injuries===99&&a.weaponId==='legendary_revolver'));assert.equal(after.pendingContract,null);assert.equal(after.day,save.day);
 }finally{dom.window.close();}
 console.log('Encounter feedback passed: real shared retreat, explicit failed rewards, individual injuries/digestion, collapsed weapon effects and saved settlement.');
})().catch(e=>{console.error(e);process.exitCode=1;});
