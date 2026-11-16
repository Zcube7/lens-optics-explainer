/* demo-aperture.js —— 1.3 光圈：叶片开合、入瞳直径、曝光换算 */
(function () {
  'use strict';
  var O = window.Optics, C = U.C;
  var STOPS = O.F_STOPS.slice(0, 29);           // f/0.95 … f/22
  var FULL = [1, 1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
  var st = { f: 50, ni: 6, blades: 9, ev: 12, iso: 400 };

  /**
   * 光圈孔的轮廓：n 条圆弧围成。r = 内切圆半径；bulge=1 时就是正圆，越大边越直。
   * 返回 {d, verts}
   */
  function irisPath(cx, cy, r, n, bulge, rot) {
    var rc = r / Math.cos(Math.PI / n), verts = [], d = '';
    for (var i = 0; i < n; i++) {
      var a = rot + i * 2 * Math.PI / n;
      verts.push([cx + rc * Math.cos(a), cy + rc * Math.sin(a)]);
    }
    var ra = rc * bulge;
    verts.forEach(function (v, i) {
      d += (i ? ' A' + U.r1(ra) + ',' + U.r1(ra) + ' 0 0 1 ' : 'M') + U.r1(v[0]) + ',' + U.r1(v[1]);
    });
    d += ' A' + U.r1(ra) + ',' + U.r1(ra) + ' 0 0 1 ' + U.r1(verts[0][0]) + ',' + U.r1(verts[0][1]) + 'Z';
    return { d: d, verts: verts };
  }

  function render() {
    var N = STOPS[st.ni], W = 520, H = 480, cx = 260, cy = 186, RB = 162, RG = 148, RMAX = 138;
    var r = RMAX * STOPS[0] / N;                              // 孔半径 ∝ 1/N
    var down = O.stopsBetween(STOPS[0], N);                    // 相对全开收了几档
    var bulge = 1 + Math.min(down, 5) * 0.55;                  // 全开是圆，越收越接近多边形
    var p = '<defs><radialGradient id="apg"><stop offset="0" stop-color="#f4fbff"/><stop offset=".7" stop-color="#9ed4ff"/><stop offset="1" stop-color="#4f8fc0"/></radialGradient>' +
      '<radialGradient id="apb" cx="50%" cy="38%"><stop offset="0" stop-color="#30343c"/><stop offset="1" stop-color="#15171b"/></radialGradient>' +
      '<clipPath id="apc"><circle cx="' + cx + '" cy="' + cy + '" r="' + RG + '"/></clipPath></defs>';

    // 镜筒
    p += U.circle(cx, cy, RB + 14, { fill: '#0f1114', stroke: '#2a2e36', 'stroke-width': 2 });
    p += U.circle(cx, cy, RB, { fill: 'none', stroke: C.accent, 'stroke-width': 1.5, opacity: .7 });
    p += U.circle(cx, cy, RG, { fill: 'url(#apb)' });

    // 叶片：每条孔边向外延长到镜筒，形成风车状的叶片边线
    var iris = irisPath(cx, cy, r, st.blades, bulge, -Math.PI / 2 + down * 0.11);
    var edges = '';
    iris.verts.forEach(function (v, i) {
      var w = iris.verts[(i + 1) % st.blades], dx = w[0] - v[0], dy = w[1] - v[1], L = Math.hypot(dx, dy) || 1;
      edges += U.line(w[0], w[1], w[0] + dx / L * 2 * RG, w[1] + dy / L * 2 * RG, { stroke: '#454b56', 'stroke-width': 1.2 });
    });
    p += '<g clip-path="url(#apc)">' + edges + '</g>';
    p += U.path(iris.d, { fill: 'url(#apg)', stroke: '#0b0c0e', 'stroke-width': 1.5 });

    // 入瞳直径标注
    var D = O.entrancePupil(st.f, N), ly = cy + RB + 34;
    p += U.line(cx - r, cy, cx - r, ly, { stroke: C.accent, 'stroke-dasharray': '3 4', opacity: .6 });
    p += U.line(cx + r, cy, cx + r, ly, { stroke: C.accent, 'stroke-dasharray': '3 4', opacity: .6 });
    p += U.line(cx - r, ly, cx + r, ly, { stroke: C.accent, 'stroke-width': 1.5 });
    p += U.text(cx, ly + 19, 'D = ' + st.f + ' ÷ ' + O.fmtNum(N, 2) + ' = ' + O.fmtNum(D, 1) + ' mm',
      { fill: C.accent, 'font-size': 13.5, 'font-family': 'Consolas, monospace', 'text-anchor': 'middle' });

    // 整档刻度：各档的孔按真实比例画成小圆
    var sy = H - 34, x0 = 46, x1 = W - 46, la = Math.log(STOPS[0]), lb = Math.log(22);
    function sx(n) { return x0 + (Math.log(n) - la) / (lb - la) * (x1 - x0); }
    p += U.line(x0, sy, x1, sy, { stroke: C.faint });
    FULL.forEach(function (n) {
      var rr = Math.max(13 / n, 0.7);
      p += U.circle(sx(n), sy, rr, { fill: Math.abs(n - N) < 0.01 ? C.accent : '#8fa3b5' });
      p += U.text(sx(n), sy + 24, n, { 'text-anchor': 'middle', fill: C.dim, 'font-size': 11, 'font-family': 'Consolas, monospace' });
    });
    p += U.poly([[sx(N), sy - 17], [sx(N) - 5, sy - 26], [sx(N) + 5, sy - 26]], { fill: C.accent });
    p += U.text(x0, sy - 30, '整档光圈的孔径比例（每档面积减半）', { fill: C.dim, 'font-size': 11 });

    U.byId('ap-stage').innerHTML = U.svg(W, H, p);

    // ---------- 读数 ----------
    U.setText('ap-n-out', O.fmtF(N));
    U.setText('ap-d', O.fmtNum(D, 1) + ' mm');
    var rel = O.stopsBetween(1.4, N), fac = Math.pow(2, -rel), rs = Math.round(rel * 3) / 3;
    U.setText('ap-stops', Math.abs(rs) < 0.1 ? '相同' :
      (fac >= 1 ? O.fmtNum(fac, 1) + '×' : '1/' + O.fmtNum(1 / fac, fac > 0.1 ? 1 : 0)) + ' ' + (rs > 0 ? '−' : '+') + O.fmtNum(Math.abs(rs), 1) + '档');

    var t = O.shutterFor(st.ev, N, st.iso), ts = O.nearestIn(O.SHUTTERS, t), safe = 1 / st.f;
    U.setText('ap-shutter', O.fmtShutter(ts));
    U.setText('ap-safe', '1/' + st.f + ' s');
    var vd = U.byId('ap-verdict'), cls = 'verdict', msg;
    var slow = Math.log(t / safe) / Math.LN2;                  // 比安全快门慢几档
    if (D > 160) { msg = '入瞳要 ' + O.fmtNum(D, 0) + 'mm——现实里没有这样的镜头。Z 600mm f/4 的入瞳是 150mm，已经重 3 公斤多。'; cls += ' warn'; }
    else if (t < 1 / 8000) { msg = '光太多：快门要快过 1/8000 s，多数机身的机械快门到头了，得收光圈或降 ISO。'; cls += ' warn'; }
    else if (slow <= 0.05) msg = '快门比安全快门快，手持没问题。';
    else if (slow <= 5) { msg = '比安全快门慢 ' + O.fmtNum(slow, 1) + ' 档：要靠防抖（VR），或者开大光圈、提高 ISO。拍会动的东西防抖帮不上忙。'; cls += ' warn'; }
    else { msg = '比安全快门慢 ' + O.fmtNum(slow, 1) + ' 档：手持拍不稳，上三脚架，或者换光圈更大的镜头。'; cls += ' bad'; }
    vd.className = cls; vd.textContent = msg;
  }

  function init() {
    U.chipGroup('ap-focal', [24, 50, 85, 200, 400, 800].map(function (f) { return { v: f, label: f + 'mm' }; }),
      function (v) { st.f = +v; render(); }, st.f);
    U.chipGroup('ap-blades', null, function (v) { st.blades = +v; render(); });
    var nIn = U.byId('ap-n');
    nIn.max = STOPS.length - 1; nIn.value = st.ni;
    nIn.addEventListener('input', function () { st.ni = +nIn.value; render(); });
    U.byId('ap-ev').addEventListener('change', function (e) { st.ev = +e.target.value; render(); });
    U.byId('ap-iso').addEventListener('change', function (e) { st.iso = +e.target.value; render(); });
    render();
  }

  window.DemoAperture = { init: init, state: st, irisPath: irisPath };
})();
