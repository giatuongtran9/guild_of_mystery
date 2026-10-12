'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom'),g=require('../js/node-loader');
const root=path.resolve(__dirname,'..'),key='guild-rpg-browser-v9';
const copy=x=>JSON.parse(JSON.stringify(x));
async function fixture(save,corrupt=false){
 const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test/guild_of_mystery/',runScripts:'dangerously'}),w=dom.window;
 w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,new URL(url).pathname.replace('/guild_of_mystery/',''))))});w.eval(fs.readFileSync(path.join(root,'js/data-loader.js'),'utf8'));w.G9_DATA=await w.G9DataLoader.load();
 w.scrollTo=()=>{};w.confirm=()=>true;w.matchMedia=()=>({matches:false});w.setTimeout=()=>1;w.clearTimeout=()=>{};
 if(save)w.localStorage.setItem(key,JSON.stringify(save));if(corrupt)w.localStorage.setItem(key,'broken save');
 w.eval(['paths','v15','generate','traits','signatures','mythical','engine','state','campaign','ui'].map(n=>fs.readFileSync(path.join(root,`js/${n}.js`),'utf8')).join('\n'));
 const original=w.Storage.prototype.setItem;
 return {dom,w,saved:()=>JSON.parse(w.localStorage.getItem(key)),deny:()=>{w.Storage.prototype.setItem=()=>{throw new Error('storage denied');};},allow:()=>{w.Storage.prototype.setItem=original;}};
}
function actor(id,pathway='fool'){const a=g.makeAgent(()=>.5,{sequence:9,path:pathway,traitId:'hardy'});a.id=id;a.name=id;g.restatAgent(a);a.sp=g.maxSPFor(a);a.weaponId='knife';return a;}
async function main(){
 let f=await fixture();assert(f.saved());const first=f.saved();f.dom.window.close();f=await fixture(first);assert.deepEqual(f.saved().recruitPool.map(a=>a.id),first.recruitPool.map(a=>a.id));f.dom.window.close();
 const s=g.newGame(),ordinary=g.makeAgent(()=>.5,{sequence:10,traitId:'hardy'}),a=actor('a'),b=actor('b','tyrant'),c=actor('c','mother');
 s.roster=[ordinary,a,b,c];s.funds=10000;s.reputation=10;a.digest=100;a.injuries=30;g.maintainGuildBoards(s);
 const actions=[w=>w.G9.choosePath(ordinary.id,'door'),w=>w.G9.advance(a.id),w=>w.G9.heal(a.id),w=>w.G9.buyMaterial('fool'),w=>w.G9.setWeapon(a.id,'sword'),w=>w.G9.decline(s.quests[0].id),w=>w.G9.declineWanted(s.wanted[0].id),w=>w.G9.reset()];
 for(const action of actions){f=await fixture(s);const before=f.w.localStorage.getItem(key);f.deny();action(f.w);assert.equal(f.w.localStorage.getItem(key),before);assert.match(f.w.document.body.textContent,/could not be saved/);f.dom.window.close();}
 f=await fixture(s,true);assert.equal(f.w.localStorage.getItem(key),'broken save');f.w.G9.buyMaterial('fool');assert.equal(f.w.localStorage.getItem(key),'broken save');f.w.G9.reset();assert.equal(f.saved().funds,1000);f.dom.window.close();
 const day=copy(s);day.day=7;day.recruitRefreshDay=8;f=await fixture(day);const pool=f.saved().recruitPool.map(a=>a.id);f.w.G9.choosePath(ordinary.id,'door');assert.equal(f.saved().day,8);assert(f.saved().recruitPool.every(a=>!pool.includes(a.id)));assert.equal(f.saved().recruitRefreshDay,15);f.dom.window.close();
 f=await fixture(s);f.w.G9.plan(s.quests[0].id);f.w.G9.toggleAssign(b.id);const before=f.w.localStorage.getItem(key);f.deny();f.w.G9.launch();assert.equal(f.w.localStorage.getItem(key),before);assert(!f.saved().pendingContract);
 f.allow();f.w.G9.launch();assert(f.saved().pendingContract);const pending=f.saved().pendingContract,stored=f.saved();f.dom.window.close();
 f=await fixture(stored);assert.deepEqual(f.saved().pendingContract.result,pending.result);f.w.G9.skipTicker();f.deny();f.w.G9.closeQuest();assert(f.saved().pendingContract);assert.equal(f.saved().funds,stored.funds);
 f.allow();f.w.G9.closeQuest();assert.equal(f.saved().pendingContract,null);assert.equal(f.saved().funds,stored.funds+pending.result.rewards.funds);
 const returned=f.saved().roster.find(x=>x.id===b.id),synced=pending.result.consequences.find(x=>x.type==='syncAgent'&&x.agentId===b.id);if(returned&&synced)assert.equal(returned.digest,synced.agent.digest,'no UI-only digestion bonus');
 const once=f.w.localStorage.getItem(key);f.w.G9.closeQuest();assert.equal(f.w.localStorage.getItem(key),once);f.dom.window.close();
 f=await fixture(s);f.w.G9.planWanted(s.wanted[0].id);f.w.G9.toggleAssign(b.id);f.w.G9.launch();assert(!f.saved().pendingContract);assert.match(f.w.document.body.textContent,/three awakened Beyonders/);f.dom.window.close();
 console.log('Persistence UI checks passed: initial save, reload, eight denied mutations, corrupt-save protection, atomic reset, day refresh, pending battle reload, repeat-safe settlement, correct digestion and boss party gate.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
