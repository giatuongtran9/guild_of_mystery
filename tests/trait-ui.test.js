// NODE_PATH=<jsdom node_modules> node tests/trait-ui.test.js
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),g=require('../js/node-loader');
async function main(){
 const root=path.resolve(__dirname,'..'),dom=new JSDOM('<div id="app"></div>',{url:'https://example.test/guild_of_mystery/',runScripts:'dangerously'}),w=dom.window;
 w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,new URL(url).pathname.replace('/guild_of_mystery/','')),'utf8'))});
 w.eval(fs.readFileSync(path.join(root,'js/data-loader.js'),'utf8'));w.G9_DATA=await w.G9DataLoader.load();
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:false});
 const timers=new Map();let next=0;w.setTimeout=fn=>{timers.set(++next,fn);return next;};w.clearTimeout=id=>timers.delete(id);
 const fixture=g.newGame();fixture.funds=1000;
 const ids=['hardy','glass_cannon','wardbreaker','fates_debt'];
 fixture.recruitPool=ids.map((traitId,i)=>{const a=g.makeAgent(()=>.5,{traitId,sequence:10});a.id='candidate-'+i;return a;});
 w.localStorage.setItem('guild-rpg-browser-v9',JSON.stringify(fixture));
 w.eval(['paths','v15','generate','traits','pathway-assets','signatures','mythical','engine','state','campaign','ui'].map(name=>fs.readFileSync(path.join(root,`js/${name}.js`),'utf8')).join('\n'));
 w.G9.tab('recruit');
 assert.equal(w.document.querySelectorAll('.recruit').length,4);assert.equal(w.document.querySelectorAll('.trait-badge').length,4);
 assert.match(w.document.body.textContent,/Normal 74%/);assert.match(w.document.body.textContent,/Rare 20%/);assert.match(w.document.body.textContent,/Epic 5%/);assert.match(w.document.body.textContent,/Legendary 1%/);
 assert.match(w.document.body.textContent,/Refresh · £50/);assert.match(w.document.body.textContent,/Activates after awakening/);assert(!('hireRandom' in w.G9));
 assert.equal(w.document.querySelectorAll('.recruit .stats').length,0);
 assert(!/Recommended/i.test(w.document.body.textContent));
 w.G9.recruitInfo(fixture.recruitPool[0].id);assert(!/Recommended/i.test(w.document.body.textContent));
 const saved=()=>JSON.parse(w.localStorage.getItem('guild-rpg-browser-v9'));
 const before=saved(),originalSet=w.Storage.prototype.setItem;
 w.Storage.prototype.setItem=function(){throw new Error('storage denied');};w.G9.refreshRecruit();assert.deepEqual(saved(),before);assert.equal(w.document.querySelectorAll('.recruit')[0].querySelector('h3').textContent,before.recruitPool[0].name);
 w.Storage.prototype.setItem=originalSet;w.G9.refreshRecruit();const refreshed=saved();assert.equal(refreshed.funds,950);assert.equal(refreshed.day,before.day);assert.equal(refreshed.recruitPool.length,4);assert(refreshed.recruitPool.every(a=>!before.recruitPool.some(b=>b.id===a.id)));
 w.G9.refreshRecruit();assert.equal(saved().funds,950,'repeated activation during reveal cannot double-charge');
 w.G9.skipRecruitReveal();assert.equal(saved().funds,950);const selected=saved().recruitPool[2];w.G9.hire(selected.id);const hired=saved();assert.equal(hired.funds,800);assert.equal(hired.roster[0].traitId,selected.traitId);assert.equal(hired.recruitPool.length,3);
 w.G9.hire(selected.id);assert.equal(saved().funds,800);w.G9.tab('hall');assert(w.document.querySelector('.agent .trait-badge'));
 assert.equal(w.document.querySelectorAll('.agent .stats').length,0);
 assert(!/Recommended/i.test(w.document.body.textContent));
 w.G9.dossier(selected.id);
 assert.equal(w.document.querySelectorAll('.dossier-stats').length,0);
 assert.equal(w.document.querySelectorAll('.dossier-equipment').length,0);
 assert.equal(w.document.querySelectorAll('.path-choice').length,22);
 assert.equal(w.document.querySelectorAll('.path-choice.recommended').length,0);
 assert(!/Recommended|Current ATK/i.test(w.document.querySelector('.character-dossier').textContent));
 w.G9.choosePath(selected.id,'door');
 const awakened=saved().roster[0];assert.equal(awakened.path,'door');assert.equal(awakened.awakened,true);
 assert(!('recommendedPath' in awakened));
 assert(w.document.querySelector('.dossier-stats'));assert(w.document.querySelector('.dossier-equipment'));assert(w.document.querySelector('.variance-box'));
 for(const value of Object.values(awakened.statVariance))assert(value>=.9&&value<=1.1);
 w.G9.closeDossier();assert(w.document.querySelector('.agent .stats'));
 w.G9.tab('simulator');
 // The actual simulator tab name is exposed by the existing navigation.
 if(!w.document.querySelector('.battle-simulator')){const button=[...w.document.querySelectorAll('nav button')].find(b=>/Simulat/.test(b.textContent));assert(button);button.click();}
 assert.equal(w.document.querySelectorAll('.sim-unit select').length,6);w.G9.simSet('A',0,'traitId','blood_script');w.G9.simSet('B',0,'traitId','hollow_saint');
 const guildBefore=saved();w.G9.runSimulation();assert.deepEqual(saved(),guildBefore,'simulation must never change the guild save');assert(w.document.querySelector('.sim-result'));
 // Fresh runtime loading must retain a committed pool rather than roll another one.
 const migrated=g.migrateSave(saved());assert.deepEqual(migrated.recruitPool.map(a=>a.traitId),saved().recruitPool.map(a=>a.traitId));
 dom.window.close();console.log('Trait UI checks passed: tier labels, activation, exact rates, save failure, paid refresh, repeat-click guard, chosen hiring, and simulator isolation.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
