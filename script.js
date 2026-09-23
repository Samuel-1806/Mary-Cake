/* ===========================================================================
   MARY CAKE — Hollywood Dark & Gold WebGL + GSAP ScrollTrigger Coreografia
   =========================================================================== */

(() => {
  gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------------------
     0a. LENIS SMOOTH SCROLL (Inércia de Alta Costura)
     --------------------------------------------------------------------- */
  let lenis = null;
  if (typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      smoothTouch: false
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------------------------------------------------------------------
     0b. ENTRADA DO LOGO SÓLIDO (GSAP Reveal)
     --------------------------------------------------------------------- */
  gsap.set('#hero-logo-solid', { xPercent: -50, yPercent: -50, scale: 0.92, opacity: 0 });
  gsap.to('#hero-logo-solid', {
    opacity: 1,
    scale: 1,
    duration: 1.2,
    delay: 0.2,
    ease: 'expo.out'
  });

  /* ---------------------------------------------------------------------
     0c. ESTADO GLOBAL E ELEMENTOS
     --------------------------------------------------------------------- */
  const canvas = document.getElementById('webgl-canvas');
  const loader = document.getElementById('loader');
  const loaderProgress = document.getElementById('loader-progress');
  const noiseEl = document.getElementById('noise');
  const siteHeader = document.querySelector('.site-header');
  const isMobile = window.matchMedia('(max-width: 860px)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ASSET_PATH = 'assets/';

  let assetsLoaded = 0;
  const TOTAL_ASSETS = 4;

  document.documentElement.classList.add('is-loading-lock');

  function releaseScrollLock() {
    document.documentElement.classList.remove('is-loading-lock');
  }

  function onAssetLoaded() {
    assetsLoaded = Math.min(assetsLoaded + 1, TOTAL_ASSETS);
    const pct = Math.min(100, Math.round((assetsLoaded / TOTAL_ASSETS) * 100));
    if (loaderProgress) loaderProgress.style.width = pct + '%';
    if (assetsLoaded >= TOTAL_ASSETS) {
      gsap.delayedCall(0.35, () => {
        if (loader) loader.classList.add('is-hidden');
        releaseScrollLock();
        ScrollTrigger.refresh();
      });
    }
  }

  /* ---------------------------------------------------------------------
     0d. CURSOR CUSTOMIZADO
     --------------------------------------------------------------------- */
  const supportsFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (supportsFinePointer && !isMobile) {
    const cursorEl = document.getElementById('custom-cursor');
    if (cursorEl) {
      document.documentElement.classList.add('has-custom-cursor');
      let hasMoved = false;

      window.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        cursorEl.style.setProperty('--cx', mouseX + 'px');
        cursorEl.style.setProperty('--cy', mouseY + 'px');
        cursorEl.style.setProperty('--rx', mouseX + 'px');
        cursorEl.style.setProperty('--ry', mouseY + 'px');

        if (!hasMoved) {
          hasMoved = true;
          cursorEl.classList.add('is-active');
        }
      }, { passive: true });

      const HOVER_SELECTOR = 'a, button, .btn-primary, .btn-header, .btn-ghost, .flavor-card, .step-card, .process-card';
      document.addEventListener('mouseover', (e) => {
        if (e.target.closest(HOVER_SELECTOR)) {
          cursorEl.classList.add('is-hovering');
        }
      });
      document.addEventListener('mouseout', (e) => {
        if (e.target.closest(HOVER_SELECTOR)) {
          cursorEl.classList.remove('is-hovering');
        }
      });
    }
  }

  /* ---------------------------------------------------------------------
     1. CENA 3D, CÂMERA E ILUMINAÇÃO DE ESTÚDIO CINEMÁTICA
     --------------------------------------------------------------------- */
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    32,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 9);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Iluminação de Holofote Cinemático
  const ambient = new THREE.AmbientLight(0x3a2e1e, 0.75);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffdf9e, 1.8);
  keyLight.position.set(4, 5, 6);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xe5c158, 1.2);
  rimLight.position.set(-5, -2, -4);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0x2a2016, 0.4);
  fillLight.position.set(-3, 2, 4);
  scene.add(fillLight);

  const pointer3D = new THREE.PointLight(0xffd9a0, 1.2, 8);
  pointer3D.position.set(0, 0, 4);
  scene.add(pointer3D);

  // PMREM Environment Map
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  function addEnvPanel(color, intensity, pos, size) {
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    mat.color.multiplyScalar(intensity);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.lookAt(0, 0, 0);
    envScene.add(mesh);
  }
  addEnvPanel(0xffdf9e, 3.5, [0, 6, 0], [8, 8]);
  addEnvPanel(0xdfe6f2, 1.6, [-6, 1, 2], [6, 10]);
  addEnvPanel(0xd4af37, 2.8, [6, 0, -3], [6, 10]);

  scene.environment = pmremGenerator.fromScene(envScene, 0.03).texture;
  pmremGenerator.dispose();

  /* ---------------------------------------------------------------------
     2. SHADER DE SEDA NEGRA & DOURADA (Silk Cloth WebGL)
     --------------------------------------------------------------------- */
  const BG_Z = -6.4;
  const bgSegments = isMobile ? 44 : 110;
  const bgPlaneGeo = new THREE.PlaneGeometry(48, 48, bgSegments, bgSegments);

  const bgUniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uMouseActive: { value: 0 },
    uBaseColor: { value: new THREE.Color(0x12100E) },
    uGoldColor: { value: new THREE.Color(0xD4AF37) },
    uMap: { value: null },
    uMapLoaded: { value: 0 }
  };

  const bgTextureLoader = new THREE.TextureLoader();
  bgTextureLoader.load(
    ASSET_PATH + 'bg-silk.jpg',
    (tex) => {
      tex.encoding = THREE.sRGBEncoding;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearFilter;
      bgUniforms.uMap.value = tex;
      bgUniforms.uMapLoaded.value = 1;
    },
    undefined,
    () => { onAssetLoaded(); }
  );

  const bgVertexShader = `
    varying float vBump;
    varying float vWave;
    varying vec2 vUvLocal;
    varying vec3 vNormal;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uMouseActive;

    float clothWave(vec2 p, float t) {
      float wave = sin(p.x * 0.5 + t * 0.62) * 0.52
           + cos(p.y * 0.42 - t * 0.50) * 0.44
           + sin((p.x + p.y) * 0.3 + t * 0.78) * 0.30;
      float corner = smoothstep(-10.0, 10.0, p.x - p.y);
      return wave * mix(0.2, 1.2, corner);
    }

    float clothBump(vec2 p, vec2 mouse, float activeAmt) {
      float dist = distance(p, mouse);
      return smoothstep(2.0, 0.0, dist) * activeAmt * 0.6;
    }

    float clothHeight(vec2 p, float t, vec2 mouse, float activeAmt) {
      return clothWave(p, t) + clothBump(p, mouse, activeAmt);
    }

    void main() {
      vec2 p = position.xy;
      vUvLocal = uv;

      float eps = 0.55;
      float ampNormal = 5.5;
      float h  = clothHeight(p, uTime, uMouse, uMouseActive);
      float hx = clothHeight(p + vec2(eps, 0.0), uTime, uMouse, uMouseActive);
      float hy = clothHeight(p + vec2(0.0, eps), uTime, uMouse, uMouseActive);

      vec3 tangentX = vec3(eps, 0.0, (hx - h) * ampNormal);
      vec3 tangentY = vec3(0.0, eps, (hy - h) * ampNormal);
      vNormal = normalize(cross(tangentX, tangentY));

      vec3 pos = position;
      pos.z += h;

      vBump = clamp(clothBump(p, uMouse, uMouseActive) / 0.73, 0.0, 1.0);
      vWave = clothWave(p, uTime);

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const bgFragmentShader = `
    precision highp float;
    varying float vBump;
    varying float vWave;
    varying vec2 vUvLocal;
    varying vec3 vNormal;
    uniform float uTime;
    uniform vec3 uBaseColor;
    uniform vec3 uGoldColor;
    uniform sampler2D uMap;
    uniform float uMapLoaded;

    void main() {
      vec3 N = normalize(vNormal);
      vec3 lightDir = normalize(vec3(-0.35, 0.55, 0.75));
      float diffuse = dot(N, lightDir) * 0.5 + 0.5;

      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      vec3 halfDir = normalize(lightDir + viewDir);
      float specular = pow(max(dot(N, halfDir), 0.0), 16.0);

      float fold = vWave * 3.4 + vUvLocal.x * 2.1 - vUvLocal.y * 1.4;
      float sheen = smoothstep(0.25, 0.88, sin(fold + uTime * 0.15) * 0.5 + 0.5);

      vec2 uvWarp = vUvLocal + N.xy * 0.08;
      vec3 photoColor = texture2D(uMap, uvWarp).rgb * 0.45;

      vec3 baseColor = mix(uBaseColor, photoColor, uMapLoaded * 0.5);
      vec3 clothColor = mix(baseColor, uGoldColor, sheen * 0.45 + specular * 0.6);

      float bumpStrength = clamp(vBump, 0.0, 1.0);
      clothColor += uGoldColor * bumpStrength * 0.4;

      gl_FragColor = vec4(clothColor, 0.95);
    }
  `;

  const bgMat = new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    vertexShader: bgVertexShader,
    fragmentShader: bgFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const bgMesh = new THREE.Mesh(bgPlaneGeo, bgMat);
  bgMesh.position.z = BG_Z;
  bgMesh.renderOrder = -1;
  scene.add(bgMesh);

  /* ---------------------------------------------------------------------
     3. CONSTRUÇÃO DO SMARTPHONE 3D PREMIUM
     --------------------------------------------------------------------- */
  function createRoundedRectShape(width, height, radius) {
    const shape = new THREE.Shape();
    const w = width / 2;
    const h = height / 2;
    shape.moveTo(-w + radius, -h);
    shape.lineTo(w - radius, -h);
    shape.quadraticCurveTo(w, -h, w, -h + radius);
    shape.lineTo(w, h - radius);
    shape.quadraticCurveTo(w, h, w - radius, h);
    shape.lineTo(-w + radius, h);
    shape.quadraticCurveTo(-w, h, -w, h - radius);
    shape.lineTo(-w, -h + radius);
    shape.quadraticCurveTo(-w, -h, -w + radius, -h);
    return shape;
  }

  function normalizeShapeUVs(geometry, width, height) {
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / width + 0.5, pos.getY(i) / height + 0.5);
    }
    uv.needsUpdate = true;
  }

  const textureLoader = new THREE.TextureLoader();

  function loadTextureSafe(fileName, onSuccess) {
    textureLoader.load(
      ASSET_PATH + fileName,
      (tex) => {
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.minFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        onSuccess(tex);
        onAssetLoaded();
      },
      undefined,
      () => { onAssetLoaded(); }
    );
  }

  const PHONE_BODY_WIDTH = 1.62;
  const PHONE_BODY_HEIGHT = 3.3;
  const PHONE_BODY_DEPTH = 0.16;
  const PHONE_CORNER_RADIUS = 0.29;

  function buildSmartphone(textureFile) {
    const group = new THREE.Group();

    const shape = createRoundedRectShape(PHONE_BODY_WIDTH, PHONE_BODY_HEIGHT, PHONE_CORNER_RADIUS);
    const extrudeSettings = {
      depth: PHONE_BODY_DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.008,
      bevelSegments: 4
    };
    const bodyGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    bodyGeo.center();

    const bodyFrontZ = PHONE_BODY_DEPTH / 2 + extrudeSettings.bevelThickness;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x181410,
      metalness: 0.8,
      roughness: 0.25,
      envMapIntensity: 2.0
    });

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    const screenGroup = new THREE.Group();
    group.add(screenGroup);

    const screenWidth = PHONE_BODY_WIDTH - 0.11;
    const screenHeight = PHONE_BODY_HEIGHT - 0.12;
    const screenShape = createRoundedRectShape(screenWidth, screenHeight, PHONE_CORNER_RADIUS - 0.06);
    const screenGeo = new THREE.ShapeGeometry(screenShape, 12);
    normalizeShapeUVs(screenGeo, screenWidth, screenHeight);

    const placeholderMat = new THREE.MeshBasicMaterial({ color: 0x171411 });
    const screen = new THREE.Mesh(screenGeo, placeholderMat);
    screen.position.set(0, 0, bodyFrontZ + 0.01);
    screenGroup.add(screen);

    loadTextureSafe(textureFile, (tex) => {
      screen.material.dispose();
      screen.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    });

    const glassMat = new THREE.MeshBasicMaterial({
      color: 0xffecb3,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const glass = new THREE.Mesh(screenGeo, glassMat);
    glass.position.set(0, 0, bodyFrontZ + 0.012);
    screenGroup.add(glass);

    group.userData.screen = screen;
    group.userData.screenGroup = screenGroup;
    return group;
  }

  function setPhoneOpacity(group, value) {
    group.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        if (obj.userData.baseOpacity === undefined) {
          obj.userData.baseOpacity = obj.material.opacity;
        }
        obj.material.transparent = true;
        obj.material.opacity = obj.userData.baseOpacity * value;
      }
    });
  }

  const PHONE_TARGET_POS = new THREE.Vector3(0, 0.1, 0.5);
  const PHONE_TARGET_ROT = new THREE.Euler(0.05, -0.25 + Math.PI * 0.6, 0.02);

  const phoneCenter = buildSmartphone('print-app.png');
  phoneCenter.position.copy(PHONE_TARGET_POS);
  phoneCenter.rotation.copy(PHONE_TARGET_ROT);
  phoneCenter.scale.setScalar(0.001);
  phoneCenter.visible = false;
  scene.add(phoneCenter);

  // Poeira Dourada 3D
  const DUST_COUNT = 60;
  const dustGeo = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 6;
    dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 6;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 4;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const goldDustMat = new THREE.PointsMaterial({
    color: 0xd4af37,
    size: 0.035,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const goldDust = new THREE.Points(dustGeo, goldDustMat);
  scene.add(goldDust);

  /* ---------------------------------------------------------------------
     4. LOGO MORPHING PARA PARTICULAS DO CELULAR
     --------------------------------------------------------------------- */
  const GRANULE_COUNT = 850;
  const granulePositions = new Float32Array(GRANULE_COUNT * 3);
  const logoOriginPositions = new Float32Array(GRANULE_COUNT * 3);
  const phoneTargetPositions = new Float32Array(GRANULE_COUNT * 3);

  for (let i = 0; i < GRANULE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const r = Math.random() * 1.2;
    logoOriginPositions[i * 3] = Math.cos(theta) * r;
    logoOriginPositions[i * 3 + 1] = Math.sin(theta) * r;
    logoOriginPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.2;

    phoneTargetPositions[i * 3] = (Math.random() - 0.5) * PHONE_BODY_WIDTH;
    phoneTargetPositions[i * 3 + 1] = (Math.random() - 0.5) * PHONE_BODY_HEIGHT;
    phoneTargetPositions[i * 3 + 2] = (Math.random() - 0.5) * PHONE_BODY_DEPTH;
  }

  granulePositions.set(logoOriginPositions);

  const granuleGeo = new THREE.BufferGeometry();
  granuleGeo.setAttribute('position', new THREE.BufferAttribute(granulePositions, 3));

  const granuleMat = new THREE.PointsMaterial({
    color: 0xd4af37,
    size: 0.045,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const logoGranules = new THREE.Points(granuleGeo, granuleMat);
  logoGranules.position.set(0, 0.3, 1.2);
  scene.add(logoGranules);

  const granuleMorph = { t: 0 };

  function updateGranules() {
    const pos = granuleGeo.attributes.position.array;
    const t = granuleMorph.t;
    for (let i = 0; i < GRANULE_COUNT; i++) {
      const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
      pos[ix] = logoOriginPositions[ix] + (phoneTargetPositions[ix] - logoOriginPositions[ix]) * t;
      pos[iy] = logoOriginPositions[iy] + (phoneTargetPositions[iy] - logoOriginPositions[iy]) * t;
      pos[iz] = logoOriginPositions[iz] + (phoneTargetPositions[iz] - logoOriginPositions[iz]) * t;
    }
    granuleGeo.attributes.position.needsUpdate = true;
  }

  // Notifica asset carregado do logo
  onAssetLoaded();

  /* ---------------------------------------------------------------------
     5. TELAS DO APP (SHOWCASE 2D/DOM)
     --------------------------------------------------------------------- */
  (function setupTelasShowcase() {
    const section = document.querySelector('.section-telas');
    if (!section) return;

    const screens = ['vitrine', 'carrinho', 'conta'];
    const phones = gsap.utils.toArray('.telas-phone', section);
    const panels = gsap.utils.toArray('.telas-panel', section);
    const dots = gsap.utils.toArray('.telas-dots button', section);

    let currentActive = screens[0];

    function setTelasFormation(newScreen) {
      phones.forEach((el) => {
        const isMatch = el.dataset.screen === newScreen;
        el.classList.toggle('is-front', isMatch);
        gsap.to(el, {
          scale: isMatch ? 1 : 0.75,
          opacity: isMatch ? 1 : 0.5,
          duration: 0.8,
          ease: 'power3.out'
        });
      });

      panels.forEach((el) => el.classList.toggle('is-active', el.dataset.screen === newScreen));
      dots.forEach((el) => el.classList.toggle('is-active', el.dataset.dot === newScreen));
      currentActive = newScreen;
    }

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        setTelasFormation(dot.dataset.dot);
      });
    });

    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      onEnter: () => setTelasFormation(currentActive)
    });
  })();

  /* ---------------------------------------------------------------------
     6. COREOGRAFIA GSAP SCROLLTRIGGER (SCRUB CINEMÁTICO)
     --------------------------------------------------------------------- */
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: 'main',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2
    }
  });

  const opacityCenter = { v: 1 };

  tl.to('#hero-logo-solid', { opacity: 0, scale: 0.9, duration: 0.6 }, 0.3)
    .to(granuleMat, { opacity: 1, duration: 0.6 }, 0.3)
    .to(granuleMorph, { t: 1, duration: 1.2, onUpdate: updateGranules }, 0.6)
    .set(phoneCenter, { visible: true }, 1.8)
    .fromTo(phoneCenter.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1, y: 1, z: 1, duration: 1.5, ease: 'power2.inOut' }, 1.8)
    .fromTo(opacityCenter, { v: 0 }, { v: 1, duration: 0.8, onUpdate: () => setPhoneOpacity(phoneCenter, opacityCenter.v) }, 1.8)
    .to(granuleMat, { opacity: 0, duration: 0.5 }, 1.8)
    .to(goldDustMat, { opacity: 0.8, duration: 0.5 }, 2.5)
    
    // Vitrine giratória
    .to(phoneCenter.rotation, { y: '+=' + Math.PI * 1.2, duration: 2.0, ease: 'none' }, 3.5)
    
    // Ateliê (desliza para lateral)
    .to(phoneCenter.position, { x: 2.0, y: -0.1, z: -0.5, duration: 2.0, ease: 'power2.inOut' }, 6.0)
    
    // Experiência Digital
    .to(phoneCenter.position, { x: -0.6, y: -0.08, z: -0.1, duration: 1.5, ease: 'power2.inOut' }, 8.5)
    
    // Portal zoom
    .to(phoneCenter.position, { x: 0, y: 0, z: 3.2, duration: 1.2, ease: 'power2.in' }, 10.5)
    .to(phoneCenter.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.5 }, 11.5)
    
    // Jornada do pedido
    .to(phoneCenter.scale, { x: 0.85, y: 0.85, z: 0.85, duration: 1.0 }, 13.0)
    .to(phoneCenter.position, { x: 2.5, y: -0.2, z: -5.0, duration: 1.8 }, 13.0)
    .to(opacityCenter, { v: 0.05, duration: 1.5, onUpdate: () => setPhoneOpacity(phoneCenter, opacityCenter.v) }, 13.0)
    
    // Conclusão / Download
    .to(phoneCenter.position, { x: -2.2, y: 0, z: 0.4, duration: 2.0 }, 17.5)
    .to(opacityCenter, { v: 1, duration: 1.5, onUpdate: () => setPhoneOpacity(phoneCenter, opacityCenter.v) }, 17.5);

  /* ---------------------------------------------------------------------
     7. DEGUSTAÇÃO DIGITAL — TROCA DE ATMOSFERA WEBGL
     --------------------------------------------------------------------- */
  const flavorCards = document.querySelectorAll('.flavor-card');
  const atmospheres = {
    champagne: {
      baseColor: new THREE.Color(0x12100E),
      goldColor: new THREE.Color(0xD4AF37),
      keyLight: new THREE.Color(0xffdf9e)
    },
    redvelvet: {
      baseColor: new THREE.Color(0x1A0D0E),
      goldColor: new THREE.Color(0xC94C4C),
      keyLight: new THREE.Color(0xffc2c4)
    },
    pistache: {
      baseColor: new THREE.Color(0x0E150D),
      goldColor: new THREE.Color(0x8CA870),
      keyLight: new THREE.Color(0xe6ffc2)
    }
  };

  flavorCards.forEach((card) => {
    card.addEventListener('click', () => {
      flavorCards.forEach(c => c.classList.remove('is-active'));
      card.classList.add('is-active');

      const flavor = card.dataset.flavor;
      const config = atmospheres[flavor];
      if (config) {
        gsap.to(bgUniforms.uBaseColor.value, { r: config.baseColor.r, g: config.baseColor.g, b: config.baseColor.b, duration: 1.2 });
        gsap.to(bgUniforms.uGoldColor.value, { r: config.goldColor.r, g: config.goldColor.g, b: config.goldColor.b, duration: 1.2 });
        gsap.to(keyLight.color, { r: config.keyLight.r, g: config.keyLight.g, b: config.keyLight.b, duration: 1.2 });
      }
    });
  });

  /* ---------------------------------------------------------------------
     8. INTERAÇÃO DE PONTEIRO & LOOP DE ANIMAÇÃO 60FPS
     --------------------------------------------------------------------- */
  const bgMouseTarget = new THREE.Vector2(0, 0);
  const bgMouseCurrent = new THREE.Vector2(0, 0);

  window.addEventListener('mousemove', (e) => {
    const mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    const mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    bgMouseTarget.set(mouseX * 8, mouseY * 8);

    pointer3D.position.x = mouseX * 4;
    pointer3D.position.y = mouseY * 4;
  }, { passive: true });

  const clock = new THREE.Clock();

  function animate() {
    const elapsed = clock.getElapsedTime();

    bgUniforms.uTime.value = elapsed;
    bgMouseCurrent.lerp(bgMouseTarget, 0.08);
    bgUniforms.uMouse.value.copy(bgMouseCurrent);

    if (phoneCenter && phoneCenter.visible) {
      phoneCenter.rotation.z = Math.sin(elapsed * 0.5) * 0.02;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  /* ---------------------------------------------------------------------
     9. HEADER SHOW/HIDE NO SCROLL
     --------------------------------------------------------------------- */
  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    const currentY = window.scrollY;
    siteHeader.classList.toggle('is-scrolled', currentY > 40);

    if (currentY > 120 && currentY > lastScrollY) {
      siteHeader.classList.add('header-hidden');
    } else {
      siteHeader.classList.remove('header-hidden');
    }
    lastScrollY = currentY;
  }, { passive: true });

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  gsap.delayedCall(5, () => {
    if (loader) loader.classList.add('is-hidden');
    releaseScrollLock();
  });
})();
