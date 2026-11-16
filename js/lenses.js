/*
 * lenses.js —— 尼康 Z 卡口镜头示例数据。
 * 参数取自尼康官网产品规格页（核对记录见 data/nikon_specs_verified.json）。
 * 字段：fMin/fMax 焦距(mm)；nWide/nTele 广角端/长焦端最大光圈；nMin 最小光圈（广角端）；
 *       mfd 最近对焦距离(m，取全焦段最近值)；mag 最大放大倍率；filter 滤镜口径(mm)；
 *       dia×len 最大直径×镜身长(mm)；weight 重量(g，带脚架环的变焦取不含脚架环的数值)；tc 内置增距镜倍率。
 */
(function (root) {
  'use strict';

  var LENSES = [
    // ---------- 定焦 ----------
    { id: 'z20f18', name: 'NIKKOR Z 20mm f/1.8 S', zh: '尼克尔 Z 20mm f/1.8 S', kind: 'prime', format: 'FX',
      fMin: 20, fMax: 20, nWide: 1.8, nTele: 1.8, nMin: 16, elements: 14, groups: 11,
      glass: 'ED ×3 · 非球面 ×3 · 纳米结晶镀膜', blades: 9, mfd: 0.2, mag: 0.19, filter: 77,
      dia: 84.5, len: 108.5, weight: 505, vr: false, tc: null, af: true, year: 2020,
      note: '超广角配大光圈，星空常用。f/1.8 的入瞳直径只有 11mm，所以镜头并不大。' },
    { id: 'z26f28', name: 'NIKKOR Z 26mm f/2.8', zh: '尼克尔 Z 26mm f/2.8', kind: 'prime', format: 'FX',
      fMin: 26, fMax: 26, nWide: 2.8, nTele: 2.8, nMin: 16, elements: 8, groups: 6,
      glass: '非球面 ×3', blades: 7, mfd: 0.2, mag: 0.19, filter: 52,
      dia: 70, len: 23.5, weight: 125, vr: false, tc: null, af: true, year: 2023,
      note: '饼干头：镜身只有 23.5mm 厚。焦距短、光圈不大，需要的玻璃就少。' },
    { id: 'z35f18', name: 'NIKKOR Z 35mm f/1.8 S', zh: '尼克尔 Z 35mm f/1.8 S', kind: 'prime', format: 'FX',
      fMin: 35, fMax: 35, nWide: 1.8, nTele: 1.8, nMin: 16, elements: 11, groups: 9,
      glass: 'ED ×2 · 非球面 ×3 · 纳米结晶镀膜', blades: 9, mfd: 0.25, mag: 0.19, filter: 62,
      dia: 73, len: 86, weight: 370, vr: false, tc: null, af: true, year: 2018,
      note: '人文纪实的经典视角：能带进环境，又不至于明显变形。' },
    { id: 'z50f18', name: 'NIKKOR Z 50mm f/1.8 S', zh: '尼克尔 Z 50mm f/1.8 S', kind: 'prime', format: 'FX',
      fMin: 50, fMax: 50, nWide: 1.8, nTele: 1.8, nMin: 16, elements: 12, groups: 9,
      glass: 'ED ×2 · 非球面 ×2 · 纳米结晶镀膜', blades: 9, mfd: 0.4, mag: 0.15, filter: 62,
      dia: 76, len: 86.5, weight: 415, vr: false, tc: null, af: true, year: 2018,
      note: '标准镜头：对角视角 47°，画面的远近关系最接近肉眼直视的感觉。' },
    { id: 'z50f12', name: 'NIKKOR Z 50mm f/1.2 S', zh: '尼克尔 Z 50mm f/1.2 S', kind: 'prime', format: 'FX',
      fMin: 50, fMax: 50, nWide: 1.2, nTele: 1.2, nMin: 16, elements: 17, groups: 15,
      glass: 'ED ×2 · 非球面 ×3 · 纳米结晶 / ARNEO 镀膜', blades: 9, mfd: 0.45, mag: 0.15, filter: 82,
      dia: 89.5, len: 150, weight: 1090, vr: false, tc: null, af: true, year: 2020,
      note: '同是 50mm，光圈大一档多：入瞳直径从 28mm 变成 42mm，重量是 f/1.8 版的 2.6 倍。' },
    { id: 'z58noct', name: 'NIKKOR Z 58mm f/0.95 S Noct', zh: '尼克尔 Z 58mm f/0.95 S Noct', kind: 'prime', format: 'FX',
      fMin: 58, fMax: 58, nWide: 0.95, nTele: 0.95, nMin: 16, elements: 17, groups: 10,
      glass: 'ED ×4 · 非球面 ×3 · 纳米结晶 / ARNEO 镀膜', blades: 11, mfd: 0.5, mag: 0.19, filter: 82,
      dia: 102, len: 153, weight: 2000, vr: false, tc: null, af: false, year: 2019,
      note: 'f/0.95：入瞳直径 61mm，比 Z 卡口的内径还大。手动对焦，2 公斤。' },
    { id: 'z85f18', name: 'NIKKOR Z 85mm f/1.8 S', zh: '尼克尔 Z 85mm f/1.8 S', kind: 'prime', format: 'FX',
      fMin: 85, fMax: 85, nWide: 1.8, nTele: 1.8, nMin: 16, elements: 12, groups: 8,
      glass: 'ED ×2 · 纳米结晶镀膜', blades: 9, mfd: 0.8, mag: 0.12, filter: 67,
      dia: 75, len: 99, weight: 470, vr: false, tc: null, af: true, year: 2019,
      note: '人像焦段：拍半身要站到 2–3 米外，五官比例自然，背景也容易虚掉。' },
    { id: 'zmc105', name: 'NIKKOR Z MC 105mm f/2.8 VR S', zh: '尼克尔 Z 微距 105mm f/2.8 VR S', kind: 'prime', format: 'FX',
      fMin: 105, fMax: 105, nWide: 2.8, nTele: 2.8, nMin: 32, elements: 16, groups: 11,
      glass: 'ED ×3 · 非球面 ×1 · 纳米结晶 / ARNEO 镀膜', blades: 9, mfd: 0.29, mag: 1.0, filter: 62,
      dia: 85, len: 140, weight: 630, vr: true, tc: null, af: true, year: 2021, macro: true,
      note: '微距：对焦到最近 0.29m 时放大倍率 1:1，传感器上的像和实物一样大。' },
    { id: 'z135plena', name: 'NIKKOR Z 135mm f/1.8 S Plena', zh: '尼克尔 Z 135mm f/1.8 S Plena', kind: 'prime', format: 'FX',
      fMin: 135, fMax: 135, nWide: 1.8, nTele: 1.8, nMin: 16, elements: 16, groups: 14,
      glass: 'ED ×4 · 非球面 ×1 · SR ×1 · Meso Amorphous / ARNEO 镀膜', blades: 11, mfd: 0.82, mag: 0.2, filter: 82,
      dia: 98, len: 139.5, weight: 995, vr: false, tc: null, af: true, year: 2023,
      note: '为光斑而生：11 片圆形光圈叶片，全开时画面边角的光斑也接近正圆。' },
    { id: 'z400f28', name: 'NIKKOR Z 400mm f/2.8 TC VR S', zh: '尼克尔 Z 400mm f/2.8 TC VR S', kind: 'prime', format: 'FX',
      fMin: 400, fMax: 400, nWide: 2.8, nTele: 2.8, nMin: 22, elements: 25, groups: 19,
      glass: 'ED ×2 · 超级 ED ×1 · 萤石 ×2 · SR ×1 · Meso Amorphous / ARNEO 镀膜', blades: 9, mfd: 2.5, mag: 0.17, filter: null,
      dia: 156, len: 380, weight: 2950, vr: true, tc: 1.4, af: true, year: 2022,
      note: '入瞳直径 143mm——前组镜片这么大，就是 D = f/N 决定的。内置 1.4× 增距镜，一拨变 560mm f/4。' },
    { id: 'z600f4', name: 'NIKKOR Z 600mm f/4 TC VR S', zh: '尼克尔 Z 600mm f/4 TC VR S', kind: 'prime', format: 'FX',
      fMin: 600, fMax: 600, nWide: 4, nTele: 4, nMin: 32, elements: 26, groups: 20,
      glass: 'ED ×3 · 超级 ED ×1 · 萤石 ×2 · SR ×2 · Meso Amorphous / 纳米结晶镀膜', blades: 9, mfd: 4.3, mag: 0.14, filter: null,
      dia: 165, len: 437, weight: 3260, vr: true, tc: 1.4, af: true, year: 2022,
      note: '水平视角只有 3.4°。内置 1.4× 增距镜 → 840mm f/5.6。' },
    { id: 'z800f63', name: 'NIKKOR Z 800mm f/6.3 VR S', zh: '尼克尔 Z 800mm f/6.3 VR S', kind: 'prime', format: 'FX',
      fMin: 800, fMax: 800, nWide: 6.3, nTele: 6.3, nMin: 32, elements: 22, groups: 14,
      glass: 'ED ×3 · SR ×1 · PF ×1 · 纳米结晶镀膜', blades: 9, mfd: 5.0, mag: 0.16, filter: null,
      dia: 140, len: 385, weight: 2385, vr: true, tc: null, af: true, year: 2022,
      note: 'PF（相位菲涅尔）镜片把 800mm 做到 2.4 公斤。f/6.3 的入瞳直径仍有 127mm。' },

    // ---------- 变焦 ----------
    { id: 'z1424', name: 'NIKKOR Z 14-24mm f/2.8 S', zh: '尼克尔 Z 14-24mm f/2.8 S', kind: 'zoom', format: 'FX',
      fMin: 14, fMax: 24, nWide: 2.8, nTele: 2.8, nMin: 22, elements: 16, groups: 11,
      glass: 'ED ×4 · 非球面 ×3 · 纳米结晶 / ARNEO 镀膜', blades: 9, mfd: 0.28, mag: 0.13, filter: 112, filterNote: '装在遮光罩上',
      dia: 88.5, len: 124.5, weight: 650, vr: false, tc: null, af: true, year: 2020,
      note: '「大三元」的广角一支。14mm 对角视角 114°，身边的东西都装得进画面。' },
    { id: 'z2470ii', name: 'NIKKOR Z 24-70mm f/2.8 S II', zh: '尼克尔 Z 24-70mm f/2.8 S II', kind: 'zoom', format: 'FX',
      fMin: 24, fMax: 70, nWide: 2.8, nTele: 2.8, nMin: 22, elements: 14, groups: 10,
      glass: 'ED ×2 · 非球面 ×3 · Meso Amorphous / ARNEO 镀膜', blades: 11, mfd: 0.24, mag: 0.32, filter: 77,
      dia: 84, len: 142, weight: 675, vr: false, tc: null, af: true, year: 2025,
      note: '「大三元」的标准变焦，覆盖从广角到小长焦。内变焦：变焦时镜身不伸缩。' },
    { id: 'z70200', name: 'NIKKOR Z 70-200mm f/2.8 VR S', zh: '尼克尔 Z 70-200mm f/2.8 VR S', kind: 'zoom', format: 'FX',
      fMin: 70, fMax: 200, nWide: 2.8, nTele: 2.8, nMin: 22, elements: 21, groups: 18,
      glass: 'ED ×6 · 非球面 ×2 · 萤石 ×1 · SR ×1 · 纳米结晶 / ARNEO 镀膜', blades: 9, mfd: 0.5, mag: 0.2, filter: 77,
      dia: 89, len: 220, weight: 1360, weightNote: '不含脚架环', vr: true, tc: null, af: true, year: 2020,
      note: '「大三元」的长焦一支。200mm f/2.8 的入瞳直径 71mm，接近 77mm 的滤镜口径。' },
    { id: 'z24120', name: 'NIKKOR Z 24-120mm f/4 S', zh: '尼克尔 Z 24-120mm f/4 S', kind: 'zoom', format: 'FX',
      fMin: 24, fMax: 120, nWide: 4, nTele: 4, nMin: 22, elements: 16, groups: 13,
      glass: 'ED ×3 · 非球面 ED ×1 · 非球面 ×3 · 纳米结晶 / ARNEO 镀膜', blades: 9, mfd: 0.35, mag: 0.39, filter: 77,
      dia: 84, len: 118, weight: 630, vr: false, tc: null, af: true, year: 2021,
      note: '5 倍变焦、全程 f/4。少一档光圈，换来更长的焦段和更轻的重量。' },
    { id: 'z100400', name: 'NIKKOR Z 100-400mm f/4.5-5.6 VR S', zh: '尼克尔 Z 100-400mm f/4.5-5.6 VR S', kind: 'zoom', format: 'FX',
      fMin: 100, fMax: 400, nWide: 4.5, nTele: 5.6, nMin: 32, elements: 25, groups: 20,
      glass: 'ED ×6 · 超级 ED ×2 · 纳米结晶 / ARNEO 镀膜', blades: 9, mfd: 0.75, mag: 0.38, filter: 77,
      dia: 98, len: 222, weight: 1355, weightNote: '不含脚架环', vr: true, tc: null, af: true, year: 2021,
      note: '浮动光圈：变到 400mm 时最大光圈降到 f/5.6，入瞳直径 71mm。' },
    { id: 'z180600', name: 'NIKKOR Z 180-600mm f/5.6-6.3 VR', zh: '尼克尔 Z 180-600mm f/5.6-6.3 VR', kind: 'zoom', format: 'FX',
      fMin: 180, fMax: 600, nWide: 5.6, nTele: 6.3, nMin: 32, elements: 25, groups: 17,
      glass: 'ED ×6 · 非球面 ×1', blades: 9, mfd: 1.3, mag: 0.25, filter: 95,
      dia: 110, len: 315.5, weight: 1955, weightNote: '不含脚架环', vr: true, tc: null, af: true, year: 2023,
      note: '600mm f/6.3 需要约 95mm 的入瞳——滤镜口径正好是 95mm。' },
    { id: 'z28400', name: 'NIKKOR Z 28-400mm f/4-8 VR', zh: '尼克尔 Z 28-400mm f/4-8 VR', kind: 'zoom', format: 'FX',
      fMin: 28, fMax: 400, nWide: 4, nTele: 8, nMin: 22, elements: 21, groups: 15,
      glass: 'ED ×4 · 非球面 ×3', blades: 9, mfd: 0.2, mag: 0.35, filter: 77,
      dia: 84.5, len: 141.5, weight: 725, vr: true, tc: null, af: true, year: 2024,
      note: '14.2 倍变焦。长焦端 f/8，400mm 的入瞳直径只要 50mm，所以整支才 725g。' },
    { id: 'zdx1650', name: 'NIKKOR Z DX 16-50mm f/3.5-6.3 VR', zh: '尼克尔 Z DX 16-50mm f/3.5-6.3 VR', kind: 'zoom', format: 'DX',
      fMin: 16, fMax: 50, nWide: 3.5, nTele: 6.3, nMin: 22, elements: 9, groups: 7,
      glass: 'ED ×1 · 非球面 ×4', blades: 7, mfd: 0.2, mag: 0.2, filter: 46,
      dia: 70, len: 32, weight: 135, vr: true, tc: null, af: true, year: 2019,
      note: 'DX 画幅套机镜头，等效 24–75mm。只需要照亮更小的传感器，镜头就能做小。' }
  ];

  // 卡口与机身（衍射演示、卡口对比用）
  var MOUNT = {
    Z: { name: 'Z 卡口', inner: 55, flange: 16, year: 2018 },
    F: { name: 'F 卡口', inner: 47, flange: 46.5, year: 1959 }
  };

  var BODIES = [
    { id: 'z8', name: 'Z 8', format: 'FX', sw: 35.9, sh: 23.9, pxW: 8256, pxH: 5504, mp: 45.7 },
    { id: 'z6iii', name: 'Z6III', format: 'FX', sw: 35.9, sh: 23.9, pxW: 6048, pxH: 4032, mp: 24.5 },
    { id: 'z50ii', name: 'Z50II', format: 'DX', sw: 23.5, sh: 15.7, pxW: 5568, pxH: 3712, mp: 20.9 }
  ];

  function byId(id) {
    for (var i = 0; i < LENSES.length; i++) if (LENSES[i].id === id) return LENSES[i];
    return null;
  }

  var api = { LENSES: LENSES, MOUNT: MOUNT, BODIES: BODIES, byId: byId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LensData = api;
})(typeof window !== 'undefined' ? window : this);
