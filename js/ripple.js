/* AquaBit LAB — ヒーローの「しずく → 波紋 → ビット」
 *
 * ロゴ（水面に落ちたしずくの波紋から、四角いビットが立ちのぼる）をそのまま動かしている。
 *   - 水面の高さは、しずくごとの「広がる波束」の足し算（解析式・シミュレーションなし）
 *   - 波の山が通った場所は、格子のマス（ビット）が一瞬だけ光る
 *   - しずくが落ちた点からは、ビットの柱が上へ立ちのぼる
 *   - 下へスクロールするほど水面が格子に量子化されていく（Aqua → Bit）
 *
 * WebGL1（GLSL ES 1.00）だけで動く。使えない端末ではCSSの静止画がそのまま残る。
 * prefers-reduced-motion では1枚だけ描いて止める。画面外・裏タブでは描かない。
 */
(() => {
  'use strict';

  const canvas = document.querySelector('[data-ripple]');
  if (!canvas) return;
  const host = canvas.closest('[data-ripple-host]') || canvas.parentElement;
  const params = new URLSearchParams(location.search);
  if (params.get('ripple') === 'off') return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const still = reduce || params.has('still');

  // 最初の表示（文字と静止画）を優先し、水面はページが落ち着いてから始める
  const whenIdle = (fn) => {
    const go = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 250));
    if (document.readyState === 'complete' || params.has('capture')) go();
    else addEventListener('load', go, { once: true });
  };
  whenIdle(init);

  function init() {
  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: params.has('capture'),
      powerPreference: 'low-power'
    });
  } catch (e) { gl = null; }
  if (!gl) return;

  const MAX_DROPS = 8;

  const vert = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const frag = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform float uScale;      // 1 CSS px が何ピクセルか
uniform vec4  uDrop[${MAX_DROPS}]; // xy=中心(px) z=落ちた時刻 w=強さ
uniform vec2  uOrigin;     // ビットが立ちのぼる点(px)
uniform float uQuant;      // 0..1 スクロールによる量子化
uniform vec2  uPointer;    // px（画面外は -1e4）

const float PI = 3.14159265;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// 水底に落ちる光の網目（よく知られた反復式のコースティクス）
float caustic(vec2 p, float t){
  vec2 q = mod(p, 6.2831853) - 250.0;
  vec2 i = q;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++){
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = q + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(q.x / (sin(i.x + tt) / inten), q.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}

// 水面の高さ（px座標）
float height(vec2 p){
  float s = uScale;
  // ゆったりしたうねり（ごく弱く）
  float h = 0.05 * (noise(p / (420.0 * s) + vec2(uTime * 0.035, uTime * 0.02)) - 0.5);
  for (int i = 0; i < ${MAX_DROPS}; i++){
    vec4 d = uDrop[i];
    float age = uTime - d.z;
    if (d.w <= 0.0 || age < 0.0 || age > 10.0) continue;
    float r = length(p - d.xy);
    float x = r - age * 128.0 * s;                    // 波の先頭からの距離
    float w = (26.0 + age * 20.0) * s;                // 広がるほど幅が出る
    float env = exp(-(x * x) / (2.0 * w * w));
    float fade = exp(-age * 0.42) / (1.0 + r / (240.0 * s));
    h += d.w * env * fade * cos(x / (13.0 * s));
  }
  return h;
}

void main(){
  vec2 p = gl_FragCoord.xy;
  float s = uScale;
  float cell = 13.0 * s;
  vec2 ci = floor(p / cell);
  vec2 cc = (ci + 0.5) * cell;

  // スクロールで水面が格子に吸い寄せられる
  vec2 q = mix(p, cc, uQuant);

  float e = 1.5 * s;
  float h  = height(q);
  float hx = height(q + vec2(e, 0.0));
  float hy = height(q + vec2(0.0, e));
  vec3 n = normalize(vec3(-(hx - h) / e * 34.0 * s, -(hy - h) / e * 34.0 * s, 1.0));

  vec2 uv = p / uRes;

  // 深い海の地色：左上ほど暗く、右（しずく側）ほど光が差す
  vec3 abyss = vec3(0.010, 0.050, 0.095);
  vec3 deep  = vec3(0.020, 0.120, 0.190);
  vec3 col = mix(abyss, deep, smoothstep(0.0, 1.2, uv.y * 0.55 + uv.x * 0.55));
  float pool = exp(-pow(length((p - uOrigin) / (uRes.y * 0.62)), 2.0));
  col += vec3(0.02, 0.12, 0.15) * pool;

  // 光：左上から
  vec3 L = normalize(vec3(-0.45, 0.55, 0.70));
  float dif = clamp(dot(n, L), 0.0, 1.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
  float slope = length(n.xy);
  col *= 0.80 + 0.32 * dif;
  col += vec3(0.30, 0.92, 0.94) * spec * (0.25 + 0.6 * pool);
  // 波紋の山を線として立たせる
  col += vec3(0.20, 0.78, 0.82) * (pow(slope, 1.6) * 0.55 + max(h, 0.0) * 0.16);

  // 水底のコースティクス（波で揺らす）
  float caust = caustic(q / (260.0 * s) * 6.2831853 + n.xy * 2.2, uTime * 0.28 + 23.0);
  col += vec3(0.12, 0.55, 0.60) * clamp(caust, 0.0, 1.0) * (0.06 + 0.22 * pool);

  // ── ビット ──────────────────────────────
  vec2 lc = fract(p / cell);
  float edge = 0.16;
  float box = smoothstep(edge, edge + 0.06, lc.x) * smoothstep(1.0 - edge, 1.0 - edge - 0.06, lc.x)
            * smoothstep(edge, edge + 0.06, lc.y) * smoothstep(1.0 - edge, 1.0 - edge - 0.06, lc.y);
  float halo = exp(-dot(lc - 0.5, lc - 0.5) * 7.0);

  // 1) 波の山が通ったマスが光る
  float hc = height(cc);
  float pick = hash(ci);
  float lit = smoothstep(0.14, 0.55, hc) * step(0.62 - uQuant * 0.40, pick);
  // 2) しずくの点から立ちのぼるビットの柱
  float dx = abs(cc.x - uOrigin.x) / cell;
  float above = (cc.y - uOrigin.y) / cell;                    // 上方向に何マスか
  float colSeed = hash(vec2(ci.x, 7.13));
  float speed = 2.6 + colSeed * 2.4;                          // マス/秒
  float row = floor(above - uTime * speed);
  float occ = hash(vec2(ci.x, row));
  float widthFall = exp(-dx * dx / 9.0);
  float heightFall = smoothstep(0.0, 1.5, above) * exp(-above / 16.0);
  float rise = step(0.55, occ) * widthFall * heightFall;
  // 3) カーソルの周りにもうっすら
  float pr = length(cc - uPointer) / (90.0 * s);
  float near = exp(-pr * pr) * step(0.72, pick) * 0.55;

  float bit = clamp(lit + rise + near, 0.0, 1.35);
  vec3 bitCol = mix(vec3(0.24, 0.91, 0.92), vec3(0.85, 1.0, 1.0), step(0.93, pick));
  col += bitCol * (box * 0.95 + halo * 0.28) * bit;

  // 量子化が進むと、うっすら方眼が浮かぶ
  float grid = (1.0 - box) * uQuant * 0.035;
  col += vec3(0.25, 0.8, 0.85) * grid;

  // 周辺減光とディザ
  float vig = smoothstep(1.25, 0.25, length((uv - vec2(0.62, 0.52)) * vec2(1.0, 1.25)));
  col *= 0.72 + 0.28 * vig;
  col += (hash(p + fract(uTime)) - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}`;

  // シェーダーの組み立て。対応ブラウザでは裏で並行して進め、画面を止めない
  const par = gl.getExtension('KHR_parallel_shader_compile');
  const mk = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
  const vs = mk(gl.VERTEX_SHADER, vert);
  const fs = mk(gl.FRAGMENT_SHADER, frag);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  const linked = () => {
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[ripple]', gl.getShaderInfoLog(vs) || '', gl.getShaderInfoLog(fs) || '', gl.getProgramInfoLog(prog) || '');
      return;
    }
    setup();
  };
  if (par) {
    const poll = () => (gl.getProgramParameter(prog, par.COMPLETION_STATUS_KHR) ? linked() : setTimeout(poll, 32));
    poll();
  } else {
    linked();
  }

  function setup() {
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uRes', 'uTime', 'uScale', 'uDrop', 'uOrigin', 'uQuant', 'uPointer'].forEach((k) => {
    U[k] = gl.getUniformLocation(prog, k);
  });

  // ── 状態 ─────────────────────────────────
  const drops = new Float32Array(MAX_DROPS * 4);
  let dropIdx = 0;
  let scale = Math.min(window.devicePixelRatio || 1, innerWidth < 760 ? 1.25 : 1.5);
  if (params.get('q') === 'low') scale = 0.75;
  let cssW = 0, cssH = 0;
  let t0 = performance.now();
  let now = 0;
  let pointer = [-1e4, -1e4];
  let quant = 0;

  // しずくの落ちる点：PCは右寄り、スマホは下寄り（文字と重ならない位置）
  function origin() {
    const narrow = cssW < 760;
    const ox = narrow ? cssW * 0.66 : cssW * 0.73;
    // 下からの距離（GL座標）。スマホは上部の「映像の窓」の中に落とす
    const oy = narrow ? cssH - Math.min(cssH * 0.2, 150 + cssW * 0.12) : cssH * 0.60;
    return [ox * scale, oy * scale];
  }

  function drop(xCss, yCssFromTop, amp) {
    const i = dropIdx * 4;
    drops[i] = xCss * scale;
    drops[i + 1] = (cssH - yCssFromTop) * scale;
    drops[i + 2] = now;
    drops[i + 3] = amp;
    dropIdx = (dropIdx + 1) % MAX_DROPS;
  }
  function dropAtOrigin(amp) {
    const [ox, oy] = origin();
    drop(ox / scale, cssH - oy / scale, amp);
  }

  function resize() {
    const r = host.getBoundingClientRect();
    cssW = Math.max(1, Math.round(r.width));
    cssH = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(cssW * scale);
    canvas.height = Math.round(cssH * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function draw() {
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, now);
    gl.uniform1f(U.uScale, scale);
    gl.uniform4fv(U.uDrop, drops);
    const o = origin();
    gl.uniform2f(U.uOrigin, o[0], o[1]);
    gl.uniform1f(U.uQuant, quant);
    gl.uniform2f(U.uPointer, pointer[0], pointer[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // 1枚目を描いてから静止画と入れ替える（描く前の黒いキャンバスを見せない）
    if (!shown) { shown = true; requestAnimationFrame(() => host.classList.add('is-rippling')); }
  }
  let shown = false;

  resize();

  // 最初の数滴は「少し前に落ちた」ことにして、最初の画面から波紋が見えるようにする
  function seedDrop(xCss, yCss, ago, amp) {
    now = -ago;
    drop(xCss, yCss, amp);
    now = 0;
  }
  {
    const [ox, oy] = origin();
    seedDrop(ox / scale, cssH - oy / scale, 1.8, 1.0);
    if (cssW < 760) {
      seedDrop(cssW * 0.22, Math.min(cssH * 0.12, 110), 3.2, 0.5);
    } else {
      seedDrop(cssW * 0.52, cssH * 0.72, 3.6, 0.55);
      seedDrop(cssW * 0.90, cssH * 0.18, 2.7, 0.5);
    }
  }

  if (still) {
    now = 0.15;
    draw();
    addEventListener('resize', () => { resize(); draw(); }, { passive: true });
    return;
  }

  // ── 操作 ─────────────────────────────────
  let lastPokeT = 0, lastPokeX = 0, lastPokeY = 0;
  host.addEventListener('pointermove', (ev) => {
    const r = host.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    pointer = [x * scale, (cssH - y) * scale];
    const moved = Math.hypot(x - lastPokeX, y - lastPokeY);
    if (ev.pointerType === 'mouse' && now - lastPokeT > 0.16 && moved > 46) {
      drop(x, y, 0.28);
      lastPokeT = now; lastPokeX = x; lastPokeY = y;
    }
  }, { passive: true });
  host.addEventListener('pointerleave', () => { pointer = [-1e4, -1e4]; }, { passive: true });
  host.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('a,button,input,select,textarea')) return;
    const r = host.getBoundingClientRect();
    drop(ev.clientX - r.left, ev.clientY - r.top, 0.9);
  }, { passive: true });

  // ── ループ ───────────────────────────────
  let visible = true, running = false, raf = 0;
  let nextDrop = 2.2, nextSmall = 1.1;
  let frames = 0, acc = 0, lastT = performance.now();

  function loop(ts) {
    raf = 0;
    if (!visible || document.hidden) { running = false; return; }
    const dt = Math.min(0.05, (ts - lastT) / 1000);
    lastT = ts;
    now = (ts - t0) / 1000;

    if (now > nextDrop) { dropAtOrigin(1.0); nextDrop = now + 3.0 + Math.random() * 1.4; }
    if (now > nextSmall) {
      drop(cssW * (0.15 + Math.random() * 0.8), cssH * (0.15 + Math.random() * 0.8), 0.32 + Math.random() * 0.2);
      nextSmall = now + 1.6 + Math.random() * 1.8;
    }

    const r = host.getBoundingClientRect();
    const prog = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
    const target = prog <= 0.04 ? 0 : Math.min(1, (prog - 0.04) / 0.7);
    quant += (target * target * (3 - 2 * target) - quant) * Math.min(1, dt * 6);

    draw();

    // 重い端末では解像度を下げる
    frames++; acc += dt;
    if (frames === 45) {
      const avg = acc / frames;
      if (avg > 0.026 && scale > 0.6) { scale = Math.max(0.6, scale * 0.8); resize(); }
      frames = 0; acc = 0;
    }
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running) return;
    running = true;
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }

  new IntersectionObserver((ents) => {
    visible = ents[0].isIntersecting;
    if (visible) start();
  }, { rootMargin: '80px' }).observe(host);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) start(); });

  let rsz = 0;
  addEventListener('resize', () => {
    clearTimeout(rsz);
    rsz = setTimeout(() => { resize(); if (!running) draw(); }, 120);
  }, { passive: true });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    running = false;
    host.classList.remove('is-rippling');
  });

  start();
  } // setup
  } // init
})();
