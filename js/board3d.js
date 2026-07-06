// ===== 3D board (Three.js): board, tokens, dice, houses, cinematic camera =====
// Public API (used by ui.js):
//   B3D.init(container, {onTileClick})
//   B3D.syncPlayers(players, myIdx)      – create/update token meshes
//   B3D.snapTokens(dispPositions, players) – instant placement (with grouping)
//   B3D.moveToken(pi, from, to, {jump, onHop}) -> Promise (camera follows)
//   B3D.rollDice([d1,d2]) -> Promise     – physical-looking dice toss
//   B3D.setDice(vals)                    – show result instantly / hide
//   B3D.updateProps(state)               – owner strips, mortgage, houses
//   B3D.deckScreenRect(isChance)         – screen rect of a deck (card FX origin)
//   B3D.toggleFlat()                     – top-down view toggle
//   B3D.resize()

const B3D = (() => {
  // ---- board metrics: 11 cells per side, corners 1.5x, total 12 units ----
  const SIZE = 12, HALF = 6, CORNER = 1.5, CELL = 1;
  const BOARD_H = 0.34;       // board thickness
  const TOP = BOARD_H;        // y of board top surface
  const TEX = 2048, K = TEX / SIZE;

  let renderer, scene, camera, container, onTileClick;
  let boardTex, texCanvas, texCtx;
  let tokens = [];            // [{group, colorIdx}]
  let dice = [];              // 2 die meshes
  let housesGroup, decks = {};
  let lastPropsKey = '';
  const anims = [];           // active tweens
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), mode: 'overview', followPi: -1, flat: false };
  let curLook = new THREE.Vector3(0, 0, 0);

  // ---------- layout helpers ----------
  function gridPos(i) {
    if (i <= 10) return { r: 11, c: 11 - i };
    if (i <= 20) return { r: 11 - (i - 10), c: 1 };
    if (i <= 30) return { r: 1, c: i - 19 };
    return { r: i - 29, c: 11 };
  }
  function sideOf(i) { return i <= 10 ? 'bottom' : i <= 20 ? 'left' : i <= 30 ? 'top' : 'right'; }
  // start coordinate of grid line n (1..12) along one axis
  function lineAt(n) { return -HALF + (n <= 1 ? 0 : CORNER + (n - 2) * CELL); }
  function spanOf(n) { return (n === 1 || n === 11) ? CORNER : CELL; }
  // world rect of tile i: {x,z} center, {w,d} size
  function tileRect(i) {
    const { r, c } = gridPos(i);
    const x0 = lineAt(c), z0 = lineAt(r);
    const w = spanOf(c), d = spanOf(r);
    return { x: x0 + w / 2, z: z0 + d / 2, w, d, side: sideOf(i) };
  }
  function tileWorld(i) { const t = tileRect(i); return new THREE.Vector3(t.x, TOP, t.z); }

  // ---------- board texture (offscreen 2D canvas) ----------
  function shortName(t) {
    return t.name.replace(' Avenue', ' Ave').replace(' Railroad', ' RR').replace('Community Chest', 'КАЗНА')
      .replace('Chance', 'ШАНС').replace('Income Tax', 'НАЛОГ').replace('Luxury Tax', 'НАЛОГ')
      .replace('Jail / Visiting', 'ТЮРЬМА').replace('Free Parking', 'ПАРКОВКА').replace('Go To Jail', 'В ТЮРЬМУ');
  }
  function wrap(ctx, text, maxW) {
    const words = text.toUpperCase().split(' '), lines = [];
    let line = '';
    words.forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines.slice(0, 3);
  }

  function drawBoardTexture(state) {
    const ctx = texCtx;
    // mint field
    ctx.fillStyle = '#cde3d2';
    ctx.fillRect(0, 0, TEX, TEX);
    // subtle vignette on the field
    const vg = ctx.createRadialGradient(TEX / 2, TEX / 2, TEX * 0.15, TEX / 2, TEX / 2, TEX * 0.72);
    vg.addColorStop(0, 'rgba(255,255,255,0.10)');
    vg.addColorStop(1, 'rgba(40,80,55,0.14)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, TEX, TEX);

    TILES.forEach((t, i) => {
      const R = tileRect(i);
      const px = (R.x - R.w / 2 + HALF) * K, py = (R.z - R.d / 2 + HALF) * K;
      const pw = R.w * K, ph = R.d * K;
      // tile bg + border
      ctx.fillStyle = '#f3efdd';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#2a2a26';
      ctx.lineWidth = 4;
      ctx.strokeRect(px + 2, py + 2, pw - 4, ph - 4);

      const ps = state && state.props ? state.props[i] : null;
      // mortgaged: hatch overlay
      if (ps && ps.mortgaged) {
        ctx.save();
        ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
        ctx.strokeStyle = 'rgba(90,90,80,0.5)'; ctx.lineWidth = 6;
        for (let s = -ph; s < pw + ph; s += 26) {
          ctx.beginPath(); ctx.moveTo(px + s, py); ctx.lineTo(px + s + ph, py + ph); ctx.stroke();
        }
        ctx.restore();
      }

      // rotate ctx so text reads facing the board center (like a real board)
      ctx.save();
      ctx.translate(px + pw / 2, py + ph / 2);
      const rot = { bottom: 0, left: Math.PI / 2, top: Math.PI, right: -Math.PI / 2 }[R.side];
      ctx.rotate(rot);
      // local coords: width along reading direction, height toward center
      const lw = (R.side === 'left' || R.side === 'right') ? ph : pw;
      const lh = (R.side === 'left' || R.side === 'right') ? pw : ph;

      const isCorner = i % 10 === 0;
      if (isCorner) {
        ctx.rotate(i === 0 ? -Math.PI / 4 : i === 10 ? 0 : i === 20 ? Math.PI / 4 : Math.PI / 4);
        ctx.fillStyle = i === 0 ? '#b02020' : '#1d1c18';
        ctx.font = `800 ${Math.round(K * 0.30)}px Rubik, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const nm = shortName(t);
        if (i === 0) {
          ctx.fillText('GO', 0, K * 0.14);
          ctx.font = `800 ${Math.round(K * 0.5)}px Rubik, sans-serif`;
          ctx.fillText('←', 0, -K * 0.28);
        } else {
          nm.split(' ').forEach((wd, li, arr) => ctx.fillText(wd, 0, (li - (arr.length - 1) / 2) * K * 0.34));
        }
        ctx.restore();
        return;
      }

      // color bar (props) on the center-facing edge (local top)
      if (t.type === 'prop') {
        ctx.fillStyle = GROUP_COLORS[t.group];
        ctx.fillRect(-lw / 2 + 4, -lh / 2 + 4, lw - 8, lh * 0.24);
        ctx.strokeStyle = '#2a2a26'; ctx.lineWidth = 3;
        ctx.strokeRect(-lw / 2 + 4, -lh / 2 + 4, lw - 8, lh * 0.24);
      }
      // owner strip on the outer edge (local bottom)
      if (ps && ps.owner >= 0 && state.players[ps.owner]) {
        ctx.fillStyle = PLAYER_COLORS[state.players[ps.owner].color].solid;
        ctx.fillRect(-lw / 2 + 4, lh / 2 - lh * 0.11, lw - 8, lh * 0.11 - 4);
      }

      // icon for special tiles
      const icons = { chest: '▣', chance: '?', tax: '◆', rail: '▬', util: '◉', };
      if (icons[t.type]) {
        ctx.fillStyle = t.type === 'chance' ? '#c0511d' : t.type === 'chest' ? '#1d4e96' : '#3a382f';
        ctx.font = `800 ${Math.round(K * 0.34)}px Rubik, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(icons[t.type], 0, -lh * 0.10);
      }

      // name
      ctx.fillStyle = '#1d1c18';
      ctx.font = `700 ${Math.round(K * 0.115)}px Rubik, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lines = wrap(ctx, shortName(t), lw - 18);
      const nameY = t.type === 'prop' ? -lh * 0.05 : lh * 0.13;
      lines.forEach((ln, li) => ctx.fillText(ln, 0, nameY + li * K * 0.135));
      // price
      if (t.price) {
        ctx.fillStyle = '#3a382f';
        ctx.font = `600 ${Math.round(K * 0.105)}px Rubik, sans-serif`;
        ctx.fillText(CUR + t.price, 0, lh / 2 - lh * 0.17);
      }
      ctx.restore();
    });

    // red diagonal MONOPOLY plaque in the center
    ctx.save();
    ctx.translate(TEX / 2, TEX / 2);
    ctx.rotate(-Math.PI / 4.3);
    const pw2 = TEX * 0.42, ph2 = TEX * 0.085;
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
    const grad = ctx.createLinearGradient(0, -ph2 / 2, 0, ph2 / 2);
    grad.addColorStop(0, '#f04338'); grad.addColorStop(0.55, '#d21f1f'); grad.addColorStop(1, '#a91414');
    ctx.fillStyle = grad;
    ctx.fillRect(-pw2 / 2, -ph2 / 2, pw2, ph2);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(110,8,8,0.9)'; ctx.lineWidth = 5;
    ctx.strokeRect(-pw2 / 2, -ph2 / 2, pw2, ph2);
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${Math.round(ph2 * 0.62)}px Rubik, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('MONOPOLY', 0, 4);
    ctx.restore();

    if (boardTex) boardTex.needsUpdate = true;
  }

  // ---------- dice ----------
  function pipTexture(n) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#faf7ef'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 6; x.strokeRect(3, 3, 122, 122);
    const P = { 1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[32, 32], [64, 64], [96, 96]],
      4: [[36, 36], [92, 36], [36, 92], [92, 92]], 5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]],
      6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]] };
    x.fillStyle = '#1c1a16';
    P[n].forEach(([px, py]) => { x.beginPath(); x.arc(px, py, 11, 0, 7); x.fill(); });
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  // materials order [+x,-x,+y,-y,+z,-z] -> values [2,5,1,6,3,4]
  const DIE_UP = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [0, 0, Math.PI / 2], 5: [0, 0, -Math.PI / 2], 3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0] };
  function buildDie() {
    const mats = [2, 5, 1, 6, 3, 4].map(v => new THREE.MeshStandardMaterial({ map: pipTexture(v), roughness: 0.35, metalness: 0.05 }));
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), mats);
    m.castShadow = true;
    m.visible = false;
    return m;
  }

  // ---------- tokens ----------
  function buildToken(colorHex) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.85, roughness: 0.28 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.06, 24), mat);
    base.position.y = 0.03;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.3, 24), mat);
    body.position.y = 0.2;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 16), mat);
    neck.position.y = 0.37;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), mat);
    head.position.y = 0.44;
    [base, body, neck, head].forEach(m => { m.castShadow = true; g.add(m); });
    return g;
  }

  // ---------- houses ----------
  const HOUSE_MAT = new THREE.MeshStandardMaterial({ color: '#1fa84f', roughness: 0.5 });
  const ROOF_MAT = new THREE.MeshStandardMaterial({ color: '#157a38', roughness: 0.5 });
  const HOTEL_MAT = new THREE.MeshStandardMaterial({ color: '#d21f1f', roughness: 0.45 });
  const HOTELROOF_MAT = new THREE.MeshStandardMaterial({ color: '#a41212', roughness: 0.45 });
  function buildHouse(hotel) {
    const g = new THREE.Group();
    const s = hotel ? 0.17 : 0.11;
    const box = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), hotel ? HOTEL_MAT : HOUSE_MAT);
    box.position.y = s * 0.4;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(s * 0.78, s * 0.55, 4), hotel ? HOTELROOF_MAT : ROOF_MAT);
    roof.position.y = s * 0.8 + s * 0.27;
    roof.rotation.y = Math.PI / 4;
    box.castShadow = roof.castShadow = true;
    g.add(box); g.add(roof);
    return g;
  }

  // ---------- decks ----------
  function deckTexture(label, c1, c2) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 320;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 512, 320);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    x.fillStyle = g; x.fillRect(0, 0, 512, 320);
    x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 8; x.strokeRect(16, 16, 480, 288);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (label === 'ШАНС') {
      x.font = '800 150px Rubik, sans-serif';
      x.fillText('?', 256, 120);
      x.font = '800 64px Rubik, sans-serif';
      x.fillText(label, 256, 240);
    } else {
      x.font = '800 72px Rubik, sans-serif';
      x.fillText(label, 256, 160);
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function buildDeck(label, c1, c2) {
    const g = new THREE.Group();
    const w = 2.1, d = 1.32, n = 5;
    for (let i = 0; i < n; i++) {
      const top = i === n - 1;
      const mat = top
        ? new THREE.MeshStandardMaterial({ map: deckTexture(label, c1, c2), roughness: 0.5 })
        : new THREE.MeshStandardMaterial({ color: i % 2 ? c2 : c1, roughness: 0.6 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, 0.028, d), mat);
      box.position.set((Math.random() - 0.5) * 0.04, 0.014 + i * 0.028, (Math.random() - 0.5) * 0.03);
      box.rotation.y = (Math.random() - 0.5) * 0.05;
      box.castShadow = top;
      g.add(box);
    }
    return g;
  }

  // ---------- camera ----------
  function overviewFor(flat) {
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hf = Math.atan(Math.tan(vf) * aspect);
    const dist = 7.6 / Math.tan(Math.min(vf, hf));
    if (flat) return { pos: new THREE.Vector3(0, dist * 1.08, 0.01), look: new THREE.Vector3(0, 0, 0) };
    const dir = new THREE.Vector3(0, 0.92, 0.78).normalize();
    return { pos: dir.multiplyScalar(dist * 1.02), look: new THREE.Vector3(0, 0, -0.55) };
  }
  function goOverview() {
    cam.mode = 'overview';
    const o = overviewFor(cam.flat);
    cam.pos.copy(o.pos); cam.look.copy(o.look);
  }

  // ---------- tweens ----------
  function tween(dur, fn) {
    return new Promise(res => anims.push({ t0: performance.now(), dur, fn, res }));
  }
  const easeOut = k => 1 - Math.pow(1 - k, 3);

  // ---------- render loop ----------
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now();
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      const k = Math.min(1, (now - a.t0) / a.dur);
      a.fn(k);
      if (k >= 1) { anims.splice(i, 1); a.res(); }
    }
    // camera follow: orbit with the token around the board
    if (cam.mode === 'follow' && tokens[cam.followPi]) {
      const tp = tokens[cam.followPi].group.position;
      const dir = new THREE.Vector2(tp.x, tp.z);
      if (dir.lengthSq() < 0.01) dir.set(0, 1); else dir.normalize();
      cam.pos.set(tp.x + dir.x * 3.6, TOP + 4.4, tp.z + dir.y * 3.6);
      cam.look.set(tp.x, TOP + 0.2, tp.z);
    }
    camera.position.lerp(cam.pos, 0.06);
    curLook.lerp(cam.look, 0.09);
    camera.lookAt(curLook);
    renderer.render(scene, camera);
  }

  // ---------- public ----------
  return {
    init(el, opts = {}) {
      container = el;
      onTileClick = opts.onTileClick || (() => {});
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      renderer.outputEncoding = THREE.sRGBEncoding;
      container.appendChild(renderer.domElement);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

      // lights: warm key + cool fill, soft shadows
      scene.add(new THREE.HemisphereLight(0xfff2dd, 0x2a2119, 0.75));
      const key = new THREE.DirectionalLight(0xffd9a8, 1.5);
      key.position.set(-7, 12, 6);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = key.shadow.camera.bottom = -10;
      key.shadow.camera.right = key.shadow.camera.top = 10;
      key.shadow.bias = -0.0004;
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x8fb6ff, 0.35);
      rim.position.set(8, 6, -9);
      scene.add(rim);

      // table
      const woodTex = new THREE.TextureLoader().load('assets/table_wood.png');
      woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
      woodTex.repeat.set(2.2, 2.2);
      woodTex.encoding = THREE.sRGBEncoding;
      const table = new THREE.Mesh(
        new THREE.PlaneGeometry(70, 70),
        new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.42, metalness: 0.08 })
      );
      table.rotation.x = -Math.PI / 2;
      table.receiveShadow = true;
      scene.add(table);

      // board box with painted top
      texCanvas = document.createElement('canvas');
      texCanvas.width = texCanvas.height = TEX;
      texCtx = texCanvas.getContext('2d');
      drawBoardTexture(null);
      boardTex = new THREE.CanvasTexture(texCanvas);
      boardTex.encoding = THREE.sRGBEncoding;
      boardTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const edge = new THREE.MeshStandardMaterial({ color: '#efe9d4', roughness: 0.55 });
      const bottom = new THREE.MeshStandardMaterial({ color: '#3a2c1c', roughness: 0.7 });
      const topM = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.5, metalness: 0.02 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(SIZE, BOARD_H, SIZE), [edge, edge, topM, bottom, edge, edge]);
      board.position.y = BOARD_H / 2;
      board.castShadow = board.receiveShadow = true;
      scene.add(board);

      // decks aligned with the diagonal plaque
      decks.chance = buildDeck('ШАНС', '#f09545', '#c0511d');
      decks.chance.position.set(-1.85, TOP, -1.85);
      decks.chance.rotation.y = -Math.PI / 4.3;
      scene.add(decks.chance);
      decks.chest = buildDeck('КАЗНА', '#4a90dd', '#1d4e96');
      decks.chest.position.set(1.85, TOP, 1.85);
      decks.chest.rotation.y = -Math.PI / 4.3;
      scene.add(decks.chest);

      // dice
      dice = [buildDie(), buildDie()];
      dice.forEach(d => scene.add(d));

      housesGroup = new THREE.Group();
      scene.add(housesGroup);

      // click -> tile
      renderer.domElement.addEventListener('click', e => {
        const r = renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObject(board)[0];
        if (!hit) return;
        const { x, z } = hit.point;
        if (Math.abs(x) > HALF || Math.abs(z) > HALF) return;
        for (let i = 0; i < 40; i++) {
          const t = tileRect(i);
          if (x >= t.x - t.w / 2 && x <= t.x + t.w / 2 && z >= t.z - t.d / 2 && z <= t.z + t.d / 2) { onTileClick(i); return; }
        }
      });

      this.resize();
      goOverview();
      camera.position.copy(cam.pos);
      curLook.copy(cam.look);
      window.addEventListener('resize', () => this.resize());
      loop();
    },

    resize() {
      if (!renderer) return;
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      if (cam.mode === 'overview') goOverview();
    },

    syncPlayers(players, myIdx) {
      players.forEach((p, pi) => {
        if (!tokens[pi]) {
          const g = buildToken(PLAYER_COLORS[p.color].solid);
          scene.add(g);
          tokens[pi] = { group: g, colorIdx: p.color };
        }
        tokens[pi].group.visible = !p.bankrupt;
      });
    },

    // instant placement with per-tile grouping offsets
    snapTokens(disp, players) {
      if (!disp) return;
      const groups = {};
      players.forEach((p, pi) => { if (!p.bankrupt) (groups[disp[pi]] = groups[disp[pi]] || []).push(pi); });
      players.forEach((p, pi) => {
        if (p.bankrupt || !tokens[pi]) return;
        const g = groups[disp[pi]], k = g.indexOf(pi), n = g.length;
        const w = tileWorld(disp[pi]);
        const off = (k - (n - 1) / 2) * 0.24;
        const side = sideOf(disp[pi]);
        if (side === 'bottom' || side === 'top') tokens[pi].group.position.set(w.x + off, TOP, w.z + (k % 2 ? 0.14 : -0.05));
        else tokens[pi].group.position.set(w.x + (k % 2 ? 0.14 : -0.05), TOP, w.z + off);
      });
    },

    async moveToken(pi, from, to, { jump = false, onHop = null } = {}) {
      const tok = tokens[pi];
      if (!tok) return;
      cam.mode = 'follow'; cam.followPi = pi;
      let steps = (to - from + 40) % 40, dir = 1;
      if (steps >= 37) { dir = -1; steps = 40 - steps; }
      if (jump || steps === 0 || steps > 12) {
        // one big arc flight
        const a = tok.group.position.clone(), b = tileWorld(to);
        if (onHop) onHop('fly');
        await tween(700, k => {
          const e = easeOut(k);
          tok.group.position.lerpVectors(a, b, e);
          tok.group.position.y = TOP + Math.sin(e * Math.PI) * 1.6;
          tok.group.rotation.y = e * Math.PI * 2;
        });
        tok.group.rotation.y = 0;
      } else {
        for (let s = 1; s <= steps; s++) {
          const t = (from + dir * s + 40) % 40;
          const a = tok.group.position.clone(), b = tileWorld(t);
          if (onHop) onHop('hop');
          await tween(210, k => {
            tok.group.position.lerpVectors(a, b, k);
            tok.group.position.y = TOP + Math.sin(k * Math.PI) * 0.34;
          });
        }
      }
      await new Promise(r => setTimeout(r, 480));
      goOverview();
    },

    async rollDice(vals) {
      // toss both dice onto the center of the board
      const targets = [new THREE.Vector3(-0.55, 0, 0.45), new THREE.Vector3(0.55, 0, 0.62)];
      const proms = dice.map((d, i) => {
        d.visible = true;
        const start = new THREE.Vector3((i ? 1.6 : -1.6), TOP + 2.6, 2.6);
        const end = targets[i].clone().setY(TOP + 0.17);
        const [rx, ry, rz] = DIE_UP[vals[i]];
        const spinX = rx + Math.PI * 2 * (2 + i), spinZ = rz + Math.PI * 2 * 2;
        const spinY = ry + (Math.random() - 0.5) * 0.6;
        return tween(920, k => {
          const e = easeOut(k);
          d.position.lerpVectors(start, end, e);
          d.position.y = THREE.MathUtils.lerp(start.y, end.y, e) + Math.sin(Math.min(1, k * 1.25) * Math.PI) * 0.5 * (1 - k);
          d.rotation.set(THREE.MathUtils.lerp(spinX - Math.PI * 4, spinX, e), spinY, THREE.MathUtils.lerp(spinZ - Math.PI * 3, spinZ, e));
        }).then(() => tween(160, k => {
          d.position.y = end.y + Math.sin(k * Math.PI) * 0.09;
        }));
      });
      await Promise.all(proms);
    },

    setDice(vals) {
      if (!dice.length) return;
      if (!vals) { dice.forEach(d => d.visible = false); return; }
      const targets = [new THREE.Vector3(-0.55, TOP + 0.17, 0.45), new THREE.Vector3(0.55, TOP + 0.17, 0.62)];
      dice.forEach((d, i) => {
        d.visible = true;
        d.position.copy(targets[i]);
        d.rotation.set(...DIE_UP[vals[i]]);
      });
    },

    updateProps(state) {
      const key = JSON.stringify(state.props) + '|' + state.players.map(p => p.color + (p.bankrupt ? 'x' : '')).join(',');
      if (key === lastPropsKey) return;
      lastPropsKey = key;
      drawBoardTexture(state);
      // rebuild houses
      while (housesGroup.children.length) housesGroup.remove(housesGroup.children[0]);
      Object.keys(state.props).map(Number).forEach(i => {
        const ps = state.props[i], t = TILES[i];
        if (!ps || t.type !== 'prop' || !ps.houses) return;
        const R = tileRect(i);
        // inner edge direction (toward board center)
        const inner = { bottom: [0, -1], top: [0, 1], left: [1, 0], right: [-1, 0] }[R.side];
        const along = { bottom: [1, 0], top: [1, 0], left: [0, 1], right: [0, 1] }[R.side];
        const bx = R.x + inner[0] * (R.d / 2 - 0.14) * (R.side === 'left' || R.side === 'right' ? (R.w / R.d) : 1);
        const bz = R.z + inner[1] * (R.d / 2 - 0.14);
        // position on color bar area
        const px = R.x + inner[0] * ((R.side === 'left' || R.side === 'right' ? R.w : R.d) / 2 - 0.15);
        const pz = R.z + inner[1] * ((R.side === 'left' || R.side === 'right' ? R.w : R.d) / 2 - 0.15);
        if (ps.houses === 5) {
          const h = buildHouse(true);
          h.position.set(px, TOP, pz);
          housesGroup.add(h);
        } else {
          for (let n = 0; n < ps.houses; n++) {
            const h = buildHouse(false);
            const off = (n - (ps.houses - 1) / 2) * 0.2;
            h.position.set(px + along[0] * off, TOP, pz + along[1] * off);
            housesGroup.add(h);
          }
        }
      });
    },

    deckScreenRect(isChance) {
      const deck = isChance ? decks.chance : decks.chest;
      const p = deck.position.clone().setY(TOP + 0.15).project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      const sx = r.left + (p.x + 1) / 2 * r.width;
      const sy = r.top + (1 - p.y) / 2 * r.height;
      const w = Math.max(60, r.width * 0.09);
      return { left: sx - w / 2, top: sy - w * 0.31, width: w, height: w * 0.62 };
    },

    focusTile(i) {
      const w = tileWorld(i);
      const dir = new THREE.Vector2(w.x, w.z);
      if (dir.lengthSq() < 0.01) dir.set(0, 1); else dir.normalize();
      cam.mode = 'manual';
      cam.pos.set(w.x + dir.x * 3.6, TOP + 4.4, w.z + dir.y * 3.6);
      cam.look.set(w.x, TOP + 0.2, w.z);
    },

    resetCam() { goOverview(); },

    toggleFlat() {
      cam.flat = !cam.flat;
      goOverview();
    },
  };
})();
