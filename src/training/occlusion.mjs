// Shared CPU light paths for cached surface lighting and haze shadow maps.
export function rayHit(ox,oy,oz,dx,dy,dz,shape,near=.003,far=1000){
  if(shape.kind==='sphere'){
    const x=ox-shape.center[0],y=oy-shape.center[1],z=oz-shape.center[2];
    const a=dx*dx+dy*dy+dz*dz,b=x*dx+y*dy+z*dz,c=x*x+y*y+z*z-shape.radius**2;
    const disc=b*b-a*c;if(disc<0)return far;
    const root=Math.sqrt(disc),first=(-b-root)/a,last=(-b+root)/a;
    return last>near&&first<far?Math.max(near,first):far;
  }
  if(shape.kind==='capsule'){
    let hit=far;const x=ox-shape.center[0],y=oy-shape.center[1],z=oz-shape.center[2],a=dx*dx+dy*dy;
    if(a>1e-12){const b=x*dx+y*dy,c=x*x+y*y-shape.radius**2,disc=b*b-a*c;
      if(disc>=0)for(const t of [(-b-Math.sqrt(disc))/a,(-b+Math.sqrt(disc))/a])if(t>=near&&t<hit&&Math.abs(z+t*dz)<=shape.halfLength)hit=t;
    }
    for(const sign of [-1,1])hit=Math.min(hit,rayHit(ox,oy,oz,dx,dy,dz,{kind:'sphere',center:[shape.center[0],shape.center[1],shape.center[2]+sign*shape.halfLength],radius:shape.radius},near,hit));
    return hit;
  }
  let enter=near,exit=far;
  if(shape.axes){
    const x=ox-shape.center[0],y=oy-shape.center[1],z=oz-shape.center[2];
    for(let k=0;k<3;k++){
      const axis=shape.axes[k],o=x*axis[0]+y*axis[1]+z*axis[2],d=dx*axis[0]+dy*axis[1]+dz*axis[2],h=shape.half[k];
      if(Math.abs(d)<1e-9){if(o< -h||o>h)return far;}
      else {const a=(-h-o)/d,b=(h-o)/d;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(exit<=enter)return far;}
    }
  }else{
    for(let k=0;k<3;k++){
      const o=k===0?ox:k===1?oy:oz,d=k===0?dx:k===1?dy:dz;
      if(Math.abs(d)<1e-9){if(o<shape.min[k]||o>shape.max[k])return far;}
      else {const a=(shape.min[k]-o)/d,b=(shape.max[k]-o)/d;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(exit<=enter)return far;}
    }
  }
  return exit>enter?enter:far;
}
export function blockedSegment(ox,oy,oz,px,py,pz,shapes,owner=0){
  const dx=px-ox,dy=py-oy,dz=pz-oz,distance=Math.hypot(dx,dy,dz);
  if(distance<.006)return false;
  const far=distance-.003;
  for(const shape of shapes)if(!(owner&&shape.owner===owner)&&rayHit(ox,oy,oz,dx/distance,dy/distance,dz/distance,shape,.003,far)<far)return true;
  return false;
}
export function objectBlockers(objects){
  const result=[];
  objects.forEach((o,index)=>{
    const owner=index+1,angle=o.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    const center=(x,y,z)=>[o.x+x*c-y*s,o.y+x*s+y*c,z];
    const box=(size,at,tilt=0)=>{const ct=Math.cos(tilt),st=Math.sin(tilt);result.push({owner,kind:'box',center:center(...at),half:size.map(v=>v/2),axes:[[c*ct,s*ct,-st],[-s,c,0],[c*st,s*st,ct]]});};
    if(o.kind==='actor'){
      result.push({owner,kind:'sphere',center:center(0,0,1.65),radius:.17},{owner,kind:'capsule',center:center(0,0,1.13),radius:.21,halfLength:.225});
      for(const sign of [-1,1]){box([.13,.17,.7],[sign*.13,0,.4]);box([.105,.14,.6],[sign*.31,0,1.06],sign*.13);}
    }else if(o.kind==='table'){
      box([1.6,.8,.1],[0,0,.8]);for(const x of [-.65,.65])for(const y of [-.3,.3])box([.08,.08,.75],[x,y,.375]);
    }else if(o.kind==='chair'){
      box([.5,.5,.08],[0,0,.45]);box([.5,.06,.55],[0,.23,.73]);for(const x of [-.2,.2])for(const y of [-.2,.2])box([.05,.05,.45],[x,y,.225]);
    }else box([1.4,1.2,.5],[0,0,.25]);
  });return result;
}
