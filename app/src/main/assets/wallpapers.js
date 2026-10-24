/* Procedural wallpapers: drawn with code, so no image files and no big downloads.
   Each wallpaper builds a still "base" picture once, then adds a light animated
   layer (rain, beams, dust...) on top at ~30 fps. Turn animation off for a still image. */
(function () {
  'use strict';

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function vgrad(ctx, y0, y1, stops) {
    var g = ctx.createLinearGradient(0, y0, 0, y1);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }

  function stars(ctx, w, h, r, count, maxY) {
    for (var i = 0; i < count; i++) {
      var x = r() * w, y = r() * maxY, a = 0.25 + r() * 0.6, s = r() < 0.12 ? 2 : 1;
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
      ctx.fillRect(x, y, s, s);
    }
  }

  /* A row of buildings. Returns nothing, paints into ctx. */
  function skyline(ctx, r, w, baseY, o) {
    var x = -10;
    while (x < w) {
      var bw = o.minW + r() * (o.maxW - o.minW);
      var bh = o.minH + r() * (o.maxH - o.minH);
      var top = baseY - bh;
      ctx.fillStyle = o.fill;
      ctx.fillRect(x, top, bw, bh + 2);
      if (o.edge && r() < o.edgeChance) {
        ctx.fillStyle = o.edge[Math.floor(r() * o.edge.length)];
        ctx.fillRect(x, top, bw, 1.5);
      }
      if (o.windows) {
        for (var wy = top + 6; wy < baseY - 4; wy += 7) {
          for (var wx = x + 4; wx < x + bw - 4; wx += 6) {
            if (r() < o.winDensity) {
              ctx.fillStyle = o.windows[Math.floor(r() * o.windows.length)];
              ctx.fillRect(wx, wy, 2.5, 3.5);
            }
          }
        }
      }
      x += bw + o.gap * r();
    }
  }

  /* Mirror the lower part of the picture under the horizon, like a wet street. */
  function reflect(ctx, c, w, h, horizonY, alpha) {
    var hh = h - horizonY;
    ctx.save();
    ctx.translate(0, 2 * horizonY);
    ctx.scale(1, -1);
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, 0, horizonY - hh, w, hh, 0, horizonY - hh, w, hh);
    ctx.restore();
  }

  function rain(count, w, h, horizonY, color) {
    var drops = [], r = rng(7), i;
    for (i = 0; i < count; i++) {
      drops.push({ x: r() * (w + 60), y: r() * h, l: 8 + r() * 14, v: 380 + r() * 360 });
    }
    var ripples = [];
    return function (ctx, t, dt) {
      var i, d;
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (i = 0; i < drops.length; i++) {
        d = drops[i];
        d.y += d.v * dt;
        d.x -= d.v * dt * 0.22;
        if (d.y > h) {
          if (d.y - h < 40 && Math.random() < 0.08 && ripples.length < 14) {
            ripples.push({ x: d.x, y: horizonY + 12 + Math.random() * (h - horizonY - 16), a: 0.5, s: 1 });
          }
          d.y = -d.l; d.x = Math.random() * (w + 60);
        }
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.l * 0.22, d.y - d.l);
      }
      ctx.stroke();
      for (i = ripples.length - 1; i >= 0; i--) {
        var p = ripples[i];
        p.s += dt * 26; p.a -= dt * 0.9;
        if (p.a <= 0) { ripples.splice(i, 1); continue; }
        ctx.strokeStyle = 'rgba(160,210,255,' + p.a.toFixed(2) + ')';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.s, p.s * 0.28, 0, 0, 6.2832);
        ctx.stroke();
      }
    };
  }

  /* ---------------------------------------------------------------- Neon Downtown */
  function neon(w, h) {
    var c = canvas(w, h), ctx = c.getContext('2d'), r = rng(11), hy = Math.round(h * 0.80);
    ctx.fillStyle = vgrad(ctx, 0, hy, [[0, '#08042e'], [0.45, '#241072'], [0.8, '#8a1fa6'], [1, '#ff3fa4']]);
    ctx.fillRect(0, 0, w, hy);
    stars(ctx, w, h, r, 90, hy * 0.55);
    var glow = ctx.createRadialGradient(w * 0.5, hy, 10, w * 0.5, hy, w * 0.55);
    glow.addColorStop(0, 'rgba(255,90,200,0.55)'); glow.addColorStop(1, 'rgba(255,90,200,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, hy);
    skyline(ctx, r, w, hy, { minW: 22, maxW: 54, minH: 50, maxH: 190, gap: 6, fill: 'rgba(40,18,110,0.75)', windows: ['rgba(120,200,255,0.5)', 'rgba(255,120,220,0.5)'], winDensity: 0.14 });
    skyline(ctx, r, w, hy, { minW: 26, maxW: 66, minH: 40, maxH: 150, gap: 8, fill: '#170a42', edge: ['#35e8ff', '#ff4fd8'], edgeChance: 0.5, windows: ['#37e6ff', '#ff4fd8', '#ffd36b', '#8a7bff'], winDensity: 0.22 });
    skyline(ctx, r, w, hy, { minW: 40, maxW: 90, minH: 20, maxH: 90, gap: 14, fill: '#0c0529', edge: ['#35e8ff', '#ff4fd8', '#ffd36b'], edgeChance: 0.7, windows: ['#37e6ff', '#ff4fd8', '#ffd36b'], winDensity: 0.18 });
    ctx.fillStyle = '#05021a'; ctx.fillRect(0, hy, w, h - hy);
    reflect(ctx, c, w, h, hy, 0.32);
    ctx.fillStyle = vgrad(ctx, hy, h, [[0, 'rgba(20,10,70,0.15)'], [1, 'rgba(4,2,26,0.85)']]);
    ctx.fillRect(0, hy, w, h - hy);
    var step = rain(Math.round(w * 0.14), w, h, hy, 'rgba(160,195,255,0.33)');
    return { base: c, step: step };
  }

  /* ---------------------------------------------------------------- Golden Hour */
  function golden(w, h) {
    var c = canvas(w, h), ctx = c.getContext('2d'), r = rng(23), hy = Math.round(h * 0.78);
    ctx.fillStyle = vgrad(ctx, 0, hy, [[0, '#2a1458'], [0.4, '#a2406f'], [0.75, '#ff8a4c'], [1, '#ffd08a']]);
    ctx.fillRect(0, 0, w, hy);
    var sun = ctx.createRadialGradient(w * 0.62, hy - 6, 4, w * 0.62, hy - 6, w * 0.38);
    sun.addColorStop(0, 'rgba(255,245,200,1)'); sun.addColorStop(0.08, 'rgba(255,220,150,0.95)');
    sun.addColorStop(0.3, 'rgba(255,150,80,0.45)'); sun.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, w, hy);
    skyline(ctx, r, w, hy, { minW: 22, maxW: 60, minH: 40, maxH: 170, gap: 5, fill: 'rgba(110,42,90,0.7)', windows: ['rgba(255,210,150,0.55)'], winDensity: 0.07 });
    skyline(ctx, r, w, hy, { minW: 28, maxW: 74, minH: 30, maxH: 120, gap: 8, fill: '#3a1740', windows: ['#ffd9a0', '#ffb36b'], winDensity: 0.12 });
    skyline(ctx, r, w, hy, { minW: 40, maxW: 96, minH: 16, maxH: 70, gap: 14, fill: '#1d0b26', windows: ['#ffd9a0', '#ff9c5a'], winDensity: 0.1 });
    ctx.fillStyle = '#1a0a22'; ctx.fillRect(0, hy, w, h - hy);
    reflect(ctx, c, w, h, hy, 0.4);
    ctx.fillStyle = vgrad(ctx, hy, h, [[0, 'rgba(255,150,90,0.18)'], [1, 'rgba(20,6,30,0.8)']]);
    ctx.fillRect(0, hy, w, h - hy);
    var motes = [], i, rr = rng(5);
    for (i = 0; i < 46; i++) motes.push({ x: rr() * w, y: rr() * hy, s: 0.6 + rr() * 1.6, v: 4 + rr() * 10, p: rr() * 6.28 });
    var step = function (ctx2, t, dt) {
      var i, m;
      for (i = 0; i < motes.length; i++) {
        m = motes[i];
        m.y -= m.v * dt; m.x += Math.sin(t * 0.6 + m.p) * 6 * dt;
        if (m.y < -4) { m.y = hy; m.x = Math.random() * w; }
        ctx2.fillStyle = 'rgba(255,225,170,' + (0.25 + 0.3 * Math.sin(t + m.p)).toFixed(2) + ')';
        ctx2.beginPath(); ctx2.arc(m.x, m.y, m.s, 0, 6.2832); ctx2.fill();
      }
    };
    return { base: c, step: step };
  }

  /* ---------------------------------------------------------------- Future City */
  function future(w, h) {
    var c = canvas(w, h), ctx = c.getContext('2d'), r = rng(31), hy = Math.round(h * 0.80), i;
    ctx.fillStyle = vgrad(ctx, 0, hy, [[0, '#050328'], [0.5, '#1d0c5e'], [1, '#6b1fa3']]);
    ctx.fillRect(0, 0, w, hy);
    stars(ctx, w, h, r, 70, hy * 0.5);
    var towers = [];
    var x = 6;
    while (x < w) {
      var tw = 10 + r() * 22, th = 90 + r() * (hy * 0.62);
      towers.push({ x: x, w: tw, h: th, hue: r() < 0.5 ? 190 : (r() < 0.5 ? 285 : 320) });
      x += tw + 6 + r() * 26;
    }
    for (i = 0; i < towers.length; i++) {
      var t = towers[i];
      var g = ctx.createLinearGradient(0, hy - t.h, 0, hy);
      g.addColorStop(0, 'hsla(' + t.hue + ',90%,70%,0.55)'); g.addColorStop(1, 'hsla(' + t.hue + ',80%,30%,0.12)');
      ctx.fillStyle = g; ctx.fillRect(t.x, hy - t.h, t.w, t.h);
      ctx.fillStyle = 'hsla(' + t.hue + ',100%,85%,0.9)'; ctx.fillRect(t.x, hy - t.h, t.w, 1.5);
      for (var wy = hy - t.h + 8; wy < hy - 6; wy += 8) {
        if (r() < 0.5) { ctx.fillStyle = 'hsla(' + t.hue + ',100%,85%,0.45)'; ctx.fillRect(t.x + 3, wy, t.w - 6, 1.5); }
      }
    }
    ctx.fillStyle = '#05021c'; ctx.fillRect(0, hy, w, h - hy);
    reflect(ctx, c, w, h, hy, 0.3);
    ctx.fillStyle = vgrad(ctx, hy, h, [[0, 'rgba(30,10,90,0.1)'], [1, 'rgba(4,2,26,0.85)']]);
    ctx.fillRect(0, hy, w, h - hy);
    var beams = [];
    for (i = 0; i < towers.length; i += 2) beams.push({ x: towers[i].x + towers[i].w / 2, top: hy - towers[i].h, hue: towers[i].hue, p: r() * 6.28, s: 0.5 + r() * 1.2 });
    var dots = [];
    for (i = 0; i < 40; i++) dots.push({ x: r() * w, y: r() * hy, v: 6 + r() * 16 });
    var step = function (ctx2, tt, dt) {
      var i, b, a, g;
      ctx2.globalCompositeOperation = 'lighter';
      for (i = 0; i < beams.length; i++) {
        b = beams[i];
        a = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(tt * b.s + b.p));
        g = ctx2.createLinearGradient(0, 0, 0, b.top + 40);
        g.addColorStop(0, 'hsla(' + b.hue + ',100%,70%,0)');
        g.addColorStop(1, 'hsla(' + b.hue + ',100%,70%,' + a.toFixed(2) + ')');
        ctx2.fillStyle = g; ctx2.fillRect(b.x - 1.2, 0, 2.4, b.top + 40);
      }
      for (i = 0; i < dots.length; i++) {
        var d = dots[i];
        d.y -= d.v * dt; if (d.y < 0) { d.y = hy; d.x = Math.random() * w; }
        ctx2.fillStyle = 'rgba(160,230,255,0.55)'; ctx2.fillRect(d.x, d.y, 1.5, 1.5);
      }
      ctx2.globalCompositeOperation = 'source-over';
    };
    return { base: c, step: step };
  }

  /* ---------------------------------------------------------------- Aurora */
  function aurora(w, h) {
    var c = canvas(w, h), ctx = c.getContext('2d'), r = rng(41);
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#020617'], [0.6, '#0a1a3f'], [1, '#12315c']]);
    ctx.fillRect(0, 0, w, h);
    stars(ctx, w, h, r, 160, h * 0.7);
    ctx.fillStyle = '#030a18';
    ctx.beginPath(); ctx.moveTo(0, h);
    var x, y = h * 0.82;
    for (x = 0; x <= w; x += 16) { y += (r() - 0.5) * 22; y = Math.max(h * 0.7, Math.min(h * 0.92, y)); ctx.lineTo(x, y); }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    var bands = [
      { y: h * 0.30, a: 38, f: 0.010, s: 0.5, c: '60,255,170', hgt: h * 0.34 },
      { y: h * 0.36, a: 30, f: 0.014, s: -0.35, c: '90,160,255', hgt: h * 0.30 },
      { y: h * 0.26, a: 44, f: 0.007, s: 0.28, c: '190,110,255', hgt: h * 0.30 }
    ];
    var step = function (ctx2, t) {
      var i, b, x, yy, g;
      ctx2.globalCompositeOperation = 'lighter';
      for (i = 0; i < bands.length; i++) {
        b = bands[i];
        g = ctx2.createLinearGradient(0, b.y - b.a, 0, b.y + b.hgt);
        g.addColorStop(0, 'rgba(' + b.c + ',0)'); g.addColorStop(0.25, 'rgba(' + b.c + ',0.34)'); g.addColorStop(1, 'rgba(' + b.c + ',0)');
        ctx2.fillStyle = g;
        ctx2.beginPath();
        ctx2.moveTo(0, b.y + b.hgt);
        for (x = 0; x <= w; x += 12) {
          yy = b.y + Math.sin(x * b.f + t * b.s) * b.a + Math.sin(x * b.f * 2.3 - t * b.s * 1.4) * b.a * 0.35;
          ctx2.lineTo(x, yy);
        }
        ctx2.lineTo(w, b.y + b.hgt);
        ctx2.closePath(); ctx2.fill();
      }
      ctx2.globalCompositeOperation = 'source-over';
    };
    return { base: c, step: step };
  }

  /* ---------------------------------------------------------------- Midnight */
  function midnight(w, h) {
    var c = canvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#070a24'], [1, '#1b1450']]);
    ctx.fillRect(0, 0, w, h);
    var blobs = [
      { x: 0.25, y: 0.35, r: 0.42, s: 0.13, p: 0, c: '90,70,255' },
      { x: 0.75, y: 0.60, r: 0.40, s: 0.10, p: 2, c: '255,70,170' },
      { x: 0.55, y: 0.20, r: 0.32, s: 0.16, p: 4, c: '50,200,255' }
    ];
    var step = function (ctx2, t) {
      ctx2.globalCompositeOperation = 'lighter';
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var cx = (b.x + Math.sin(t * b.s + b.p) * 0.12) * w, cy = (b.y + Math.cos(t * b.s * 1.3 + b.p) * 0.10) * h;
        var g = ctx2.createRadialGradient(cx, cy, 0, cx, cy, b.r * w);
        g.addColorStop(0, 'rgba(' + b.c + ',0.32)'); g.addColorStop(1, 'rgba(' + b.c + ',0)');
        ctx2.fillStyle = g; ctx2.fillRect(0, 0, w, h);
      }
      ctx2.globalCompositeOperation = 'source-over';
    };
    return { base: c, step: step };
  }

  var LIST = [
    { id: 'neon', name: 'Neon Downtown', make: neon },
    { id: 'golden', name: 'Golden Hour', make: golden },
    { id: 'future', name: 'Future City', make: future },
    { id: 'aurora', name: 'Aurora', make: aurora },
    { id: 'midnight', name: 'Midnight', make: midnight }
  ];

  function find(id) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i];
    return null;
  }

  var W = 960, H = 540;
  var running = null, raf = 0, last = 0, clock = 0;

  function stop() {
    running = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    var el = now - last;
    if (el < 33) return;           // ~30 fps cap keeps the Fire Stick cool
    last = now;
    var dt = Math.min(el / 1000, 0.1);
    clock += dt;
    var ctx = running.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(running.wall.base, 0, 0);
    running.wall.step(ctx, clock, dt);
  }

  window.Wall = {
    list: function () { return LIST.map(function (w) { return { id: w.id, name: w.name }; }); },
    has: function (id) { return !!find(id); },
    thumb: function (id, target) {
      var def = find(id); if (!def) return;
      var wall = def.make(target.width, target.height);
      var ctx = target.getContext('2d');
      ctx.drawImage(wall.base, 0, 0);
      if (id === 'aurora' || id === 'midnight') wall.step(ctx, 3, 0.03);
    },
    show: function (id, target, animate) {
      stop();
      var def = find(id) || LIST[0];
      target.width = W; target.height = H;
      var wall = def.make(W, H);
      var ctx = target.getContext('2d');
      ctx.drawImage(wall.base, 0, 0);
      if (!animate) { wall.step(ctx, 3, 0.03); return; }
      running = { wall: wall, ctx: ctx };
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    stop: stop
  };
})();
