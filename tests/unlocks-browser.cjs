const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const ctx=await browser.newContext({viewport:{width:834,height:1194},hasTouch:true});const p=await ctx.newPage();const errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 const base=process.env.GUIDE_URL||'http://127.0.0.1:4173/';
 await p.goto(base+'#technology');
 assert.equal(await p.evaluate(()=>UNLOCK_DATA.technologies.length),226);assert.equal(await p.evaluate(()=>UNLOCK_DATA.inspirations.length),73);
 const audit=await p.evaluate(()=>{
  const U=UNLOCK_DATA,T=new Map(U.technologies.map(t=>[t.id,t]));const errors=[];
  for(const t of U.technologies){for(const id of [...t.parents,...t.children])if(!T.has(id))errors.push('missing '+id);for(const r of t.unlocks.Recipes||[]){const id=r.url.split('#')[1];if(!GAME_DATA.items.some(i=>i.id===id))errors.push('missing recipe item '+id)}}
  const visit=(id,path=[])=>{if(path.includes(id)){errors.push('cycle '+id);return}for(const p of T.get(id).parents)visit(p,[...path,id])};for(const t of U.technologies)visit(t.id);
  return errors;
 });assert.deepEqual(audit,[]);
 await p.locator('#search').fill('Wooden Plank');assert.ok(await p.locator('.tech-node').count()>0);await p.locator('.tech-node').filter({has:p.getByRole('heading',{name:'Woodworking I',exact:true})}).locator('a').filter({hasText:'Explore unlock path'}).click();
 assert.match(await p.locator('.tech-path').innerText(),/The Concept of Wood/);
 await p.locator('[data-tech=work_with_wood_1]').check();assert.ok(await p.evaluate(()=>KeeperLedger.getSave().technologies.includes('work_with_wood_1')));
 await p.locator('.unlock-group a[href^="#crafting?"]').first().click();await p.locator('.recipe').first().waitFor();assert.match(await p.locator('#main').innerText(),/Wooden Plank/);assert.ok(await p.locator('.recipe').count()>0);
 assert.ok(await p.locator('.recipe a[href^="#technology?"]').count()>0);
  await p.locator('.recipe [data-item]').first().click();
  await p.locator('#detail a[href^="#technology?"]').first().click();
  assert.equal(await p.locator('#detail').evaluate(e=>e.open),false);
 await p.goto(base+'#inspirations');await p.locator('#search').fill('Wooden Plank');assert.ok(await p.locator('.inspiration-card').count()>0);await p.locator('.inspiration-card summary').first().click();
 assert.ok(await p.locator('.inspiration-card[open] a[href^="#crafting?"]').count()>0);
 const selector=p.locator('.inspiration-card[open] select');const inspId=await selector.getAttribute('data-inspiration');await selector.selectOption('1');
 await p.reload();assert.equal(await p.evaluate(id=>KeeperLedger.getSave().inspirations[id],inspId),1);
 await p.goto(base+'#inspirations?node=insp_perform_prayers');assert.ok(await p.locator('[data-inspiration=insp_perform_prayers]').isDisabled());assert.match(await p.locator('#main').innerText(),/Cannot currently be completed/);
 await p.goto(base+'#technology?node=tool_rack');assert.match(await p.locator('.tech-path').innerText(),/Woodworking I/);assert.match(await p.locator('.tech-path').innerText(),/The Concept of Stone/);
 const compatibility=await p.evaluate(async()=>{const s=KeeperLedger.getSave();delete s.technologies;delete s.inspirations;const migrated=KeeperLedger.validate(s);const fp1=await KeeperSyncCore.fingerprint(s),fp2=await KeeperSyncCore.fingerprint(migrated);return{tech:migrated.technologies,insp:migrated.inspirations,same:fp1===fp2}});assert.deepEqual(compatibility,{tech:[],insp:{},same:true});
 await p.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'keeper-technology-ipad.png'),fullPage:true});
 await p.goto(base+'#map');await p.locator('[data-zoom="1"]').click();await p.locator('[data-zoom="1"]').click();
 const vp=p.locator('.map-viewport');await vp.scrollIntoViewIfNeeded();const box=await vp.boundingBox();const before=await vp.evaluate(e=>({x:e.scrollLeft,y:e.scrollTop}));
 await p.mouse.move(box.x+box.width*.7,box.y+box.height*.7);await p.mouse.down();await p.mouse.move(box.x+box.width*.7-120,box.y+box.height*.7-100,{steps:10});await p.mouse.up();
 const after=await vp.evaluate(e=>({x:e.scrollLeft,y:e.scrollTop}));assert.ok(after.x>before.x+80,'mouse x pan');assert.ok(after.y>before.y+60,'mouse y pan');assert.equal(await p.locator('.is-panning').count(),0);
 assert.equal(await p.locator('.map-canvas>img').getAttribute('draggable'),'false');
 // Touch remains native: send a real touch gesture through Chromium.
 const cdp=await ctx.newCDPSession(p);const touchBefore=await vp.evaluate(e=>e.scrollTop);const x=box.x+box.width*.5,y=box.y+box.height*.6;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let n=1;n<=8;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-n*12}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(250);assert.ok(await vp.evaluate(e=>e.scrollTop)>touchBefore+30,'touch pan');
 await p.locator('.map-list [data-marker]').first().click();assert.match(await p.locator('#map-info').innerText(),/Mark visited|Visited/);
 for(const width of [390,834,1194]){await p.setViewportSize({width,height:1000});await p.goto(base+'#inspirations?node='+inspId);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'inspiration overflow '+width);await p.goto(base+'#technology?node=tool_rack');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'technology overflow '+width);}
 assert.deepEqual(errors,[]);await browser.close();console.log('Unlock data references, searchable sections, prerequisite paths, recipe links, tracking, legacy saves, mouse/touch map pan and responsive layouts passed.');
})().catch(e=>{console.error(e);process.exit(1)});
