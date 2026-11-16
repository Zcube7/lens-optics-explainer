/* demo-fov.js —— 1.2 焦距与视角：俯视视锥 + 取景范围嵌套框 */
(function () {
  'use strict';
  var O = window.Optics, C = U.C;
  var map = U.logMap(14, 800);
  var st = { f: 50, sensor: 'FX' };
  var FOCALS = [14, 24, 35, 50, 85, 135, 200, 400, 800];
  var fIn, chips, sensorChips;

  // ---------- 俯视图 ----------
  function topView() {
    var W = 480, H = 400, cx = 240, cy = 352, R = 290, PX_PER_M = 14.5; // 20 m ≈ 290px
    var s = O.SENSORS[st.sensor], half = O.aov(st.f, s.w) / 2 * Math.PI / 180;
    var p = '<defs><radialGradient id="fovg" cx="50%" cy="100%" r="100%"><stop offset="0" stop-color="#ffe100" stop-opacity=".42"/><stop offset="1" stop-color="#ffe100" stop-opacity=".04"/></radialGradient></defs>';

    // 距离环
    [5, 10, 15, 20].forEach(function (m) {
      var r = m * PX_PER_M;
      p += U.path('M' + (cx - r) + ',' + cy + ' A' + r + ',' + r + ' 0 0 1 ' + (cx + r) + ',' + cy, { stroke: C.faint, 'stroke-width': 1 });
      p += U.text(cx + 4, cy - r + 13, m + ' m', { fill: C.dim, 'font-size': 11 });
    });
    p += U.line(cx, cy, cx, cy - R - 20, { 'class': 'svg-axis' });

    // 50mm 参考视锥
    var ref = O.aov(50, O.SENSORS.FX.w) / 2 * Math.PI / 180;
    [-1, 1].forEach(function (k) {
      p += U.line(cx, cy, cx + k * Math.sin(ref) * R, cy - Math.cos(ref) * R, { stroke: C.dim, 'stroke-dasharray': '3 5' });
    });
    p += U.text(cx + Math.sin(ref) * R + 4, cy - Math.cos(ref) * R - 4, 'FX 50mm', { fill: C.dim, 'font-size': 11 });

    // 当前视锥
    var x1 = cx - Math.sin(half) * R, x2 = cx + Math.sin(half) * R, y = cy - Math.cos(half) * R;
    p += U.path('M' + cx + ',' + cy + ' L' + U.r1(x1) + ',' + U.r1(y) + ' A' + R + ',' + R + ' 0 0 1 ' + U.r1(x2) + ',' + U.r1(y) + 'Z',
      { fill: 'url(#fovg)', stroke: C.accent, 'stroke-width': 1.5, 'stroke-linejoin': 'round' });

    // 10 m 处的画面宽度
    var r10 = 10 * PX_PER_M, w10 = 10 * s.w / st.f, hw = Math.min(r10 * Math.tan(half), 236);
    p += U.line(cx - hw, cy - r10, cx + hw, cy - r10, { stroke: C.text, 'stroke-width': 2 });
    p += U.text(cx, cy - r10 - 8, '10 m 处宽 ' + O.fmtNum(w10, w10 < 10 ? 2 : 1) + ' m', { fill: C.text, 'text-anchor': 'middle', 'font-size': 12.5 });

    // 角度弧
    var ra = 46;
    p += U.path('M' + U.r1(cx - Math.sin(half) * ra) + ',' + U.r1(cy - Math.cos(half) * ra) + ' A' + ra + ',' + ra + ' 0 0 1 ' +
      U.r1(cx + Math.sin(half) * ra) + ',' + U.r1(cy - Math.cos(half) * ra), { stroke: C.accent, 'stroke-width': 2 });
    p += U.text(cx, cy - ra - 8, O.fmtAngle(half * 2 * 180 / Math.PI), { fill: C.accent, 'text-anchor': 'middle', 'font-size': 15, 'font-family': 'Consolas, monospace', 'font-weight': 700 });

    // 相机
    p += U.rect(cx - 22, cy + 6, 44, 24, { rx: 4, fill: '#2a2e36', stroke: C.line });
    p += U.rect(cx - 11, cy - 8, 22, 16, { rx: 3, fill: '#3a3f49' });
    U.byId('fov-top').innerHTML = U.svg(W, H, p);
  }

  // ---------- 取景范围 ----------
  var sceneCache = null;
  function scene(x0, y0, w, h) {
    if (sceneCache) return sceneCache;
    var hz = y0 + h * 0.56, cx = x0 + w / 2, cy = y0 + h / 2, p = '';
    p += '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16233f"/><stop offset=".55" stop-color="#5a4a6e"/><stop offset=".9" stop-color="#e58f5a"/><stop offset="1" stop-color="#f6c06c"/></linearGradient>' +
      '<linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98a5a"/><stop offset="1" stop-color="#27324a"/></linearGradient>' +
      '<clipPath id="pic"><rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '"/></clipPath></defs>';
    var g = U.rect(x0, y0, w, hz - y0, { fill: 'url(#sky)' });
    g += U.circle(cx + 62, hz - 16, 15, { fill: '#ffe9a8', opacity: .95 });
    // 远山
    g += U.poly([[x0, hz], [x0, hz - 38], [x0 + 60, hz - 74], [x0 + 120, hz - 40], [x0 + 170, hz - 62], [x0 + 215, hz - 22], [x0 + 260, hz - 34], [x0 + 330, hz - 86], [x0 + 395, hz - 44], [x0 + w, hz - 66], [x0 + w, hz]], { fill: '#3b3558' });
    g += U.poly([[x0, hz], [x0, hz - 16], [x0 + 80, hz - 34], [x0 + 150, hz - 12], [x0 + 300, hz - 20], [x0 + 370, hz - 40], [x0 + w, hz - 14], [x0 + w, hz]], { fill: '#2a2944' });
    // 湖与地面
    g += U.rect(x0, hz, w, y0 + h - hz, { fill: 'url(#lake)' });
    g += U.poly([[x0, y0 + h], [x0, hz + 40], [x0 + 130, hz + 22], [x0 + 250, hz + 30], [x0 + 330, hz + 20], [x0 + w, hz + 46], [x0 + w, y0 + h]], { fill: '#1c2a22' });
    g += U.poly([[x0, y0 + h], [x0, hz + 86], [x0 + 190, hz + 64], [x0 + w, hz + 98], [x0 + w, y0 + h]], { fill: '#14201a' });
    // 树
    [[40, 34, 62], [84, 30, 46], [395, 34, 58], [432, 44, 74], [140, 26, 30], [330, 24, 28]].forEach(function (t) {
      var bx = x0 + t[0], by = hz + t[1];
      g += U.poly([[bx, by - t[2]], [bx - t[2] * .26, by], [bx + t[2] * .26, by]], { fill: '#0f1a14' });
    });
    // 画面正中：小木屋 + 屋顶上的鸟（给长焦留的目标）
    g += U.rect(cx - 13, cy + 3, 26, 15, { fill: '#3a2a22' });
    g += U.poly([[cx - 17, cy + 3], [cx, cy - 8], [cx + 17, cy + 3]], { fill: '#56382b' });
    g += U.rect(cx - 9, cy + 8, 5, 5, { fill: '#ffd76a' });
    g += U.rect(cx + 3, cy + 8, 4, 10, { fill: '#241a15' });
    g += U.path('M' + (cx - 3) + ',' + (cy - 8.6) + ' q1.2,-2.6 3,-1.2 q1.6,-1 2.6,.4 l-1.2,.3 q-.6,1.4 -2.4,1.2 z', { fill: '#101010' });
    sceneCache = p + '<g clip-path="url(#pic)">' + g + '</g>';
    return sceneCache;
  }

  function frameView() {
    var W = 480, H = 400, pw = 450, ph = 300, x0 = 15, y0 = 46, cx = x0 + pw / 2, cy = y0 + ph / 2;
    var s = O.SENSORS[st.sensor], k = s.w / 36;
    var p = scene(x0, y0, pw, ph);
    function box(f) { var w = pw * 14 / f * k, h = w * s.h / s.w; return { x: cx - w / 2, y: cy - h / 2, w: w, h: h }; }

    // 当前取景框以外压暗
    var b = box(st.f);
    p += U.path('M' + x0 + ',' + y0 + ' h' + pw + ' v' + ph + ' h-' + pw + 'Z M' + U.r1(b.x) + ',' + U.r1(b.y) + ' v' + U.r1(b.h) + ' h' + U.r1(b.w) + ' v-' + U.r1(b.h) + 'Z',
      { fill: 'rgba(5,6,8,.62)', 'fill-rule': 'evenodd' });
    // 参考框
    FOCALS.forEach(function (f) {
      if (f === 14 || Math.abs(f - st.f) < 0.5) return;
      var r = box(f); if (r.w < 5) return;
      p += U.rect(r.x, r.y, r.w, r.h, { fill: 'none', stroke: 'rgba(255,255,255,.34)', 'stroke-width': 1 });
      if (r.w > 26) p += U.text(r.x + 4, r.y + 12, f, { fill: 'rgba(255,255,255,.6)', 'font-size': 10.5, 'font-family': 'Consolas, monospace' });
    });
    // 当前框
    p += U.rect(b.x, b.y, Math.max(b.w, 2), Math.max(b.h, 2), { fill: 'none', stroke: C.accent, 'stroke-width': 2.2 });
    var lab = O.fmtFocal(st.f) + (st.sensor === 'DX' ? ' · DX' : '');
    p += U.text(cx, Math.max(b.y - 8, y0 - 8), lab, { fill: C.accent, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, 'font-family': 'Consolas, monospace' });
    p += U.rect(x0, y0, pw, ph, { fill: 'none', stroke: C.line });
    p += U.text(x0, y0 + ph + 22, '整幅图 = FX 机身 14mm 拍到的范围', { fill: C.dim, 'font-size': 12 });
    p += U.text(x0 + pw, y0 + ph + 22, '画面占整幅图的 ' + O.fmtNum(100 * b.w * b.h / (pw * ph), 2) + '%', { fill: C.muted, 'font-size': 12, 'text-anchor': 'end' });
    U.byId('fov-frame').innerHTML = U.svg(W, H, p);
  }

  function category(eq) {
    if (eq < 24) return ['超广角', '容纳范围极大，近处的东西被明显放大，适合风光、建筑、星空。'];
    if (eq <= 35) return ['广角', '能把环境一起带进画面，适合人文、风光、合影。'];
    if (eq < 70) return ['标准', '远近比例和肉眼的感觉最接近，什么都能拍。'];
    if (eq <= 135) return ['中长焦', '人像最常用：能拉开距离，背景范围窄、容易干净。'];
    if (eq <= 400) return ['长焦', '把远处拉近，适合体育、舞台、野生动物。'];
    return ['超长焦', '视角只有几度，打鸟、拍月亮用。画面极易抖动。'];
  }

  function render() {
    var s = O.SENSORS[st.sensor], a = O.aovAll(st.f, s);
    topView(); frameView();
    U.setText('fov-f-out', O.fmtFocal(st.f));
    U.setText('fov-h', O.fmtAngle(a.h)); U.setText('fov-v', O.fmtAngle(a.v)); U.setText('fov-d', O.fmtAngle(a.d));
    var w10 = 10 * s.w / st.f;
    U.setText('fov-w10', O.fmtNum(w10, w10 < 10 ? 2 : 1) + ' m');
    var eq = st.f * s.crop, cat = category(eq);
    U.byId('fov-verdict').innerHTML = '<b>' + cat[0] + '</b>' +
      (st.sensor === 'DX' ? '（相当于 FX 的 ' + O.fmtNum(eq, 0) + 'mm 视角）' : '') + '：' + cat[1];
    chips.set(FOCALS.indexOf(st.f) >= 0 ? st.f : '');
  }

  function setF(f) { st.f = f; fIn.value = map.toPos(f); render(); }

  function init() {
    fIn = U.byId('fov-f');
    chips = U.chipGroup('fov-chips', FOCALS.map(function (f) { return { v: f, label: f }; }), function (v) { setF(+v); });
    sensorChips = U.chipGroup('fov-sensor', null, function (v) { st.sensor = v; render(); });
    fIn.addEventListener('input', function () { st.f = U.snapFocal(map.toVal(+fIn.value)); render(); });
    setF(50);
  }

  window.DemoFov = { init: init, state: st, setF: setF };
})();
