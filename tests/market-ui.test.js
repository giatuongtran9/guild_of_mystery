'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom'),g=require('../js/node-loader');
const root=path.resolve(__dirname,'..'),key='guild-rpg-browser-v9';
async function fixture(save){const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test/guild_of_mystery/',runScripts:'dangerously'}),w=dom.window;w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,new URL(url).pathname.replace('/guild_of_mystery/','')),'utf8'))});w.eval(fs.readFileSync(path.join(root,'js/data-loader.js'),'utf8'));w.G9_DATA=await w.G9DataLoader.load();w.scrollTo=()=>{};w.setTimeout=()=>1;w.setInterval=()=>1;w.clearTimeout=()=>{};w.confirm=()=>true;w.localStorage.setItem(key,JSON.stringify(save));w.eval(['vendor/dayjs.min','paths','v15','generate','traits','market','pathway-assets','signatures','mythical','engine','state','campaign','ui'].map(n=>fs.readFileSync(path.join(root,'js/'+n+'.js'),'utf8')).join('\n'));w.G9.tab('market');return {dom,w,read:()=>JSON.parse(w.localStorage.getItem(key))};}
(async()=>{
 const state=g.newGame();state.funds=20000;state.reputation=300;state.market.offers=['legendary_revolver','epic_knife','rare_sword','club'].map((weaponId,i)=>({id:'offer_'+i,weaponId}));let f=await fixture(state);
 try{
  assert.equal(f.w.document.querySelectorAll('.market-weapon').length,4);assert.equal(f.w.document.querySelectorAll('.market-material').length,21);assert.match(f.w.document.body.textContent,/Epic weapons unlock at 80 reputation; Legendary at 300/);
  const before=f.read(),original=f.w.Storage.prototype.setItem;f.w.Storage.prototype.setItem=()=>{throw Error('denied');};f.w.G9.buyWeapon('offer_0');assert.deepEqual(f.read(),before);assert.equal(f.w.document.querySelectorAll('.market-weapon').length,4);
  f.w.G9.buyMaterial('Spirit Thread',2);assert.deepEqual(f.read(),before);f.w.G9.refreshMarket();assert.deepEqual(f.read(),before);f.w.Storage.prototype.setItem=original;
  f.w.G9.buyWeapon('offer_0');assert.equal(f.read().weapons.legendary_revolver,1);assert.equal(f.read().funds,before.funds-g.WEAPONS.legendary_revolver.price);const once=f.read();f.w.G9.buyWeapon('offer_0');assert.deepEqual(f.read(),once);
  const funds=f.read().funds;f.w.G9.buyMaterial('Spirit Thread',2);assert.equal(f.read().funds,funds-500);assert.equal(f.read().materials['Spirit Thread'],state.materials['Spirit Thread']+2);
  const legacyFunds=f.read().funds;f.w.G9.buyMaterial('fool');assert.equal(f.read().funds,legacyFunds-250,'legacy material shortcuts use the same market price');
  const saved=f.read();f.dom.window.close();f=await fixture(saved);assert.equal(f.read().weapons.legendary_revolver,1);assert.equal(f.read().market.offers.length,3);
  const initial=f.read().funds;f.w.G9.refreshMarket();assert.equal(f.read().funds,initial-50);assert.equal(f.w.document.querySelectorAll('.market-weapon').length,4);
 }finally{f.dom.window.close();}
 const yesterday=g.newGame();yesterday.calendar.originDate=g.dayjs().subtract(1,'day').format('YYYY-MM-DD');yesterday.calendar.currentDate=yesterday.calendar.originDate;const oldIds=yesterday.market.offers.map(o=>o.id);f=await fixture(yesterday);try{assert.equal(f.read().day,2);assert.equal(f.read().funds,yesterday.funds);assert(f.read().market.offers.every(o=>!oldIds.includes(o.id)));}finally{f.dom.window.close();}
 console.log('Market UI passed: rendered rarity gates, chosen purchases, denied-save rollback, shared material pricing, reload, paid refresh and free real-day refresh.');
})().catch(e=>{console.error(e);process.exitCode=1});
