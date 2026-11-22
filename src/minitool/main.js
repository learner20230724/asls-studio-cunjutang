import {createApp} from 'vue';
import App from './App.vue';
import './style.css';
if(!Object.fromEntries)Object.fromEntries=entries=>{const o={};for(const [k,v]of entries)o[k]=v;return o};
if(!Array.prototype.flatMap)Array.prototype.flatMap=function(f){return [].concat(...this.map(f))};
if(!window.globalThis)window.globalThis=window;
function size(){document.documentElement.style.setProperty('--app-height',(window.visualViewport?window.visualViewport.height:innerHeight)+'px')}
size();window.addEventListener('resize',size);if(window.visualViewport)window.visualViewport.addEventListener('resize',size);
createApp(App).mount('#app');
