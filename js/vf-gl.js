/*
 * vf-gl.js —— 取景器的 WebGL2 渲染器：编译着色器、喂场景数据、逐帧累加采样。
 * 用法：var r = VFGL.create(canvas, VFScene); r.onready = fn; r.set(params);
 * 浏览器不支持 WebGL2 / 浮点帧缓冲，或着色器编译失败时 create 返回 null 或 r.failed = true，
 * viewfinder.js 会继续用原来的 CSS 版场景。
 */
(function () {
  'use strict';
  var TARGET = 320;            // 每次参数变化后累加多少个样本就停

  function create(canvas, S) {
    var SH = window.VFShader; if (!SH) return null;
    var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null;
    var par = gl.getExtension('KHR_parallel_shader_compile');

    var api = { ready: false, failed: false, onready: null, count: 0, passes: 2, scale: 1, info: '' };
    var P = null, dirty = true, raf = 0, acc = null, fbo = null, loc = {}, rloc = {};

    function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    function program(vs, fs) { var p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p); return p; }
    var vs = shader(gl.VERTEX_SHADER, SH.VERT), fsT = shader(gl.FRAGMENT_SHADER, SH.TRACE), fsR = shader(gl.FRAGMENT_SHADER, SH.RESOLVE);
    var progT = program(vs, fsT), progR = program(vs, fsR);

    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // ---------- 路牌文字贴图：2 列 × 3 行，每格 256×160 ----------
    function atlas(signs) {
      var c = document.createElement('canvas'); c.width = 512; c.height = 512; var g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
      signs.forEach(function (o, i) {
        var x = (i % 2) * 256, y = Math.floor(i / 2) * 160;
        g.fillStyle = '#1b1e24'; g.fillRect(x, y, 256, 160);
        g.fillStyle = '#f1eee2'; g.beginPath(); g.roundRect ? g.roundRect(x + 9, y + 9, 238, 142, 14) : g.rect(x + 9, y + 9, 238, 142); g.fill();
        g.fillStyle = '#5b616b'; g.font = '600 26px "Microsoft YaHei", "PingFang SC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('主体后方', x + 128, y + 44);
        g.fillStyle = '#14161a'; g.font = '700 72px Consolas, "SF Mono", monospace';
        g.fillText(o.label, x + 128, y + 102);
      });
      var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // ---------- 把 VFScene 里的东西摊平成 uniform 数组 ----------
    function sceneUniforms() {
      var trees = [], signs = [], bld = [], posts = [], lights = [], cols = [], signObjs = [];
      S.OBJ.forEach(function (o) {
        if (o.k === 'tree' && trees.length < 56) trees.push(o.X, o.Z, o.h, o.tone ? 1 : 0);
        else if (o.k === 'sign' && signs.length < 6) { signs.push(o.Z); signObjs.push(o); }
        else if (o.k === 'building' && bld.length < 56) bld.push(o.X - o.w / 2, o.X + o.w / 2, o.h, o.Z);
        else if (o.k === 'lamp') posts.push(o.X, o.Z, 0.06, 4.05);
        else if (o.k === 'pole') posts.push(o.X, o.Z, 0.045, o.h);
      });
      S.LIGHTS.forEach(function (l) {
        if (l.size > 0.5 || lights.length >= 39 * 4) return;        // 楼上的灯改由窗户自己发光
        var lamp = l.size > 0.15, c = l.c.split(',').map(function (v) { return Math.pow(+v / 255, 2.2); });
        lights.push(l.X, l.Y, l.Z, l.size / 2); var L0 = lamp ? 50 : 20;
        cols.push(c[0] * L0, c[1] * L0, c[2] * L0);
      });
      function pad(a, n) { while (a.length < n) a.push(0); return new Float32Array(a); }
      var nb = bld.length / 4, nl = lights.length / 4;
      for (var i = nl; i < 39; i++) { lights.push(0, -1000, -1000, 0.01); cols.push(0, 0, 0); }
      for (i = trees.length / 4; i < 14; i++) trees.push(0, -1e5, 1, 0);
      for (i = posts.length / 4; i < 9; i++) posts.push(0, -1e5, 0.01, 0);
      gl.useProgram(progT);
      gl.uniform4fv(gl.getUniformLocation(progT, 'uTree'), pad(trees, 56));
      gl.uniform4fv(gl.getUniformLocation(progT, 'uPost'), pad(posts, 36));
      gl.uniform4fv(gl.getUniformLocation(progT, 'uLight'), pad(lights, 156));
      gl.uniform3fv(gl.getUniformLocation(progT, 'uLightCol'), pad(cols, 117));
      gl.uniform4fv(gl.getUniformLocation(progT, 'uBld'), pad(bld, 56));
      gl.uniform1i(gl.getUniformLocation(progT, 'uNB'), Math.min(nb, 14));
      gl.uniform1fv(gl.getUniformLocation(progT, 'uSign'), pad(signs, 6));
      var R = Math.PI / 180, az = S.MOON.az * R, el = S.MOON.el * R;
      gl.uniform3f(gl.getUniformLocation(progT, 'uMoon'), Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      gl.uniform1i(gl.getUniformLocation(progT, 'uAtlas'), 1);
      atlas(signObjs);
      ['uRes', 'uK', 'uCam', 'uRight', 'uUp', 'uFwd', 'uA', 'uInvS', 'uPolyAmt', 'uBlades', 'uSeed'].forEach(function (n) { loc[n] = gl.getUniformLocation(progT, n); });
      ['uAcc', 'uInvCount', 'uSeed', 'uRes'].forEach(function (n) { rloc[n] = gl.getUniformLocation(progR, n); });
    }

    function alloc() {
      if (acc) gl.deleteTexture(acc); if (fbo) gl.deleteFramebuffer(fbo);
      acc = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, acc);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, canvas.width, canvas.height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, acc, 0);
      var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return ok;
    }

    /** 画面的 CSS 尺寸变了：按 dpr（封顶 1.5）和自适应缩放重设画布 */
    function resize(cssW, cssH) {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5) * api.scale;
      var w = Math.max(16, Math.round(cssW * dpr)), h = Math.max(16, Math.round(cssH * dpr));
      if (w === canvas.width && h === canvas.height && acc) return;
      canvas.width = w; canvas.height = h;
      if (!alloc()) { api.failed = true; api.ready = false; }
      dirty = true;
    }

    /** 画 n 个样本并把累加结果显示出来 */
    function step(n) {
      if (!api.ready || !P) return;
      var W = canvas.width, H = canvas.height;
      gl.viewport(0, 0, W, H);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      if (dirty) { gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); api.count = 0; dirty = false; }
      gl.useProgram(progT);
      var k = W / P.cssW;
      gl.uniform2f(loc.uRes, W, H); gl.uniform1f(loc.uK, P.K * k);
      gl.uniform3fv(loc.uCam, P.cam); gl.uniform3fv(loc.uRight, P.right); gl.uniform3fv(loc.uUp, P.up); gl.uniform3fv(loc.uFwd, P.fwd);
      gl.uniform1f(loc.uA, P.A); gl.uniform1f(loc.uInvS, P.invS); gl.uniform1f(loc.uPolyAmt, P.polyAmt); gl.uniform1f(loc.uBlades, P.blades);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (var i = 0; i < n; i++) { gl.uniform1f(loc.uSeed, api.count); gl.drawArrays(gl.TRIANGLES, 0, 3); api.count++; }
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(progR);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, acc);
      gl.uniform1i(rloc.uAcc, 0); gl.uniform1f(rloc.uInvCount, 1 / api.count); gl.uniform1f(rloc.uSeed, api.count % 7); gl.uniform2f(rloc.uRes, W, H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // 正常由 requestAnimationFrame 驱动；页面在后台、rAF 被浏览器停掉时，靠定时器兜底慢慢画
    var tmo = 0;
    function schedule() {
      if (raf || tmo) return;
      raf = requestAnimationFrame(function () { tick(performance.now()); });
      tmo = setTimeout(function () { tick(performance.now()); }, 300);
    }
    /**
     * 量一下这台机器画一个样本要多久，据此定每帧画几个样本、要不要降分辨率。
     * 用 readPixels 等 GPU 真画完再计时——不能看 rAF 的帧间隔，页面在后台时浏览器会把 rAF 降到每秒一两次，
     * 那不是显卡慢。
     */
    var px1 = new Uint8Array(4), calKey = '';
    function timed(n) { var t0 = performance.now(); step(n); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); return performance.now() - t0; }
    function measure() {       // readPixels 自己有二三十毫秒的固定开销，所以画 1 个和画 5 个各量一次、取差值
      timed(1); var a = timed(1), b = timed(5);
      return Math.max((b - a) / 4, 0.05);
    }
    function calibrate() {
      if (api.scale !== 1) { api.scale = 1; resize(P.cssW, P.cssH); }               // 每次都从满分辨率量起，量错了下次能恢复
      var ms = measure();
      if (ms > 24) { api.scale = Math.max(0.5, Math.sqrt(14 / ms)); resize(P.cssW, P.cssH); ms = measure(); }   // 一个样本都画不进一帧：降分辨率
      api.msPerPass = ms; api.passes = Math.max(1, Math.min(8, Math.floor(13 / ms)));
      calKey = P.cssW + 'x' + P.cssH;
    }
    function tick() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (tmo) { clearTimeout(tmo); tmo = 0; }
      if (!api.ready || !P) return;
      if (calKey !== P.cssW + 'x' + P.cssH) calibrate();      // 只在刚就绪、画面尺寸变了、页面从后台回来时量
      step(api.passes);                                      // 参数刚变的那一帧也画满样本数，拖动时噪点少
      if (api.count < TARGET) schedule();
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { calKey = ''; if (api.ready && P) { dirty = true; schedule(); } } });

    /** 参数变化：重新开始累加 */
    function set(params) {
      P = params; resize(P.cssW, P.cssH); dirty = true;
      if (api.ready) schedule();
    }

    // ---------- 等着色器编译完（大着色器在 Windows 上可能要几秒，期间页面继续用 CSS 版场景） ----------
    function finish() {
      if (!gl.getProgramParameter(progT, gl.LINK_STATUS) || !gl.getProgramParameter(progR, gl.LINK_STATUS)) {
        api.failed = true;
        api.info = (gl.getShaderInfoLog(fsT) || '') + (gl.getProgramInfoLog(progT) || '') + (gl.getShaderInfoLog(fsR) || '') + (gl.getProgramInfoLog(progR) || '');
        console.warn('[取景器] WebGL 着色器没编译通过，改用 CSS 场景。', api.info);
        return;
      }
      sceneUniforms();
      api.ready = true;
      if (api.onready) api.onready();
    }
    (function poll() {
      if (par && !(gl.getProgramParameter(progT, par.COMPLETION_STATUS_KHR) && gl.getProgramParameter(progR, par.COMPLETION_STATUS_KHR))) { setTimeout(poll, 60); return; }
      finish();
    })();

    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); api.ready = false; api.failed = true; if (api.onlost) api.onlost(); });

    api.set = set; api.step = step; api.resize = resize; api.gl = gl;
    return api;
  }

  window.VFGL = { create: create, TARGET: TARGET };
})();
