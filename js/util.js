/* util.js —— DOM / SVG 小工具、对数滑块、跨模块事件。挂在 window.U */
(function (root) {
  'use strict';

  var C = {
    accent: '#ffe100', ray: '#6ec5ff', ray2: '#ff9a6b', ray3: '#9be38a',
    text: '#ebe8e1', muted: '#9aa1ab', dim: '#6b727d', line: '#3a3f49', faint: '#23262c',
    glass: 'rgba(110,197,255,.16)', glassEdge: 'rgba(110,197,255,.7)', bg: '#0a0b0d',
    ok: '#7bd88f', warn: '#ffb04a', bad: '#ff6b6b'
  };

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function byId(id) { return document.getElementById(id); }
  function setText(id, txt) { var e = byId(id); if (e) e.textContent = txt; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  // ---------- SVG 字符串拼装 ----------
  function attrs(o) {
    var out = '';
    for (var k in o) if (o[k] !== undefined && o[k] !== null) out += ' ' + k + '="' + esc(o[k]) + '"';
    return out;
  }
  function tag(name, o, inner) { return '<' + name + attrs(o || {}) + (inner === undefined ? '/>' : '>' + inner + '</' + name + '>'); }
  function line(x1, y1, x2, y2, o) {
    o = o || {}; o.x1 = r1(x1); o.y1 = r1(y1); o.x2 = r1(x2); o.y2 = r1(y2);
    if (!o.stroke) o.stroke = C.line;
    return tag('line', o);
  }
  function text(x, y, str, o) {
    o = o || {}; o.x = r1(x); o.y = r1(y);
    if (!o.fill) o.fill = C.muted;
    if (!o['font-size']) o['font-size'] = 12;
    return tag('text', o, esc(str));
  }
  function circle(cx, cy, r, o) { o = o || {}; o.cx = r1(cx); o.cy = r1(cy); o.r = r1(r); return tag('circle', o); }
  function rect(x, y, w, h, o) { o = o || {}; o.x = r1(x); o.y = r1(y); o.width = r1(w); o.height = r1(h); return tag('rect', o); }
  function path(d, o) { o = o || {}; o.d = d; if (!o.fill) o.fill = 'none'; return tag('path', o); }
  function poly(pts, o) {
    o = o || {};
    o.points = pts.map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ');
    return tag('polygon', o);
  }
  /** 带箭头的线段（箭头画在 (x2,y2) 一端） */
  function arrow(x1, y1, x2, y2, color, width, head) {
    head = head || 9; width = width || 3;
    var a = Math.atan2(y2 - y1, x2 - x1), s = Math.sin(a), c = Math.cos(a);
    var bx = x2 - c * head, by = y2 - s * head;
    return line(x1, y1, bx, by, { stroke: color, 'stroke-width': width, 'stroke-linecap': 'round' }) +
      poly([[x2, y2], [bx - s * head * .55, by + c * head * .55], [bx + s * head * .55, by - c * head * .55]], { fill: color });
  }
  /** 尺寸标注：两端短竖线 + 中间文字 */
  function dim(x1, x2, y, label, color) {
    color = color || C.dim;
    var a = Math.min(x1, x2), b = Math.max(x1, x2);
    return line(a, y, b, y, { stroke: color }) + line(a, y - 5, a, y + 5, { stroke: color }) + line(b, y - 5, b, y + 5, { stroke: color }) +
      text((a + b) / 2, y - 6, label, { fill: color, 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' });
  }
  function svg(w, h, inner, extra) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" role="img"' + (extra || '') + '>' + inner + '</svg>';
  }

  // ---------- 对数滑块：位置 0..1000 ↔ 数值 [min,max] ----------
  function logMap(min, max) {
    var k = Math.log(max / min);
    return {
      toVal: function (pos) { return min * Math.exp(k * pos / 1000); },
      toPos: function (v) { return Math.round(1000 * Math.log(clamp(v, min, max) / min) / k); }
    };
  }

  var NICE_F = [14, 16, 18, 20, 24, 26, 28, 35, 40, 50, 58, 70, 85, 105, 120, 135, 180, 200, 300, 400, 500, 560, 600, 800, 840];
  /** 滑到常用焦距附近时吸附过去，其余取整 */
  function snapFocal(f) {
    for (var i = 0; i < NICE_F.length; i++) if (Math.abs(f / NICE_F[i] - 1) < 0.025) return NICE_F[i];
    return f < 100 ? Math.round(f) : Math.round(f / 5) * 5;
  }

  /** 一组互斥的 chip 按钮。items: [{v, label}]；返回 {set(v)} */
  function chipGroup(container, items, onPick, initial) {
    var el = typeof container === 'string' ? byId(container) : container;
    if (items) {
      el.innerHTML = items.map(function (it) {
        return '<button type="button" class="chip" data-v="' + esc(it.v) + '">' + esc(it.label) + '</button>';
      }).join('');
    }
    var btns = $$('.chip', el);
    function key(b) { return b.getAttribute('data-v') || b.getAttribute('data-s') || b.getAttribute('data-b') || b.getAttribute('data-u'); }
    function set(v) { btns.forEach(function (b) { b.classList.toggle('on', key(b) === String(v)); }); }
    btns.forEach(function (b) { b.addEventListener('click', function () { set(key(b)); onPick(key(b)); }); });
    if (initial !== undefined) set(initial);
    return { set: set };
  }

  // ---------- 事件总线 ----------
  var handlers = {};
  var bus = {
    on: function (evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); },
    emit: function (evt, data) { (handlers[evt] || []).forEach(function (fn) { fn(data); }); }
  };

  root.U = {
    C: C, $: $, $$: $$, byId: byId, setText: setText, esc: esc, r1: r1, clamp: clamp,
    tag: tag, line: line, text: text, circle: circle, rect: rect, path: path, poly: poly, arrow: arrow, dim: dim, svg: svg,
    logMap: logMap, snapFocal: snapFocal, chipGroup: chipGroup, bus: bus
  };
})(window);
