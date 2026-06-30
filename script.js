/* ===========================================================================
   MARY CAKE — Cenário 3D (Three.js) + Coreografia de Scroll (GSAP ScrollTrigger)
   ---------------------------------------------------------------------------
   Estrutura deste arquivo:
   1. Setup geral (cena, câmera, renderer, luzes de estúdio)
   2. Construção dos smartphones premium (geometria + materiais físicos)
   3. Texturização das telas com as imagens reais do app
   4. Logo interativo em partículas (efeito hero)
   5. Partículas de "champagne" seguindo o mouse/touch
   6. Coreografia de scroll com GSAP ScrollTrigger (timeline única)
   7. Responsividade (resize + touch) e loop de animação
   =========================================================================== */

(() => {
  gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------------------
     0. ESTADO GLOBAL E ELEMENTOS
     --------------------------------------------------------------------- */
  const canvas = document.getElementById('webgl-canvas');
  const loader = document.getElementById('loader');
  const loaderProgress = document.getElementById('loader-progress');
  const isMobile = window.matchMedia('(max-width: 860px)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let assetsLoaded = 0;
  const TOTAL_ASSETS = 4; // logo + 3 telas de app

  /* ---------------------------------------------------------------------
     1. SCENA, CÂMERA, RENDERER
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
  renderer.toneMappingExposure = 1.05;

  /* ---------------------------------------------------------------------
     1b. ILUMINAÇÃO DE ESTÚDIO — champagne/dourada, simulando rebatedores
     --------------------------------------------------------------------- */
  const ambient = new THREE.AmbientLight(0xfff3e0, 0.55);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffe6c2, 1.4); // luz quente principal
  keyLight.position.set(4, 5, 6);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xd9b878, 0.9); // contraluz dourada (rim)
  rimLight.position.set(-5, -2, -4);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.35); // preenchimento neutro suave
  fillLight.position.set(-3, 2, 4);
  scene.add(fillLight);

  // Pequeno ponto de luz "estúdio" que segue suavemente o mouse, para reflexos vivos
  const pointer3D = new THREE.PointLight(0xffd9a0, 0.6, 12);
  pointer3D.position.set(0, 0, 4);
  scene.add(pointer3D);

  /* ---------------------------------------------------------------------
     2. GEOMETRIA DO SMARTPHONE PREMIUM
     Chassi com bordas arredondadas via ExtrudeGeometry + bevel,
     material metálico físico para reflexos elegantes ao rotacionar.
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

  function buildSmartphone(textureUrl) {
    const group = new THREE.Group();

    // --- Chassi (corpo metálico) ---
    const bodyWidth = 1.62;
    const bodyHeight = 3.3;
    const bodyDepth = 0.16;
    const cornerRadius = 0.22;

    const shape = createRoundedRectShape(bodyWidth, bodyHeight, cornerRadius);
    const extrudeSettings = {
      depth: bodyDepth,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 6,
      curveSegments: 24
    };
    const bodyGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    bodyGeo.center();

    // Material físico premium: metalness/roughness altos geram reflexos
    // elegantes e dinâmicos nas bordas curvas, como pedido no briefing.
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1c,
      metalness: 0.9,
      roughness: 0.15,
      envMapIntensity: 1.4
    });

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = false;
    group.add(body);

    // --- Tela (plano com a textura do app) ---
    const screenWidth = bodyWidth - 0.1;
    const screenHeight = bodyHeight - 0.1;
    const screenGeo = new THREE.PlaneGeometry(screenWidth, screenHeight, 1, 1);

    const placeholderMat = new THREE.MeshBasicMaterial({ color: 0x0c0c0d });
    const screen = new THREE.Mesh(screenGeo, placeholderMat);
    screen.position.z = bodyDepth / 2 + 0.012;
    group.add(screen);

    // Carrega a textura real do app de forma assíncrona
    const loader = new THREE.TextureLoader();
    loader.load(textureUrl, (tex) => {
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.minFilter = THREE.LinearFilter;
      screen.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      onAssetLoaded();
    });

    // --- Leve brilho de vidro sobre a tela (highlight sutil) ---
    const glassGeo = new THREE.PlaneGeometry(screenWidth, screenHeight);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.06,
      roughness: 0.05,
      metalness: 0,
      transmission: 0.9,
      clearcoat: 1
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.z = bodyDepth / 2 + 0.014;
    group.add(glass);

    // --- Câmera traseira (detalhe de realismo) ---
    const camBumpGeo = new THREE.CircleGeometry(0.085, 24);
    const camBumpMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a, metalness: 0.95, roughness: 0.1
    });
    const camBump = new THREE.Mesh(camBumpGeo, camBumpMat);
    camBump.position.set(-bodyWidth / 2 + 0.28, bodyHeight / 2 - 0.4, -bodyDepth / 2 - 0.001);
    camBump.rotation.y = Math.PI;
    group.add(camBump);

    group.userData.screen = screen;
    return group;
  }

  function onAssetLoaded() {
    assetsLoaded++;
    const pct = Math.min(100, Math.round((assetsLoaded / TOTAL_ASSETS) * 100));
    if (loaderProgress) loaderProgress.style.width = pct + '%';
    if (assetsLoaded >= TOTAL_ASSETS) {
      gsap.delayedCall(0.35, () => {
        loader.classList.add('is-hidden');
        ScrollTrigger.refresh();
      });
    }
  }

  // Três smartphones — central (vitrine), esquerda (carrinho), direita (conta)
  const phoneCenter = buildSmartphone('print_app.png');
  const phoneLeft = buildSmartphone('print-carrinho.png');
  const phoneRight = buildSmartphone('print-conta.png');

  // Posições/escala iniciais: tudo começa "fora de cena" exceto o central,
  // que representa o herói. A coreografia de scroll cuida do resto.
  phoneCenter.position.set(0, -0.2, 0);
  phoneCenter.rotation.set(0.05, -0.25, 0.02);
  phoneCenter.scale.setScalar(0.001); // nasce do logo (efeito hero)

  phoneLeft.position.set(-3.4, 0.3, -1.5);
  phoneLeft.rotation.set(0.1, 0.5, -0.08);
  phoneLeft.scale.setScalar(0.78);
  phoneLeft.visible = false;

  phoneRight.position.set(3.4, -0.3, -1.5);
  phoneRight.rotation.set(-0.08, -0.5, 0.08);
  phoneRight.scale.setScalar(0.78);
  phoneRight.visible = false;

  scene.add(phoneCenter, phoneLeft, phoneRight);

  /* ---------------------------------------------------------------------
     3. LOGO INTERATIVO EM PARTÍCULAS
     O logo-mary-cake.png é amostrado em um canvas 2D para extrair pontos
     do seu contorno, que viram uma nuvem de partículas em 3D. Essa nuvem
     "esculpe" o logo no ar nos primeiros segundos e depois se dissolve
     para revelar o smartphone central — o efeito "uau" pedido.
     --------------------------------------------------------------------- */
  let logoParticles = null;

  function buildLogoParticles(imageUrl, callback) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const sampleSize = 110; // resolução de amostragem (qualidade x performance)
      const off = document.createElement('canvas');
      off.width = sampleSize;
      off.height = sampleSize;
      const ctx = off.getContext('2d');
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

      const positions = [];
      const colors = [];
      const targetPositions = [];

      const goldColor = new THREE.Color(0xC9A14A);
      const coralColor = new THREE.Color(0xF08C76);

      for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
          const i = (y * sampleSize + x) * 4;
          const alpha = data[i + 3];
          if (alpha > 80) { // pixel visível do logo
            const nx = (x / sampleSize - 0.5) * 4.2;
            const ny = -(y / sampleSize - 0.5) * 4.2;

            // Posição alvo (forma final do logo)
            targetPositions.push(nx, ny, 0);

            // Posição inicial: dispersa aleatoriamente no espaço (efeito de "montagem")
            positions.push(
              (Math.random() - 0.5) * 14,
              (Math.random() - 0.5) * 14,
              (Math.random() - 0.5) * 14
            );

            // Cor: mistura entre dourado e coral baseada no canal vermelho do pixel
            const r = data[i] / 255;
            const mixed = goldColor.clone().lerp(coralColor, r);
            colors.push(mixed.r, mixed.g, mixed.b);
          }
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.045,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      const points = new THREE.Points(geometry, material);
      points.userData.targets = targetPositions;
      points.position.set(0, 0.4, 0.5);
      scene.add(points);

      callback(points);
      onAssetLoaded();
    };
    img.onerror = onAssetLoaded;
    img.src = imageUrl;
  }

  buildLogoParticles('logo-mary-cake.png', (points) => {
    logoParticles = points;

    // Animação de "montagem": partículas voam do caos até formar o logo
    const posAttr = points.geometry.attributes.position;
    const targets = points.userData.targets;
    const tmp = { t: 0 };

    gsap.to(tmp, {
      t: 1,
      duration: 2.6,
      delay: 0.3,
      ease: 'power3.out',
      onUpdate: () => {
        for (let i = 0; i < posAttr.count; i++) {
          const ix = i * 3;
          const sx = posAttr.array[ix], sy = posAttr.array[ix + 1], sz = posAttr.array[ix + 2];
          const tx = targets[ix], ty = targets[ix + 1], tz = targets[ix + 2];
          posAttr.array[ix]     = sx + (tx - sx) * tmp.t;
          posAttr.array[ix + 1] = sy + (ty - sy) * tmp.t;
          posAttr.array[ix + 2] = sz + (tz - sz) * tmp.t;
        }
        posAttr.needsUpdate = true;
      }
    });
  });

  /* ---------------------------------------------------------------------
     4. PARTÍCULAS DE CHAMPAGNE — rastro do mouse/touch
     Bolhas douradas translúcidas, discretas, que sobem e se dissipam.
     --------------------------------------------------------------------- */
  const MAX_BUBBLES = 90;
  const bubbleGeo = new THREE.SphereGeometry(1, 8, 8);
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: 0xE9C77E,
    transparent: true,
    opacity: 0.5,
    roughness: 0.1,
    metalness: 0,
    transmission: 0.7,
    clearcoat: 1
  });

  const bubblesMesh = new THREE.InstancedMesh(bubbleGeo, bubbleMat, MAX_BUBBLES);
  bubblesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(bubblesMesh);

  const bubbles = Array.from({ length: MAX_BUBBLES }, () => ({
    active: false,
    x: 0, y: 0, z: 0,
    vy: 0, vx: 0,
    life: 0,
    maxLife: 0,
    scale: 0
  }));
  let bubbleCursor = 0;

  function spawnBubble(x, y) {
    const b = bubbles[bubbleCursor];
    bubbleCursor = (bubbleCursor + 1) % MAX_BUBBLES;
    b.active = true;
    b.x = x + (Math.random() - 0.5) * 0.25;
    b.y = y + (Math.random() - 0.5) * 0.25;
    b.z = (Math.random() - 0.5) * 0.6;
    b.vy = 0.4 + Math.random() * 0.5;
    b.vx = (Math.random() - 0.5) * 0.15;
    b.life = 0;
    b.maxLife = 0.9 + Math.random() * 0.6;
    b.scale = 0.012 + Math.random() * 0.018;
  }

  const dummyMatrix = new THREE.Object3D();
  let lastSpawn = 0;

  /* ---------------------------------------------------------------------
     5. CONVERSÃO DE COORDENADAS DE TELA -> MUNDO 3D (plano z=0)
     --------------------------------------------------------------------- */
  const raycastPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const worldPoint = new THREE.Vector3();

  function screenToWorld(clientX, clientY) {
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    raycaster.ray.intersectPlane(raycastPlane, worldPoint);
    return worldPoint;
  }

  function handlePointerMove(clientX, clientY) {
    const p = screenToWorld(clientX, clientY);

    // Luz de estúdio acompanha o ponteiro suavemente (reflexos vivos no metal)
    gsap.to(pointer3D.position, { x: p.x, y: p.y, z: 4, duration: 0.6, ease: 'power2.out', overwrite: true });

    const now = performance.now();
    if (now - lastSpawn > 45) {
      spawnBubble(p.x, p.y);
      lastSpawn = now;
    }
  }

  window.addEventListener('mousemove', (e) => handlePointerMove(e.clientX, e.clientY));
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  /* ---------------------------------------------------------------------
     6. TOUCH: rotação manual sutil dos celulares (mobile)
     --------------------------------------------------------------------- */
  let touchStartX = null;
  let touchRotationOffset = { center: 0, left: 0, right: 0 };

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) touchStartX = e.touches[0].clientX;
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (touchStartX === null || !e.touches || !e.touches[0]) return;
    const delta = (e.touches[0].clientX - touchStartX) * 0.0026;
    [phoneCenter, phoneLeft, phoneRight].forEach((phone) => {
      if (phone.visible) phone.rotation.y += delta * 0.4;
    });
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  canvas.addEventListener('touchend', () => { touchStartX = null; }, { passive: true });

  /* ---------------------------------------------------------------------
     7. COREOGRAFIA DE SCROLL — GSAP ScrollTrigger, timeline única
     scrub:1 garante acompanhamento milimétrico do scroll, sem saltos.
     --------------------------------------------------------------------- */
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: 'main',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1
    }
  });

  // ---- SEÇÃO 1 (Hero -> Ateliê): logo se dissolve, celular central nasce e flutua de frente
  tl.to(logoParticles ? logoParticles.material : {}, {
      opacity: 0,
      duration: 1,
      onStart: () => { if (logoParticles) gsap.to(logoParticles.scale, { x: 1.4, y: 1.4, z: 1.4, duration: 1 }); }
    }, 0)
    .to(phoneCenter.scale, { x: 1, y: 1, z: 1, duration: 1, ease: 'back.out(1.4)' }, 0.15)
    .to(phoneCenter.position, { x: 0, y: 0.1, z: 0.5, duration: 1 }, 0.15)

    // ---- SEÇÃO 2 (Ateliê): giro completo 360° no eixo Y, desloca para a direita
    .to(phoneCenter.rotation, { y: '+=' + (Math.PI * 2), duration: 2, ease: 'power1.inOut' }, 1)
    .to(phoneCenter.position, { x: 2.1, y: -0.1, z: -0.5, duration: 2 }, 1)

    // ---- SEÇÃO 3 (Experiência Digital): os 3 celulares surgem juntos no centro
    .to(phoneCenter.position, { x: 0, y: 0, z: 0, duration: 1.4, ease: 'power2.inOut' }, 3.1)
    .to(phoneCenter.rotation, { x: 0, y: -0.18, z: 0, duration: 1.4 }, 3.1)
    .set(phoneLeft, { visible: true }, 3.3)
    .set(phoneRight, { visible: true }, 3.3)
    .fromTo(phoneLeft.position, { x: -5, y: 0.3, z: -2 }, { x: -1.85, y: -0.15, z: -0.6, duration: 1.4, ease: 'power2.out' }, 3.3)
    .fromTo(phoneRight.position, { x: 5, y: -0.3, z: -2 }, { x: 1.85, y: -0.15, z: -0.6, duration: 1.4, ease: 'power2.out' }, 3.3)
    .to(phoneLeft.rotation, { y: 0.42, x: 0.05, duration: 1.4 }, 3.3)
    .to(phoneRight.rotation, { y: -0.42, x: 0.05, duration: 1.4 }, 3.3)

    // ---- SEÇÃO 4 (Jornada do Pedido): macro zoom inclinado na tela central
    .to(camera.position, { x: 0.15, y: 0.85, z: 2.6, duration: 1.6, ease: 'power2.inOut' }, 5)
    .to(camera.rotation, { x: -0.32, duration: 1.6 }, 5)
    .to(phoneCenter.position, { x: 0, y: 0.1, z: 1, duration: 1.6 }, 5)
    .to(phoneCenter.rotation, { x: 0.08, y: 0, duration: 1.6 }, 5)
    .to([phoneLeft.position, phoneRight.position], { z: '-=0.6', duration: 1.6 }, 5)

    // ---- SEÇÃO 5 (Compromisso com o Sabor): transição lateral suave
    .to(camera.position, { x: -1.4, y: 0.1, z: 6.5, duration: 1.8, ease: 'power2.inOut' }, 6.8)
    .to(camera.rotation, { x: 0, duration: 1.8 }, 6.8)
    .to(phoneCenter.position, { x: -1.6, y: 0, z: -0.3, duration: 1.8 }, 6.8)
    .to(phoneCenter.rotation, { y: 0.35, duration: 1.8 }, 6.8)
    .to(phoneLeft.position, { x: -3.4, z: -2.2, duration: 1.8 }, 6.8)
    .to(phoneRight.position, { x: 3.6, z: -2.4, duration: 1.8 }, 6.8)

    // ---- SEÇÃO 6 (Download): celulares recuam e desfocam; QR ganha destaque (CSS cuida do glass)
    .to(camera.position, { x: 0, y: 0, z: 9, duration: 1.8, ease: 'power2.inOut' }, 8.7)
    .to([phoneCenter.position, phoneLeft.position, phoneRight.position], { z: '-=5', duration: 1.8 }, 8.7)
    .to([phoneCenter.scale, phoneLeft.scale, phoneRight.scale], { x: 0.55, y: 0.55, z: 0.55, duration: 1.8 }, 8.7)
    .to([phoneCenter.position, phoneLeft.position, phoneRight.position], { y: '-=0.4', duration: 1.8 }, 8.7);

  /* ---------------------------------------------------------------------
     8. RESIZE / RESPONSIVO — celulares reescalam no mobile sem cobrir texto
     --------------------------------------------------------------------- */
  function applyResponsiveLayout() {
    const mobile = window.innerWidth <= 860;
    const baseScale = mobile ? 0.6 : 1;
    const sideOffset = mobile ? 1.55 : 1.85;

    phoneLeft.userData.baseX = mobile ? -sideOffset : -sideOffset;
    phoneRight.userData.baseX = mobile ? sideOffset : sideOffset;

    if (mobile) {
      // No mobile, recuamos levemente os celulares para o fundo (z negativo)
      // e reduzimos a escala-base para nunca cobrir os blocos de texto.
      phoneCenter.userData.mobileScale = 0.72;
      phoneLeft.userData.mobileScale = 0.5;
      phoneRight.userData.mobileScale = 0.5;
      camera.position.z = 10.5;
    } else {
      phoneCenter.userData.mobileScale = 1;
      phoneLeft.userData.mobileScale = 0.78;
      phoneRight.userData.mobileScale = 0.78;
      camera.position.z = 9;
    }
  }
  applyResponsiveLayout();

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    applyResponsiveLayout();
    ScrollTrigger.refresh();
  }
  window.addEventListener('resize', onResize);

  /* ---------------------------------------------------------------------
     9. LOOP DE RENDERIZAÇÃO
     --------------------------------------------------------------------- */
  const clock = new THREE.Clock();

  function animate() {
    const elapsed = clock.getElapsedTime();
    const delta = clock.getDelta();

    // Flutuação ambiente sutil (idle) para os celulares — sensação "viva"
    if (!prefersReducedMotion) {
      phoneCenter.position.y += Math.sin(elapsed * 0.7) * 0.0009;
      phoneLeft.position.y += Math.sin(elapsed * 0.6 + 1.2) * 0.0007;
      phoneRight.position.y += Math.sin(elapsed * 0.65 + 2.1) * 0.0007;
    }

    // Atualiza bolhas de champagne
    for (let i = 0; i < MAX_BUBBLES; i++) {
      const b = bubbles[i];
      if (!b.active) {
        dummyMatrix.position.set(9999, 9999, 9999);
        dummyMatrix.scale.setScalar(0.0001);
        dummyMatrix.updateMatrix();
        bubblesMesh.setMatrixAt(i, dummyMatrix.matrix);
        continue;
      }
      b.life += delta;
      if (b.life >= b.maxLife) { b.active = false; continue; }

      const t = b.life / b.maxLife;
      b.x += b.vx * delta;
      b.y += b.vy * delta;
      const fade = 1 - t;

      dummyMatrix.position.set(b.x, b.y, b.z);
      dummyMatrix.scale.setScalar(b.scale * fade);
      dummyMatrix.updateMatrix();
      bubblesMesh.setMatrixAt(i, dummyMatrix.matrix);
    }
    bubblesMesh.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  /* ---------------------------------------------------------------------
     10. LINKS / CTAs — desktop mostra QR, mobile mostra botão de APK
     --------------------------------------------------------------------- */
  const SITE_URL = 'https://mary-cake.netlify.app/';
  const APK_URL = 'https://mary-cake.netlify.app/download/mary-cake.apk'; // ajuste para o link real do APK

  document.querySelectorAll('.btn-header, .qr-text').forEach((el) => {
    // O cartão de QR já aponta visualmente para o site; mantemos o link clicável também.
  });

  const qrCard = document.getElementById('qr-card');
  if (qrCard) {
    qrCard.style.cursor = 'pointer';
    qrCard.addEventListener('click', () => window.open(SITE_URL, '_blank'));
  }

  const apkBtn = document.getElementById('apk-download');
  if (apkBtn) apkBtn.setAttribute('href', APK_URL);

  document.getElementById('year').textContent = new Date().getFullYear();

  /* Fallback: caso algum asset falhe silenciosamente, garante que o loader some */
  gsap.delayedCall(6, () => loader.classList.add('is-hidden'));
})();
