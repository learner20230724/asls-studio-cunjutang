import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),get=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const port=Number(get('--port',4179)),base='/'+get('--base','').replace(/^\/+|\/+$/g,'');
const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.ttf':'font/ttf','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.webm':'video/webm'};
try{await stat(path.join(root,'index.html'));}catch{console.error('请先运行 npm run build / Run npm run build first.');process.exit(1);}
const server=http.createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(base!=='/'){if(pathname===base){res.writeHead(302,{Location:base+'/'});res.end();return;}if(!pathname.startsWith(base+'/')){res.writeHead(404);res.end();return;}pathname=pathname.slice(base.length);}const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html'))throw new Error('Forbidden');const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}});
server.listen(port,'127.0.0.1',()=>console.log(`Cunjutang rehearsal studio: http://127.0.0.1:${port}${base==='/'?'/':base+'/'}\nPress Ctrl+C to stop. No hardware output / 无硬件输出。`));
server.on('error',e=>{console.error(e.message);process.exit(1);});
