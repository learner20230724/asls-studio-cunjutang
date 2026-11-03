// The rendered venue shells are also the light blockers. No invisible front wall:
// front/box-boom lights must be able to enter through the open stage mouth.
export function venueBlockers({width:w,depth:d,height:h}) {
  const boxes=[];
  const box=(id,size,center,color,lit=true)=>{
    boxes.push({id,size,center,color,lit,min:center.map((v,i)=>v-size[i]/2),max:center.map((v,i)=>v+size[i]/2)});
  };
  box('floor',[w,d,.3],[0,d/2,-.16],'#73736c');
  box('back-wall',[w+.4,.25,h],[0,d+.25,h/2],'#252e30');
  for(const sign of [-1,1]) {
    box(`side-base-${sign}`,[.3,d,.7],[sign*(w/2+.55),d/2,.35],'#1b2326',false);
    for(let i=0;i<4;i++)box(`wing-${sign}-${i}`,[.6,.16,h*.85],[sign*(w/2-.35),1+i*d/4,h*.425],'#1c2629');
  }
  return boxes;
}

// Segment/slab intersection. Open endpoints prevent the receiving wall/floor
// from shadowing its own surface; parallel and grazing rays remain finite.
export function segmentBlocked(origin,point,boxes,bias=.003) {
  const delta=point.map((v,i)=>v-origin[i]);
  const distance=Math.hypot(...delta);
  if(distance<=2*bias)return false;
  const direction=delta.map(v=>v/distance);
  return boxes.some(box=>{
    let enter=bias,exit=distance-bias;
    for(let i=0;i<3;i++){
      if(Math.abs(direction[i])<1e-8){if(origin[i]<box.min[i]||origin[i]>box.max[i])return false;}
      else {const a=(box.min[i]-origin[i])/direction[i],b=(box.max[i]-origin[i])/direction[i];enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}
    }
    return exit>enter;
  });
}

// Shared by surface illumination and every haze sample. Both paths therefore
// agree about which side of a wall can receive a fixture's light.
export const MAX_BLOCKERS=12;
export const visibilityGLSL=`
uniform int blockerCount;
uniform vec3 blockerMin[${MAX_BLOCKERS}];
uniform vec3 blockerMax[${MAX_BLOCKERS}];
bool slab(float o,float d,float lo,float hi,inout float enter,inout float leave){
  if(abs(d)<.000001)return o>=lo&&o<=hi;
  float a=(lo-o)/d,b=(hi-o)/d;
  enter=max(enter,min(a,b));leave=min(leave,max(a,b));return leave>enter;
}
bool lightBlocked(vec3 origin,vec3 point){
  vec3 delta=point-origin;float distance=length(delta);
  if(distance<=.006)return false;
  vec3 direction=delta/distance;
  for(int j=0;j<${MAX_BLOCKERS};j++){
    if(j>=blockerCount)break;
    float enter=.003,leave=distance-.003;
    if(slab(origin.x,direction.x,blockerMin[j].x,blockerMax[j].x,enter,leave)&&
       slab(origin.y,direction.y,blockerMin[j].y,blockerMax[j].y,enter,leave)&&
       slab(origin.z,direction.z,blockerMin[j].z,blockerMax[j].z,enter,leave))return true;
  }
  return false;
}
float spotWeight(float alignment,float edge){
  return smoothstep(edge,mix(edge,1.,.3),alignment);
}
`;
