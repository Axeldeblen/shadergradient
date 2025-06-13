export const planeVertexShader = `
// #pragma glslify: cnoise3 = require(glsl-noise/classic/3d)

// noise source from https://github.com/hughsk/glsl-noise/blob/master/periodic/3d.glsl

vec3 mod289(vec3 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x)
{
  return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec3 fade(vec3 t) {
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}

float cnoise(vec3 P)
{
  vec3 Pi0 = floor(P); // Integer part for indexing
  vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

//-------- start here ------------

mat3 rotation3dY(float angle) {
  float s = sin(angle);
  float c = cos(angle);

  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

vec3 rotateY(vec3 v, float angle) { return rotation3dY(angle) * v; }

varying vec3 vNormal;
varying float displacement;
varying vec3 vPos;
varying float vDistort;

varying vec2 vUv;

uniform float uTime;
uniform float uSpeed;

uniform float uLoadingTime;

uniform float uNoiseDensity;
uniform float uNoiseStrength;

#define STANDARD
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
#ifdef USE_TANGENT
varying vec3 vTangent;
varying vec3 vBitangent;
#endif
#endif
#include <clipping_planes_pars_vertex>
#include <color_pars_vertex>
#include <common>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <morphtarget_pars_vertex>
#include <shadowmap_pars_vertex>
#include <skinning_pars_vertex>
#include <uv2_pars_vertex>
#include <uv_pars_vertex>

void main() {

  #include <beginnormal_vertex>
  #include <color_vertex>
  #include <defaultnormal_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <uv2_vertex>
  #include <uv_vertex>
  #ifndef FLAT_SHADED
    vNormal = normalize(transformedNormal);
  #ifdef USE_TANGENT
    vTangent = normalize(transformedTangent);
    vBitangent = normalize(cross(vNormal, vTangent) * tangent.w);
  #endif
  #endif
  #include <begin_vertex>

  #include <clipping_planes_vertex>
  #include <displacementmap_vertex>
  #include <logdepthbuf_vertex>
  #include <morphtarget_vertex>
  #include <project_vertex>
  #include <skinning_vertex>
    vViewPosition = -mvPosition.xyz;
  #include <fog_vertex>
  #include <shadowmap_vertex>
  #include <worldpos_vertex>

  //-------- start vertex ------------
  vUv = uv;

  float t = uTime * uSpeed;
  // Create a sine wave from top to bottom of the sphere
  float distortion = 0.75 * cnoise(0.43 * position * uNoiseDensity + t);

  vec3 pos = position + normal * distortion * uNoiseStrength * uLoadingTime;
  vPos = pos;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
}
`;

export const planeFragmentShader = `
#define STANDARD
#ifdef PHYSICAL
#define REFLECTIVITY
#define CLEARCOAT
#define TRANSMISSION
#endif

uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;

#ifdef TRANSMISSION
uniform float transmission;
#endif
#ifdef REFLECTIVITY
uniform float reflectivity;
#endif
#ifdef CLEARCOAT
uniform float clearcoat;
uniform float clearcoatRoughness;
#endif
#ifdef USE_SHEEN
uniform vec3 sheen;
#endif
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
#ifdef USE_TANGENT
varying vec3 vTangent;
varying vec3 vBitangent;
#endif
#endif
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <color_pars_fragment>
#include <common>
#include <dithering_pars_fragment>
#include <emissivemap_pars_fragment>
#include <lightmap_pars_fragment>
#include <map_pars_fragment>
#include <packing>
#include <uv2_pars_fragment>
#include <uv_pars_fragment>
// #include <transmissionmap_pars_fragment>
#include <bsdfs>
#include <bumpmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <clipping_planes_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <lights_physical_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <shadowmap_pars_fragment>
// include를 통해 가져온 값은 대부분 환경, 빛 등을 계산하기 위해서 기본 fragment
// shader의 값들을 받아왔습니다. 일단은 무시하셔도 됩니다.

varying vec3 vNormal;
varying float displacement;
varying vec3 vPos;
varying float vDistort;

uniform float uC1r;
uniform float uC1g;
uniform float uC1b;
uniform float uC2r;
uniform float uC2g;
uniform float uC2b;
uniform float uC3r;
uniform float uC3g;
uniform float uC3b;

varying vec3 color1;
varying vec3 color2;
varying vec3 color3;

// for npm package, need to add this manually
float linearToRelativeLuminance2( const in vec3 color ) {
    vec3 weights = vec3( 0.2126, 0.7152, 0.0722 );
    return dot( weights, color.rgb );
}

void main() {

  //-------- basic gradient ------------
  vec3 color1 = vec3(uC1r, uC1g, uC1b);
  vec3 color2 = vec3(uC2r, uC2g, uC2b);
  vec3 color3 = vec3(uC3r, uC3g, uC3b);
  float clearcoat = 1.0;
  float clearcoatRoughness = 0.5;

  #include <clipping_planes_fragment>

  vec4 diffuseColor = vec4(
      mix(mix(color1, color2, smoothstep(-3.0, 3.0, vPos.x)), color3, vPos.z),
      1);
  // diffuseColor는 오브젝트의 베이스 색상 (환경이나 빛이 고려되지 않은 본연의
  // 색)

  // mix(x, y, a): a를 축으로 했을 때 가장 낮은 값에서 x값의 영향력을 100%, 가장
  // 높은 값에서 y값의 영향력을 100%로 만든다. smoothstep(x, y, a): a축을
  // 기준으로 x를 최소값, y를 최대값으로 그 사이의 값을 쪼갠다. x와 y 사이를
  // 0-100 사이의 그라디언트처럼 단계별로 표현하고, x 미만의 값은 0, y 이상의
  // 값은 100으로 처리

  // 1. smoothstep(-3.0, 3.0,vPos.x)로 x축의 그라디언트가 표현 될 범위를 -3,
  // 3으로 정한다.
  // 2. mix(color1, color3, smoothstep(-3.0, 3.0,vPos.x))로 color1과 color3을
  // 위의 범위 안에서 그라디언트로 표현한다.
  // 예를 들어 color1이 노랑, color3이 파랑이라고 치면, x축 기준 -3부터 3까지
  // 노랑과 파랑 사이의 그라디언트가 나타나고, -3보다 작은 값에서는 계속 노랑,
  // 3보다 큰 값에서는 계속 파랑이 나타난다.
  // 3. mix()를 한 번 더 사용해서 위의 그라디언트와 color2를 z축 기준으로
  // 분배한다.

  //-------- materiality ------------
  ReflectedLight reflectedLight =
      ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));
  vec3 totalEmissiveRadiance = emissive;

  #ifdef TRANSMISSION
    float totalTransmission = transmission;
  #endif
  #include <logdepthbuf_fragment>
  #include <map_fragment>
  #include <color_fragment>
  #include <alphamap_fragment>
  #include <alphatest_fragment>
  #include <roughnessmap_fragment>
  #include <metalnessmap_fragment>
  #include <normal_fragment_begin>
  #include <normal_fragment_maps>
  #include <clearcoat_normal_fragment_begin>
  #include <clearcoat_normal_fragment_maps>
  #include <emissivemap_fragment>
  // #include <transmissionmap_fragment>
  #include <lights_physical_fragment>
  #include <lights_fragment_begin>
  #include <lights_fragment_maps>
  #include <lights_fragment_end>
  #include <aomap_fragment>
    vec3 outgoingLight =
        reflectedLight.directDiffuse + reflectedLight.indirectDiffuse +
        reflectedLight.directSpecular + reflectedLight.indirectSpecular;
    //위에서 정의한 diffuseColor에 환경이나 반사값들을 반영한 값.
  #ifdef TRANSMISSION
    diffuseColor.a *=
        mix(saturate(1. - totalTransmission +
                    linearToRelativeLuminance2(reflectedLight.directSpecular +
                                              reflectedLight.indirectSpecular)),
            1.0, metalness);
  #endif


  #include <tonemapping_fragment>
  #include <encodings_fragment>
  #include <fog_fragment>
  #include <premultiplied_alpha_fragment>
  #include <dithering_fragment>


  gl_FragColor = vec4(outgoingLight, diffuseColor.a);
  // gl_FragColor가 fragment shader를 통해 나타나는 최종값으로, diffuseColor에서
  // 정의한 그라디언트 색상 위에 반사나 빛을 계산한 값을 최종값으로 정의.
  // gl_FragColor = vec4(mix(mix(color1, color3, smoothstep(-3.0, 3.0,vPos.x)),
  // color2, vNormal.z), 1.0); 위처럼 최종값을 그라디언트 값 자체를 넣으면 환경
  // 영향없는 그라디언트만 표현됨.
}
`;

export const sphereVertexShader = `
// #pragma glslify: pnoise = require(glsl-noise/periodic/3d)

vec3 mod289(vec3 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x)
{
  return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec3 fade(vec3 t) {
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}

// Classic Perlin noise, periodic variant
float pnoise(vec3 P, vec3 rep)
{
  vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period
  vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}


//-------- start here ------------

varying vec3 vNormal;
uniform float uTime;
uniform float uSpeed;
uniform float uNoiseDensity;
uniform float uNoiseStrength;
uniform float uFrequency;
uniform float uAmplitude;
varying vec3 vPos;
varying float vDistort;
varying vec2 vUv;
varying vec3 vViewPosition;

#define STANDARD
#ifndef FLAT_SHADED
  #ifdef USE_TANGENT
    varying vec3 vTangent;
    varying vec3 vBitangent;
  #endif
#endif

#include <clipping_planes_pars_vertex>
#include <color_pars_vertex>
#include <common>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <morphtarget_pars_vertex>
#include <shadowmap_pars_vertex>
#include <skinning_pars_vertex>
#include <uv2_pars_vertex>
#include <uv_pars_vertex>


// rotation
mat3 rotation3dY(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

vec3 rotateY(vec3 v, float angle) { return rotation3dY(angle) * v; }

void main() {
  #include <beginnormal_vertex>
  #include <color_vertex>
  #include <defaultnormal_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <uv2_vertex>
  #include <uv_vertex>
  #ifndef FLAT_SHADED
    vNormal = normalize(transformedNormal);
  #ifdef USE_TANGENT
    vTangent = normalize(transformedTangent);
    vBitangent = normalize(cross(vNormal, vTangent) * tangent.w);
  #endif
  #endif
  #include <begin_vertex>

  #include <clipping_planes_vertex>
  #include <displacementmap_vertex>
  #include <logdepthbuf_vertex>
  #include <morphtarget_vertex>
  #include <project_vertex>
  #include <skinning_vertex>
    vViewPosition = -mvPosition.xyz;
  #include <fog_vertex>
  #include <shadowmap_vertex>
  #include <worldpos_vertex>

  //-------- start vertex ------------
  float t = uTime * uSpeed;
  float distortion =
      pnoise((normal + t) * uNoiseDensity, vec3(10.0)) * uNoiseStrength;
  vec3 pos = position + (normal * distortion);
  float angle = sin(uv.y * uFrequency + t) * uAmplitude;
  pos = rotateY(pos, angle);

  vPos = pos;
  vDistort = distortion;
  vNormal = normal;
  vUv = uv;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
}
`;

export const sphereFragmentShader = `
#define STANDARD
#ifdef PHYSICAL
#define REFLECTIVITY
#define CLEARCOAT
#define TRANSMISSION
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef TRANSMISSION
uniform float transmission;
#endif
#ifdef REFLECTIVITY
uniform float reflectivity;
#endif
#ifdef CLEARCOAT
uniform float clearcoat;
uniform float clearcoatRoughness;
#endif
#ifdef USE_SHEEN
uniform vec3 sheen;
#endif
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
#ifdef USE_TANGENT
varying vec3 vTangent;
varying vec3 vBitangent;
#endif
#endif
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <color_pars_fragment>
#include <common>
#include <dithering_pars_fragment>
#include <emissivemap_pars_fragment>
#include <lightmap_pars_fragment>
#include <map_pars_fragment>
#include <packing>
#include <uv2_pars_fragment>
#include <uv_pars_fragment>
// #include <transmissionmap_pars_fragment>
#include <bsdfs>
#include <bumpmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <clipping_planes_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <lights_physical_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <shadowmap_pars_fragment>
// include를 통해 가져온 값은 대부분 환경, 빛 등을 계산하기 위해서 기본 fragment
// shader의 값들을 받아왔습니다. 일단은 무시하셔도 됩니다.
varying vec3 vNormal;
varying float displacement;
varying vec3 vPos;
varying float vDistort;
uniform float uC1r;
uniform float uC1g;
uniform float uC1b;
uniform float uC2r;
uniform float uC2g;
uniform float uC2b;
uniform float uC3r;
uniform float uC3g;
uniform float uC3b;
varying vec3 color1;
varying vec3 color2;
varying vec3 color3;
varying float distanceToCenter;


// for npm package, need to add this manually
// 'linearToRelativeLuminance' : function already has a body
float linearToRelativeLuminance2( const in vec3 color ) {
    vec3 weights = vec3( 0.2126, 0.7152, 0.0722 );
    return dot( weights, color.rgb );
}

void main() {
  //-------- basic gradient ------------
  vec3 color1 = vec3(uC1r, uC1g, uC1b);
  vec3 color2 = vec3(uC2r, uC2g, uC2b);
  vec3 color3 = vec3(uC3r, uC3g, uC3b);
  float clearcoat = 1.0;
  float clearcoatRoughness = 0.5;
#include <clipping_planes_fragment>

  float distanceToCenter = distance(vPos, vec3(0, 0, 0));
  // distanceToCenter로 중심점과의 거리를 구함.

  vec4 diffuseColor =
      vec4(mix(color3, mix(color2, color1, smoothstep(-1.0, 1.0, vPos.y)),
               distanceToCenter),
           1);

  //-------- materiality ------------
  ReflectedLight reflectedLight =
      ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));
  vec3 totalEmissiveRadiance = emissive;
#ifdef TRANSMISSION
  float totalTransmission = transmission;
#endif
#include <logdepthbuf_fragment>
#include <map_fragment>
#include <color_fragment>
#include <alphamap_fragment>
#include <alphatest_fragment>
#include <roughnessmap_fragment>
#include <metalnessmap_fragment>
#include <normal_fragment_begin>
#include <normal_fragment_maps>
#include <clearcoat_normal_fragment_begin>
#include <clearcoat_normal_fragment_maps>
#include <emissivemap_fragment>
// #include <transmissionmap_fragment>
#include <lights_physical_fragment>
#include <lights_fragment_begin>
#include <lights_fragment_maps>
#include <lights_fragment_end>
#include <aomap_fragment>
  vec3 outgoingLight =
      reflectedLight.directDiffuse + reflectedLight.indirectDiffuse +
      reflectedLight.directSpecular + reflectedLight.indirectSpecular;
//위에서 정의한 diffuseColor에 환경이나 반사값들을 반영한 값.
#ifdef TRANSMISSION
  diffuseColor.a *=
      mix(saturate(1. - totalTransmission +
                   linearToRelativeLuminance2(reflectedLight.directSpecular +
                                             reflectedLight.indirectSpecular)),
          1.0, metalness);
#endif
  gl_FragColor = vec4(outgoingLight, diffuseColor.a);
  // gl_FragColor가 fragment shader를 통해 나타나는 최종값으로, diffuseColor에서
  // 정의한 그라디언트 색상 위에 반사나 빛을 계산한 값을 최종값으로 정의.
  // gl_FragColor = vec4(mix(mix(color1, color3, smoothstep(-3.0, 3.0,vPos.x)),
  // color2, vNormal.z), 1.0); 위처럼 최종값을 그라디언트 값 자체를 넣으면 환경
  // 영향없는 그라디언트만 표현됨.

#include <tonemapping_fragment>
#include <encodings_fragment>
#include <fog_fragment>
#include <premultiplied_alpha_fragment>
#include <dithering_fragment>
}
`;
