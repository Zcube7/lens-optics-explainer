/*
 * official.js —— 尼康官网上的产品图、镜片结构图、MTF 图的地址。
 * 图片不在本仓库里：页面直接引用 imaging.nikon.com 的图片地址，版权归尼康所有。
 * 地址规律与各结构图的图例（哪种颜色代表哪种特殊镜片）取自各镜头的官网产品页（2026-11 核对）。
 */
(function (root) {
  'use strict';

  var BASE = 'https://imaging.nikon.com/imaging/lineup/lens/z-mount/';

  // 结构图里的颜色 → 特殊镜片。颜色值是尼康页面图例用的原值。
  var GLASS = {
    ED: { c: '#f2f200', zh: 'ED 镜片', d: '超低色散玻璃。让不同颜色的光折射得更一致，减少物体边缘的紫边、绿边。' },
    SED: { c: '#e70012', zh: '超级 ED 镜片', d: '色散比 ED 更低，性能接近萤石，用在长焦镜头里压色差。' },
    ASP: { c: '#96d0f4', zh: '非球面镜片', d: '表面不是球面的一部分。一片就能修正球面像差和畸变，顶替好几片普通镜片。' },
    ASPED: { c: '#f39801', zh: '非球面 ED 镜片', d: '用 ED 玻璃做成非球面，一片同时修色差和球差。' },
    FL: { c: '#920784', zh: '萤石镜片', d: '色散极低而且轻。放在长焦镜头的前组，既修色差又减重。' },
    SR: { c: '#f19ec2', zh: 'SR 镜片', d: '短波长折射镜片：专门多折一点蓝光，把最难修的蓝紫色差拉回来。' },
    PF: { c: '#6ab92c', zh: 'PF 镜片', d: '相位菲涅尔镜片。利用衍射产生和普通玻璃相反的色散，让超长焦又短又轻。' }
  };

  // 镜头 id → [官网目录名, 结构图图例里出现的特殊镜片]
  var MAP = {
    z20f18: ['z_20mmf18s', ['ED', 'ASP']],
    z26f28: ['z_26mmf28', ['ASP']],
    z35f18: ['z_35mmf18s', ['ED', 'ASP']],
    z50f18: ['z_50mmf18s', ['ED', 'ASP']],
    z50f12: ['z_50mmf12s', ['ED', 'ASP']],
    z58noct: ['z_58mmf095s', ['ED', 'ASP']],
    z85f18: ['z_85mmf18s', ['ED']],
    zmc105: ['z_mc105mmf28_vr_s', ['ED', 'ASP']],
    z135plena: ['z_135mmf18s', ['ED', 'ASP', 'SR']],
    z400f28: ['z_400mmf28_tc_vr_s', ['ED', 'SED', 'FL', 'SR']],
    z600f4: ['z_600mmf4_tc_vr_s', ['ED', 'SED', 'FL', 'SR']],
    z800f63: ['z_800mmf63_vr_s', ['ED', 'SR', 'PF']],
    z1424: ['z_14-24mmf28s', ['ED', 'ASP']],
    z2470ii: ['z_24-70mmf28s2', ['ED', 'ASP']],
    z70200: ['z_70-200mmf28_vr_s', ['ED', 'ASP', 'FL', 'SR']],
    z24120: ['z_24-120mmf4s', ['ED', 'ASPED', 'ASP']],
    z100400: ['z_100-400mmf45-56_vr_s', ['ED', 'SED']],
    z180600: ['z_180-600mmf56-63_vr', ['ED', 'ASP']],
    z28400: ['z_28-400mmf4-8_vr', ['ED', 'ASP']],
    zdx1650: ['z_dx_16-50mmf35-63_vr', ['ED', 'ASP']]
  };

  // 吸附到最近的标称光圈档（2.8 × 1.4 = 3.92 → f/4）
  function stop(n) {
    var S = [2.8, 4, 5.6, 8, 11], best = S[0];
    S.forEach(function (s) { if (Math.abs(Math.log(s / n)) < Math.abs(Math.log(best / n))) best = s; });
    return String(best);
  }

  /**
   * 某支镜头的官方图片信息。lens 是 lenses.js 里的对象。
   * 返回 { page, photo, construction:[{label,url}], mtf:[{label,url}], legend:[{key,c,zh,d}] }
   */
  function info(lens) {
    var m = MAP[lens.id]; if (!m) return null;
    var dir = BASE + m[0] + '/', img = dir + 'img/';
    var cons, mtf;
    if (lens.tc) {            // 内置增距镜：开 / 关各一套
      var f2 = Math.round(lens.fMin * lens.tc), n2 = stop(lens.nWide * lens.tc);
      cons = [{ label: '不用增距镜', url: img + 'lensconstruction_without.jpg' }, { label: '启用增距镜', url: img + 'lensconstruction_with.jpg' }];
      mtf = [{ label: lens.fMin + 'mm f/' + lens.nWide, url: img + 'mtf_without.jpg' }, { label: f2 + 'mm f/' + n2 + '（启用增距镜）', url: img + 'mtf_with.jpg' }];
    } else if (lens.kind === 'zoom') {   // 变焦：广角端 / 长焦端各一张 MTF
      cons = [{ label: '', url: img + 'lensconstruction.jpg' }];
      mtf = [{ label: '广角端 ' + lens.fMin + 'mm f/' + lens.nWide, url: img + 'mtf_wide.jpg' }, { label: '长焦端 ' + lens.fMax + 'mm f/' + lens.nTele, url: img + 'mtf_tele.jpg' }];
    } else {
      cons = [{ label: '', url: img + 'lensconstruction.jpg' }];
      mtf = [{ label: '最大光圈 f/' + lens.nWide, url: img + 'mtf.jpg' }];
    }
    return {
      page: dir, photo: img + 'product_01_01.jpg', construction: cons, mtf: mtf,
      legend: m[1].map(function (k) { return { key: k, c: GLASS[k].c, zh: GLASS[k].zh, d: GLASS[k].d }; })
    };
  }

  var api = { BASE: BASE, GLASS: GLASS, MAP: MAP, info: info };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Official = api;
})(typeof window !== 'undefined' ? window : this);
