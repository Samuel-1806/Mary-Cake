/* ==========================================================
   Mary Cake — script.js
   Lógica de interatividade e motor 3D (Three.js).
   Requer o importmap declarado em index.html:
     "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
   ========================================================== */

import * as THREE from 'three';

/*
  ------------------------------------------------------------
  Registro de todos os palcos 3D da página. Cada entrada
  corresponde a um [data-stage] no index.html. Por enquanto
  só "hero-product" tem uma cena implementada — as demais
  permanecem como contêineres vazios, prontos para receber
  sua própria função de build() nos próximos passos:

    hero-product      -> cupcake estilizado (IMPLEMENTADO)
    atelie-scene       -> pendente
    app-vitrine         -> pendente
    app-carrinho        -> pendente
    app-conta            -> pendente
    app-detail           -> pendente
    order-steps          -> pendente
    founder-portrait      -> pendente
  ------------------------------------------------------------
*/

const PALETTE = {
  bg:        0xF5F2ED, // frosting / cream
  text:      0x3D352F, // fine details
  accent:    0xD4A392, // cherry / warm accent
  accentDark:0xB89A7A  // cup liner
};

/* ---------- CENA: cupcake do hero ---------- */
function buildCupcake() {
  const group = new THREE.Group();

  // Liner (cup) — tapered cylinder, wider at top
  const linerGeo = new THREE.CylinderGeometry(0.95, 0.62, 1.15, 40, 1, false);
  const linerMat = new THREE.MeshPhysicalMaterial({
    color: PALETTE.accentDark,
    roughness: 0.55,
    metalness: 0.05,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4
  });
  const liner = new THREE.Mesh(linerGeo, linerMat);
  liner.position.y = -0.55;
  group.add(liner);

  // subtle vertical ridges on the liner using thin torus rings
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const y = -1.05 + t * 0.95;
    const r = 0.66 + t * 0.27;
    const ringGeo = new THREE.TorusGeometry(r, 0.008, 8, 40);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: PALETTE.bg, transparent: true, opacity: 0.18 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    group.add(ring);
  }

  // Frosting — swirled soft-serve shape via LatheGeometry
  const pts = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * 1.35;
    const wave = Math.sin(t * Math.PI * 5.5) * 0.05 * (1 - t * 0.7);
    const r = Math.max(0.03, 0.82 * Math.pow(1 - t, 0.85) + wave);
    pts.push(new THREE.Vector2(r, y));
  }
  const frostingGeo = new THREE.LatheGeometry(pts, 48);
  const frostingMat = new THREE.MeshPhysicalMaterial({
    color: PALETTE.bg,
    roughness: 0.3,
    metalness: 0.05,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    sheen: 1,
    sheenColor: new THREE.Color(PALETTE.accent),
    sheenRoughness: 0.6
  });
  const frosting = new THREE.Mesh(frostingGeo, frostingMat);
  frosting.position.y = 0.05;
  group.add(frosting);

  // Cherry on top
  const cherryGeo = new THREE.SphereGeometry(0.11, 32, 32);
  const cherryMat = new THREE.MeshPhysicalMaterial({
    color: PALETTE.accent,
    roughness: 0.25,
    metalness: 0.1,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15
  });
  const cherry = new THREE.Mesh(cherryGeo, cherryMat);
  cherry.position.y = 1.42;
  group.add(cherry);

  // a few tiny "sprinkles" for texture, in text color
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const h = Math.random() * 0.9;
    const rad = 0.15 + (1 - h / 1.3) * 0.55 * Math.random();
    const sGeo = new THREE.CapsuleGeometry(0.012, 0.05, 2, 4);
    const sMat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? PALETTE.text : PALETTE.accentDark });
    const sprinkle = new THREE.Mesh(sGeo, sMat);
    sprinkle.position.set(Math.cos(a) * rad, 0.15 + h, Math.sin(a) * rad);
    sprinkle.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    group.add(sprinkle);
  }

  group.position.y = -0.15;
  return group;
}

/* ---------- MOTOR: inicializa um palco 3D genérico ---------- */
function initStage(container, buildFn) {
  if (!container) return;

  let width = container.clientWidth;
  let height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
  camera.position.set(0, 0.35, 4.6);
  camera.lookAt(0, 0.35, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // lighting — warm, soft, matches the palette's daylight feel
  const hemi = new THREE.HemisphereLight(0xfff6ee, 0xB89A7A, 1.15);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xF5F2ED, 0.5);
  fill.position.set(-4, 1, -2);
  scene.add(fill);

  const rim = new THREE.PointLight(0xD4A392, 0.6, 10);
  rim.position.set(0, 2, -3);
  scene.add(rim);

  const model = buildFn();
  scene.add(model);

  // pointer parallax
  const target = { x: 0, y: 0 };
  let current = { x: 0, y: 0 };
  container.addEventListener('pointermove', (e) => {
    const rect = container.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    target.x = nx * 0.25;
    target.y = ny * 0.15;
  });
  container.addEventListener('pointerleave', () => {
    target.x = 0;
    target.y = 0;
  });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    model.rotation.y += 0.0035;
    model.position.y = -0.15 + Math.sin(t * 0.6) * 0.045;

    current.x += (target.y - current.x) * 0.05;
    current.y += (target.x - current.y) * 0.05;
    model.rotation.x = current.x;
    model.rotation.z = current.y * 0.4;

    renderer.render(scene, camera);
  }
  animate();

  // responsive
  const ro = new ResizeObserver(() => {
    width = container.clientWidth;
    height = container.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  ro.observe(container);

  // hide the CSS fallback glyph once the canvas is live
  const fallback = container.querySelector('.stage-fallback');
  if (fallback) fallback.style.display = 'none';
}

/* ==========================================================
   VITRINE DE CELULARES — "Dentro do App"
   Portado do protótipo anterior do site: 3 celulares reais em
   DOM/CSS (não Three.js) que revezam PAPÉIS — 'active' (centro,
   foco), 'left' e 'right' (recuados em diagonal, atrás) — via
   GSAP, conforme o progresso do scroll dentro da seção pinada
   (.telas-section). O aparelho nunca troca de tela internamente;
   o que muda é qual papel cada um ocupa na composição.
   ========================================================== */
function setupTelasShowcase() {
  const section = document.querySelector('.telas-section');
  if (!section || typeof gsap === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const screens = ['vitrine', 'carrinho', 'conta'];
  const phones = gsap.utils.toArray('.telas-phone', section);
  const panels = gsap.utils.toArray('.telas-panel', section);
  const dots = gsap.utils.toArray('.telas-dots [data-dot]', section);
  const card = section.querySelector('.telas-card');

  let currentActive = null;
  let isOnstage = false;

  // Posição/ângulo/profundidade de cada papel — calculados a partir da
  // largura real do celular, para se adaptar sozinho a qualquer tela.
  function roleTransform(role) {
    const w = (phones[0] && phones[0].offsetWidth) || 220;
    switch (role) {
      case 'active':
        return { x: 0, y: 0, z: 0, scale: 1, opacity: 1, rotation: 0, rotationY: 0, zIndex: 3 };
      case 'left':
        return { x: -w * 0.98, y: w * 0.15, z: -170, scale: 0.72, opacity: 0.55, rotation: -4, rotationY: 24, zIndex: 1 };
      case 'right':
      default:
        return { x: w * 1.02, y: w * 0.08, z: -170, scale: 0.72, opacity: 0.55, rotation: 4, rotationY: -24, zIndex: 1 };
    }
  }

  // Mesma composição, empurrada para baixo e invisível — de onde a
  // formação "sobe" ao entrar na seção, e para onde "desce" ao sair.
  function offstageTransform(role) {
    const t = roleTransform(role);
    return Object.assign({}, t, { y: t.y + 220, opacity: 0 });
  }

  function setTelasFormation(newScreen, opts) {
    opts = opts || {};
    const instant = !!opts.instant;
    const onstage = opts.onstage !== false;
    const activeIndex = screens.indexOf(newScreen);
    const leftScreen = screens[(activeIndex + screens.length - 1) % screens.length];
    const rightScreen = screens[(activeIndex + 1) % screens.length];
    const roleOf = {};
    roleOf[newScreen] = 'active';
    roleOf[leftScreen] = 'left';
    roleOf[rightScreen] = 'right';
    const roleDelay = { active: 0, left: 0.05, right: 0.09 };

    const wasOnstage = isOnstage;
    const screenChanged = newScreen !== currentActive;
    const stageArriving = onstage && !wasOnstage;
    const stageLeaving = !onstage && wasOnstage;

    phones.forEach((el) => {
      const screenName = el.dataset.screen;
      const role = roleOf[screenName];
      const target = onstage ? roleTransform(role) : offstageTransform(role);
      const risingIntoFocus = role === 'active' && (screenChanged || stageArriving);

      el.classList.toggle('is-front', role === 'active');

      if (instant) {
        gsap.set(el, target);
        return;
      }

      const delay = stageArriving || stageLeaving ? roleDelay[role] : 0;

      if (risingIntoFocus && onstage) {
        gsap.fromTo(
          el,
          { y: target.y + 100, opacity: 0.001, rotationY: target.rotationY, z: target.z },
          { x: target.x, y: target.y, z: target.z, scale: target.scale, opacity: target.opacity,
            rotation: target.rotation, rotationY: target.rotationY, zIndex: target.zIndex,
            duration: 0.95, delay, ease: 'power4.out', overwrite: 'auto' }
        );
      } else {
        gsap.to(el, {
          x: target.x, y: target.y, z: target.z, scale: target.scale, opacity: target.opacity,
          rotation: target.rotation, rotationY: target.rotationY, zIndex: target.zIndex,
          duration: stageLeaving ? 0.7 : 0.85,
          delay,
          ease: stageLeaving ? 'power2.in' : 'power3.inOut',
          overwrite: 'auto'
        });
      }
    });

    panels.forEach((el) => el.classList.toggle('is-active', el.dataset.screen === newScreen));
    dots.forEach((el) => el.classList.toggle('is-active', el.dataset.dot === newScreen));

    currentActive = newScreen;
    isOnstage = onstage;
  }

  gsap.set(phones, { xPercent: -50, yPercent: -50, transformPerspective: 1000 });
  setTelasFormation(screens[0], { instant: true, onstage: false });
  if (card) gsap.set(card, { opacity: 0, y: 24 });

  // Clique manual nos indicadores
  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      if (!isOnstage || dot.dataset.dot === currentActive) return;
      setTelasFormation(dot.dataset.dot, { onstage: true });
    });
  });

  window.addEventListener('resize', () => {
    setTelasFormation(currentActive || screens[0], { instant: true, onstage: isOnstage });
  });

  // Chegada e saída da formação — sobe ao aproximar, desce ao sair
  ScrollTrigger.create({
    trigger: section,
    start: 'top 82%',
    end: 'top 18%',
    onEnter: () => {
      setTelasFormation(currentActive || screens[0], { onstage: true });
      if (card) gsap.to(card, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' });
    },
    onLeaveBack: () => {
      setTelasFormation(currentActive || screens[0], { onstage: false });
      if (card) gsap.to(card, { opacity: 0, y: 24, duration: 0.6, ease: 'power3.in' });
    }
  });

  ScrollTrigger.create({
    trigger: section,
    start: 'bottom 82%',
    end: 'bottom 18%',
    onLeave: () => {
      setTelasFormation(currentActive || screens[0], { onstage: false });
      if (card) gsap.to(card, { opacity: 0, y: -20, duration: 0.6, ease: 'power3.in' });
    },
    onEnterBack: () => {
      setTelasFormation(currentActive || screens[0], { onstage: true });
      if (card) gsap.to(card, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' });
    }
  });

  if (prefersReducedMotion) return; // mantém só o 1º estado; sem scroll-jacking

  // Proxy 0→2 tweenado em scrub com o progresso do scroll na seção —
  // arredondar dá o índice da tela ativa (vitrine → carrinho → conta).
  const proxy = { step: 0 };
  gsap.to(proxy, {
    step: screens.length - 1,
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.4
    },
    onUpdate: () => {
      if (!isOnstage) return;
      const target = screens[Math.round(proxy.step)];
      if (target !== currentActive) setTelasFormation(target, { onstage: true });
    }
  });
}

/* ==========================================================
   TECIDO ANIMADO — plano de fundo do site inteiro
   Canvas fixo (#fabric-bg) com um shader de "seda": dobras que
   se movem sozinhas o tempo todo (fbm + tempo) e se deformam
   perto do cursor — a área deformada ganha um tom dourado,
   na paleta da marca. Roda em segundo plano, atrás de todo o
   conteúdo (ver #fabric-bg em style.css).
   ========================================================== */
function initFabricBackground() {
  const canvas = document.getElementById('fabric-bg');
  if (!canvas || typeof THREE === 'undefined') return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch (err) {
    console.warn('WebGL indisponível para o fundo de tecido — mantendo cor sólida de fallback.', err);
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMouseInfluence: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMouse;
      uniform float uMouseInfluence;
      varying vec2 vUv;

      /* ruído 2D leve (value noise) — usado para simular as dobras do tecido */
      float hash(vec2 p){
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p){
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      float fbm(vec2 p){
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++){
          v += amp * noise(p);
          p *= 2.02;
          amp *= 0.55;
        }
        return v;
      }

      void main(){
        float aspect = uResolution.x / uResolution.y;
        vec2 auv = vUv; auv.x *= aspect;
        vec2 mouseUv = uMouse; mouseUv.x *= aspect;

        /* ondulação ao redor do ponteiro — decai com a distância */
        float dist = length(auv - mouseUv);
        float ripple = exp(-dist * 3.2) * uMouseInfluence;
        float rippleWave = sin(dist * 22.0 - uTime * 2.2) * ripple;

        /* domain warp: distorce a amostragem do padrão perto do mouse,
           somado a uma deriva lenta e constante — é o que faz o tecido
           parecer "vivo" mesmo sem interação. */
        vec2 dir = normalize(auv - mouseUv + 0.0001);
        vec2 warp = auv + dir * rippleWave * 0.06;
        warp += vec2(sin(uTime * 0.08), cos(uTime * 0.065)) * 0.16;

        float fold = fbm(warp * 2.4 + uTime * 0.035);
        float fold2 = fbm(warp * 5.0 - uTime * 0.05);
        float sheen = fold * 0.65 + fold2 * 0.35;

        /* paleta creme da marca */
        vec3 creamLight = vec3(0.984, 0.976, 0.965);
        vec3 creamDark  = vec3(0.937, 0.906, 0.867);
        vec3 base = mix(creamDark, creamLight, sheen);
        base += (fold2 - fold) * 0.035;

        /* dourado que aparece só onde o tecido está sendo "tocado" */
        vec3 gold = vec3(0.831, 0.643, 0.573);
        vec3 goldDeep = vec3(0.722, 0.604, 0.478);
        float goldMix = clamp(ripple * 1.4 + abs(rippleWave) * 0.9, 0.0, 1.0);
        vec3 color = mix(base, mix(gold, goldDeep, fold), goldMix);

        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  /* ponteiro: posição alvo suavizada + influência que decai quando parado */
  const targetMouse = new THREE.Vector2(0.5, 0.5);
  let targetInfluence = 0;
  let idleTimer = null;

  function setPointer(clientX, clientY) {
    targetMouse.set(clientX / window.innerWidth, 1 - clientY / window.innerHeight);
    targetInfluence = 1;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { targetInfluence = 0; }, 250);
  }

  window.addEventListener('pointermove', (e) => setPointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerdown', (e) => setPointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerleave', () => { targetInfluence = 0; });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  });

  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = document.visibilityState === 'visible';
  });

  const clock = new THREE.Clock();
  const speed = prefersReducedMotion ? 0.18 : 1; // menos movimento ambiente se o usuário preferir

  function animate() {
    requestAnimationFrame(animate);
    if (!running) return;

    const dt = Math.min(clock.getDelta(), 0.1);
    material.uniforms.uTime.value += dt * speed;
    material.uniforms.uMouse.value.lerp(targetMouse, 0.08);
    material.uniforms.uMouseInfluence.value += (targetInfluence - material.uniforms.uMouseInfluence.value) * 0.06;

    renderer.render(scene, camera);
  }
  animate();
}

/* ---------- BOOTSTRAP ---------- */
function initAllStages() {
  initFabricBackground();

  try {
    const heroStage = document.querySelector('[data-stage="hero-product"]');
    initStage(heroStage, buildCupcake);
  } catch (err) {
    console.warn('WebGL indisponível, mantendo o marcador de fallback.', err);
  }

  // demais palcos aguardando implementação
  document.querySelectorAll('.stage-3d:not([data-stage="hero-product"])').forEach(el => {
    console.log('Stage 3D pronto para receber cena Three.js:', el.dataset.stage);
  });

  setupTelasShowcase();
}

document.addEventListener('DOMContentLoaded', initAllStages);
