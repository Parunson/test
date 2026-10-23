import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer } from '../server.mjs';
const root=resolve(import.meta.dirname,'..');
const site=resolve(root,'site');
const decode=s=>Buffer.from(s,'base64url');
async function decrypt(envelope,key,id){
 const k=await webcrypto.subtle.importKey('raw',decode(key),'AES-GCM',false,['decrypt']);
 return JSON.parse(new TextDecoder().decode(await webcrypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv),additionalData:Buffer.from(id)},k,decode(envelope.data))));
}
test('publication contains exactly 23 separate envelopes and no person directory names',async()=>{
 const dirs=await readdir(resolve(site,'r'));
 assert.equal(dirs.length,23);
 for(const id of dirs){
  assert.match(id,/^[A-Za-z0-9_-]{24}$/);
  const files=await readdir(resolve(site,'r',id));assert.deepEqual(files.sort(),['index.html','review.json']);
  const env=JSON.parse(await readFile(resolve(site,'r',id,'review.json'),'utf8'));
  assert.deepEqual(Object.keys(env).sort(),['data','iv','v']);assert.equal(env.v,1);assert.equal(decode(env.iv).length,12);
 }
});
test('published files contain no keys or plaintext reviews',async()=>{
 // Optional private inputs strengthen this check locally; CI cannot read private material.
 let reviews,keys;
 try {reviews=JSON.parse(await readFile(process.env.REVIEWS_INPUT||'/workspace/private-reviews/reviews.json','utf8'));keys=JSON.parse(await readFile(process.env.REVIEWS_KEYS||'/workspace/private-reviews/keys.json','utf8'))}
 catch(e){if(e.code==='ENOENT')return;throw e}
 async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
  const file=resolve(dir,entry.name);if(entry.isDirectory()){await scan(file);continue}
  const data=await readFile(file,'utf8');
  for(const r of reviews){assert.ok(!data.includes(r.name),'name leaked');assert.ok(!data.includes(keys[r.name].key),'key leaked');for(const s of r.sections)assert.ok(!data.includes(s),'review text leaked')}
 }}
 await scan(root+'/site');await scan(root+'/public');
});
test('all 23 reviews decrypt, wrong keys and altered ciphertext fail',{skip:!process.env.VERIFY_PRIVATE},async()=>{
 const reviews=JSON.parse(await readFile(process.env.REVIEWS_INPUT||'/workspace/private-reviews/reviews.json','utf8'));
 const keys=JSON.parse(await readFile(process.env.REVIEWS_KEYS||'/workspace/private-reviews/keys.json','utf8'));
 for(let i=0;i<reviews.length;i++){
  const record=reviews[i],{id,key}=keys[record.name];
  const env=JSON.parse(await readFile(resolve(site,'r',id,'review.json'),'utf8'));
  assert.deepEqual(await decrypt(env,key,id),record);
  await assert.rejects(decrypt(env,keys[reviews[(i+1)%reviews.length].name].key,id));
  await assert.rejects(decrypt(env,key,'different-page'));
  const damaged=decode(env.data);damaged[0]^=1;
  await assert.rejects(decrypt({...env,data:damaged.toString('base64url')},key,id));
 }
});
test('static server serves Pages assets and denies private data, APIs, traversal',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const url of ['/','/assets/app.js','/assets/criteria.js','/assets/style.css','/robots.txt'])assert.equal((await fetch(base+url)).status,200);
  for(const url of ['/private/keys.json','/links.json','/reviews.json','/api/review','/server.mjs','/%2e%2e/private-reviews/keys.json','/r/'])assert.equal((await fetch(base+url)).status,404);
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
  assert.equal((await fetch(base+'/')).headers.get('referrer-policy'),'no-referrer');
 }finally{await new Promise(r=>server.close(r))}
});
