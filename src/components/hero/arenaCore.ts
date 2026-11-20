import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Texture,
} from "three";
import type { Team } from "@/lib/types";

/*
 * Núcleo 3D del Hero de ARENA XI (Three.js puro, sin React Three Fiber).
 *
 * - Balón generado por shader: las 32 caras (12 pentágonos + 20 hexágonos) salen del
 *   diagrama de Voronoi de los vértices del icosaedro y del dodecaedro. Sin texturas
 *   ni modelos externos, con costuras de neón.
 * - Anillos de energía y tarjetas de equipos en órbita (el "bombo" del sorteo).
 * - Sorteo exprés: el equipo se elige al azar ANTES de animar; la órbita frena hasta
 *   dejarlo delante, igual que los sorteos de la app.
 * - Rendimiento: DPR limitado, ~140 partículas, render solo si es visible y la pestaña
 *   está activa, y liberación de geometrías, materiales, texturas y contexto al desmontar.
 */

const NEON = new Color("#3dff8b");
const VOLT = new Color("#2f9bff");
const PHI = (1 + Math.sqrt(5)) / 2;

export interface ArenaCoreOptions {
  container: HTMLElement;
  teams: Team[];
  fontFamily: string;
  pickIndex: (n: number) => number;
  onReady?: () => void;
  onDrawStart?: () => void;
  onDrawEnd?: (team: Team) => void;
}

export interface ArenaCoreHandle {
  draw: () => void;
  dispose: () => void;
}

function faceCenters(): Vector3[] {
  const v: Vector3[] = [];
  // 12 vértices del icosaedro → centros de los pentágonos.
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    v.push(new Vector3(0, a, b * PHI), new Vector3(a, b * PHI, 0), new Vector3(b * PHI, 0, a));
  }
  // 20 vértices del dodecaedro → centros de los hexágonos.
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) v.push(new Vector3(a, b, c));
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    v.push(new Vector3(0, a / PHI, b * PHI), new Vector3(a / PHI, b * PHI, 0), new Vector3(b * PHI, 0, a / PHI));
  }
  return v.map((x) => x.normalize());
}

const ballVertex = /* glsl */ `
  varying vec3 vObjN;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vObjN = normal;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const ballFragment = /* glsl */ `
  uniform vec3 uCenters[32];
  uniform float uHover;
  uniform float uPulse;
  uniform vec3 uNeon;
  uniform vec3 uVolt;
  varying vec3 vObjN;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vec3 p = normalize(vObjN);
    float d1 = -2.0; float d2 = -2.0; int i1 = 0;
    for (int i = 0; i < 32; i++) {
      // Sesgo para que pentágonos y hexágonos tengan proporciones de balón real.
      float d = dot(p, uCenters[i]) + (i < 12 ? -0.012 : 0.0);
      if (d > d1) { d2 = d1; d1 = d; i1 = i; } else if (d > d2) { d2 = d; }
    }
    float seam = 1.0 - smoothstep(0.0, 0.03, d1 - d2);
    bool pent = i1 < 12;
    vec3 base = pent ? vec3(0.035, 0.045, 0.055) : vec3(0.9, 0.93, 0.97);

    vec3 n = normalize(vN);
    vec3 v = normalize(vView);
    vec3 L = normalize(vec3(0.5, 0.8, 0.7));
    vec3 col = base * (0.18 + 0.82 * max(dot(n, L), 0.0));
    col += uNeon * pow(max(dot(n, normalize(vec3(-1.0, 0.25, 0.4))), 0.0), 2.0) * 0.32;
    col += uVolt * pow(max(dot(n, normalize(vec3(1.0, -0.35, 0.45))), 0.0), 2.0) * 0.36;
    col += pow(max(dot(reflect(-L, n), v), 0.0), 42.0) * (pent ? 0.5 : 0.85);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);
    col += mix(uNeon, uVolt, 0.5 + 0.5 * n.y) * fres * (0.75 + uHover * 0.9 + uPulse);
    col = mix(col, uNeon * (1.25 + uHover * 0.8 + uPulse), seam * 0.92);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function glowTexture(rgb: string): CanvasTexture {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, `rgba(${rgb},0.55)`);
  grad.addColorStop(0.35, `rgba(${rgb},0.18)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Tarjeta de equipo dibujada en canvas (misma estética que las cartas del draft). */
function cardTexture(team: Team, font: string): CanvasTexture {
  const W = 256;
  const H = 340;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const r = 26;
  const rounded = () => {
    g.beginPath();
    g.moveTo(r, 0);
    g.arcTo(W, 0, W, H, r);
    g.arcTo(W, H, 0, H, r);
    g.arcTo(0, H, 0, 0, r);
    g.arcTo(0, 0, W, 0, r);
    g.closePath();
  };
  rounded();
  const bg = g.createLinearGradient(0, 0, W * 0.6, H);
  bg.addColorStop(0, team.colors[0]);
  bg.addColorStop(0.55, "#0b0e13");
  g.fillStyle = bg;
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = "rgba(61,255,139,0.75)";
  g.stroke();

  // Escudo
  g.save();
  g.translate(W / 2 - 54, 70);
  g.scale(2.25, 2.25);
  const shield = new Path2D("M24 2 L45 9 V27 C45 41 35 50 24 54 C13 50 3 41 3 27 V9 Z");
  g.fillStyle = team.colors[0];
  g.fill(shield);
  g.lineWidth = 2.5;
  g.strokeStyle = team.colors[1];
  g.stroke(shield);
  g.restore();
  const light = parseInt(team.colors[0].slice(1, 3), 16) * 0.299 + parseInt(team.colors[0].slice(3, 5), 16) * 0.587 + parseInt(team.colors[0].slice(5, 7), 16) * 0.114 > 150;
  g.fillStyle = light ? "#0b0e13" : "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `900 34px ${font}`;
  g.fillText(team.short, W / 2, 128);

  g.fillStyle = "#3dff8b";
  g.font = `900 64px ${font}`;
  g.fillText(String(team.ovr), W / 2, 238);
  g.fillStyle = "#ffffff";
  g.font = `800 26px ${font}`;
  const name = team.name.length > 16 ? team.short : team.name.toUpperCase();
  g.fillText(name, W / 2, 292);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

export function createArenaCore(opts: ArenaCoreOptions): ArenaCoreHandle {
  const { container, teams } = opts;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "default" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.domElement.style.display = "block";
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 0.35, 8.2);
  camera.lookAt(0, 0, 0);

  const textures: Texture[] = [];
  const root = new Group();
  scene.add(root);

  // Halo detrás del balón
  const haloTex = glowTexture("61,255,139");
  textures.push(haloTex);
  const halo = new Mesh(new PlaneGeometry(6.5, 6.5), new MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: AdditiveBlending }));
  halo.position.z = -1.6;
  scene.add(halo);

  // Balón
  const ballMat = new ShaderMaterial({
    vertexShader: ballVertex,
    fragmentShader: ballFragment,
    uniforms: { uCenters: { value: faceCenters() }, uHover: { value: 0 }, uPulse: { value: 0 }, uNeon: { value: NEON }, uVolt: { value: VOLT } },
  });
  const ball = new Mesh(new SphereGeometry(1.05, 64, 48), ballMat);
  root.add(ball);

  // Anillos de energía
  const ringA = new Mesh(new TorusGeometry(1.6, 0.012, 8, 180), new MeshBasicMaterial({ color: NEON, transparent: true, opacity: 0.85, blending: AdditiveBlending }));
  ringA.rotation.set(Math.PI / 2.25, 0, 0.2);
  const ringB = new Mesh(new TorusGeometry(1.78, 0.008, 8, 180), new MeshBasicMaterial({ color: VOLT, transparent: true, opacity: 0.7, blending: AdditiveBlending }));
  ringB.rotation.set(Math.PI / 1.85, 0.5, -0.4);
  root.add(ringA, ringB);

  // Pedestal luminoso bajo el balón
  const padTex = glowTexture("47,155,255");
  textures.push(padTex);
  const pad = new Mesh(new PlaneGeometry(4.2, 4.2), new MeshBasicMaterial({ map: padTex, transparent: true, depthWrite: false, blending: AdditiveBlending }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = -1.85;
  const padRing = new Mesh(new RingGeometry(1.05, 1.1, 96), new MeshBasicMaterial({ color: NEON, transparent: true, opacity: 0.55, side: DoubleSide, blending: AdditiveBlending }));
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.y = -1.84;
  scene.add(pad, padRing);

  // Órbita de tarjetas (inclinada)
  const orbit = new Group();
  orbit.rotation.set(0.32, 0, -0.12);
  root.add(orbit);
  const R = 2.45;
  const step = (Math.PI * 2) / teams.length;
  const cardGeo = new PlaneGeometry(0.58, 0.77);
  const cards = teams.map((team) => {
    const tex = cardTexture(team, opts.fontFamily);
    textures.push(tex);
    const m = new Mesh(cardGeo, new MeshBasicMaterial({ map: tex, transparent: true, side: DoubleSide }));
    orbit.add(m);
    return m;
  });

  // Partículas
  const count = 140;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 2.4 + Math.random() * 1.6;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.7, r * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  const pGeo = new BufferGeometry();
  pGeo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  const particles = new Points(pGeo, new PointsMaterial({ color: NEON, size: 0.035, transparent: true, opacity: 0.7, depthWrite: false, blending: AdditiveBlending }));
  scene.add(particles);

  // Estado de animación
  let orbitAngle = 0;
  const orbitSpeed = 0.18;
  let tween: { from: number; to: number; start: number; dur: number; index: number } | null = null;
  let highlight = -1;
  let hover = 0;
  let hoverTarget = 0;
  let pulse = 0;
  let entrance = 0;
  const pointer = new Vector2(0, 0);
  const tilt = new Vector2(0, 0);
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  let running = false;
  let visible = true;
  let last = performance.now();
  let ready = false;

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.position.z = w / h < 0.9 ? 9.6 : 8.2;
    camera.updateProjectionMatrix();
  };
  resize();

  const hitBall = (clientX: number, clientY: number) => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects([ball, ...cards], false).length > 0;
  };

  const onPointerMove = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width - 0.5) * 2, ((e.clientY - rect.top) / rect.height - 0.5) * 2);
    const over = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom && hitBall(e.clientX, e.clientY);
    hoverTarget = over ? 1 : 0;
    renderer.domElement.style.cursor = over ? "pointer" : "default";
  };
  const onPointerLeave = () => {
    pointer.set(0, 0);
    hoverTarget = 0;
  };
  const onClick = (e: MouseEvent) => {
    if (hitBall(e.clientX, e.clientY)) draw();
  };

  /** Sorteo exprés: primero se decide el equipo, luego la órbita lo lleva al frente. */
  function draw() {
    if (tween) return;
    const index = opts.pickIndex(teams.length);
    // En el grupo de la órbita, el ángulo π/2 queda frente a la cámara.
    const current = orbitAngle;
    const target = Math.PI / 2 - index * step;
    let to = target + Math.PI * 2 * Math.ceil((current - target) / (Math.PI * 2));
    to += Math.PI * 2 * 2; // dos vueltas extra de suspense
    tween = { from: current, to, start: performance.now(), dur: 2600, index };
    highlight = -1;
    pulse = 1;
    opts.onDrawStart?.();
  }

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    entrance = Math.min(1, entrance + dt * 0.9);
    const e = easeOutCubic(entrance);

    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.dur);
      orbitAngle = tween.from + (tween.to - tween.from) * easeOutCubic(k);
      if (k >= 1) {
        highlight = tween.index;
        const team = teams[tween.index];
        tween = null;
        opts.onDrawEnd?.(team);
      }
    } else if (highlight < 0) {
      orbitAngle += dt * orbitSpeed;
    }

    hover += (hoverTarget - hover) * Math.min(1, dt * 6);
    pulse = Math.max(0, pulse - dt * 0.8);
    tilt.x += (pointer.y * 0.18 - tilt.x) * Math.min(1, dt * 3);
    tilt.y += (pointer.x * 0.35 - tilt.y) * Math.min(1, dt * 3);

    root.scale.setScalar(0.7 + 0.3 * e);
    root.rotation.set(tilt.x, tilt.y, 0);
    root.position.y = Math.sin(t * 0.9) * 0.09;
    ball.rotation.y += dt * (0.35 + hover * 0.6 + pulse * 3);
    ball.rotation.x = Math.sin(t * 0.4) * 0.25;
    ball.scale.setScalar(1 + hover * 0.05);
    ballMat.uniforms.uHover.value = hover;
    ballMat.uniforms.uPulse.value = pulse * 0.8;
    ringA.rotation.z += dt * 0.25;
    ringB.rotation.z -= dt * 0.18;
    (halo.material as MeshBasicMaterial).opacity = (0.75 + 0.25 * Math.sin(t * 1.4) + hover * 0.3) * e;
    particles.rotation.y += dt * 0.03;

    cards.forEach((m, i) => {
      const a = orbitAngle + i * step;
      m.position.set(Math.cos(a) * R, Math.sin(a * 2 + t) * 0.06, Math.sin(a) * R);
      m.lookAt(camera.position);
      const isHi = i === highlight;
      const s = isHi ? 1.55 : 1;
      m.scale.setScalar(m.scale.x + (s - m.scale.x) * Math.min(1, dt * 6));
      const mat = m.material as MeshBasicMaterial;
      const targetOpacity = highlight >= 0 && !isHi ? 0.35 : 1;
      mat.opacity += (targetOpacity * e - mat.opacity) * Math.min(1, dt * 5);
    });

    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      opts.onReady?.();
    }
  };

  const setRunning = (on: boolean) => {
    if (on === running) return;
    running = on;
    last = performance.now();
    renderer.setAnimationLoop(on ? frame : null);
  };
  const update = () => setRunning(visible && !document.hidden);

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  });
  // Los shaders se compilan en paralelo (KHR_parallel_shader_compile) antes del primer
  // fotograma: así la compilación no bloquea el hilo principal.
  let disposed = false;
  renderer
    .compileAsync(scene, camera)
    .catch(() => undefined)
    .then(() => {
      if (disposed) return;
      io.observe(container);
    });
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  document.addEventListener("visibilitychange", update);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  container.addEventListener("pointerleave", onPointerLeave);
  renderer.domElement.addEventListener("click", onClick);

  return {
    draw,
    dispose() {
      disposed = true;
      setRunning(false);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("click", onClick);
      scene.traverse((o) => {
        const mesh = o as Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as Material | Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
