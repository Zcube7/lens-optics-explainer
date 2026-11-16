/*
 * vf-shader.js —— 取景器 WebGL 渲染用的 GLSL。
 * 做法：薄透镜相机 + 光圈面随机采样（每次绘制 1 个样本，多次累加平均），所以虚化、前后景遮挡、
 * 光圈形状都是按光路算出来的，不是后期模糊。点光源单独解析计算（否则噪点收敛太慢）。
 * 世界坐标：X 右、Y 上、Z 前，单位米；主体站在原点，相机在 (0, 1.5, −拍摄距离)。
 */
(function () {
  'use strict';

  var TRACE = `#version 300 es
precision highp float;
precision highp int;
out vec4 o;
uniform vec2 uRes; uniform float uK; uniform vec3 uCam, uRight, uUp, uFwd;
uniform float uA, uInvS, uPolyAmt, uBlades, uSeed;
uniform sampler2D uAtlas;
uniform vec4 uTree[14]; uniform vec4 uPost[9]; uniform vec4 uLight[39]; uniform vec3 uLightCol[39];
uniform vec4 uBld[14]; uniform int uNB; uniform float uSign[6]; uniform vec3 uMoon;
const float PI = 3.14159265;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
float vnoise3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm2(vec2 p){ return .5 * vnoise(p) + .25 * vnoise(p * 2.03 + 7.1) + .125 * vnoise(p * 4.01 + 3.3) + .0625 * vnoise(p * 8.1 + 1.7); }

// 光圈开口在 th 方向上的半径（1 = 正圆；收小后叶片围成多边形）
float apR(float th){ float seg = 2. * PI / uBlades; float a = mod(th + 1.5708, seg) - .5 * seg; return mix(1., cos(.5 * seg) / cos(a), uPolyAmt); }

// ---------------- 主体：用距离场拼的人形 ----------------
float sdEll(vec3 p, vec3 r){ float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.) / k1; }
float sdCone(vec3 p, vec3 a, vec3 b, float r1, float r2){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h) - mix(r1, r2, h); }
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.) / k; return min(a, b) - h * h * k * .25; }
// 返回 (距离, 材质)：1 皮肤 2 头发 3 外套 4 围巾 5 裤子 6 鞋 7 眼睛 8 嘴
vec2 fig(vec3 p0){
  vec3 p = vec3(abs(p0.x), p0.y, p0.z);
  vec2 r = vec2(1e9, 0.);
  if (p.y > 1.22) {
    float head = sdEll(p - vec3(0., 1.565, 0.), vec3(.088, .112, .098));
    head = smin(head, length(p - vec3(0., 1.553, .096)) - .013, .02);
    head = smin(head, length(p - vec3(.088, 1.56, 0.)) - .018, .015);
    float skin = min(head, sdCone(p, vec3(0., 1.38, -.005), vec3(0., 1.47, 0.), .043, .043));
    r = vec2(skin, 1.);
    float hair = max(sdEll(p - vec3(0., 1.598, -.018), vec3(.099, .106, .110)), -sdEll(p - vec3(0., 1.515, .105), vec3(.080, .112, .10)));
    hair = smin(hair, sdCone(p, vec3(.088, 1.58, -.01), vec3(.105, 1.34, -.02), .034, .028), .02);
    hair = smin(hair, sdEll(p - vec3(0., 1.46, -.07), vec3(.105, .16, .045)), .02);
    if (hair < r.x) r = vec2(hair, 2.);
    float eye = length(p - vec3(.034, 1.578, .083)) - .0125; if (eye < r.x) r = vec2(eye, 7.);
    float lip = sdEll(p - vec3(0., 1.512, .088), vec3(.02, .005, .012)); if (lip < r.x) r = vec2(lip, 8.);
  } else r.x = 1.30 - p.y;
  if (p.y > .55 && p.y < 1.52) {
    vec3 q = vec3(p.x / 1.16, p.y, p.z);
    float coat = sdCone(q, vec3(0., 1.02, 0.), vec3(0., 1.36, 0.), .142, .112);
    coat = smin(coat, sdCone(q, vec3(0., .80, 0.), vec3(0., 1.02, 0.), .165, .142), .03);
    coat = smin(coat, sdCone(p, vec3(0., 1.385, 0.), vec3(.128, 1.375, 0.), .062, .058), .035);
    coat = smin(coat, sdCone(p, vec3(.172, 1.365, 0.), vec3(.205, 1.10, -.01), .050, .045), .012);
    coat = smin(coat, sdCone(p, vec3(.205, 1.10, -.01), vec3(.205, .90, .035), .045, .040), .02);
    if (coat < r.x) r = vec2(coat, 3.);
    vec3 pt = p - vec3(0., 1.435, .004);
    float scarf = length(vec2(length(pt.xz) - .072, pt.y * .9)) - .036;
    scarf = smin(scarf, sdCone(p0, vec3(.045, 1.42, .085), vec3(.07, 1.17, .125), .032, .03), .02);
    if (scarf < r.x) r = vec2(scarf, 4.);
    float hand = length(p - vec3(.205, .85, .04)) - .038; if (hand < r.x) r = vec2(hand, 1.);
  } else r.x = min(r.x, p.y < 1. ? .63 - p.y : p.y - 1.49);
  if (p.y < 1.0) {
    float leg = sdCone(p, vec3(.085, .86, 0.), vec3(.09, .09, 0.), .075, .055); if (leg < r.x) r = vec2(leg, 5.);
    float shoe = sdEll(p - vec3(.09, .04, .035), vec3(.055, .042, .115)); if (shoe < r.x) r = vec2(shoe, 6.);
  } else r.x = min(r.x, p.y - .935);
  return r;
}
// 光线与人形求交（人面向 −Z，所以 z 取反）。返回 t，没碰到返回 −1
float figMarch(vec3 ro, vec3 rd, float tmax){
  ro.z = -ro.z; rd.z = -rd.z;
  vec3 inv = 1. / (rd + step(abs(rd), vec3(1e-6)) * 1e-6);
  vec3 t0 = (vec3(-.28, 0., -.2) - ro) * inv, t1 = (vec3(.28, 1.72, .22) - ro) * inv;
  vec3 ts = min(t0, t1), tb = max(t0, t1);
  float tn = max(max(ts.x, ts.y), max(ts.z, 0.)), tf = min(min(tb.x, tb.y), min(tb.z, tmax));
  if (tn >= tf) return -1.;
  float t = tn;
  for (int i = 0; i < 60; i++) { float d = fig(ro + rd * t).x; if (d < .0012) return t; t += d; if (t > tf) break; }
  return -1.;
}

// ---------------- 树：树干圆柱 + 四个带噪声镂空的球当树冠 ----------------
float treeHit(vec3 ro, vec3 rd, float tmax, out vec3 col, out vec3 nor){
  float best = tmax; col = vec3(0.); nor = vec3(0., 1., 0.);
  for (int i = 0; i < 14; i++) {
    vec4 T = uTree[i]; float h = T.z;
    vec3 oc = ro - vec3(T.x, .5 * h, T.y); float b = dot(oc, rd), c = dot(oc, oc) - .36 * h * h, disc = b * b - c;
    if (disc < 0. || -b - sqrt(disc) > best || -b + sqrt(disc) < 0.) continue;
    vec2 o2 = ro.xz - T.xy; float a = dot(rd.xz, rd.xz), bb = dot(o2, rd.xz), rr = .028 * h, dd = bb * bb - a * (dot(o2, o2) - rr * rr);
    if (dd > 0. && a > 1e-8) {
      float t = (-bb - sqrt(dd)) / a, y = ro.y + rd.y * t;
      if (t > 0. && t < best && y > 0. && y < .55 * h) {
        best = t; vec3 p = ro + rd * t; nor = normalize(vec3(p.x - T.x, 0., p.z - T.y));
        col = vec3(.085, .06, .045) * (.6 + .8 * vnoise(vec2(p.y * 7., atan(nor.x, nor.z) * 4.)));
      }
    }
    for (int k = 0; k < 4; k++) {
      vec3 sc; float sr;
      if (k == 0) { sc = vec3(0., .64, 0.); sr = .30; } else if (k == 1) { sc = vec3(-.21, .53, .04); sr = .21; }
      else if (k == 2) { sc = vec3(.21, .56, -.04); sr = .21; } else { sc = vec3(.02, .82, 0.); sr = .20; }
      sc = vec3(T.x, 0., T.y) + sc * h; sr *= h;
      vec3 q = ro - sc; float b2 = dot(q, rd), d2 = b2 * b2 - (dot(q, q) - sr * sr);
      if (d2 < 0.) continue;
      float t = -b2 - sqrt(d2); if (t <= 0. || t >= best) continue;
      vec3 p = ro + rd * t, n = (p - sc) / sr;
      float nz = vnoise3(p * 2.1 + T.w * 17.) * .6 + vnoise3(p * 5.7) * .4;
      if (-dot(n, rd) * 1.5 + nz < .62) continue;
      best = t; nor = normalize(n + (nz - .5) * vec3(.6, .9, .6));
      vec3 base = T.w > .5 ? vec3(.40, .19, .045) : vec3(.05, .15, .06);
      col = base * (.3 + 1.2 * nz) * (.6 + .4 * n.y);
    }
  }
  return best;
}

// 从 ro 朝 rd 走 dist 米，路上有没有被主体 / 树 / 路牌挡住（给点光源用）
float visible(vec3 ro, vec3 rd, float dist){
  if (figMarch(ro, rd, dist) > 0.) return 0.;
  vec3 c, n; if (treeHit(ro, rd, dist, c, n) < dist) return 0.;
  for (int i = 0; i < 6; i++) { float t = (uSign[i] - ro.z) / rd.z; if (t > 0. && t < dist) { vec3 p = ro + rd * t; if (abs(p.x - 2.) < .4 && p.y > .75 && p.y < 1.25) return 0.; } }
  return 1.;
}

vec3 sky(vec3 rd){
  float e = degrees(asin(clamp(rd.y, -1., 1.)));
  vec3 c = mix(vec3(1., .62, .30), vec3(.92, .38, .17), smoothstep(-2., 2.5, e));
  c = mix(c, vec3(.52, .17, .20), smoothstep(2.5, 7., e));
  c = mix(c, vec3(.15, .075, .24), smoothstep(7., 14., e));
  c = mix(c, vec3(.032, .038, .15), smoothstep(14., 26., e));
  c = mix(c, vec3(.008, .013, .065), smoothstep(26., 45., e));
  c = mix(c, vec3(.003, .005, .03), smoothstep(45., 80., e));
  float az = atan(rd.x, rd.z);
  c += vec3(1., .5, .2) * .35 * exp(-(az * az * 3. + e * e * .02));
  vec3 mc = cross(rd, uMoon);
  if (dot(mc, mc) < 2.0594e-5 && dot(rd, uMoon) > 0.) {                                  // 月亮：视半径 0.26°
    vec3 mu = normalize(cross(uMoon, vec3(0., 1., 0.))), mv = cross(mu, uMoon);
    vec2 m = vec2(dot(rd, mu), dot(rd, mv)) / .004538;
    float tex = .72 + .28 * vnoise(m * 2.2 + 3.) - .22 * smoothstep(.45, .7, vnoise(m * 1.3 + 9.));
    c = vec3(.95, .90, .76) * tex * (.6 + .4 * sqrt(max(1. - dot(m, m), 0.)));
  }
  return c;
}

// 沿一条光线看到的颜色（线性、未做色调映射）
vec3 trace(vec3 ro, vec3 rd){
  float tb = 1e9; vec3 nor = vec3(0., 1., 0.), alb = vec3(0.), emi = vec3(0.); float spec = 0., ao = 1.; bool hit = false;
  if (rd.y < -1e-5) {                                    // 地面
    float t = -ro.y / rd.y; vec3 p = ro + rd * t; tb = t; hit = true; float ax = abs(p.x);
    if (ax < 1.5) {
      alb = vec3(.085, .082, .078) * (.7 + .6 * fbm2(p.xz * 5.));
      if (ax < .07 && mod(p.z, 3.) < 1.3) alb = mix(alb, vec3(.5, .48, .40), .85);
      if (ax > 1.4) alb = mix(alb, vec3(.22, .21, .20), .8);
      spec = .5;
    } else alb = mix(vec3(.022, .05, .02), vec3(.07, .085, .028), fbm2(p.xz * 1.3)) * (.65 + .7 * vnoise(p.xz * 21.));
    ao = 1. - .6 * exp(-dot(p.xz, p.xz) / .07);
  }
  for (int i = 0; i < 6; i++) {                          // 路牌
    float t = (uSign[i] - ro.z) / rd.z; if (t <= 0. || t >= tb) continue;
    vec3 p = ro + rd * t; vec2 uv = vec2((p.x - 1.6) / .8, (p.y - .75) / .5);
    if (uv.x > 0. && uv.x < 1. && uv.y > 0. && uv.y < 1.) {
      float col = mod(float(i), 2.), row = floor(float(i) / 2.);
      alb = textureLod(uAtlas, vec2((col + uv.x) * .5, (row + 1. - uv.y) * .3125), 0.).rgb * .8;
      tb = t; hit = true; nor = vec3(0., 0., -1.); spec = .1; ao = 1.; emi = vec3(0.);
    } else if (abs(p.x - 2.) < .03 && p.y > 0. && p.y < .75) { tb = t; hit = true; nor = vec3(0., 0., -1.); alb = vec3(.12); spec = .3; ao = 1.; }
  }
  for (int i = 0; i < 9; i++) {                          // 灯杆
    vec4 P = uPost[i]; vec2 o2 = ro.xz - P.xy; float a = dot(rd.xz, rd.xz), bb = dot(o2, rd.xz), dd = bb * bb - a * (dot(o2, o2) - P.z * P.z);
    if (dd > 0. && a > 1e-8) { float t = (-bb - sqrt(dd)) / a, y = ro.y + rd.y * t;
      if (t > 0. && t < tb && y > 0. && y < P.w) { tb = t; hit = true; vec3 p = ro + rd * t; nor = normalize(vec3(p.x - P.x, 0., p.z - P.y)); alb = vec3(.035, .037, .042); spec = .6; ao = 1.; emi = vec3(0.); } }
  }
  { vec3 c, n; float t = treeHit(ro, rd, tb, c, n); if (t < tb) { tb = t; hit = true; nor = n; alb = c; spec = 0.; ao = 1.; emi = vec3(0.); } }
  { float t = figMarch(ro, rd, tb);                      // 主体
    if (t > 0. && t < tb) {
      tb = t; hit = true; vec3 p = ro + rd * t, pf = vec3(p.x, p.y, -p.z); vec2 e = vec2(.0015, -.0015);
      vec3 n = normalize(e.xyy * fig(pf + e.xyy).x + e.yyx * fig(pf + e.yyx).x + e.yxy * fig(pf + e.yxy).x + e.xxx * fig(pf + e.xxx).x);
      nor = vec3(n.x, n.y, -n.z); float m = fig(pf).y; spec = .08; emi = vec3(0.);
      if (m < 1.5) { alb = vec3(.80, .56, .43); alb = mix(alb, vec3(.86, .40, .36), .55 * exp(-dot(vec2(abs(pf.x) - .052, pf.y - 1.535), vec2(abs(pf.x) - .052, pf.y - 1.535)) / .0006)); spec = .15; }
      else if (m < 2.5) { alb = vec3(.035, .022, .016); spec = .5; }
      else if (m < 3.5) {
        alb = vec3(.74, .47, .05) * (.9 + .2 * vnoise(pf.xy * 160.)) * (.8 + .2 * smoothstep(.8, 1.2, pf.y));
        if (pf.z > 0.) {
          alb *= .55 + .45 * smoothstep(.0015, .005, abs(pf.x - .012));
          float by = abs(fract((pf.y - .93) / .13) - .5) * .13;
          if (pf.y > .9 && pf.y < 1.33 && length(vec2(pf.x + .018, by)) < .011) { alb = vec3(.10, .06, .02); spec = .6; }
        }
      }
      else if (m < 4.5) { alb = vec3(.42, .05, .045) * (.8 + .4 * vnoise(vec2(pf.x * 30., pf.y * 220.))); }
      else if (m < 5.5) { alb = vec3(.035, .05, .11) * (.85 + .3 * vnoise(pf.xy * 200.)); }
      else if (m < 6.5) { alb = vec3(.012); spec = .4; }
      else if (m < 7.5) { alb = vec3(.01); spec = 2.5; }
      else alb = vec3(.45, .12, .12);
      ao = .55 + .45 * smoothstep(-.3, .6, nor.y + .35 * smoothstep(1.3, 1.5, p.y));
    } }
  for (int i = 0; i < 14; i++) {                         // 远处的楼：亮着灯的窗户
    if (i >= uNB) break; vec4 B = uBld[i]; float t = (B.w - ro.z) / rd.z; if (t <= 0. || t >= tb) continue;
    vec3 p = ro + rd * t; if (p.x < B.x || p.x > B.y || p.y < 0. || p.y > B.z) continue;
    tb = t; hit = true; nor = vec3(0., 0., -1.); spec = 0.; ao = 1.;
    alb = vec3(.022, .025, .04) * (.8 + .4 * hash12(vec2(float(i), 3.)));
    vec2 g = vec2((p.x - B.x) / 3., p.y / 3.2), id = floor(g), f = fract(g);
    float h = hash12(id + float(i) * 13.7); emi = vec3(0.);
    if (f.x > .22 && f.x < .78 && f.y > .25 && f.y < .72 && p.y < B.z - 1. && p.x - B.x > .5 && B.y - p.x > .5) {
      if (h < .36) emi = mix(vec3(1., .62, .27), vec3(.75, .9, 1.), step(.31, h)) * (1.1 + 2.2 * hash12(id + 5.3));
      else alb = vec3(.012, .016, .03);
    }
  }
  if (rd.z > 1e-5) {                                     // 远山
    float t = (3200. - ro.z) / rd.z; vec3 p = ro + rd * t;
    if (t < tb && p.y < 110. + 300. * fbm2(vec2(p.x / 1100., 2.)) + 60. * vnoise(vec2(p.x / 230., 5.))) return mix(vec3(.022, .024, .075), sky(vec3(rd.x, 0., rd.z)), .16);
  }
  if (!hit) return sky(rd);
  vec3 p = ro + rd * tb;
  vec3 amb = mix(vec3(.035, .03, .035), vec3(.12, .14, .27), .5 + .5 * nor.y) + vec3(.34, .17, .09) * max(nor.z, 0.) * .5;
  vec3 kd = normalize(vec3(-.5, .5, -.72));              // 画外的主光（相机左前方的店面灯光）
  vec3 col = alb * (amb * ao + vec3(1., .84, .66) * .95 * max(dot(nor, kd) * .7 + .3, 0.) * (.6 + .4 * ao));
  col += vec3(1., .84, .66) * spec * .5 * pow(max(dot(nor, normalize(kd - rd)), 0.), 40.);
  for (int i = 0; i < 5; i++) {                          // 五盏路灯
    vec3 L = uLight[i].xyz - p; float d2 = dot(L, L); vec3 l = L * inversesqrt(d2);
    float fall = 22. / (d2 + 1.5);
    col += alb * vec3(1., .72, .40) * max(dot(nor, l), 0.) * fall * ao;
    col += vec3(1., .72, .40) * spec * fall * .35 * pow(max(dot(nor, normalize(l - rd)), 0.), 60.);
  }
  col += emi;
  float fog = 1. - exp(-tb * .0024);
  return mix(col, sky(vec3(rd.x, 0., max(rd.z, .2))) * .55, fog * .8);
}

void main(){
  vec2 px = gl_FragCoord.xy, r0 = hash22(px + .37);
  vec2 jit = fract(r0 + uSeed * vec2(.7548776662, .5698402910));
  vec2 u = fract(hash22(px.yx * 1.31 + 11.7) + uSeed * vec2(.8191725134, .6710436067));
  vec2 q = (px - .5 + jit - .5 * uRes) / uK;             // 这个像素对应的方向（正切值）
  float th = 2. * PI * u.y;
  vec2 lens = sqrt(u.x) * apR(th) * vec2(cos(th), sin(th)) * uA;
  vec3 ro = uCam + uRight * lens.x + uUp * lens.y;
  vec3 dir = uRight * q.x + uUp * q.y + uFwd;
  vec3 rd = uInvS > 1e-7 ? normalize(uCam + dir / uInvS - ro) : normalize(dir);
  vec3 col = trace(ro, rd);

  // ---- 点光源：直接算它的光斑盖不盖得到这个像素 ----
  vec2 qc = (px - .5 * uRes) / uK;
  for (int i = 0; i < 39; i++) {
    vec3 d = uLight[i].xyz - uCam; float z = dot(d, uFwd); if (z < .3) continue;
    vec2 c = vec2(dot(d, uRight), dot(d, uUp)) / z;
    float k = uInvS - 1. / z, rb = uA * abs(k) * z, R = uLight[i].w, Rt = sqrt(rb * rb + R * R);
    vec2 dq = (qc - c) * z; float rr = length(dq), edge = 1.2 * z / uK;
    float gd = length(qc - c) * uK / uRes.x;                                          // 离灯的距离，占画面宽度的比例
    float glare = i < 5 ? .0035 / (1. + gd * gd * 2500.) * smoothstep(.16, .04, gd) * min(1., R * R / (Rt * Rt) * 6.) : 0.;   // 路灯的一点眩光
    float w = rb * rb / (Rt * Rt), m = 0.;
    if (rr <= Rt + edge) {
      vec2 an = dq * sign(k);
      float shape = mix(1., apR(atan(an.y, an.x)), w);
      m = 1. - smoothstep(Rt * shape - edge, Rt * shape + edge, rr);
    }
    if (m <= 0. && glare <= 0.) continue;
    vec2 a = (m > 0. && abs(k) > 1e-6) ? dq / (z * k) * w : vec2(0.);
    vec3 lro = uCam + uRight * a.x + uUp * a.y, ld = uLight[i].xyz - lro; float ll = length(ld);
    col += uLightCol[i] * ((R * R / (Rt * Rt)) * m * (.8 + .35 * rr * rr / (Rt * Rt)) + glare) * visible(lro, ld / ll, ll - .3);
  }
  o = vec4(clamp(col, 0., 60.), 1.);
}`;

  var RESOLVE = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uAcc; uniform float uInvCount, uSeed; uniform vec2 uRes;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texelFetch(uAcc, ivec2(gl_FragCoord.xy), 0).rgb * uInvCount;
  vec2 v = uv - .5; c *= 1. - .55 * dot(v, v);                               // 一点暗角
  c *= 1.25;
  c = (c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14);                 // ACES 近似
  c = pow(clamp(c, 0., 1.), vec3(1. / 2.2));
  c += (hash12(gl_FragCoord.xy + uSeed) - .5) * .014;                        // 胶片颗粒
  o = vec4(c, 1.);
}`;

  var VERT = `#version 300 es
in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0., 1.); }`;

  window.VFShader = { TRACE: TRACE, RESOLVE: RESOLVE, VERT: VERT };
})();
