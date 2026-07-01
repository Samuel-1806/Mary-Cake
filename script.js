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
     0b. ENTRADA DO LOGO SÓLIDO — 100% via GSAP (ver correção detalhada
     em styles.css, no bloco #hero-logo-solid). `xPercent`/`yPercent`
     recriam o antigo `translate(-50%, -50%)`, mas agora dentro do
     controle do próprio GSAP — assim, o tween de SAÍDA (seção 7 da
     timeline, mais abaixo) nunca disputa a propriedade `opacity`/
     `transform` com nenhuma animação CSS solta.
     --------------------------------------------------------------------- */
  gsap.set('#hero-logo-solid', { xPercent: -50, yPercent: -50, scale: 0.92, opacity: 0 });
  gsap.to('#hero-logo-solid', {
    opacity: 1,
    scale: 1,
    duration: 1.1,
    delay: 0.3,
    ease: 'expo.out' // aproximação do var(--ease-luxe) com eases nativos do GSAP core
  });

  /* ---------------------------------------------------------------------
     0. ESTADO GLOBAL E ELEMENTOS
     --------------------------------------------------------------------- */
  const canvas = document.getElementById('webgl-canvas');
  const loader = document.getElementById('loader');
  const loaderProgress = document.getElementById('loader-progress');
  const noiseEl = document.getElementById('noise');
  const siteHeader = document.querySelector('.site-header');
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
    varying float vWave;
    varying vec2 vUvLocal;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uMouseActive;

    void main() {
      vec3 pos = position;
      vUvLocal = uv;

      // Onda contínua e orgânica — amplitude REAL (antes era ~0.045,
      // praticamente nula e, pior, sem nenhum efeito visível no shader
      // de cor, que ignorava por completo essa deformação).
      float wave = sin(pos.x * 0.5 + uTime * 0.35) * 0.34
                 + cos(pos.y * 0.42 - uTime * 0.27) * 0.28;

      // Deformação dourada pontual: segue o cursor com precisão via raycast real
      float dist = distance(pos.xy, uMouse);
      float bump = exp(-dist * dist * 0.85) * uMouseActive;

      pos.z += wave + bump * 1.3;
      vBump = bump;
      vWave = wave;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const bgFragmentShader = `
    precision mediump float;
    varying float vBump;
    varying float vWave;
    varying vec2 vUvLocal;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform vec3 uInkColor;
    uniform vec3 uGoldColor;
    uniform vec3 uGoldLight;

    void main() {
      // CORREÇÃO: a grade agora vive no espaço LOCAL/UV da própria malha
      // (não mais em gl_FragCoord, que é espaço de pixel de tela e não
      // tinha NENHUMA relação com a geometria 3D). O deslocamento da
      // grade usa vWave e vBump diretamente — ou seja, a onda senoidal
      // e o relevo do cursor agora DOBRAM e ONDULAM as linhas de verdade,
      // em vez de mexer vértices que nenhum pixel na tela refletia.
      vec2 grid = vUvLocal * 46.0 + vec2(vWave, vBump) * 1.6;
      vec2 gridFrac = abs(fract(grid - 0.5) - 0.5);
      vec2 aa = fwidth(grid) * 1.5;
      vec2 lines2 = smoothstep(vec2(0.0), aa, gridFrac);
      float line = 1.0 - min(lines2.x, lines2.y);

      float bumpStrength = clamp(vBump * 1.7, 0.0, 1.0);

      // Respiração ambiente: a onda idle agora produz um brilho quente
      // visível pulsando por toda a malha (antes, vAmbient tinha faixa
      // tão pequena que "breathe" praticamente nunca saía de 0).
      float breathe = clamp((vWave + 0.34) / 0.68, 0.0, 1.0);
      vec3 breatheColor = mix(uInkColor, uGoldColor, breathe * 0.4);
      vec3 color = mix(breatheColor, mix(uGoldColor, uGoldLight, bumpStrength), bumpStrength);

      // CORREÇÃO: base de opacidade real (antes 0.06 — na prática,
      // invisível sobre o fundo claro). Estes valores agora produzem uma
      // malha de linhas discreta mas claramente visível, viva mesmo sem
      // o mouse por perto.
      float baseAlpha = line * 0.22;
      float breatheAlpha = line * breathe * 0.12;
      // O brilho dourado do cursor agora também preenche a ÁREA ao redor
      // do ponto (não só as linhas que cruzam o bump) — vira uma poça de
      // luz de verdade, não só um realce de grade quase imperceptível.
      float glowAlpha = bumpStrength * 0.45;
      float goldAlpha = line * bumpStrength * 0.75 + glowAlpha;

      gl_FragColor = vec4(color, clamp(baseAlpha + breatheAlpha + goldAlpha, 0.0, 0.95));
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

  function loadTextureSafe(fileName, onSuccess, _attempt) {
    const attempt = _attempt || 1;
    const url = ASSET_PATH + fileName;
    let settled = false;

    // Watchdog: se nem onLoad nem onError dispararem em 4s (engasgo raro
    // no boot, quando várias imagens grandes + libs carregam juntas),
    // tenta de novo automaticamente em vez de deixar a tela presa no
    // placeholder escuro para sempre.
    const watchdog = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (attempt < 3) {
        console.warn('[Mary Cake] Textura travada, tentando de novo:', url, 'tentativa', attempt + 1);
        loadTextureSafe(fileName, onSuccess, attempt + 1);
      } else {
        console.error('[Mary Cake] Falha ao carregar textura após 3 tentativas:', url);
        onAssetLoaded();
      }
    }, 4000);

    textureLoader.load(
      url,
      (tex) => {
        if (settled) return; // watchdog já disparou um retry; ignora esta resposta tardia
        settled = true;
        clearTimeout(watchdog);
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
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
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

    // Face frontal REAL do chassi após o bevel + o center(): o bevel soma
    // 'bevelThickness' de profundidade extra na frente (e na parte de trás),
    // então a face frontal não fica em bodyDepth/2 — fica em
    // bodyDepth/2 + bevelThickness. Tela e vidro precisam ficar à frente
    // DESSE valor, senão o próprio corpo metálico cobre a tela por completo
    // (era exatamente isso que estava acontecendo: 0.092 < 0.105).
    const bodyFrontZ = bodyDepth / 2 + extrudeSettings.bevelThickness;

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
    screen.position.z = bodyFrontZ + 0.01; // antes: bodyDepth / 2 + 0.012 (ficava ATRÁS do bevel)
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
    glass.position.z = bodyFrontZ + 0.012; // sempre um pouco à frente da tela
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
        // Guarda a opacidade ORIGINAL de cada material na primeira vez que
        // passa por aqui (corpo=1, tela=1, vidro=0.05, câmera=1) e escala
        // proporcionalmente. Antes, esta função igualava a opacidade de
        // TODAS as camadas ao mesmo valor — isso "estragava" o vidro
        // (que deve ficar bem sutil) toda vez que a timeline de scroll
        // passava por aqui, deixando-o opaco e cobrindo a tela do app.
        if (obj.userData.baseOpacity === undefined) {
          obj.userData.baseOpacity = obj.material.opacity;
        }
        obj.material.transparent = true;
        obj.material.opacity = obj.userData.baseOpacity * value;
      }
    });
  }

  // Pose final do celular central — antes era alcançada por tween a partir
  // de uma pose "fora de cena"; agora ela é o ponto de CHEGADA do morph de
  // partículas (seção 4), então o celular já nasce exatamente aqui, só
  // que invisível/zerado em escala até o morph terminar.
  const PHONE_TARGET_POS = new THREE.Vector3(0, 0.1, 0.5);
  const PHONE_TARGET_ROT = new THREE.Euler(0.05, -0.25 + Math.PI * 0.6, 0.02);

  // Três smartphones — central (vitrine), esquerda (carrinho), direita (conta)
  const phoneCenter = buildSmartphone('print_app.png');
  const phoneLeft = buildSmartphone('print-carrinho.png');
  const phoneRight = buildSmartphone('print-conta.png');

  // Central: nasce já na pose final (ver PHONE_TARGET_POS/ROT acima),
  // mas com escala 0 e invisível — os grânulos do logo é que "constroem"
  // visualmente essa forma; o mesh real só aparece quando o morph termina
  // (ver seção 4, mais abaixo).
  phoneCenter.position.copy(PHONE_TARGET_POS);
  phoneCenter.rotation.copy(PHONE_TARGET_ROT);
  phoneCenter.scale.setScalar(0.001);
  phoneCenter.visible = false;

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
     3b. O BOLO 3D — forma de chegada da coreografia final
     ---------------------------------------------------------------------
     Depois que os celulares terminam de "atuar" (seções Ateliê ->
     Compromisso com o Sabor), eles convergem ao centro, se dissolvem em
     grânulos residuais (mesmo princípio de partículas do logo de abertura,
     seção 4) e renascem como um bolo de confeitaria de 3 andares — a peça
     3D que acompanha a seção "Quem Somos" logo abaixo.

     O bolo real (mesh) fica com escala 0 e invisível até o morph de
     partículas terminar — exatamente a mesma coreografia usada no logo
     de abertura -> celular central (seção 4), só que em sentido "celular
     -> bolo". Isso mantém o princípio de reversibilidade total do scroll:
     tudo o que muda é tweenado dentro da timeline única (seção 7).
     --------------------------------------------------------------------- */
  const CAKE_POSITION = new THREE.Vector3(-0.9, -0.62, -0.4);
  const CAKE_ROTATION = new THREE.Euler(0, 0.5, 0);

  // Andares do bolo, de baixo para cima (raio, altura, base em Y local)
  const cakeTiers = [
    { radius: 1.05, height: 0.52, baseY: 0 },
    { radius: 0.76, height: 0.44, baseY: 0.52 },
    { radius: 0.50, height: 0.38, baseY: 0.96 }
  ];
  const cakeTopperRadius = 0.15;
  const cakeTopperY = cakeTiers[2].baseY + cakeTiers[2].height + 0.16;

  const cakeGroup = new THREE.Group();
  cakeGroup.position.copy(CAKE_POSITION);
  cakeGroup.rotation.copy(CAKE_ROTATION);
  cakeGroup.scale.setScalar(0.001);
  cakeGroup.visible = false;

  cakeTiers.forEach((tier) => {
    // Massa/confeito: cor creme quente, pouco metálico, bem fosco (icing real)
    const tierMat = new THREE.MeshStandardMaterial({
      color: 0xF6ECDD, metalness: 0.04, roughness: 0.58, transparent: true, opacity: 1
    });
    const tierGeo = new THREE.CylinderGeometry(tier.radius, tier.radius * 1.03, tier.height, 40, 1);
    const tierMesh = new THREE.Mesh(tierGeo, tierMat);
    tierMesh.position.y = tier.baseY + tier.height / 2;
    cakeGroup.add(tierMesh);

    // Filete dourado na junção de cada andar — eco direto do dourado da
    // malha viva de fundo e do chassi metálico dos celulares.
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xC9A14A, metalness: 0.9, roughness: 0.2, transparent: true, opacity: 1
    });
    const ringGeo = new THREE.TorusGeometry(tier.radius, 0.017, 8, 48);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = tier.baseY;
    cakeGroup.add(ring);
  });

  // Topo: cereja/adorno dourado, mesma linguagem material dos detalhes do chassi
  const cherryMat = new THREE.MeshStandardMaterial({
    color: 0xC9A14A, metalness: 0.9, roughness: 0.15, transparent: true, opacity: 1
  });
  const cherry = new THREE.Mesh(new THREE.SphereGeometry(cakeTopperRadius, 24, 24), cherryMat);
  cherry.position.y = cakeTopperY;
  cakeGroup.add(cherry);

  scene.add(cakeGroup);

  // Proxy de opacidade do bolo (mesmo princípio de setPhoneOpacity)
  function setCakeOpacity(value) {
    cakeGroup.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material.transparent = true;
        obj.material.opacity = value;
      }
    });
  }

  // --- Amostragem: nuvem de pontos na SUPERFÍCIE real do bolo (destino do morph) ---
  const CAKE_GRANULE_COUNT = 700;
  const cakeTargetPositions = new Float32Array(CAKE_GRANULE_COUNT * 3);

  (function sampleCakeSurface() {
    const tierWeights = cakeTiers.map((t) => t.radius * t.height);
    const topperWeight = cakeTopperRadius * cakeTopperRadius * 4;
    const totalWeight = tierWeights.reduce((a, b) => a + b, 0) + topperWeight;

    const cakeMatrix = new THREE.Matrix4().compose(
      CAKE_POSITION,
      new THREE.Quaternion().setFromEuler(CAKE_ROTATION),
      new THREE.Vector3(1, 1, 1)
    );
    const v = new THREE.Vector3();

    for (let i = 0; i < CAKE_GRANULE_COUNT; i++) {
      let pick = Math.random() * totalWeight;
      let lx, ly, lz;

      if (pick < topperWeight) {
        // Distribuição esférica uniforme (cereja/topo dourado)
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        lx = Math.sin(phi) * Math.cos(theta) * cakeTopperRadius;
        lz = Math.sin(phi) * Math.sin(theta) * cakeTopperRadius;
        ly = cakeTopperY + Math.cos(phi) * cakeTopperRadius;
      } else {
        pick -= topperWeight;
        let idx = 0;
        while (idx < tierWeights.length - 1 && pick > tierWeights[idx]) {
          pick -= tierWeights[idx];
          idx++;
        }
        const tier = cakeTiers[idx];
        const angle = Math.random() * Math.PI * 2;
        const r = tier.radius * (0.985 + Math.random() * 0.035);
        lx = Math.cos(angle) * r;
        lz = Math.sin(angle) * r;
        ly = tier.baseY + Math.random() * tier.height;
      }

      v.set(lx, ly, lz).applyMatrix4(cakeMatrix);
      cakeTargetPositions[i * 3] = v.x;
      cakeTargetPositions[i * 3 + 1] = v.y;
      cakeTargetPositions[i * 3 + 2] = v.z;
    }
  })();

  // --- Origem dos grânulos: nuvem residual no ponto onde os 3 celulares
  // se encontram ao convergir (ver timeline, seção 7) ---
  const PHONE_CONVERGE_POINT = new THREE.Vector3(0, 0, -2.3);
  const cakeOriginPositions = new Float32Array(CAKE_GRANULE_COUNT * 3);
  const cakeScatterOffsets = new Float32Array(CAKE_GRANULE_COUNT * 3);
  for (let i = 0; i < CAKE_GRANULE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = 0.25 + Math.random() * 1.1;
    cakeOriginPositions[i * 3] = PHONE_CONVERGE_POINT.x + Math.sin(phi) * Math.cos(theta) * r * 0.5;
    cakeOriginPositions[i * 3 + 1] = PHONE_CONVERGE_POINT.y + Math.cos(phi) * r * 0.9;
    cakeOriginPositions[i * 3 + 2] = PHONE_CONVERGE_POINT.z + Math.sin(phi) * Math.sin(theta) * r * 0.5;

    const sTheta = Math.random() * Math.PI * 2;
    const sPhi = Math.random() * Math.PI;
    const sR = 0.3 + Math.random() * 0.7;
    cakeScatterOffsets[i * 3] = Math.sin(sPhi) * Math.cos(sTheta) * sR;
    cakeScatterOffsets[i * 3 + 1] = Math.cos(sPhi) * sR * 0.6 + 0.15;
    cakeScatterOffsets[i * 3 + 2] = Math.sin(sPhi) * Math.sin(sTheta) * sR * 0.5;
  }

  const cakeGranulePositions = new Float32Array(CAKE_GRANULE_COUNT * 3);
  cakeGranulePositions.set(cakeOriginPositions);

  const cakeGranuleGeo = new THREE.BufferGeometry();
  cakeGranuleGeo.setAttribute('position', new THREE.BufferAttribute(cakeGranulePositions, 3));

  const cakeGranuleColors = new Float32Array(CAKE_GRANULE_COUNT * 3);
  const cakeColorCream = new THREE.Color(0xF6ECDD);
  const cakeColorGold = new THREE.Color(0xC9A14A);
  const cakeColorGoldLight = new THREE.Color(0xF3DDA0);
  for (let i = 0; i < CAKE_GRANULE_COUNT; i++) {
    const roll = Math.random();
    const c = roll < 0.25 ? cakeColorGold : (roll < 0.55 ? cakeColorGoldLight : cakeColorCream);
    cakeGranuleColors[i * 3] = c.r;
    cakeGranuleColors[i * 3 + 1] = c.g;
    cakeGranuleColors[i * 3 + 2] = c.b;
  }
  cakeGranuleGeo.setAttribute('color', new THREE.BufferAttribute(cakeGranuleColors, 3));

  // `makeGranuleSprite` é declarada mais abaixo (seção 4c) — funciona aqui
  // graças ao hoisting de function declarations dentro da mesma IIFE.
  const cakeGranuleMat = new THREE.PointsMaterial({
    size: 0.062,
    map: makeGranuleSprite(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true
  });

  const cakeGranules = new THREE.Points(cakeGranuleGeo, cakeGranuleMat);
  cakeGranules.visible = true;
  scene.add(cakeGranules);

  // Drivers do morph celular -> bolo (mesmo princípio de granuleMorph)
  const cakeMorph = { t: 0, scatter: 0 };
  const opacityCake = { v: 1 };

  function updateCakeGranules() {
    const arr = cakeGranuleGeo.attributes.position.array;
    const t = cakeMorph.t;
    const s = cakeMorph.scatter;
    for (let i = 0; i < CAKE_GRANULE_COUNT; i++) {
      const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
      const ox = cakeOriginPositions[ix], oy = cakeOriginPositions[iy], oz = cakeOriginPositions[iz];
      const tx = cakeTargetPositions[ix], ty = cakeTargetPositions[iy], tz = cakeTargetPositions[iz];
      arr[ix] = ox + (tx - ox) * t + cakeScatterOffsets[ix] * s;
      arr[iy] = oy + (ty - oy) * t + cakeScatterOffsets[iy] * s;
      arr[iz] = oz + (tz - oz) * t + cakeScatterOffsets[iz] * s;
    }
    cakeGranuleGeo.attributes.position.needsUpdate = true;
  }

  // --- DEBUG TEMPORÁRIO: expõe objetos para inspeção via Console ---
  // (Pode remover essa linha depois que resolvermos o problema da textura.)
  window.__maryDebug = { scene, camera, renderer, phoneCenter, phoneLeft, phoneRight, cakeGroup, textureLoader, ASSET_PATH };

  /* ---------------------------------------------------------------------
     4. LOGO DE ABERTURA — PARTÍCULAS (SVGLoader) + MORPH MATEMÁTICO
        PARA OS VÉRTICES REAIS DO CHASSI DO CELULAR
     ---------------------------------------------------------------------
     O logo deixou de ser um plano com PNG. Agora é uma nuvem de pontos
     (THREE.Points) cuja forma é extraída matematicamente dos <path> do
     'logo-mary-cake.svg' via SVGLoader (triangulação + amostragem por
     área de cada triângulo, pra preencher o desenho de forma fiel).

     Os "grânulos" (tons de chocolate + dourado, lembrando cobertura de
     brigadeiro) começam formando o logo, se desintegram, flutuam
     brevemente e são realocados — partícula a partícula — para pontos
     amostrados na geometria REAL do chassi (o mesmo bodyGeo usado em
     buildSmartphone). Só quando esse morph termina é que o celular 3D
     de verdade aparece e a coreografia de scroll (seção 7) prossegue.

     IMPORTANTE (mesma regra do logo antigo): a geometria/material/Points
     são criados de forma SÍNCRONA, então `logoGranules` já existe quando
     a timeline do GSAP é montada — só os PONTOS do SVG chegam de forma
     assíncrona (fetch), preenchendo o buffer já existente.
     --------------------------------------------------------------------- */
  const GRANULE_COUNT = 900;

  // --- 4a. Pontos de DESTINO: amostra real da geometria do chassi ---
  // Reaproveita o próprio bodyGeo de phoneCenter (1ª mesh do grupo) —
  // garante fidelidade matemática total à malha que vai aparecer depois.
  const phoneBodyMesh = phoneCenter.children.find(
    (child) => child.geometry && child.geometry.attributes.position.count > 50
  );
  const bodyPosAttr = phoneBodyMesh.geometry.attributes.position;

  const phoneTargetMatrix = new THREE.Matrix4().compose(
    PHONE_TARGET_POS,
    new THREE.Quaternion().setFromEuler(PHONE_TARGET_ROT),
    new THREE.Vector3(1, 1, 1)
  );

  const phoneTargetPositions = new Float32Array(GRANULE_COUNT * 3);
  const tmpVertex = new THREE.Vector3();
  for (let i = 0; i < GRANULE_COUNT; i++) {
    const vi = Math.floor(Math.random() * bodyPosAttr.count);
    tmpVertex.set(bodyPosAttr.getX(vi), bodyPosAttr.getY(vi), bodyPosAttr.getZ(vi));
    tmpVertex.applyMatrix4(phoneTargetMatrix);
    phoneTargetPositions[i * 3] = tmpVertex.x;
    phoneTargetPositions[i * 3 + 1] = tmpVertex.y;
    phoneTargetPositions[i * 3 + 2] = tmpVertex.z;
  }

  // --- 4b. Buffers do sistema de partículas ---
  const granulePositions = new Float32Array(GRANULE_COUNT * 3); // estado atual (animado a cada frame)
  const logoOriginPositions = new Float32Array(GRANULE_COUNT * 3); // forma do logo (preenchida via SVG/fallback)
  const scatterOffsets = new Float32Array(GRANULE_COUNT * 3); // deriva aleatória no meio da transição

  for (let i = 0; i < GRANULE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = 0.35 + Math.random() * 0.9;
    scatterOffsets[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    scatterOffsets[i * 3 + 1] = Math.cos(phi) * r * 0.7 + 0.18;
    scatterOffsets[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r * 0.6;
  }

  // Distribui `count` pontos dentro de um conjunto de triângulos,
  // respeitando a área de cada um — preenche a FORMA do logo, não só o
  // contorno. `outArray` recebe coordenadas já em espaço local da cena.
  function samplePointsInTriangles(triangles, count, outArray, scale, offsetX, offsetY) {
    const areas = triangles.map(([a, b, c]) =>
      Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2
    );
    const totalArea = areas.reduce((sum, a) => sum + a, 0) || 1;

    for (let i = 0; i < count; i++) {
      let pick = Math.random() * totalArea;
      let idx = 0;
      while (idx < triangles.length - 1 && pick > areas[idx]) {
        pick -= areas[idx];
        idx++;
      }
      const [a, b, c] = triangles[idx];
      let r1 = Math.random();
      let r2 = Math.random();
      if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; } // reflete pra dentro do triângulo

      const x = a[0] + r1 * (b[0] - a[0]) + r2 * (c[0] - a[0]);
      const y = a[1] + r1 * (b[1] - a[1]) + r2 * (c[1] - a[1]);

      outArray[i * 3] = (x + offsetX) * scale;
      outArray[i * 3 + 1] = -(y + offsetY) * scale; // SVG é Y-down; cena 3D é Y-up
      outArray[i * 3 + 2] = (Math.random() - 0.5) * 0.05; // leve espessura — não fica 100% chapado
    }
  }

  // Fallback: só usado se o SVG não tiver nenhum <path> com geometria
  // utilizável (ex.: arquivo "casca vazia", exportado sem vetores). Gera
  // um emblema simples (anel + miolo) pra nunca deixar a cena sem nada —
  // mas avisa claramente no console que é um substituto temporário.
  function buildFallbackLogoShape() {
    console.warn(
      '[Mary Cake] logo-mary-cake.svg não contém nenhum <path> com pontos ' +
      '(SVGLoader extraiu 0 caminhos). Usando um emblema substituto até um ' +
      'SVG vetorial de verdade ser enviado — troque o arquivo e recarregue.'
    );
    const triangles = [];
    const segments = 56;
    [{ rOuter: 1, rInner: 0.74 }, { rOuter: 0.46, rInner: 0 }].forEach(({ rOuter, rInner }) => {
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        const p0 = [Math.cos(a0) * rOuter, Math.sin(a0) * rOuter];
        const p1 = [Math.cos(a1) * rOuter, Math.sin(a1) * rOuter];
        const p2 = rInner > 0 ? [Math.cos(a1) * rInner, Math.sin(a1) * rInner] : [0, 0];
        triangles.push([p0, p1, p2]);
        if (rInner > 0) {
          const p3 = [Math.cos(a0) * rInner, Math.sin(a0) * rInner];
          triangles.push([p0, p2, p3]);
        }
      }
    });
    samplePointsInTriangles(triangles, GRANULE_COUNT, logoOriginPositions, 1, 0, 0);
  }

  // Parser real do SVG: SVGLoader().parse() lê o XML matematicamente
  // (curvas de Bézier viram polilinhas via toShapes), depois triangulamos
  // cada shape pra poder amostrar pontos preenchendo a área inteira.
  function buildLogoFromSVG(svgText) {
    const svgLoaderInstance = new THREE.SVGLoader();
    const svgData = svgLoaderInstance.parse(svgText);
    const allTriangles = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    svgData.paths.forEach((path) => {
      const shapes = THREE.SVGLoader.createShapes(path);
      shapes.forEach((shape) => {
        const contour = shape.getPoints(6).map((p) => [p.x, p.y]);
        const holes = (shape.holes || []).map((hole) => hole.getPoints(6).map((p) => [p.x, p.y]));
        if (contour.length < 3) return;

        const triIndices = THREE.ShapeUtils.triangulateShape(
          contour.map(([x, y]) => new THREE.Vector2(x, y)),
          holes.map((hole) => hole.map(([x, y]) => new THREE.Vector2(x, y)))
        );
        const flatPoints = contour.concat(...holes);

        triIndices.forEach((tri) => {
          const triangle = tri.map((idx) => flatPoints[idx]);
          allTriangles.push(triangle);
          triangle.forEach(([x, y]) => {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          });
        });
      });
    });

    if (!allTriangles.length) {
      buildFallbackLogoShape();
      return;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const targetSize = 2.2; // tamanho final do logo em unidades de cena
    const scale = targetSize / Math.max(width, height, 1);
    const offsetX = -(minX + width / 2);
    const offsetY = -(minY + height / 2);

    samplePointsInTriangles(allTriangles, GRANULE_COUNT, logoOriginPositions, scale, offsetX, offsetY);
  }

  // SVG é XML, não imagem — não passa pelo loadTextureSafe (que é só pra
  // texturas). Usa fetch puro, mas com a MESMA filosofia de robustez:
  // nunca trava a cena, sempre cai num fallback visível.
  fetch(ASSET_PATH + 'logo-mary-cake.svg')
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then((svgText) => buildLogoFromSVG(svgText))
    .catch((err) => {
      console.error('[Mary Cake] Falha ao buscar logo-mary-cake.svg:', err);
      buildFallbackLogoShape();
    })
    .finally(() => {
      granulePositions.set(logoOriginPositions);
      granuleGeo.attributes.position.needsUpdate = true;
      onAssetLoaded();
    });

  // --- 4c. Geometria, cor e "textura de grânulo" das partículas ---
  const granuleGeo = new THREE.BufferGeometry();
  granuleGeo.setAttribute('position', new THREE.BufferAttribute(granulePositions, 3));

  // Cor de cada grânulo: mistura entre chocolate (maioria, como cobertura
  // de brigadeiro) e dourado (acento de luxo), nunca uniforme.
  const granuleColors = new Float32Array(GRANULE_COUNT * 3);
  const colorChocolateDark = new THREE.Color(0x3B2114);
  const colorChocolateLight = new THREE.Color(0x5E3B27);
  const colorGold = new THREE.Color(0xC9A14A);
  for (let i = 0; i < GRANULE_COUNT; i++) {
    const roll = Math.random();
    const c = roll < 0.16 ? colorGold : (roll < 0.58 ? colorChocolateDark : colorChocolateLight);
    granuleColors[i * 3] = c.r;
    granuleColors[i * 3 + 1] = c.g;
    granuleColors[i * 3 + 2] = c.b;
  }
  granuleGeo.setAttribute('color', new THREE.BufferAttribute(granuleColors, 3));

  // Sprite circular via canvas: dá volume arredondado de grânulo real,
  // em vez de um quadrado/pixel chapado típico de THREE.Points cru.
  function makeGranuleSprite() {
    const size = 32;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2.4, 1, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(c);
  }

  const granuleMat = new THREE.PointsMaterial({
    size: 0.058,
    map: makeGranuleSprite(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true
  });

  const logoGranules = new THREE.Points(granuleGeo, granuleMat);
  logoGranules.position.set(0, 0.3, 1.2);
  scene.add(logoGranules);

  // --- 4d. Driver do morph: dois proxies tweenados pela timeline (seção 7) ---
  // t: 0 = forma do logo · 1 = forma do chassi do celular
  // scatter: 0 = parado · 1 = pico da "flutuação" no meio da transição
  const granuleMorph = { t: 0, scatter: 0 };

  function updateGranules() {
    const posArray = granuleGeo.attributes.position.array;
    const t = granuleMorph.t;
    const s = granuleMorph.scatter;
    for (let i = 0; i < GRANULE_COUNT; i++) {
      const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
      const ox = logoOriginPositions[ix], oy = logoOriginPositions[iy], oz = logoOriginPositions[iz];
      // Alvo convertido pro espaço LOCAL do grupo (que tem position própria)
      const tx = phoneTargetPositions[ix] - logoGranules.position.x;
      const ty = phoneTargetPositions[iy] - logoGranules.position.y;
      const tz = phoneTargetPositions[iz] - logoGranules.position.z;

      posArray[ix] = ox + (tx - ox) * t + scatterOffsets[ix] * s;
      posArray[iy] = oy + (ty - oy) * t + scatterOffsets[iy] * s;
      posArray[iz] = oz + (tz - oz) * t + scatterOffsets[iz] * s;
    }
    granuleGeo.attributes.position.needsUpdate = true;
  }

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

  // ---- SEÇÃO 1 (Hero -> Ateliê): logo sólido -> grânulos -> celular.
  // O #hero-logo-solid (imagem real, em DOM) é o que garante a FASE 1
  // "sólida" pedida no briefing — uma nuvem de pontos nunca fica 100%
  // cheia. Ele se apaga exatamente quando os grânulos (brigadeiro:
  // chocolate + dourado) nascem em seu lugar e se desintegram.
  //
  // Comparado à versão anterior, essa etapa agora ocupa quase o DOBRO do
  // espaço de scroll (antes ~11% do total, agora ~22%) — é isso que tira
  // o efeito "agressivo"/instantâneo: a mesma rolagem de antes agora cobre
  // só a metade do caminho, então a transição fica bem mais gradual.
  tl.to('#hero-logo-solid', { opacity: 0, scale: 0.9, duration: 0.6, ease: 'power2.in' }, 0.3)
    .to(granuleMat, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0.3)
    .to(granuleMorph, {
      scatter: 1, duration: 1.0, ease: 'sine.inOut', onUpdate: updateGranules
    }, 0.3)
    .to(granuleMorph, {
      scatter: 0, t: 1, duration: 1.3, ease: 'power2.inOut', onUpdate: updateGranules
    }, 1.3)
    // Celular real assume o lugar dos grânulos assim que o morph termina —
    // cross-fade suave, sem "back.out"/bounce (era o que deixava o final
    // agressivo antes).
    .set(phoneCenter, { visible: true }, 2.3)
    .fromTo(phoneCenter.scale,
      { x: 0.001, y: 0.001, z: 0.001 },
      { x: 1, y: 1, z: 1, duration: 0.7, ease: 'power3.out' }, 2.3)
    .to(granuleMat, { opacity: 0, duration: 0.6, ease: 'power2.in' }, 2.3)
    .set(logoGranules, { visible: false }, 2.9)

    // ---- SEÇÃO 2 (Ateliê): giro completo 360° no eixo Y, desloca para a direita
    .to(phoneCenter.rotation, { y: '+=' + (Math.PI * 2), duration: 2, ease: 'power1.inOut' }, 3)
    .to(phoneCenter.position, { x: 2.1, y: -0.1, z: -0.5, duration: 2 }, 3)

    // ---- SEÇÃO 3 (Experiência Digital): os 3 celulares surgem juntos no centro
    .to(phoneCenter.position, { x: 0, y: 0, z: 0, duration: 1.4, ease: 'power2.inOut' }, 5.1)
    .to(phoneCenter.rotation, { x: 0, y: -0.18, z: 0, duration: 1.4 }, 5.1)
    .set(phoneLeft, { visible: true }, 5.3)
    .set(phoneRight, { visible: true }, 5.3)
    .fromTo(phoneLeft.position, { x: -5, y: 0.3, z: -2 }, { x: -1.85, y: -0.15, z: -0.6, duration: 1.4, ease: 'power2.out' }, 5.3)
    .fromTo(phoneRight.position, { x: 5, y: -0.3, z: -2 }, { x: 1.85, y: -0.15, z: -0.6, duration: 1.4, ease: 'power2.out' }, 5.3)
    .to(phoneLeft.rotation, { y: 0.42, x: 0.05, duration: 1.4 }, 5.3)
    .to(phoneRight.rotation, { y: -0.42, x: 0.05, duration: 1.4 }, 5.3)
    .to('.phone-tag', { opacity: 1, y: 0, duration: 0.9, stagger: 0.15, ease: 'power2.out' }, 5.6)
    .to('.phone-tag', { opacity: 0, y: 14, duration: 0.5, ease: 'power2.in' }, 6.7)

    // ---- SEÇÃO 4 (Jornada do Pedido): macro zoom inclinado na tela central
    .to(camera.position, { x: 0.15, y: 0.85, z: 2.6, duration: 1.6, ease: 'power2.inOut' }, 7)
    .to(camera.rotation, { x: -0.32, duration: 1.6 }, 7)
    .to(phoneCenter.position, { x: 0, y: 0.1, z: 1, duration: 1.6 }, 7)
    .to(phoneCenter.rotation, { x: 0.08, y: 0, duration: 1.6 }, 7)
    .to([phoneLeft.position, phoneRight.position], { z: '-=0.6', duration: 1.6 }, 7)

    // ---- SEÇÃO 5 (Compromisso com o Sabor): texto fica à esquerda, celulares migram para a direita
    .to(camera.position, { x: 1.4, y: 0.1, z: 6.5, duration: 1.8, ease: 'power2.inOut' }, 8.8)
    .to(camera.rotation, { x: 0, duration: 1.8 }, 8.8)
    .to(phoneCenter.position, { x: 2.1, y: 0, z: -0.3, duration: 1.8 }, 8.8)
    .to(phoneCenter.rotation, { y: -0.35, duration: 1.8 }, 8.8)
    .to(phoneLeft.position, { x: 0.9, z: -2.2, duration: 1.8 }, 8.8)
    .to(phoneRight.position, { x: 3.8, z: -2.4, duration: 1.8 }, 8.8)

    // ---- SEÇÃO 6 (Quem Somos): DESINTEGRAÇÃO -> BOLO — celulares
    // convergem ao centro, se dissolvem em grânulos residuais e renascem
    // como o bolo de confeitaria, conectando visualmente a vitrine
    // digital à seção da fundadora logo abaixo.
    .to(camera.position, { x: -0.3, y: 0.05, z: 7.4, duration: 1.8, ease: 'power2.inOut' }, 10.7)
    .to([phoneCenter.position, phoneLeft.position, phoneRight.position], { x: 0, y: 0, z: '-=2', duration: 1.8, ease: 'power2.in' }, 10.7)
    .to([phoneCenter.rotation, phoneLeft.rotation, phoneRight.rotation], { y: '+=3.2', duration: 1.8, ease: 'power2.in' }, 10.7)
    .to([phoneCenter.scale, phoneLeft.scale, phoneRight.scale], { x: 0, y: 0, z: 0, duration: 1.8, ease: 'power3.in' }, 10.7)
    .to(opacityCenter, {
      v: 0, duration: 1.6, ease: 'power2.in',
      onUpdate: () => setPhoneOpacity(phoneCenter, opacityCenter.v)
    }, 10.7)
    .to(opacityLeft, {
      v: 0, duration: 1.6, ease: 'power2.in',
      onUpdate: () => setPhoneOpacity(phoneLeft, opacityLeft.v)
    }, 10.7)
    .to(opacityRight, {
      v: 0, duration: 1.6, ease: 'power2.in',
      onUpdate: () => setPhoneOpacity(phoneRight, opacityRight.v)
    }, 10.7)

    // Grânulos residuais (creme + dourado) nascem onde os celulares se
    // dissolveram, flutuam brevemente e convergem na forma real do bolo —
    // mesma lógica de partículas do morph de abertura (logo -> celular).
    .to(cakeGranuleMat, { opacity: 1, duration: 0.7, ease: 'power2.out' }, 11.3)
    .to(cakeMorph, { scatter: 1, duration: 0.9, ease: 'sine.inOut', onUpdate: updateCakeGranules }, 11.3)
    .to(cakeMorph, { scatter: 0, t: 1, duration: 1.3, ease: 'power2.inOut', onUpdate: updateCakeGranules }, 12.2)
    // O bolo 3D real assume o lugar dos grânulos assim que o morph termina
    .set(cakeGroup, { visible: true }, 13.5)
    .fromTo(cakeGroup.scale,
      { x: 0.001, y: 0.001, z: 0.001 },
      { x: 1, y: 1, z: 1, duration: 0.8, ease: 'power3.out' }, 13.5)
    .to(cakeGranuleMat, { opacity: 0, duration: 0.6, ease: 'power2.in' }, 13.5)
    .set(cakeGranules, { visible: false }, 14.1)

    // ---- SEÇÃO 7 (Download): o bolo permanece como pano de fundo discreto
    // enquanto a biografia é lida; ao se aproximar do QR Code, gira
    // suavemente e se dissolve, liberando o fundo por completo.
    .to(camera.position, { x: 0, y: 0, z: 9, duration: 1.8, ease: 'power2.inOut' }, 14.9)
    .to(cakeGroup.rotation, { y: '+=1.1', duration: 1.8, ease: 'power2.inOut' }, 14.9)
    .to(cakeGroup.scale, { x: 0, y: 0, z: 0, duration: 1.6, ease: 'power2.in' }, 15.1)
    .to(opacityCake, {
      v: 0, duration: 1.4, ease: 'power2.in',
      onUpdate: () => setCakeOpacity(opacityCake.v)
    }, 15.1);

  /* ---------------------------------------------------------------------
     7b. REVELAÇÃO DA SEÇÃO "QUEM SOMOS" — fade/slide-in independente da
     timeline 3D principal (mesmo padrão leve usado em elementos de UI,
     não precisa de scrub sincronizado quadro a quadro com o WebGL).
     --------------------------------------------------------------------- */
  if (!prefersReducedMotion) {
    gsap.from('.bio-portrait-wrap', {
      opacity: 0, x: -32, duration: 1.1, ease: 'power2.out',
      scrollTrigger: { trigger: '.section-quemsomos', start: 'top 75%' }
    });
    gsap.from('.bio-copy', {
      opacity: 0, y: 28, duration: 1.1, ease: 'power2.out', delay: 0.15,
      scrollTrigger: { trigger: '.section-quemsomos', start: 'top 75%' }
    });
  }

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
      cakeGroup.userData.mobileScale = 0.68;
    } else {
      phoneCenter.userData.mobileScale = 1;
      phoneLeft.userData.mobileScale = 0.78;
      phoneRight.userData.mobileScale = 0.78;
      camera.position.z = 9;
      cakeGroup.userData.mobileScale = 1;
    }
  }
  applyResponsiveLayout();

  /* ---------------------------------------------------------------------
     8b. HEADER INTELIGENTE — esconde ao rolar pra baixo, reaparece
     IMEDIATAMENTE ao rolar pra cima.
     ---------------------------------------------------------------------
     Roda independente da timeline scrub do GSAP (que é sobre a posição
     absoluta do scroll, não sobre direção/velocidade). Usa rAF pra nunca
     ler `window.scrollY` mais de uma vez por frame, e uma margem mínima
     de movimento (HEADER_SCROLL_DELTA) pra não tremer com scrolls de
     1-2px (trackpads/mouse de alta resolução geram esses micro-eventos).
     --------------------------------------------------------------------- */
  const HEADER_HIDE_AFTER = 120;  // só começa a esconder depois de sair do topo
  const HEADER_SCROLL_DELTA = 6;  // ignora micro-scrolls (ruído de trackpad)
  let headerLastY = window.scrollY;
  let headerTicking = false;

  function updateHeaderVisibility() {
    const currentY = window.scrollY;
    const diff = currentY - headerLastY;

    if (currentY <= HEADER_HIDE_AFTER) {
      siteHeader.classList.remove('header-hidden'); // sempre visível perto do topo
    } else if (diff > HEADER_SCROLL_DELTA) {
      siteHeader.classList.add('header-hidden'); // rolando pra baixo: some
    } else if (diff < -HEADER_SCROLL_DELTA) {
      siteHeader.classList.remove('header-hidden'); // rolando pra cima: volta na hora
    }

    headerLastY = currentY;
    headerTicking = false;
  }

  if (siteHeader) {
    window.addEventListener('scroll', () => {
      if (!headerTicking) {
        requestAnimationFrame(updateHeaderVisibility);
        headerTicking = true;
      }
    }, { passive: true });
  }

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

      // Giro lento e contínuo do bolo enquanto a seção "Quem Somos" é lida
      if (cakeGroup.visible) {
        cakeGroup.rotation.y += 0.0016;
      }
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
