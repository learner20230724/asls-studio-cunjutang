import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({plugins:[vue()],publicDir:false,define:{__WEB_PREVIEW__:process.env.MINI_WEB==='1','process.env.NODE_ENV':'"production"',__VUE_OPTIONS_API__:false,__VUE_PROD_DEVTOOLS__:false},build:{outDir:process.env.MINI_WEB==='1'?'dist-miniweb':'dist-minitool',target:['es2017','chrome61'],cssTarget:'chrome61',lib:{entry:'src/minitool/main.js',name:'StageLight',formats:['iife'],fileName:()=> 'app.js'},rollupOptions:{output:{inlineDynamicImports:true}},minify:true,sourcemap:false}});
