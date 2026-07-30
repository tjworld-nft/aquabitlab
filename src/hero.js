/**
 * AquaBit LAB — Digital Ocean hero
 *
 * three.js の WebGPURenderer で「データの海」を描く。
 * WebGPU が使える環境では GPU compute シェーダで粒子を流体的に動かし、
 * 使えない環境では自動的に WebGL2 にフォールバックして
 * 同じ見た目を頂点側の手続き計算で再現する。
 */

import * as THREE from 'three/webgpu';
import {
  Fn, If, vec2, vec3, vec4, float, uniform, instanceIndex, instancedArray,
  hash, mix, smoothstep, sin, exp, pow, length, normalize, min, max, clamp,
  fract, abs, dot, reflect, uv, screenUV, varying, pass, positionLocal,
  cameraPosition, mx_noise_float, mx_fractal_noise_vec3,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

/* ------------------------------------------------------------------ *
 * 海の広がり（ワールド座標）
 * ------------------------------------------------------------------ */
const X_MIN = -62, X_MAX = 62, X_LEN = X_MAX - X_MIN;
const Z_MIN = -96, Z_MAX = 16, Z_LEN = Z_MAX - Z_MIN;

const DEEP = vec3(0.02, 0.16, 0.42);   // 谷の色
const MID = vec3(0.10, 0.55, 0.86);    // 中腹
const CREST = vec3(0.62, 0.98, 1.00);  // 波頭
const VIOLET = vec3(0.36, 0.32, 0.92); // 差し色

/** 波の高さ。頂点でもコンピュートでも同じ式を使う。 */
const waveHeight = /*@__PURE__*/ Fn(([p, t]) => {
  const h = float(0).toVar();
  h.addAssign(sin(p.x.mul(0.19).add(t.mul(0.55))).mul(0.62));
  h.addAssign(sin(p.y.mul(0.15).sub(t.mul(0.42))).mul(0.52));
  h.addAssign(sin(p.x.mul(0.06).add(p.y.mul(0.09)).add(t.mul(0.23))).mul(0.85));
  h.addAssign(mx_noise_float(vec3(p.x.mul(0.09), p.y.mul(0.09), t.mul(0.09))).mul(1.25));
  return h;
}).setLayout({
  name: 'waveHeight',
  type: 'float',
  inputs: [
    { name: 'p', type: 'vec2' },
    { name: 't', type: 'float' },
  ],
});

/* ------------------------------------------------------------------ */

export async function createOceanHero(canvas, options = {}) {
  const quality = options.quality || 'high';
  const reduced = !!options.reducedMotion;

  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: false,
    alpha: false,
    forceWebGL: !!options.forceWebGL,
    powerPreference: 'high-performance',
  });

  let pixelRatio = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1.4);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(
    Math.max(1, canvas.clientWidth || window.innerWidth),
    Math.max(1, canvas.clientHeight || window.innerHeight),
    false,
  );
  renderer.setClearColor(0x03080f, 1);

  await renderer.init();

  const isWebGPU = renderer.backend?.isWebGPUBackend === true;
  const COUNT = quality === 'high' ? 220000 : quality === 'medium' ? 90000 : 36000;
  const MOTES = quality === 'low' ? 400 : 1400;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 260);
  camera.position.set(0, 1.9, 13);

  /* -------------------- uniforms -------------------- */
  const uTime = uniform(0);
  const uDelta = uniform(0.016);
  const uPointer = uniform(new THREE.Vector3(0, 0, -1000));
  const uPointerAmp = uniform(0);
  const uReveal = uniform(0); // 0 → 1 の登場アニメーション

  /* -------------------- 背景（深海のグラデーション） -------------------- */
  scene.backgroundNode = Fn(() => {
    const suv = screenUV;
    const y = suv.y;
    const base = mix(vec3(0.004, 0.020, 0.048), vec3(0.010, 0.055, 0.105), pow(y.oneMinus(), 1.4));
    const dx = suv.x.sub(0.5);
    const dy = y.sub(0.46);
    // 水平線あたりの光
    const glow = exp(dy.mul(dy).mul(-70.0)).mul(exp(dx.mul(dx).mul(-2.2)));
    const beam = exp(dx.mul(dx).mul(-9.0)).mul(smoothstep(0.0, 0.9, y)).mul(0.16);
    const col = base
      .add(vec3(0.05, 0.42, 0.72).mul(glow.mul(0.42)))
      .add(vec3(0.10, 0.22, 0.55).mul(beam));
    return vec4(col, 1.0);
  })();

  /* -------------------- 海面（データの海） -------------------- */
  const SEG = quality === 'high' ? [420, 320] : quality === 'medium' ? [240, 180] : [140, 110];
  const surfaceGeo = new THREE.PlaneGeometry(280, 230, SEG[0], SEG[1]);
  const surfaceMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // 平面はX軸まわりに -90° 回すので、ローカル(x, y) → ワールド(x, -y)
  const planeXZ = vec2(positionLocal.x, positionLocal.y.negate());
  const surfH = waveHeight(planeXZ, uTime);
  const surfWorld = vec3(planeXZ.x, surfH, planeXZ.y);

  // 波の高さから法線を数値微分で求める
  const eps = float(0.4);
  const hX = waveHeight(vec2(planeXZ.x.add(eps), planeXZ.y), uTime);
  const hZ = waveHeight(vec2(planeXZ.x, planeXZ.y.add(eps)), uTime);
  const surfNormal = normalize(vec3(surfH.sub(hX).div(eps), 1.0, surfH.sub(hZ).div(eps)));

  surfaceMat.positionNode = vec3(positionLocal.x, positionLocal.y, surfH);

  const vNormal = varying(surfNormal, 'vSurfNormal');
  const vWorld = varying(surfWorld, 'vSurfWorld');
  const vHeight = varying(surfH, 'vSurfHeight');

  surfaceMat.colorNode = Fn(() => {
    const n = normalize(vNormal);
    const view = normalize(cameraPosition.sub(vWorld));
    const dist = length(vWorld.sub(cameraPosition));

    const fres = pow(clamp(float(1.0).sub(max(dot(n, view), 0.0)), 0.0, 1.0), 3.2);
    const sun = normalize(vec3(0.18, 0.5, -1.0));
    const spec = pow(max(dot(reflect(view.negate(), n), sun), 0.0), 42.0);

    const body = mix(vec3(0.006, 0.035, 0.085), vec3(0.02, 0.13, 0.28),
      smoothstep(float(-1.6), float(1.4), vHeight));

    // 「データの海」を思わせるグリッド
    const g = abs(fract(vec2(vWorld.x.mul(0.25), vWorld.z.mul(0.25))).sub(0.5));
    const lw = float(0.045);
    const gridLine = max(
      smoothstep(float(0.0), lw, g.x).oneMinus(),
      smoothstep(float(0.0), lw, g.y).oneMinus(),
    );
    const gridFade = smoothstep(float(58.0), float(10.0), dist);

    const col = body
      .add(vec3(0.10, 0.52, 0.86).mul(fres.mul(0.85)))
      .add(vec3(0.55, 0.92, 1.0).mul(spec.mul(1.5)))
      .add(vec3(0.10, 0.45, 0.72).mul(gridLine.mul(gridFade).mul(0.16)));

    // 遠景は背景に溶かす
    return mix(col, vec3(0.012, 0.06, 0.115), smoothstep(float(45.0), float(150.0), dist));
  })();

  surfaceMat.opacityNode = Fn(() => {
    const dist = length(vWorld.sub(cameraPosition));
    const far = smoothstep(float(165.0), float(85.0), dist);
    const edge = smoothstep(float(132.0), float(96.0), abs(vWorld.x));
    return far.mul(edge).mul(uReveal);
  })();

  const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
  surface.rotation.x = -Math.PI / 2;
  surface.frustumCulled = false;
  surface.renderOrder = 0;
  scene.add(surface);

  /* -------------------- 海の粒子 -------------------- */
  let seaPosition; // vec3 node : 粒子のワールド位置
  let computeUpdate = null;

  if (isWebGPU) {
    const positions = instancedArray(COUNT, 'vec3');
    const velocities = instancedArray(COUNT, 'vec3');

    const computeInit = Fn(() => {
      const pos = positions.element(instanceIndex);
      const vel = velocities.element(instanceIndex);
      const rx = hash(instanceIndex);
      const ry = hash(instanceIndex.add(31013));
      const rz = hash(instanceIndex.add(70601));
      pos.assign(vec3(
        rx.mul(X_LEN).add(X_MIN),
        ry.sub(0.5).mul(0.5),
        rz.mul(Z_LEN).add(Z_MIN),
      ));
      vel.assign(vec3(0.0));
    })().compute(COUNT);

    renderer.compute(computeInit);

    computeUpdate = Fn(() => {
      const pos = positions.element(instanceIndex).toVar();
      const vel = velocities.element(instanceIndex).toVar();
      const dt = min(uDelta, float(0.05));

      // 大きな渦（カール状の乱流）
      const n = mx_fractal_noise_vec3(
        vec3(pos.x.mul(0.035), pos.y.mul(0.10).add(uTime.mul(0.05)), pos.z.mul(0.035)),
        2, 2.0, 0.5, 1.0,
      );
      const flow = vec3(
        n.x.mul(1.5).add(0.55),          // 潮の流れ（+X）
        n.y.mul(0.22),
        n.z.mul(1.5).add(1.25),          // 手前に寄せる（+Z）
      );

      // ポインタからの押し出し＋渦
      const d = vec3(pos.x.sub(uPointer.x), 0.0, pos.z.sub(uPointer.z));
      const dist2 = d.x.mul(d.x).add(d.z.mul(d.z));
      const falloff = exp(dist2.mul(-0.012)).mul(uPointerAmp);
      const dir = normalize(vec3(d.x, 0.0, d.z).add(vec3(0.0001, 0.0, 0.0001)));
      const swirl = vec3(dir.z.negate(), 0.0, dir.x);
      const force = dir.mul(falloff.mul(26.0)).add(swirl.mul(falloff.mul(20.0)));

      vel.addAssign(flow.sub(vel).mul(dt.mul(1.6)));
      vel.addAssign(force.mul(dt));
      vel.mulAssign(float(0.985));
      pos.addAssign(vel.mul(dt));

      // 上下は水面付近に留める
      pos.y.mulAssign(float(0.985));

      // 領域をラップ
      If(pos.x.greaterThan(float(X_MAX)), () => { pos.x.subAssign(float(X_LEN)); });
      If(pos.x.lessThan(float(X_MIN)), () => { pos.x.addAssign(float(X_LEN)); });
      If(pos.z.greaterThan(float(Z_MAX)), () => { pos.z.subAssign(float(Z_LEN)); });
      If(pos.z.lessThan(float(Z_MIN)), () => { pos.z.addAssign(float(Z_LEN)); });

      positions.element(instanceIndex).assign(pos);
      velocities.element(instanceIndex).assign(vel);
    })().compute(COUNT);

    seaPosition = positions.toAttribute();
  } else {
    // WebGL2 フォールバック：位置を時間の関数として頂点側で作る
    seaPosition = Fn(() => {
      const rx = hash(instanceIndex);
      const ry = hash(instanceIndex.add(31013));
      const rz = hash(instanceIndex.add(70601));
      const speed = rz.mul(0.5).add(0.75);
      const x = fract(rx.add(uTime.mul(0.004).mul(ry.add(0.4)))).mul(X_LEN).add(X_MIN);
      const z = fract(rz.add(uTime.mul(0.0075).mul(speed))).mul(Z_LEN).add(Z_MIN);
      const wobble = sin(uTime.mul(0.6).add(rx.mul(6.283))).mul(0.35);
      return vec3(x.add(wobble), ry.sub(0.5).mul(0.5), z);
    })();
  }

  const seaWave = waveHeight(vec2(seaPosition.x, seaPosition.z), uTime);
  const seaWorld = vec3(seaPosition.x, seaPosition.y.add(seaWave), seaPosition.z);

  const seaMaterial = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const rnd = hash(instanceIndex.add(9173));
  const crest = smoothstep(float(0.05), float(1.55), seaWave);
  const depthFade = smoothstep(float(-94.0), float(-34.0), seaPosition.z); // 遠方はフェード
  const nearFade = smoothstep(float(15.0), float(9.0), seaPosition.z);      // カメラ直前もフェード

  // 画面上の粒径をほぼ一定に保つ（カメラからの距離に比例させる）
  const camDist = max(length(seaWorld.sub(cameraPosition)), float(1.0));

  seaMaterial.positionNode = seaWorld;
  seaMaterial.scaleNode = camDist
    .mul(rnd.mul(0.0016).add(0.0011))
    .mul(crest.mul(0.9).add(0.75))
    .mul(uReveal.mul(0.35).add(0.65));
  seaMaterial.colorNode = varying(
    mix(mix(DEEP, MID, smoothstep(float(-1.4), float(0.8), seaWave)), CREST, pow(crest, 1.5))
      .add(VIOLET.mul(pow(rnd, 20.0).mul(2.2)))
  );
  seaMaterial.opacityNode = (() => {
    const d = length(uv().sub(0.5));
    const disc = smoothstep(float(0.5), float(0.02), d);
    const fade = varying(
      clamp(depthFade.mul(nearFade).mul(crest.mul(0.75).add(0.5)), 0.0, 1.0)
    );
    return disc.mul(fade).mul(uReveal);
  })();

  const sea = new THREE.Sprite(seaMaterial);
  sea.count = COUNT;
  sea.frustumCulled = false;
  sea.renderOrder = 1;
  scene.add(sea);

  /* -------------------- 立ち上る泡 -------------------- */
  const moteMaterial = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const moteNode = Fn(() => {
    const rx = hash(instanceIndex.add(4211));
    const ry = hash(instanceIndex.add(8807));
    const rz = hash(instanceIndex.add(15173));
    const rise = fract(ry.add(uTime.mul(rx.mul(0.012).add(0.010))));
    const x = rx.mul(60.0).sub(30.0).add(sin(uTime.mul(0.4).add(ry.mul(6.283))).mul(1.6));
    const z = rz.mul(56.0).sub(52.0);
    const y = rise.mul(15.0).sub(1.0);
    return vec3(x, y, z);
  })();

  const moteRnd = hash(instanceIndex.add(2027));
  const moteRise = fract(hash(instanceIndex.add(8807)).add(uTime.mul(hash(instanceIndex.add(4211)).mul(0.012).add(0.010))));

  moteMaterial.positionNode = moteNode;
  moteMaterial.scaleNode = max(length(moteNode.sub(cameraPosition)), float(1.0)).mul(moteRnd.mul(0.006).add(0.0022));
  moteMaterial.colorNode = varying(mix(vec3(0.30, 0.80, 1.0), vec3(0.75, 0.86, 1.0), moteRnd));
  moteMaterial.opacityNode = (() => {
    const d = length(uv().sub(0.5));
    const disc = pow(smoothstep(float(0.5), float(0.0), d), 2.2);
    const life = varying(smoothstep(float(0.0), float(0.15), moteRise).mul(smoothstep(float(1.0), float(0.55), moteRise)));
    return disc.mul(life).mul(0.55).mul(uReveal);
  })();

  const motes = new THREE.Sprite(moteMaterial);
  motes.count = MOTES;
  motes.frustumCulled = false;
  motes.renderOrder = 2;
  scene.add(motes);

  /* -------------------- ポストプロセス（ブルーム） -------------------- */
  let post = null;
  if (quality !== 'low') {
    const Pipeline = THREE.RenderPipeline || THREE.PostProcessing;
    post = new Pipeline(renderer);
    const scenePass = pass(scene, camera);
    post.outputNode = scenePass.add(bloom(scenePass, quality === 'high' ? 0.52 : 0.38, 0.35, 0.35));
  }

  /* -------------------- インタラクション -------------------- */
  const pointerNDC = new THREE.Vector2(0, 0);
  const targetParallax = new THREE.Vector2(0, 0);
  const parallax = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const seaPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();
  let pointerActive = 0;

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    const cx = (event.clientX - rect.left) / rect.width;
    const cy = (event.clientY - rect.top) / rect.height;
    if (cx < 0 || cx > 1 || cy < 0 || cy > 1) return;
    pointerNDC.set(cx * 2 - 1, -(cy * 2 - 1));
    targetParallax.set(pointerNDC.x, pointerNDC.y);
    pointerActive = 1;
  }
  function onPointerLeave() { pointerActive = 0; targetParallax.set(0, 0); }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave, { passive: true });

  /* -------------------- リサイズ -------------------- */
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    // 縦長画面では画角を広げて水平線を保つ
    camera.fov = camera.aspect < 0.85 ? 66 : 50;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  /* -------------------- ループ -------------------- */
  let running = false;
  let scrollFactor = 0;
  let disposed = false;
  let last = performance.now();
  let elapsed = 0;
  let perfSamples = 0;
  let perfAccum = 0;

  function frame() {
    if (disposed) return;
    // 幅・高さが 0 のあいだ（非表示のタブなど）に描くと GPU 側が無効になる
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
    const now = performance.now();
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += delta;

    uTime.value = elapsed;
    uDelta.value = reduced ? 0 : delta;
    uReveal.value = Math.min(1, uReveal.value + delta * 0.9);

    // ポインタが海面のどこを指しているか
    raycaster.setFromCamera(pointerNDC, camera);
    if (raycaster.ray.intersectPlane(seaPlane, hitPoint)) {
      uPointer.value.copy(hitPoint);
    }
    uPointerAmp.value += ((pointerActive && !reduced ? 1 : 0) - uPointerAmp.value) * Math.min(1, delta * 3);

    // カメラのゆらぎ＋パララックス＋スクロール連動
    parallax.lerp(targetParallax, Math.min(1, delta * 2.2));
    const drift = reduced ? 0 : elapsed;
    camera.position.x = parallax.x * 2.2 + Math.sin(drift * 0.12) * 0.7;
    camera.position.y = 1.9 + parallax.y * 0.5 + Math.sin(drift * 0.21) * 0.14 + scrollFactor * 2.6;
    camera.position.z = 13 - scrollFactor * 4.0;
    camera.lookAt(parallax.x * 1.4, 1.35 - scrollFactor * 0.7, -30);

    if (computeUpdate && !reduced) renderer.compute(computeUpdate);

    if (post) post.render();
    else renderer.render(scene, camera);

    // 重すぎる環境では解像度を落として滑らかさを優先する
    if (!reduced && pixelRatio > 1) {
      perfSamples++;
      perfAccum += delta;
      if (perfSamples >= 100) {
        if (perfAccum / perfSamples > 0.028) {
          pixelRatio = Math.max(1, pixelRatio - 0.35);
          renderer.setPixelRatio(pixelRatio);
          resize();
        }
        perfSamples = 0;
        perfAccum = 0;
      }
    }
  }

  function start() {
    if (running || disposed) return;
    running = true;
    last = performance.now();
    renderer.setAnimationLoop(frame);
  }
  function stop() {
    if (!running) return;
    running = false;
    renderer.setAnimationLoop(null);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  if (reduced) {
    // 動きを抑える設定なら 1 枚だけ描いて止める
    uReveal.value = 1;
    frame();
  } else {
    start();
  }

  return {
    isWebGPU,
    particleCount: COUNT,
    setScroll(v) { scrollFactor = Math.max(0, Math.min(1, v)); },
    start,
    stop,
    dispose() {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      seaMaterial.dispose();
      moteMaterial.dispose();
      renderer.dispose();
    },
  };
}

/* ------------------------------------------------------------------ *
 * 自動ブート
 * ------------------------------------------------------------------ */
function pickQuality() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (coarse || small) return mem <= 4 || cores <= 4 ? 'low' : 'medium';
  return mem >= 8 && cores >= 8 ? 'high' : 'medium';
}

export async function boot(selector = '#hero-canvas') {
  const canvas = document.querySelector(selector);
  if (!canvas) return null;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const quality = params.get('q') || pickQuality();
  const forceWebGL = params.get('renderer') === 'webgl';

  try {
    const hero = await createOceanHero(canvas, { quality, reducedMotion, forceWebGL });
    document.documentElement.classList.add('hero-ready');
    document.documentElement.dataset.heroBackend = hero.isWebGPU ? 'webgpu' : 'webgl';

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        hero.setScroll(window.scrollY / Math.max(1, window.innerHeight));
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // ヒーローが画面外に出たら描画を止める
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) hero.start(); else hero.stop();
      }
    }, { threshold: 0 });
    io.observe(canvas);

    window.aquabitHero = hero;
    return hero;
  } catch (err) {
    console.warn('[AquaBit] WebGPU/WebGL hero unavailable:', err);
    document.documentElement.classList.add('hero-failed');
    return null;
  }
}

boot();
