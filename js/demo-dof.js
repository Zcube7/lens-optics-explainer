/* demo-dof.js —— 1.4 景深与虚化：像方光锥示意 + 景深条 */
(function () {
  'use strict';
  var O = window.Optics, C = U.C;
  var STOPS = O.F_STOPS.slice(0, 29);
  var mapF = U.logMap(14, 800), mapS = U.logMap(300, 100000), mapB = U.logMap(500, 1000000);
  var st = { f: 85, ni: 6, s: 2500, bg: 10000, sensor: 'FX' };
  var els = {};

  function sig3(x) { var k = Math.pow(10, Math.floor(Math.log(x) / Math.LN10) - 2); return Math.round(x / k) * k; }

  function calc() {
    var sen = O.SENSORS[st.sensor], N = STOPS[st.ni], f = st.f;
    var s = Math.max(st.s, 4 * f), d = isFinite(st.bg) ? s + st.bg : Infinity;
    var dof = O.dof(f, N, s, sen.coc), c = O.blurDisc(f, N, s, d);
    return { sen: sen, N: N, f: f, s: s, d: d, dof: dof, c: c, clamped: s > st.s + 1 };
  }

  // ---------- 像方光锥（示意） ----------
  function cone(r) {
    var W = 860, H = 300, cy = 158, LX = 200, SX = 660, span = SX - LX, LH = 118;
    var a = Math.min(112, 147 / r.N);                         // 光圈半高（px）
    var vs = O.imageDistance(r.f, r.s), vd = O.imageDistance(r.f, r.d);
    var delta = (vs - vd) / vd;                               // 真实的相对离焦量
    var e = 0.55 * (1 - Math.exp(-delta * 18));               // 夸大后用于画图
    var xb = LX + span * (1 - e), hb = Math.min(a * e / (1 - e), 128);
    var p = '';

    p += U.line(10, cy, W - 10, cy, { 'class': 'svg-axis' });
    // 入射光：主体（近，发散明显）与背景点（远，接近平行）
    function ray(x1, y1, x2, y2, col, o) { return U.line(x1, y1, x2, y2, { stroke: col, 'stroke-width': 1.5, opacity: o || 1 }); }
    [-1, 1].forEach(function (k) {
      p += ray(14, cy + k * a * 0.9, LX, cy + k * a, C.ray, .9);
      p += ray(LX, cy + k * a, xb, cy, C.ray, .9) + ray(xb, cy, SX, cy - k * hb, C.ray, .9);
      p += ray(14, cy + k * a * 0.45, LX, cy + k * a, C.accent);
      p += ray(LX, cy + k * a, SX, cy, C.accent);
    });
    p += U.poly([[LX, cy - a], [xb, cy], [LX, cy + a]], { fill: C.ray, opacity: .08 });
    p += U.poly([[xb, cy], [SX, cy - hb], [SX, cy + hb]], { fill: C.ray, opacity: .16 });

    // 透镜 + 光圈挡片
    p += U.path('M' + LX + ',' + (cy - LH) + ' Q' + (LX + 30) + ',' + cy + ' ' + LX + ',' + (cy + LH) + ' Q' + (LX - 30) + ',' + cy + ' ' + LX + ',' + (cy - LH) + 'Z',
      { fill: C.glass, stroke: C.glassEdge, 'stroke-width': 1.5 });
    p += U.rect(LX - 4, cy - LH - 8, 8, LH + 8 - a, { fill: '#59606c' }) + U.rect(LX - 4, cy + a, 8, LH + 8 - a, { fill: '#59606c' });
    p += U.text(LX, cy - LH - 16, '光圈 ' + O.fmtF(r.N), { 'text-anchor': 'middle', fill: C.text });

    // 汇聚点与传感器
    p += U.circle(xb, cy, 3.5, { fill: C.ray });
    p += U.text(xb, cy + 22, '背景点在这里汇聚', { 'text-anchor': 'middle', fill: C.ray });
    p += U.line(SX, cy - 132, SX, cy + 132, { stroke: C.text, 'stroke-width': 3 });
    p += U.line(SX, cy - hb, SX, cy + hb, { stroke: C.ray, 'stroke-width': 6, 'stroke-linecap': 'round' });
    p += U.circle(SX, cy, 3.5, { fill: C.accent });
    p += U.text(SX, cy - 140, '传感器', { 'text-anchor': 'middle', fill: C.text });
    p += U.text(18, cy - Math.max(a * 0.9, 20) - 10, '主体（合焦）', { fill: C.accent });
    p += U.text(18, Math.min(cy + a * 0.9 + 18, H - 8), '背景点', { fill: C.ray });

    // 从正面看传感器
    var fx = 770, rr = U.clamp(hb, 1.5, 70);
    p += U.rect(fx - 78, cy - 78, 156, 156, { rx: 8, fill: '#101216', stroke: C.line });
    p += U.circle(fx, cy, rr, { fill: C.ray, opacity: .32, stroke: C.ray, 'stroke-width': 1.2 });
    p += U.circle(fx, cy, 2.5, { fill: C.accent });
    p += U.text(fx, cy - 88, '正面看传感器', { 'text-anchor': 'middle', fill: C.dim });
    p += U.text(fx, cy + 100, '模糊圆 ⌀ ' + O.fmtNum(r.c, r.c < 1 ? 3 : 2) + ' mm', { 'text-anchor': 'middle', fill: C.ray, 'font-family': 'Consolas, monospace' });
    els.cone.innerHTML = U.svg(W, H, p);
  }

  // ---------- 景深条 ----------
  function bar(r) {
    var W = 860, H = 152, X0 = 70, X1 = 760, XI = 824, y = 84, lo = 200, hi = 200000;
    function x(mm) { return !isFinite(mm) ? XI : U.clamp(X0 + Math.log(mm / lo) / Math.log(hi / lo) * (X1 - X0), X0, X1); }
    var p = U.rect(0, 0, W, H, { fill: '#0d0e11' });
    p += U.line(X0, y, X1, y, { stroke: C.line, 'stroke-width': 2 }) + U.line(X1, y, XI + 14, y, { stroke: C.line, 'stroke-width': 2, 'stroke-dasharray': '3 5' });
    [0.3, 0.5, 1, 2, 5, 10, 20, 50, 100].forEach(function (m) {
      p += U.line(x(m * 1000), y - 5, x(m * 1000), y + 5, { stroke: C.dim });
      p += U.text(x(m * 1000), y + 40, m + ' m', { 'text-anchor': 'middle', fill: C.dim, 'font-size': 11, 'font-family': 'Consolas, monospace' });
    });
    p += U.text(XI, y + 40, '∞', { 'text-anchor': 'middle', fill: C.dim, 'font-size': 15 });
    // 相机
    p += U.rect(18, y - 12, 26, 24, { rx: 4, fill: '#2a2e36', stroke: C.line }) + U.rect(44, y - 7, 10, 14, { rx: 2, fill: '#3a3f49' });
    // 清晰范围
    var xa = x(r.dof.near), xb = isFinite(r.dof.far) ? x(r.dof.far) : XI + 14;
    p += U.rect(xa, y - 15, Math.max(xb - xa, 2.5), 30, { rx: 3, fill: C.ok, opacity: .32, stroke: C.ok, 'stroke-width': 1 });
    p += U.text((xa + xb) / 2, y - 24, '清晰范围', { 'text-anchor': 'middle', fill: C.ok, 'font-size': 12 });
    // 超焦距
    if (r.dof.H < hi) {
      p += U.line(x(r.dof.H), y - 15, x(r.dof.H), y + 15, { stroke: C.muted, 'stroke-dasharray': '3 3' });
      p += U.text(x(r.dof.H), y + 24, 'H', { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11 });
    }
    // 对焦点、背景
    p += U.line(x(r.s), y - 20, x(r.s), y + 20, { stroke: C.accent, 'stroke-width': 2.5 });
    p += U.text(x(r.s), y - 42, '对焦 ' + O.fmtDist(r.s), { 'text-anchor': 'middle', fill: C.accent, 'font-size': 12 });
    p += U.circle(x(r.d), y, 5, { fill: C.ray });
    p += U.text(x(r.d), y - 60, '背景 ' + O.fmtDist(r.d), { 'text-anchor': x(r.d) > 720 ? 'end' : 'middle', fill: C.ray, 'font-size': 12, dx: x(r.d) > 720 ? 22 : 0 });
    p += U.line(x(r.d), y - 54, x(r.d), y - 8, { stroke: C.ray, 'stroke-dasharray': '2 3', opacity: .6 });
    els.bar.innerHTML = U.svg(W, H, p);
  }

  function render() {
    var r = calc();
    cone(r); bar(r);
    U.setText('dof-f-out', O.fmtFocal(r.f)); U.setText('dof-n-out', O.fmtF(r.N));
    U.setText('dof-s-out', O.fmtDist(r.s)); U.setText('dof-bg-out', isFinite(st.bg) ? O.fmtDist(st.bg) : '无穷远');
    U.setText('dof-range', O.fmtDist(r.dof.near) + ' – ' + O.fmtDist(r.dof.far));
    U.setText('dof-total', O.fmtDist(r.dof.total)); U.setText('dof-h', O.fmtDist(r.dof.H));
    var pct = r.c / r.sen.w * 100;
    U.setText('dof-blur', O.fmtNum(r.c, r.c < 1 ? 3 : 2) + ' mm · 画面宽的 ' + O.fmtNum(pct, 2) + '%');
    var D = r.f / r.N, m = r.f / (r.s - r.f), k = isFinite(r.d) ? (r.d - r.s) / r.d : 1, msg, cls = 'verdict';
    if (r.c <= r.sen.coc) msg = '背景还在景深里，是清晰的。';
    else if (pct < 0.25) msg = '背景轻微发虚，细节还看得清。';
    else if (pct < 1) msg = '背景明显虚化，轮廓还认得出来。';
    else if (pct < 3) msg = '背景虚成一片，只剩大块的形状和颜色。';
    else msg = '背景完全化开，点光源会变成很大的光斑。';
    msg += ' 模糊圆占画面宽度的 ' + O.fmtNum(pct, 2) + '% = 入瞳 ' + O.fmtNum(D, 1) + 'mm × 放大倍率 ' + O.fmtNum(m, 3) + ' × 离焦比例 ' + O.fmtNum(k, 2) + '。';
    if (r.clamped) { msg += ' 对焦距离已限制在 4 倍焦距以外。'; cls += ' warn'; }
    var vd = U.byId('dof-verdict'); vd.className = cls; vd.textContent = msg;
  }

  function init() {
    els.cone = U.byId('dof-cone'); els.bar = U.byId('dof-bar');
    var fIn = U.byId('dof-f'), nIn = U.byId('dof-n'), sIn = U.byId('dof-s'), bIn = U.byId('dof-bg');
    nIn.max = STOPS.length - 1;
    fIn.value = mapF.toPos(st.f); nIn.value = st.ni; sIn.value = mapS.toPos(st.s); bIn.value = mapB.toPos(st.bg);
    fIn.addEventListener('input', function () { st.f = U.snapFocal(mapF.toVal(+fIn.value)); render(); });
    nIn.addEventListener('input', function () { st.ni = +nIn.value; render(); });
    sIn.addEventListener('input', function () { st.s = sig3(mapS.toVal(+sIn.value)); render(); });
    bIn.addEventListener('input', function () { st.bg = +bIn.value >= 995 ? Infinity : sig3(mapB.toVal(+bIn.value)); render(); });
    U.chipGroup('dof-sensor', null, function (v) { st.sensor = v; render(); });
    render();
  }

  window.DemoDof = { init: init, state: st, calc: calc };
})();
