/*
 * viewfinder.js —— 板块三：虚拟取景器。
 * 把 vf-scene.js 里的世界按针孔投影画到画面上，每样东西的模糊量用 Optics.blurDisc 现算：
 *   画面位置 = 像距 v × (物体方向的斜率) × 每毫米像素数
 *   模糊     = CSS blur(模糊圆直径 × 0.3)；点光源直接画成直径 = 模糊圆的光斑
 */
(function () {
  'use strict';
  var O = window.Optics, LD = window.LensData, S = window.VFScene;
  var RAD = Math.PI / 180;
  var G = [0.25, 0.5, 0.8, 1.2, 1.8, 2.6, 3.8, 5.5, 8, 12, 18, 28, 45, 75, 130, 250, 600, 5000]; // 地面分段（离相机的距离，m）
  var SKY = [[-3, '#ffe2ad'], [0, '#ffcf94'], [2.5, '#f6a468'], [7, '#c2707a'], [14, '#6b4c85'], [26, '#33376b'], [45, '#161f47'], [80, '#0a1030']];
  var mapD = U.logMap(300, 120000), mapFD = U.logMap(300, 1000000), mapZ = null;

  var st = { lens: 'z85f18', body: 'FX', fBase: 85, N: 1.8, D: 2600, lock: false, lockK: 0, af: true, fd: 2600, tc: false, yaw: 0, pitch: 0 };
  var el = {}, bands = [], quads = [], dashes = [], K = 1000, stops = [];
  var glr = null;            // WebGL 渲染器（vf-gl.js）；没有或还没编译好时用下面的 CSS 版场景

  var PRESETS = {
    portrait: { name: '人像 85mm f/1.8', lens: 'z85f18', N: 1.8, D: 2600 },
    stopdown: { name: '同一位置收到 f/11', lens: 'z85f18', N: 11, D: 2600 },
    near35: { name: '35mm 贴近拍', lens: 'z35f18', N: 1.8, D: 1070 },
    far200: { name: '200mm 退远拍', lens: 'z70200', f: 200, N: 2.8, D: 6120 },
    bokeh: { name: '彩灯光斑 135mm Plena', lens: 'z135plena', N: 1.8, D: 4200, pitch: 3 },
    landscape: { name: '广角风光 14mm f/11', lens: 'z1424', f: 14, N: 11, D: 3000 },
    moon: { name: '800mm 拍月亮', lens: 'z800f63', N: 6.3, D: 60000, af: false, fd: Infinity, yaw: S.MOON.az, pitch: S.MOON.el },
    street: { lens: 'z35f18', N: 5.6, D: 4000 },
    event: { lens: 'z2470ii', f: 70, N: 2.8, D: 3000 },
    sport: { lens: 'z400f28', N: 2.8, D: 30000 },
    astro: { lens: 'z20f18', N: 1.8, D: 3000, yaw: 5, pitch: 12 },
    travel: { lens: 'z28400', f: 400, N: 8, D: 30000 }
  };
  var SHOWN = ['portrait', 'stopdown', 'near35', 'far200', 'bokeh', 'landscape', 'moon'];

  // ---------- 当前参数 ----------
  function lens() { return LD.byId(st.lens); }
  function cur() {
    var L = lens(), k = st.tc && L.tc ? L.tc : 1;
    var f = st.fBase * k, N = k > 1 ? O.nearestIn(O.F_STOPS, st.N * k) : st.N;
    var sen = O.SENSORS[L.format === 'DX' ? 'DX' : st.body], mfd = L.mfd * 1000;
    var want = st.af ? st.D : st.fd, s = Math.max(want, mfd, f * 1.5);
    return { L: L, f: f, N: N, sen: sen, s: s, mfd: mfd, tooClose: st.af && st.D < mfd - 1, v: O.imageDistance(f, s) };
  }

  // ---------- 搭建 DOM（只做一次） ----------
  function div(cls, parent) { var d = document.createElement('div'); if (cls) d.className = cls; (parent || el.scene).appendChild(d); return d; }
  function build() {
    el.sky = div('vf-sky');
    for (var i = 0; i < G.length - 1; i++) bands.push(div(''));
    for (i = 0; i < G.length - 1; i++) { var q = div(''); quads.push({ o: q, i: div('', q) }); }
    for (i = 0; i < 44; i++) { var d = div(''); dashes.push({ o: d, i: div('', d) }); }
    [].concat(quads, dashes).forEach(function (p) { p.i.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%'; });
    S.OBJ.forEach(function (o, n) {
      o.uid = n; o.el = div('vf-obj'); o.el.innerHTML = S.ART[o.k](o);
      o.svg = o.el.firstChild; var vb = o.svg.getAttribute('viewBox').split(' '); o.vw = +vb[2]; o.vh = +vb[3]; o.vb = '';
    });
    S.LIGHTS.forEach(function (l) { l.el = div('vf-light'); });
    // WebGL 版：着色器在后台编译，好了再切过去（地址加 ?nogl 可以强制用 CSS 版）
    if (window.VFGL && !/[?&]nogl\b/.test(location.search)) {
      el.canvas = document.createElement('canvas'); el.canvas.className = 'vf-canvas';
      el.frame.insertBefore(el.canvas, el.scene.nextSibling);
      try { glr = window.VFGL.create(el.canvas, S); } catch (e) { console.warn('[取景器] WebGL 初始化失败', e); glr = null; }
      if (glr) {
        glr.onready = function () { el.scene.style.display = 'none'; el.canvas.style.display = 'block'; update(); };
        glr.onlost = function () { el.scene.style.display = ''; el.canvas.style.display = 'none'; update(); };
      }
    }
  }

  function hide(e) { if (e.style.display !== 'none') e.style.display = 'none'; }
  function place(e, x, y, w, h, sigma, z) {
    var s = e.style;
    s.display = 'block'; s.width = w.toFixed(1) + 'px'; s.height = h.toFixed(1) + 'px';
    s.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    s.filter = sigma > 0.4 ? 'blur(' + Math.min(sigma, 90).toFixed(1) + 'px)' : 'none';
    s.zIndex = z;
  }
  function mix(a, b, t) { return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }).join(',') + ')'; }

  // ---------- 每次参数变化都重画 ----------
  function update() {
    var c = cur(), W = el.frame.clientWidth, H = el.frame.clientHeight; if (!W || !H) return;
    var ppm = W / c.sen.w; K = c.v * ppm;
    var sy = Math.sin(st.yaw * RAD), cy = Math.cos(st.yaw * RAD), sp = Math.sin(st.pitch * RAD), cp = Math.cos(st.pitch * RAD);
    var camZ = -st.D / 1000;
    function proj(X, Y, Z) {
      var x = X, y = Y - S.CAM_H, z = Z - camZ;
      var x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      var y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      return { x: W / 2 + x1 / z2 * K, y: H / 2 - y2 / z2 * K, z: z2 };
    }
    function blurPx(zm) { return O.blurDisc(c.f, c.N, c.s, Math.max(zm * 1000, c.f * 1.2)) * ppm; }
    function zi(z) { return Math.round(20100 - 1000 * Math.log(Math.max(z, 0.05))); }

    var useGL = !!(glr && glr.ready && !glr.failed);
    if (useGL) {
      var down = O.stopsBetween(O.maxApertureAt(c.L, st.fBase), st.N);
      glr.set({ cssW: W, cssH: H, K: K, cam: [0, S.CAM_H, camZ], right: [cy, 0, -sy], up: [-sy * sp, cp, -cy * sp], fwd: [sy * cp, sp, cy * cp],
        A: c.f / (2 * c.N) / 1000, invS: isFinite(c.s) ? 1000 / c.s : 0, polyAmt: U.clamp((down - 0.35) / 2, 0, 1), blades: c.L.blades });
    }
    if (!useGL) {
    // 天空：按仰角算渐变
    var stopsCss = [];
    for (var i = SKY.length - 1; i >= 0; i--) {
      var ang = U.clamp(SKY[i][0] - st.pitch, -80, 80);
      stopsCss.push(SKY[i][1] + ' ' + (H / 2 - Math.tan(ang * RAD) * K).toFixed(0) + 'px');
    }
    el.sky.style.background = 'linear-gradient(to bottom,' + stopsCss.join(',') + ')';

    // 地面：按离相机的水平距离分段，每段一个横条，各自模糊
    function groundY(g) { var y2 = -S.CAM_H * cp - g * sp, z2 = -S.CAM_H * sp + g * cp; return z2 > 0.03 ? { y: H / 2 - y2 / z2 * K, z: z2 } : null; }
    var n = bands.length;
    for (i = 0; i < n; i++) {
      var a = groundY(G[i]), b = groundY(G[i + 1]), mid = groundY(Math.sqrt(G[i] * G[i + 1]));
      if (!b || !mid) { hide(bands[i]); continue; }
      var sg = blurPx(mid.z) * 0.3, m = sg * 3 + 12, top = Math.max(b.y, -m), bot = Math.min(a ? a.y : H + m, H + m) + 1.5;
      if (i === 0) bot = H + m;
      if (bot - top < 0.5 || top > H + m) { hide(bands[i]); continue; }
      place(bands[i], -m, top, W + 2 * m, bot - top, sg, 2 + (n - i));
      bands[i].style.background = mix([34, 48, 38], [74, 72, 86], i / (n - 1));
    }

    // 小路与中线：世界里的四边形，裁成梯形
    function quad(p, X1, X2, Z1, Z2, color, z0) {
      var P = [proj(X1, 0, Z1), proj(X2, 0, Z1), proj(X2, 0, Z2), proj(X1, 0, Z2)];
      if (P.some(function (q) { return q.z < 0.05; })) { hide(p.o); return; }
      var sg = blurPx((P[0].z + P[2].z) / 2) * 0.3, m = sg * 3 + 4;
      var xs = P.map(function (q) { return q.x; }), ys = P.map(function (q) { return q.y; });
      var l = Math.max(Math.min.apply(null, xs), -m), r = Math.min(Math.max.apply(null, xs), W + m);
      var t = Math.max(Math.min.apply(null, ys), -m), bt = Math.min(Math.max.apply(null, ys), H + m);
      if (r - l < 0.6 || bt - t < 0.4) { hide(p.o); return; }
      place(p.o, l, t, r - l, bt - t, sg, z0);
      p.i.style.background = color;
      p.i.style.clipPath = 'polygon(' + P.map(function (q) { return (q.x - l).toFixed(1) + 'px ' + (q.y - t).toFixed(1) + 'px'; }).join(',') + ')';
    }
    for (i = 0; i < quads.length; i++) {
      quad(quads[i], -S.PATH_HALF, S.PATH_HALF, camZ + G[i], camZ + G[i + 1] + (G[i + 1] - G[i]) * 0.03, mix([104, 97, 88], [132, 124, 124], i / (n - 1)), 30 + (n - i));
    }
    var k0 = Math.ceil((camZ + 0.35) / 3), used = 0;
    for (var k = k0; used < dashes.length && k * 3 - camZ < 150; k++) quad(dashes[used++], -0.07, 0.07, k * 3, k * 3 + 1.3, 'rgba(240,230,200,.88)', 70);
    for (; used < dashes.length; used++) hide(dashes[used]);

    // 物体：立在地上的广告牌，太大的只画进入画面的那一块
    S.OBJ.forEach(function (o) {
      var base = proj(o.X, o.y0 || 0, o.Z);
      if (base.z < 0.08) { hide(o.el); return; }
      var sc = K / base.z, w = o.w * sc, h = o.h * sc, left = base.x - w / 2, top = base.y - h;
      var sg = blurPx(base.z) * 0.3, m = Math.min(sg, 90) * 3 + 4;
      var l = Math.max(left, -m), r = Math.min(left + w, W + m), t = Math.max(top, -m), b2 = Math.min(top + h, H + m);
      if (r - l < 0.5 || b2 - t < 0.5) { hide(o.el); return; }
      var crop = w > 2.2 * W || h > 2.2 * H;
      var vb = crop ? [((l - left) / w * o.vw).toFixed(3), ((t - top) / h * o.vh).toFixed(3), ((r - l) / w * o.vw).toFixed(3), ((b2 - t) / h * o.vh).toFixed(3)].join(' ') : '0 0 ' + o.vw + ' ' + o.vh;
      if (vb !== o.vb) { o.svg.setAttribute('viewBox', vb); o.vb = vb; }
      if (crop) place(o.el, l, t, r - l, b2 - t, sg, zi(base.z)); else place(o.el, left, top, w, h, sg, zi(base.z));
    });

    // 点光源：直径 = √(本身大小² + 模糊圆²)，越大越淡；收光圈后变成多边形
    var poly = '';
    if (O.stopsBetween(O.maxApertureAt(c.L, st.fBase), st.N) > 0.8) {
      var pts = [], nb = c.L.blades;
      for (i = 0; i < nb; i++) { var th = -Math.PI / 2 + i * 2 * Math.PI / nb; pts.push((50 + 50 * Math.cos(th)).toFixed(1) + '% ' + (50 + 50 * Math.sin(th)).toFixed(1) + '%'); }
      poly = 'polygon(' + pts.join(',') + ')';
    }
    S.LIGHTS.forEach(function (l) {
      var p = proj(l.X, l.Y, l.Z);
      if (p.z < 0.1) { hide(l.el); return; }
      var size = l.size * K / p.z, cb = blurPx(p.z), d = Math.max(1.6, Math.sqrt(size * size + cb * cb));
      if (p.x < -d || p.x > W + d || p.y < -d || p.y > H + d) { hide(l.el); return; }
      place(l.el, p.x - d / 2, p.y - d / 2, d, d, 0, zi(p.z));
      var op = U.clamp(Math.pow(11 / d, 0.85), 0.13, 0.96), big = d > 9 && cb > size;
      l.el.style.background = big ? 'radial-gradient(closest-side, rgba(' + l.c + ',' + (op * 0.82).toFixed(2) + ') 0 84%, rgba(' + l.c + ',' + op.toFixed(2) + ') 93%, rgba(' + l.c + ',0) 100%)'
        : 'radial-gradient(closest-side, rgba(255,255,255,' + op.toFixed(2) + ') 0 30%, rgba(' + l.c + ',' + op.toFixed(2) + ') 62%, rgba(' + l.c + ',0) 100%)';
      l.el.style.clipPath = big && poly ? poly : 'none';
      l.el.style.borderRadius = big && poly ? '0' : '50%';
    });

    }

    // 对焦框（主体的脸）
    var face = proj(0, useGL ? 1.56 : 1.53, 0), cSub = O.blurDisc(c.f, c.N, c.s, st.D), sharp = cSub <= c.sen.coc * 1.2;
    if (face.z > 0.1 && face.x > 0 && face.x < W && face.y > 0 && face.y < H) {
      el.focus.style.display = 'block'; el.focus.style.left = face.x.toFixed(0) + 'px'; el.focus.style.top = face.y.toFixed(0) + 'px';
      el.focus.className = 'vf-focus' + (sharp ? '' : ' miss');
    } else el.focus.style.display = 'none';

    var faceIn = el.focus.style.display !== 'none', moonIn = false;
    S.OBJ.forEach(function (o) {
      if (o.k !== 'moon') return;
      var mp = proj(o.X, o.y0 + o.h / 2, o.Z); moonIn = mp.z > 0 && mp.x > 0 && mp.x < W && mp.y > 0 && mp.y < H;
    });
    readouts(c, cSub, sharp, faceIn, moonIn);
  }

  // ---------- 读数 ----------
  function readouts(c, cSub, sharp, faceIn, moonIn) {
    var dof = O.dof(c.f, c.N, c.s, c.sen.coc), cInf = O.blurDisc(c.f, c.N, c.s, Infinity), pct = cInf / c.sen.w * 100;
    var a = O.aov(c.f, c.sen.w), moon = c.f * Math.tan(S.MOON.dia * RAD) / c.sen.h * 100;
    el.hud.innerHTML = '<b>' + O.fmtFocal(c.f) + '</b><b>' + O.fmtF(c.N) + '</b><span>对焦 ' + O.fmtDist(c.s) + '</span><span class="sp">' + U.esc(c.L.zh) + ' · ' + c.sen.key + '</span>';
    U.setText('vf-f-out', O.fmtFocal(c.f) + (st.tc && c.L.tc ? '（含增距镜）' : ''));
    U.setText('vf-n-out', O.fmtF(c.N)); U.setText('vf-d-out', O.fmtDist(st.D));
    U.setText('vf-fd-out', st.af ? '跟随主体' : isFinite(st.fd) ? O.fmtDist(st.fd) : '无穷远');
    U.setText('vf-aov', O.fmtAngle(a) + (c.sen.key === 'DX' ? '（等效 ' + O.fmtNum(c.f * 1.5, 0) + 'mm）' : ''));
    U.setText('vf-pupil', O.fmtNum(c.f / c.N, 1) + ' mm');
    U.setText('vf-dof', O.fmtDist(dof.near) + ' – ' + O.fmtDist(dof.far));
    U.setText('vf-blur', O.fmtNum(cInf, cInf < 1 ? 3 : 2) + ' mm · ' + O.fmtNum(pct, 2) + '%');
    U.setText('vf-mag', O.fmtNum(c.v / st.D, 3) + '×');
    U.setText('vf-moon', O.fmtNum(moon, 1) + '% 画面高');

    var msg, cls = 'verdict';
    if (c.tooClose) { msg = '离主体只有 ' + O.fmtDist(st.D) + '，小于这支镜头的最近对焦距离 ' + c.L.mfd + ' m，对不上焦。退后一点，或者换能近拍的镜头。'; cls += ' bad'; }
    else if (!st.af && !faceIn) {
      msg = '手动对焦在' + (isFinite(c.s) ? ' ' + O.fmtDist(c.s) : '无穷远') + '，清晰范围 ' + O.fmtDist(dof.near) + ' – ' + O.fmtDist(dof.far) + '。';
      if (moonIn) msg += '月亮的视直径约 0.52°，在传感器上的像 = 焦距 × tan 0.52° = ' + O.fmtNum(c.f * Math.tan(S.MOON.dia * RAD), 2) + 'mm，占画面高度的 ' + O.fmtNum(moon, 0) + '%。';
    }
    else if (!sharp) { msg = '焦点不在主体上：主体的模糊圆 ' + O.fmtNum(cSub, 3) + 'mm，超过了 ' + c.sen.coc + 'mm 的清晰界线。'; cls += ' warn'; }
    else if (pct < 0.09) msg = '从主体到远景全部在景深里。小光圈加广角就是这个效果，适合风光。';
    else if (pct < 0.4) msg = '主体清晰，远景略微发虚，路牌上的字还认得出。';
    else if (pct < 1.5) msg = '主体清晰，背景开始发虚：近处的路牌还读得出，越远越糊，彩灯变成小光斑。';
    else if (pct < 3.5) msg = '主体清晰，背景明显虚化：远处的路牌读不出字，树和楼还看得出轮廓，彩灯变成光斑。';
    else msg = '主体清晰，背景完全化开：树和楼只剩色块，每个灯都变成一个大光斑' + (c.N > O.maxApertureAt(c.L, st.fBase) * 1.3 ? '（收了光圈，光斑是 ' + c.L.blades + ' 边形）。' : '。');
    if (c.L.format === 'DX' && st.body === 'FX') msg += ' 这是 DX 镜头：装在 FX 机身上也会自动裁成 DX 画幅，这里按 DX 计算。';
    el.verdict.className = cls; el.verdict.textContent = msg;
  }

  // ---------- 控件 ----------
  function syncControls() {
    var L = lens();
    el.lens.value = st.lens;
    el.bodyChips.set(L.format === 'DX' ? 'DX' : st.body);
    if (L.kind === 'zoom') { mapZ = U.logMap(L.fMin, L.fMax); el.f.disabled = false; el.f.value = mapZ.toPos(st.fBase); }
    else { mapZ = null; el.f.disabled = true; el.f.value = 0; }
    stops = O.stopsFor(L, st.fBase);
    st.N = U.clamp(st.N, stops[0], stops[stops.length - 1]);
    var ni = 0; stops.forEach(function (s, i) { if (Math.abs(Math.log(s / st.N)) < Math.abs(Math.log(stops[ni] / st.N))) ni = i; });
    st.N = stops[ni]; el.n.max = stops.length - 1; el.n.value = ni;
    el.d.value = mapD.toPos(st.D);
    el.lock.checked = st.lock; el.af.checked = st.af;
    el.fd.disabled = st.af; el.fd.value = isFinite(st.fd) ? mapFD.toPos(st.fd) : 1000;
    el.tcWrap.hidden = !L.tc; el.tc.checked = st.tc && !!L.tc;
  }
  function refresh() { syncControls(); update(); }

  function setLens(id, silent) {
    var L = LD.byId(id); if (!L) return;
    st.lens = id; st.tc = false;
    st.fBase = L.kind === 'zoom' ? U.clamp(st.fBase, L.fMin, L.fMax) : L.fMin;
    st.N = O.maxApertureAt(L, st.fBase);
    if (st.lock) st.D = U.clamp(st.lockK * st.fBase, 300, 120000);
    refresh();
    if (!silent) U.bus.emit('lens', { id: id, src: 'vf' });
  }

  function preset(key) {
    var p = PRESETS[key]; if (!p) return;
    var L = LD.byId(p.lens);
    st.lens = p.lens; st.tc = false; st.lock = false;
    st.fBase = p.f || L.fMin; st.N = p.N; st.D = p.D;
    st.af = p.af !== false; st.fd = p.fd !== undefined ? p.fd : p.D;
    st.yaw = p.yaw || 0; st.pitch = p.pitch || 0;
    refresh();
    U.bus.emit('lens', { id: p.lens, src: 'vf' });
  }

  function init() {
    ['frame', 'scene', 'hud', 'focus', 'verdict'].forEach(function (k) { el[k] = U.byId('vf-' + k); });
    ['lens', 'f', 'n', 'd', 'lock', 'af', 'fd', 'tc'].forEach(function (k) { el[k] = U.byId('vf-' + k); });
    el.tcWrap = U.byId('vf-tc-wrap');
    build();

    function opts(kind) { return LD.LENSES.filter(function (L) { return L.kind === kind; }).map(function (L) { return '<option value="' + L.id + '">' + U.esc(L.name.replace('NIKKOR ', '')) + '</option>'; }).join(''); }
    el.lens.innerHTML = '<optgroup label="定焦">' + opts('prime') + '</optgroup><optgroup label="变焦">' + opts('zoom') + '</optgroup>';
    el.lens.addEventListener('change', function () { setLens(el.lens.value); });
    el.bodyChips = U.chipGroup('vf-body', null, function (v) { st.body = v; refresh(); });

    el.f.addEventListener('input', function () {
      if (!mapZ) return;
      var L = lens(); st.fBase = U.clamp(Math.round(mapZ.toVal(+el.f.value)), L.fMin, L.fMax);
      if (st.lock) st.D = U.clamp(st.lockK * st.fBase, 300, 120000);
      var pos = el.f.value; syncControls(); el.f.value = pos; update();
    });
    el.n.addEventListener('input', function () { st.N = stops[+el.n.value]; update(); });
    el.d.addEventListener('input', function () { st.D = Math.round(mapD.toVal(+el.d.value) / 10) * 10; if (st.lock) st.lockK = st.D / st.fBase; update(); });
    el.lock.addEventListener('change', function () { st.lock = el.lock.checked; st.lockK = st.D / st.fBase; });
    el.af.addEventListener('change', function () { st.af = el.af.checked; if (!st.af) st.fd = st.D; refresh(); });
    el.fd.addEventListener('input', function () { st.fd = +el.fd.value >= 995 ? Infinity : Math.round(mapFD.toVal(+el.fd.value) / 10) * 10; update(); });
    el.tc.addEventListener('change', function () { st.tc = el.tc.checked; update(); });

    // 预设
    U.byId('vf-presets').innerHTML = SHOWN.map(function (k) { return '<button type="button" class="btn ghost" data-p="' + k + '">' + PRESETS[k].name + '</button>'; }).join('') +
      '<button type="button" class="btn ghost" data-p="_reset">相机回正</button>';
    U.byId('vf-presets').addEventListener('click', function (e) {
      var b = e.target.closest('[data-p]'); if (!b) return;
      var k = b.getAttribute('data-p');
      if (k === '_reset') { st.yaw = 0; st.pitch = 0; update(); } else preset(k);
    });

    // 拖动转动相机
    var drag = null;
    el.frame.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; el.frame.setPointerCapture(e.pointerId); el.frame.classList.add('drag'); });
    el.frame.addEventListener('pointermove', function (e) {
      if (!drag) return;
      st.yaw = U.clamp(st.yaw - (e.clientX - drag.x) / K / RAD, -70, 70);
      st.pitch = U.clamp(st.pitch + (e.clientY - drag.y) / K / RAD, -20, 45);
      drag = { x: e.clientX, y: e.clientY }; update();
    });
    ['pointerup', 'pointercancel'].forEach(function (n) { el.frame.addEventListener(n, function () { drag = null; el.frame.classList.remove('drag'); }); });
    el.frame.addEventListener('dblclick', function () { st.yaw = 0; st.pitch = 0; update(); });

    if (window.ResizeObserver) new ResizeObserver(update).observe(el.frame); else window.addEventListener('resize', update);
    // 从图鉴 / 焦段地图选镜头：相机回正、对焦回到主体，并走到「半身取景」的位置（距离 = 50 倍焦距）
    U.bus.on('lens', function (ev) {
      if (ev.src === 'vf') return;
      var L = LD.byId(ev.id); if (!L) return;
      st.yaw = 0; st.pitch = 0; st.af = true; st.lock = false;
      if (L.kind === 'zoom') st.fBase = U.clamp(st.fBase, L.fMin, L.fMax); else st.fBase = L.fMin;
      st.D = Math.round(U.clamp(st.fBase * 50, L.mfd * 1050, 120000) / 10) * 10;
      setLens(ev.id, true);
    });
    refresh();
  }

  window.Viewfinder = { gl: function () { return glr; }, init: init, preset: preset, setLens: setLens, state: st, update: update, cur: cur, PRESETS: PRESETS };
})();
