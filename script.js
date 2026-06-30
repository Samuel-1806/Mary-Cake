/* ===========================================================================
   MARY CAKE — Cenário 3D (Three.js) + Coreografia de Scroll (GSAP ScrollTrigger)
   ---------------------------------------------------------------------------
   Estrutura deste arquivo:
   1. Setup geral (cena, câmera, renderer, luzes de estúdio)
   2. Construção dos smartphones premium (geometria + materiais físicos)
   3. Texturização das telas com as imagens reais do app (com fallback de erro)
   4. Logo 3D de abertura (construído de forma síncrona p/ entrar na timeline)
   5. Relevo dourado interativo que segue o mouse (substitui as bolhas)
   6. Coreografia de scroll com GSAP ScrollTrigger — timeline única, 100% scrub
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
  const reliefEl = document.getElementById('relief');
  const noiseEl = document.getElementById('noise');
  const isMobile = window.matchMedia('(max-width: 860px)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Caminho-base dos assets — tudo fica em assets/ ao lado do index.html
  const ASSET_PATH = 'assets/';

  let assetsLoaded = 0;
  const TOTAL_ASSETS = 4; // logo + 3 telas de app

  function onAssetLoaded() {
    assetsLoaded = Math.min(assetsLoaded + 1, TOTAL_ASSETS);
    const pct = Math.min(100, Math.round((assetsLoaded / TOTAL_ASSETS) * 100));
    if (loaderProgress) loaderProgress.style.width = pct + '%';
    if (assetsLoaded >= TOTAL_ASSETS) {
      gsap.delayedCall(0.35, () => {
        loader.classList.add('is-hidden');
        ScrollTrigger.refresh();
      });
    }
  }

  /* ---------------------------------------------------------------------
     1. CENA, CÂMERA, RENDERER
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

  // TextureLoader único e compartilhado, com tratamento de erro robusto.
  const textureLoader = new THREE.TextureLoader();

  function loadTextureSafe(fileName, onSuccess) {
    const url = ASSET_PATH + fileName;
    textureLoader.load(
      url,
      (tex) => {
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        onSuccess(tex);
        onAssetLoaded();
      },
      undefined,
      (err) => {
        // Nunca deixa a tela "presa" em cinza nem o loader travado:
        // registra o erro e libera o progresso mesmo assim.
        console.error('[Mary Cake] Falha ao carregar textura:', url, err);
        onAssetLoaded();
      }
    );
  }

  function buildSmartphone(textureFile) {
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
      envMapIntensity: 1.4,
      transparent: true,
      opacity: 1
    });

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = false;
    group.add(body);

    // --- Tela (plano com a textura do app) ---
    const screenWidth = bodyWidth - 0.1;
    const screenHeight = bodyHeight - 0.1;
    const screenGeo = new THREE.PlaneGeometry(screenWidth, screenHeight, 1, 1);

    // Placeholder com tom quente neutro (nunca cinza "morto") até a textura chegar
    const placeholderMat = new THREE.MeshBasicMaterial({ color: 0x171411, transparent: true, opacity: 1 });
    const screen = new THREE.Mesh(screenGeo, placeholderMat);
    screen.position.z = bodyDepth / 2 + 0.012;
    group.add(screen);

    // Carrega a textura real do app de forma assíncrona, com fallback de erro
    loadTextureSafe(textureFile, (tex) => {
      screen.material.dispose();
      screen.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, opacity: 1 });
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
      color: 0x0a0a0a, metalness: 0.95, roughness: 0.1, transparent: true, opacity: 1
    });
    const camBump = new THREE.Mesh(camBumpGeo, camBumpMat);
    camBump.position.set(-bodyWidth / 2 + 0.28, bodyHeight / 2 - 0.4, -bodyDepth / 2 - 0.001);
    camBump.rotation.y = Math.PI;
    group.add(camBump);

    group.userData.screen = screen;
    return group;
  }

  // Proxy de opacidade por celular: usado para a desintegração final.
  // É tweenado DIRETAMENTE pela timeline principal (não em callback solto),
  // o que garante reversibilidade perfeita ao rolar para cima.
  function setPhoneOpacity(group, value) {
    group.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material.transparent = true;
        obj.material.opacity = value;
      }
    });
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
     3. LOGO DE ABERTURA
     IMPORTANTE: o mesh é criado de forma SÍNCRONA (geometria + material
     já existem no mesmo frame), e só a textura/imagem é carregada de
     forma assíncrona por cima. Isso garante que `logoMesh` já exista
     no momento em que a timeline do GSAP é montada logo abaixo —
     requisito para que o fade/scale do logo possa ser tweenado
     diretamente pela timeline principal (scrub), e não por um
     gsap.to() solto disparado por callback.
     --------------------------------------------------------------------- */
  const logoGeo = new THREE.PlaneGeometry(2.6, 2.6);
  const logoMat = new THREE.MeshBasicMaterial({
    map: null,
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    toneMapped: false
  });
  const logoMesh = new THREE.Mesh(logoGeo, logoMat);
  logoMesh.position.set(0, 0.3, 1.2);
  scene.add(logoMesh);

  loadTextureSafe('logo-mary-cake.png', (tex) => {
    logoMat.map = tex;
    logoMat.needsUpdate = true;
  });

  // Flutuação suave de entrada (efeito hero, independente do scroll)
  logoMesh.scale.setScalar(0.001);
  gsap.to(logoMesh.scale, { x: 1, y: 1, z: 1, duration: 1.6, delay: 0.15, ease: 'power3.out' });

  /* ---------------------------------------------------------------------
     4. RELEVO DOURADO INTERATIVO — substitui por completo as antigas
     "bolhas de champagne". Ao mover o mouse, um par de gradientes
     radiais (claro + escuro), levemente deslocados, cria a ilusão de
     uma esfera empurrando o papel por baixo da tela. O movimento é
     suavizado via lerp em requestAnimationFrame para um efeito físico,
     não instantâneo.
     --------------------------------------------------------------------- */
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;
  let reliefActive = false;

  function updateReliefTarget(clientX, clientY) {
    targetX = clientX;
    targetY = clientY;
    if (!reliefActive && reliefEl) {
      reliefActive = true;
      reliefEl.classList.add('is-active');
    }
  }

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

    // Relevo dourado em CSS acompanha o cursor (com easing próprio no loop de render)
    updateReliefTarget(clientX, clientY);
  }

  window.addEventListener('mousemove', (e) => handlePointerMove(e.clientX, e.clientY));
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });
  window.addEventListener('mouseleave', () => {
    if (reliefEl) { reliefEl.classList.remove('is-active'); reliefActive = false; }
  });

  /* ---------------------------------------------------------------------
     6. TOUCH: rotação manual sutil dos celulares (mobile)
     --------------------------------------------------------------------- */
  let touchStartX = null;

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
     ---------------------------------------------------------------------
     REGRA DE OURO PARA REVERSIBILIDADE TOTAL:
     TUDO que faz parte da coreografia (posição, rotação, escala,
     opacidade de materiais Three.js e opacidade/posição de elementos
     DOM) é tweenado DIRETAMENTE pela timeline (`tl.to(...)`), nunca
     por um `gsap.to()` solto disparado de dentro de um `.add(callback)`.
     Tweens soltos têm vida própria (duração fixa, tocam uma vez) e
     IGNORAM a posição/direção do scrub — é exatamente isso que
     quebrava a animação ao rolar para cima. Com scrub:1 e tudo dentro
     de `tl`, o progresso da timeline passa a ser uma função pura da
     posição do scroll, em ambas as direções.
     --------------------------------------------------------------------- */
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: 'main',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1
    }
  });

  // Proxies de opacidade para os 3 celulares (necessário pois cada grupo
  // tem vários materiais internos — body, vidro, câmera, tela — e a tela
  // troca de material assim que a textura chega).
  const opacityCenter = { v: 1 };
  const opacityLeft = { v: 1 };
  const opacityRight = { v: 1 };

  // ---- SEÇÃO 1 (Hero -> Ateliê): logo se dissolve, celular central nasce e flutua de frente
  tl.to(logoMat, { opacity: 0, duration: 1, ease: 'power2.out' }, 0)
    .to(logoMesh.scale, { x: 0.3, y: 0.3, z: 0.3, duration: 1, ease: 'power2.in' }, 0)
    .to(phoneCenter.scale, { x: 1, y: 1, z: 1, duration: 1, ease: 'back.out(1.4)' }, 0.15)
    .to(phoneCenter.position, { x: 0, y: 0.1, z: 0.5, duration: 1 }, 0.15)
    .to(phoneCenter.rotation, { y: '+=' + (Math.PI * 0.6), duration: 1, ease: 'power2.out' }, 0.15)

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
    .to('.phone-tag', { opacity: 1, y: 0, duration: 0.9, stagger: 0.15, ease: 'power2.out' }, 3.6)
    .to('.phone-tag', { opacity: 0, y: 14, duration: 0.5, ease: 'power2.in' }, 4.7)

    // ---- SEÇÃO 4 (Jornada do Pedido): macro zoom inclinado na tela central
    .to(camera.position, { x: 0.15, y: 0.85, z: 2.6, duration: 1.6, ease: 'power2.inOut' }, 5)
    .to(camera.rotation, { x: -0.32, duration: 1.6 }, 5)
    .to(phoneCenter.position, { x: 0, y: 0.1, z: 1, duration: 1.6 }, 5)
    .to(phoneCenter.rotation, { x: 0.08, y: 0, duration: 1.6 }, 5)
    .to([phoneLeft.position, phoneRight.position], { z: '-=0.6', duration: 1.6 }, 5)

    // ---- SEÇÃO 5 (Compromisso com o Sabor): texto fica à esquerda, celulares migram para a direita
    .to(camera.position, { x: 1.4, y: 0.1, z: 6.5, duration: 1.8, ease: 'power2.inOut' }, 6.8)
    .to(camera.rotation, { x: 0, duration: 1.8 }, 6.8)
    .to(phoneCenter.position, { x: 2.1, y: 0, z: -0.3, duration: 1.8 }, 6.8)
    .to(phoneCenter.rotation, { y: -0.35, duration: 1.8 }, 6.8)
    .to(phoneLeft.position, { x: 0.9, z: -2.2, duration: 1.8 }, 6.8)
    .to(phoneRight.position, { x: 3.8, z: -2.4, duration: 1.8 }, 6.8)

    // ---- SEÇÃO 6 (Download): DESINTEGRAÇÃO — celulares são sugados ao centro,
    // encolhem e se dissolvem por completo, liberando o fundo para o QR Code.
    // A opacidade agora é tweenada via proxy DENTRO da timeline (tl.to), com
    // onUpdate aplicando o valor aos materiais — isso é o que garante que,
    // ao rolar de volta para cima, os celulares reaparecem perfeitamente.
    .to(camera.position, { x: 0, y: 0, z: 9, duration: 1.8, ease: 'power2.inOut' }, 8.7)
    .to([phoneCenter.position, phoneLeft.position, phoneRight.position], { x: 0, y: 0, z: '-=2', duration: 1.8, ease: 'power2.in' }, 8.7)
    .to([phoneCenter.rotation, phoneLeft.rotation, phoneRight.rotation], { y: '+=3.2', duration: 1.8, ease: 'power2.in' }, 8.7)
    .to([phoneCenter.scale, phoneLeft.scale, phoneRight.scale], { x: 0, y: 0, z: 0, duration: 1.8, ease: 'power3.in' }, 8.7)
    .to(opacityCenter, {
      v: 0, duration: 1.6, ease: 'power2.in',
      onUpdate: () => setPhoneOpacity(phoneCenter, opacityCenter.v)
    }, 8.7)
    .to(opacityLeft, {
      v: 0, duration: 1.6, ease: 'power2.in',
      onUpdate: () => setPhoneOpacity(phoneLeft, opacityLeft.v)
    }, 8.7)
    .to(opacityRight, {
      v: 0, duration: 1.6, ease: 'power2.in',
      onUpdate: () => setPhoneOpacity(phoneRight, opacityRight.v)
    }, 8.7);

  /* ---------------------------------------------------------------------
     8. RESIZE / RESPONSIVO — celulares reescalam no mobile sem cobrir texto
     --------------------------------------------------------------------- */
  function applyResponsiveLayout() {
    const mobile = window.innerWidth <= 860;
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
  const RELIEF_LERP = 0.12;

  function animate() {
    const elapsed = clock.getElapsedTime();

    // Flutuação ambiente sutil (idle) para os celulares — sensação "viva"
    if (!prefersReducedMotion) {
      phoneCenter.position.y += Math.sin(elapsed * 0.7) * 0.0009;
      phoneLeft.position.y += Math.sin(elapsed * 0.6 + 1.2) * 0.0007;
      phoneRight.position.y += Math.sin(elapsed * 0.65 + 2.1) * 0.0007;
    }

    // Suaviza o movimento do relevo dourado (efeito físico, não instantâneo)
    if (reliefEl) {
      currentX += (targetX - currentX) * RELIEF_LERP;
      currentY += (targetY - currentY) * RELIEF_LERP;
      reliefEl.style.setProperty('--bump-x', currentX.toFixed(1) + 'px');
      reliefEl.style.setProperty('--bump-y', currentY.toFixed(1) + 'px');
      // Leve distorção física do grão de papel, acompanhando o relevo (paralaxe sutil)
      if (noiseEl) {
        const nx = (currentX / window.innerWidth - 0.5) * 6;
        const ny = (currentY / window.innerHeight - 0.5) * 6;
        noiseEl.style.transform = `translate3d(${nx.toFixed(2)}px, ${ny.toFixed(2)}px, 0)`;
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  /* ---------------------------------------------------------------------
     10. LINKS / CTAs — desktop mostra QR, mobile mostra botão de APK
     --------------------------------------------------------------------- */
  const SITE_URL = 'https://mary-cake.netlify.app/';
  const APK_URL = 'https://mary-cake.netlify.app/download/mary-cake.apk'; // ajuste para o link real do APK

  const qrCard = document.getElementById('qr-card');
  if (qrCard) {
    qrCard.addEventListener('click', () => window.open(SITE_URL, '_blank'));
  }

  const apkBtn = document.getElementById('apk-download');
  if (apkBtn) apkBtn.setAttribute('href', APK_URL);

  document.getElementById('year').textContent = new Date().getFullYear();

  /* Fallback: caso algum asset falhe silenciosamente, garante que o loader some */
  gsap.delayedCall(6, () => loader.classList.add('is-hidden'));
})();
