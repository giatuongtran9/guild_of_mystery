const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let passed=0,failed=0;
async function check(label,fn){try{await fn();passed++;console.log('PASS '+label);}catch(e){failed++;console.error('FAIL '+label+': '+e.message);}}
function worker(options={}){
 const events={},files=new Map(),stats={fetches:0,skipped:0,claimed:0};
 const self={registration:{scope:'https://example.test/guild_of_mystery/'},location:{origin:'https://example.test'},addEventListener:(k,f)=>events[k]=f,skipWaiting:async()=>stats.skipped++,clients:{claim:async()=>stats.claimed++}};
 const caches={open:async()=>{if(options.openFail)throw Error('unavailable');return {match:async req=>files.get(req.url)?.clone(),put:async(req,res)=>{if(options.putFail)throw Error('quota');files.set(req.url,res.clone());}};}};
 const fetch=async()=>{stats.fetches++;return new Response(options.status===404?'missing':'asset',{status:options.status||200});};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),{self,caches,fetch,URL});
 const request=(relative,init={})=>new Request(new URL(relative,self.registration.scope),init);
 const dispatch=async req=>{let promise=null;events.fetch({request:req,respondWith:p=>promise=p});return promise?await promise:null;};
 return {events,files,stats,request,dispatch};
}
const old='data/assets/runtime/characters/fool/fool_seq9.192.0123456789abcdef.webp';
const next='data/assets/runtime/characters/fool/fool_seq9.192.fedcba9876543210.webp';
(async()=>{
 await check('hashed portraits are stored durably and reused',async()=>{const w=worker();assert.equal(await(await w.dispatch(w.request(old))).text(),'asset');await w.dispatch(w.request(old));assert.equal(w.stats.fetches,1);assert.equal(w.files.size,1);});
 await check('new portrait versions fetch without deleting old versions',async()=>{const w=worker();await w.dispatch(w.request(old));await w.dispatch(w.request(next));assert.equal(w.stats.fetches,2);assert.equal(w.files.size,2);});
 await check('hashed data bundles are cached',async()=>{const w=worker();const r=w.request('data/runtime/data.0123456789abcdef.json');await w.dispatch(r);await w.dispatch(r);assert.equal(w.stats.fetches,1);});
 await check('versioned ordered game modules are cached',async()=>{const w=worker();const r=w.request('js/engine.js?v=0123456789abcdef');await w.dispatch(r);await w.dispatch(r);assert.equal(w.stats.fetches,1);});
 for(const asset of ['js/data-loader.js','js/boot.js','css/components/modals.css']){
  await check('versioned bootstrap and styles are durable: '+asset,async()=>{const w=worker();const r=w.request(asset+'?v=0123456789abcdef');assert.notEqual(await w.dispatch(r),null);await w.dispatch(r);assert.equal(w.stats.fetches,1);});
 }
 for(const rel of ['index.html','data/runtime/manifest.json','data/assets/characters/fool/fool_seq9.png','js/engine.js','https://example.test/other-app/data/runtime/data.0123456789abcdef.json','https://evil.test/guild_of_mystery/'+old]){
  await check('mutable/unrelated URL bypasses service worker: '+rel,async()=>{const w=worker();assert.equal(await w.dispatch(w.request(rel)),null);assert.equal(w.stats.fetches,0);});
 }
 await check('non-GET requests bypass caching',async()=>{const w=worker();assert.equal(await w.dispatch(w.request(old,{method:'POST',body:'private'})),null);});
 await check('authenticated requests bypass caching',async()=>{const w=worker();assert.equal(await w.dispatch(w.request(old,{headers:{Authorization:'Bearer private-test-value'}})),null);});
 await check('range requests bypass caching',async()=>{const w=worker();assert.equal(await w.dispatch(w.request(old,{headers:{Range:'bytes=0-100'}})),null);});
 await check('failed HTTP responses are not made durable',async()=>{const w=worker({status:404});await w.dispatch(w.request(old));await w.dispatch(w.request(old));assert.equal(w.stats.fetches,2);assert.equal(w.files.size,0);});
 await check('unavailable cache keeps live fetching functional',async()=>{const w=worker({openFail:true});assert.equal(await(await w.dispatch(w.request(old))).text(),'asset');assert.equal(w.stats.fetches,1);});
 await check('quota failure does not lose a successful response',async()=>{const w=worker({putFail:true});assert.equal(await(await w.dispatch(w.request(old))).text(),'asset');assert.equal(w.stats.fetches,1);});
 await check('activation claims current clients without caching documents',async()=>{const w=worker();let job;w.events.install({waitUntil:p=>job=p});await job;w.events.activate({waitUntil:p=>job=p});await job;assert.equal(w.stats.skipped,1);assert.equal(w.stats.claimed,1);assert.equal(w.files.size,0);});
 console.log(`${passed} passed, ${failed} failed`);if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
