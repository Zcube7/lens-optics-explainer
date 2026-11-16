/* demo-imaging.js —— 1.1 小孔 vs 透镜（静态）+ 薄透镜成像（可拖动） */
(function () {
  'use strict';
  var O = window.Optics, C = U.C;

  // ---------- 小孔 / 透镜 对照 ----------
  function pinholePair() {
    var W = 520, H = 250, cy = 118, xo = 70, xm = 260, xs = 450, hh = 58;
    var tip = [xo, cy - hh], base = [xo, cy + hh];
    function obj() {
      return U.arrow(xo, cy + hh, xo, cy - hh, C.accent, 4, 11) + U.circle(xo, cy + hh, 4, { fill: C.ray2 }) +
        U.text(xo, cy + hh + 22, '物体', { 'text-anchor': 'middle' });
    }
    function img() {
      return U.arrow(xs, cy - hh, xs, cy + hh, C.accent, 4, 11) + U.circle(xs, cy - hh, 4, { fill: C.ray2 }) +
        U.line(xs + 8, cy - hh - 22, xs + 8, cy + hh + 22, { stroke: C.muted, 'stroke-width': 3 }) +
        U.text(xs, cy + hh + 40, '屏幕 / 传感器', { 'text-anchor': 'middle' });
    }
    var axis = U.line(20, cy, W - 20, cy, { 'class': 'svg-axis' });

    // (a) 小孔
    var a = axis + obj() +
      U.rect(xm - 4, cy - 88, 8, 83, { fill: C.line }) + U.rect(xm - 4, cy + 5, 8, 83, { fill: C.line }) +
      U.line(tip[0], tip[1], xs, cy + hh, { stroke: C.accent, 'stroke-width': 1.6 }) +
      U.line(base[0], base[1], xs, cy - hh, { stroke: C.ray2, 'stroke-width': 1.6 }) +
      img() + U.text(xm, cy + 108, '小孔', { 'text-anchor': 'middle' }) +
      U.text(W / 2, H - 8, '每个点只放过一条细光束：清晰，但很暗', { 'text-anchor': 'middle', fill: C.text, 'font-size': 13 });

    // (b) 透镜：物距 = 像距 = 190 → f = 95，等大倒立
    var hits = [-78, -46, 0, 46, 78], rays = '';
    hits.forEach(function (dy) {
      rays += U.line(tip[0], tip[1], xm, cy + dy, { stroke: C.accent, 'stroke-width': 1.2, opacity: .85 }) +
        U.line(xm, cy + dy, xs, cy + hh, { stroke: C.accent, 'stroke-width': 1.2, opacity: .85 });
      rays += U.line(base[0], base[1], xm, cy + dy, { stroke: C.ray2, 'stroke-width': 1, opacity: .45 }) +
        U.line(xm, cy + dy, xs, cy - hh, { stroke: C.ray2, 'stroke-width': 1, opacity: .45 });
    });
    var lens = U.path('M' + xm + ',' + (cy - 92) + ' Q' + (xm + 26) + ',' + cy + ' ' + xm + ',' + (cy + 92) +
      ' Q' + (xm - 26) + ',' + cy + ' ' + xm + ',' + (cy - 92) + 'Z', { fill: C.glass, stroke: C.glassEdge, 'stroke-width': 1.5 });
    var b = axis + rays + lens + obj() + img() + U.text(xm, cy + 108, '透镜', { 'text-anchor': 'middle' }) +
      U.text(W / 2, H - 8, '把一大束光折回同一点：又亮又清晰', { 'text-anchor': 'middle', fill: C.text, 'font-size': 13 });

    U.byId('pinhole-a').innerHTML = U.svg(W, H, a);
    U.byId('pinhole-b').innerHTML = U.svg(W, H, b);
  }

  // ---------- 薄透镜成像 ----------
  var W = 900, H = 420, CY = 205, LX = 430, HO = 72, LENS_H = 150;
  var st = { f: 70, u: 230 };
  var stage, fIn, uIn;

  function render() {
    var f = st.f, u = st.u, v = O.imageDistance(f, u), m = O.magnification(f, u);
    var xo = LX - u, yt = CY - HO;
    var real = u > f + 0.5, virt = u < f - 0.5;
    var p = '';

    p += U.line(0, CY, W, CY, { 'class': 'svg-axis' });
    // 焦点与 2F
    [[-1, 'F'], [1, 'F′']].forEach(function (s) {
      var x = LX + s[0] * f, x2 = LX + s[0] * 2 * f;
      p += U.circle(x, CY, 4, { fill: C.ray3 }) + U.text(x, CY + 20, s[1], { fill: C.ray3, 'text-anchor': 'middle', 'font-size': 13 });
      if (x2 > 8 && x2 < W - 8) p += U.line(x2, CY - 5, x2, CY + 5, { stroke: C.dim }) + U.text(x2, CY + 20, '2' + s[1], { fill: C.dim, 'text-anchor': 'middle' });
    });

    // 光线
    var rays = '';
    function seg(x1, y1, x2, y2, color, extra) {
      var o = { stroke: color, 'stroke-width': 1.8, 'stroke-linecap': 'round' };
      for (var k in (extra || {})) o[k] = extra[k];
      rays += U.line(x1, y1, x2, y2, o);
    }
    function beyond(x1, y1, x2, y2, len) { // 从 (x2,y2) 沿方向再延长
      var d = Math.hypot(x2 - x1, y2 - y1) || 1; return [x2 + (x2 - x1) / d * len, y2 + (y2 - y1) / d * len];
    }
    var y3 = CY + (yt - CY) * f / (f - u); // 过物方焦点的光线打在透镜上的高度
    var use3 = isFinite(y3) && Math.abs(y3 - CY) <= LENS_H - 6;

    seg(xo, yt, LX, yt, C.ray);                   // ① 平行光轴入射
    seg(xo, yt, LX, CY, C.ray2);                  // ② 过光心
    if (use3) seg(xo, yt, LX, y3, C.ray3);        // ③ 过物方焦点
    var xi = LX + v, yi = CY + HO * v / u;        // 像尖位置（实像在轴下方）
    if (real) {
      seg(LX, yt, xi, yi, C.ray); seg(LX, CY, xi, yi, C.ray2); if (use3) seg(LX, y3, xi, yi, C.ray3);
      var e1 = beyond(LX, yt, xi, yi, 150), e2 = beyond(LX, CY, xi, yi, 150);
      seg(xi, yi, e1[0], e1[1], C.ray, { opacity: .3 }); seg(xi, yi, e2[0], e2[1], C.ray2, { opacity: .3 });
      if (use3) seg(xi, yi, xi + 150, yi, C.ray3, { opacity: .3 });
    } else if (virt) {
      var o1 = beyond(LX, yt, LX + f, CY, 900), o2 = beyond(xo, yt, LX, CY, 900);
      seg(LX, yt, o1[0], o1[1], C.ray); seg(LX, CY, o2[0], o2[1], C.ray2);
      if (use3) seg(LX, y3, W, y3, C.ray3);
      var da = { 'stroke-dasharray': '5 5', opacity: .65, 'stroke-width': 1.3 };
      seg(LX, yt, xi, yi, C.ray, da); seg(xo, yt, xi, yi, C.ray2, da); if (use3) seg(LX, y3, xi, yi, C.ray3, da);
    } else {
      var q1 = beyond(LX, yt, LX + f, CY, 900), q2 = beyond(xo, yt, LX, CY, 900);
      seg(LX, yt, q1[0], q1[1], C.ray); seg(LX, CY, q2[0], q2[1], C.ray2);
    }
    p += rays;

    // 透镜
    p += U.path('M' + LX + ',' + (CY - LENS_H) + ' Q' + (LX + 34) + ',' + CY + ' ' + LX + ',' + (CY + LENS_H) +
      ' Q' + (LX - 34) + ',' + CY + ' ' + LX + ',' + (CY - LENS_H) + 'Z', { fill: C.glass, stroke: C.glassEdge, 'stroke-width': 1.5 });

    // 像
    if (real && xi < W + 40) {
      p += U.line(xi, CY - 185, xi, CY + 185, { stroke: C.muted, 'stroke-width': 1, 'stroke-dasharray': '2 4' });
      p += U.arrow(xi, CY, xi, yi, C.text, 3.5, 10);
      if (xi < W - 60) p += U.text(xi + 8, CY - 170, '传感器放在这里', { fill: C.muted });
      p += U.text(Math.min(xi, W - 40) + 8, Math.min(yi + 4, H - 44), '实像', { fill: C.text, 'font-size': 13 });
    } else if (virt && xi > -40) {
      p += U.arrow(xi, CY, xi, yi, C.text, 3, 10).replace(/<line /, '<line stroke-dasharray="6 5" ');
      p += U.text(Math.max(xi, 30) - 8, Math.max(yi - 8, 14), '虚像', { fill: C.text, 'font-size': 13, 'text-anchor': 'end' });
    }

    // 物体（最后画，盖在光线上面）+ 透明的拖动热区
    p += U.arrow(xo, CY, xo, yt, C.accent, 4.5, 12);
    p += U.text(xo, yt - 10, '物', { fill: C.accent, 'text-anchor': 'middle', 'font-size': 13 });
    p += U.rect(xo - 22, yt - 26, 44, HO + 40, { fill: 'transparent', 'class': 'draggable' });

    // 尺寸标注
    p += U.dim(xo, LX, H - 26, 'u = ' + u, C.accent);
    if (real && xi < W - 4) p += U.dim(LX, xi, H - 26, 'v = ' + O.fmtNum(v, 1), C.text);
    p += U.dim(LX, LX + f, H - 62, 'f = ' + f, C.ray3);

    stage.innerHTML = U.svg(W, H, p);

    // 读数
    U.setText('img-f-out', f + ' mm'); U.setText('img-u-out', u + ' mm');
    U.setText('img-v', real ? O.fmtNum(v, 1) + ' mm' : virt ? '−' + O.fmtNum(-v, 1) + ' mm' : '∞');
    U.setText('img-m', isFinite(m) ? O.fmtNum(Math.abs(m), 2) + '×' : '∞');
    var vd = U.byId('img-verdict'), msg, cls = 'verdict';
    if (!real && !virt) { msg = 'u = f：出射光线互相平行，哪里都接不到像。'; cls += ' warn'; }
    else if (virt) { msg = '正立、放大的虚像。光线并没有真的汇聚，传感器上接不到——这是放大镜。'; cls += ' warn'; }
    else if (Math.abs(u / (2 * f) - 1) < 0.03) msg = 'u = 2f：倒立、等大的实像（1:1）。微距镜头最近对焦时就是这样。';
    else if (u < 2 * f) msg = '倒立、放大的实像。像距比物距还大——投影仪和超微距的情况。';
    else if (u > 5 * f) msg = '倒立、缩小的实像，像几乎落在焦点上。平时拍照都是这种情况。';
    else msg = '倒立、缩小的实像。物体越近，像越往后退、也越大。';
    vd.className = cls; vd.textContent = msg;
  }

  function setU(u) { st.u = Math.round(U.clamp(u, 20, 420)); uIn.value = st.u; render(); }

  function init() {
    pinholePair();
    stage = U.byId('img-stage'); fIn = U.byId('img-f'); uIn = U.byId('img-u');
    fIn.addEventListener('input', function () { st.f = +fIn.value; render(); });
    uIn.addEventListener('input', function () { st.u = +uIn.value; render(); });
    U.$$('#img-presets .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-u');
        setU(k === 'far' ? 420 : k === '2f' ? 2 * st.f : k === 'near' ? 1.4 * st.f : 0.6 * st.f);
      });
    });
    // 拖动：指针在舞台上的横坐标 → 物距
    var dragging = false;
    function toU(e) {
      var r = stage.getBoundingClientRect();
      return LX - (e.clientX - r.left) / r.width * W;
    }
    stage.style.touchAction = 'pan-y';
    stage.addEventListener('pointerdown', function (e) {
      var u = toU(e); if (u < 5) return;
      dragging = true; stage.setPointerCapture(e.pointerId); setU(u); e.preventDefault();
    });
    stage.addEventListener('pointermove', function (e) { if (dragging) setU(toU(e)); });
    ['pointerup', 'pointercancel'].forEach(function (n) { stage.addEventListener(n, function () { dragging = false; }); });
    render();
  }

  window.DemoImaging = { init: init, state: st };
})();
