// Coalesce changes into at most one frame. Static scenes have no frame or timer.
export class DemandLoop {
  constructor({draw,active=()=>false,fps=30,request=fn=>requestAnimationFrame(fn),cancel=id=>cancelAnimationFrame(id),timer=(fn,delay)=>setTimeout(fn,delay),clear=id=>clearTimeout(id),now=()=>performance.now()}) {
    Object.assign(this,{draw,active,request,cancel,timer,clear,now});
    this.interval=1000/fps;this.frame=null;this.timeout=null;this.dirty=false;this.visible=true;this.drawing=false;this.last=-Infinity;this.frames=0;
  }
  invalidate(){this.dirty=true;this.schedule();}
  schedule(){
    if(!this.visible||this.drawing||this.frame!==null||this.timeout!==null)return;
    const wait=Math.max(0,this.last+this.interval-this.now());
    if(wait>1)this.timeout=this.timer(()=>{this.timeout=null;this.schedule();},wait);
    else this.frame=this.request(time=>this.tick(time));
  }
  tick(time){
    this.frame=null;if(!this.visible)return;
    this.dirty=false;this.drawing=true;this.last=this.now();
    try{this.draw(this.last);this.frames++;}finally{this.drawing=false;}
    if(this.dirty||this.active())this.schedule();
  }
  setVisible(visible){
    this.visible=visible;
    if(!visible){if(this.frame!==null)this.cancel(this.frame);if(this.timeout!==null)this.clear(this.timeout);this.frame=this.timeout=null;this.dirty=true;}
    else if(this.dirty||this.active())this.schedule();
  }
  dispose(){this.setVisible(false);this.dirty=false;}
}
