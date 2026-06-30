/* ===========================================================================
   MARY CAKE — Cenário 3D (Three.js) + Coreografia de Scroll (GSAP ScrollTrigger)
   ---------------------------------------------------------------------------
   Estrutura deste arquivo:
   1. Setup geral (cena, câmera, renderer, luzes de estúdio)
   2. Fundo vivo — malha 3D (grid minimalista) com deformação dourada que
      segue o cursor com precisão (substitui por completo a antiga mancha
      escura em CSS)
   3. Construção dos smartphones premium (geometria + materiais físicos)
   4. Texturização das telas com as imagens reais do app (com fallback de erro)
   5. Logo 3D de abertura + transição cinemática (giro, queda e desintegração
      em partículas, sincronizada com o nascimento do primeiro celular)
   6. Conversão de coordenadas de tela -> mundo 3D + interação de ponteiro
   7. Coreografia de scroll com GSAP ScrollTrigger — timeline única, 100% scrub
   8. Responsividade (resize + touch) e loop de animação
   =========================================================================== */

(() => {
  gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------------------
     0. ESTADO GLOBAL E ELEMENTOS
     --------------------------------------------------------------------- */
  const canvas = document.getElementById('webgl-canvas');
  const loader = document.getElementById('loader');
  const loaderProgress = document.getElementById('loader-progress');
  const noiseEl = document.getElementById('noise');
  const isMobile = window.matchMedia('(max-width: 860px)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Caminho-base dos assets — logo + prints do app ficam dentro da pasta
  // assets/, ao lado do index.html (mesma estrutura usada no repositório).
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
     (Apenas as carcaças metálicas dos celulares reagem a estas luzes; as
     TELAS usam MeshBasicMaterial — não-iluminado — então a textura do app
     nunca escurece, não importa a posição das luzes.)
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
     2. FUNDO VIVO — GRID MINIMALISTA 3D COM RELEVO DOURADO
     ---------------------------------------------------------------------
     Substitui por completo a antiga "mancha escura" em CSS. É uma malha
     plana, levemente ondulada por uma animação contínua e sutil (idle),
     que ganha uma deformação dourada pontual e precisa exatamente sob o
     cursor — como se a luz revelasse um relevo de luxo no papel.
     A posição do relevo é calculada via raycasting real (mundo 3D), não
     por aproximação em pixels — por isso acompanha o cursor com fidelidade.
     --------------------------------------------------------------------- */
  const BG_Z = -6.4;
  const bgSegments = isMobile ? 46 : 96;
  const bgPlaneGeo = new THREE.PlaneGeometry(48, 48, bgSegments, bgSegments);

  const bgUniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uMouseActive: { value: 0 },
    uInkColor: { value: new THREE.Color(0x2a2118) },
    uGoldColor: { value: new THREE.Color(0xC9A14A) },
    uGoldLight: { value: new THREE.Color(0xF3DDA0) }
  };

  const bgVertexShader = `
    varying float vBump;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uMouseActive;

    void main() {
      vec3 pos = position;

      // Movimento contínuo e sutil — como uma onda muito leve respirando no papel
      float ambient = sin(pos.x * 0.42 + uTime * 0.22) * 0.05
                     + cos(pos.y * 0.34 - uTime * 0.17) * 0.045;

      // Deformação dourada pontual: segue o cursor com precisão via raycast real
      float dist = distance(pos.xy, uMouse);
      float bump = exp(-dist * dist * 0.85) * uMouseActive;

      pos.z += ambient * 0.4 + bump * 1.15;
      vBump = bump;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const bgFragmentShader = `
    precision mediump float;
    varying float vBump;
    uniform vec2 uMouse;
    uniform vec3 uInkColor;
    uniform vec3 uGoldColor;
    uniform vec3 uGoldLight;

    void main() {
      // Grid minimalista: linhas finas sempre presentes, sutis o bastante
      // para não competir com o conteúdo, mas reforçando a grade editorial.
      vec2 grid = gl_FragCoord.xy / 26.0;
      vec2 gridFrac = abs(fract(grid - 0.5) - 0.5);
      vec2 aa = fwidth(grid) * 1.5;
      vec2 lines2 = smoothstep(vec2(0.0), aa, gridFrac);
      float line = 1.0 - min(lines2.x, lines2.y);

      float bumpStrength = clamp(vBump * 1.7, 0.0, 1.0);

      // Sombra/relevo de luxo: nunca escurece para um tom "sujo" — vai do
      // grid neutro direto para um dourado elegante e luminoso.
      vec3 color = mix(uInkColor, mix(uGoldColor, uGoldLight, bumpStrength), bumpStrength);

      float baseAlpha = line * 0.045;
      float goldAlpha = line * bumpStrength * 0.62 + bumpStrength * 0.05;

      gl_FragColor = vec4(color, baseAlpha + goldAlpha);
    }
  `;

  const bgMat = new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    vertexShader: bgVertexShader,
    fragmentShader: bgFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    extensions: { derivatives: true }
  });

  const bgMesh = new THREE.Mesh(bgPlaneGeo, bgMat);
  bgMesh.position.z = BG_Z;
  bgMesh.renderOrder = -1;
  scene.add(bgMesh);

  /* ---------------------------------------------------------------------
     3. GEOMETRIA DO SMARTPHONE PREMIUM
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

    // Carrega a textura real do app de forma assíncrona, com fallback de erro.
    // MeshBasicMaterial = não-iluminado, então nenhuma luz de cena pode escurecer a tela.
    loadTextureSafe(textureFile, (tex) => {
      screen.material.dispose();
      screen.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, opacity: 1 });
    });

    // --- Leve brilho de vidro sobre a tela (highlight sutil) ---
    // OBS: trocado de MeshPhysicalMaterial (transmission/clearcoat) para
    // MeshBasicMaterial. O material físico com "transmission" depende de
    // um environment map para renderizar corretamente; sem ele, a camada
    // ficava praticamente opaca e escura, cobrindo a textura do app
    // (a imagem carregava certinho, mas ficava escondida embaixo do vidro).
    const glassGeo = new THREE.PlaneGeometry(screenWidth, screenHeight);
    const glassMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      blending: THREE.AdditiveBlending
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

  // --- DEBUG TEMPORÁRIO: expõe objetos para inspeção via Console ---
  // (Pode remover essa linha depois que resolvermos o problema da textura.)
  window.__maryDebug = { scene, camera, renderer, phoneCenter, phoneLeft, phoneRight, textureLoader, ASSET_PATH };

  /* ---------------------------------------------------------------------
     4. LOGO DE ABERTURA + TRANSIÇÃO CINEMÁTICA
     ---------------------------------------------------------------------
     IMPORTANTE: o mesh é criado de forma SÍNCRONA (geometria + material
     já existem no mesmo frame), e só a textura/imagem é carregada de
     forma assíncrona por cima. Isso garante que `logoMesh` já exista
     no momento em que a timeline do GSAP é montada logo abaixo —
     requisito para que a transição do logo possa ser tweenada
     diretamente pela timeline principal (scrub), e não por um
     gsap.to() solto disparado por callback.

     A transição deixou de ser um simples "sumiço": agora o logo gira
     suavemente em 3D, desce e se desintegra em um leve estouro de
     partículas douradas, no exato momento em que o primeiro celular
     nasce na cena.
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

  // --- Partículas de desintegração: um leve "estouro" dourado que nasce
  // do centro do logo e se espalha enquanto ele desaparece. ---
  const PARTICLE_COUNT = 160;
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const r = 0.12 + Math.random() * 1.05;
    const theta = Math.random() * Math.PI * 2;
    particlePositions[i * 3] = Math.cos(theta) * r;
    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 1.3;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0xE4C77E,
    size: 0.05,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const logoParticles = new THREE.Points(particleGeo, particleMat);
  logoParticles.position.copy(logoMesh.position);
  logoParticles.scale.setScalar(0.5);
  scene.add(logoParticles);

  /* ---------------------------------------------------------------------
     5. CONVERSÃO DE COORDENADAS DE TELA -> MUNDO 3D
     Função genérica reaproveitada tanto para a luz do ponteiro (z=0)
     quanto para o relevo dourado do fundo (z=BG_Z) — sempre via
     raycasting real, garantindo que a deformação acompanhe o cursor
     com precisão em qualquer profundidade da cena.
     --------------------------------------------------------------------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const planeAtZ0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const planeAtBG = new THREE.Plane(new THREE.Vector3(0, 0, 1), -BG_Z);
  const worldPointTmp = new THREE.Vector3();

  function screenToWorld(clientX, clientY, plane) {
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    raycaster.ray.intersectPlane(plane, worldPointTmp);
    return worldPointTmp;
  }

  /* ---------------------------------------------------------------------
     6. INTERAÇÃO DE PONTEIRO — luz viva nos celulares + relevo dourado no fundo
     --------------------------------------------------------------------- */
  const bgMouseTarget = new THREE.Vector2(0, 0);
  const bgMouseCurrent = new THREE.Vector2(0, 0);
  let bgActiveTarget = 0;
  let bgActiveCurrent = 0;

  // Parallax sutil do grão de papel (puramente decorativo, em pixels de tela)
  let noiseTargetX = 0;
  let noiseTargetY = 0;
  let noiseCurrentX = 0;
  let noiseCurrentY = 0;

  function handlePointerMove(clientX, clientY) {
    // Luz de estúdio acompanha o ponteiro suavemente (reflexos vivos no metal)
    const pLight = screenToWorld(clientX, clientY, planeAtZ0);
    gsap.to(pointer3D.position, { x: pLight.x, y: pLight.y, z: 4, duration: 0.6, ease: 'power2.out', overwrite: true });

    // Relevo dourado no fundo: posição exata via raycast no plano do grid
    const pBg = screenToWorld(clientX, clientY, planeAtBG);
    bgMouseTarget.set(pBg.x, pBg.y);
    bgActiveTarget = 1;

    noiseTargetX = (clientX / window.innerWidth - 0.5) * 10;
    noiseTargetY = (clientY / window.innerHeight - 0.5) * 10;
  }

  window.addEventListener('mousemove', (e) => handlePointerMove(e.clientX, e.clientY));
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });
  window.addEventListener('mouseleave', () => { bgActiveTarget = 0; });
  window.addEventListener('touchend', () => { bgActiveTarget = 0; }, { passive: true });

  /* ---------------------------------------------------------------------
     6b. TOUCH: rotação manual sutil dos celulares (mobile)
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

  // ---- SEÇÃO 1 (Hero -> Ateliê): o logo gira, desce e se desintegra em
  // partículas douradas, exatamente enquanto o celular central nasce e
  // flutua de frente — uma transição cinemática, nunca um sumiço abrupto.
  tl.to(logoMat, { opacity: 0, duration: 0.95, ease: 'power2.in' }, 0)
    .to(logoMesh.scale, { x: 0.25, y: 0.25, z: 0.25, duration: 1, ease: 'power2.in' }, 0)
    .to(logoMesh.rotation, { x: 0.55, y: 1.1, z: 0.25, duration: 1, ease: 'power2.in' }, 0)
    .to(logoMesh.position, { y: '-=0.55', z: '-=0.4', duration: 1, ease: 'power2.in' }, 0)
    .to(particleMat, { opacity: 1, duration: 0.35, ease: 'power1.in' }, 0.1)
    .to(particleMat, { opacity: 0, duration: 0.65, ease: 'power2.in' }, 0.5)
    .to(logoParticles.scale, { x: 2.4, y: 2.4, z: 2.4, duration: 1, ease: 'power2.out' }, 0.1)
    .to(logoParticles.position, { y: '-=0.55', duration: 1, ease: 'power2.in' }, 0.1)
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
  const BG_MOUSE_LERP = 0.16;
  const BG_ACTIVE_LERP = 0.08;
  const NOISE_LERP = 0.08;

  function animate() {
    const elapsed = clock.getElapsedTime();

    // Flutuação ambiente sutil (idle) para os celulares — sensação "viva"
    if (!prefersReducedMotion) {
      phoneCenter.position.y += Math.sin(elapsed * 0.7) * 0.0009;
      phoneLeft.position.y += Math.sin(elapsed * 0.6 + 1.2) * 0.0007;
      phoneRight.position.y += Math.sin(elapsed * 0.65 + 2.1) * 0.0007;
    }

    // Anima o fundo: tempo contínuo (onda idle) + relevo dourado suavizado
    bgUniforms.uTime.value = elapsed;
    bgMouseCurrent.lerp(bgMouseTarget, BG_MOUSE_LERP);
    bgActiveCurrent += (bgActiveTarget - bgActiveCurrent) * BG_ACTIVE_LERP;
    bgUniforms.uMouse.value.copy(bgMouseCurrent);
    bgUniforms.uMouseActive.value = bgActiveCurrent;

    // Parallax sutil do grão de papel, acompanhando o cursor
    if (noiseEl) {
      noiseCurrentX += (noiseTargetX - noiseCurrentX) * NOISE_LERP;
      noiseCurrentY += (noiseTargetY - noiseCurrentY) * NOISE_LERP;
      noiseEl.style.transform = `translate3d(${noiseCurrentX.toFixed(2)}px, ${noiseCurrentY.toFixed(2)}px, 0)`;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  /* ---------------------------------------------------------------------
     10. LINKS / CTAs — desktop mostra QR (com link real em HTML), mobile
     mostra botão de APK
     --------------------------------------------------------------------- */
  const APK_URL = 'https://mary-cake.netlify.app/download/mary-cake.apk'; // ajuste para o link real do APK

  const apkBtn = document.getElementById('apk-download');
  if (apkBtn) apkBtn.setAttribute('href', APK_URL);

  document.getElementById('year').textContent = new Date().getFullYear();

  /* Fallback: caso algum asset falhe silenciosamente, garante que o loader some */
  gsap.delayedCall(6, () => loader.classList.add('is-hidden'));
})();
