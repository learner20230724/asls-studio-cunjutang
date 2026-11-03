import {visibilityGLSL} from './light-paths.mjs';

// A cone is only the bounding volume. Its surface is never painted: integrate
// scattering along the camera ray inside it, stopping at opaque scene depth.
export const hazeVertex=`
attribute float beamCos;
varying vec3 apex;varying vec3 axis;varying vec3 energy;
varying float range;varying float edge;
void main(){
  mat4 world=modelMatrix*instanceMatrix;
  apex=world[3].xyz;axis=normalize(world[2].xyz);
  range=length(world[2].xyz);edge=beamCos;energy=instanceColor;
  gl_Position=projectionMatrix*viewMatrix*world*vec4(position,1.);
}`;

export const hazeFragment=`
precision highp float;
uniform sampler2D sceneDepth;uniform vec2 resolution;
uniform mat4 inverseProjection;uniform mat4 cameraWorld;
varying vec3 apex;varying vec3 axis;varying vec3 energy;
varying float range;varying float edge;
${visibilityGLSL}
bool coneInterval(vec3 origin,vec3 ray,out float enter,out float leave){
  vec3 offset=origin-apex;
  float z=dot(offset,axis),dz=dot(ray,axis);
  enter=0.;leave=1000.;
  if(!slab(z,dz,0.,range,enter,leave))return false;
  float k=1./(edge*edge);
  float a=1.-k*dz*dz,b=2.*(dot(offset,ray)-k*z*dz),c=dot(offset,offset)-k*z*z;
  if(abs(a)<.000001){
    if(abs(b)<.000001)return c<=0.;
    if(b>0.)leave=min(leave,-c/b);else enter=max(enter,-c/b);
  }else{
    float disc=b*b-4.*a*c;
    if(disc<0.)return a<0.;
    float root=sqrt(max(0.,disc));
    float t1=(-b-root)/(2.*a),t2=(-b+root)/(2.*a);
    float lo=min(t1,t2),hi=max(t1,t2);
    if(a>0.){enter=max(enter,lo);leave=min(leave,hi);}
    else if(enter<lo){leave=min(leave,lo);}else{enter=max(enter,hi);}
  }
  return leave>enter;
}
void main(){
  if(max(energy.r,max(energy.g,energy.b))<.00001)discard;
  vec2 uv=gl_FragCoord.xy/resolution;
  vec4 viewEnd=inverseProjection*vec4(uv*2.-1.,1.,1.);
  vec3 ray=normalize((cameraWorld*vec4(viewEnd.xyz/viewEnd.w,1.)).xyz-cameraPosition);
  float enter,leave;
  if(!coneInterval(cameraPosition,ray,enter,leave))discard;
  float depth=texture2D(sceneDepth,uv).r;
  vec4 viewSurface=inverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);
  vec3 surface=(cameraWorld*vec4(viewSurface.xyz/viewSurface.w,1.)).xyz;
  leave=min(leave,dot(surface-cameraPosition,ray)-.003);
  if(leave<=enter)discard;
  float stepSize=(leave-enter)/12.;float sum=0.;
  for(int s=0;s<12;s++){
    vec3 point=cameraPosition+ray*(enter+(float(s)+.5)*stepSize);
    vec3 lightRay=point-apex;float distance=length(lightRay);
    float weight=spotWeight(dot(lightRay/max(distance,.001),axis),edge);
    if(weight>.0001&&!lightBlocked(apex,point))
      sum+=weight*70./(28.+distance*distance)*exp(-distance*.025)*stepSize;
  }
  gl_FragColor=vec4(energy*sum*.018,1.);
}`;
