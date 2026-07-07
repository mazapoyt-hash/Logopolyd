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
  let curTheme = BOARD_THEMES.classic;   // active board skin
  let lastState = null;                  // last state drawn (for theme re-render)
  let innerOn = false;                   // inner-ring ("metro") mode active this game
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
  function sideOf(i) {
    if (i >= INNER_BASE) return innerSideOf(i - INNER_BASE);
    return i <= 10 ? 'bottom' : i <= 20 ? 'left' : i <= 30 ? 'top' : 'right';
  }
  // start coordinate of grid line n (1..12) along one axis
  function lineAt(n) { return -HALF + (n <= 1 ? 0 : CORNER + (n - 2) * CELL); }
  function spanOf(n) { return (n === 1 || n === 11) ? CORNER : CELL; }

  // ---- inner ring ("metro" circle): a 7x7 grid, 24 perimeter tiles ----
  // Sits inside the outer ring (whose inner edge is at ±4.5), spanning ±IN_HALF,
  // leaving a small bare-field gap between the two rings. Center hollow keeps
  // the card decks + dice tray. j = 0..23 counterclockwise, metros at 0/6/12/18.
  const IN_N = 7, IN_HALF = 3.9, IN_CELL = (IN_HALF * 2) / IN_N;
  function innerGrid(j) {
    if (j <= 6) return { r: 6, c: 6 - j };   // bottom  (0..6)
    if (j <= 12) return { r: 12 - j, c: 0 };  // left    (6..12)
    if (j <= 18) return { r: 0, c: j - 12 };  // top     (12..18)
    return { r: j - 18, c: 6 };               // right   (18..24)
  }
  function innerSideOf(j) { const { r, c } = innerGrid(j); return r === 6 ? 'bottom' : r === 0 ? 'top' : c === 0 ? 'left' : 'right'; }
  function innerRect(j) {
    const { r, c } = innerGrid(j);
    return { x: -IN_HALF + (c + 0.5) * IN_CELL, z: -IN_HALF + (r + 0.5) * IN_CELL, w: IN_CELL, d: IN_CELL, side: innerSideOf(j) };
  }

  // world rect of tile i: {x,z} center, {w,d} size
  function tileRect(i) {
    if (i >= INNER_BASE) return innerRect(i - INNER_BASE);
    const { r, c } = gridPos(i);
    const x0 = lineAt(c), z0 = lineAt(r);
    const w = spanOf(c), d = spanOf(r);
    return { x: x0 + w / 2, z: z0 + d / 2, w, d, side: sideOf(i) };
  }
  function tileWorld(i) { const t = tileRect(i); return new THREE.Vector3(t.x, TOP, t.z); }

  // ---------- board texture (offscreen 2D canvas) ----------
  function shortName(t) {
    // Labels are localized per viewer via i18n (tileName); wrap() upper-cases.
    return tileName(t.name);
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
    if (state) lastState = state;
    const ctx = texCtx;
    // themed field color (deep enough to survive studio lighting)
    ctx.fillStyle = curTheme.field;
    ctx.fillRect(0, 0, TEX, TEX);
    // darkening vignette only (no white center, it washes out under light)
    const vg = ctx.createRadialGradient(TEX / 2, TEX / 2, TEX * 0.2, TEX / 2, TEX / 2, TEX * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, curTheme.vignette);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, TEX, TEX);

    // Standard mode draws only the 40 outer tiles; the inner ring appears
    // only when the "metro" modification is enabled for this game.
    const drawTiles = innerOn ? BOARD : TILES;
    drawTiles.forEach((t, i) => {
      const R = tileRect(i);
      const px = (R.x - R.w / 2 + HALF) * K, py = (R.z - R.d / 2 + HALF) * K;
      const pw = R.w * K, ph = R.d * K;
      // tile bg + border
      ctx.fillStyle = curTheme.paper;
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

      // OWNER highlight: tint the whole tile + thick colored frame (readable from overview)
      if (ps && ps.owner >= 0 && state.players[ps.owner]) {
        const oc = PLAYER_COLORS[state.players[ps.owner].color].solid;
        ctx.save();
        ctx.globalAlpha = 0.24;
        ctx.fillStyle = oc;
        ctx.fillRect(px, py, pw, ph);
        ctx.restore();
        ctx.strokeStyle = oc;
        ctx.lineWidth = 14;
        ctx.strokeRect(px + 9, py + 9, pw - 18, ph - 18);
      }

      // rotate ctx so text reads facing the board center (like a real board)
      ctx.save();
      ctx.translate(px + pw / 2, py + ph / 2);
      const rot = { bottom: 0, left: Math.PI / 2, top: Math.PI, right: -Math.PI / 2 }[R.side];
      ctx.rotate(rot);
      // local coords: width along reading direction, height toward center
      const lw = (R.side === 'left' || R.side === 'right') ? ph : pw;
      const lh = (R.side === 'left' || R.side === 'right') ? pw : ph;

      // inner-ring metro tile: draw a distinct subway badge and stop
      if (t.type === 'metro') {
        ctx.fillStyle = '#1c1c22';
        ctx.font = `800 ${Math.round(K * 0.4)}px Rubik, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Ⓜ', 0, -lh * 0.06);
        ctx.fillStyle = '#3a382f';
        ctx.font = `800 ${Math.round(K * 0.13)}px Rubik, sans-serif`;
        ctx.fillText('METRO', 0, lh * 0.30);
        ctx.restore();
        return;
      }

      const isCorner = i < INNER_BASE && i % 10 === 0;
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
      // icon for special tiles
      const icons = { chest: '▣', chance: '?', tax: '◆', rail: '▬', util: '◉', bonus: '＋' };
      if (icons[t.type]) {
        ctx.fillStyle = t.type === 'chance' ? '#c0511d' : t.type === 'chest' ? '#1d4e96'
          : t.type === 'bonus' ? '#1f9d55' : t.type === 'tax' ? '#b02020' : '#3a382f';
        ctx.font = `800 ${Math.round(K * 0.34)}px Rubik, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(icons[t.type], 0, -lh * 0.10);
      }

      // name — auto-fit the font so even long English names stay legible
      ctx.fillStyle = '#161510';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let nameFont = Math.round(K * 0.20);
      let lines;
      const maxW = lw - 12, floor = Math.round(K * 0.105);
      // shrink font until the text fits in <=2 lines AND every line fits the
      // tile width. This also handles long single words (e.g. "Португалия")
      // that cannot wrap — they simply scale down instead of overflowing.
      for (;;) {
        ctx.font = `800 ${nameFont}px Rubik, sans-serif`;
        lines = wrap(ctx, shortName(t), maxW);
        const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
        if ((lines.length <= 2 && widest <= maxW) || nameFont <= floor) break;
        nameFont -= 2;
      }
      const lineH = nameFont * 1.06;
      const nameY = t.type === 'prop' ? -lh * 0.02 : lh * 0.12;
      lines.forEach((ln, li) => ctx.fillText(ln, 0, nameY + (li - (lines.length - 1) / 2) * lineH));
      // price
      if (t.price) {
        ctx.fillStyle = '#2c2a20';
        ctx.font = `800 ${Math.round(K * 0.155)}px Rubik, sans-serif`;
        ctx.fillText(CUR + t.price, 0, lh / 2 - lh * 0.14);
      }
      ctx.restore();
    });

    // red diagonal MONOPOLY plaque in the center
    ctx.save();
    ctx.translate(TEX / 2, TEX / 2);
    ctx.rotate(-Math.PI / 4.3);
    // shrink the center plaque only when the inner ring occupies the middle
    const pw2 = TEX * (innerOn ? 0.26 : 0.42), ph2 = TEX * (innerOn ? 0.058 : 0.085);
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
  function pipTexture(n, speed) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = speed ? '#e8ca4e' : '#faf7ef'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 6; x.strokeRect(3, 3, 122, 122);
    const P = { 1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[32, 32], [64, 64], [96, 96]],
      4: [[36, 36], [92, 36], [36, 92], [92, 92]], 5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]],
      6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]] };
    x.fillStyle = speed ? '#3a2c05' : '#1c1a16';
    P[n].forEach(([px, py]) => { x.beginPath(); x.arc(px, py, 11, 0, 7); x.fill(); });
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  // materials order [+x,-x,+y,-y,+z,-z] -> values [2,5,1,6,3,4]
  const DIE_UP = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [0, 0, Math.PI / 2], 5: [0, 0, -Math.PI / 2], 3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0] };
  // resting spots for 2 or 3 dice, centered on the board
  function diceTargets(n) {
    if (n >= 3) return [new THREE.Vector3(-1.35, 0, 0.4), new THREE.Vector3(0, 0, 0.55), new THREE.Vector3(1.35, 0, 0.7)];
    return [new THREE.Vector3(-1.0, 0, 0.45), new THREE.Vector3(1.0, 0, 0.65)];
  }
  const DIE_SIZE = 0.95;                 // bigger dice — far easier to read
  const DIE_REST_Y = TOP + DIE_SIZE / 2; // resting height so they sit on the board
  function buildDie(speed) {
    const mats = [2, 5, 1, 6, 3, 4].map(v => new THREE.MeshStandardMaterial({ map: pipTexture(v, speed), roughness: 0.35, metalness: speed ? 0.2 : 0.05 }));
    const m = new THREE.Mesh(new THREE.BoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE), mats);
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

  // ---------- jail cage (bars around a jailed token) ----------
  function buildCage() {
    const g = new THREE.Group();
    // own material instance per cage so we can fade just this one when it breaks
    const mat = new THREE.MeshStandardMaterial({ color: '#aab0ba', metalness: 0.9, roughness: 0.3, transparent: true, opacity: 1 });
    g._mat = mat;
    const R = 0.24, H = 0.66;
    const vGeo = new THREE.CylinderGeometry(0.014, 0.014, H, 8);
    // 8 vertical bars: 4 corners + 4 edge midpoints
    [[R, R], [R, -R], [-R, R], [-R, -R], [R, 0], [-R, 0], [0, R], [0, -R]].forEach(([x, z]) => {
      const b = new THREE.Mesh(vGeo, mat);
      b.position.set(x, H / 2, z); b.castShadow = true; g.add(b);
    });
    // top frame (4 horizontal bars)
    const hGeo = new THREE.CylinderGeometry(0.014, 0.014, 2 * R, 8);
    [[[0, H, R], [0, 0, Math.PI / 2]], [[0, H, -R], [0, 0, Math.PI / 2]],
     [[R, H, 0], [Math.PI / 2, 0, 0]], [[-R, H, 0], [Math.PI / 2, 0, 0]]].forEach(([pos, rot]) => {
      const b = new THREE.Mesh(hGeo, mat);
      b.position.set(...pos); b.rotation.set(...rot); g.add(b);
    });
    return g;
  }

  // Attach a cage when a token is jailed, and "break" it (bars fly up + fade)
  // when the token is freed. Guarded by tok.cage so repeated state syncs no-op.
  function setTokenJail(pi, on, instant = false) {
    const tok = tokens[pi];
    if (!tok) return;
    if (on && !tok.cage) {
      const cage = buildCage();
      tok.group.add(cage);
      tok.cage = cage;
      if (instant) { cage.scale.y = 1; return; }   // reconnect/first render: snap
      cage.scale.y = 0.01;
      tween(320, k => { cage.scale.y = easeOut(k); });
    } else if (!on && tok.cage) {
      const cage = tok.cage; tok.cage = null;
      if (instant) { tok.group.remove(cage); cage._mat.dispose(); return; }
      tween(460, k => {
        const e = easeOut(k);
        cage.position.y = e * 0.8;
        cage.rotation.y = e * 1.1;
        cage.scale.setScalar(1 + e * 0.35);
        cage._mat.opacity = 1 - k;
      }).then(() => { tok.group.remove(cage); cage._mat.dispose(); });
    }
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
    // smaller cards in inner-ring mode so they fit the tighter center hollow
    const w = innerOn ? 1.35 : 2.1, d = innerOn ? 0.86 : 1.32, n = 5;
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

  // (Re)build both card decks, sizing/placing them for the current layout.
  function rebuildDecks() {
    if (!scene) return;
    ['chance', 'chest'].forEach(k => { if (decks[k]) { scene.remove(decks[k]); decks[k] = null; } });
    const dP = innerOn ? 1.15 : 1.85;
    decks.chance = buildDeck('ШАНС', '#f09545', '#c0511d');
    decks.chance.position.set(-dP, TOP, -dP);
    decks.chance.rotation.y = -Math.PI / 4.3;
    scene.add(decks.chance);
    decks.chest = buildDeck('КАЗНА', '#4a90dd', '#1d4e96');
    decks.chest.position.set(dP, TOP, dP);
    decks.chest.rotation.y = -Math.PI / 4.3;
    scene.add(decks.chest);
  }

  // ---------- procedural wood-plank texture (no ugly tiling) ----------
  function makeWoodTexture() {
    const S = 1024, c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    // base warm walnut
    x.fillStyle = '#5c3d24';
    x.fillRect(0, 0, S, S);
    const planks = 6, pw = S / planks;
    const tones = ['#6b4a2c', '#5a3c22', '#734f30', '#4f351f', '#65462a', '#5e3f26'];
    for (let p = 0; p < planks; p++) {
      const px = p * pw;
      // plank base tone
      x.fillStyle = tones[p % tones.length];
      x.fillRect(px, 0, pw, S);
      // long grain streaks
      for (let g = 0; g < 90; g++) {
        const gx = px + Math.random() * pw;
        x.strokeStyle = `rgba(${30 + Math.random() * 30},${18 + Math.random() * 20},8,${0.05 + Math.random() * 0.12})`;
        x.lineWidth = 0.5 + Math.random() * 1.6;
        x.beginPath();
        let yy = 0, cx = gx;
        x.moveTo(cx, yy);
        while (yy < S) {
          yy += 18 + Math.random() * 26;
          cx += (Math.random() - 0.5) * 5;
          x.lineTo(cx, yy);
        }
        x.stroke();
      }
      // occasional knot
      if (Math.random() < 0.5) {
        const kx = px + pw * (0.3 + Math.random() * 0.4), ky = Math.random() * S;
        const rg = x.createRadialGradient(kx, ky, 1, kx, ky, 12 + Math.random() * 10);
        rg.addColorStop(0, 'rgba(40,24,10,0.7)');
        rg.addColorStop(1, 'rgba(40,24,10,0)');
        x.fillStyle = rg;
        x.beginPath(); x.arc(kx, ky, 22, 0, Math.PI * 2); x.fill();
      }
      // dark seam between planks
      x.fillStyle = 'rgba(20,12,5,0.55)';
      x.fillRect(px, 0, 2, S);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  // ---------- table decoration (cards, money, cup, spare tokens) ----------
  function buildCardStack(colors, n = 16) {
    const g = new THREE.Group();
    const w = 1.5, d = 1.0;
    for (let i = 0; i < n; i++) {
      const c = colors[i % colors.length];
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.02, d),
        new THREE.MeshStandardMaterial({ color: i === n - 1 ? '#f7f2e2' : c, roughness: 0.7 })
      );
      m.position.set((Math.random() - 0.5) * 0.06, 0.01 + i * 0.02, (Math.random() - 0.5) * 0.05);
      m.rotation.y = (Math.random() - 0.5) * 0.06;
      m.castShadow = true;
      g.add(m);
    }
    return g;
  }
  function buildMoneyStack(color, n = 12) {
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.012, 0.85),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
      );
      m.position.set((Math.random() - 0.5) * 0.1, 0.006 + i * 0.012, (Math.random() - 0.5) * 0.08);
      m.rotation.y = (Math.random() - 0.5) * 0.12;
      m.castShadow = true;
      g.add(m);
    }
    return g;
  }
  function buildCup() {
    const g = new THREE.Group();
    const cream = new THREE.MeshStandardMaterial({ color: '#f3ede0', roughness: 0.35 });
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.06, 32), cream);
    saucer.position.y = 0.03; saucer.castShadow = saucer.receiveShadow = true;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.5, 32), cream);
    body.position.y = 0.31; body.castShadow = true;
    const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.02, 32),
      new THREE.MeshStandardMaterial({ color: '#4a2c17', roughness: 0.4 }));
    coffee.position.y = 0.55;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 12, 24), cream);
    handle.position.set(0.46, 0.32, 0); handle.rotation.y = Math.PI / 2; handle.castShadow = true;
    g.add(saucer, body, coffee, handle);
    return g;
  }

  function buildTableDecor() {
    const decor = new THREE.Group();
    // stacks of title-deed cards (grouped by property colors)
    const groupCols = Object.values(GROUP_COLORS);
    const cards1 = buildCardStack([groupCols[1], groupCols[2], groupCols[3]]);
    cards1.position.set(-10.4, 0, 8.0); cards1.rotation.y = 0.5;
    const cards2 = buildCardStack([groupCols[4], groupCols[5], groupCols[6]]);
    cards2.position.set(-8.6, 0, 9.6); cards2.rotation.y = -0.3;
    decor.add(cards1, cards2);
    // money bundles
    const m1 = buildMoneyStack('#e7c85a'); m1.position.set(10.2, 0, -8.2); m1.rotation.y = -0.5;
    const m2 = buildMoneyStack('#8fc98a', 9); m2.position.set(8.6, 0, -9.6); m2.rotation.y = 0.2;
    const m3 = buildMoneyStack('#e9a6bb', 7); m3.position.set(10.6, 0, -9.8); m3.rotation.y = 0.7;
    decor.add(m1, m2, m3);
    // coffee cup
    const cup = buildCup(); cup.position.set(-10.6, 0, -8.8); decor.add(cup);
    // spare tokens standing on the table
    const sparePos = [[10.4, 8.2], [8.8, 9.6], [11.0, 9.9]];
    [1, 3, 5].forEach((ci, k) => {
      const tk = buildToken(PLAYER_COLORS[ci % PLAYER_COLORS.length].solid);
      tk.position.set(sparePos[k][0], 0, sparePos[k][1]);
      tk.rotation.y = Math.random() * Math.PI;
      decor.add(tk);
    });
    scene.add(decor);
  }

  // ---------- camera ----------
  function overviewFor(flat) {
    // guard: container may be 0x0 while the game screen is hidden
    let aspect = container.clientWidth / Math.max(1, container.clientHeight);
    if (!isFinite(aspect) || aspect <= 0.05) aspect = 1.7;
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hf = Math.atan(Math.tan(vf) * aspect);
    // smaller half-extent => board fills more of the screen, names readable
    const dist = 6.7 / Math.tan(Math.min(vf, hf));
    if (flat) return { pos: new THREE.Vector3(0, dist * 1.05, 0.01), look: new THREE.Vector3(0, 0, 0) };
    const dir = new THREE.Vector3(0, 0.94, 0.72).normalize();
    return { pos: dir.multiplyScalar(dist), look: new THREE.Vector3(0, 0, -0.4) };
  }
  function goOverview() {
    cam.mode = 'overview';
    const o = overviewFor(cam.flat);
    cam.pos.copy(o.pos); cam.look.copy(o.look);
  }
  // Close follow framing for a token at world position `tp`.
  // The camera keeps a CONSTANT orientation (elevated, offset toward +Z — the
  // same "north-up" view as the overview) and simply pans to keep the token
  // centered. Previously it orbited to the token's OUTWARD side (looking toward
  // center), so opposite edges of the board faced opposite ways and the board
  // effectively flipped 180° between turns — a consistent forward walk then
  // looked like it alternated clockwise / counter-clockwise. A fixed offset
  // makes every walk read the same on-screen direction.
  function followTarget(tp) {
    return {
      pos: new THREE.Vector3(tp.x, TOP + 4.4, tp.z + 3.6),
      look: new THREE.Vector3(tp.x, TOP + 0.2, tp.z),
    };
  }

  // ---------- tweens ----------
  function tween(dur, fn) {
    return new Promise(res => anims.push({ t0: performance.now(), dur, fn, res }));
  }
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  // smootherstep: zero velocity AND acceleration at both ends → very gentle glide
  const smoother = k => k * k * k * (k * (k * 6 - 15) + 10);

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
  // camera follow: glide in close and orbit around the board with the token,
  // always looking at it — the cinematic follow the game had originally.
  if (cam.mode === 'follow' && tokens[cam.followPi]) {
    const t = followTarget(tokens[cam.followPi].group.position);
    cam.pos.copy(t.pos); cam.look.copy(t.look);
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
      renderer.toneMappingExposure = 0.92;
      renderer.outputEncoding = THREE.sRGBEncoding;
      container.appendChild(renderer.domElement);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

      // lights: warm key + cool fill, soft shadows
      scene.add(new THREE.HemisphereLight(0xfff2dd, 0x2a2119, 0.55));
      const key = new THREE.DirectionalLight(0xffd9a8, 1.15);
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

      // table: procedural walnut planks (grain runs along one axis, no tiling seam)
      const woodTex = makeWoodTexture();
      woodTex.repeat.set(3, 3);
      const table = new THREE.Mesh(
        new THREE.PlaneGeometry(80, 80),
        new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62, metalness: 0.05 })
      );
      table.rotation.x = -Math.PI / 2;
      table.position.y = -0.03;
      table.receiveShadow = true;
      scene.add(table);

      // play-mat: dark green felt with a subtle raised leather border ring
      const mat = new THREE.Mesh(
        new THREE.CircleGeometry(SIZE * 0.9, 72),
        new THREE.MeshStandardMaterial({ color: '#0f3327', roughness: 0.98, metalness: 0 })
      );
      mat.rotation.x = -Math.PI / 2;
      mat.position.y = -0.012;
      mat.receiveShadow = true;
      scene.add(mat);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(SIZE * 0.87, SIZE * 0.9, 72),
        new THREE.MeshStandardMaterial({ color: '#7a5a2e', roughness: 0.5, metalness: 0.2 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.008;
      scene.add(ring);

      buildTableDecor();

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

      // decks aligned with the diagonal plaque (positions/size adapt to mode)
      rebuildDecks();

      // dice
      dice = [buildDie(false), buildDie(false), buildDie(true)];
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
        const nTiles = innerOn ? BOARD.length : 40;
        for (let i = 0; i < nTiles; i++) {
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
      if (!w || !h) return; // hidden: keep previous valid state
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (cam.mode === 'overview') goOverview();
      // recover if camera ever got into an invalid state
      if (!isFinite(camera.position.x) || !isFinite(camera.position.y)) {
        camera.position.copy(cam.pos);
        curLook.copy(cam.look);
      }
    },

    syncPlayers(players, myIdx) {
      players.forEach((p, pi) => {
        if (!tokens[pi]) {
          const g = buildToken(PLAYER_COLORS[p.color].solid);
          scene.add(g);
          tokens[pi] = { group: g, colorIdx: p.color };
        }
        tokens[pi].group.visible = !p.bankrupt;
        // Jail cage on/off is driven by the FX queue (see ui.js) so the bars
        // appear only once the token has actually walked/jumped into jail —
        // not the instant the dice roll updates state. Here we only clear a
        // stale cage if a jailed player was just eliminated.
        if (p.bankrupt && tokens[pi].cage) setTokenJail(pi, false, true);
      });
    },

    // Show/break the jail cage. `instant` snaps without animation (first render
    // / reconnect). Normally called from the FX queue after the move animation.
    setJail(pi, on, instant = false) { setTokenJail(pi, on, instant); },

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

    async moveToken(pi, from, to, { jump = false, onHop = null, back = false } = {}) {
      const tok = tokens[pi];
      if (!tok) return;
      // Always start the walk from the EXACT `from` tile. Guards against any
      // race where a heartbeat broadcast snapped the token to `to` already,
      // which used to make the hops play in-place and look like a teleport.
      tok.group.position.copy(tileWorld(from));
      cam.followPi = pi;
      // ring-aware stepping: outer ring = 40 tiles (base 0), inner = 24 (base 40)
      const base = from >= INNER_BASE ? INNER_BASE : 0;
      const len = from >= INNER_BASE ? INNER_COUNT : 40;
      const sameRing = (to >= INNER_BASE ? INNER_BASE : 0) === base;
      // Walk in the REAL direction of play (from the game logic), not a guessed
      // shortest path. Forward for dice rolls, backward only for "back N" cards.
      const dir = back ? -1 : 1;
      let steps = sameRing ? (dir === 1 ? (to - from + len) % len : (from - to + len) % len) : 0;
      // A "jump" (jail teleport or metro warp) flies through the air; every dice
      // roll walks tile-by-tile within its ring.
      const isTeleport = jump || !sameRing || steps === 0;

      if (isTeleport) {
        // Teleports read best from a WIDE view: pull the camera out to the
        // overview and watch the token fly across the board. Doing the walk's
        // close intro-zoom here caused a jarring double-dive when landing on
        // "Go To Jail" (walk to the tile, then teleport straight after).
        {
          const o = overviewFor(cam.flat);
          const startP = camera.position.clone(), startL = curLook.clone();
          cam.mode = 'intro';
          await tween(520, k => {
            const e = easeInOut(k);
            camera.position.lerpVectors(startP, o.pos, e);
            curLook.lerpVectors(startL, o.look, e);
            cam.pos.copy(camera.position); cam.look.copy(curLook);
          });
        }
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
        // Walk: smoothly fly the camera in and frame the token BEFORE it starts
        // walking, so the move doesn't look jerky. During 'intro' the loop's
        // follow recompute is skipped and cam.pos tracks the camera (no lerp
        // fight). Because the follow target keeps the same "north-up"
        // orientation as the overview, a gentle straight glide (smootherstep)
        // frames the token without cutting through the board or flipping the view.
        {
          const tgt = followTarget(tok.group.position);
          const startP = camera.position.clone(), startL = curLook.clone();
          const lift = 1.2;   // slight rise mid-glide so it arcs down onto the tile
          cam.mode = 'intro';
          await tween(950, k => {
            const e = smoother(k);
            camera.position.lerpVectors(startP, tgt.pos, e);
            camera.position.y += Math.sin(e * Math.PI) * lift;
            curLook.lerpVectors(startL, tgt.look, e);
            cam.pos.copy(camera.position); cam.look.copy(curLook);
          });
          cam.mode = 'follow';
          // brief beat so the framed shot reads before the token starts walking
          await tween(320, () => {});
        }
        for (let s = 1; s <= steps; s++) {
          const t = base + (((from - base) + dir * s) % len + len) % len;
          const a = tok.group.position.clone(), b = tileWorld(t);
          if (onHop) onHop('hop');
          // slower, eased hop so the eye can follow each step
          await tween(360, k => {
            const e = easeInOut(k);
            tok.group.position.lerpVectors(a, b, e);
            tok.group.position.y = TOP + Math.sin(k * Math.PI) * 0.4;
          });
          await new Promise(r => setTimeout(r, 70)); // tiny settle between steps
        }
      }
      await new Promise(r => setTimeout(r, 620));
      goOverview();
    },

    async rollDice(vals) {
      // 2 or 3 dice; the 3rd (gold) is the speed die when fast mode is on
      const targets = diceTargets(vals.length);
      dice.forEach((d, i) => { if (i >= vals.length) d.visible = false; });
      const proms = vals.map((v, i) => {
        const d = dice[i];
        d.visible = true;
        const start = new THREE.Vector3((i - (vals.length - 1) / 2) * 2.1, TOP + 3.0, 2.8);
        const end = targets[i].clone().setY(DIE_REST_Y);
        const [rx, ry, rz] = DIE_UP[v];
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
      const targets = diceTargets(vals.length);
      dice.forEach((d, i) => {
        if (i >= vals.length) { d.visible = false; return; }
        d.visible = true;
        d.position.copy(targets[i].clone().setY(DIE_REST_Y));
        d.rotation.set(...DIE_UP[vals[i]]);
      });
    },

    updateProps(state) {
      // apply the room's chosen board skin
      const themeName = (state.settings && state.settings.theme) || 'classic';
      curTheme = BOARD_THEMES[themeName] || BOARD_THEMES.classic;
      // toggle the inner ring to match this game's settings (rebuild decks so
      // their size/position fit the chosen layout)
      const wantInner = !!(state.settings && state.settings.innerCircle);
      if (wantInner !== innerOn) { innerOn = wantInner; rebuildDecks(); lastPropsKey = ''; }
      const key = themeName + '|' + innerOn + '|' + JSON.stringify(state.props) + '|' + state.players.map(p => p.color + (p.bankrupt ? 'x' : '')).join(',');
      if (key === lastPropsKey) return;
      lastPropsKey = key;
      drawBoardTexture(state);
      // rebuild houses
      while (housesGroup.children.length) housesGroup.remove(housesGroup.children[0]);
      Object.keys(state.props).map(Number).forEach(i => {
        const ps = state.props[i], t = BOARD[i];
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

    // live preview of a board skin from the lobby settings screen
    previewTheme(name) {
      curTheme = BOARD_THEMES[name] || BOARD_THEMES.classic;
      lastPropsKey = ''; // force a redraw on next updateProps
      if (texCtx) drawBoardTexture(lastState);
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
