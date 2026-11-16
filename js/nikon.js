/* nikon.js —— 板块二：镜头名解码、镜片术语、Z 卡口剖面、焦段地图、镜头图鉴；板块四：怎么选 */
(function () {
  'use strict';
  var O = window.Optics, C = U.C, LD = window.LensData;
  var selected = 'z85f18';

  // =====================================================================
  // 2.1 镜头名解码
  // =====================================================================
  var NAMES = [
    { label: '70-200mm f/2.8', toks: ['NIKKOR', 'Z', '70-200mm', 'f/2.8', 'VR', 'S'] },
    { label: '微距 105mm', toks: ['NIKKOR', 'Z', 'MC', '105mm', 'f/2.8', 'VR', 'S'] },
    { label: '400mm TC', toks: ['NIKKOR', 'Z', '400mm', 'f/2.8', 'TC', 'VR', 'S'] },
    { label: 'DX 16-50mm', toks: ['NIKKOR', 'Z', 'DX', '16-50mm', 'f/3.5-6.3', 'VR'] },
    { label: 'Noct', toks: ['NIKKOR', 'Z', '58mm', 'f/0.95', 'S', 'Noct'] },
    { label: 'Plena', toks: ['NIKKOR', 'Z', '135mm', 'f/1.8', 'S', 'Plena'] }
  ];
  var FIXED = {
    'NIKKOR': ['尼克尔', '尼康镜头的品牌名，从 1930 年代一直用到现在。'],
    'Z': ['Z 卡口', '2018 年推出的无反相机卡口：内径 55mm，法兰距 16mm。'],
    'VR': ['光学防抖', 'Vibration Reduction。镜头里有一组镜片反向移动来抵消手抖，长焦和慢快门时最有用。'],
    'S': ['S 型（S-Line）', '尼康给高规格 Z 镜头的标记：更严的光学标准，更好的镀膜和防尘防滴。'],
    'MC': ['微距', 'Micro 的缩写。能对焦到很近的地方，放大倍率达到 1:1。'],
    'TC': ['内置增距镜', 'Teleconverter。镜身里藏了一组 1.4× 增距镜，拨一下开关，焦距 ×1.4，光圈值也 ×1.4（暗一档）。'],
    'DX': ['DX 画幅专用', '只需要照亮 23.5×15.7mm 的传感器，所以更小更轻。装在 FX 机身上会自动裁切。'],
    'Noct': ['Noct', '取自 Nocturne（夜曲）。尼康把这个名字留给光圈最大的镜头。'],
    'Plena': ['Plena', '来自拉丁语 plenum（充满）：从中心到边角，亮度和光斑形状都饱满。']
  };

  function explain(tok, toks) {
    if (FIXED[tok]) return FIXED[tok];
    var m, focal = null;
    toks.forEach(function (t) { var k = /^(\d+)(?:-(\d+))?mm$/.exec(t); if (k) focal = [+k[1], +(k[2] || k[1])]; });
    var dx = toks.indexOf('DX') >= 0, sen = dx ? O.SENSORS.DX : O.SENSORS.FX;
    if ((m = /^(\d+)-(\d+)mm$/.exec(tok))) {
      return ['焦距范围', '变焦镜头：' + m[1] + 'mm 到 ' + m[2] + 'mm 连续可变，变焦比 ' + O.fmtNum(m[2] / m[1], 1) + ' 倍。' +
        (dx ? 'DX 机身上' : '') + '对角视角 ' + O.fmtAngle(O.aov(+m[1], O.diag(sen))) + ' – ' + O.fmtAngle(O.aov(+m[2], O.diag(sen))) + '。'];
    }
    if ((m = /^(\d+)mm$/.exec(tok))) {
      return ['焦距', '定焦镜头：只有 ' + m[1] + 'mm 一个焦距，不能变焦，换来更大的光圈或更小的体积。对角视角 ' + O.fmtAngle(O.aov(+m[1], O.diag(sen))) + '。'];
    }
    if ((m = /^f\/([\d.]+)-([\d.]+)$/.exec(tok))) {
      return ['浮动光圈', '广角端最大 f/' + m[1] + '，变到长焦端只剩 f/' + m[2] + '。这样设计，镜头可以做得更小、更便宜。'];
    }
    if ((m = /^f\/([\d.]+)$/.exec(tok))) {
      var zoom = focal && focal[0] !== focal[1];
      return ['最大光圈', (zoom ? '只写一个数字，说明整个焦段都能开到 f/' + m[1] + '（恒定光圈）。' : '光圈能开到的最大值。') +
        (focal ? '入瞳直径 = ' + focal[1] + ' ÷ ' + m[1] + ' = ' + O.fmtNum(focal[1] / +m[1], 1) + 'mm。' : '')];
    }
    return [tok, ''];
  }

  function decoderInit() {
    var nameEl = U.byId('dec-name'), expEl = U.byId('dec-exp');
    function show(i) {
      var toks = NAMES[i].toks;
      nameEl.innerHTML = toks.map(function (t, k) { return '<button type="button" class="tok" data-k="' + k + '">' + U.esc(t) + '</button>'; }).join('');
      var btns = U.$$('.tok', nameEl);
      function pick(k) {
        btns.forEach(function (b, j) { b.classList.toggle('on', j === k); });
        var e = explain(toks[k], toks);
        expEl.innerHTML = '<b>' + U.esc(e[0]) + '</b>' + U.esc(e[1]);
      }
      btns.forEach(function (b, k) { b.addEventListener('click', function () { pick(k); }); });
      pick(Math.max(0, toks.length - 4));
    }
    U.chipGroup('dec-examples', NAMES.map(function (n, i) { return { v: i, label: n.label }; }), function (v) { show(+v); }, 0);
    show(0);

    U.byId('gloss').innerHTML = [
      ['ED 镜片', '超低色散玻璃。不同颜色的光折射得更一致，减少物体边缘的紫边、绿边。'],
      ['非球面镜片', '表面不是球面的一部分。一片就能修正球面像差和畸变，顶替好几片普通镜片。'],
      ['萤石镜片', '色散极低而且轻，用在超长焦的前组，既修色差又减重。'],
      ['SR 镜片', '短波长折射镜片：专门多折一点蓝光，把最难修的蓝紫色差拉回来。'],
      ['PF 镜片', '相位菲涅尔镜片。利用衍射产生和普通玻璃相反的色散，一片顶好几片，800mm 才能做得又短又轻。'],
      ['镀膜', '纳米结晶、ARNEO、Meso Amorphous 都是减少镜片表面反光的镀膜，对付逆光时的鬼影和眩光。'],
      ['圆形光圈', '叶片边缘做成弧形，收小一两档后光斑仍接近圆形。'],
      ['内变焦 / 内对焦', '变焦或对焦时镜身长度不变，重心稳，密封也更好。']
    ].map(function (g) { return '<div><b>' + g[0] + '</b>' + g[1] + '</div>'; }).join('');
  }

  // =====================================================================
  // 2.2 卡口剖面（等比例）
  // =====================================================================
  function mountInit() {
    var W = 860, H = 340, K = 3.1, cy = 176, p = '';
    function one(m, xS, title) {
      var xM = xS - m.flange * K, r = m.inner / 2 * K, sh = 12 * K, s = '';
      s += U.text((xM + xS) / 2 - 30, 26, title, { fill: C.text, 'font-size': 15, 'font-weight': 700, 'text-anchor': 'middle' });
      // 机身轮廓
      s += U.path('M' + xM + ',' + (cy - r - 30) + ' H' + (xS + 26) + ' V' + (cy + r + 30) + ' H' + xM, { stroke: C.line, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' });
      // 光锥：卡口上下沿 → 传感器中心
      s += U.poly([[xM, cy - r], [xS, cy], [xM, cy + r]], { fill: C.accent, opacity: .16 });
      s += U.line(xM, cy - r, xS, cy, { stroke: C.accent, 'stroke-width': 1.2 }) + U.line(xM, cy + r, xS, cy, { stroke: C.accent, 'stroke-width': 1.2 });
      // 卡口环
      s += U.rect(xM - 9, cy - r - 30, 9, 30, { fill: '#c9ccd1' }) + U.rect(xM - 9, cy + r, 9, 30, { fill: '#c9ccd1' });
      // 后组镜片
      s += U.path('M' + (xM - 14) + ',' + (cy - r + 5) + ' Q' + (xM - 2) + ',' + cy + ' ' + (xM - 14) + ',' + (cy + r - 5) + ' Q' + (xM - 34) + ',' + cy + ' ' + (xM - 14) + ',' + (cy - r + 5) + 'Z',
        { fill: C.glass, stroke: C.glassEdge, 'stroke-width': 1.3 });
      // 传感器（24mm 高）
      s += U.rect(xS, cy - sh, 5, sh * 2, { fill: C.ray3 });
      s += U.text(xS + 12, cy + 4, '传感器', { fill: C.ray3 });
      // 标注
      s += U.dim(xM, xS, cy + r + 58, '法兰距 ' + m.flange + ' mm', C.text);
      s += U.line(xM - 52, cy - r, xM - 52, cy + r, { stroke: C.accent }) + U.line(xM - 57, cy - r, xM - 47, cy - r, { stroke: C.accent }) + U.line(xM - 57, cy + r, xM - 47, cy + r, { stroke: C.accent });
      s += U.text(xM - 60, cy + 4, '内径 ' + m.inner + ' mm', { fill: C.accent, 'text-anchor': 'end', 'font-family': 'Consolas, monospace' });
      return s;
    }
    p += one(LD.MOUNT.F, 330, 'F 卡口 · 1959');
    p += one(LD.MOUNT.Z, 700, 'Z 卡口 · 2018');
    p += U.line(430, 20, 430, H - 20, { stroke: C.faint });
    U.byId('mount-stage').innerHTML = U.svg(W, H, p);
  }

  // =====================================================================
  // 2.3 焦段地图
  // =====================================================================
  function apColor(n) { return n <= 1.2 ? '#ffe100' : n <= 1.8 ? '#ffb347' : n <= 2.8 ? '#ff7e67' : n <= 4 ? '#c792ea' : '#6ec5ff'; }
  var APLEG = [['≤ f/1.2', 1.2], ['f/1.8', 1.8], ['f/2.8', 2.8], ['f/4', 4], ['更小', 8]];

  function mapRender() {
    var list = LD.LENSES.slice().sort(function (a, b) { return a.fMin - b.fMin || a.fMax - b.fMax || a.nWide - b.nWide; });
    var RH = 24, top = 54, W = 1100, X0 = 300, X1 = 1066, H = top + list.length * RH + 16, lo = 12, hi = 900, p = '';
    function x(f) { return X0 + Math.log(f / lo) / Math.log(hi / lo) * (X1 - X0); }
    [14, 24, 35, 50, 85, 135, 200, 400, 800].forEach(function (f) {
      p += U.line(x(f), top - 8, x(f), H - 10, { stroke: C.faint });
      p += U.text(x(f), top - 14, f, { 'text-anchor': 'middle', fill: C.muted, 'font-family': 'Consolas, monospace' });
    });
    // 图例
    APLEG.forEach(function (l, i) {
      p += U.circle(X0 + i * 92, 14, 5, { fill: apColor(l[1]) }) + U.text(X0 + i * 92 + 10, 18, l[0], { fill: C.muted, 'font-size': 11.5 });
    });
    p += U.text(X0 + 5 * 92, 18, '虚线 = 内置增距镜', { fill: C.dim, 'font-size': 11.5 });
    list.forEach(function (L, i) {
      var y = top + i * RH + RH / 2, sel = L.id === selected, col = apColor(L.nWide);
      if (sel) p += U.rect(4, y - RH / 2 + 1, W - 8, RH - 2, { rx: 6, fill: 'rgba(255,225,0,.09)', stroke: 'rgba(255,225,0,.5)' });
      p += U.text(X0 - 18, y + 4, L.name.replace('NIKKOR ', ''), { 'text-anchor': 'end', fill: sel ? C.accent : C.text, 'font-size': 12.5, 'font-weight': sel ? 700 : 400 });
      if (L.kind === 'zoom') {
        p += U.rect(x(L.fMin), y - 5, x(L.fMax) - x(L.fMin), 10, { rx: 5, fill: col });
        if (L.nWide !== L.nTele) p += U.rect((x(L.fMin) + x(L.fMax)) / 2, y - 5, (x(L.fMax) - x(L.fMin)) / 2, 10, { rx: 5, fill: apColor(L.nTele) });
      } else {
        p += U.circle(x(L.fMin), y, 6.5, { fill: col });
        if (L.tc) {
          p += U.line(x(L.fMin) + 7, y, x(L.fMin * L.tc), y, { stroke: apColor(L.nWide * L.tc), 'stroke-width': 2, 'stroke-dasharray': '4 3' });
          p += U.circle(x(L.fMin * L.tc), y, 4, { fill: 'none', stroke: apColor(L.nWide * L.tc), 'stroke-width': 2 });
        }
      }
      p += U.rect(0, y - RH / 2, W, RH, { fill: 'transparent', 'data-id': L.id, style: 'cursor:pointer' });
    });
    var st = U.byId('map-stage');
    st.style.overflowX = 'auto';
    st.innerHTML = U.svg(W, H, p, ' style="min-width:760px"');
  }

  // =====================================================================
  // 2.4 镜头图鉴
  // =====================================================================
  var FILTERS = [
    ['all', '全部', function () { return true; }],
    ['prime', '定焦', function (L) { return L.kind === 'prime'; }],
    ['zoom', '变焦', function (L) { return L.kind === 'zoom'; }],
    ['wide', '广角 ≤35mm', function (L) { return L.fMin <= 35; }],
    ['std', '标准 50mm', function (L) { return L.fMin <= 60 && L.fMax >= 40; }],
    ['port', '人像 85–135mm', function (L) { return L.fMin <= 135 && L.fMax >= 85; }],
    ['tele', '长焦 ≥200mm', function (L) { return L.fMax >= 200; }],
    ['fast', '大光圈 ≤f/1.8', function (L) { return L.nWide <= 1.8; }]
  ];
  var curFilter = 'all';
  var FIG_K = 0.6; // px / mm

  /** 等比例镜身侧面轮廓：左边是卡口，右边是前镜片 */
  function silhouette(L) {
    var len = L.len * FIG_K, R = L.dia / 2 * FIG_K, rr = Math.min(L.dia, 68) / 2 * FIG_K, pad = 14;
    var W = len + pad * 2 + 10, H = Math.max(2 * R, 40) + 16, cy = H / 2, x0 = pad + 10, x1 = x0 + len, p = '';
    var taper = L.dia > 82, xa = x0 + len * (taper ? 0.32 : 0.1), xb = x0 + len * (taper ? 0.6 : 0.16);
    if (L.len < 40) { xa = x0 + len * 0.3; xb = x0 + len * 0.45; }
    p += '<defs><linearGradient id="bar-' + L.id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4f59"/><stop offset=".35" stop-color="#2a2d33"/><stop offset="1" stop-color="#121316"/></linearGradient></defs>';
    // 卡口
    p += U.rect(x0 - 8, cy - 55 / 2 * FIG_K, 8, 55 * FIG_K, { fill: '#b9bdc4' });
    // 镜身
    p += U.path('M' + x0 + ',' + (cy - rr) + ' L' + U.r1(xa) + ',' + U.r1(cy - rr) + ' L' + U.r1(xb) + ',' + U.r1(cy - R) + ' L' + U.r1(x1) + ',' + U.r1(cy - R) +
      ' L' + U.r1(x1) + ',' + U.r1(cy + R) + ' L' + U.r1(xb) + ',' + U.r1(cy + R) + ' L' + U.r1(xa) + ',' + U.r1(cy + rr) + ' L' + x0 + ',' + (cy + rr) + 'Z',
      { fill: 'url(#bar-' + L.id + ')', stroke: '#5a606b', 'stroke-width': 1, 'stroke-linejoin': 'round' });
    // 对焦 / 变焦环（防滑纹）
    function ring(a, b) {
      var s = '', xs = x0 + len * a, xe = x0 + len * b, hh = xs >= xb ? R : rr;
      for (var xx = xs; xx <= xe; xx += 3) s += U.line(xx, cy - hh + 1, xx, cy + hh - 1, { stroke: '#6b7280', 'stroke-width': 1, opacity: .55 });
      return s;
    }
    if (L.len >= 40) {
      if (L.kind === 'zoom') p += ring(0.64, 0.8) + ring(taper ? 0.14 : 0.3, taper ? 0.26 : 0.46);
      else p += ring(taper ? 0.66 : 0.4, taper ? 0.84 : 0.72);
    }
    // 前镜片
    p += U.path('M' + U.r1(x1) + ',' + U.r1(cy - R * .82) + ' Q' + U.r1(x1 + R * .22) + ',' + cy + ' ' + U.r1(x1) + ',' + U.r1(cy + R * .82), { stroke: C.ray, 'stroke-width': 2, fill: C.glass });
    p += U.line(x1 - 3, cy - R, x1 - 3, cy + R, { stroke: C.accent, 'stroke-width': 1.5, opacity: .8 });
    return '<svg viewBox="0 0 ' + U.r1(W) + ' ' + U.r1(H) + '" width="' + U.r1(W) + '" height="' + U.r1(H) + '" xmlns="http://www.w3.org/2000/svg">' + p + '</svg>';
  }

  function rng(a, b, f) { return a === b ? f(a) : f(a) + '–' + f(b); }
  function n1(x) { return O.fmtNum(x, 1); }

  function card(L) {
    var sen = O.SENSORS[L.format], dg = O.diag(sen);
    var tags = [L.kind === 'zoom' ? '变焦' : '定焦', L.format];
    if (/ S( |$)/.test(L.name)) tags.push('S 型');
    if (L.vr) tags.push('VR 防抖');
    if (L.macro) tags.push('微距 1:1');
    if (L.tc) tags.push('内置 ' + L.tc + '× 增距镜');
    if (!L.af) tags.push('手动对焦');
    var rows = [
      ['焦距', rng(L.fMin, L.fMax, function (v) { return v; }) + 'mm'],
      ['最大光圈', 'f/' + rng(L.nWide, L.nTele, function (v) { return v; })],
      ['镜片结构', L.elements + ' 片 ' + L.groups + ' 组'],
      ['光圈叶片', L.blades + ' 片'],
      ['最近对焦', L.mfd + ' m'],
      ['最大放大', O.fmtNum(L.mag, 2) + '×'],
      ['滤镜口径', L.filter ? L.filter + 'mm' + (L.filterNote ? '*' : '') : '后插 46mm'],
      ['重量', L.weight + ' g' + (L.weightNote ? '*' : '')]
    ];
    var calc = [
      ['对角视角', L.fMin === L.fMax ? O.fmtAngle(O.aov(L.fMin, dg)) : O.fmtAngle(O.aov(L.fMin, dg)) + '–' + O.fmtAngle(O.aov(L.fMax, dg))],
      ['入瞳直径', rng(L.fMin / L.nWide, L.fMax / L.nTele, n1) + 'mm']
    ];
    return '<article class="card' + (L.id === selected ? ' sel' : '') + '" data-id="' + L.id + '">' +
      '<div class="card-fig"><span class="yr">' + L.year + '</span>' + silhouette(L) + '<span class="scale">⌀' + L.dia + ' × ' + L.len + ' mm</span></div>' +
      '<div class="card-body"><h4>' + U.esc(L.zh) + '<small>' + U.esc(L.name) + '</small></h4>' +
      '<div class="tags">' + tags.map(function (t, i) { return '<span class="tag' + (i > 1 ? ' y' : '') + '">' + t + '</span>'; }).join('') + '</div>' +
      '<dl class="spec">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') +
      calc.map(function (r) { return '<div class="calc"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' +
      (L.filterNote || L.weightNote ? '<p class="fn">* ' + (L.filterNote ? '滤镜' + L.filterNote : '重量' + L.weightNote) + '</p>' : '') +
      '<p class="note">' + U.esc(L.note) + '</p>' +
      '<button type="button" class="btn" data-go="' + L.id + '">放进取景器 →</button></div></article>';
  }

  function cardsRender() {
    var fn = FILTERS.filter(function (f) { return f[0] === curFilter; })[0][2];
    U.byId('cards').innerHTML = LD.LENSES.filter(fn).map(card).join('');
  }

  function select(id, src) {
    if (!LD.byId(id)) return;
    selected = id; mapRender();
    U.$$('#cards .card').forEach(function (c) { c.classList.toggle('sel', c.getAttribute('data-id') === id); });
    if (src !== 'vf') U.bus.emit('lens', { id: id, src: 'nikon' });
  }

  // =====================================================================
  // 板块四：怎么选
  // =====================================================================
  var PICKS = [
    { t: '风光 · 建筑', rng: '14–35mm · f/8–f/11', p: '要把大场面装进来，所以用广角；要前后都清楚，所以收小光圈，对焦在超焦距附近。', ex: ['z1424', 'z20f18'], preset: 'landscape' },
    { t: '人文 · 街拍', rng: '26–50mm · f/2–f/8', p: '视角接近人眼，镜头小、不引人注意。', ex: ['z26f28', 'z35f18'], preset: 'street' },
    { t: '人像', rng: '50–135mm · f/1.2–f/2.8', p: '站远一点，五官比例自然；大光圈把背景虚掉，人就突出了。', ex: ['z85f18', 'z135plena', 'z50f12'], preset: 'portrait' },
    { t: '活动 · 婚礼', rng: '24–200mm · f/2.8', p: '来不及换镜头。两支恒定 f/2.8 的变焦覆盖全程，室内也有足够的快门速度。', ex: ['z2470ii', 'z70200'], preset: 'event' },
    { t: '体育 · 野生动物', rng: '200–600mm · f/2.8–f/6.3', p: '靠不近，只能靠焦距；主体在动，要高速快门，光圈越大越好。', ex: ['z400f28', 'z180600', 'z100400'], preset: 'sport' },
    { t: '打鸟 · 拍月亮', rng: '600–840mm', p: '视角只有 2°–4°。焦距够长，小东西才占得满画面。', ex: ['z600f4', 'z800f63'], preset: 'moon' },
    { t: '微距', rng: '105mm · f/8–f/16', p: '1:1 放大时景深只有一两毫米，要收小光圈才够用。', ex: ['zmc105'], preset: null },
    { t: '星空', rng: '14–24mm · f/1.8–f/2.8', p: '星光极弱，曝光又不能太长（星星会拖线），只能靠大光圈；广角才装得下银河。', ex: ['z20f18', 'z1424'], preset: 'astro' },
    { t: '旅行一支走', rng: '24–120mm / 28–400mm', p: '用光圈换焦段：白天够用，天黑了要靠高 ISO 和防抖。', ex: ['z24120', 'z28400'], preset: 'travel' }
  ];

  function pickInit() {
    U.byId('pick').innerHTML = PICKS.map(function (k, i) {
      return '<div class="pick-card"><h4>' + k.t + '</h4><div class="rng">' + k.rng + '</div><p>' + k.p + '</p>' +
        '<div class="ex"><span>例：</span>' + k.ex.map(function (id) { return U.esc(LD.byId(id).name.replace('NIKKOR ', '')); }).join('<span> · </span>') + '</div>' +
        '<button type="button" class="btn ghost" data-i="' + i + '">' + (k.preset ? '在取景器里看效果' : '看 1:1 成像光路') + '</button></div>';
    }).join('');
    U.byId('pick').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]'); if (!b) return;
      var k = PICKS[+b.getAttribute('data-i')];
      if (k.preset) { window.Viewfinder.preset(k.preset); U.byId('viewfinder').scrollIntoView(); }
      else { U.$('#img-presets [data-u="2f"]').click(); U.byId('p-imaging').scrollIntoView(); }
    });
  }

  function init() {
    decoderInit(); mountInit(); mapRender();
    U.chipGroup('card-filters', FILTERS.map(function (f) { return { v: f[0], label: f[1] }; }), function (v) { curFilter = v; cardsRender(); }, 'all');
    cardsRender(); pickInit();
    U.byId('map-stage').addEventListener('click', function (e) {
      var id = e.target.getAttribute && e.target.getAttribute('data-id'); if (id) select(id);
    });
    U.byId('cards').addEventListener('click', function (e) {
      var go = e.target.closest('[data-go]'), cardEl = e.target.closest('.card');
      if (go) { select(go.getAttribute('data-go')); U.byId('viewfinder').scrollIntoView(); }
      else if (cardEl) select(cardEl.getAttribute('data-id'));
    });
    U.bus.on('lens', function (ev) { if (ev.src === 'vf') select(ev.id, 'vf'); });
  }

  window.NikonSection = { init: init, select: select, silhouette: silhouette, selected: function () { return selected; } };
})();
