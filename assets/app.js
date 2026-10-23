import { criteria } from './criteria.js';
const title=document.querySelector('#title');
const intro=document.querySelector('#intro');
const status=document.querySelector('#status');
const initialTitle=title.textContent, initialIntro=intro.textContent;
let generation=0;
const onReviewPage=/\/r\/[A-Za-z0-9_-]{24}\/$/.test(location.pathname);
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),char=>char.charCodeAt(0));
function render(review){
 if(typeof review.name!=='string'||review.sections?.length!==6||!review.sections.every(s=>typeof s==='string'))throw new Error('format');
 title.textContent=`${review.name}, это ваш разбор.`;
 intro.textContent='Что уже работает, где теряется смысл и как сделать ваш опыт понятнее с первого прочтения.';
 criteria.forEach(([name,question],i)=>{
  const item=document.createElement('article');
  const number=document.createElement('span');number.className='number';number.textContent=`0${i+1}`;
  const h=document.createElement('h3');h.textContent=name;
  const p=document.createElement('p');p.textContent=question;
  item.append(number,h,p);document.querySelector('#criteria').append(item);
 });
 review.sections.forEach((text,i)=>{
  const article=document.createElement('article');article.className='review-card';
  const number=document.createElement('span');number.className='number';number.textContent=`0${i+1}`;
  const body=document.createElement('div');const h=document.createElement('h3');h.textContent=criteria[i][0];body.append(h);
  text.split(/\n\s*\n/).forEach(part=>{const p=document.createElement('p');p.textContent=part;body.append(p)});
  article.append(number,body);document.querySelector('#sections').append(article);
 });
 status.textContent='';document.querySelector('#content').hidden=false;
}
async function loadReview(){
 const current=++generation;
 const token=new URLSearchParams(location.hash.slice(1)).get('key');
 document.querySelector('#content').hidden=true;
 document.querySelector('#criteria').replaceChildren();
 document.querySelector('#sections').replaceChildren();
 title.textContent=initialTitle;intro.textContent=initialIntro;status.textContent='';
 if(!onReviewPage)return;
 if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token)){
  status.textContent='В ссылке не хватает ключа. Откройте персональную ссылку целиком, включая часть после #.';
 }else{
  status.textContent='Открываю ваш разбор…';
  try{
   const response=await fetch('./review.json',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
   if(!response.ok)throw new Error('unavailable');
   const envelope=await response.json();
   if(envelope.v!==1)throw new Error('version');
   const id=location.pathname.split('/').filter(Boolean).at(-1);
   const key=await crypto.subtle.importKey('raw',decode(token),{name:'AES-GCM'},false,['decrypt']);
   const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv),additionalData:new TextEncoder().encode(id)},key,decode(envelope.data));
   if(current===generation)render(JSON.parse(new TextDecoder().decode(bytes)));
  }catch{
   if(current===generation)status.textContent='Не удалось открыть разбор. Проверьте персональную ссылку целиком или попробуйте позже.';
  }
 }
}

window.addEventListener('hashchange',loadReview);
loadReview();
