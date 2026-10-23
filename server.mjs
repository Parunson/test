// Local static preview only. Production hosting is GitHub Pages.
import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, sep, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'site');
export function createServer(){return http.createServer(async(req,res)=>{
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"};
 const send=(code,type,body)=>{res.writeHead(code,{...headers,'Content-Type':type});res.end(req.method==='HEAD'?'':body)};
 if(!['GET','HEAD'].includes(req.method))return send(405,'text/plain','Method not allowed');
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://preview').pathname);
  let file=resolve(root,'.'+pathname);
  if(!file.startsWith(root+sep)&&file!==root)throw new Error('path');
  if((await stat(file)).isDirectory())file=resolve(file,'index.html');
  file=await realpath(file);
  if(!file.startsWith(root+sep))throw new Error('path');
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
  if(!types[extname(file)])throw new Error('type');
  send(200,types[extname(file)],await readFile(file));
 }catch{send(404,'text/plain; charset=utf-8','Страница не найдена')}
})}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))createServer().listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Static preview started'));
