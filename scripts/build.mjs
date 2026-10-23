import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { randomBytes, createCipheriv } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, isAbsolute } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function build({input,privateDir,baseUrl,output=join(root,'site')}){
 const url=new URL(baseUrl);
 if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')throw new Error('HTTPS base URL required');
 const privateRoot=resolve(privateDir);
 if(privateRoot===root||privateRoot.startsWith(root+'/'))throw new Error('Keep plaintext and keys outside repository');
 const records=JSON.parse(await readFile(input,'utf8'));
 if(!Array.isArray(records)||records.length!==23||new Set(records.map(r=>r.name)).size!==23)throw new Error('Expected 23 unique people');
 for(const r of records)if(typeof r.name!=='string'||r.sections?.length!==6||!r.sections.every(s=>typeof s==='string'&&s.trim()))throw new Error('Expected name and six nonempty sections');
 await mkdir(privateRoot,{recursive:true,mode:0o700});
 const keyFile=join(privateRoot,'keys.json');
 let keys={};
 try{keys=JSON.parse(await readFile(keyFile,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 for(const r of records)if(!keys[r.name])keys[r.name]={id:randomBytes(18).toString('base64url'),key:randomBytes(32).toString('base64url')};
 await writeFile(keyFile,JSON.stringify(keys,null,2),{mode:0o600});
 // Only this generated directory is replaced. Never put private inputs inside it.
 if(resolve(output)!==join(root,'site'))throw new Error('Output must be the generated site directory');
 await rm(output,{recursive:true,force:true});await mkdir(join(output,'assets'),{recursive:true});
 for(const file of ['style.css','app.js','criteria.js'])await cp(join(root,'public',file),join(output,'assets',file));
 const template=await readFile(join(root,'public/index.html'),'utf8');
 const html=(assets,home)=>template.replaceAll('{{ASSETS}}',assets).replaceAll('{{HOME}}',home);
 await writeFile(join(output,'index.html'),html('./assets/','./'));
 await writeFile(join(output,'.nojekyll'),'');
 await writeFile(join(output,'robots.txt'),'User-agent: *\nDisallow: /\n');
 const links=[];
 for(const record of records){
  const {id,key}=keys[record.name];
  if(!/^[A-Za-z0-9_-]{24}$/.test(id)||!/^[A-Za-z0-9_-]{43}$/.test(key))throw new Error('Invalid retained key');
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'base64url'),iv);
  cipher.setAAD(Buffer.from(id));
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(record),'utf8'),cipher.final(),cipher.getAuthTag()]);
  const directory=join(output,'r',id);await mkdir(directory,{recursive:true});
  await writeFile(join(directory,'index.html'),html('../../assets/','../../'));
  await writeFile(join(directory,'review.json'),JSON.stringify({v:1,iv:iv.toString('base64url'),data:encrypted.toString('base64url')}));
  links.push({id:record.id,name:record.name,url:new URL(`r/${id}/#key=${key}`,baseUrl.replace(/\/?$/,'/')).href});
 }
 await writeFile(join(privateRoot,'links.json'),JSON.stringify(links,null,2),{mode:0o600});
 await writeFile(join(privateRoot,'links.md'),'# Персональные ссылки\n\nХраните этот список у себя. Каждому человеку отправляйте только его ссылку.\n\n'+links.map(r=>`${r.id}. [${r.name}](${r.url})`).join('\n')+'\n',{mode:0o600});
 console.log(`Built ${records.length} encrypted reviews. Private links saved outside checkout.`);
 return links;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==5)throw new Error('Usage: node scripts/build.mjs INPUT_JSON PRIVATE_DIRECTORY BASE_HTTPS_URL');
 await build({input:resolve(process.argv[2]),privateDir:process.argv[3],baseUrl:process.argv[4]});
}
