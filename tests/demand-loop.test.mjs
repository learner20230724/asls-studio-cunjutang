import test from 'node:test';
import assert from 'node:assert/strict';
import {DemandLoop} from '../src/training/demand-loop.mjs';
function clock(draw,active=()=>false){
 let time=0,id=0;const frames=new Map(),timers=new Map();
 const loop=new DemandLoop({draw,active,now:()=>time,request:fn=>{frames.set(++id,fn);return id},cancel:id=>frames.delete(id),timer:(fn,delay)=>{timers.set(++id,{fn,at:time+delay});return id},clear:id=>timers.delete(id)});
 const step=(ms=40)=>{time+=ms;for(const [id,t]of [...timers])if(t.at<=time){timers.delete(id);t.fn();}for(const [id,fn]of [...frames]){frames.delete(id);fn(time);}};
 return {loop,frames,timers,step};
}
test('100 synchronous changes coalesce to one frame, then zero idle callbacks',()=>{
 let count=0;const c=clock(()=>count++);for(let i=0;i<100;i++)c.loop.invalidate();assert.equal(c.frames.size,1);c.step();
 assert.equal(count,1);assert.equal(c.frames.size+c.timers.size,0);for(let i=0;i<100;i++)c.step();assert.equal(count,1);
});
test('active fades keep a capped clock and stop immediately on completion',()=>{
 let playing=true,count=0;const c=clock(()=>{count++;if(count===3)playing=false},()=>playing);c.loop.invalidate();c.step();
 assert.equal(c.timers.size,1);c.step(10);assert.equal(count,1);c.step(30);c.step(40);assert.equal(count,3);assert.equal(c.frames.size+c.timers.size,0);
});
test('an invalidation during drawing is retained without recursive frames',()=>{
 let count=0;const c=clock(()=>{count++;if(count===1)c.loop.invalidate()});c.loop.invalidate();c.step();assert.equal(count,1);c.step();assert.equal(count,2);assert.equal(c.frames.size+c.timers.size,0);
});
test('hidden pages cancel animation and timers and render the latest state on return',()=>{
 let count=0;const c=clock(()=>count++,()=>true);c.loop.invalidate();c.loop.setVisible(false);c.step();assert.equal(count,0);assert.equal(c.frames.size+c.timers.size,0);
 c.loop.invalidate();assert.equal(c.frames.size+c.timers.size,0);c.loop.setVisible(true);c.step();assert.equal(count,1);assert.equal(c.timers.size,1);c.loop.setVisible(false);assert.equal(c.frames.size+c.timers.size,0);
 c.loop.dispose();assert.equal(c.loop.dirty,false);
});
