// 运行：node --test tests/optics.test.js
// 两件事：① 光学公式对不对（用手算/教科书值核对）；② js/lenses.js 的数字是否与官网核对记录一致。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../js/optics.js');
const LD = require('../js/lenses.js');
const official = require('../data/nikon_specs_verified.json');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} 期望 ${b}±${tol}，实际 ${a}`);

test('成像公式：1/f = 1/u + 1/v', () => {
  near(O.imageDistance(50, 100), 100, 1e-9, 'u=2f 时 v=2f');
  near(O.imageDistance(50, 150), 75, 1e-9);
  assert.equal(O.imageDistance(50, Infinity), 50);
  assert.equal(O.imageDistance(50, 50), Infinity);
  assert.ok(O.imageDistance(50, 30) < 0, 'u<f 为虚像');
  near(O.magnification(50, 100), 1, 1e-9, 'u=2f 时 1:1');
  for (const [f, u] of [[35, 800], [85, 2500], [400, 30000]]) {
    const v = O.imageDistance(f, u);
    near(1 / u + 1 / v, 1 / f, 1e-12, '代回公式');
  }
});

test('视角：与尼康标称值一致（对角线）', () => {
  const d = O.diag(O.SENSORS.FX);
  near(d, 43.27, 0.01);
  // 尼康规格页：20mm 94°、50mm 47°、85mm 28°30′、400mm 6°10′、800mm 3°10′
  near(O.aov(20, d), 94, 0.6); near(O.aov(50, d), 47, 0.5); near(O.aov(85, d), 28.5, 0.3);
  near(O.aov(400, d), 6.17, 0.05); near(O.aov(800, d), 3.17, 0.1);
  near(O.aov(50, O.diag(O.SENSORS.DX)), 31.5, 0.3, 'DX 50mm 31°30′');
  near(O.aov(50, 36), 39.6, 0.05, '水平视角');
});

test('光圈：入瞳、档数、曝光', () => {
  near(O.entrancePupil(400, 2.8), 142.86, 0.01);
  near(O.entrancePupil(58, 0.95), 61.05, 0.01);
  near(O.stopsBetween(2.8, 5.6), 2, 1e-9);
  near(O.stopsBetween(1.4, 2), 1.03, 0.01);
  // 晴天 16 法则：EV15、f/16、ISO100 → 约 1/128 s
  near(O.shutterFor(15, 16, 100), 1 / 128, 1e-6);
  near(O.shutterFor(15, 16, 400), 1 / 512, 1e-6);
  assert.equal(O.fmtShutter(1 / 500), '1/500 s');
  assert.equal(O.fmtShutter(2), '2 s');
});

test('景深与超焦距', () => {
  near(O.hyperfocal(50, 8, 0.03), 10466.7, 0.1);
  near(O.hyperfocal(20, 8, 0.03), 1686.7, 0.1);   // 正文里说的「1.7 米」
  const r = O.dof(85, 1.8, 2500, 0.03);
  near(r.near, 2455.7, 0.5); near(r.far, 2546.0, 0.5); near(r.total, 90.3, 0.5);
  const h = O.hyperfocal(35, 11, 0.03), atH = O.dof(35, 11, h, 0.03);
  assert.equal(atH.far, Infinity);
  near(atH.near, h / 2, 1, '对焦在超焦距时近点 = H/2');
  assert.equal(O.dof(35, 11, Infinity, 0.03).near, h);
});

test('模糊圆：公式自洽', () => {
  near(O.blurDisc(85, 1.8, 2500, 12500), 1.3297, 0.001);
  assert.equal(O.blurDisc(85, 1.8, 2500, 2500), 0);
  // 景深近点/远点上的模糊圆应正好等于容许模糊圆
  const r = O.dof(85, 1.8, 2500, 0.03);
  near(O.blurDisc(85, 1.8, 2500, r.near), 0.03, 1e-6);
  near(O.blurDisc(85, 1.8, 2500, r.far), 0.03, 1e-6);
  // 分解：入瞳 × 放大倍率 × 离焦比例
  const f = 135, N = 1.8, s = 4200, d = 28200;
  near(O.blurDisc(f, N, s, d), (f / N) * (f / (s - f)) * ((d - s) / d), 1e-9);
  // 对焦无穷远、物体在超焦距处 → 模糊圆 ≈ 容许值
  const H = O.hyperfocal(50, 8, 0.03);
  near(O.blurDisc(50, 8, Infinity, H - 50), 0.03, 1e-6);
  near(O.blurDisc(50, 8, 3000, Infinity), 50 * 50 / (8 * 2950), 1e-9);
});

test('衍射：艾里斑', () => {
  near(O.airyDiameter(8) * 1000, 10.74, 0.01);
  near(35.9 / 8256 * 1000, 4.35, 0.01, 'Z 8 像素间距');
});

test('浮动光圈插值与档位', () => {
  const z = LD.byId('z100400');
  assert.equal(O.maxApertureAt(z, 100), 4.5);
  assert.equal(O.maxApertureAt(z, 400), 5.6);
  const mid = O.maxApertureAt(z, 200);
  assert.ok(mid >= 4.5 && mid <= 5.6);
  assert.equal(O.maxApertureAt(LD.byId('z70200'), 135), 2.8);
  const noct = O.stopsFor(LD.byId('z58noct'), 58);
  assert.equal(noct[0], 0.95); assert.equal(noct[noct.length - 1], 16);
  const p = O.stopsFor(LD.byId('z28400'), 400);
  assert.equal(p[0], 8);
});

test('镜头数据与官网核对记录一致', () => {
  assert.equal(LD.LENSES.length, 20);
  assert.equal(official.lenses.length, 20);
  for (const o of official.lenses) {
    const m = LD.LENSES.find(l => l.name === o.name_en);
    assert.ok(m, '缺少 ' + o.name_en);
    assert.equal(o.verified, true, o.name_en);
    assert.equal(m.zh, o.name_zh, o.name_en + ' 中文名');
    assert.equal(m.format, o.format);
    assert.equal(m.fMin, o.focal_min_mm); assert.equal(m.fMax, o.focal_max_mm);
    assert.equal(m.nWide, o.max_aperture_wide); assert.equal(m.nTele, o.max_aperture_tele);
    assert.equal(m.elements, o.elements, o.name_en + ' 片数'); assert.equal(m.groups, o.groups, o.name_en + ' 组数');
    assert.equal(m.blades, o.diaphragm_blades); assert.equal(m.mfd, o.min_focus_m, o.name_en + ' 最近对焦');
    assert.equal(m.mag, o.max_reproduction_ratio, o.name_en + ' 放大倍率');
    assert.equal(m.filter, o.filter_mm, o.name_en + ' 滤镜');
    assert.equal(m.dia, o.diameter_mm); assert.equal(m.len, o.length_mm);
    assert.equal(m.weight, o.weight_without_tripod_collar_g || o.weight_g, o.name_en + ' 重量');
    assert.equal(m.year, o.announced_year, o.name_en + ' 年份');
    assert.equal(m.vr, o.vr); assert.equal(m.af, o.focus === 'AF');
    assert.equal(m.tc ? m.tc + 'x' : null, o.built_in_tc);
    assert.ok(String(o.min_aperture).startsWith('f/' + m.nMin), o.name_en + ' 最小光圈 ' + o.min_aperture);
  }
  assert.equal(LD.MOUNT.Z.inner, official.mount.z_mount.inner_diameter_mm);
  assert.equal(LD.MOUNT.Z.flange, official.mount.z_mount.flange_focal_distance_mm);
  assert.equal(LD.MOUNT.F.inner, official.mount.f_mount.inner_diameter_mm);
  assert.equal(LD.MOUNT.F.flange, official.mount.f_mount.flange_focal_distance_mm);
  official.bodies.forEach((b, i) => {
    assert.equal(LD.BODIES[i].sw, b.sensor_width_mm); assert.equal(LD.BODIES[i].pxW, b.max_image_size_px.width);
    assert.equal(LD.BODIES[i].mp, b.effective_pixels_million);
  });
});

test('卡片备注里写的数字能由公式算出', () => {
  const D = id => { const l = LD.byId(id); return l.fMax / l.nTele; };
  near(D('z20f18'), 11.1, 0.05); near(D('z58noct'), 61.05, 0.05); near(D('z400f28'), 142.9, 0.05);
  near(D('z800f63'), 127, 0.05); near(D('z70200'), 71.4, 0.05); near(D('z100400'), 71.4, 0.05);
  near(D('z180600'), 95.2, 0.05); near(D('z28400'), 50, 0.01);
  near(50 / 1.8, 27.8, 0.05); near(50 / 1.2, 41.7, 0.05);
  near(LD.byId('z50f12').weight / LD.byId('z50f18').weight, 2.63, 0.01);
  near(O.aov(600, 36), 3.44, 0.01, '600mm 水平视角');
  near(O.aov(14, O.diag(O.SENSORS.FX)), 114.2, 0.1);
  near(LD.byId('z28400').fMax / LD.byId('z28400').fMin, 14.29, 0.01);
  near(LD.MOUNT.F.flange - LD.MOUNT.Z.flange, 30.5, 1e-9);
});

test('官方图片：20 支镜头都有地址，结构图图例与规格里的特殊镜片对得上', () => {
  const Off = require('../js/official.js');
  const WORD = { ED: 'ED', SED: '超级 ED', ASP: '非球面', ASPED: '非球面 ED', FL: '萤石', SR: 'SR', PF: 'PF' };
  for (const L of LD.LENSES) {
    const i = Off.info(L);
    assert.ok(i, L.id + ' 缺少官方图片信息');
    for (const u of [i.page, i.photo, ...i.construction.map(c => c.url), ...i.mtf.map(m => m.url)]) {
      assert.ok(u.startsWith('https://imaging.nikon.com/imaging/lineup/lens/z-mount/'), u);
    }
    assert.equal(i.mtf.length, L.tc || L.kind === 'zoom' ? 2 : 1, L.id + ' MTF 张数');
    assert.equal(i.construction.length, L.tc ? 2 : 1, L.id + ' 结构图张数');
    // 两个独立出处互相印证：结构图图例（official.js） vs 规格表里的镜片说明（lenses.js 的 glass）
    for (const g of i.legend) assert.ok(L.glass.includes(WORD[g.key]), L.id + ' 图例有 ' + g.zh + '，但规格里没有');
    for (const k of ['FL', 'SR', 'PF', 'SED', 'ASPED']) {
      assert.equal(L.glass.includes(WORD[k]), i.legend.some(g => g.key === k), L.id + ' ' + WORD[k]);
    }
  }
  assert.equal(Off.info(LD.byId('z400f28')).mtf[1].label, '560mm f/4（启用增距镜）');
  assert.equal(Off.info(LD.byId('z600f4')).mtf[1].label, '840mm f/5.6（启用增距镜）');
});
