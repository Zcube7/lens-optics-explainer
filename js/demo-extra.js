/* demo-extra.js —— 1.5 透视压缩（俯视 + 画面小样）、1.6 衍射（艾里斑 vs 像素） */
(function () {
  'use strict';
  var O = window.Optics, C = U.C;

  // =====================================================================
  // 1.5 透视：主体大小不变，焦距越长站得越远
  // =====================================================================
  var mapF = U.logMap(14, 800);
  var P = { f: 50 };
  var BG = 20000;            // 背景墙在主体后方 20 m
  var PERSON = 1700;         // 主体身高 mm，占画面高度 70%
  var CAM_H = 850;           // 机位高度 mm（腰平）
  var TREE_H = 5000, TREE_GAP = 4000;
  var PF = [24, 50, 85, 200, 400], pChips, pIn;

  function camDist(f) { return f * PERSON / (0.7 * 24); }

  function perspRender() {
    var f = P.f, d = camDist(f), W = 900, H = 380, p = '';
    // ---- 俯视图（左 640px）----
    var K = 5.8 / 1000, SX = 500, cy = 190, wallX = SX + BG * K, camX = SX - d * K;
    var halfW = 18 / f * (d + BG);                              // 墙上拍进的半宽 mm
    p += U.line(8, cy, 636, cy, { 'class': 'svg-axis' });
    // 背景墙：每 6 m 一棵树
    p += U.line(wallX, 6, wallX, H - 6, { stroke: C.line, 'stroke-width': 3 });
    for (var i = -9; i <= 8; i++) {
      var tX = (i + 0.5) * TREE_GAP, ty = cy + tX * K, inside = Math.abs(tX) <= halfW + TREE_H * 0.22;
      p += U.circle(wallX + 12, ty, 7, { fill: inside ? '#4f9a63' : '#27382c' });
    }
    var hy = Math.min(halfW * K, cy - 6);
    p += U.poly([[camX, cy], [wallX, cy - halfW * K], [wallX, cy + halfW * K]], { fill: C.accent, opacity: .13 });
    p += U.line(camX, cy, wallX, cy - halfW * K, { stroke: C.accent, 'stroke-width': 1.3 });
    p += U.line(camX, cy, wallX, cy + halfW * K, { stroke: C.accent, 'stroke-width': 1.3 });
    p += U.line(wallX, cy - hy, wallX, cy + hy, { stroke: C.accent, 'stroke-width': 4 });
    p += U.text(wallX - 8, 20, '背景', { 'text-anchor': 'end', fill: C.muted });
    // 主体、相机
    p += U.circle(SX, cy, 5.5, { fill: C.ray2 }) + U.text(SX, cy - 12, '主体', { 'text-anchor': 'middle', fill: C.ray2 });
    p += U.rect(camX - 16, cy - 9, 16, 18, { rx: 3, fill: '#d6d9de' }) + U.rect(camX, cy - 5, 7, 10, { rx: 1.5, fill: '#8c939d' });
    p += U.text(Math.max(camX - 8, 34), cy + 28, O.fmtFocal(f), { 'text-anchor': 'middle', fill: C.accent, 'font-family': 'Consolas, monospace', 'font-size': 13, 'font-weight': 700 });
    if (SX - camX > 46) p += U.dim(camX, SX, H - 24, O.fmtDist(d), C.text);
    p += U.dim(SX, wallX, H - 24, '20 m', C.dim);

    // ---- 画面小样（右侧 3:2）----
    var fx = 662, fy = 104, fw = 226, fh = fw * 2 / 3, ccx = fx + fw / 2, ccy = fy + fh / 2;
    var sH = fh / 24 * f;                                       // 物高/距离 → 画面像素
    function py(Y, Z) { return ccy - (Y - CAM_H) / Z * sH; }
    function px(X, Z) { return ccx + X / Z * sH; }
    var g = '<defs><clipPath id="pfc"><rect x="' + fx + '" y="' + fy + '" width="' + fw + '" height="' + U.r1(fh) + '" rx="4"/></clipPath>' +
      '<linearGradient id="pfs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#27406b"/><stop offset="1" stop-color="#d9a26f"/></linearGradient></defs>';
    var q = U.rect(fx, fy, fw, fh / 2, { fill: 'url(#pfs)' }) + U.rect(fx, ccy, fw, fh / 2, { fill: '#2b3a2f' });
    var Z = d + BG;
    for (var j = -12; j <= 11; j++) {
      var bx = px((j + 0.5) * TREE_GAP, Z), top = py(TREE_H, Z), bot = py(0, Z), th = bot - top;
      if (bx < fx - th || bx > fx + fw + th) continue;
      q += U.rect(bx - th * .035, bot - th * .42, th * .07, th * .42, { fill: '#3b2a20' });
      q += U.tag('ellipse', { cx: U.r1(bx), cy: U.r1(top + th * .34), rx: U.r1(th * .22), ry: U.r1(th * .34), fill: '#2f6a43' });
    }
    // 主体：头 + 身体
    var ph = py(0, d) - py(PERSON, d), fyb = py(0, d), hx = ccx;
    q += U.circle(hx, fyb - ph * .92, ph * .075, { fill: C.ray2 });
    q += U.path('M' + U.r1(hx - ph * .11) + ',' + U.r1(fyb - ph * .82) + ' h' + U.r1(ph * .22) + ' l' + U.r1(ph * .03) + ',' + U.r1(ph * .44) + ' h-' + U.r1(ph * .06) +
      ' l-' + U.r1(ph * .02) + ',' + U.r1(ph * .38) + ' h-' + U.r1(ph * .12) + ' l-' + U.r1(ph * .02) + ',-' + U.r1(ph * .38) + ' h-' + U.r1(ph * .06) + 'Z', { fill: C.ray2 });
    p += g + '<g clip-path="url(#pfc)">' + q + '</g>' + U.rect(fx, fy, fw, fh, { rx: 4, fill: 'none', stroke: C.line });
    p += U.text(ccx, fy - 10, '拍出来的画面', { 'text-anchor': 'middle', fill: C.dim });
    p += U.text(ccx, fy + fh + 20, '主体一样大，背景的树变了', { 'text-anchor': 'middle', fill: C.muted });
    U.byId('persp-stage').innerHTML = U.svg(W, H, p);

    // ---- 读数 ----
    var ratio = d / (d + BG);
    U.setText('persp-f-out', O.fmtFocal(f));
    U.setText('persp-d', O.fmtDist(d));
    U.setText('persp-w', O.fmtNum(2 * halfW / 1000, 1) + ' m');
    U.setText('persp-r', O.fmtNum(ratio * 100, 0) + '%');
    U.setText('persp-a', O.fmtAngle(O.aov(f, 36)));
    var msg = ratio < 0.25 ? '贴着主体拍：背景离相机比主体远得多，每样东西都很小，空间显得开阔、有纵深。'
      : ratio < 0.55 ? '主体和背景的远近差别适中，画面里的空间感接近肉眼。'
        : '退得很远之后，20 米的前后距离相对拍摄距离不算什么了：背景被放大到接近主体的比例，空间看起来被压扁。';
    U.byId('persp-verdict').textContent = msg;
    pChips.set(PF.indexOf(f) >= 0 ? f : '');
  }

  function perspInit() {
    pIn = U.byId('persp-f');
    pChips = U.chipGroup('persp-chips', PF.map(function (f) { return { v: f, label: f + 'mm' }; }), function (v) {
      P.f = +v; pIn.value = mapF.toPos(P.f); perspRender();
    });
    pIn.value = mapF.toPos(P.f);
    pIn.addEventListener('input', function () { P.f = U.snapFocal(mapF.toVal(+pIn.value)); perspRender(); });
    perspRender();
  }

  // =====================================================================
  // 1.6 衍射：艾里斑 vs 像素
  // =====================================================================
  var D = { ni: 13, body: 'z8' };
  var BAYER = ['#a33', '#3a3', '#3a3', '#35b'];

  function diffRender() {
    var N = O.F_STOPS[D.ni], body = null;
    window.LensData.BODIES.forEach(function (b) { if (b.id === D.body) body = b; });
    var pitch = body.sw / body.pxW * 1000;                      // µm
    var airy = O.airyDiameter(N) * 1000;                        // µm
    var W = 520, H = 380, S = 9, cx = W / 2, cy = 178, pp = pitch * S, p = '';
    p += '<defs><radialGradient id="airy"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".26" stop-color="#fff" stop-opacity=".55"/>' +
      '<stop offset=".45" stop-color="#fff" stop-opacity=".16"/><stop offset=".61" stop-color="#fff" stop-opacity="0"/>' +
      '<stop offset=".82" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<clipPath id="dfc"><rect x="0" y="0" width="' + W + '" height="340"/></clipPath></defs>';
    var g = '';
    var nx = Math.ceil(W / pp / 2) + 1, ny = Math.ceil(340 / pp / 2) + 1;
    for (var i = -nx; i < nx; i++) for (var j = -ny; j < ny; j++) {
      g += U.rect(cx + i * pp + 1, cy + j * pp + 1, pp - 2, pp - 2, { fill: BAYER[((i % 2 + 2) % 2) + 2 * ((j % 2 + 2) % 2)], opacity: .22, rx: 2 });
    }
    var ra = airy / 2 * S;
    g += U.circle(cx, cy, ra / 0.61, { fill: 'url(#airy)' });
    g += U.circle(cx, cy, ra, { fill: 'none', stroke: C.accent, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' });
    p += '<g clip-path="url(#dfc)">' + g + '</g>';
    // 比例尺
    p += U.dim(20, 20 + pp, 366, '1 像素 = ' + O.fmtNum(pitch, 2) + ' µm', C.muted).replace('text-anchor="middle"', 'text-anchor="start"');
    p += U.text(W - 16, 366, '艾里斑 ⌀ ' + O.fmtNum(airy, 1) + ' µm', { 'text-anchor': 'end', fill: C.accent, 'font-family': 'Consolas, monospace', 'font-size': 13 });
    U.byId('diff-stage').innerHTML = U.svg(W, H, p);

    U.setText('diff-n-out', O.fmtF(N));
    U.setText('diff-airy', O.fmtNum(airy, 1) + ' µm');
    U.setText('diff-pitch', O.fmtNum(pitch, 2) + ' µm');
    var r = airy / pitch, vd = U.byId('diff-verdict'), cls = 'verdict', msg;
    if (r < 1.5) msg = '光斑不到 1.5 个像素宽：衍射不是瓶颈，这时的锐度取决于镜头自身的像差。';
    else if (r < 2.5) msg = '光斑约 ' + O.fmtNum(r, 1) + ' 个像素宽：放大到 100% 才看得出一点点变软，通常是最锐的区间。';
    else if (r < 4) { msg = '光斑约 ' + O.fmtNum(r, 1) + ' 个像素宽：衍射已经看得见，细节反差下降。需要大景深时可以接受。'; cls += ' warn'; }
    else { msg = '光斑约 ' + O.fmtNum(r, 1) + ' 个像素宽：整张照片发软，像素再多也分辨不出更多细节。'; cls += ' bad'; }
    vd.className = cls; vd.textContent = msg;
  }

  function diffInit() {
    U.chipGroup('diff-body', window.LensData.BODIES.map(function (b) { return { v: b.id, label: b.name + ' · ' + O.fmtNum(b.mp, 1) + 'MP' }; }),
      function (v) { D.body = v; diffRender(); }, D.body);
    var nIn = U.byId('diff-n'); nIn.value = D.ni;
    nIn.addEventListener('input', function () { D.ni = +nIn.value; diffRender(); });
    diffRender();
  }

  window.DemoExtra = { init: function () { perspInit(); diffInit(); }, persp: P, diff: D, camDist: camDist };
})();
