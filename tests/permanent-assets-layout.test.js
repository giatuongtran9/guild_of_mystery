'use strict';
// NODE_PATH=<Playwright node_modules> CHROMIUM_PATH=/usr/bin/chromium node tests/permanent-assets-layout.test.js
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),g=require('../js/node-loader'),loadout=require('../scripts/permanent-asset-loadouts');
const root=path.resolve(__dirname,'..'),key='guild-rpg-browser-v9',output=process.env.ASSET_BROWSER_OUTPUT;
function fixture(){
 const s=g.newGame();s.funds=1000;s.roster=[];
 for(const p of Object.keys(g.PATHWAY_COLLECTIONS)){
  const a=g.makeAgent(()=>.5,{path:p,sequence:5,trait:'Stout Vitality'});a.id='layout_'+p;a.name=g.pathOf(p).name+' Collector';g.restatAgent(a);a.sp=g.maxSPFor(a);loadout(g,a,'rare');const inv=a.pathwayInventory,c=g.pathwayCollection(a);
  if(['device','beast','spirit','formula','doctrine','conditioning'].includes(c.kind)){
   inv.assets=Object.entries(g.PATHWAY_ASSET_DEFINITIONS).filter(([,d])=>d.kind===c.kind).map(([id])=>({id:'layout_'+id,ownerId:a.id,kind:c.kind,definitionId:id,sequence:id==='fairy_tale_escape'?4:5,condition:'ready',hpRatio:1,sourceContract:'The Bell Beneath the River',sourceName:'An encounter with a returning guild party',acquiredDay:1}));
   inv.prepared=[inv.assets[0].id];
   if(p==='paragon'){inv.assets.at(-1).condition='wrecked';inv.assets.at(-1).hpRatio=0;}
   if(p==='moon')inv.assets[0].hpRatio=.5;
  }
  if(p==='fool')while(inv.assets.length<20)inv.assets.push({...JSON.parse(JSON.stringify(inv.assets[0])),id:'layout_puppet_'+inv.assets.length});
  s.roster.push(a);
 }
 return s;
}
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
 const hosted=process.env.ASSET_BASE_URL?null:await startServer(),url=process.env.ASSET_BASE_URL||hosted.url;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});const results=[];
 try{
  for(const width of [320,390,560,1440]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:!!process.env.ASSET_BASE_URL});
   await context.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));},{key,save:fixture()});
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!message.location().url.endsWith('/favicon.ico'))errors.push(message.text());});page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))errors.push(response.status()+' '+response.url());});
   await page.goto(url);await page.waitForFunction(()=>!!window.G9,{timeout:30000});await page.evaluate(()=>window.G9.tab('hall'));assert.equal(await page.locator('.agent .variance-box').count(),0);
   for(const p of Object.keys(g.PATHWAY_COLLECTIONS)){
    await page.evaluate(p=>window.G9.dossier('layout_'+p),p);
    assert.equal(await page.locator('.dossier-abilities[open], .dossier-inventory[open]').count(),0);assert.equal(await page.locator('#dossier-tab-active').isVisible(),false);
    if(output&&[390,1440].includes(width)&&p==='hanged_man'){fs.mkdirSync(output,{recursive:true});await page.waitForFunction(()=>{const image=document.querySelector('.dossier-portrait img');return image?.complete&&image.naturalWidth>0;});await page.screenshot({path:path.join(output,'dossier-collapsed-'+width+'.png')});}
    await page.locator('.dossier-abilities > summary').click();await page.locator('.dossier-inventory > summary').click();
    const dimensions=await page.evaluate(()=>{
     const panel=document.querySelector('.pathway-inventory'),modal=document.querySelector('.character-dossier'),tabs=document.querySelector('.dossier-skill-tabs'),box=panel.getBoundingClientRect();
     return {documentWidth:document.documentElement.scrollWidth,modalWidth:modal.clientWidth,modalScroll:modal.scrollWidth,panelWidth:panel.clientWidth,panelScroll:panel.scrollWidth,tabsWidth:tabs.clientWidth,tabsScroll:tabs.scrollWidth,cards:panel.querySelectorAll('[data-asset-id]').length,inside:[...panel.querySelectorAll('[data-asset-id]')].every(el=>{const r=el.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1;})};
    });
    assert(dimensions.documentWidth<=width,`${p} widens the document at ${width}px`);
    assert(dimensions.modalScroll<=dimensions.modalWidth+1,`${p} overflows its dossier at ${width}px`);
    assert(dimensions.panelScroll<=dimensions.panelWidth+1&&dimensions.inside,`${p} inventory cards overflow at ${width}px`);
    assert(dimensions.tabsScroll<=dimensions.tabsWidth+1,`ability tabs overflow at ${width}px`);assert(dimensions.cards>0);
    results.push({width,pathway:p,...dimensions});
    if(output&&width===390&&['hanged_man','paragon'].includes(p)){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,p+'-390.png')});}
   }
   await page.evaluate(()=>{window.G9.dossier('layout_hanged_man');window.G9.dossierSkillTab('active');});
   await page.locator('#dossier-tab-active').focus();await page.keyboard.press('End');assert.equal(await page.locator('#dossier-tab-passive').getAttribute('aria-selected'),'true');
   await page.locator('.dossier-inventory > summary').click();const modal=page.locator('.character-dossier');await modal.evaluate(el=>el.scrollTop=el.scrollHeight);
   await page.locator('.pathway-asset').first().getByRole('button',{name:'Unprepare',exact:true}).click();
   assert.equal(await page.locator('.dossier-abilities[open], .dossier-inventory[open]').count(),2);assert((await modal.evaluate(el=>el.scrollTop))>0);
   let saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(saved.roster.find(a=>a.path==='hanged_man').pathwayInventory.prepared.length,4);
   await page.reload();await page.waitForFunction(()=>!!window.G9);await page.evaluate(()=>{window.G9.dossier('layout_hanged_man');window.G9.dossierSkillTab('inventory');});
   assert.equal(await page.locator('.pathway-asset.is-prepared').count(),4);await page.locator('.pathway-asset-policy select').selectOption('hold');
   await page.evaluate(()=>{window.G9.dossier('layout_paragon');window.G9.dossierSkillTab('inventory');});await page.getByRole('button',{name:'Restore · £50',exact:true}).click();
   saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(saved.funds,950);assert.equal(saved.roster.find(a=>a.path==='paragon').pathwayInventory.assets.at(-1).condition,'ready');
   await page.evaluate(()=>{window.G9.dossier('layout_moon');window.G9.dossierSkillTab('inventory');});await page.getByRole('button',{name:'Rest · 3 days',exact:true}).click();
   saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(saved.roster.find(a=>a.path==='moon').pathwayInventory.assets[0].readyDay,saved.day+3);
   assert.deepEqual(errors,[]);await context.close();console.log(`PASS nine inventories, keyboard navigation, saved preparation, paid repair and recovery at ${width}px`);
  }
 }finally{await browser.close();if(hosted)await new Promise(resolve=>hosted.server.close(resolve));}
 if(output){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'browser-checks.json'),JSON.stringify({url,views:results.length,results},null,2)+'\n');}
 console.log(`Permanent inventory browser checks: ${results.length} views and four interaction/reload runs passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
