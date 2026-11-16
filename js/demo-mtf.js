/* demo-mtf.js —— 1.7 MTF 怎么读：示意曲线 + 该位置上线条图案的实际反差 */
(function () {
  'use strict';
  var O = window.Optics, C = U.C;
  var HS = [0, 5, 10, 15, 20, 21.6];
  // 三组示意曲线（不是任何一支真实镜头的数据）
  var SETS = {
    even: { name: '又锐又均匀', s10: [.97, .97, .96, .96, .94, .92], m10: [.97, .96, .96, .95, .93, .90], s30: [.88, .87, .86, .84, .78, .72], m30: [.88, .86, .84, .82, .74, .66] },
    soft: { name: '中心锐、边角软', s10: [.95, .93, .88, .80, .68, .62], m10: [.95, .92, .85, .74, .58, .50], s30: [.80, .74, .62, .48, .34, .28], m30: [.80, .70, .52, .36, .22, .16] },
    astig: { name: 'S 和 M 分得很开', s10: [.94, .93, .91, .88, .84, .82], m10: [.94, .90, .82, .70, .56, .50], s30: [.76, .74, .70, .64, .56, .52], m30: [.76, .64, .46, .30, .18, .14] }
  };
  var CURVES = [['s10', '#e8443a', false, 'S10'], ['m10', '#e8443a', true, 'M10'], ['s30', '#3aa0e8', false, 'S30'], ['m30', '#3aa0e8', true, 'M30']];
  var st = { set: 'soft', h: 15 };
  var stage, hIn;

  function val(arr, h) {
    // 三次 Hermite 插值（切线取相邻两点的斜率），曲线平滑、不起台阶
    function slope(i) { var a = Math.max(i - 1, 0), b = Math.min(i + 1, HS.length - 1); return (arr[b] - arr[a]) / (HS[b] - HS[a]); }
    for (var i = 1; i < HS.length; i++) if (h <= HS[i]) {
      var dx = HS[i] - HS[i - 1], t = (h - HS[i - 1]) / dx, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * arr[i - 1] + (t3 - 2 * t2 + t) * dx * slope(i - 1) + (-2 * t3 + 3 * t2) * arr[i] + (t3 - t2) * dx * slope(i);
    }
    return arr[arr.length - 1];
  }

  var W = 900, H = 436, X0 = 58, X1 = 468, Y0 = 70, Y1 = 348;
  function px(h) { return X0 + h / 21.6 * (X1 - X0); }
  function py(v) { return Y1 - v * (Y1 - Y0); }

  function render() {
    var S = SETS[st.set], h = st.h, p = '';
    // ---------- 左：曲线图 ----------
    p += U.rect(X0, Y0, X1 - X0, Y1 - Y0, { fill: '#0d0e11', stroke: C.line });
    for (var k = 1; k < 10; k++) p += U.line(X0, py(k / 10), X1, py(k / 10), { stroke: C.faint });
    [0, .2, .4, .6, .8, 1].forEach(function (v) { p += U.text(X0 - 8, py(v) + 4, v === 0 ? '0' : v === 1 ? '1' : v.toFixed(1), { 'text-anchor': 'end', fill: C.dim, 'font-size': 11, 'font-family': 'Consolas, monospace' }); });
    [5, 10, 15, 20].forEach(function (x) {
      p += U.line(px(x), Y0, px(x), Y1, { stroke: C.faint });
      p += U.text(px(x), Y1 + 16, x, { 'text-anchor': 'middle', fill: C.dim, 'font-size': 11, 'font-family': 'Consolas, monospace' });
    });
    p += U.text((X0 + X1) / 2, Y1 + 34, '离画面中心的距离（mm）', { 'text-anchor': 'middle', fill: C.muted });
    p += U.text(X0, Y0 - 12, '反差', { fill: C.muted });
    p += U.text(X1, Y0 - 12, '示意曲线，不是某支镜头的数据', { fill: C.dim, 'font-size': 11, 'text-anchor': 'end' });
    CURVES.forEach(function (c) {
      var d = '';
      for (var x = 0; x <= 21.6001; x += 0.4) d += (d ? ' L' : 'M') + U.r1(px(x)) + ',' + U.r1(py(val(S[c[0]], x)));
      p += U.path(d, { stroke: c[1], 'stroke-width': 2.4, 'stroke-dasharray': c[2] ? '7 5' : null, 'stroke-linecap': 'round' });
    });
    // 图例
    CURVES.forEach(function (c, i) {
      var lx = X0 + 6 + i * 102, ly = Y1 + 58;
      p += U.line(lx, ly, lx + 30, ly, { stroke: c[1], 'stroke-width': 2.4, 'stroke-dasharray': c[2] ? '7 5' : null });
      p += U.text(lx + 36, ly + 4, c[3], { fill: C.text, 'font-family': 'Consolas, monospace' });
    });
    // 游标
    p += U.line(px(h), Y0, px(h), Y1, { stroke: C.accent, 'stroke-width': 1.5 });
    CURVES.forEach(function (c) { p += U.circle(px(h), py(val(S[c[0]], h)), 4.5, { fill: c[1], stroke: '#0d0e11', 'stroke-width': 1.5 }); });
    p += U.rect(X0, Y0, X1 - X0, Y1 - Y0, { fill: 'transparent', 'class': 'draggable' });

    // ---------- 右上：这个位置在画面的哪里 ----------
    var FX = 520, FY = 70, FW = 150, FH = 100, cx = FX + FW / 2, cy = FY + FH / 2, kmm = FW / 36;
    var ux = 36 / 43.27, uy = -24 / 43.27;                         // 中心指向右上角的单位向量
    var qx = cx + ux * h * kmm, qy = cy + uy * h * kmm;
    p += U.rect(FX, FY, FW, FH, { fill: '#101216', stroke: C.muted, rx: 3 });
    p += U.line(cx, cy, FX + FW, FY, { stroke: C.line, 'stroke-dasharray': '3 4' });
    p += U.circle(cx, cy, 2.5, { fill: C.muted });
    p += U.circle(qx, qy, 5, { fill: C.accent });
    p += U.text(FX, FY - 12, '传感器 36×24mm', { fill: C.muted });
    p += U.text(FX + FW + 14, FY + 16, '黄点 = 离中心 ' + O.fmtNum(h, 1) + ' mm', { fill: C.accent, 'font-size': 13 });
    p += U.text(FX + FW + 14, FY + 38, h < 1 ? '画面正中' : h < 9 ? '中心区域' : h < 16 ? '边缘（短边约 12mm，长边约 18mm）' : h < 21 ? '接近角落' : '最角落（21.6mm）', { fill: C.muted });
    p += U.text(FX + FW + 14, FY + 60, 'S：线条顺着半径方向', { fill: C.dim });
    p += U.text(FX + FW + 14, FY + 78, 'M：线条垂直于半径', { fill: C.dim });

    // ---------- 右下：四块线条图案，反差 = 曲线读数 ----------
    var defs = '', PX = 520, PY = 214, PS = 84, GAP = 10, ANG = 56.3;
    var cells = [['s10', 0, 0, 9, ANG, '10 线/mm · S'], ['m10', 1, 0, 9, ANG + 90, '10 线/mm · M'], ['s30', 2, 0, 3, ANG, '30 线/mm · S'], ['m30', 3, 0, 3, ANG + 90, '30 线/mm · M']];
    cells.forEach(function (c, i) {
      var m = val(S[c[0]], h), hi = Math.round(255 * (0.5 + 0.5 * m)), lo = Math.round(255 * (0.5 - 0.5 * m));
      var id = 'mtfp' + i, per = c[3] * 2, x = PX + i * (PS + GAP);
      defs += '<pattern id="' + id + '" width="' + per + '" height="' + per + '" patternUnits="userSpaceOnUse" patternTransform="rotate(' + c[4] + ')">' +
        '<rect width="' + per + '" height="' + per + '" fill="rgb(' + hi + ',' + hi + ',' + hi + ')"/><rect width="' + c[3] + '" height="' + per + '" fill="rgb(' + lo + ',' + lo + ',' + lo + ')"/></pattern>';
      p += U.rect(x, PY, PS, PS, { fill: 'url(#' + id + ')', stroke: i < 2 ? '#e8443a' : '#3aa0e8', 'stroke-width': 2, rx: 3 });
      p += U.text(x + PS / 2, PY + PS + 18, c[5], { 'text-anchor': 'middle', fill: C.muted, 'font-size': 11.5 });
      p += U.text(x + PS / 2, PY + PS + 38, m.toFixed(2), { 'text-anchor': 'middle', fill: C.text, 'font-size': 15, 'font-family': 'Consolas, monospace', 'font-weight': 700 });
    });
    p += U.text(PX, PY - 12, '黑白线条拍出来的样子（反差 = 曲线读数）', { fill: C.muted });
    p += U.text(PX, PY + PS + 62, '反差 1 = 纯黑纯白；0.5 = 深灰浅灰；0 = 一片灰，线条消失', { fill: C.dim, 'font-size': 11.5 });

    stage.innerHTML = U.svg(W, H, '<defs>' + defs + '</defs>' + p);

    // ---------- 读数 ----------
    var v = {}; CURVES.forEach(function (c) { v[c[0]] = val(S[c[0]], h); });
    U.setText('mtf-h-out', O.fmtNum(h, 1) + ' mm');
    U.setText('mtf-10', v.s10.toFixed(2) + ' / ' + v.m10.toFixed(2));
    U.setText('mtf-30', v.s30.toFixed(2) + ' / ' + v.m30.toFixed(2));
    var worst30 = Math.min(v.s30, v.m30), gap = Math.abs(v.s30 - v.m30), msg;
    if (worst30 >= 0.7) msg = '这里 30 线/mm 的反差还有 ' + worst30.toFixed(2) + '：细节清楚、边缘利落。';
    else if (worst30 >= 0.45) msg = '这里 30 线/mm 的反差降到 ' + worst30.toFixed(2) + '：细节还在，但没有中心那么利落。';
    else msg = '这里 30 线/mm 的反差只有 ' + worst30.toFixed(2) + '：细密的纹理（头发、树叶）会糊成一片。';
    if (gap >= 0.1) msg += ' S 和 M 差了 ' + gap.toFixed(2) + '：一个方向的线清楚、另一个方向的线糊，这是像散，焦外光斑容易被拉成线。';
    else if (h > 1 && gap < 0.05) msg += ' S 和 M 贴得很近，两个方向一样清楚。';
    U.byId('mtf-verdict').textContent = msg;
  }

  function init() {
    stage = U.byId('mtf-stage'); if (!stage) return;
    hIn = U.byId('mtf-h'); hIn.value = Math.round(st.h * 10);
    hIn.addEventListener('input', function () { st.h = +hIn.value / 10; render(); });
    U.chipGroup('mtf-set', Object.keys(SETS).map(function (k) { return { v: k, label: SETS[k].name }; }), function (v) { st.set = v; render(); }, st.set);
    // 在曲线图上拖动游标
    var dragging = false;
    function toH(e) { var r = stage.getBoundingClientRect(); return U.clamp(((e.clientX - r.left) / r.width * W - X0) / (X1 - X0) * 21.6, 0, 21.6); }
    function inChart(e) { var r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W; return x >= X0 - 10 && x <= X1 + 10; }
    function setH(h) { st.h = Math.round(h * 10) / 10; hIn.value = Math.round(st.h * 10); render(); }
    stage.style.touchAction = 'pan-y';
    stage.addEventListener('pointerdown', function (e) { if (!inChart(e)) return; dragging = true; stage.setPointerCapture(e.pointerId); setH(toH(e)); e.preventDefault(); });
    stage.addEventListener('pointermove', function (e) { if (dragging) setH(toH(e)); });
    ['pointerup', 'pointercancel'].forEach(function (n) { stage.addEventListener(n, function () { dragging = false; }); });
    render();
  }

  window.DemoMtf = { init: init, state: st, val: val, SETS: SETS };
})();
