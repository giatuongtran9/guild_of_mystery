// Full shipped UI interactions. NODE_PATH=/tmp/guild-ui-check/node_modules node tests/phase2-modal-dom.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const g = require('../js/node-loader');
const root = path.resolve(__dirname, '..');
const uiPath = process.env.MODAL_UI_SOURCE || path.join(root, 'js/ui.js');
let passed = 0, failed = 0;
async function fixture(unsafeId = false) {
  const dom = new JSDOM('<div id="app"></div>', {url:'https://example.test/guild_of_mystery/',runScripts:'dangerously'});
  const w = dom.window;
  w.fetch = async url => ({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root, new URL(url).pathname.replace('/guild_of_mystery/', '')), 'utf8'))});
  w.eval(fs.readFileSync(path.join(root, 'js/data-loader.js'), 'utf8')); w.G9_DATA = await w.G9DataLoader.load();
  w.scrollTo=()=>{}; w.setTimeout=()=>1; w.clearTimeout=()=>{}; w.confirm=()=>false;
  w.HTMLElement.prototype.getClientRects=function(){
    const hidden = Array.from(this.closest('.character-dossier')?.querySelectorAll('details:not([open])')||[]).some(d=>d.contains(this)&&this!==d.querySelector('summary'));
    return hidden?[]:[{width:100,height:30}];
  };
  const state=g.newGame(), a=g.makeAgent(()=>.5,{path:'white_tower',sequence:5,trait:'Stout Vitality'});
  a.id=unsafeId?"modal');alert('unsafe');//":'modal_dom';a.name='Mara Vale';a.injuries=31;a.digest=63;a.weaponId='knife';g.restatAgent(a);
  state.roster=[a];state.funds=10000;state.materials[g.pathOf(a.path).material]=10;state.weapons.revolver=1;
  w.localStorage.setItem('guild-rpg-browser-v9',JSON.stringify(state));
  w.eval(['paths','v15','generate','engine','state','campaign'].map(n=>fs.readFileSync(path.join(root,`js/${n}.js`),'utf8')).join('\n')+'\n'+fs.readFileSync(uiPath,'utf8'));
  w.G9.tab('hall');
  return {dom,w,a,read:()=>JSON.parse(w.localStorage.getItem('guild-rpg-browser-v9'))};
}
async function test(label, fn){try{await fn();passed++;console.log(`PASS ${label}`);}catch(e){failed++;console.log(`FAIL ${label}: ${e.message}`);}}
(async()=>{
  await test('opening focuses a labeled compact dialog and uses a fixed-size dossier portrait',async()=>{
    const {dom,w,a}=await fixture();try{
      w.G9.dossier(a.id);const dialog=w.document.querySelector('[role="dialog"]');assert(dialog);
      assert.equal(dialog.getAttribute('aria-labelledby'),'dossier-title');assert.equal(w.document.activeElement.id,'dossier-title');
      assert.equal(Number(dialog.querySelector('.dossier-portrait img').getAttribute('width')),w.G9_DATA.runtimeAssets.entries['data/assets/characters/white_tower/white_tower_seq5.png'].full.width);
      assert.equal(dialog.querySelector('.dossier-portrait img').getAttribute('decoding'),'async');
    }finally{dom.window.close();}
  });
  await test('tabs and rank selector update the actual visible skill description and focus',async()=>{
    const {dom,w,a}=await fixture();try{
      w.G9.dossier(a.id);w.document.getElementById('dossier-tab-passive').click();
      assert.equal(w.document.activeElement.id,'dossier-tab-passive');assert.equal(w.document.activeElement.getAttribute('aria-selected'),'true');
      assert(w.document.getElementById('dossier-skill-panel').textContent.includes('Predictive Guard'));
      const ranks=w.document.querySelector('.dossier-rank-picker select');ranks.value='9';ranks.dispatchEvent(new w.Event('change',{bubbles:true}));
      assert(w.document.getElementById('dossier-skill-panel').textContent.includes('Combat Analysis'));
      assert(w.document.activeElement.matches('.dossier-rank-picker select'));
    }finally{dom.window.close();}
  });
  await test('arrow, Home and End keys select tabs; Escape closes and restores opener focus',async()=>{
    const {dom,w,a}=await fixture();try{
      const opener=w.document.querySelector('.tabs [aria-current="page"]');opener.focus();w.G9.dossier(a.id);
      w.document.getElementById('dossier-tab-active').focus();
      for(const [key,expected] of [['ArrowRight','passive'],['ArrowLeft','active'],['End','passive'],['Home','active']]){
        w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));assert.equal(w.document.activeElement.id,`dossier-tab-${expected}`);
      }
      w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      assert.equal(w.document.querySelector('.character-dossier'),null);assert(w.document.activeElement.matches('.tabs [aria-current="page"]'));
    }finally{dom.window.close();}
  });
  await test('Tab and Shift+Tab stay inside the dialog and ignore collapsed controls',async()=>{
    const {dom,w,a}=await fixture();try{
      w.G9.dossier(a.id);w.document.querySelector('.dossier-footer button').focus();
      w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert(w.document.activeElement.matches('.character-dossier .close'));
      w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert(w.document.activeElement.matches('.dossier-footer button'));
    }finally{dom.window.close();}
  });
  await test('equipment and injury treatment still run the original mutations and preserve progression',async()=>{
    const {dom,w,a,read}=await fixture();try{
      w.G9.dossier(a.id);const before=read();const picker=w.document.querySelector('.equipment-select select');picker.value='revolver';picker.dispatchEvent(new w.Event('change',{bubbles:true}));
      assert.equal(read().roster[0].weaponId,'revolver');assert.equal(read().roster[0].digest,before.roster[0].digest);
      w.document.querySelector('.dossier-details').open=true;const heal=Array.from(w.document.querySelectorAll('.character-dossier button')).find(x=>x.textContent==='Treat injuries');assert(heal);heal.click();
      assert.equal(read().roster[0].injuries,0);assert(read().funds<before.funds);assert.equal(read().roster[0].sequence,5);assert.equal(read().roster[0].digest,63);
    }finally{dom.window.close();}
  });
  await test('saved IDs containing quotes cannot inject JavaScript into modal actions',async()=>{
    const {dom,w,a}=await fixture(true);try{
      w.G9.dossier(a.id);let alerts=0;w.alert=()=>alerts++;
      const advance=Array.from(w.document.querySelectorAll('button')).find(x=>x.textContent==='Review Advancement');assert(advance);advance.click();
      assert.equal(alerts,0,'No saved identifier can execute an extra statement');
      const picker=w.document.querySelector('.equipment-select select');picker.value='revolver';picker.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(alerts,0);
    }finally{dom.window.close();}
  });
  console.log(`\nPhase 2 modal DOM: ${passed} passed, ${failed} failed.`);process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
