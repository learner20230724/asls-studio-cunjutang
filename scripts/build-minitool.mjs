import {build} from 'vite';
import {build as bundle} from 'esbuild';
import {writeFile,readFile} from 'node:fs/promises';
const out=process.env.MINI_WEB==='1'?'dist-miniweb':'dist-minitool';
await build({configFile:'vite.minitool.config.mjs'});
await bundle({entryPoints:['src/minitool/worker.js'],bundle:true,format:'iife',target:['es2017','chrome61'],minify:true,outfile:out+'/lighting.js'});
await writeFile(out+'/index.html',`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover"><title>光场 · 灯光排练室</title><link rel="stylesheet" href="./style.css"><style>html,body{margin:0;background:#111719;color:#dcc08b;font-family:sans-serif}.boot{padding:32px}.boot p{color:#a7b4af}</style></head><body><div id="app"><div class="boot"><h1>◈ 光场</h1><p>灯光排练室</p><p>正在准备舞台…</p></div></div><script defer src="./app.js"></script></body></html>`);
await writeFile(out+'/licenses.json',JSON.stringify({license:'GPL-3.0',author:'Timé Kadel / ASLS Studio',three:'Three.js MIT',vue:'Vue MIT',source:'https://github.com/learner20230724/asls-studio-cunjutang/tree/codex/generic-stage-minitool',gpl:await readFile('COPYING','utf8')},null,2));
