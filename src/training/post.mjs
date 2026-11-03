export const postVertex='varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}';
export const postFragment=`
uniform sampler2D image;uniform sampler2D haze;uniform sampler2D sceneDepth;
uniform vec2 hazeSize;uniform float useHaze;varying vec2 v;
float viewDistance(float depth){return .1*220./(220.-depth*(220.-.1));}
vec3 upsampleHaze(){
  vec2 pixel=v*hazeSize-.5,base=floor(pixel),blend=fract(pixel);
  float depth=viewDistance(texture2D(sceneDepth,v).r),total=0.;vec3 sum=vec3(0.);
  for(int x=0;x<2;x++)for(int y=0;y<2;y++){
    vec2 offset=vec2(float(x),float(y)),uv=(base+offset+.5)/hazeSize;
    float weight=(x==0?1.-blend.x:blend.x)*(y==0?1.-blend.y:blend.y);
    // Prevent low-resolution haze bleeding over foreground silhouettes.
    weight*=exp(-abs(viewDistance(texture2D(sceneDepth,uv).r)-depth)*3.);
    sum+=texture2D(haze,uv).rgb*weight;total+=weight;
  }
  return total>.0001?sum/total:vec3(0.);
}
void main(){vec3 c=texture2D(image,v).rgb;
  if(useHaze>.5)c+=upsampleHaze();
  c*=.85;c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);
  gl_FragColor=vec4(pow(clamp(c,0.,1.),vec3(1./2.2)),1.);
}`;
