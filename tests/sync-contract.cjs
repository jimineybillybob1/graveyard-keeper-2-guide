const assert=require('node:assert/strict');
const core=require('../sync-core.js');
(async()=>{
 const code=core.createCode(),id=await core.identity(code),other=await core.identity(core.createCode());
 assert.notEqual(id.id,id.token);const env=await core.encrypt({notes:'private test'},id);assert.deepEqual(await core.decrypt(env,id),{notes:'private test'});await assert.rejects(core.decrypt(env,other));
 const base=process.env.SYNC_URL||'http://127.0.0.1:8787',origin=process.env.GUIDE_ORIGIN||'http://127.0.0.1:4173';
 const req=(method='GET',body,token=id.token,suffix='')=>fetch(base+'/v1/saves/'+id.id+suffix,{method,headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await req()).status,404);
 const results=await Promise.all([req('PUT',{expectedRevision:0,envelope:env}),req('PUT',{expectedRevision:0,envelope:env})]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
 assert.equal((await req('GET',null,other.token)).status,403);assert.equal((await req('PUT',{expectedRevision:1,envelope:{}})).status,400);
 for(let revision=1;revision<11;revision++)assert.equal((await req('PUT',{expectedRevision:revision,envelope:env})).status,200);
 assert.equal((await(await req('GET',null,id.token,'/history')).json()).versions.length,8);
 assert.equal((await req('DELETE',{expectedRevision:10})).status,409);assert.equal((await req('DELETE',{expectedRevision:11})).status,200);assert.equal((await req()).status,404);
 console.log('Encryption, authorization, concurrent writes, history limit and deletion passed.');
})().catch(e=>{console.error(e);process.exit(1)});

