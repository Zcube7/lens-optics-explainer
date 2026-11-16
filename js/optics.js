/*
 * optics.js —— 页面里所有数字的唯一出处。
 * 纯函数、无 DOM 依赖：浏览器里挂到 window.Optics，Node 里 module.exports（给 tests/ 用）。
 * 长度单位一律毫米(mm)，角度输出为度。模型是「薄透镜 + 理想光阑」，
 * 真实镜头的呼吸效应、口径蚀、像差都不在这里。
 */
(function (root) {
  'use strict';

  var SENSORS = {
    FX: { key: 'FX', name: 'FX 全画幅', w: 36, h: 24, coc: 0.030, crop: 1 },
    DX: { key: 'DX', name: 'DX 画幅', w: 23.5, h: 15.7, coc: 0.020, crop: 1.5 }
  };

  // 1/3 档光圈标称值
  var F_STOPS = [0.95, 1, 1.1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6,
    6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22, 25, 29, 32];

  // 1/3 档快门标称值（秒）
  var SHUTTERS = [30, 25, 20, 15, 13, 10, 8, 6, 5, 4, 3, 2.5, 2, 1.6, 1.3, 1, 1 / 1.3, 1 / 1.6, 1 / 2,
    1 / 2.5, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 8, 1 / 10, 1 / 13, 1 / 15, 1 / 20, 1 / 25, 1 / 30, 1 / 40,
    1 / 50, 1 / 60, 1 / 80, 1 / 100, 1 / 125, 1 / 160, 1 / 200, 1 / 250, 1 / 320, 1 / 400, 1 / 500,
    1 / 640, 1 / 800, 1 / 1000, 1 / 1250, 1 / 1600, 1 / 2000, 1 / 2500, 1 / 3200, 1 / 4000, 1 / 5000,
    1 / 6400, 1 / 8000, 1 / 10000, 1 / 12800, 1 / 16000, 1 / 32000];

  var RAD = 180 / Math.PI;

  function diag(sensor) { return Math.sqrt(sensor.w * sensor.w + sensor.h * sensor.h); }

  /** 视角（度）。dim = 传感器在该方向上的尺寸；对焦在无穷远。 */
  function aov(f, dim) { return 2 * Math.atan(dim / (2 * f)) * RAD; }

  function aovAll(f, sensor) {
    return { h: aov(f, sensor.w), v: aov(f, sensor.h), d: aov(f, diag(sensor)) };
  }

  /** 高斯成像公式 1/f = 1/u + 1/v，返回像距 v。u<f 时为负（虚像），u=f 时为 Infinity。 */
  function imageDistance(f, u) {
    if (u === Infinity) return f;
    if (u === f) return Infinity;
    return u * f / (u - f);
  }

  /** 横向放大率 m = v/u = f/(u-f)。负号表示虚像（正立）。 */
  function magnification(f, u) {
    if (u === Infinity) return 0;
    if (u === f) return Infinity;
    return f / (u - f);
  }

  /** 超焦距 H = f²/(N·c) + f */
  function hyperfocal(f, N, c) { return f * f / (N * c) + f; }

  /** 景深。s = 对焦距离（物到镜头）。返回 near / far / total / H。 */
  function dof(f, N, s, c) {
    var H = hyperfocal(f, N, c);
    if (s === Infinity) return { near: H, far: Infinity, total: Infinity, H: H };
    var near = s * (H - f) / (H + s - 2 * f);
    var far = s < H ? s * (H - f) / (H - s) : Infinity;
    return { near: near, far: far, total: far - near, H: H };
  }

  /**
   * 模糊圆直径：镜头对焦在 s，距离 d 处的一个点在传感器上摊成多大的圆。
   * c = (f²/N) · |d − s| / (d · (s − f))
   */
  function blurDisc(f, N, s, d) {
    if (s === Infinity && d === Infinity) return 0;
    if (s === Infinity) return f * f / (N * d);
    if (d === Infinity) return f * f / (N * (s - f));
    return (f * f / N) * Math.abs(d - s) / (d * (s - f));
  }

  /** 入瞳直径 D = f / N */
  function entrancePupil(f, N) { return f / N; }

  /** 从 N1 收到 N2 少了多少档（正数=变暗） */
  function stopsBetween(N1, N2) { return 2 * Math.log(N2 / N1) / Math.LN2; }

  /** 给定场景亮度 EV100、光圈、ISO，求正确曝光的快门时间（秒）。EV = log2(N²/t) */
  function shutterFor(ev100, N, iso) { return N * N / (Math.pow(2, ev100) * iso / 100); }

  /** 艾里斑直径（到第一暗环），毫米。λ 默认 550nm 绿光。 */
  function airyDiameter(N, lambda) { return 2.44 * (lambda || 0.00055) * N; }

  function nearestIn(list, x) {
    var best = list[0], bd = Infinity;
    for (var i = 0; i < list.length; i++) {
      var dd = Math.abs(Math.log(list[i] / x));
      if (dd < bd) { bd = dd; best = list[i]; }
    }
    return best;
  }

  /** 变焦镜头在焦距 f 处的最大光圈：恒定光圈直接返回；浮动光圈按 log(f) 插值后吸附到 1/3 档（近似）。 */
  function maxApertureAt(lens, f) {
    if (lens.nWide === lens.nTele || lens.fMin === lens.fMax) return lens.nWide;
    var t = Math.log(f / lens.fMin) / Math.log(lens.fMax / lens.fMin);
    t = Math.max(0, Math.min(1, t));
    var n = lens.nWide * Math.pow(lens.nTele / lens.nWide, t);
    var snapped = nearestIn(F_STOPS, n);
    return Math.max(lens.nWide, Math.min(lens.nTele, snapped));
  }

  /** 该镜头在焦距 f 处可用的光圈档位列表 */
  function stopsFor(lens, f) {
    var lo = maxApertureAt(lens, f), hi = lens.nMin || 22, out = [];
    if (F_STOPS.indexOf(lo) < 0) out.push(lo);
    for (var i = 0; i < F_STOPS.length; i++) {
      if (F_STOPS[i] >= lo - 1e-9 && F_STOPS[i] <= hi + 1e-9) out.push(F_STOPS[i]);
    }
    return out;
  }

  // ---------- 文本格式化 ----------
  function fmtNum(x, digits) {
    if (!isFinite(x)) return '∞';
    var s = x.toFixed(digits);
    return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s;
  }

  /** 毫米 → 人读的距离 */
  function fmtDist(mm) {
    if (!isFinite(mm)) return '∞';
    var a = Math.abs(mm);
    if (a >= 1e6) return fmtNum(mm / 1e6, 1) + ' km';
    if (a >= 100000) return fmtNum(mm / 1000, 0) + ' m';
    if (a >= 10000) return fmtNum(mm / 1000, 1) + ' m';
    if (a >= 1000) return fmtNum(mm / 1000, 2) + ' m';
    if (a >= 100) return fmtNum(mm / 10, 1) + ' cm';
    if (a >= 10) return fmtNum(mm / 10, 2) + ' cm';
    return fmtNum(mm, 2) + ' mm';
  }

  function fmtShutter(t) {
    if (!isFinite(t)) return '—';
    if (t >= 0.4) return fmtNum(t, t >= 10 ? 0 : 1) + ' s';
    return '1/' + Math.round(1 / t) + ' s';
  }

  function fmtF(N) { return 'f/' + fmtNum(N, N < 10 ? (N < 1 ? 2 : 1) : 0); }

  function fmtAngle(deg) { return fmtNum(deg, deg < 10 ? 2 : 1) + '°'; }

  function fmtFocal(f) { return fmtNum(f, f < 100 ? 1 : 0) + 'mm'; }

  var api = {
    SENSORS: SENSORS, F_STOPS: F_STOPS, SHUTTERS: SHUTTERS,
    diag: diag, aov: aov, aovAll: aovAll, imageDistance: imageDistance, magnification: magnification,
    hyperfocal: hyperfocal, dof: dof, blurDisc: blurDisc, entrancePupil: entrancePupil,
    stopsBetween: stopsBetween, shutterFor: shutterFor, airyDiameter: airyDiameter,
    nearestIn: nearestIn, maxApertureAt: maxApertureAt, stopsFor: stopsFor,
    fmtNum: fmtNum, fmtDist: fmtDist, fmtShutter: fmtShutter, fmtF: fmtF, fmtAngle: fmtAngle, fmtFocal: fmtFocal
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Optics = api;
})(typeof window !== 'undefined' ? window : this);
