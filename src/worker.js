// No timers or messages without active native effects/chases.
let timer=null;
function tick(){self.postMessage('');timer=setTimeout(tick,1000/30);}
self.onmessage=({data})=>{
  if(data?.active&&timer===null)tick();
  else if(!data?.active&&timer!==null){clearTimeout(timer);timer=null;}
};
