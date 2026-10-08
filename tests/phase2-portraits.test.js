const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/ui.js'), 'utf8');
const context = {state:{roster:[]},window:{innerWidth:390,innerHeight:844},G9_DATA:{runtimeAssets:{entries:{}}}};
vm.createContext(context);
vm.runInContext(source.slice(0,source.indexOf('function battlefieldImageFor')),context);
let passed=0,failed=0;
const check=(label,fn)=>{try{fn();passed++;console.log('PASS '+label);}catch(e){failed++;console.error('FAIL '+label+': '+e.message);}};
const sourcePath='data/assets/characters/fool/fool_seq9.png';
const portrait='data/assets/runtime/characters/fool/fool_seq9.192.0123456789abcdef.webp';
const dossier='data/assets/runtime/characters/fool/fool_seq9.384.0123456789abcdef.png';
context.G9_DATA.runtimeAssets.entries[sourcePath]={portrait:{src:portrait,width:192,height:192},dossier:{src:dossier,width:384,height:384}};
const unit={path:'fool',sequence:9,name:'<Reader>'};
const render=options=>context.getCombatSprite(unit,options);
check('small UI uses the generated versioned runtime portrait',()=>assert(render().includes('src="'+portrait+'"')));
check('dossier uses its separate mid-size portrait',()=>assert(render({variant:'dossier'}).includes('src="'+dossier+'"')));
check('runtime portraits have intrinsic dimensions',()=>assert(render().includes('width="192" height="192"')));
check('dossier reserves the mid-size dimensions',()=>assert(render({variant:'dossier'}).includes('width="384" height="384"')));
check('default offscreen portraits are lazy and asynchronously decoded',()=>assert(render().includes('loading="lazy" decoding="async"')));
check('default portraits do not request high priority',()=>assert(!render().includes('fetchpriority="high"')));
check('explicit visible party option is eager and high priority',()=>assert(render({loading:'eager',priority:'high'}).includes('loading="eager" decoding="async" fetchpriority="high"')));
check('lazy portraits cannot receive high priority',()=>assert(!render({priority:'high'}).includes('fetchpriority="high"')));
check('sprite names remain escaped',()=>assert(render().includes('&lt;R')));
check('runtime failure falls back to untouched original then legacy then initials',()=>{
 const html=render();const fallback={style:{display:'none'}};const img={style:{},parentElement:{querySelector:()=>fallback}};
 new Function(html.match(/onerror="([^"]+)"/)[1]).call(img);
 assert.equal(img.src,sourcePath);img.onerror();assert.equal(img.src,'data/assets/characters/fool/seq9.png');img.onerror();assert.equal(img.style.display,'none');assert.equal(fallback.style.display,'flex');
});
const entry=context.G9_DATA.runtimeAssets.entries[sourcePath];
for(const bad of ['https://evil.test/a.webp','javascript:alert(1)','data/assets/runtime/characters/../evil.webp','data/assets/runtime/characters/fool/a.svg','data/assets/runtime/characters/fool/a.webp']){
 check('invalid runtime URL is rejected: '+bad,()=>{const prev=entry.portrait.src;entry.portrait.src=bad;try{assert(render().includes('src="'+sourcePath+'"'));}finally{entry.portrait.src=prev;}});
}
check('missing runtime metadata keeps the original art fallback',()=>{delete context.G9_DATA.runtimeAssets.entries[sourcePath];assert(render().includes('src="'+sourcePath+'"'));context.G9_DATA.runtimeAssets.entries[sourcePath]=entry;});
function image(rect){return {loading:'lazy',fetchPriority:'auto',getBoundingClientRect:()=>rect};}
const visible=image({top:20,bottom:90,left:10,right:80,width:70,height:70});
const below=image({top:1000,bottom:1070,left:10,right:80,width:70,height:70});
const hidden=image({top:0,bottom:0,left:0,right:0,width:0,height:0});
context.document={querySelectorAll:()=>[visible,below,hidden]};
check('only visible party portraits are promoted',()=>{context.prioritizeVisiblePartyPortraits();assert.equal(visible.loading,'eager');assert.equal(visible.fetchPriority,'high');});
check('offscreen and hidden portraits remain lazy',()=>{context.prioritizeVisiblePartyPortraits();assert.equal(below.loading,'lazy');assert.equal(hidden.loading,'lazy');assert.equal(below.fetchPriority,'auto');});
console.log(`${passed} passed, ${failed} failed`);if(failed)process.exitCode=1;
