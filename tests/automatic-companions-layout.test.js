'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),g=require('../js/node-loader'),loadout=require('../scripts/permanent-asset-loadouts');
const root=path.resolve(__dirname,'..'),key='guild-rpg-browser-v9',output=process.env.AUTO_BROWSER_OUTPUT;
function fixture(){const s=g.newGame();s.roster=['fool','moon','paragon'].map(p=>{const a=g.makeAgent(()=>.5,{path:p,sequence:3,trait:'Stout Vitality'});a.id='entry_'+p;a.name=g.pathOf(p).name+' owner';g.restatAgent(a);a.sp=g.maxSPFor(a);loadout(g,a,'rare');return a;});return s;}
async function startServer(){
 const mime={'.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(error?'Not found':data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {server,url:'http://127.0.0.1:'+server.address().port+'/'};
}
(async()=>{
 const hosted=process.env.AUTO_BASE_URL?null:await startServer(),url=process.env.AUTO_BASE_URL||hosted.url,browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'}),results=[];
 try{for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',ignoreHTTPSErrors:!!process.env.AUTO_BASE_URL});await context.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));},{key,save:fixture()});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>!!window.G9);
  await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));window.G9.tab('quests');window.G9.plan(s.quests.find(q=>q.encounter).id);window.G9.selectedIds=s.roster.map(a=>a.id);window.G9.launch();},key);
  await page.waitForSelector('.gm-rank-allies .gm-arena-unit');const initial=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).pendingContract.initialAllies,key);assert.equal(initial.length,7);assert.equal(initial.filter(u=>u.summoned).length,4);
  assert.equal(await page.locator('.gm-rank-allies .gm-arena-unit').count(),7);for(const u of initial){const card=page.locator('[data-unit-id="'+u.id+'"]');assert.equal(await card.count(),1);assert((await card.textContent()).includes(u.name));assert.equal(await card.getAttribute('data-unit-role'),u.summoned||u.unitType==='marionette'?'companion':'character');}
  const dimensions=await page.evaluate(()=>{const row=document.querySelector('.gm-rank-allies'),arena=document.querySelector('.gm-dungeon-arena').getBoundingClientRect(),cards=Array.from(row.querySelectorAll('.gm-arena-unit'));return {documentWidth:document.documentElement.scrollWidth,rowWidth:row.clientWidth,rowScroll:row.scrollWidth,units:cards.length,allVisible:cards.every(node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=arena.left-1&&r.right<=arena.right+1&&r.top>=arena.top-1&&r.bottom<=arena.bottom+1;})};});assert(dimensions.documentWidth<=width,'companions cannot widen the page');assert(dimensions.allVisible,'all seven deployed units fit without scrolling');assert(dimensions.rowScroll<=dimensions.rowWidth+1,'formation does not hide companions behind scrolling');
  if(output){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'entry-'+width+'.png')});}
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);await page.reload();await page.waitForFunction(()=>!!window.G9);assert.equal(await page.evaluate(({key,pending})=>JSON.stringify(JSON.parse(localStorage.getItem(key)).pendingContract.result)===JSON.stringify(pending),{key,pending:saved.pendingContract.result}),true,'browser reload must keep the resolved battle');await page.evaluate(()=>window.G9.skipTicker());await page.evaluate(()=>window.G9.closeQuest());assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).pendingContract,key),null);assert.deepEqual(errors,[]);results.push({width,...dimensions,companions:4,settled:true});await context.close();console.log('PASS opening automatic companions, fully visible formation and settlement at '+width+'px');
 }}finally{await browser.close();if(hosted)await new Promise(resolve=>hosted.server.close(resolve));}
 if(output)fs.writeFileSync(path.join(output,'automatic-browser-checks.json'),JSON.stringify({url,results},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
