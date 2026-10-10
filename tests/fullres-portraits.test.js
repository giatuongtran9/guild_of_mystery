const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');
const g = require('../js/node-loader');
const root = path.resolve(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
function metadata(key, width = 1254, height = 1254) {
  return {full:{src:`${key}?v=0123456789abcdef`,width,height},portrait:{src:key.replace('characters/', 'runtime/characters/').replace('.png','.192.0123456789abcdef.webp'),width:192,height:192}};
}
function prefix() {
  const key = 'data/assets/characters/fool/fool_seq9.png';
  const c = {state:{roster:[]},window:{},G9_DATA:{runtimeAssets:{entries:{[key]:metadata(key)}}}};
  vm.createContext(c); vm.runInContext(ui.slice(0,ui.indexOf('function battlefieldImageFor')),c);
  return {c,key,render:options=>c.getCombatSprite({path:'fool',sequence:9,name:'Reader'},options)};
}
async function fixture() {
  const dom = new JSDOM('<div id="app"></div>',{url:'https://example.test/guild_of_mystery/',runScripts:'dangerously'}),w=dom.window;
  w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,new URL(url).pathname.replace('/guild_of_mystery/','')),'utf8'))});
  w.eval(fs.readFileSync(path.join(root,'js/data-loader.js'),'utf8'));w.G9_DATA=await w.G9DataLoader.load();
  const key='data/assets/characters/white_tower/white_tower_seq5.png';w.G9_DATA.runtimeAssets.entries[key].full=metadata(key).full;
  w.scrollTo=()=>{};w.setTimeout=()=>1;w.clearTimeout=()=>{};
  w.HTMLElement.prototype.getClientRects=function(){return [{width:100,height:30}];};
  Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{configurable:true,get(){return this.classList.contains('portrait-viewer-canvas')?360:390;}});
  Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{configurable:true,get(){return this.classList.contains('portrait-viewer-canvas')?580:844;}});
  const save=g.newGame(),a=g.makeAgent(()=>.5,{path:'white_tower',sequence:5,trait:'Stout Vitality'});a.id='fullres';a.name='Alden Voss';a.weaponId='knife';g.restatAgent(a);save.roster=[a];
  w.localStorage.setItem('guild-rpg-browser-v9',JSON.stringify(save));
  w.eval(['paths','v15','generate','signatures','mythical','engine','state','campaign','ui'].map(n=>fs.readFileSync(path.join(root,`js/${n}.js`),'utf8')).join('\n'));
  w.G9.tab('hall');w.G9.dossier(a.id);
  const opener=w.document.querySelector('.dossier-portrait-zoom');
  return {dom,w,opener,key,read:()=>w.localStorage.getItem('guild-rpg-browser-v9')};
}
function open(f) {assert(f.opener,'Accessible enlarge button must exist');f.opener.click();const viewer=f.w.document.querySelector('.portrait-viewer');assert(viewer);return viewer;}
function pointer(w,canvas,type,id,x,y=100) {const event=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:id,clientX:x,clientY:y});canvas.dispatchEvent(event);}
(async()=>{
  await test('default portraits use versioned original pixels at exact intrinsic dimensions',()=>{
    const {render,key}=prefix(),html=render();assert(html.includes(`src="${key}?v=0123456789abcdef"`));assert(html.includes('width="1254" height="1254"'));assert(html.includes('loading="lazy" decoding="async"'));
  });
  await test('non-square originals retain their width and height without square padding',()=>{
    const {c,key,render}=prefix();c.G9_DATA.runtimeAssets.entries[key]=metadata(key,1000,1400);assert(render().includes('width="1000" height="1400"'));
  });
  await test('missing full metadata falls back to the original rather than a downsized variant',()=>{
    const {c,key,render}=prefix();delete c.G9_DATA.runtimeAssets.entries[key].full;assert(render().includes(`src="${key}"`));assert(!render().includes('.192.'));
  });
  await test('invalid full URLs, dimensions and versions cannot enter image markup',()=>{
    const {c,key,render}=prefix();for(const change of [{src:'https://evil.test/a.png'},{src:`${key}?v=0123456789abcdef&extra=1`},{width:0},{height:1.5},{src:key+'?v=javascript:alert(1)'}]){c.G9_DATA.runtimeAssets.entries[key]={...metadata(key),full:{...metadata(key).full,...change}};assert(render().includes(`src="${key}"`));}
  });
  await test('legacy small variants remain available when explicitly requested',()=>{const {render}=prefix();assert(render({variant:'portrait'}).includes('.192.0123456789abcdef.webp'));});
  await test('enlargement uses the same full-resolution source and preserves dossier, focus and save',async()=>{
    const f=await fixture();try{const before=f.read(),dossier=f.w.document.querySelector('.character-dossier'),viewer=open(f),image=viewer.querySelector('img');assert(image.src.endsWith(f.key+'?v=0123456789abcdef'));assert.equal(viewer.getAttribute('role'),'dialog');assert.equal(viewer.getAttribute('aria-modal'),'true');assert(f.w.document.getElementById('app').inert);assert.equal(f.w.document.body.style.overflow,'hidden');assert(viewer.contains(f.w.document.activeElement));f.w.G9.portraitZoom(100);assert.equal(image.style.width,'1254px');assert.equal(image.style.height,'1254px');assert.equal(f.read(),before);f.w.document.activeElement.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(!f.w.document.querySelector('.portrait-viewer'));assert.equal(f.w.document.querySelector('.character-dossier'),dossier);assert.equal(f.w.document.activeElement,f.opener);assert(!f.w.document.getElementById('app').inert);assert.equal(f.w.document.body.style.overflow,'');assert.equal(f.read(),before);}finally{f.dom.window.close();}
  });
  await test('zoom controls clamp scale, fit the whole image and keep the viewer image node stable',async()=>{
    const f=await fixture();try{const viewer=open(f),image=viewer.querySelector('img');f.w.G9.portraitZoom(999);assert.equal(image.style.width,'2508px');f.w.G9.portraitZoom('invalid');assert.equal(image.style.width,'2508px');viewer.querySelector('[aria-label="Fit image"]').click();assert(parseFloat(image.style.width)<=360.01);viewer.querySelector('[aria-label="Actual size"]').click();assert.equal(image.style.width,'1254px');viewer.querySelector('[aria-label="Zoom out"]').click();assert(parseFloat(image.style.width)<1254);viewer.querySelector('[aria-label="Zoom in"]').click();assert.equal(viewer.querySelector('img'),image);}finally{f.dom.window.close();}
  });
  await test('two-finger pinch and single-finger drag zoom and pan without changing game state',async()=>{
    const f=await fixture();try{const viewer=open(f),canvas=viewer.querySelector('.portrait-viewer-canvas'),image=viewer.querySelector('img'),before=f.read();f.w.G9.portraitZoom(100);pointer(f.w,canvas,'pointerdown',1,100);pointer(f.w,canvas,'pointerdown',2,200);pointer(f.w,canvas,'pointermove',2,300);assert.equal(image.style.width,'2508px');pointer(f.w,canvas,'pointerup',2,300);const old=canvas.scrollLeft;pointer(f.w,canvas,'pointermove',1,60);assert(canvas.scrollLeft>old);pointer(f.w,canvas,'pointercancel',1,60);assert.equal(f.read(),before);}finally{f.dom.window.close();}
  });
  await test('keyboard focus stays in zoom and its close button restores the portrait opener',async()=>{
    const f=await fixture();try{const viewer=open(f),last=viewer.querySelector('.portrait-viewer-canvas');last.focus();last.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(f.w.document.activeElement,viewer.querySelector('[aria-label="Close portrait"]'));viewer.querySelector('[aria-label="Close portrait"]').click();assert.equal(f.w.document.activeElement,f.opener);}finally{f.dom.window.close();}
  });
  await test('arbitrary external or scripted images cannot open a full-resolution viewer',async()=>{
    const f=await fixture();try{assert.equal(typeof f.w.G9.openPortrait,'function');const fake=f.w.document.createElement('button');fake.innerHTML='<img src="https://evil.test/a.png">';f.w.G9.openPortrait(fake);assert(!f.w.document.querySelector('.portrait-viewer'));}finally{f.dom.window.close();}
  });
  await test('loaded image dimensions preserve actual aspect ratio and resize still fits the whole figure',async()=>{
    const f=await fixture();try{const viewer=open(f),image=viewer.querySelector('img');Object.defineProperty(image,'naturalWidth',{value:1000});Object.defineProperty(image,'naturalHeight',{value:1400});image.dispatchEvent(new f.w.Event('load'));f.w.G9.portraitZoom(100);assert.equal(image.style.width,'1000px');assert.equal(image.style.height,'1400px');viewer.querySelector('[aria-label="Fit image"]').click();f.w.dispatchEvent(new f.w.Event('resize'));assert(parseFloat(image.style.width)<=360.01);assert(parseFloat(image.style.height)<=580.01);}finally{f.dom.window.close();}
  });
  await test('image errors are readable and closing removes resize listeners without altering existing scroll lock',async()=>{
    const f=await fixture();try{let added=0,removed=0;const add=f.w.addEventListener.bind(f.w),remove=f.w.removeEventListener.bind(f.w);f.w.addEventListener=(type,...rest)=>{if(type==='resize')added++;return add(type,...rest);};f.w.removeEventListener=(type,...rest)=>{if(type==='resize')removed++;return remove(type,...rest);};f.w.document.body.style.overflow='scroll';const viewer=open(f),before=f.read();viewer.querySelector('img').dispatchEvent(new f.w.Event('error'));assert(!viewer.querySelector('.portrait-viewer-error').hidden);f.w.G9.closePortrait();assert.equal(added,1);assert.equal(removed,1);assert.equal(f.w.document.body.style.overflow,'scroll');assert.equal(f.read(),before);}finally{f.dom.window.close();}
  });
  await test('range input and Ctrl-wheel zoom while ordinary wheel leaves scale unchanged',async()=>{
    const f=await fixture();try{const viewer=open(f),range=viewer.querySelector('input'),canvas=viewer.querySelector('.portrait-viewer-canvas'),image=viewer.querySelector('img');range.value='100';range.dispatchEvent(new f.w.Event('input'));const before=parseFloat(image.style.width);canvas.dispatchEvent(new f.w.WheelEvent('wheel',{deltaY:-100,clientX:120,clientY:120}));assert.equal(parseFloat(image.style.width),before);canvas.dispatchEvent(new f.w.WheelEvent('wheel',{deltaY:-100,ctrlKey:true,clientX:120,clientY:120,cancelable:true}));assert(parseFloat(image.style.width)>before);canvas.dispatchEvent(new f.w.WheelEvent('wheel',{deltaY:100,ctrlKey:true,clientX:120,clientY:120,cancelable:true}));assert(parseFloat(image.style.width)<before*1.1);}finally{f.dom.window.close();}
  });
  console.log(`Full-resolution portraits: ${passed} passed, ${failed} failed.`);process.exitCode=failed?1:0;
})().catch(error=>{console.error(error);process.exitCode=1;});
