// Publish only encrypted static output, using Git's existing authentication.
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const temp=await mkdtemp(join(tmpdir(),'review-pages-'));
const index=join(temp,'index');
const git=(args,options={})=>execFileSync('git',args,{cwd:root,encoding:'utf8',...options});
try{
 const env={...process.env,GIT_INDEX_FILE:index,GIT_WORK_TREE:join(root,'site')};
 git(['read-tree','--empty'],{env});git(['add','--all','.'],{cwd:join(root,'site'),env});
 const tree=git(['write-tree'],{env}).trim();
 const found=git(['ls-remote','--heads','origin','refs/heads/gh-pages']).trim();
 let parent;
 if(found){git(['fetch','origin','gh-pages']);parent=git(['rev-parse','FETCH_HEAD']).trim()}
 const body=join(temp,'message.txt');await writeFile(body,'Publish individual encrypted resume reviews\n');
 const commit=git(['-c','user.name=Codex','-c','user.email=codex@users.noreply.github.com','commit-tree',tree,...(parent?['-p',parent]:[]),'-F',body]).trim();
 // No force push. A concurrent update must be resolved explicitly.
 git(['push','origin',`${commit}:refs/heads/gh-pages`],{stdio:'inherit'});
 console.log('Encrypted static site pushed to gh-pages. Verify GitHub Pages settings and live deployment separately.');
}finally{await rm(temp,{recursive:true,force:true})}
