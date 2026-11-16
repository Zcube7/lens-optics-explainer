/* main.js —— 启动各模块、顶栏高亮 */
(function () {
  'use strict';

  // 一个模块出错不拖垮其他模块
  function boot(name, mod) {
    try { mod.init(); } catch (e) { console.error('[init] ' + name + ' 失败', e); }
  }
  boot('imaging', window.DemoImaging);
  boot('fov', window.DemoFov);
  boot('aperture', window.DemoAperture);
  boot('dof', window.DemoDof);
  boot('extra', window.DemoExtra);
  boot('mtf', window.DemoMtf);
  boot('nikon', window.NikonSection);
  boot('viewfinder', window.Viewfinder);

  // 顶栏：滚动到哪个板块就高亮哪个
  var links = U.$$('#nav a');
  var secs = links.map(function (a) { return U.byId(a.getAttribute('href').slice(1)); });
  function onScroll() {
    var y = window.scrollY + 140, cur = -1;
    secs.forEach(function (s, i) { if (s && s.offsetTop <= y) cur = i; });
    links.forEach(function (a, i) { a.classList.toggle('on', i === cur); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
