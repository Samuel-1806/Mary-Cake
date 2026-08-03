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

  // GATE DE SCROLL: enquanto os assets carregam, a página fica travada
  // (sem rolagem) — o site "libera" o scroll só depois que 100% dos
  // recursos (texturas + logo vetorial) já estão prontos, evitando que o
  // usuário role para uma timeline que ainda não tem todos os frames
  // corretos montados (texturas placeholder, celulares ainda invisíveis).
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
        loader.classList.add('is-hidden');
        releaseScrollLock();
        ScrollTrigger.refresh();
      });
    }
  }

  /* ---------------------------------------------------------------------
     0c. CURSOR CUSTOMIZADO — ponto + anel finos dourados, ambos fixos na
     posição real do cursor (sem lag), o anel expande sobre links/botões.
     Só é inicializado em dispositivos com ponteiro fino (mouse/trackpad);
     em touch, o próprio CSS já esconde o elemento e aqui nem chegamos a
     ligar os listeners de mousemove, evitando custo desnecessário em
     mobile.
     --------------------------------------------------------------------- */
  const supportsFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (supportsFinePointer && !isMobile) {
    const cursorEl = document.getElementById('custom-cursor');

    if (cursorEl) {
      document.documentElement.classList.add('has-custom-cursor');

      // Posição do mouse — ponto e anel seguem juntos, 1:1, sem lag.
      // (O anel mantém sua física própria só na EXPANSÃO — via
      // transition de width/height/margin no CSS — não na posição.)
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

      // Some quando o ponteiro sai da janela (ex.: troca de aba/app).
      document.addEventListener('mouseleave', () => cursorEl.classList.remove('is-active'));
      document.addEventListener('mouseenter', () => { if (hasMoved) cursorEl.classList.add('is-active'); });

      // Expansão sobre elementos interativos (links, botões, cards) —
      // delegação de evento única, sem precisar mapear cada elemento.
      const HOVER_SELECTOR = 'a, button, .btn-primary, .btn-header, .btn-ghost, ' +
        '.process-card, .step-card, .ecosystem-card, .telas-dots button, ' +
        '[role="button"]';
      const TEXT_SELECTOR = 'p, h1, h2, h3, .body-text, .lede';

      document.addEventListener('mouseover', (e) => {
        const target = e.target;
        if (target.closest(HOVER_SELECTOR)) {
          cursorEl.classList.add('is-hovering');
          cursorEl.classList.remove('is-text');
        } else if (target.closest(TEXT_SELECTOR)) {
          cursorEl.classList.add('is-text');
          cursorEl.classList.remove('is-hovering');
        }
      });
      document.addEventListener('mouseout', (e) => {
        const target = e.target;
        if (target.closest(HOVER_SELECTOR) || target.closest(TEXT_SELECTOR)) {
          cursorEl.classList.remove('is-hovering', 'is-text');
        }
      });
    }
  }

  /* ---------------------------------------------------------------------
     0d. BOTÕES MAGNÉTICOS — em vez da troca simples de cor no hover,
     btn-primary/btn-header ganham um preenchimento que "nasce" exatamente
     sob o cursor (via --mx/--my, lidos pelo ::before em styles.css) e um
     leve puxão do próprio botão em direção ao ponteiro (--tx/--ty). Mesma
     guarda do cursor customizado: só roda em ponteiro fino, fora de touch
     e respeitando prefers-reduced-motion (sem JS, o preenchimento ainda
     funciona no CSS, só nasce do centro em vez do ponto do cursor).
     --------------------------------------------------------------------- */
  // prefersReducedMotion já foi declarada na seção 0 (estado global) — reaproveitada aqui.

  if (supportsFinePointer && !isMobile && !prefersReducedMotion) {
    const magneticButtons = document.querySelectorAll('.btn-primary, .btn-header');
    const MAX_PULL = 8; // px máximo de deslocamento do botão em direção ao cursor

    magneticButtons.forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const relY = e.clientY - rect.top;

        // Ponto de origem do preenchimento — nasce exatamente sob o cursor.
        btn.style.setProperty('--mx', relX + 'px');
        btn.style.setProperty('--my', relY + 'px');

        // Puxão magnético sutil, proporcional à distância do centro do
        // botão, sempre limitado a MAX_PULL pra nunca "descolar" demais.
        const offsetX = relX - rect.width / 2;
        const offsetY = relY - rect.height / 2;
        const tx = Math.max(-MAX_PULL, Math.min(MAX_PULL, offsetX * 0.22));
        const ty = Math.max(-MAX_PULL, Math.min(MAX_PULL, offsetY * 0.22));
        btn.style.setProperty('--tx', tx + 'px');
        btn.style.setProperty('--ty', ty + 'px');
      }, { passive: true });

      btn.addEventListener('mouseleave', () => {
        // Solta o botão de volta ao centro — a transition do CSS (mesma
        // "manteiga" --ease-luxe do resto do site) cuida da suavidade.
        btn.style.setProperty('--tx', '0px');
        btn.style.setProperty('--ty', '0px');
      });
    });
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
     1c. RECUPERAÇÃO DE CONTEXTO WEBGL — em máquinas mais fracas (ou com
     muitas abas abertas), o navegador pode derrubar o contexto WebGL no
     meio da navegação. Sem isto, o canvas simplesmente para de desenhar
     e o usuário passa a ver só a camada de fallback (.paper-bg) por
     baixo dele — é exatamente isto que fazia o fundo "trocar" de
     aparência em algumas seções do site. Com os listeners abaixo, o
     navegador restaura o contexto automaticamente e o loop de animação
     (que já roda dentro de um try/catch — ver seção 9) simplesmente
     volta a desenhar no frame seguinte, sem precisar recarregar a página.
     --------------------------------------------------------------------- */
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    console.warn('[Mary Cake] Contexto WebGL perdido — tentando restaurar automaticamente.');
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    console.warn('[Mary Cake] Contexto WebGL restaurado — retomando o pano vivo.');
    // Garante que todas as texturas já carregadas sejam reenviadas para
    // a GPU no próximo frame (o navegador zera a memória de vídeo ao
    // perder o contexto).
    if (bgUniforms.uMap.value) bgUniforms.uMap.value.needsUpdate = true;
  }, false);

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

  // Pequeno ponto de luz "estúdio" que segue suavemente o mouse — reforçado
  // (intensidade maior, alcance mais curto) para ler como um realce de
  // vitrine deliberado (o "glint" que acompanha o olhar do visitante),
  // não como uma luz de preenchimento genérica.
  const pointer3D = new THREE.PointLight(0xffd9a0, 1.1, 8);
  pointer3D.position.set(0, 0, 4);
  scene.add(pointer3D);

  /* ---------------------------------------------------------------------
     1b2. AMBIENTE DE ESTÚDIO (envMap) — a causa raiz de o celular ler como
     plástico fosco em vez de metal/vidro de verdade: metalness alto SEM
     nenhum envMap na cena não reflete nada além das 3 luzes diretas (3
     pontos de brilho, nunca uma superfície contínua). Toda fotografia de
     produto de luxo depende do reflexo de "janela"/softbox na lateral do
     objeto — é isso que avisa o olho que a superfície é polida. Aqui
     construímos uma cena minúscula só com painéis emissivos simulando um
     estúdio (softbox quente em cima, rebatedor frio de um lado, rim
     dourado do outro, piso claro embaixo) e usamos o PMREMGenerator do
     próprio Three.js pra transformar isso num envMap real — 100%
     procedural, sem baixar nenhuma imagem/HDRI externa.
     --------------------------------------------------------------------- */
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
  addEnvPanel(0xfff2df, 3.4, [0, 6, 0], [8, 8]);     // softbox principal (topo, quente)
  addEnvPanel(0xdfe6f2, 1.6, [-6, 1, 2], [6, 10]);   // rebatedor frio (esquerda)
  addEnvPanel(0xe4c78a, 2.6, [6, 0, -3], [6, 10]);   // rim dourado (direita/trás)
  addEnvPanel(0xf1ece2, 0.9, [0, -6, 0], [8, 8]);    // piso claro (evita reflexo "vazio" embaixo)

  scene.environment = pmremGenerator.fromScene(envScene, 0.03).texture;
  pmremGenerator.dispose();

  /* ---------------------------------------------------------------------
     2. PANO VIVO — SILK CLOTH SHADER (3D, alta resolução)
     ---------------------------------------------------------------------
     PlaneGeometry de alta densidade (BufferGeometry nativa) com um vertex
     shader que:
       a) drapeia a malha organicamente no idle (múltiplos trens de onda
          em eixos e frequências diferentes — nunca um ciclo único/óbvio);
       b) deriva a NORMAL real de cada vértice por diferenças finitas do
          campo de altura, para que o fragment shader ilumine as dobras
          como seda de verdade (difusa + brilho especular direcional),
          em vez de só deslocar Z sem volume;
       c) reage à posição do mouse via raycasting real no plano do fundo
          (mundo 3D, não pixels), erguendo um relevo tátil suave e preciso.
     Paleta travada em apenas duas cores (fundo #F5F2ED, brilho #B89A7A);
     todo tom de sombra/realce é derivado matematicamente delas dentro do
     shader. Zero grid, zero linha reta — só curvas contínuas de tecido.
     --------------------------------------------------------------------- */
  const BG_Z = -6.4;
  // Malha de alta resolução: mais segmentos = dobras de seda mais macias
  // e sem faceamento visível. BufferGeometry nativa do PlaneGeometry já
  // garante um único VBO por atributo (position/uv/normal), então o custo
  // por frame é apenas a passagem pelo vertex shader — barato mesmo aqui.
  const bgSegments = isMobile ? 44 : 110;
  const bgPlaneGeo = new THREE.PlaneGeometry(48, 48, bgSegments, bgSegments);

  const bgUniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uMouseActive: { value: 0 },
    // Paleta absoluta do briefing: apenas estas duas cores. Sombra e brilho
    // do tecido são DERIVADOS delas dentro do shader (mix/lighten), nunca
    // cores novas — garante fidelidade total à referência.
    uBaseColor: { value: new THREE.Color(0xF5F2ED) },
    uGoldColor: { value: new THREE.Color(0xB89A7A) },
    // Foto real de tecido/cetim (assets/bg-silk.jpg) usada como textura da
    // malha viva: a mesma malha que já ondula e reage ao mouse agora
    // carrega a fotografia, então o movimento de "pano" acontece sobre a
    // imagem de verdade, não apenas sobre cor lisa.
    uMap: { value: null },
    uMapLoaded: { value: 0 }
  };

  const bgTextureLoader = new THREE.TextureLoader();
  bgTextureLoader.load(
    'assets/bg-silk.jpg',
    (tex) => {
      tex.encoding = THREE.sRGBEncoding;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
      bgUniforms.uMap.value = tex;
      bgUniforms.uMapLoaded.value = 1;
    },
    undefined,
    (err) => {
      // Se isto aparecer no console em produção, o arquivo não foi
      // encontrado no caminho 'assets/bg-silk.jpg' (normalmente é
      // diferença de maiúscula/minúscula no nome do arquivo/pasta —
      // Vercel/Linux é case-sensitive, ao contrário do Windows local).
      console.error('[Mary Cake] Falha ao carregar assets/bg-silk.jpg — verifique nome/caminho exatos no repositório (case-sensitive).', err);
    }
  );

  const bgVertexShader = `
    varying float vBump;
    varying float vWave;
    varying vec2 vUvLocal;
    varying vec3 vNormal;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uMouseActive;

    // --- Campo de altura do "Pano Vivo" -----------------------------------
    // Drapeado orgânico: quatro trens de onda com frequências, fases e
    // eixos diferentes somados — nunca um padrão único e repetitivo,
    // exatamente como seda real nunca dobra numa só direção. Sem grade,
    // sem retas: tudo curva contínua. Amplitudes generosas para que o
    // movimento seja claramente perceptível, não apenas teórico.
    float clothWave(vec2 p, float t) {
      float wave = sin(p.x * 0.5 + t * 0.62) * 0.52
           + cos(p.y * 0.42 - t * 0.50) * 0.44
           + sin((p.x + p.y) * 0.3 + t * 0.78) * 0.30
           + sin(p.x * 0.15 - p.y * 0.21 + t * 0.24) * 0.34; // dobra larga e lenta (drapeado)

      // Máscara de canto: concentra a dobra no INFERIOR DIREITO (x alto,
      // y baixo), igual à foto de referência (tecido liso no canto
      // superior esquerdo, dobras nascendo no canto oposto). Sem isso a
      // onda cobria a tela toda de forma uniforme, o que lia como um
      // tecido genérico, não como a foto enviada.
      // Transição mais estreita (-10..10, era -14..16) concentra o
      // contraste "liso vs dobrado" mais perto do canto real, e o
      // multiplicador mais alto no pico (1.35, era 1.0) reforça a
      // profundidade das dobras no inferior direito — mais perto da
      // foto de referência original.
      float corner = smoothstep(-10.0, 10.0, p.x - p.y);
      return wave * mix(0.15, 1.35, corner);
    }

    // Relevo tátil sob o cursor: elevação ampla e suave (smoothstep),
    // bem mais discreta que antes — um leve afago na seda, não uma
    // pressão de dedo. Raio menor (1.6/2.6, era 3.1/4.4) e amplitude
    // reduzida (0.55/0.18, era 1.05/0.3) para um relevo sutil.
    // NOME DO PARÂMETRO: em versões antigas deste shader, esse parâmetro
    // se chamava "active" — palavra RESERVADA em GLSL ES 3.00 (o padrão
    // usado quando o navegador negocia um contexto WebGL2). Em drivers
    // que aceitam WebGL2 (a maioria hoje), isso quebrava a compilação
    // com "Illegal use of reserved word", derrubando o shader inteiro e
    // deixando só o fallback estático (.paper-bg) visível — o fundo
    // "morto" que não reage ao mouse. Renomeado para "activeAmt".
    float clothBump(vec2 p, vec2 mouse, float activeAmt) {
      float dist = distance(p, mouse);
      float bump = smoothstep(1.6, 0.0, dist) * activeAmt;
      float bumpSoft = smoothstep(2.6, 0.0, dist) * activeAmt;
      return bump * 0.55 + bumpSoft * 0.18;
    }

    float clothHeight(vec2 p, float t, vec2 mouse, float activeAmt) {
      return clothWave(p, t) + clothBump(p, mouse, activeAmt);
    }

    void main() {
      vec2 p = position.xy;
      vUvLocal = uv;

      // Normal real via diferenças finitas: amostramos a altura em dois
      // pontos vizinhos e derivamos o vetor normal a partir das tangentes.
      // A inclinação é EXAGERADA só para fins de sombreamento (ampNormal),
      // sem deslocar a malha além do fisicamente elegante — é o mesmo
      // truque de bump mapping usado para dar volume tátil sem geometria
      // extrema. Sem isso a luz não "entende" as dobras e o pano lê como
      // uma tinta chapada e parada.
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

      // Luz de estúdio quente vindo de cima-esquerda — mesma direção da
      // referência (seda com brilho metálico entrando pela diagonal).
      vec3 lightDir = normalize(vec3(-0.35, 0.55, 0.75));
      float diffuse = dot(N, lightDir) * 0.5 + 0.5; // wrap lighting: sombra nunca vira preto

      // Sheen especular de seda: destaque largo e quente nas cristas
      // das dobras — potência baixa o suficiente para ser visível a
      // olho nu (não um pixel isolado), como fibra têxtil brilhando.
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      vec3 halfDir = normalize(lightDir + viewDir);
      float specular = pow(max(dot(N, halfDir), 0.0), 13.0);

      // Faixas de brilho ao longo da dobra (anisotropia de tecido) —
      // reforça a leitura de fibra sem introduzir nenhuma linha reta.
      float fold = vWave * 3.4 + vUvLocal.x * 2.1 - vUvLocal.y * 1.4;
      float sheen = smoothstep(0.22, 0.92, sin(fold + uTime * 0.12) * 0.5 + 0.5);
      float fold2 = vWave * 1.8 - vUvLocal.x * 1.1 - uTime * 0.07;
      float sheen2 = smoothstep(0.3, 0.94, sin(fold2) * 0.5 + 0.5);

      // Leve deslocamento da UV pela própria altura do "pano": a foto
      // parece se esticar/comprimir junto com a dobra, reforçando a
      // sensação de tecido real (não uma imagem plana colada por cima).
      vec2 uvWarp = vUvLocal + N.xy * 0.11;

      // Foto real do tecido (assets/bg-silk.jpg): usada como base de cor
      // assim que carrega. Antes disso (ou se falhar), cai de volta na
      // paleta procedural de duas cores para nunca deixar o fundo vazio.
      vec3 photoColor = texture2D(uMap, uvWarp).rgb;
      vec3 shadowTone = mix(uBaseColor, uGoldColor, 0.55);
      vec3 highlightTone = mix(uGoldColor, vec3(1.0), 0.6);
      vec3 proceduralColor = mix(shadowTone, uBaseColor, diffuse);

      vec3 baseColor = mix(proceduralColor, photoColor, uMapLoaded);

      // Sombreamento de estúdio aplicado sobre a foto: escurece levemente
      // nos vales da dobra e clareia nas cristas, como luz real incidindo
      // sobre a seda fotografada.
      // Com a foto real carregada (uMapLoaded = 1), a mistura dourada/
      // brilho/realce é bem mais discreta que no fallback procedural —
      // só o suficiente para dar volume às dobras, sem "pintar" a foto
      // de dourado e desfigurar a imagem original enviada.
      vec3 clothColor = baseColor * mix(0.72, 1.12, diffuse);
      clothColor = mix(clothColor, uGoldColor, (sheen * 0.16 + sheen2 * 0.08) * (1.0 - uMapLoaded * 0.85));
      clothColor += highlightTone * specular * (0.7 - uMapLoaded * 0.55);

      float bumpStrength = clamp(vBump, 0.0, 1.0);
      clothColor = mix(clothColor, highlightTone, bumpStrength * (0.6 - uMapLoaded * 0.45));

      // Alpha elevado o bastante para o "pano" ser inconfundível mesmo
      // em telas comprimidas (JPEG/mobile), mas ainda translúcido —
      // o texto vive numa camada acima do canvas (z-index maior), então
      // a legibilidade não é afetada mesmo com o pico de opacidade mais alto.
      float baseAlpha = mix(0.30 + (1.0 - diffuse) * 0.22, 0.62 + (1.0 - diffuse) * 0.18, uMapLoaded);
      float sheenAlpha = sheen * 0.16 + sheen2 * 0.08;
      float specAlpha = specular * 0.45;
      float bumpAlpha = bumpStrength * 0.5;

      float alpha = clamp(baseAlpha + sheenAlpha + specAlpha + bumpAlpha, 0.0, 0.92);

      gl_FragColor = vec4(clothColor, alpha);
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

  // Recorte "notch" encostado na borda (igual ao .telas-phone-notch do
  // mockup DOM: border-radius 0 0 1rem 1rem — topo TOTALMENTE reto,
  // fundindo com a moldura acima, só a base é arredondada). O topo do
  // shape fica em y=0 de propósito: assim basta posicionar este mesh em
  // y = (borda superior da tela) que o corte encaixa exatamente rente
  // à tela, sem gap e sem flutuar solto no meio dela.
  function createDropNotchShape(width, height, radius) {
    const w = width / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-w, 0);
    shape.lineTo(w, 0);
    shape.lineTo(w, -height + radius);
    shape.quadraticCurveTo(w, -height, w - radius, -height);
    shape.lineTo(-w + radius, -height);
    shape.quadraticCurveTo(-w, -height, -w, -height + radius);
    shape.lineTo(-w, 0);
    return shape;
  }

  // THREE.ShapeGeometry (r128) grava o UV usando a posição BRUTA do
  // vértice (vertex.x, vertex.y), não normalizada — então uma textura
  // aplicada direto nela aparece encolhida num cantinho (era exatamente
  // o bug do print do app "cortado" num fragmento da tela). Esta função
  // remapeia o UV existente para o intervalo 0–1 a partir da própria
  // posição, usando a largura/altura reais do shape que gerou a geometria.
  function normalizeShapeUVs(geometry, width, height) {
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / width + 0.5, pos.getY(i) / height + 0.5);
    }
    uv.needsUpdate = true;
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

  // Dimensões do chassi do celular — hoisted pra fora de buildSmartphone
  // porque a amostragem dos grânulos-alvo (seção 4a, mais abaixo) precisa
  // triangular exatamente a MESMA silhueta 2D, e duplicar os números ali
  // seria uma fonte fácil de desalinhamento silencioso se um dia alguém
  // mudar só um dos dois lugares.
  const PHONE_BODY_WIDTH = 1.62;
  const PHONE_BODY_HEIGHT = 3.3;
  const PHONE_BODY_DEPTH = 0.16;
  // Antes 0.17 (razão ~0.10 da largura) — bem menos arredondado que o
  // mockup de referência (.telas-phone-shell, border-radius 2.6rem, razão
  // ~0.18 da largura do card). 0.29 reproduz essa mesma proporção.
  const PHONE_CORNER_RADIUS = 0.29;

  function buildSmartphone(textureFile) {
    const group = new THREE.Group();

    // --- Chassi (corpo metálico) ---
    const bodyWidth = PHONE_BODY_WIDTH;
    const bodyHeight = PHONE_BODY_HEIGHT;
    const bodyDepth = PHONE_BODY_DEPTH;
    const cornerRadius = PHONE_CORNER_RADIUS;

    const shape = createRoundedRectShape(bodyWidth, bodyHeight, cornerRadius);
    // Bevel bem mais fino que antes — o valor anterior (0.025/0.02, quase
    // 30% da profundidade total do chassi) fazia as laterais curvarem
    // demais, lendo como um corpo "pílula"/arredondado de aparelho antigo.
    // iPhones atuais têm laterais quase retas, com só um chanfro sutil —
    // é isso que este ajuste aproxima.
    const extrudeSettings = {
      depth: bodyDepth,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.008,
      bevelSegments: 4,
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

    // Material físico premium: agora que existe um envMap real na cena
    // (ver "1b2. AMBIENTE DE ESTÚDIO", acima), o metalness volta a subir
    // sem virar "plástico brilhante genérico" — o que fazia essa leitura
    // ruim antes não era o metalness em si, era a ausência de reflexo de
    // ambiente. Com reflexo de verdade, metalness mais alto + roughness
    // mais baixo é o que lê como alumínio anodizado polido de produto
    // premium de verdade.
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1c1814,
      metalness: 0.62,
      roughness: 0.36,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 1
    });

    // --- Mesh do chassi (corpo metálico) ---
    // ESTE mesh estava sendo criado (bodyGeo/bodyMat) mas nunca virava
    // um THREE.Mesh nem era adicionado ao grupo — por isso o celular
    // não tinha corpo visível, e a seção 4 (busca por child.geometry
    // com >50 vértices, pra amostrar os grânulos do logo) não achava
    // nenhuma mesh candidata e quebrava com "Cannot read properties of
    // undefined (reading 'geometry')".
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // --- Grupo da tela — envolve tela + vidro num Object3D próprio,
    // independente do chassi. É essa camada (e só ela) que a coreografia
    // de "Foco Sequencial" (seção 7c) escala/tinge sutilmente quando o
    // texto menciona esta tela especificamente — sem nunca tocar na
    // posição/rotação/escala do celular inteiro, que já é controlada
    // pela timeline principal de scroll.
    const screenGroup = new THREE.Group();
    group.add(screenGroup);

    // --- Tela (plano com a textura do app) ---
    // Bezel fino e UNIFORME nos 4 lados — mesma proporção do padding
    // (0.5rem) do mockup DOM .telas-phone-shell.
    const screenWidth = bodyWidth - 0.11;
    const topBezel = 0.06;
    const bottomBezel = 0.06;
    const screenHeight = bodyHeight - topBezel - bottomBezel;
    const screenOffsetY = (bottomBezel - topBezel) / 2;
    // Cantos arredondados na própria tela (proporcional ao raio do chassi,
    // descontando o bezel) — uma tela com quinas 100% quadradas "vazava"
    // para fora do canto curvo do corpo perto das bordas.
    const screenCornerRadius = Math.max(cornerRadius - 0.06, 0.08);
    const screenShape = createRoundedRectShape(screenWidth, screenHeight, screenCornerRadius);
    const screenGeo = new THREE.ShapeGeometry(screenShape, 12);
    // CRÍTICO: ShapeGeometry grava UV = posição bruta do vértice, não
    // normalizada 0–1 — sem isto, a textura do print aparece encolhida
    // num fragmento pequeno no canto da tela (era exatamente o bug
    // reportado). Remapeia para 0–1 usando as dimensões reais do shape.
    normalizeShapeUVs(screenGeo, screenWidth, screenHeight);

    // Placeholder com tom quente neutro (nunca cinza "morto") até a textura chegar
    const placeholderMat = new THREE.MeshBasicMaterial({ color: 0x171411, transparent: true, opacity: 1 });
    const screen = new THREE.Mesh(screenGeo, placeholderMat);
    screen.position.set(0, screenOffsetY, bodyFrontZ + 0.01); // antes: bodyDepth / 2 + 0.012 (ficava ATRÁS do bevel)
    screenGroup.add(screen);

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
    const glassGeo = new THREE.ShapeGeometry(screenShape, 12);
    const glassMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, screenOffsetY, bodyFrontZ + 0.012); // sempre um pouco à frente da tela
    screenGroup.add(glass);

    // --- Módulo de câmera traseira (bloco quadrado com lentes) ---
    // Layout assimétrico igual ao de um iPhone Pro real: uma lente
    // PRINCIPAL maior e mais protuberante, duas lentes menores
    // (grande-angular e teleobjetiva), flash e microfone — em vez de
    // 3 lentes idênticas, que lia como genérico/decorativo demais.
    const camModule = new THREE.Group();

    // CORREÇÃO DO "PISCA" (z-fighting): a face de trás REAL do chassi,
    // depois do bevel + center(), fica em -bodyFrontZ (mesma lógica já
    // usada pra tela, só espelhada) — não em -bodyDepth/2. Módulo nasce
    // claramente FORA da casca, com folgas maiores entre as camadas.
    const bodyBackZ = -bodyFrontZ;

    const camPlateSize = 0.72;
    const camPlateRadius = 0.19;
    const camPlateShape = createRoundedRectShape(camPlateSize, camPlateSize, camPlateRadius);
    const camPlateGeo = new THREE.ShapeGeometry(camPlateShape, 16);
    const camPlateMat = new THREE.MeshStandardMaterial({
      color: 0x0e0e0f, metalness: 0.6, roughness: 0.35, transparent: true, opacity: 1,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    const camPlate = new THREE.Mesh(camPlateGeo, camPlateMat);
    camModule.add(camPlate);

    // Cada lente = anel metálico (bezel) + vidro escuro com leve tom
    // azulado (revestimento óptico) + um pequeno "catchlight" (reflexo)
    // deslocado do centro — é esse reflexinho que faz a lente parecer
    // vidro de verdade em vez de um círculo preto chapado.
    function buildLens(radius, protrusion) {
      const lensGroup = new THREE.Group();

      const ringGeo = new THREE.CircleGeometry(radius, 24);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x232326, metalness: 0.85, roughness: 0.22, transparent: true, opacity: 1,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      });
      lensGroup.add(new THREE.Mesh(ringGeo, ringMat));

      const glassGeo = new THREE.CircleGeometry(radius * 0.74, 24);
      // Agora que existe um envMap real na cena (ver "1b2. AMBIENTE DE
      // ESTÚDIO"), o problema que fez essa lente usar MeshStandardMaterial
      // (documentado alhures neste arquivo — MeshPhysicalMaterial com
      // transmission ficava escuro/opaco sem envMap) não existe mais.
      // MeshPhysicalMaterial com transmission é o que faz a lente parecer
      // vidro de verdade (refração/transparência), não só metal escuro
      // brilhante — mesma diferença de uma joia com pedra de vidro
      // genuíno vs. uma pintura preta reflexiva.
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x0a0d16,
        metalness: 0,
        roughness: 0.05,
        transmission: 0.9,
        thickness: 0.05,
        ior: 1.5,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.6,
        transparent: true,
        opacity: 1,
        polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.z = 0.007;
      lensGroup.add(glass);

      const catchGeo = new THREE.CircleGeometry(radius * 0.18, 12);
      const catchMat = new THREE.MeshBasicMaterial({
        color: 0x9fb9dd, transparent: true, opacity: 0.5,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
      });
      const catchlight = new THREE.Mesh(catchGeo, catchMat);
      catchlight.position.set(radius * 0.3, radius * 0.3, 0.009);
      lensGroup.add(catchlight);

      lensGroup.position.z = protrusion;
      return lensGroup;
    }

    // Posições em espaço LOCAL (antes da rotação de 180° do módulo) —
    // calculadas a partir do layout desejado quando visto de trás:
    // grande-angular no topo, teleobjetiva embaixo (ambas à esquerda),
    // lente PRINCIPAL maior ao centro-direita, flash no canto superior
    // e microfone perto da lente principal.
    const mainLens = buildLens(0.145, 0.02);
    mainLens.position.x = 0.125;
    mainLens.position.y = 0;
    camModule.add(mainLens);

    const wideLens = buildLens(0.145, 0.02);
    wideLens.position.x = -0.172;
    wideLens.position.y = 0.172;
    camModule.add(wideLens);

    const teleLens = buildLens(0.145, 0.02);
    teleLens.position.x = -0.172;
    teleLens.position.y = -0.172;
    camModule.add(teleLens);

    // Flash (canto oposto às lentes menores)
    const flashGeo = new THREE.CircleGeometry(0.041, 16);
    const flashMat = new THREE.MeshStandardMaterial({
      color: 0xe9dfc4, metalness: 0.15, roughness: 0.45, transparent: true, opacity: 1,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.set(0.219, 0.219, 0.0186);
    camModule.add(flash);

    // Microfone (pontinho escuro colado à lente principal)
    const micGeo = new THREE.CircleGeometry(0.0255, 12);
    const micMat = new THREE.MeshStandardMaterial({
      color: 0x000000, metalness: 0.3, roughness: 0.6, transparent: true, opacity: 1,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const mic = new THREE.Mesh(micGeo, micMat);
    mic.position.set(0.188, -0.234, 0.0186);
    camModule.add(mic);

    // Módulo encostado bem perto do canto (referência real: margem
    // mínima até a borda do aparelho, não flutuando no meio do quadrante).
    const camCornerMarginX = 0.09;
    const camCornerMarginY = 0.09;
    camModule.position.set(
      bodyWidth / 2 - camPlateSize / 2 - camCornerMarginX,
      bodyHeight / 2 - camPlateSize / 2 - camCornerMarginY,
      bodyBackZ - 0.006
    );
    camModule.rotation.y = Math.PI;
    group.add(camModule);

    // --- Câmera frontal / notch — MESMO desenho do .telas-phone-notch do
    // mockup DOM de referência: 34% da largura, topo totalmente RETO
    // (funde com a moldura acima) e só a base arredondada — um corte que
    // "desce" a partir da borda superior da tela, não uma pílula solta
    // flutuando no meio dela. Usa MeshBasicMaterial (não-iluminado) para
    // nunca "brilhar" sob a luz de estúdio — um notch real nunca reflete,
    // só absorve luz.
    const notchWidth = bodyWidth * 0.34;
    const notchHeight = 0.11;
    const notchShape = createDropNotchShape(notchWidth, notchHeight, notchHeight / 2);
    const notchGeo = new THREE.ShapeGeometry(notchShape);
    const notchMat = new THREE.MeshBasicMaterial({ color: 0x050506, transparent: true, opacity: 1 });
    const notch = new THREE.Mesh(notchGeo, notchMat);
    const screenTopEdge = bodyHeight / 2 - topBezel;
    notch.position.set(0, screenTopEdge, bodyFrontZ + 0.016);
    screenGroup.add(notch);

    group.userData.screen = screen;
    group.userData.screenGroup = screenGroup;
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

  // UM ÚNICO smartphone 3D — o "hero object" da cena. Antes existiam
  // três (centro/esquerda/direita) tentando representar vitrine/carrinho/
  // conta simultaneamente ao WebGL E ao showcase DOM da seção "Dentro do
  // App" — os dois sistemas disputavam o mesmo espaço na tela e geravam
  // o bug de "celulares fantasmas" duplicados. Agora o 3D tem só UM
  // protagonista (mais discreto, mais luxuoso), e as 3 telas reais
  // (vitrine/carrinho/conta) vivem exclusivamente no showcase 2D/DOM da
  // seção "Dentro do App" (ver "TELAS DO APP", mais abaixo) — cada
  // sistema com um papel claro, sem sobreposição possível.
  const phoneCenter = buildSmartphone('print-app.png');

  // Nasce já na pose final (ver PHONE_TARGET_POS/ROT acima), mas com
  // escala 0 e invisível — os grânulos do logo é que "constroem"
  // visualmente essa forma; o mesh real só aparece quando o morph termina
  // (ver seção 4, mais abaixo).
  phoneCenter.position.copy(PHONE_TARGET_POS);
  phoneCenter.rotation.copy(PHONE_TARGET_ROT);
  phoneCenter.scale.setScalar(0.001);
  phoneCenter.visible = false;

  scene.add(phoneCenter);

  /* ---------------------------------------------------------------------
     3b. SOMBRA DE CONTATO — sem isto o celular "flutua no vazio": nenhuma
     superfície abaixo dele, nenhuma referência de peso/escala física. Um
     plano simples com degradê radial (canvas 2D gerado em runtime — sem
     baixar nenhuma imagem) posicionado sob o aparelho, acompanhando sua
     posição/escala/opacidade a cada frame (ver renderFrame, seção 9) — a
     mesma "sombra de contato" suave usada em still de produto (relógio,
     joia, perfume) sobre superfície de estúdio, e é o que dá presença/
     peso físico que a cena não tem hoje.
     --------------------------------------------------------------------- */
  function buildContactShadowTexture() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(18,15,11,0.5)');
    grad.addColorStop(0.55, 'rgba(18,15,11,0.2)');
    grad.addColorStop(1, 'rgba(18,15,11,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: buildContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      opacity: 0
    })
  );
  contactShadow.rotation.x = -Math.PI / 2; // deitado, "apoiado" numa superfície horizontal
  contactShadow.renderOrder = -1;
  scene.add(contactShadow);

  /* ---------------------------------------------------------------------
     3c. POEIRA DOURADA — acento "confeitaria" da nova coreografia (ver
     "VITRINE GIRATÓRIA"/"PAUSA DE VITRINE" na timeline, seção 7): uma
     leva discreta de partículas douradas que só aparece durante o
     respiro/pausa do giro do celular, controlada via opacidade pela
     própria timeline (nunca visível fora desse momento). Nasce invisível
     (opacity 0) — é a timeline `tl` quem a acende.
     --------------------------------------------------------------------- */
  const DUST_COUNT = 46;
  const dustGeo = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    const radius = 1.1 + Math.random() * 0.9;
    const theta = Math.random() * Math.PI * 2;
    dustPositions[i * 3] = Math.cos(theta) * radius;
    dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 2.6;
    dustPositions[i * 3 + 2] = Math.sin(theta) * radius * 0.6;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const goldDustMat = new THREE.PointsMaterial({
    color: 0xe4c77e,
    size: 0.028,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true
  });
  const goldDust = new THREE.Points(dustGeo, goldDustMat);
  goldDust.position.copy(PHONE_TARGET_POS);
  scene.add(goldDust);

  window.__maryDebug = { scene, camera, renderer, phoneCenter, textureLoader, ASSET_PATH };

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

  // --- 4a. Pontos de DESTINO: amostra UNIFORME por ÁREA da silhueta real
  // do chassi (mesma técnica de samplePointsInTriangles usada no logo,
  // acima) — e NÃO mais por índice aleatório de vértice do bodyGeo.
  //
  // O BUG: um ExtrudeGeometry com bevel arredondado concentra MUITO mais
  // vértices nas quinas curvas (24 curveSegments × 4 cantos + bevel) do
  // que nas bordas retas. Sortear "um vértice aleatório dentre todos"
  // dava, portanto, MUITA mais chance de cair perto dos cantos — e por
  // isso o celular parecia sempre "nascer pelas quinas" primeiro. Com
  // amostragem por ÁREA sobre a MESMA silhueta 2D (createRoundedRectShape
  // triangulada), cada trecho do retângulo — quina ou borda reta — recebe
  // grânulos proporcionalmente à área real que ocupa, e o celular passa a
  // se formar por inteiro, de uma vez só, como um todo — não mais "pelos
  // cantos".
  const phoneShape2D = createRoundedRectShape(PHONE_BODY_WIDTH, PHONE_BODY_HEIGHT, PHONE_CORNER_RADIUS);
  const phoneContourPts = phoneShape2D.getPoints(24).map((p) => [p.x, p.y]);
  const phoneTriIdx = THREE.ShapeUtils.triangulateShape(
    phoneContourPts.map(([x, y]) => new THREE.Vector2(x, y)), []
  );
  const phoneTriangles = phoneTriIdx.map((tri) => tri.map((idx) => phoneContourPts[idx]));
  const phoneTriAreas = phoneTriangles.map(([a, b, c]) =>
    Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2
  );
  const phoneTriTotalArea = phoneTriAreas.reduce((sum, a) => sum + a, 0) || 1;

  const phoneTargetMatrix = new THREE.Matrix4().compose(
    PHONE_TARGET_POS,
    new THREE.Quaternion().setFromEuler(PHONE_TARGET_ROT),
    new THREE.Vector3(1, 1, 1)
  );

  const phoneTargetPositions = new Float32Array(GRANULE_COUNT * 3);
  const tmpVertex = new THREE.Vector3();
  for (let i = 0; i < GRANULE_COUNT; i++) {
    let pick = Math.random() * phoneTriTotalArea;
    let idx = 0;
    while (idx < phoneTriangles.length - 1 && pick > phoneTriAreas[idx]) {
      pick -= phoneTriAreas[idx];
      idx++;
    }
    const [a, b, c] = phoneTriangles[idx];
    let r1 = Math.random();
    let r2 = Math.random();
    if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; } // reflete pra dentro do triângulo

    const x = a[0] + r1 * (b[0] - a[0]) + r2 * (c[0] - a[0]);
    const y = a[1] + r1 * (b[1] - a[1]) + r2 * (c[1] - a[1]);
    const z = (Math.random() - 0.5) * PHONE_BODY_DEPTH; // leve espessura, igual ao chassi real

    tmpVertex.set(x, y, z).applyMatrix4(phoneTargetMatrix);
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
  const colorGold = new THREE.Color(0xB89A7A);
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
  // A posição de cada partícula é reescrita a cada frame do morph, mas o
  // boundingSphere original (calculado uma única vez, na forma do logo)
  // nunca é recalculado — então o frustum culling automático do Three.js
  // poderia, em telas mais estreitas, cortar partículas que na verdade
  // ainda estão visíveis. Como este objeto é pequeno e sempre fica perto
  // do centro da cena, desligamos o culling só para ele (custo irrisório)
  // em vez de recalcular a boundingSphere a cada frame (caro, 900 pontos).
  logoGranules.frustumCulled = false;
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
    gsap.to(pointer3D.position, { x: pLight.x, y: pLight.y, z: 4, duration: 0.6, ease: 'power3.out', overwrite: true });

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
    if (phoneCenter.visible) phoneCenter.rotation.y += delta * 0.4;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  canvas.addEventListener('touchend', () => { touchStartX = null; }, { passive: true });

  /* ---------------------------------------------------------------------
     6d. TELAS DO APP — seção dedicada, revezamento das 3 capturas reais
     ---------------------------------------------------------------------
     Substitui as antigas mini-tags que viviam coladas nos celulares 3D
     (fonte tanto da confusão visual apontada quanto do "bug" de imagem:
     texturas 3D dependem de luz de cena, ângulo de câmera e timing de
     carregamento — um <img> comum nunca tem esse problema). Aqui:
       - cada captura (vitrine/carrinho/conta) é uma <img> real, sempre
         renderizada pelo navegador;
       - o revezamento entre elas é dirigido pelo progresso do scroll
         dentro da seção (não por tempo/setTimeout — 100% preciso e
         reversível ao rolar pra cima);
       - o canto 3D ao fundo esmaece discretamente enquanto essa seção
         está em foco, para o showcase 2D nunca competir em contraste
         com os celulares/malha do WebGL.
     --------------------------------------------------------------------- */
  (function setupTelasShowcase() {
    const section = document.querySelector('.section-telas');
    if (!section) return;

    const screens = ['vitrine', 'carrinho', 'conta'];
    const stage = section.querySelector('.telas-stage');
    const phones = gsap.utils.toArray('.telas-phone', section);
    const panels = gsap.utils.toArray('.telas-panel', section);
    const dots = gsap.utils.toArray('.telas-dots [data-dot]', section);
    const card = section.querySelector('.telas-card');

    // Cada celular é dono fixo de UMA tela (data-screen) — nunca troca de
    // imagem internamente. O que muda de estado é o PAPEL (função) que
    // cada celular exerce na composição: 'active' (foco), 'left' e
    // 'right' (descanso, recuados atrás do foco, em diagonal).
    let currentActive = null;
    // Se a formação está "no palco" (visível/posicionada) ou "fora dela"
    // (ainda não chegou / já foi embora) — controla a entrada e a saída.
    let isOnstage = false;

    /* -----------------------------------------------------------------
       OTIMIZAÇÃO MOBILE — abaixo de 860px o .telas-pin deixa de ser
       sticky (vira position:relative, min-height:auto — ver styles.css),
       então a seção perde o "range" de scroll de 240vh que o scrub
       original precisa: o progresso ficaria comprimido num espaço
       minúsculo e a troca de tela leria como nervosa/instantânea. Em
       vez de forçar scrub num espaço que não existe mais, no mobile a
       troca passa a ser por AUTOPLAY (temporizador), pausado sempre
       que a seção sai do palco ou o usuário interage manualmente.
       isNarrowMobile (≤680px) também é usada para nem tentar animar
       os 2 celulares de descanso, que essa breakpoint já esconde via
       CSS (opacity:0 !important) — evita tweens GSAP inúteis em
       aparelhos justamente mais fracos.
       ----------------------------------------------------------------- */
    const isNarrowMobile = window.matchMedia('(max-width: 680px)').matches;
    const AUTOPLAY_MS = 4200;
    let autoplayTimer = null;

    function stopTelasAutoplay() {
      if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
    }
    function startTelasAutoplay() {
      if (!isMobile || prefersReducedMotion) return;
      stopTelasAutoplay();
      autoplayTimer = setInterval(() => {
        if (!isOnstage) return;
        const idx = screens.indexOf(currentActive || screens[0]);
        setTelasFormation(screens[(idx + 1) % screens.length], { onstage: true });
      }, AUTOPLAY_MS);
    }

    /* -----------------------------------------------------------------
       ISOLAMENTO 3D x DOM: o único celular 3D (phoneCenter, Three.js)
       que a seção anterior ("Experiência Digital") usa fica parado bem
       atrás desta seção enquanto o scroll passa por aqui — se só a
       opacidade do <canvas> baixasse, esse "fantasma" continuaria por
       trás dos 3 celulares reais em DOM, sobreposto quase pixel a
       pixel (era esse o bug de celulares duplicados). Por isso
       escondemos o clone 3D de verdade (fade da opacidade do MATERIAL,
       não do canvas) assim que a formação DOM entra em cena, e o
       trazemos de volta assim que ela sai — sem depender/conflitar com
       a opacidade do canvas.
       ----------------------------------------------------------------- */
    function fadeLegacyPhoneClones(hidden) {
      const grp = phoneCenter;
      if (!grp) return;
      const proxy = grp.userData.__telasCloneFade || (grp.userData.__telasCloneFade = { v: 1 });

      // CORREÇÃO DE BUG (celular 3D "fantasma" aparecendo por trás dos
      // 3 mockups reais): antes, esta função só reduzia a OPACIDADE dos
      // materiais a ~0 — mas a timeline principal (scrub, baseada em
      // unidades de tempo arbitrárias) nem sempre termina de encolher o
      // phoneCenter exatamente na mesma fração de scroll em que esta
      // seção começa/termina de verdade (a altura real de cada seção em
      // pixels varia por breakpoint). Resultado: por uma janela curta de
      // scroll, o phoneCenter podia estar com escala > 0 e opacidade
      // ainda subindo, ficando visível (ainda que sutil) atrás/entre os
      // celulares DOM. Agora, além do fade de opacidade, alternamos
      // `grp.visible` diretamente — um objeto invisible nunca é
      // renderizado, então isso elimina o "fantasma" por completo,
      // independente de qualquer descompasso de tempo/escala.
      if (!hidden) grp.visible = true; // reaparece ANTES do fade, sem flash
      gsap.killTweensOf(proxy);
      gsap.to(proxy, {
        v: hidden ? 0 : 1,
        duration: 0.5,
        ease: 'power2.out',
        overwrite: 'auto',
        onUpdate: () => setPhoneOpacity(grp, proxy.v),
        onComplete: () => { if (hidden) grp.visible = false; }
      });
    }

    // Deslocamentos e ângulos calculados a partir da largura real do
    // próprio celular renderizado — assim a composição se adapta
    // sozinha a qualquer breakpoint. Os celulares de descanso agora
    // recebem profundidade real (z) e giro em Y (rotationY) — é isso
    // que os põe EM DIAGONAL, recuando para trás do celular em foco,
    // como no mockup de referência (não apenas encolhidos de frente).
    function roleTransform(role) {
      const w = (phones[0] && phones[0].offsetWidth) || 240;
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

    // Transformação de cada papel quando a formação está "fora do
    // palco": mesma composição horizontal/diagonal, mas empurrada para
    // baixo e invisível — é de lá que ela "sobe" ao chegar, e é para lá
    // que ela "desce" ao sair, continuando o sentido natural do scroll.
    function offstageTransform(role) {
      const t = roleTransform(role);
      return Object.assign({}, t, { y: t.y + 220, opacity: 0 });
    }

    /* -----------------------------------------------------------------
       O 'REVEZAMENTO DE ESTADOS' — opera sobre os 3 <div class="telas-phone">
       reais (DOM/CSS). Anima x/y/z/rotationY/rotation/scale/opacity dos
       TRÊS simultaneamente via GSAP — com um leve STAGGER entre o
       celular em foco e os dois de descanso (em vez de todos se
       moverem em bloco, exatamente juntos), o que lê como uma
       coreografia mais orgânica e refinada, não um "corte" mecânico.
       ----------------------------------------------------------------- */
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

        // Em telas ≤680px o CSS já esconde (opacity:0 !important) tudo
        // que não é .is-front — animar x/y/z/rotation desses 2 celulares
        // seria trabalho puro descartado a cada troca de estado. Só
        // atualiza a classe (que controla o brilho/crossfade) e sai.
        if (isNarrowMobile && role !== 'active') {
          el.classList.remove('is-front');
          return;
        }

        const target = onstage ? roleTransform(role) : offstageTransform(role);
        // "Entrada de foco": o celular ativo sobe do eixo Y inferior até
        // o centro sempre que a formação inteira está chegando ao palco
        // OU ele especificamente está assumindo o papel ativo agora
        // (troca de vitrine/carrinho/conta).
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

    // Posição inicial (sem transição) — celulares fora do palco, prontos
    // para "subir" assim que a seção entrar na tela. transformPerspective
    // dá a cada celular sua própria câmera de profundidade — junto com o
    // `perspective` do container (.telas-stage, em styles.css), é isso
    // que faz o rotationY renderizar como diagonal real, não distorção.
    gsap.set(phones, { xPercent: -50, yPercent: -50, transformPerspective: 1000 });
    setTelasFormation(screens[0], { instant: true, onstage: false });
    if (card) gsap.set(card, { opacity: 0, y: 24 });

    // Clique manual nos indicadores — sempre disponível, para quem
    // prefere navegar direto em vez de rolar.
    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        if (!isOnstage || dot.dataset.dot === currentActive) return;
        setTelasFormation(dot.dataset.dot, { onstage: true });
        // Reinicia a contagem do autoplay a partir da escolha manual —
        // sem isso, o timer poderia trocar de tela de novo poucos
        // instantes depois do usuário escolher uma tela específica.
        startTelasAutoplay();
      });
    });

    // Reposiciona instantaneamente ao redimensionar (evita transições
    // "correndo atrás" do novo tamanho da viewport).
    window.addEventListener('resize', () => {
      setTelasFormation(currentActive || screens[0], { instant: true, onstage: isOnstage });
    });

    /* -----------------------------------------------------------------
       CHEGADA E SAÍDA DA FORMAÇÃO
       -----------------------------------------------------------------
       Dois gatilhos de scroll, um em cada borda da seção:
       - TOPO: ao se aproximar da seção (descendo), os 3 celulares
         SOBEM para a posição do mockup (e os 3 clones 3D somem); ao
         voltar para cima, eles recuam de novo para fora do palco (e os
         clones 3D reaparecem, pois a cena volta a precisar deles).
       - BASE: ao continuar descendo (saindo da seção por baixo), os 3
         celulares DESCEM/somem, dando lugar à próxima seção (e os
         clones 3D voltam, pois a coreografia de Jornada precisa deles);
         ao voltar, eles retornam à formação (e os clones 3D somem de
         novo). Nenhum dos dois é "scrub contínuo" — são transições
         discretas de ~0.8s por direção. ----------------------------- */
    ScrollTrigger.create({
      trigger: section,
      start: 'top 82%',
      end: 'top 18%',
      onEnter: () => {
        setTelasFormation(currentActive || screens[0], { onstage: true });
        fadeLegacyPhoneClones(true);
        if (card) gsap.to(card, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' });
        startTelasAutoplay();
      },
      onLeaveBack: () => {
        setTelasFormation(currentActive || screens[0], { onstage: false });
        fadeLegacyPhoneClones(false);
        if (card) gsap.to(card, { opacity: 0, y: 24, duration: 0.6, ease: 'power3.in' });
        stopTelasAutoplay();
      }
    });

    ScrollTrigger.create({
      trigger: section,
      start: 'bottom 82%',
      end: 'bottom 18%',
      onLeave: () => {
        setTelasFormation(currentActive || screens[0], { onstage: false });
        fadeLegacyPhoneClones(false);
        if (card) gsap.to(card, { opacity: 0, y: -20, duration: 0.6, ease: 'power3.in' });
        stopTelasAutoplay();
      },
      onEnterBack: () => {
        setTelasFormation(currentActive || screens[0], { onstage: true });
        fadeLegacyPhoneClones(true);
        if (card) gsap.to(card, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' });
        startTelasAutoplay();
      }
    });

    if (prefersReducedMotion) return; // mantém só o 1º estado; sem scroll-jacking

    // No mobile a seção não é mais pinada (ver .telas-pin em
    // styles.css, breakpoint 860px) — não existe "range" de scroll
    // interno para escrubar, então o revezamento passa a ser 100%
    // autoplay (já ligado/desligado pelos ScrollTrigger de entrada e
    // saída acima). Só no desktop, onde o pin de 240vh existe de
    // verdade, faz sentido escrubar o progresso com o scroll.
    if (!isMobile) {
      // Um proxy numérico 0→2, tweenado em scrub com o progresso do scroll
      // dentro da seção — arredondar dá o índice do estado ativo. Só
      // dispara a troca de estado quando ele realmente muda (evita
      // recriar tweens a cada micro-tick de scroll), e só enquanto a
      // formação está de fato no palco.
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

    // Esmaece o canvas 3D enquanto esta seção domina a tela — reforça o
    // contraste do showcase 2D sem precisar esconder/mostrar os
    // celulares 3D (que continuam parados, calmos, ao fundo).
    gsap.to(canvas, {
      opacity: 0.4,
      ease: 'power1.inOut',
      scrollTrigger: { trigger: section, start: 'top 80%', end: 'top 20%', scrub: 0.5 }
    });
    gsap.to(canvas, {
      opacity: 1,
      ease: 'power1.inOut',
      scrollTrigger: { trigger: section, start: 'bottom 80%', end: 'bottom 20%', scrub: 0.5 }
    });
  })();

  /* ---------------------------------------------------------------------
     6e. LEGIBILIDADE — esmaece o canvas 3D também em "Como Pedir" e
     "Nosso Processo". Antes, só a seção "Telas do App" (acima) tinha
     essa proteção; "jornada" e "sabor" ficavam com o texto direto por
     cima da cena 3D em plena opacidade, e em certos pontos do scroll
     (celulares/relevo dourado passando atrás) o contraste caía o
     bastante pra dificultar a leitura — exatamente o problema relatado.
     Mesma técnica: esmaece ao entrar, restaura ao sair, sempre via
     scrub (reversível em ambas as direções de scroll).
     --------------------------------------------------------------------- */
  ['.section-jornada', '.section-sabor'].forEach((selector) => {
    const section = document.querySelector(selector);
    if (!section) return;
    gsap.to(canvas, {
      opacity: 0.4,
      ease: 'power1.inOut',
      scrollTrigger: { trigger: section, start: 'top 75%', end: 'top 25%', scrub: 0.5 }
    });
    gsap.to(canvas, {
      opacity: 1,
      ease: 'power1.inOut',
      scrollTrigger: { trigger: section, start: 'bottom 75%', end: 'bottom 25%', scrub: 0.5 }
    });
  });

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
      // scrub mais alto = mais "peso"/atraso ao seguir o scroll — a
      // sensação de câmera de comercial de alto padrão pedida no
      // briefing, em vez do 1:1 quase instantâneo de antes.
      scrub: 1.25
    }
  });

  // Proxy de opacidade para o celular (necessário pois o grupo tem
  // vários materiais internos — body, vidro, câmera, tela — e a tela
  // troca de material assim que a textura chega).
  const opacityCenter = { v: 1 };

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
  tl.to('#hero-logo-solid', { opacity: 0, scale: 0.9, duration: 0.6, ease: 'power3.in' }, 0.3)
    .to(granuleMat, { opacity: 1, duration: 0.6, ease: 'power3.out' }, 0.3)
    .to(granuleMorph, {
      scatter: 1, duration: 1.0, ease: 'sine.inOut', onUpdate: updateGranules
    }, 0.3)
    .to(granuleMorph, {
      scatter: 0, t: 1, duration: 1.3, ease: 'power3.inOut', onUpdate: updateGranules
    }, 1.3)
    // Celular real assume o lugar dos grânulos assim que o morph termina —
    // cross-fade suave, sem "back.out"/bounce (era o que deixava o final
    // agressivo antes).
    .set(phoneCenter, { visible: true }, 2.3)
    // ---- SEÇÃO 1 (Abertura — REVELAÇÃO ORBITAL): substituímos o antigo
    // close-up cru (celular gigante, puxado pra câmera, depois recuando
    // em duas etapas) por UMA única transição contínua e macia: o
    // celular nasce já perto da sua pose final, discretamente recuado
    // (z levemente maior) e GIRANDO devagar — uma volta e meia orbital
    // em Y — enquanto cresce de zero até a escala definitiva. Nunca há
    // "zoom" agressivo: é sempre rotação lenta + crescimento suave, como
    // a virada de uma peça de joalheria sendo apresentada em vitrine.
    // Mesma janela de tempo da versão anterior (2.3 → 4.0), então nada
    // muda na proporção de scroll que as próximas seções ocupam.
    .fromTo(phoneCenter.position,
      { x: PHONE_TARGET_POS.x, y: PHONE_TARGET_POS.y - 0.35, z: PHONE_TARGET_POS.z + 0.6 },
      { x: PHONE_TARGET_POS.x, y: PHONE_TARGET_POS.y, z: PHONE_TARGET_POS.z, duration: 1.7, ease: 'power2.inOut' }, 2.3)
    .fromTo(phoneCenter.scale,
      { x: 0.001, y: 0.001, z: 0.001 },
      { x: 1, y: 1, z: 1, duration: 1.7, ease: 'power2.inOut' }, 2.3)
    .fromTo(phoneCenter.rotation,
      { x: PHONE_TARGET_ROT.x, y: PHONE_TARGET_ROT.y - Math.PI * 1.5 },
      { x: PHONE_TARGET_ROT.x, y: PHONE_TARGET_ROT.y, duration: 1.7, ease: 'power2.inOut' }, 2.3)
    .fromTo(opacityCenter,
      { v: 0 },
      { v: 1, duration: 0.8, ease: 'power2.out', onUpdate: () => setPhoneOpacity(phoneCenter, opacityCenter.v) }, 2.3)
    .to(granuleMat, { opacity: 0, duration: 0.6, ease: 'power3.in' }, 2.3)
    .set(logoGranules, { visible: false }, 2.9)

    // ---- NOVA SEÇÃO (Vitrine — respiro majestoso): um giro amplo, quase
    // uma volta completa em Y, somado a um cruzamento suave de um lado a
    // outro do palco (eixo X) e uma leve aproximação/afastamento (scale),
    // como se o produto girasse sozinho numa vitrine giratória de alta
    // joalheria — dominando a composição enquanto o texto mínimo desta
    // seção (`.section-vitrine`, ver index.html/styles.css) permanece
    // discreto ao fundo.
    // ---- VITRINE GIRATÓRIA — giro em velocidade CONSTANTE (ease:'none',
    // não 'sine.inOut' como antes) e SÓ rotação: nada de cruzar de um
    // lado a outro do palco, nada de escala pulsando junto. Uma ideia de
    // movimento por vez — o produto quase parado, girando devagar no
    // próprio eixo, como um pedestal de vitrine de joalheria.
    .to(phoneCenter.rotation, {
      y: '+=' + Math.PI * 1.15,
      duration: 1.2, ease: 'none'
    }, 4.0)
    // ---- PAUSA DE VITRINE — o giro já ia em velocidade constante, então
    // a chegada aqui lê como um freio suave, não um corte. A peça
    // praticamente para; a luz de estúdio esquenta um instante e uma leva
    // discreta de poeira dourada (ver "3c", acima) passa perto — o único
    // acento "confeitaria" explícito da coreografia, e só existe neste
    // respiro, nunca durante o giro em si.
    .to(keyLight.color, { r: 1, g: 0.85, b: 0.6, duration: 0.35, ease: 'sine.out' }, 5.2)
    .to(goldDustMat, { opacity: 0.8, duration: 0.35, ease: 'sine.out' }, 5.2)
    .to(keyLight.color, { r: 1, g: 0.902, b: 0.761, duration: 0.45, ease: 'sine.in' }, 5.35)
    .to(goldDustMat, { opacity: 0, duration: 0.45, ease: 'sine.in' }, 5.35)

    // ---- SEÇÃO 2 (Ateliê — ÂNCORA LATERAL + JANELA VIVA): o celular
    // desliza para a lateral direita, cedendo a metade esquerda da tela
    // ao texto, e se FIXA ali. Antes rotação e escala mudavam JUNTO com
    // a posição nesta mesma janela de tempo — cortado: só a posição
    // (funcionalmente necessária, é o que libera espaço pro texto) segue
    // em movimento; a leve inclinação residual que sobra do giro
    // anterior já basta, sem precisar de outro tween brigando por
    // atenção ao mesmo tempo.
    .to(phoneCenter.position, { x: 2.1, y: -0.1, z: -0.5, duration: 2, ease: 'power2.inOut' }, 6.0)

    // ---- SEÇÃO 3 (Experiência Digital): o celular "pousa" ao lado do
    // ecosystem-card — mesma lógica de restraint: só posição.
    .to(phoneCenter.position, { x: -0.55, y: -0.08, z: -0.1, duration: 1.4, ease: 'power2.inOut' }, 8.1)

    // ---- EFEITO PORTAL (entrada em "Dentro do App"): antes do
    // revezamento das 3 telas reais (100% DOM/2D — seção dedicada, ver
    // index.html + a IIFE "TELAS DO APP" mais abaixo), o celular avança
    // rapidamente para o primeiro plano — grande e imponente, quase
    // atravessando a câmera — como se o produto rasgasse um portal em
    // direção ao espectador. No final, encolhe a zero: é esse "sumiço"
    // que dá lugar à entrada triunfal dos 3 celulares reais do showcase
    // (a própria seção Telas assume o controle de opacidade a partir daqui
    // via `fadeLegacyPhoneClones`, então não há disputa de valores).
    .to(phoneCenter.position, { x: 0, y: 0.05, z: 3.4, duration: 1.0, ease: 'power2.in' }, 9.5)
    .to(phoneCenter.rotation, { x: -0.04, y: '+=0.35', duration: 1.0, ease: 'power2.in' }, 9.5)
    .to(phoneCenter.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 1.0, ease: 'power2.in' }, 9.5)
    .to(phoneCenter.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.6, ease: 'power2.in' }, 10.5)

    // ---- INTERVALO NEUTRO: a partir daqui, o scroll ainda passa pela
    // seção dedicada "Telas do App" — o celular 3D permanece reduzido a
    // zero (ver Efeito Portal, acima) e é a formação DOM que domina a
    // tela por completo.

    // ---- SEÇÃO 4 (Jornada do Pedido) — MERGULHO DE PROFUNDIDADE: o
    // celular "renasce" já mergulhando para o fundo da cena (eixo Z bem
    // negativo) enquanto GIRA lentamente até quase mostrar as costas
    // (rotationY), some quase por completo em opacidade e desliza para
    // fora do centro óptico — um cenário de fundo imersivo e escuro para
    // que o texto (`.copy-center`, largura total) reine em contraste
    // absoluto. Reforça o esmaecimento do canvas que já existe mais
    // abaixo (7a/legibilidade).
    .to(camera.position, { x: 0, y: 0.12, z: 7.6, duration: 1.6, ease: 'power3.inOut' }, 12.3)
    .to(camera.rotation, { x: 0, duration: 1.6 }, 12.3)
    .to(phoneCenter.scale, { x: 1, y: 1, z: 1, duration: 1.0, ease: 'power2.out' }, 12.3)
    .to(phoneCenter.position, { x: 2.9, y: -0.25, z: -6.2, duration: 1.6, ease: 'power3.inOut' }, 12.3)
    .to(phoneCenter.rotation, { x: 0.1, y: '+=' + (Math.PI * 0.85), duration: 1.6, ease: 'power3.inOut' }, 12.3)
    .to(opacityCenter, { v: 0.045, duration: 1.3, ease: 'power2.inOut', onUpdate: () => setPhoneOpacity(phoneCenter, opacityCenter.v) }, 12.3)

    // ---- SEÇÃO 5 (Nosso Processo / Compromisso com o Sabor): também
    // `.copy-center` — o celular continua mergulhado no fundo (mesma
    // tática de profundidade + baixa opacidade), completando lentamente
    // o giro "de costas" enquanto reequilibra a composição para o lado
    // oposto, preparando a convergência central da seção seguinte.
    .to(camera.position, { x: 0, y: 0.04, z: 8.2, duration: 1.8, ease: 'power3.inOut' }, 14.1)
    .to(phoneCenter.position, { x: -2.9, y: 0.15, z: -6.6, duration: 1.8, ease: 'sine.inOut' }, 14.1)
    .to(phoneCenter.rotation, { y: '+=' + (Math.PI * 0.4), duration: 1.8, ease: 'sine.inOut' }, 14.1)
    .to(opacityCenter, { v: 0.03, duration: 1.5, ease: 'power2.inOut', onUpdate: () => setPhoneOpacity(phoneCenter, opacityCenter.v) }, 14.1)

    // ---- SEÇÃO 6 (Quem Somos): DESINTEGRAÇÃO — o celular converge ao
    // centro, se dissolve em grânulos e some, liberando o fundo vivo por
    // completo para a biografia da fundadora (sem objeto 3D residual).
    // Parte já quase invisível (opacidade ~0.03, herdada da Seção 4/5),
    // então o "sumiço" final fica suave, sem picos de opacidade.
    .to(camera.position, { x: -0.3, y: 0.05, z: 7.4, duration: 1.8, ease: 'power3.inOut' }, 16.0)
    .to(phoneCenter.position, { x: 0, y: 0, z: -5, duration: 1.8, ease: 'power3.in' }, 16.0)
    .to(phoneCenter.rotation, { y: '+=3.2', duration: 1.8, ease: 'power3.in' }, 16.0)
    .to(phoneCenter.scale, { x: 0, y: 0, z: 0, duration: 1.8, ease: 'power3.in' }, 16.0)
    .to(opacityCenter, {
      v: 0, duration: 1.6, ease: 'power3.in',
      onUpdate: () => setPhoneOpacity(phoneCenter, opacityCenter.v)
    }, 16.0)

    // ---- SEÇÃO 7 (Download): câmera volta à posição neutra e o celular
    // faz o RETORNO elegante e simétrico ao primeiro plano — ladeando o
    // QR Code, pousa centralizado e levemente inclinado em direção ao
    // card, como se o estivesse entregando ao visitante.
    .to(camera.position, { x: 0, y: 0, z: 9, duration: 1.8, ease: 'power3.inOut' }, 17.9)
    .set(phoneCenter.position, { x: 0, y: 0, z: -3.4 }, 19.6)
    .set(phoneCenter.rotation, { x: 0, y: 0, z: 0 }, 19.6)
    .to(phoneCenter.position, { x: -2.35, y: -0.04, z: 0.4, duration: 1.9, ease: 'power2.inOut' }, 19.7)
    .to(phoneCenter.rotation, { y: 0.26, x: 0.015, duration: 1.9, ease: 'power2.inOut' }, 19.7)
    .to(phoneCenter.scale, { x: 0.9, y: 0.9, z: 0.9, duration: 1.9, ease: 'power2.inOut' }, 19.7)
    .to(opacityCenter, {
      v: 1, duration: 1.6, ease: 'power2.out',
      onUpdate: () => setPhoneOpacity(phoneCenter, opacityCenter.v)
    }, 19.7);

  /* ---------------------------------------------------------------------
     7a. CORREÇÃO DE SOBREPOSIÇÃO — "Jornada do Pedido"
     ---------------------------------------------------------------------
     A timeline 3D (seção 7 acima) usa unidades de tempo arbitrárias que
     nem sempre coincidem em proporção exata com a altura real de cada
     seção em pixels — então, dependendo da tela, o texto de "Jornada do
     Pedido" podia entrar na viewport (via scroll normal do documento)
     ANTES da câmera terminar o zoom que afasta/esconde os celulares
     laterais, fazendo o texto cruzar por cima dos 3 aparelhos ainda
     visíveis da seção anterior ("Experiência Digital").
     Correção: o bloco de texto da Jornada só começa a aparecer quando o
     usuário já rolou bem para dentro da própria seção (start: 'top 40%'),
     dando tempo de sobra — em qualquer altura de tela — para a animação
     3D já ter avançado e os celulares já estarem devidamente reposicionados
     antes do texto surgir por cima deles.
     --------------------------------------------------------------------- */
  if (!prefersReducedMotion) {
    gsap.from('.section-jornada .copy-block', {
      opacity: 0,
      y: 30,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.section-jornada', start: 'top 40%' }
    });
  }

  /* ---------------------------------------------------------------------
     7b. REVELAÇÃO DA SEÇÃO "QUEM SOMOS" — fade/slide-in independente da
     timeline 3D principal (mesmo padrão leve usado em elementos de UI,
     não precisa de scrub sincronizado quadro a quadro com o WebGL).
     --------------------------------------------------------------------- */
  if (!prefersReducedMotion) {
    gsap.from('.bio-portrait-wrap', {
      opacity: 0, x: -32, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: '.section-quemsomos', start: 'top 75%' }
    });

    /* Reveal de máscara da foto da Mary — "cortina" sólida que cobre
       o retrato e sobe (yPercent 0 -> -100) conforme o usuário rola,
       descobrindo a imagem de baixo para cima. A foto acompanha com
       um leve deszoom (scale 1.12 -> 1) e um paralaxe vertical sutil,
       para dar sensação de profundidade real na revelação — é o
       clímax emocional do site, então o movimento é lento e scrubado
       ao scroll em vez de disparado uma única vez. */
    gsap.set('.bio-portrait-curtain', { yPercent: 0 }); // cobre a foto até o scroll chegar
    gsap.set('.bio-portrait', { scale: 1.12, yPercent: 4 }); // leve zoom/deslocamento inicial

    gsap.timeline({
      scrollTrigger: {
        trigger: '.bio-portrait-wrap',
        start: 'top 85%',
        end: 'top 30%',
        scrub: 1
      }
    })
      .to('.bio-portrait-curtain', { yPercent: -100, ease: 'power2.inOut' }, 0)
      .to('.bio-portrait', { scale: 1, yPercent: 0, ease: 'power2.out' }, 0);

    gsap.from('.bio-copy', {
      opacity: 0, y: 28, duration: 1.1, ease: 'power3.out', delay: 0.15,
      scrollTrigger: { trigger: '.section-quemsomos', start: 'top 75%' }
    });
  }

  /* ---------------------------------------------------------------------
     7c. ENTRADA CINÉTICA DE TEXTOS E CARDS — fade-up + leve blur, com
     stagger entre elementos irmãos, disparada por ScrollTrigger.
     Hoje a maior parte dos blocos de texto e os cards (process-card,
     step-card, ecosystem-card) simplesmente já estavam lá quando a seção
     aparecia. Aqui cada elemento "nasce" em cena — nascimento suave,
     escalonado, em vez de aparecer pronto. Jornada e Quem Somos já
     tinham revelações próprias mais acima; este bloco cobre o que
     faltava, reaproveitando o mesmo padrão (opacity/y/ScrollTrigger) já
     estabelecido no restante do arquivo.
     --------------------------------------------------------------------- */
  if (!prefersReducedMotion) {
    // Blocos de texto (eyebrow, título, corpo, CTA) das seções que ainda
    // não tinham nenhuma entrada própria.
    const textBlocks = gsap.utils.toArray(
      '.section-vitrine .copy-block, .section-atelie .copy-block, .section-experiencia .copy-block, .section-download .copy-block'
    );
    textBlocks.forEach((block) => {
      const items = block.querySelectorAll('.eyebrow, .display-lg, .body-text, .btn-primary, .qr-card');
      if (!items.length) return;
      gsap.from(items, {
        opacity: 0,
        y: 26,
        filter: 'blur(10px)',
        duration: 1,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: block, start: 'top 78%' }
      });
    });

    // Cartões "Nosso Processo" (5) — nascem em leque, um a um.
    const processCards = gsap.utils.toArray('.process-grid .process-card');
    if (processCards.length) {
      gsap.from(processCards, {
        opacity: 0,
        y: 34,
        filter: 'blur(12px)',
        duration: 1,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: '.process-grid', start: 'top 85%' }
      });
    }

    // Cartões "Como Pedir" (Escolha / Agende / Aguarde).
    const stepCards = gsap.utils.toArray('.steps-grid .step-card');
    if (stepCards.length) {
      gsap.from(stepCards, {
        opacity: 0,
        y: 34,
        filter: 'blur(12px)',
        duration: 1,
        ease: 'power3.out',
        stagger: 0.14,
        scrollTrigger: { trigger: '.steps-grid', start: 'top 85%' }
      });
    }

    // Cartão "ecossistema" (Vitrine/Carrinho/Conta): o cartão inteiro
    // nasce primeiro, e a lista numerada dentro dele entra logo em
    // seguida, também escalonada — duas camadas de stagger.
    const ecosystemCard = document.querySelector('.ecosystem-card');
    if (ecosystemCard) {
      gsap.from(ecosystemCard, {
        opacity: 0,
        y: 30,
        filter: 'blur(12px)',
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: ecosystemCard, start: 'top 82%' }
      });
      const ecoItems = gsap.utils.toArray('.ecosystem-list li');
      if (ecoItems.length) {
        gsap.from(ecoItems, {
          opacity: 0,
          x: 18,
          filter: 'blur(8px)',
          duration: 0.85,
          ease: 'power3.out',
          stagger: 0.12,
          delay: 0.3,
          scrollTrigger: { trigger: ecosystemCard, start: 'top 82%' }
        });
      }
    }
  }

  /* ---------------------------------------------------------------------
     7d. TIPOGRAFIA CINÉTICA — títulos display-lg/display-xl.
     Dois efeitos, disparados juntos por ScrollTrigger quando cada título
     entra em foco (independente do fade-up+blur do item 7c acima, que já
     cuida da opacidade/posição — aqui só entra letter-spacing + sublinhado):

     a) Letter-spacing "abrindo": o título nasce mais comprimido
        (-0.02em) e relaxa até o valor final já definido no CSS
        (-0.01em no display-xl, -0.005em no display-lg) — um respiro
        tipográfico sutil, não um bounce.

     b) Sublinhado dourado cinético sob cada <em>: uma <line> SVG com
        pathLength="1" (truque que torna stroke-dasharray/dashoffset
        frações de 0 a 1, IGNORANDO o comprimento real em pixels — por
        isso não precisamos medir a largura do texto nem recalcular no
        resize, o traço acompanha sozinho). Começa com dashoffset 1
        (invisível) e desenha até 0 quando o título entra em cena,
        reforçando a identidade "costura fina" pedida.

     Tudo é criado via JS (nenhum elemento novo no HTML, nenhuma regra
     nova no CSS) — os <em> só ganham position/display inline no momento
     da montagem, o suficiente para servir de âncora ao SVG absoluto.
     --------------------------------------------------------------------- */
  if (!prefersReducedMotion) {
    const kineticTitles = gsap.utils.toArray('.display-lg, .display-xl');
    const svgNS = 'http://www.w3.org/2000/svg';

    kineticTitles.forEach((title) => {
      const finalLetterSpacing = window.getComputedStyle(title).letterSpacing;

      gsap.fromTo(title,
        { letterSpacing: '-0.02em' },
        {
          letterSpacing: finalLetterSpacing,
          duration: 1.3,
          ease: 'power2.out',
          scrollTrigger: { trigger: title, start: 'top 85%' }
        }
      );

      const ems = title.querySelectorAll('em');
      ems.forEach((em) => {
        em.style.position = 'relative';
        em.style.display = 'inline-block';

        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 100 8');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText =
          'position:absolute;left:0;bottom:-0.14em;width:100%;height:0.5em;overflow:visible;pointer-events:none;';

        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', '4');
        line.setAttribute('x2', '100');
        line.setAttribute('y2', '4');
        line.setAttribute('pathLength', '1');
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        line.style.stroke = 'var(--color-gold-pale)';
        line.style.strokeWidth = '1.5';
        line.style.strokeDasharray = '1';
        line.style.strokeDashoffset = '1';

        svg.appendChild(line);
        em.appendChild(svg);

        gsap.to(line, {
          strokeDashoffset: 0,
          duration: 1,
          delay: 0.25,
          ease: 'power2.inOut',
          scrollTrigger: { trigger: title, start: 'top 85%' }
        });
      });
    });
  }

  /* ---------------------------------------------------------------------
     7e. PARALLAX MULTI-CAMADA — título, subtítulo e ícones reagem ao
     ponteiro com profundidades (e "lag") diferentes entre si.
     ---------------------------------------------------------------------
     Hoje só o pano de fundo (malha WebGL) e o grão de ruído reagiam ao
     mouse/scroll — tudo o mais no primeiro plano ficava "parado", o que
     lê como camadas empilhadas, não como profundidade real. Aqui cada
     grupo de elementos ganha seu próprio multiplicador de deslocamento
     (depth) e sua própria suavização (lerp):

       título    → depth baixo (0.35) + lerp lento (0.05): quase não sai
                   do lugar, como se estivesse "mais longe" da câmera;
       subtítulo → depth médio (0.70) + lerp médio (0.07): acompanha o
                   ponteiro com um pouco mais de presença;
       ícones    → depth alto (1.35) + lerp rápido (0.10): reagem mais
                   e mais rápido, como se estivessem "mais perto".

     Reaproveita o mesmo alvo de ponteiro já normalizado (noiseTargetX/Y,
     calculado em handlePointerMove, seção 6) — só aplica um multiplicador
     de profundidade distinto por camada, sem precisar de outro listener.

     Técnico: em vez de escrever em `transform` (propriedade já usada
     pelas entradas GSAP — fade-up/blur do item 7c — o que causaria
     disputa de valor durante a animação de entrada), o parallax escreve
     na propriedade CSS independente `translate`. `transform` e
     `translate` são compostos pelo navegador sem conflito, então o
     elemento pode ter uma entrada GSAP em `transform` E um parallax
     contínuo em `translate` ao mesmo tempo, cada um dono da sua camada.
     --------------------------------------------------------------------- */
  const PARALLAX_CONFIG = {
    title:    { selector: '.display-xl, .display-lg', depth: 0.35, lerp: 0.05 },
    subtitle: { selector: '.eyebrow, .lede, .body-text', depth: 0.70, lerp: 0.07 },
    icon:     { selector: '.step-icon, .process-icon, .device-icon, .ecosystem-devices, .ecosystem-divider', depth: 1.35, lerp: 0.10 }
  };

  const parallaxLayers = [];
  if (!prefersReducedMotion) {
    Object.values(PARALLAX_CONFIG).forEach(({ selector, depth, lerp }) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.style.willChange = 'translate';
        parallaxLayers.push({ el, depth, lerp, x: 0, y: 0 });
      });
    });
  }

  /* ---------------------------------------------------------------------
     7f. TRANSIÇÕES DE SEÇÃO CINEMATOGRÁFICAS — saída, não só entrada.
     ---------------------------------------------------------------------
     Até aqui, tudo que existia era ENTRADA (fade-up/blur do 7c, tipografia
     cinética do 7d): a seção anterior simplesmente ficava parada enquanto
     a próxima chegava por baixo — a troca lia como um corte seco, não como
     rolagem editorial.

     Aqui cada seção (a própria tag <section>, então todo o conteúdo DOM
     dela junto) ganha uma leve escala + fade DE SAÍDA, presa por scrub ao
     scroll: começa no instante exato em que a seção passa a preencher a
     tela inteira (`top top`) e termina no instante exato em que ela some
     por completo por cima (`bottom top`) — ou seja, a janela de animação
     é sempre EXATAMENTE a altura da própria seção, nunca antecipada nem
     atrasada, e 100% reversível (scrub, não tween solto).

     Como as seções são blocos empilhados em fluxo normal (não têm pin
     individual), esse intervalo colide, quase quadro a quadro, com o
     instante em que a PRÓXIMA seção termina de preencher a tela — o
     resultado é um crossfade suave entre uma e outra, como troca de plano
     num filme, em vez de duas camadas se substituindo de golpe.

     `transform: scale` não afeta o layout dos vizinhos (é só visual), e o
     canvas 3D fica fora de qualquer `<section>` — então a cena WebGL por
     trás continua intocada, só o texto/cards em primeiro plano ganham a
     saída.

     Ficam de fora, de propósito:
       - .section-telas: já tem seu próprio crossfade de cartão (ver 6d),
         é sticky/pinned por dentro e cobre 240vh — aplicar aqui duraria
         cedo demais e brigaria com a lógica que já existe.
       - .section-download: é a última seção (tem o rodapé); não há
         "próxima" seção para revelar por trás, então sumir com ela
         deixaria só o fundo vazio.
     --------------------------------------------------------------------- */
  if (!prefersReducedMotion) {
    const cinematicSections = gsap.utils.toArray(
      '.section-hero, .section-atelie, .section-experiencia, .section-jornada, .section-sabor, .section-quemsomos'
    );
    cinematicSections.forEach((section) => {
      gsap.to(section, {
        scale: 0.94,
        opacity: 0,
        ease: 'power1.in',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom top',
          scrub: true
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     8. RESIZE / RESPONSIVO — celulares reescalam no mobile sem cobrir texto
     --------------------------------------------------------------------- */
  function applyResponsiveLayout() {
    const mobile = window.innerWidth <= 860;
    // No mobile, recuamos levemente a câmera para o celular nunca cobrir
    // os blocos de texto (que passam a ocupar 100% da largura da tela).
    camera.position.z = mobile ? 10.5 : 9;
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

  // GLASSMORPHISM: liga assim que sai do topo (>40px), independente da
  // direção — é isso que faltava no CSS original (o header nunca tinha
  // background nem backdrop-filter, só a lógica de show/hide).
  const HEADER_GLASS_AFTER = 40;

  function updateHeaderVisibility() {
    const currentY = window.scrollY;
    const diff = currentY - headerLastY;

    siteHeader.classList.toggle('is-scrolled', currentY > HEADER_GLASS_AFTER);

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
    updateHeaderVisibility(); // estado correto mesmo se a página carregar já rolada
  }

  /* ---------------------------------------------------------------------
     10. PÓS-PROCESSAMENTO — bloom sutil + profundidade de campo (DoF)
     ---------------------------------------------------------------------
     Dois efeitos puramente de acabamento visual, então: (1) pulados por
     completo no mobile — já é onde menos sobra headroom de GPU, e é o
     dispositivo onde esses detalhes menos se notam; (2) tudo dentro de
     um try/catch — se um dos scripts de pós-processamento (carregados
     via CDN no index.html) falhar em algum navegador, a cena volta
     sozinha a renderizar direto (renderer.render), sem quebrar a página.

     BLOOM: limiar (threshold) alto — só o que já é bem claro (a poeira
     dourada da "Pausa de vitrine", os catchlights das lentes, os
     recortes mais estourados do reflexo de estúdio) ganha um leve halo.
     Em nenhum momento a cena inteira "brilha".

     PROFUNDIDADE DE CAMPO: o foco acompanha a distância real do celular
     até a câmera A CADA FRAME (ver renderFrame, abaixo) — como o
     celular se move bastante ao longo da timeline, um foco fixo ficaria
     ora nítido, ora desfocado sem motivo. Com foco dinâmico, ele nasce
     sempre nítido e é o FUNDO (o "pano vivo" e a poeira/grânulos) que
     desfoca suavemente — o mesmo truque de lente aberta que separa o
     produto do cenário em still fotográfico de estúdio.
     --------------------------------------------------------------------- */
  let composer = null;
  let bokehPass = null;
  try {
    if (!isMobile && window.THREE && THREE.EffectComposer && THREE.RenderPass &&
        THREE.UnrealBloomPass && THREE.BokehPass) {
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));

      const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.42,  // strength — sutil
        0.4,   // radius
        0.82   // threshold — alto, só os brilhos mais fortes estouram
      );
      composer.addPass(bloomPass);

      bokehPass = new THREE.BokehPass(scene, camera, {
        focus: 5.0,
        aperture: 0.00028,
        maxblur: 0.006,
        width: window.innerWidth,
        height: window.innerHeight
      });
      composer.addPass(bokehPass);
    }
  } catch (err) {
    console.warn('[Mary Cake] Pós-processamento (bloom/DoF) indisponível — seguindo sem ele:', err);
    composer = null;
    bokehPass = null;
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) {
      composer.setSize(window.innerWidth, window.innerHeight);
      if (bokehPass && bokehPass.uniforms && bokehPass.uniforms.aspect) {
        bokehPass.uniforms.aspect.value = window.innerWidth / window.innerHeight;
      }
    }
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
    try {
      renderFrame();
    } catch (err) {
      // Antes, uma exceção aqui matava o loop de vez (requestAnimationFrame
      // nunca era re-agendado) e a cena congelava no último frame
      // renderizado — visualmente indistinguível de "a malha não se move".
      // Agora o erro só é logado uma vez, e o loop CONTINUA sendo
      // reagendado — o pior caso passa a ser "esse frame específico não
      // atualizou", nunca "a cena morreu pra sempre".
      if (!animate.hasLoggedError) {
        console.error('[Mary Cake] Erro no loop de animação (rAF continua rodando):', err);
        animate.hasLoggedError = true;
      }
    }
    requestAnimationFrame(animate);
  }

  function renderFrame() {
    const elapsed = clock.getElapsedTime();

    // Flutuação ambiente — "orbitar em arco elegante": um leve balanço
    // (rotation.z) em vez de deslocar position.y. A posição em si já é
    // 100% controlada pela timeline de scroll; usar rotation.z (nunca
    // tocado por nenhuma outra parte do código) evita qualquer disputa
    // de valor com o scrub e garante um movimento limpo e sempre
    // limitado — nada de deriva acumulada frame a frame.
    if (!prefersReducedMotion) {
      // Flutuação "manteiga": em vez de uma única senoide (que sempre revela
      // seu período e parece mecânica), somamos 2-3 trens de onda com
      // frequências, fases e amplitudes diferentes por eixo — um Perlin-noise
      // pobre, mas suficiente para que o olho nunca identifique um ciclo
      // repetido. O resultado é um objeto pairando em torno de um eixo
      // invisível, nunca "balançando" de forma óbvia.
      const t = elapsed;
      phoneCenter.rotation.z = Math.sin(t * 0.55) * 0.026 + Math.sin(t * 0.21 + 1.1) * 0.010;
      phoneCenter.rotation.x = Math.sin(t * 0.34 + 0.6) * 0.014 + Math.sin(t * 0.13) * 0.006;
      // Poeira dourada: giro contínuo bem lento — só perceptível quando a
      // timeline acende sua opacidade durante a "Pausa de vitrine".
      goldDust.rotation.y = t * 0.12;
    }

    // Sombra de contato acompanha X/Z e a escala do celular a cada frame —
    // Y fica um pouco abaixo da base do aparelho, simulando uma superfície
    // de estúdio. A opacidade segue a MESMA curva de opacidade do celular
    // (opacityCenter, controlada pela timeline via setPhoneOpacity), então
    // ela nasce e some sempre junto com o "hero object" — nunca fica
    // visível sozinha, "boiando" no vazio quando o celular já sumiu.
    if (phoneCenter.visible) {
      const phoneScale = phoneCenter.scale.x;
      contactShadow.position.set(
        phoneCenter.position.x,
        phoneCenter.position.y - 1.85 * phoneScale,
        phoneCenter.position.z
      );
      contactShadow.scale.setScalar(Math.max(phoneScale * 2.6, 0.001));
      contactShadow.material.opacity = opacityCenter.v * 0.85;
    } else {
      contactShadow.material.opacity = 0;
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

    // Parallax multi-camada (item 4): título, subtítulo e ícones — cada
    // camada lerpa em direção ao seu próprio alvo (noiseTargetX/Y * depth)
    // na sua própria velocidade, escrevendo em `translate` (não `transform`)
    // pra nunca disputar com as entradas GSAP do mesmo elemento.
    if (parallaxLayers.length) {
      for (let i = 0; i < parallaxLayers.length; i++) {
        const layer = parallaxLayers[i];
        layer.x += (noiseTargetX * layer.depth - layer.x) * layer.lerp;
        layer.y += (noiseTargetY * layer.depth - layer.y) * layer.lerp;
        layer.el.style.translate = `${layer.x.toFixed(2)}px ${layer.y.toFixed(2)}px`;
      }
    }

    // Profundidade de campo: foco sempre no celular, onde quer que a
    // timeline o tenha colocado neste instante — é o que garante que ele
    // nunca desfoca junto com o fundo (ver "10. PÓS-PROCESSAMENTO", acima).
    if (bokehPass && bokehPass.uniforms && bokehPass.uniforms.focus) {
      bokehPass.uniforms.focus.value = camera.position.distanceTo(phoneCenter.position);
    }

    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
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

  /* Fallback: caso algum asset falhe silenciosamente, garante que o loader
     some E que o scroll seja liberado — nunca deixa o usuário preso. */
  gsap.delayedCall(6, () => {
    loader.classList.add('is-hidden');
    releaseScrollLock();
  });
})();
