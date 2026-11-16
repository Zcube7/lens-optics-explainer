/*
 * vf-scene.js —— 虚拟取景器的「世界」：每样东西的画法（SVG）、真实尺寸（米）和位置。
 * 坐标：X 向右，Y 向上（地面 Y=0），Z 向前。主体站在 Z=0，相机在 Z=−拍摄距离。
 */
(function () {
  'use strict';

  function wrap(w, h, inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%" preserveAspectRatio="none">' + inner + '</svg>';
  }
  var seed = 7;
  function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }

  var ART = {
    // 人物：64 × 170（1 单位 = 1 cm）
    person: function () {
      var skin = '#f1c9a3', hair = '#2b1d15', coat = '#d9a520', coatD = '#b98816';
      return wrap(64, 170,
        '<rect x="17" y="162" width="13" height="8" rx="3" fill="#18181c"/><rect x="34" y="162" width="13" height="8" rx="3" fill="#18181c"/>' +
        '<rect x="19.5" y="92" width="10.5" height="72" fill="#26314c"/><rect x="34" y="92" width="10.5" height="72" fill="#222c45"/>' +
        '<path d="M14,42 Q7.5,48 8.5,62 L10.5,92 Q13,97 16,92 L18.5,52Z" fill="' + coatD + '"/>' +
        '<path d="M50,42 Q56.5,48 55.5,62 L53.5,92 Q51,97 48,92 L45.5,52Z" fill="' + coatD + '"/>' +
        '<circle cx="13.2" cy="95.5" r="3.3" fill="' + skin + '"/><circle cx="50.8" cy="95.5" r="3.3" fill="' + skin + '"/>' +
        '<path d="M14,41 Q32,30 50,41 L52,97 Q32,103 12,97Z" fill="' + coat + '"/>' +
        '<path d="M32,37 L32,100" stroke="#8f6a0c" stroke-width=".8"/><path d="M17,74 h9 M38,74 h9" stroke="#8f6a0c" stroke-width=".8"/>' +
        '<circle cx="32" cy="48" r="1" fill="#8f6a0c"/><circle cx="32" cy="60" r="1" fill="#8f6a0c"/><circle cx="32" cy="72" r="1" fill="#8f6a0c"/>' +
        '<path d="M22.4,13 Q19.5,27 23.2,36 L26,36 Q23.6,25 24.4,14Z" fill="' + hair + '"/><path d="M41.6,13 Q44.5,27 40.8,36 L38,36 Q40.4,25 39.6,14Z" fill="' + hair + '"/>' +
        '<rect x="23.6" y="12" width="16.8" height="23" fill="' + hair + '"/><rect x="28.3" y="26" width="7.4" height="10" fill="#e3b88f"/>' +
        '<path d="M21.5,33 Q32,41 42.5,33 L43,38.5 Q32,46.5 21,38.5Z" fill="#b5403a"/><path d="M36,39 L39,52 L43.5,51 L41,38Z" fill="#9c342f"/>' +
        '<ellipse cx="32" cy="17" rx="9.2" ry="11" fill="' + skin + '"/>' +
        '<path d="M22,17 Q20.6,3 32,3 Q43.4,3 42,17 Q40.5,9.4 32,8.8 Q23.5,9.4 22,17Z" fill="' + hair + '"/>' +
        '<path d="M25.8,14.2 L30,13.8 M34,13.8 L38.2,14.2" stroke="' + hair + '" stroke-width=".75" stroke-linecap="round"/>' +
        '<ellipse cx="28" cy="17.4" rx="1.3" ry="1.6" fill="#17120f"/><ellipse cx="36" cy="17.4" rx="1.3" ry="1.6" fill="#17120f"/>' +
        '<circle cx="28.45" cy="16.9" r=".42" fill="#fff"/><circle cx="36.45" cy="16.9" r=".42" fill="#fff"/>' +
        '<path d="M32,18.2 L31.1,21.6 L32.7,21.8" stroke="#c5946f" stroke-width=".5" fill="none" stroke-linecap="round"/>' +
        '<path d="M29,24.1 Q32,26.2 35,24.1" stroke="#a8453c" stroke-width=".85" fill="none" stroke-linecap="round"/>' +
        '<circle cx="25.6" cy="21.4" r="1.9" fill="#f08a7a" opacity=".28"/><circle cx="38.4" cy="21.4" r="1.9" fill="#f08a7a" opacity=".28"/>');
    },
    // 树：100 × 140
    tree: function (o) {
      var g = o.tone === 1 ? ['#5a3c1e', '#7a4a1c', '#935a20', '#b5722a', '#c98a3a'] : ['#173824', '#1c432b', '#1f4a30', '#26593a', '#33724a'];
      var s = '<path d="M45.5,140 L47.5,72 L52.5,72 L54.5,140Z" fill="#33241a"/><path d="M50,96 L62,78 M50,104 L39,88" stroke="#33241a" stroke-width="2.4"/>' +
        '<circle cx="29" cy="62" r="22" fill="' + g[0] + '"/><circle cx="71" cy="62" r="22" fill="' + g[1] + '"/><circle cx="50" cy="50" r="34" fill="' + g[2] + '"/>' +
        '<circle cx="50" cy="27" r="22" fill="' + g[3] + '"/><circle cx="38" cy="36" r="10" fill="' + g[4] + '" opacity=".75"/><circle cx="63" cy="52" r="8" fill="' + g[4] + '" opacity=".5"/>';
      for (var i = 0; i < 26; i++) s += '<circle cx="' + (18 + rnd() * 64).toFixed(1) + '" cy="' + (10 + rnd() * 68).toFixed(1) + '" r="' + (1.4 + rnd() * 2).toFixed(1) + '" fill="' + g[i % 2 ? 4 : 0] + '" opacity=".55"/>';
      return wrap(100, 140, s);
    },
    // 路灯：40 × 450（cm）
    lamp: function (o) {
      return wrap(40, 450, '<defs><radialGradient id="lg' + o.uid + '"><stop offset="0" stop-color="#fff3c4" stop-opacity=".9"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient></defs>' +
        '<rect x="18" y="34" width="4" height="416" fill="#1d2026"/><rect x="13" y="430" width="14" height="20" rx="2" fill="#1d2026"/>' +
        '<circle cx="20" cy="36" r="20" fill="url(#lg' + o.uid + ')"/><rect x="7" y="14" width="26" height="12" rx="4" fill="#2b2f37"/><rect x="11" y="26" width="18" height="18" rx="8" fill="#ffefb0"/>');
    },
    pole: function () { return wrap(10, 100, '<rect x="3" y="0" width="4" height="100" fill="#1d2026"/>'); },
    // 路牌：80 × 130（cm）
    sign: function (o) {
      return wrap(80, 130, '<rect x="37" y="50" width="6" height="80" fill="#3b4049"/>' +
        '<rect x="3" y="5" width="74" height="50" rx="5" fill="#f4f1e6" stroke="#1c1f25" stroke-width="2.6"/>' +
        '<text x="40" y="20" text-anchor="middle" font-size="9" fill="#5b616b" font-family="sans-serif">主体后方</text>' +
        '<text x="40" y="46" text-anchor="middle" font-size="25" font-weight="700" fill="#15171b" font-family="Consolas, monospace">' + o.label + '</text>');
    },
    // 长椅：160 × 90（cm）
    bench: function () {
      return wrap(160, 90, '<rect x="14" y="50" width="7" height="40" fill="#22252b"/><rect x="139" y="50" width="7" height="40" fill="#22252b"/>' +
        '<rect x="4" y="44" width="152" height="8" rx="2" fill="#8a633d"/><rect x="8" y="10" width="144" height="9" rx="2" fill="#7a5735"/><rect x="8" y="25" width="144" height="9" rx="2" fill="#7a5735"/>' +
        '<rect x="12" y="6" width="6" height="42" fill="#22252b"/><rect x="142" y="6" width="6" height="42" fill="#22252b"/>');
    },
    // 楼：按宽高生成窗格（4 单位 = 1 m）
    building: function (o) {
      var w = o.w * 4, h = o.h * 4, s = '<rect width="' + w + '" height="' + h + '" fill="' + o.color + '"/>';
      for (var y = 8; y < h - 10; y += 13.5) for (var x = 6; x < w - 9; x += 12.5) {
        var r = rnd(), lit = r < 0.34;
        s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="6.5" height="7.5" fill="' + (lit ? (r < 0.07 ? '#bfe3ff' : r < 0.2 ? '#ffe7ad' : '#ffcf7a') : '#222a40') + '"/>';
      }
      return wrap(w, h, s);
    },
    hills: function () {
      return wrap(1000, 100, '<path d="M0,100 L0,62 L40,48 L90,66 L150,30 L210,58 L260,44 L330,70 L390,36 L450,16 L520,52 L580,40 L640,64 L700,28 L760,50 L820,34 L880,60 L940,42 L1000,56 L1000,100Z" fill="#2c3152"/>' +
        '<path d="M0,100 L0,82 L70,70 L160,84 L250,66 L340,86 L430,72 L540,88 L650,70 L740,84 L850,68 L930,82 L1000,74 L1000,100Z" fill="#20253f"/>');
    },
    moon: function () {
      return wrap(100, 100, '<defs><radialGradient id="mg" cx="42%" cy="40%"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#e6dfbf"/></radialGradient></defs>' +
        '<circle cx="50" cy="50" r="49" fill="url(#mg)"/>' +
        [[34, 32, 11], [61, 27, 6], [66, 56, 13], [38, 66, 8], [52, 80, 5], [24, 52, 5], [78, 38, 4], [48, 46, 4]].map(function (c) {
          return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + c[2] + '" fill="#cfc8a6" opacity=".55"/>';
        }).join(''));
    },
    // 草丛 + 花：100 × 60
    clump: function (o) {
      var s = '', cols = ['#ff8fa3', '#ffd166', '#f6f3ea'];
      for (var i = 0; i < 13; i++) {
        var x = 8 + i * 7, lean = (rnd() - .5) * 26, top = 6 + rnd() * 26;
        s += '<path d="M' + x + ',60 Q' + (x + lean * .4).toFixed(1) + ',' + (34).toFixed(1) + ' ' + (x + lean).toFixed(1) + ',' + top.toFixed(1) + '" stroke="' + (i % 2 ? '#2f5a36' : '#3f7445') + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
        if (i % 3 === o.v % 3) s += '<circle cx="' + (x + lean).toFixed(1) + '" cy="' + top.toFixed(1) + '" r="4.6" fill="' + cols[(i + o.v) % 3] + '"/><circle cx="' + (x + lean).toFixed(1) + '" cy="' + top.toFixed(1) + '" r="1.6" fill="#b5651d"/>';
      }
      return wrap(100, 60, s);
    }
  };

  // ---------- 物体：k 画法，X/Z 位置(m)，w/h 真实尺寸(m)，y0 底边离地高度 ----------
  var OBJ = [{ k: 'person', X: 0, Z: 0, w: 0.64, h: 1.70 }, { k: 'bench', X: 3.0, Z: 3.4, w: 1.6, h: 0.9 }];
  [2, 5, 10, 20, 40, 80].forEach(function (z) { OBJ.push({ k: 'sign', label: z + ' m', X: 2.0, Z: z, w: 0.8, h: 1.3 }); });
  var LAMP_Z = [4, 16, 34, 60, 100];
  LAMP_Z.forEach(function (z) { OBJ.push({ k: 'lamp', X: -2.5, Z: z, w: 0.4, h: 4.5 }); });
  [[-5.2, 6.5, 6, 0], [4.8, 9, 7, 1], [-6.5, 18, 8, 0], [6.2, 23, 7.5, 0], [-4.8, 31, 7, 1], [7.5, 38, 9, 0], [-9, 50, 10, 0], [10, 62, 9, 1], [-14, 82, 11, 0], [15, 96, 10, 0],
    [-4.5, -9, 6.5, 0], [5, -24, 7, 1], [-5.5, -48, 8, 0], [6, -75, 7.5, 0]].forEach(function (t) {
    OBJ.push({ k: 'tree', X: t[0], Z: t[1], w: t[2] * 100 / 140, h: t[2], tone: t[3] });
  });
  [[-5.6, 7.5, 3.5], [5.6, 7.5, 3.5], [-9.2, 24, 4.5], [9.2, 24, 4.5]].forEach(function (p) { OBJ.push({ k: 'pole', X: p[0], Z: p[1], w: 0.12, h: p[2] }); });
  var BUILD = [];
  (function () {
    var x = -150, cols = ['#161c2e', '#1a2136', '#141a2b', '#1d2439'];
    for (var i = 0; x < 150; i++) {
      var w = 14 + rnd() * 16, h = 14 + rnd() * 34, b = { k: 'building', X: x + w / 2, Z: 150 + rnd() * 40, w: w, h: h, color: cols[i % 4] };
      OBJ.push(b); BUILD.push(b); x += w + 1 + rnd() * 5;
    }
  })();
  OBJ.push({ k: 'hills', X: 0, Z: 3200, w: 9000, h: 520 });
  // 月亮：视直径 0.52°，方位 7°、仰角 9.5°，按无穷远处理
  var MOON = { az: 7, el: 9.5, dia: 0.52 }, MZ = 1e7, R = Math.PI / 180;
  OBJ.push({ k: 'moon', X: MZ * Math.tan(MOON.az * R), Z: MZ, w: 2 * MZ * Math.tan(MOON.dia / 2 * R), h: 2 * MZ * Math.tan(MOON.dia / 2 * R),
    y0: MZ * Math.tan(MOON.el * R) - MZ * Math.tan(MOON.dia / 2 * R), far: true });
  [-1.3, -3.5, -7, -12, -19, -30, -46, -70, -100, 1.5, 6, 13].forEach(function (z, i) {
    OBJ.push({ k: 'clump', X: (i % 2 ? 1 : -1) * (1.75 + (i % 3) * 0.25), Z: z, w: 0.85, h: 0.5, v: i });
    OBJ.push({ k: 'clump', X: (i % 2 ? -1 : 1) * (2.1 + (i % 2) * 0.4), Z: z - 0.8, w: 0.7, h: 0.42, v: i + 1 });
  });

  // ---------- 点光源：X/Y/Z 位置(m)，size 发光体直径(m)，c 颜色 ----------
  var LIGHTS = [], PAL = ['255,214,140', '255,170,120', '255,128,160', '140,210,255', '255,244,210'];
  LAMP_Z.forEach(function (z) { LIGHTS.push({ X: -2.5, Y: 4.15, Z: z - 0.02, size: 0.2, c: '255,236,170' }); });
  function string(z, half, n, yEnd, sag) {
    for (var i = 0; i < n; i++) {
      var u = -1 + 2 * i / (n - 1);
      LIGHTS.push({ X: u * half, Y: yEnd - sag * (1 - u * u), Z: z, size: 0.085, c: PAL[i % 5] });
    }
  }
  string(7.5, 5.6, 15, 3.45, 0.6);
  string(24, 9.2, 19, 4.45, 0.9);
  BUILD.forEach(function (b) {
    for (var i = 0; i < 3; i++) LIGHTS.push({ X: b.X + (rnd() - .5) * b.w * .8, Y: 3 + rnd() * (b.h - 5), Z: b.Z - 0.5, size: 0.9, c: PAL[(i * 2 + (rnd() < .3 ? 3 : 0)) % 5] });
  });
  for (var i = 0; i < 14; i++) LIGHTS.push({ X: -2600 + rnd() * 5200, Y: 20 + rnd() * 170, Z: 3100, size: 5, c: PAL[i % 2 ? 0 : 4] });

  window.VFScene = { ART: ART, OBJ: OBJ, LIGHTS: LIGHTS, MOON: MOON, CAM_H: 1.5, PATH_HALF: 1.5 };
})();
