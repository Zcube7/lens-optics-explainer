/*
 * vf-three.js —— 取景器的 3D 场景与渲染（three.js r180，ES 模块）。
 *
 * 场景：外滩蓝调时刻的实拍全景当环境（地面部分投影成真的地面），主体是一尊扫描的大理石胸像，
 *       身后有复古路灯、提灯、盆栽、路牌、彩灯。素材全部来自 Poly Haven（CC0），见 assets/CREDITS.md。
 * 景深：不做后期模糊。每一帧把相机挪到光圈面上的一个点、并把投影剪切到对焦平面不动，累加几百帧取平均——
 *       和真实镜头「光圈上每一点各看到一幅略有视差的画面」是同一回事，所以前后遮挡自然正确。
 * 点光源：很小很亮的灯靠累加收敛太慢，单独用解析的圆盘（收光圈后是多边形）画，并用中心视角的深度图判断遮挡。
 *
 * 坐标：对外沿用取景器的约定（X 右、Y 上、Z 向前，主体在原点，相机在 Z<0）。three.js 是右手系，
 *       所以内部一律把 Z 取反（见 V()）。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const ASSETS = 'assets/';
const TARGET = 400;                 // 每次参数变化后累加多少帧
const NEAR = 0.05, FAR = 4000;
const ENV_ROT = THREE.MathUtils.degToRad(115);   // 把全景转到「陆家嘴的灯火在主体身后偏右」
const CAPTURE_H = 1.6;              // 全景拍摄时相机离地高度（米），用来把下半球投影成地面
const WALL = 11;                    // 拍摄点周围最近的游客大约在这个距离（米）：再远的东西都贴到一道弧形墙上
const TUNE = { env: 0.7, envLdr: 1.5, bg: 1.0, boost: 14, exposure: 1.0 };

const V = (x, y, z) => new THREE.Vector3(x, y, -z);
const R2 = (i, a) => { const v = (0.5 + i * a) % 1; return v < 0 ? v + 1 : v; };

// ---------- 着色器 ----------
const FSQ_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

const BG_FRAG = `
uniform sampler2D map; uniform float uGain, uBoost; varying vec2 vUv;
void main(){
  vec3 c = texture2D(map, vUv).rgb;
  float l = max(c.r, max(c.g, c.b)), h = smoothstep(.70, 1., l);
  gl_FragColor = vec4(c * uGain * (1. + uBoost * h * h), 1.);     // 照片里过曝成白的灯，把亮度补回去，虚化后才是亮光斑
}`;

const ADD_FRAG = 'uniform sampler2D tSrc; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.); }';

const RESOLVE_FRAG = `
uniform sampler2D tAcc, tLights; uniform float uInv, uExposure, uSeed; uniform vec2 uRes; varying vec2 vUv;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 c = texture2D(tAcc, vUv).rgb * uInv + texture2D(tLights, vUv).rgb;
  vec2 v = vUv - .5; c *= uExposure * (1. - .5 * dot(v, v));                      // 一点暗角
  vec3 t = max(c - .8, 0.); c = min(c, vec3(.8)) + .2 * (1. - exp(-t / .25));       // 0.8 以下原样，高光柔和收到 1
  c = pow(clamp(c, 0., 1.), vec3(1. / 2.2));
  c += (hash12(gl_FragCoord.xy + uSeed) - .5) * .012;                              // 胶片颗粒
  gl_FragColor = vec4(c, 1.);
}`;

const LIGHT_VERT = `
uniform mat4 uView, uProjC; uniform vec2 uRes; uniform float uK, uA, uInvS, uGlare;
attribute vec3 iPos; attribute float iR; attribute vec3 iCol; attribute float iLamp;
varying vec2 vOff; varying vec3 vCol; varying float vRpx, vW, vSign, vZ, vLamp;
void main(){
  vec4 v = uView * vec4(iPos, 1.); float z = -v.z;
  float k = uInvS - 1. / max(z, 1e-3), rb = uA * abs(k) * z, Rt = sqrt(rb * rb + iR * iR);
  vRpx = max(Rt / z * uK, .6); vW = rb * rb / (Rt * Rt); vSign = k < 0. ? -1. : 1.; vZ = z; vLamp = iLamp;
  vCol = iCol * min(iR * iR / (Rt * Rt), 1.) * min(1., (Rt / z * uK) * (Rt / z * uK) / .36);   // 不到一个像素的灯按面积变暗
  float ext = max(vRpx + 2., iLamp * uGlare * uRes.x);
  vOff = position.xy * ext;
  vec4 c = uProjC * v;
  gl_Position = z < .3 ? vec4(2., 2., 2., 1.) : vec4(c.xy / c.w + vOff * 2. / uRes, 0., 1.);
}`;

const LIGHT_FRAG = `
uniform sampler2D tDepth; uniform vec2 uRes; uniform float uPolyAmt, uBlades, uNear, uFar;
varying vec2 vOff; varying vec3 vCol; varying float vRpx, vW, vSign, vZ, vLamp;
float apR(float th){ float seg = 6.2831853 / uBlades; float a = mod(th + 1.5708, seg) - .5 * seg; return mix(1., cos(.5 * seg) / cos(a), uPolyAmt); }
void main(){
  float rr = length(vOff), m = 0.;
  if (rr <= vRpx + 1.5) {
    vec2 an = vOff * vSign;
    float shape = mix(1., apR(atan(an.y, an.x)), vW);
    m = (1. - smoothstep(vRpx * shape - 1.1, vRpx * shape + 1.1, rr)) * (.8 + .35 * rr * rr / (vRpx * vRpx));
  }
  float gd = rr / uRes.x, glare = vLamp * .006 / (1. + gd * gd * 2200.) * smoothstep(.16, .03, gd);
  if (m <= 0. && glare <= 0.) discard;
  float d = texture2D(tDepth, gl_FragCoord.xy / uRes).x;
  float zs = 2. * uNear * uFar / (uFar + uNear - (2. * d - 1.) * (uFar - uNear));        // 这个像素上最近的不透明物体有多远
  float vis = smoothstep(vZ - .55, vZ - .35, zs);                                        // 比灯近（留出灯罩的余量）就是被挡住了
  gl_FragColor = vec4((vCol * m + vCol * glare) * vis, 1.);
}`;

// ---------- 小工具 ----------
function radialTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function signTexture(label) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 240; const g = c.getContext('2d');
  g.fillStyle = '#0d2b2a'; g.fillRect(0, 0, 384, 240);
  g.strokeStyle = '#e9e4d2'; g.lineWidth = 8; g.strokeRect(14, 14, 356, 212);
  g.fillStyle = '#b9c7bf'; g.font = '600 34px "Microsoft YaHei", "PingFang SC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('主体后方', 192, 68);
  g.fillStyle = '#f4f0e2'; g.font = '700 104px Georgia, "Times New Roman", serif';
  g.fillText(label, 192, 150);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function moonTexture() {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), R = N / 2 - 4;
  g.save(); g.beginPath(); g.arc(N / 2, N / 2, R, 0, 7); g.clip();
  const gr = g.createRadialGradient(N * .44, N * .42, N * .05, N / 2, N / 2, R); gr.addColorStop(0, '#fbf8ec'); gr.addColorStop(.75, '#e9e4d2'); gr.addColorStop(1, '#bdb7a2');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  // 月海：位置大致照着真实月面（雨海、澄海、静海、风暴洋、云海……），先画再整体模糊
  g.filter = 'blur(' + (N * .022).toFixed(1) + 'px)';
  [[.36, .30, .17, .14, .55], [.57, .31, .10, .10, .5], [.66, .44, .11, .09, .5], [.22, .47, .13, .22, .45], [.40, .62, .12, .09, .4],
   [.74, .30, .06, .06, .45], [.79, .52, .06, .08, .4], [.50, .47, .07, .05, .3], [.30, .72, .08, .05, .3]].forEach(([x, y, rx, ry, al]) => {
    g.fillStyle = 'rgba(96,98,104,' + al + ')'; g.beginPath(); g.ellipse(x * N, y * N, rx * N, ry * N, .3, 0, 7); g.fill();
  });
  g.filter = 'blur(' + (N * .004).toFixed(1) + 'px)';
  let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 260; i++) {                                                   // 细碎的明暗起伏
    const an = rnd() * 6.283, d = Math.sqrt(rnd()) * R, r = N * (.004 + rnd() * rnd() * .02), lit = rnd() < .5;
    g.fillStyle = lit ? 'rgba(255,253,244,' + (.05 + rnd() * .12).toFixed(2) + ')' : 'rgba(70,72,78,' + (.05 + rnd() * .12).toFixed(2) + ')';
    g.beginPath(); g.arc(N / 2 + Math.cos(an) * d, N / 2 + Math.sin(an) * d, r, 0, 7); g.fill();
  }
  [[.45, .84, .022], [.30, .40, .012], [.24, .58, .011], [.60, .68, .010]].forEach(([x, y, r]) => {   // 第谷、哥白尼、开普勒……几个亮坑
    const rg = g.createRadialGradient(x * N, y * N, 0, x * N, y * N, r * N * 4); rg.addColorStop(0, 'rgba(255,255,250,.9)'); rg.addColorStop(.25, 'rgba(255,255,250,.35)'); rg.addColorStop(1, 'rgba(255,255,250,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x * N, y * N, r * N * 4, 0, 7); g.fill();
  });
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/**
 * 背景穹顶：把全景图贴回一个大致符合实景的形状上，球心在拍摄点（地面上方 h 米）。
 *   地平线以上 → 半径 R 的球面（对岸的楼，按无穷远处理）；
 *   地平线以下 → 离相机 h 米的地面；
 *   主体后方 wall 米处立一道到地平线为止的弧形竖墙：栏杆边的人群、栏杆和江面其实是立着的 / 更远的东西，
 *   全压到地面上会被拉成条纹，贴在这道墙上，相机后退时它们会像真的三十米外的东西一样变小。
 * 纬线在地平线以下按「地面距离」取对数间隔（等角度分的话，贴近地平线那一圈会从几十米直接跨到球面）。
 * rot 是全景绕竖轴转的角度，直接烘进顶点里。three 坐标：相机朝 −Z 看。
 */
function domeGeometry(R, h, wall, rot) {
  const NU = 320, elev = [];
  for (let i = 48; i >= 0; i--) elev.push(i / 48 * Math.PI / 2);                    // 天顶 → 地平线
  const dMax = R * .9, N = 170;
  for (let i = 1; i <= N; i++) elev.push(-Math.atan(h / (dMax * Math.pow(.25 / dMax, i / N))));   // 地面：0.9R → 0.25 m
  elev.push(-Math.PI / 2);                                                          // 正下方
  const pos = [], uv = [], idx = [], NV = elev.length, cr = Math.cos(rot), sr = Math.sin(rot);
  for (let j = 0; j < NV; j++) {
    const e = elev[j], ce = Math.cos(e), se = Math.sin(e);
    for (let i = 0; i <= NU; i++) {
      const u = i / NU, a = 2 * Math.PI * u, lx = -Math.cos(a), lz = -Math.sin(a);  // 与 three 的全景查表方向一致
      const dx = lx * cr + lz * sr, dz = -lx * sr + lz * cr;                        // 绕 Y 轴转 rot
      let t = R;
      if (e < 0) {
        t = Math.min(h / -se, dMax / Math.max(ce, 1e-6));
        const al = Math.abs(Math.atan2(dx, -dz)), A0 = 1.40, A1 = 2.10;              // 人群沿着弧形栏杆站：正前方 ±80° 内墙是圆弧，再往两侧渐渐退到无穷远
        if (al < A1) t = Math.min(t, wall / Math.cos(Math.max(al - A0, 0) / (A1 - A0) * 1.57) / ce);
      }
      pos.push(t * ce * dx, t * se, t * ce * dz);
      uv.push(u, .5 + e / Math.PI);
    }
  }
  for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + NU + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

// 石头底座：车削出来的古典圆柱座
function plinth(height) {
  const pts = [[0, 0], [.31, 0], [.31, .07], [.285, .09], [.26, .13], [.215, .17], [.205, .22], [.19, height - .2], [.2, height - .16], [.245, height - .11], [.27, height - .08], [.27, height - .015], [.255, height], [0, height]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 72); geo.computeVertexNormals();
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#b8b2a6'; g.fillRect(0, 0, 256, 256);
  let s = 5; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 5200; i++) { const v = 150 + rnd() * 70; g.fillStyle = `rgba(${v},${v - 4},${v - 12},.22)`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2.5, 1 + rnd() * 2.5); }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(3, 4);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, roughness: .82, metalness: 0 }));
  m.castShadow = m.receiveShadow = true; return m;
}

// =====================================================================
function create(canvas, hooks = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  const gl = renderer.getContext();
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) { renderer.dispose(); return null; }
  renderer.setPixelRatio(1); renderer.autoClear = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const api = { ready: false, failed: false, count: 0, passes: 2, scale: 1, msPerPass: 0, info: '', faceY: 1.49, gl, three: THREE, tune: TUNE };
  const scene = new THREE.Scene(); api.scene = scene;
  const camera = new THREE.PerspectiveCamera(); camera.matrixAutoUpdate = false; camera.matrixWorldAutoUpdate = false;
  const camC = new THREE.PerspectiveCamera(); camC.matrixAutoUpdate = false; camC.matrixWorldAutoUpdate = false;   // 光圈正中的那一台，给点光源用
  const lights = [];                      // {p: Vector3(three 坐标), r, c:[r,g,b], lamp}
  let moon = null, bg = null, lightMesh = null, lightMat = null;

  // ---------- 离屏缓冲与全屏四边形 ----------
  const quadGeo = new THREE.PlaneGeometry(2, 2), quadCam = new THREE.Camera();
  const mk = (frag, uniforms, extra) => { const s = new THREE.Scene(); const mat = new THREE.ShaderMaterial(Object.assign({ vertexShader: FSQ_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false }, extra || {})); const q = new THREE.Mesh(quadGeo, mat); q.frustumCulled = false; s.add(q); return { s, mat }; };
  const addPass = mk(ADD_FRAG, { tSrc: { value: null } }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
  const resPass = mk(RESOLVE_FRAG, { tAcc: { value: null }, tLights: { value: null }, uInv: { value: 1 }, uExposure: { value: 1 }, uSeed: { value: 0 }, uRes: { value: new THREE.Vector2() } });
  let rtS = null, rtA = null, rtC = null, rtL = null;
  function alloc(w, h) {
    [rtS, rtA, rtC, rtL].forEach(r => r && r.dispose());
    const o = { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false };
    rtS = new THREE.WebGLRenderTarget(w, h, Object.assign({ depthBuffer: true }, o));
    rtA = new THREE.WebGLRenderTarget(w, h, Object.assign({ depthBuffer: false }, o));
    rtL = new THREE.WebGLRenderTarget(w, h, Object.assign({ depthBuffer: false }, o));
    rtC = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h), minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  }

  // ---------- 搭场景（分两段加载） ----------
  // 第一段只要约 1 MB：2k 的全景预览 + 1k 贴图的胸像，加上不用下载的底座、路牌、彩灯，先把画面拍出来；
  // 第二段在后台陆续补：路灯、提灯、HDR 环境光、盆栽、猫石像、胸像的 2k 贴图、8k 全景。每补上一样就重拍一次。
  const m1 = new THREE.LoadingManager(), m2 = new THREE.LoadingManager();
  m1.onProgress = (u, n, t) => hooks.onprogress && hooks.onprogress(n / Math.max(t, 6));
  const fixModel = g => { g.scene.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.transmission) m.transmission = 0; }); }); return g.scene; };
  const loadModel = (mgr, id, res) => new GLTFLoader(mgr).loadAsync(`${ASSETS}models/${id}/${id}_${res}.gltf`).then(fixModel);
  const loadTex = (mgr, url) => new THREE.TextureLoader(mgr).loadAsync(ASSETS + url);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: .5, metalness: .8 });
  let shadow = null, pool = null, bustMesh = null;

  function rebuildLights() {                // 点光源的实例化圆盘：灯多了就重建一次
    const n = lights.length, g = new THREE.InstancedBufferGeometry(); g.index = quadGeo.index; g.setAttribute('position', quadGeo.getAttribute('position')); g.instanceCount = n;
    const pos = new Float32Array(n * 3), rad = new Float32Array(n), col = new Float32Array(n * 3), lmp = new Float32Array(n);
    lights.forEach((l, i) => { l.p.toArray(pos, i * 3); rad[i] = l.r; col[i * 3] = l.c[0] * l.k; col[i * 3 + 1] = l.c[1] * l.k; col[i * 3 + 2] = l.c[2] * l.k; lmp[i] = l.lamp; });
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3)); g.setAttribute('iR', new THREE.InstancedBufferAttribute(rad, 1));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(col, 3)); g.setAttribute('iLamp', new THREE.InstancedBufferAttribute(lmp, 1));
    if (lightMesh) lightMesh.geometry = g;
    else { lightMesh = new THREE.Mesh(g, lightMat); lightMesh.frustumCulled = false; api.lightScene = new THREE.Scene(); api.lightScene.add(lightMesh); }
  }

  async function build() {
    const [pano, bust] = await Promise.all([loadTex(m1, 'env/shanghai_bund_preview.jpg'), loadModel(m1, 'marble_bust_01', '1k')]);

    // 环境光：先用预览图凑合（没有高光，亮度补一点），HDR 到了再换
    pano.colorSpace = THREE.SRGBColorSpace; pano.anisotropy = renderer.capabilities.getMaxAnisotropy(); pano.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(pano).texture; scene.environmentRotation.y = ENV_ROT; scene.environmentIntensity = TUNE.envLdr;

    // 背景：全景贴在穹顶上
    bg = new THREE.Mesh(domeGeometry(900, CAPTURE_H, WALL, ENV_ROT), new THREE.ShaderMaterial({ side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }', fragmentShader: BG_FRAG,
      uniforms: { map: { value: pano }, uGain: { value: TUNE.bg }, uBoost: { value: TUNE.boost } } }));
    bg.position.y = CAPTURE_H; bg.frustumCulled = false; scene.add(bg); api.bg = bg;

    const shadowTex = radialTexture([[0, 'rgba(0,0,0,.85)'], [.45, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]);
    const poolTex = radialTexture([[0, 'rgba(255,196,120,.55)'], [.4, 'rgba(255,170,90,.2)'], [1, 'rgba(255,150,70,0)']]);
    const decal = (tex, x, z, r, y, opts) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial(Object.assign({ map: tex, transparent: true, depthWrite: false }, opts)));
      m.rotation.x = -Math.PI / 2; m.position.copy(V(x, y, z)); scene.add(m); return m;
    };
    shadow = (x, z, r, o) => decal(shadowTex, x, z, r, .012, { opacity: o || .7 });
    pool = (x, z, r, o) => decal(poolTex, x, z, r, .018, { opacity: o || .5, blending: THREE.AdditiveBlending });

    // 主体：底座 + 胸像。眼睛大致落在 Z=0 的对焦平面上
    const H = 1.0, BUST = 1.3;       // 胸像原件约是真人的八成大，放大到等身
    const base = plinth(H); base.position.copy(V(0, 0, .11)); scene.add(base);
    bust.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; bustMesh = bustMesh || o; } });
    bust.scale.setScalar(BUST); bust.position.copy(V(0, H, .11)); scene.add(bust); api.bust = bust;
    shadow(0, .11, .75, .8);

    // 路牌：主体后方多少米。20 m 那块立在高杆上，不然会被游客挡住
    [[2, 1.05], [5, 1.05], [10, 1.05], [20, 2.45]].forEach(([z, sy]) => {
      const tex = signTexture(z + ' m');
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(.6, .375), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .32, roughness: .55, metalness: .1 }));
      plate.position.copy(V(1.45, sy, z)); scene.add(plate);
      const back = new THREE.Mesh(new THREE.BoxGeometry(.63, .405, .02), postMat); back.position.copy(V(1.45, sy, z + .012)); scene.add(back);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, sy - .15, 12), postMat); post.position.copy(V(1.45, (sy - .15) / 2, z + .03)); scene.add(post);
      shadow(1.45, z, .16, .5);
    });

    // 彩灯：几串挂在不同远近、不同高度
    const PAL = [[1, .68, .27], [1, .41, .19], [1, .22, .36], [.27, .65, 1], [1, .91, .65]];
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x050506 });
    [[6, 4.2, 13, 2.75, .5], [9.5, 6, 17, 3.35, .7], [15, 7.5, 19, 3.2, .8], [24, 9.5, 23, 4.5, 1.0]].forEach(([z, half, n, yEnd, sag], si) => {
      const pts = [];
      for (let i = 0; i < n; i++) { const u = -1 + 2 * i / (n - 1); lights.push({ p: V(u * half, yEnd - sag * (1 - u * u) - .04, z), r: .028, c: PAL[(i + si) % 5], k: 7, lamp: 0 }); }
      for (let i = 0; i <= 40; i++) { const u = -1 + i / 20; pts.push(V(u * half, yEnd - sag * (1 - u * u), z)); }
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, .006, 5), wireMat));
      [-half, half].forEach(x => { const pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, yEnd + .05, 12), postMat); pole.position.copy(V(x, (yEnd + .05) / 2, z)); scene.add(pole); shadow(x, z, .2, .5); });
    });

    // 主光：相机左前上方打向胸像的一盏柔光，只有它投影子
    const key = new THREE.SpotLight(0xfff4e6, 80, 14, .42, .9, 2); key.position.copy(V(-2.3, 3.3, -2.4)); key.target.position.copy(V(0, 1.4, .1));
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 1; key.shadow.camera.far = 9; key.shadow.bias = -.0006; key.shadow.radius = 5;
    scene.add(key, key.target); api.key = key;
    const rim = new THREE.PointLight(0x9fc4ff, 9, 9, 2); rim.position.copy(V(1.9, 2.3, 1.6)); scene.add(rim);

    // 月亮：跟着相机走的一张远处的圆片
    const md = 820, mr = md * Math.tan(THREE.MathUtils.degToRad(.26));
    moon = new THREE.Mesh(new THREE.CircleGeometry(mr, 64), new THREE.MeshBasicMaterial({ map: moonTexture(), transparent: true }));
    moon.userData.dir = (() => { const az = THREE.MathUtils.degToRad(hooks.moon ? hooks.moon.az : -9), el = THREE.MathUtils.degToRad(hooks.moon ? hooks.moon.el : 31); return V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(md); })();
    scene.add(moon);

    lightMat = new THREE.ShaderMaterial({
      vertexShader: LIGHT_VERT, fragmentShader: LIGHT_FRAG, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uView: { value: new THREE.Matrix4() }, uProjC: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2() }, uK: { value: 1 }, uA: { value: 0 }, uInvS: { value: 0 }, uGlare: { value: .16 },
        uPolyAmt: { value: 0 }, uBlades: { value: 9 }, uNear: { value: NEAR }, uFar: { value: FAR }, tDepth: { value: null } }
    });
    rebuildLights();
    scene.updateMatrixWorld(true);
  }

  // 第二段：按「先补最显眼的」排好，两条队列并行取
  async function detail() {
    const LAMPS = [[-2.6, 4], [2.6, 9.2], [-3.4, 16], [3.6, 23], [-8, 13], [8.5, 18], [-12, 24], [13, 27]];
    const tasks = [
      async () => {                                           // 路灯：左右交错往远处排
        const lamp = await loadModel(m2, 'street_lamp_01', '1k');
        LAMPS.forEach(([x, z], i) => {
          const l = lamp.clone(); l.position.copy(V(x, 0, z)); l.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(l);
          lights.push({ p: V(x, 3.265, z), r: .055, c: [1, .78, .46], k: 60, lamp: 1 });
          shadow(x, z, .5, .6); pool(x, z, 4.2, .42);
          if (i < 4) { const pl = new THREE.PointLight(0xffc98a, 26, 26, 2); pl.position.copy(V(x, 3.2, z)); scene.add(pl); }
        });
        rebuildLights();
      },
      async () => {                                           // 提灯：放在地上，暖光
        const lantern = await loadModel(m2, 'Lantern_01', '1k');
        [[-.78, .55, .4], [1.25, 2.4, -.6], [-1.7, 5.2, 1.1], [1.9, 7.4, 2.0]].forEach(([x, z, rot]) => {
          const l = lantern.clone(); l.scale.setScalar(1.25); l.position.copy(V(x, 0, z)); l.rotation.y = rot; scene.add(l);
          lights.push({ p: V(x, .12, z), r: .028, c: [1, .55, .2], k: 16, lamp: 0 });
          pool(x, z, 1.1, .5); shadow(x, z, .16, .6);
          const pl = new THREE.PointLight(0xff9a4a, 2.2, 5, 2); pl.position.copy(V(x, .2, z)); scene.add(pl);
        });
        rebuildLights();
      },
      async () => {                                           // 真正的 HDR 环境光
        const hdr = await new HDRLoader(m2).loadAsync(ASSETS + 'env/shanghai_bund_1k.hdr'); hdr.mapping = THREE.EquirectangularReflectionMapping;
        const old = scene.environment; scene.environment = pmrem.fromEquirectangular(hdr).texture; scene.environmentIntensity = TUNE.env; old.dispose(); hdr.dispose();
      },
      async () => {                                           // 盆栽
        const plant = await loadModel(m2, 'potted_plant_02', '1k');
        [[-1.95, 2.2, 1.0, 0], [1.95, 4.6, 1.15, 2], [-2.1, 7.6, 1.1, 4], [3.3, 8.6, 1.2, 1], [-4.2, 4.4, 1.2, 3]].forEach(([x, z, sc, rot]) => {
          const p = plant.clone(); p.scale.setScalar(sc); p.position.copy(V(x, 0, z)); p.rotation.y = rot; scene.add(p); shadow(x, z, .5 * sc, .65);
        });
      },
      async () => {                                           // 猫石像，蹲在底座旁
        const cat = await loadModel(m2, 'concrete_cat_statue', '1k');
        cat.scale.setScalar(1.3); cat.position.copy(V(.62, 0, -.18)); cat.rotation.y = -.5; scene.add(cat); shadow(.62, -.18, .45, .7);
      },
      async () => {                                           // 胸像换 2k 贴图
        const mat = bustMesh.material, base = 'models/marble_bust_01/textures/marble_bust_01_';
        const [d, n, r] = await Promise.all(['diff', 'nor_gl', 'rough'].map(k => loadTex(m2, base + k + '_2k.jpg')));
        const like = (t, o) => { t.flipY = o.flipY; t.wrapS = o.wrapS; t.wrapT = o.wrapT; t.colorSpace = o.colorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; };
        const old = [mat.map, mat.normalMap, mat.roughnessMap], sameMR = mat.metalnessMap === mat.roughnessMap;
        mat.map = like(d, old[0]); mat.normalMap = like(n, old[1]); mat.roughnessMap = like(r, old[2]); if (sameMR) mat.metalnessMap = mat.roughnessMap;
        mat.needsUpdate = true; old.forEach(t => t && t.dispose());
      },
      async () => {                                           // 8k 全景
        const hi = await loadTex(m2, 'env/shanghai_bund.jpg'); hi.colorSpace = THREE.SRGBColorSpace; hi.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const old = bg.material.uniforms.map.value; bg.material.uniforms.map.value = hi; old.dispose();
      }
    ];
    const total = tasks.length; let done = 0;
    const worker = async () => {
      while (tasks.length) {
        const t = tasks.shift();
        try { await t(); } catch (e) { console.warn('[取景器] 有一项素材没加载上，先不管它。', e); }
        done++; scene.updateMatrixWorld(true); renderer.shadowMap.needsUpdate = true; dirty = true;
        calKey = '';                                          // 场景变重了，下一帧重新量一次每帧画多久
        if (P) schedule();
        hooks.ondetail && hooks.ondetail(done, total);
      }
    };
    await Promise.all([worker(), worker()]);
    pmrem.dispose();
  }

  // ---------- 相机 ----------
  let P = null, dirty = true, raf = 0, tmo = 0, base = null;
  const vr = new THREE.Vector3(), vu = new THREE.Vector3(), vb = new THREE.Vector3(), vp = new THREE.Vector3(), tmp = new THREE.Vector3(), mB = new THREE.Matrix4();
  function setCam(cam, lx, ly, jx, jy) {
    tmp.copy(vp).addScaledVector(vr, lx).addScaledVector(vu, ly);
    cam.matrixWorld.makeBasis(vr, vu, vb).setPosition(tmp); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    const p00 = base.p00, p11 = base.p11, a = -(FAR + NEAR) / (FAR - NEAR), b = -2 * FAR * NEAR / (FAR - NEAR);
    // 相机挪到光圈上的 (lx, ly)，同时把投影剪切回去，让对焦平面上的东西纹丝不动
    cam.projectionMatrix.set(p00, 0, -p00 * lx * P.invS - jx, 0, 0, p11, -p11 * ly * P.invS - jy, 0, 0, 0, a, b, 0, 0, -1, 0);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  const apR = th => { const seg = 2 * Math.PI / P.blades; let a = (th + Math.PI / 2) % seg; if (a < 0) a += seg; a -= seg / 2; return 1 + ((Math.cos(seg / 2) / Math.cos(a)) - 1) * P.polyAmt; };

  function resize(cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * api.scale;
    const w = Math.max(16, Math.round(cssW * dpr)), h = Math.max(16, Math.round(cssH * dpr));
    if (rtA && w === canvas.width && h === canvas.height) return;
    renderer.setSize(w, h, false); alloc(w, h); dirty = true;
  }

  function begin() {                          // 参数变了：清空累加，重画一次中心视角的深度和点光源
    const W = canvas.width, H = canvas.height, kdev = P.K * W / P.cssW;
    vr.set(P.right[0], P.right[1], -P.right[2]); vu.set(P.up[0], P.up[1], -P.up[2]); vb.set(-P.fwd[0], -P.fwd[1], P.fwd[2]); vp.set(P.cam[0], P.cam[1], -P.cam[2]);
    base = { p00: 2 * kdev / W, p11: 2 * kdev / H };
    moon.position.copy(vp).add(moon.userData.dir); moon.quaternion.setFromRotationMatrix(mB.makeBasis(vr, vu, vb)); moon.updateMatrixWorld();
    setCam(camC, 0, 0, 0, 0);
    renderer.setRenderTarget(rtC); renderer.setClearColor(0, 1); renderer.clear(); renderer.render(scene, camC);
    renderer.shadowMap.autoUpdate = false;                                   // 场景是静止的，影子图只算一次
    const u = lightMat.uniforms;
    u.uView.value.copy(camC.matrixWorldInverse); u.uProjC.value.copy(camC.projectionMatrix); u.uRes.value.set(W, H); u.uK.value = kdev;
    u.uA.value = P.A; u.uInvS.value = P.invS; u.uPolyAmt.value = P.polyAmt; u.uBlades.value = P.blades; u.tDepth.value = rtC.depthTexture;
    renderer.setRenderTarget(rtL); renderer.clear(); renderer.render(api.lightScene, quadCam);
    renderer.setRenderTarget(rtA); renderer.clear();
    api.count = 0; dirty = false;
  }

  function step(n) {
    if (!api.ready || !P) return;
    if (dirty) begin();
    const W = canvas.width, H = canvas.height;
    for (let i = 0; i < n; i++) {
      const k = api.count, th = 2 * Math.PI * R2(k, .5698402910), r = Math.sqrt(R2(k, .7548776662)) * apR(th) * P.A;
      setCam(camera, r * Math.cos(th), r * Math.sin(th), (R2(k, .6180339887) - .5) * 2 / W, (R2(k, .3247179572) - .5) * 2 / H);
      renderer.setRenderTarget(rtS); renderer.clear(); renderer.render(scene, camera);
      addPass.mat.uniforms.tSrc.value = rtS.texture;
      renderer.setRenderTarget(rtA); renderer.render(addPass.s, quadCam);
      api.count++;
    }
    const u = resPass.mat.uniforms; u.tAcc.value = rtA.texture; u.tLights.value = rtL.texture; u.uInv.value = 1 / api.count; u.uExposure.value = TUNE.exposure; u.uSeed.value = api.count % 7; u.uRes.value.set(W, H);
    renderer.setRenderTarget(null); renderer.render(resPass.s, quadCam);
  }

  // ---------- 节奏：实测一帧多久，定每次刷新画几帧 ----------
  const px1 = new Uint8Array(4); let calKey = '';
  const timed = n => { const t0 = performance.now(); step(n); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); return performance.now() - t0; };
  const measure = () => { timed(1); const a = timed(1), b = timed(5); return Math.max((b - a) / 4, .05); };   // readPixels 有固定开销，取差值
  function calibrate() {
    if (api.scale !== 1) { api.scale = 1; resize(P.cssW, P.cssH); }
    let ms = measure();
    if (ms > 24) { api.scale = Math.max(.5, Math.sqrt(14 / ms)); resize(P.cssW, P.cssH); ms = measure(); }
    api.msPerPass = ms; api.passes = Math.max(1, Math.min(8, Math.floor(13 / ms))); calKey = P.cssW + 'x' + P.cssH;
  }
  function schedule() {
    if (raf || tmo) return;
    raf = requestAnimationFrame(tick); tmo = setTimeout(tick, 300);          // 页面在后台时 rAF 不走，定时器兜底
  }
  function tick() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; } if (tmo) { clearTimeout(tmo); tmo = 0; }
    if (!api.ready || !P) return;
    if (calKey !== P.cssW + 'x' + P.cssH) calibrate();
    step(api.passes);
    if (api.count < TARGET) schedule();
  }
  function set(params) { P = params; resize(P.cssW, P.cssH); dirty = true; if (api.ready) schedule(); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { calKey = ''; if (api.ready && P) { dirty = true; schedule(); } } });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); api.ready = false; api.failed = true; hooks.onfail && hooks.onfail('context lost'); });

  build().then(() => { api.ready = true; hooks.onready && hooks.onready(); if (P) { dirty = true; schedule(); } if (!hooks.noDetail) detail(); })
    .catch(e => { api.failed = true; api.info = String(e && e.message || e); console.warn('[取景器] 3D 场景加载失败，改用后备场景。', e); hooks.onfail && hooks.onfail(api.info); });

  Object.assign(api, { set, step, resize, renderer, camera, redraw() { dirty = true; schedule(); } });
  return api;
}

window.VF3 = { create, TARGET };
window.dispatchEvent(new Event('vf3-module'));
