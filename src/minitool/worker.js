import {calculate} from '../training/lighting-compute.mjs';
if(!Object.fromEntries)Object.fromEntries=entries=>{const o={};for(const [k,v]of entries)o[k]=v;return o};
self.onmessage=({data})=>{const r=calculate(data);self.postMessage(r)};
