// ===== UI rendering & interaction =====
const $ = sel => document.querySelector(sel);
const TOKENS = ['🎩', '🚗', '🐕', '⛵', '👢', '🐈'];
const TOKEN_IMGS = ['tok_hat', 'tok_car', 'tok_dog', 'tok_ship', 'tok_boot', 'tok_cat'];
let unreadChat = 0;
const cardFx = { key: '', visible: false };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- Sounds (tiny WebAudio synth, no files) ----------
const snd = (() => {
  let ctx, muted = localStorage.getItem('mono-mute') === '1';
  const ac = () => ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());
  function tone(freq, type, dur, vol = 0.12, when = 0) {
    if (muted) return;
    try {
      const c = ac(); if (c.state === 'suspended') c.resume();
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq; o.connect(g); g.connect(c.destination);
      const t = c.currentTime + when;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* audio unavailable */ }
  }
  return {
    hop: () => tone(330 + Math.random() * 90, 'triangle', 0.09, 0.07),
    dice: () => { for (let i = 0; i < 7; i++) tone(150 + Math.random() * 260, 'square', 0.05, 0.04, i * 0.09); },
    cash: () => { tone(880, 'sine', 0.12, 0.1); tone(1318, 'sine', 0.2, 0.09, 0.09); },
    card: () => tone(520, 'sine', 0.28, 0.08),
    win: () => [523, 659, 784, 1047, 1318].forEach((f, i) => tone(f, 'triangle', 0.4, 0.13, i * 0.16)),
    toggle() { muted = !muted; localStorage.setItem('mono-mute', muted ? '1' : '0'); return muted; },
    muted: () => muted,
  };
})();

// ---------- FX engine: token movement, 3D dice, cinematic camera ----------
const fxq = { chain: Promise.resolve(), disp: null, diceSeq: 0, money: null };
let fxBusy = 0;
function queueFx(fn) {
  fxBusy++;
  fxq.chain = fxq.chain.then(fn).catch(() => {}).then(() => {
    fxBusy--;
    // animations done: show the modals/buttons we held back
    if (fxBusy === 0 && NET.state) { renderCenter(); renderModals(); }
  });
}

function tileXY(i) {
  const board = $('#board'), tile = board.querySelector(`.tile[data-idx="${i}"]`);
  return { x: tile.offsetLeft + tile.offsetWidth / 2, y: tile.offsetTop + tile.offsetHeight * 0.62 };
}

function ensureTokens(s) {
  const layer = $('#token-layer');
  s.players.forEach((p, pi) => {
    let el = document.getElementById('ptok-' + pi);
    if (!el) {
      el = document.createElement('div');
      el.className = 'ptok' + (p.peerId === NET.myPeerId ? ' mytok' : '');
      el.id = 'ptok-' + pi;
      el.innerHTML = `<div class="ptok-tilt"><img src="assets/${TOKEN_IMGS[p.color]}.png" alt=""></div>`;
      layer.appendChild(el);
    }
    el.style.display = p.bankrupt ? 'none' : '';
  });
}

function setTokenPos(pi, tileIdx, group) {
  const el = document.getElementById('ptok-' + pi);
  if (!el) return;
  const { x, y } = tileXY(tileIdx);
  const n = group ? group.length : 1, k = group ? group.indexOf(pi) : 0;
  const w = $('#board').offsetWidth * 0.022;
  el.style.left = (x + (k - (n - 1) / 2) * w * 1.6) + 'px';
  el.style.top = (y + (k % 2) * w * 0.5) + 'px';
}

function placeAllTokens(s) {
  if (!fxq.disp) return;
  const groups = {};
  s.players.forEach((p, pi) => { if (!p.bankrupt) (groups[fxq.disp[pi]] = groups[fxq.disp[pi]] || []).push(pi); });
  s.players.forEach((p, pi) => { if (!p.bankrupt) setTokenPos(pi, fxq.disp[pi], groups[fxq.disp[pi]]); });
}

function retrigger(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function camFocus(tileIdx, zoom) {
  const bt = document.querySelector('.board-tilt'), b = $('#board');
  const { x, y } = tileXY(tileIdx);
  bt.style.setProperty('--zoom', zoom);
  bt.style.setProperty('--panx', ((b.offsetWidth / 2 - x) * 0.42) + 'px');
  bt.style.setProperty('--pany', ((b.offsetHeight / 2 - y) * 0.42) + 'px');
}
function camReset() {
  const bt = document.querySelector('.board-tilt');
  bt.style.removeProperty('--zoom'); bt.style.setProperty('--panx', '0px'); bt.style.setProperty('--pany', '0px');
}

async function walkToken(s, pi, from, to) {
  const el = document.getElementById('ptok-' + pi);
  if (!el) { fxq.disp[pi] = to; return; }
  let steps = (to - from + 40) % 40, dir = 1;
  if (steps >= 37) { dir = -1; steps = 40 - steps; }
  camFocus(to, 1.3);
  if (steps === 0 || steps > 12) {
    // teleport (jail, card): one big arc jump
    retrigger(el, 'fly');
    setTokenPos(pi, to);
    snd.card();
    await sleep(680);
    el.classList.remove('fly');
  } else {
    for (let k = 1; k <= steps; k++) {
      const t = (from + dir * k + 40) % 40;
      retrigger(el, 'hop');
      setTokenPos(pi, t);
      snd.hop();
      await sleep(215);
    }
    el.classList.remove('hop');
  }
  fxq.disp[pi] = to;
  placeAllTokens(s);
  await sleep(500);
  camReset();
}

// --- 3D dice ---
const DIE_ORI = { 1: [0, 0], 2: [90, 0], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [0, 180] };
function buildDie() {
  const d = document.createElement('div');
  d.className = 'die3d';
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  for (let f = 1; f <= 6; f++) {
    const face = document.createElement('div');
    face.className = 'dface f' + f;
    for (let c = 0; c < 9; c++) face.innerHTML += `<div class="pip${PIPS[f].includes(c) ? '' : ' off'}"></div>`;
    d.appendChild(face);
  }
  return d;
}
function ensureDice() {
  const row = $('#dice');
  if (!row.querySelector('.die3d')) { row.appendChild(buildDie()); row.appendChild(buildDie()); }
  return row.querySelectorAll('.die3d');
}
function setDice(vals, animate) {
  const dice = ensureDice();
  $('#dice').style.visibility = vals ? 'visible' : 'hidden';
  if (!vals) return;
  dice.forEach((d, i) => {
    const [ax, ay] = DIE_ORI[vals[i]];
    if (animate) {
      d.style.transition = 'none';
      d.style.transform = `rotateX(${ax - 720 - Math.floor(Math.random() * 2) * 360}deg) rotateY(${ay - 1080}deg) scale(.4)`;
      void d.offsetWidth;
      d.style.transition = '';
      d.style.transform = `rotateX(${ax}deg) rotateY(${ay}deg) scale(1)`;
    } else {
      d.style.transform = `rotateX(${ax}deg) rotateY(${ay}deg)`;
    }
  });
}

function renderFx(s) {
  ensureTokens(s);
  if (!fxq.disp) {
    // first state: snap everything into place
    fxq.disp = s.players.map(p => p.pos);
    fxq.money = s.players.map(p => p.money);
    fxq.diceSeq = s.diceSeq || 0;
    placeAllTokens(s);
    setDice(s.dice, false);
    return;
  }
  // money change chime
  if (fxq.money && s.players.some((p, i) => fxq.money[i] !== undefined && p.money !== fxq.money[i])) snd.cash();
  fxq.money = s.players.map(p => p.money);
  // dice tumble on new roll
  if ((s.diceSeq || 0) !== fxq.diceSeq) {
    fxq.diceSeq = s.diceSeq || 0;
    queueFx(async () => { snd.dice(); setDice(s.dice, true); await sleep(1050); });
  } else if (!s.dice) {
    queueFx(async () => setDice(null, false));
  }
  // token movement
  let moved = false;
  s.players.forEach((p, pi) => {
    const from = fxq.disp[pi];
    if (!p.bankrupt && p.pos !== from) { moved = true; queueFx(() => walkToken(s, pi, from, p.pos)); }
  });
  if (!moved && fxBusy === 0) placeAllTokens(s);
}

// --- confetti ---
let confettiFired = false;
function confettiBurst() {
  if (confettiFired) return;
  confettiFired = true;
  const c = $('#confetti'), colors = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e67e22'];
  for (let i = 0; i < 110; i++) {
    const d = document.createElement('div');
    d.className = 'conf';
    d.style.left = Math.random() * 100 + 'vw';
    d.style.background = colors[i % colors.length];
    d.style.animationDuration = (2.4 + Math.random() * 2.2) + 's';
    d.style.animationDelay = (Math.random() * 1.4) + 's';
    c.appendChild(d);
  }
  snd.win();
  setTimeout(() => { c.innerHTML = ''; }, 7000);
}

// ---------- Card draw animation ----------
function showCardFx(s) {
  const isChance = s.pendingCard.deck === 'ШАНС';
  const cls = isChance ? 'chance' : 'chest';
  const deckEl = $(isChance ? '#deck-chance' : '#deck-chest');
  const fx = $('#card-fx'), card = $('#fx-card'), inner = $('#fx-inner');
  const back = $('#fx-back'), front = $('#fx-front');
  back.className = 'fx-face fx-back ' + cls;
  back.innerHTML = `<div class="fx-big">${isChance ? '❓' : '📦'}</div><div>${s.pendingCard.deck}</div>`;
  front.innerHTML = `<div class="fx-front-head ${cls}">${isChance ? '❓' : '📦'} ${s.pendingCard.deck}</div>
    <div class="fx-front-body">${esc(s.pendingCard.text)}</div>
    <div class="fx-front-foot"><div class="fx-who">Карта для: ${esc(s.pendingCard.player)}</div><span id="fx-ok"></span></div>`;
  updateCardFxButton(s);
  snd.card();
  // start small at the deck's on-screen position, card back up
  const r = deckEl.getBoundingClientRect();
  fx.classList.remove('animating', 'leaving', 'dim');
  fx.style.display = 'block';
  card.style.left = r.left + 'px'; card.style.top = r.top + 'px';
  card.style.width = Math.max(r.width, 44) + 'px'; card.style.height = Math.max(r.height, 28) + 'px';
  inner.style.transform = 'rotateY(0deg)';
  cardFx.visible = true;
  // fly to screen center while flipping over
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fx.classList.add('animating', 'dim');
    const W = Math.min(window.innerWidth * 0.88, 430), H = Math.round(W * 0.62);
    card.style.left = Math.round((window.innerWidth - W) / 2) + 'px';
    card.style.top = Math.round((window.innerHeight - H) / 2) + 'px';
    card.style.width = W + 'px'; card.style.height = H + 'px';
    inner.style.transform = 'rotateY(180deg)';
  }));
}

function updateCardFxButton(s) {
  const ok = $('#fx-ok');
  if (!ok || !s.pendingCard) return;
  const mine = myPlayerIndex() === s.turn;
  ok.innerHTML = mine
    ? `<button class="btn gold" onclick="sendAction({type:'dismissCard'})">OK</button>`
    : '';
}

function hideCardFx() {
  const fx = $('#card-fx');
  cardFx.visible = false; cardFx.key = '';
  fx.classList.add('leaving'); fx.classList.remove('dim');
  setTimeout(() => {
    if (!cardFx.visible) { fx.style.display = 'none'; fx.classList.remove('leaving', 'animating'); }
  }, 470);
}

// ---------- Board construction ----------
function gridPos(i) {
  if (i <= 10) return { r: 11, c: 11 - i };
  if (i <= 20) return { r: 11 - (i - 10), c: 1 };
  if (i <= 30) return { r: 1, c: i - 19 };
  return { r: i - 29, c: 11 };
}

function buildBoard() {
  const board = $('#board');
  TILES.forEach((t, i) => {
    const d = document.createElement('div');
    const { r, c } = gridPos(i);
    d.className = 'tile ' + (i % 10 === 0 ? 'corner ' : '') + 'side-' + sideOf(i);
    d.style.gridRow = r; d.style.gridColumn = c;
    d.dataset.idx = i;
    let inner = '';
    if (t.type === 'prop') inner += `<div class="tile-bar" style="background:${GROUP_COLORS[t.group]}"></div>`;
    inner += `<div class="tile-name">${tileEmoji(t)}${shortName(t)}</div>`;
    if (t.price) inner += `<div class="tile-price">${CUR}${t.price}</div>`;
    inner += `<div class="tile-houses"></div><div class="tile-tokens"></div><div class="tile-owner"></div>`;
    d.innerHTML = inner;
    d.addEventListener('click', () => showTileInfo(i));
    board.appendChild(d);
  });
}

function sideOf(i) {
  if (i <= 10) return 'bottom';
  if (i <= 20) return 'left';
  if (i <= 30) return 'top';
  return 'right';
}

function tileEmoji(t) {
  const m = { go: '🏁 ', chest: '📦 ', chance: '❓ ', tax: '💰 ', rail: '🚂 ', util: '⚡ ', jail: '🚔 ', free: '🅿️ ', gotojail: '👮 ' };
  if (t.type === 'util' && t.name.includes('Water')) return '🚰 ';
  return m[t.type] || '';
}

function shortName(t) {
  return t.name.replace(' Avenue', ' Ave').replace(' Railroad', ' RR').replace('Community Chest', 'Казна').replace('Chance', 'Шанс')
    .replace('Income Tax', 'Налог').replace('Luxury Tax', 'Налог на роскошь').replace('Jail / Visiting', 'Тюрьма')
    .replace('Free Parking', 'Парковка').replace('Go To Jail', 'В тюрьму');
}

// ---------- Rendering ----------
function render() {
  if (!NET.state) { renderLobby(); return; }
  $('#lobby').style.display = 'none';
  $('#game').style.display = 'flex';
  renderPlaques();
  renderTiles();
  renderCenter();
  renderLog();
  renderModals();
  renderFx(NET.state);
}

function renderLobby() {
  const wait = $('#lobby-wait');
  if (NET.roomCode && NET.myPeerId) {
    $('#lobby-form').style.display = 'none';
    wait.style.display = 'block';
    $('#room-code').textContent = NET.roomCode;
    $('#lobby-players').innerHTML = NET.lobbyPlayers.map((p, i) =>
      `<div class="lobby-player"><span class="lp-dot" style="background:${PLAYER_COLORS[i % PLAYER_COLORS.length].solid}"></span>${esc(p.name)}${i === 0 ? ' 👑' : ''}</div>`).join('');
    if (NET.isHost) {
      $('#btn-start').style.display = NET.lobbyPlayers.length >= 2 ? 'block' : 'none';
      $('#wait-note').textContent = NET.lobbyPlayers.length >= 2 ? 'Можно начинать!' : 'Нужно минимум 2 игрока…';
    } else {
      $('#wait-note').textContent = 'Ждём, пока хост начнёт игру…';
    }
  }
}

function renderPlaques() {
  const s = NET.state;
  $('#plaques').innerHTML = s.players.map((p, i) => {
    const col = PLAYER_COLORS[p.color];
    return `<div class="plaque ${i === s.turn ? 'active' : ''} ${p.bankrupt ? 'dead' : ''}"
      style="background:linear-gradient(90deg,${col.grad[0]},${col.grad[1]})">
      <div class="plaque-ava"><img src="assets/ava_${p.color}.png" alt=""></div>
      <div class="plaque-info"><div class="plaque-name">${esc(p.name)}${p.peerId === NET.myPeerId ? ' (ты)' : ''}</div>
      <div class="plaque-money">${CUR}${p.money}${p.inJail ? ' 🚔' : ''}${p.jailCards ? ' 🎫'.repeat(p.jailCards) : ''}</div></div>
    </div>`;
  }).join('');
}

function renderTiles() {
  const s = NET.state;
  document.querySelectorAll('.tile').forEach(d => {
    const i = +d.dataset.idx;
    const ps = s.props[i];
    const ownerEl = d.querySelector('.tile-owner');
    const housesEl = d.querySelector('.tile-houses');
    if (ps) {
      if (ps.owner >= 0) {
        const col = PLAYER_COLORS[s.players[ps.owner].color];
        ownerEl.style.background = col.solid;
        ownerEl.style.display = 'block';
        d.classList.toggle('mortgaged', ps.mortgaged);
      } else { ownerEl.style.display = 'none'; d.classList.remove('mortgaged'); }
      housesEl.innerHTML = ps.houses === 5 ? '<span class="hotel3d"></span>' : '<span class="house"></span>'.repeat(ps.houses);
    }
  });
}

function renderCenter() {
  const s = NET.state;
  const me = myPlayerIndex();
  const myTurn = me === s.turn && !s.players[me]?.bankrupt && s.winner === null;
  const p = s.players[s.turn];

  const canRoll = myTurn && !s.rolled && s.pendingBuy === null && fxBusy === 0;
  $('#btn-roll').style.display = canRoll ? 'inline-block' : 'none';

  const showJail = myTurn && p.inJail && !s.rolled;
  $('#jail-actions').style.display = showJail ? 'flex' : 'none';
  if (showJail) {
    $('#btn-payjail').disabled = s.players[me].money < 50;
    $('#btn-jailcard').style.display = s.players[me].jailCards > 0 ? 'inline-block' : 'none';
  }

  let hint = '';
  if (s.winner !== null) hint = `🏆 Победитель: ${s.players[s.winner].name}!`;
  else if (myTurn) hint = s.rolled ? 'Заверши ход или управляй имуществом' : (p.inJail ? 'Ты в тюрьме: плати, используй карту или бросай на дубль' : 'Твой ход!');
  else hint = `Ходит ${esc(p.name)}…`;
  $('#turn-hint').innerHTML = hint;

  const meP = s.players[me];
  $('#act-end').disabled = !(myTurn && s.rolled && s.pendingBuy === null && meP && meP.money >= 0 && fxBusy === 0);
  ['#act-trade', '#act-build', '#act-sell', '#act-mortgage', '#act-redeem'].forEach(id => {
    $(id).disabled = me < 0 || s.players[me]?.bankrupt || s.winner !== null;
  });
}

function renderLog() {
  const s = NET.state;
  $('#log').innerHTML = s.log.slice(-7).map(l => `<div>${esc(l)}</div>`).join('');
  $('#log').scrollTop = 1e6;
}

// ---------- Modals ----------
function renderModals() {
  const s = NET.state;
  const me = myPlayerIndex();
  if (fxBusy > 0 && !modalLocked) { if ($('#modal-overlay').style.display !== 'none' && !modalLocked) closeModal(); return; } // wait for animations

  if (s.winner !== null) {
    const w = s.players[s.winner];
    confettiBurst();
    openModal(`<div class="modal-title">🏆 ПОБЕДА!</div>
      <div class="card-body big">${esc(w.name)} — монополист!</div>
      <button class="btn gold" onclick="location.reload()">Новая игра</button>`);
    return;
  }

  if (s.pendingCard) {
    const key = s.pendingCard.deck + s.pendingCard.text + s.pendingCard.player;
    if (key !== cardFx.key || !cardFx.visible) { cardFx.key = key; showCardFx(s); }
    else updateCardFxButton(s);
    if (!modalLocked) closeModal();
    return;
  }
  if (cardFx.visible) hideCardFx();

  if (s.pendingBuy !== null) {
    const t = TILES[s.pendingBuy];
    if (me === s.turn) {
      const canAfford = s.players[me].money >= t.price;
      openModal(`<div class="modal-title">Купить участок?</div>
        <div class="deed">${deedHTML(s.pendingBuy)}</div>
        <div class="modal-btns">
          <button class="btn gold" ${canAfford ? '' : 'disabled'} onclick="sendAction({type:'buy'})">Купить за ${CUR}${t.price}</button>
          <button class="btn" onclick="sendAction({type:'declineBuy'})">Отказаться</button>
        </div>`);
    } else {
      openModal(`<div class="modal-title">${esc(s.players[s.turn].name)} решает…</div>
        <div class="deed">${deedHTML(s.pendingBuy)}</div>`);
    }
    return;
  }

  if (s.trade) {
    const tr = s.trade;
    const sum = side => {
      const parts = [];
      if (side.money) parts.push(`${CUR}${side.money}`);
      side.props.forEach(i => parts.push(esc(TILES[i].name)));
      return parts.length ? parts.join(', ') : '—';
    };
    const body = `<div class="modal-title">🤝 Обмен</div>
      <div class="trade-sum"><b>${esc(s.players[tr.from].name)} отдаёт:</b> ${sum({ money: tr.giveMoney, props: tr.giveProps })}</div>
      <div class="trade-sum"><b>${esc(s.players[tr.to].name)} отдаёт:</b> ${sum({ money: tr.getMoney, props: tr.getProps })}</div>`;
    if (me === tr.to) {
      openModal(body + `<div class="modal-btns">
        <button class="btn gold" onclick="sendAction({type:'acceptTrade'})">Принять</button>
        <button class="btn" onclick="sendAction({type:'declineTrade'})">Отклонить</button></div>`);
    } else if (me === tr.from) {
      openModal(body + `<div class="wait-note">Ждём ответа…</div>
        <button class="btn" onclick="sendAction({type:'declineTrade'})">Отменить</button>`);
    } else {
      openModal(body + `<div class="wait-note">Игроки договариваются…</div>`);
    }
    return;
  }

  if (me >= 0 && s.players[me].money < 0) {
    openModal(`<div class="modal-title">⚠ Недостаточно денег</div>
      <div class="card-body">Баланс: <b style="color:#e05555">${CUR}${s.players[me].money}</b><br>
      Заложи имущество или продай постройки, чтобы выйти в плюс. Если нечего продавать — объяви банкротство.</div>
      <div class="modal-btns">
        <button class="btn" onclick="closeModal();openManage('sellHouse')">Продать постройки</button>
        <button class="btn" onclick="closeModal();openManage('mortgage')">Заложить</button>
        <button class="btn danger" onclick="if(confirm('Точно объявить банкротство?'))sendAction({type:'bankrupt'})">Банкротство 💀</button>
      </div>`);
    return;
  }

  if (!modalLocked) closeModal();
}

let modalLocked = false; // true while a local (client-side) modal like trade builder is open

function openModal(html, locked = false) {
  modalLocked = locked;
  $('#modal').innerHTML = html;
  $('#modal-overlay').style.display = 'flex';
}
function closeModal() {
  modalLocked = false;
  $('#modal-overlay').style.display = 'none';
}

function deedHTML(i) {
  const t = TILES[i];
  let rows = '';
  if (t.type === 'prop') {
    rows = `<tr><td>Аренда</td><td>${CUR}${t.rent[0]}</td></tr>
      <tr><td>С монополией</td><td>${CUR}${t.rent[0] * 2}</td></tr>
      ${[1, 2, 3, 4].map(n => `<tr><td>${n} дом${n > 1 ? 'а' : ''}</td><td>${CUR}${t.rent[n]}</td></tr>`).join('')}
      <tr><td>Отель</td><td>${CUR}${t.rent[5]}</td></tr>
      <tr><td>Цена дома</td><td>${CUR}${t.house}</td></tr>`;
  } else if (t.type === 'rail') {
    rows = `<tr><td>1 дорога</td><td>${CUR}25</td></tr><tr><td>2 дороги</td><td>${CUR}50</td></tr>
      <tr><td>3 дороги</td><td>${CUR}100</td></tr><tr><td>4 дороги</td><td>${CUR}200</td></tr>`;
  } else if (t.type === 'util') {
    rows = `<tr><td>1 предприятие</td><td>4 × кубики</td></tr><tr><td>2 предприятия</td><td>10 × кубики</td></tr>`;
  }
  const barColor = t.type === 'prop' ? GROUP_COLORS[t.group] : '#444';
  return `<div class="deed-head" style="background:${barColor}">${esc(t.name)}</div>
    <table class="deed-table">${rows}<tr><td>Залог</td><td>${CUR}${Math.floor(t.price / 2)}</td></tr></table>`;
}

function showTileInfo(i) {
  const t = TILES[i];
  if (!NET.state || !NET.state.props[i]) return;
  const ps = NET.state.props[i];
  const owner = ps.owner >= 0 ? esc(NET.state.players[ps.owner].name) : 'Банк';
  openModal(`<div class="deed">${deedHTML(i)}</div>
    <div class="card-body">Владелец: <b>${owner}</b>${ps.mortgaged ? ' · <span style="color:#e0a555">Заложено</span>' : ''}${ps.houses ? ` · Построек: ${ps.houses === 5 ? 'отель' : ps.houses}` : ''}</div>
    <button class="btn" onclick="closeModal()">Закрыть</button>`, true);
}

// ---------- Manage (build / sell / mortgage / redeem) ----------
function openManage(kind) {
  const s = NET.state, me = myPlayerIndex();
  if (me < 0) return;
  const titles = { build: '🏠 Строительство', sellHouse: '🏚 Продажа построек', mortgage: '🏦 Залог', redeem: '📜 Выкуп из залога' };
  const rows = [];
  Object.keys(s.props).map(Number).forEach(i => {
    const t = TILES[i], ps = s.props[i];
    if (ps.owner !== me) return;
    let ok = false, label = '';
    if (kind === 'build' && t.type === 'prop') {
      const g = countGroup(s, t.group, me);
      ok = g.monopoly && !ps.mortgaged && ps.houses < 5;
      label = `${CUR}${t.house}`;
    } else if (kind === 'sellHouse') {
      ok = ps.houses > 0;
      label = `+${CUR}${Math.floor((t.house || 0) / 2)}`;
    } else if (kind === 'mortgage') {
      ok = !ps.mortgaged && ps.houses === 0;
      label = `+${CUR}${Math.floor(t.price / 2)}`;
    } else if (kind === 'redeem') {
      ok = ps.mortgaged;
      label = `${CUR}${Math.ceil(t.price / 2 * 1.1)}`;
    }
    if (!ok) return;
    const bar = t.type === 'prop' ? GROUP_COLORS[t.group] : '#666';
    rows.push(`<div class="mng-row"><span class="mng-dot" style="background:${bar}"></span>
      <span class="mng-name">${esc(t.name)}${ps.houses ? ' ' + (ps.houses === 5 ? '🏨' : '🏡'.repeat(ps.houses)) : ''}</span>
      <button class="btn small" onclick="sendAction({type:'${kind === 'build' ? 'build' : kind}',tile:${i}});setTimeout(()=>openManage('${kind}'),120)">${label}</button></div>`);
  });
  openModal(`<div class="modal-title">${titles[kind]}</div>
    <div class="mng-list">${rows.length ? rows.join('') : '<div class="wait-note">Нет доступных вариантов</div>'}</div>
    <button class="btn" onclick="closeModal()">Закрыть</button>`, true);
}

// ---------- Trade builder ----------
function openTrade() {
  const s = NET.state, me = myPlayerIndex();
  if (me < 0 || s.trade) return;
  const others = s.players.map((p, i) => ({ p, i })).filter(x => x.i !== me && !x.p.bankrupt);
  if (!others.length) return;
  const opts = others.map(x => `<option value="${x.i}">${esc(x.p.name)}</option>`).join('');
  const propList = (owner, cls) => Object.keys(s.props).map(Number)
    .filter(i => s.props[i].owner === owner && s.props[i].houses === 0)
    .map(i => `<label class="tr-prop"><input type="checkbox" class="${cls}" value="${i}">
      <span class="mng-dot" style="background:${TILES[i].type === 'prop' ? GROUP_COLORS[TILES[i].group] : '#666'}"></span>${esc(TILES[i].name)}${s.props[i].mortgaged ? ' (залог)' : ''}</label>`).join('') || '<div class="wait-note">Нет свободных участков</div>';

  const renderFor = to => {
    openModal(`<div class="modal-title">🤝 Предложить обмен</div>
      <div class="tr-row"><label>Кому:</label><select id="tr-to">${opts}</select></div>
      <div class="tr-cols">
        <div><div class="tr-head">Ты отдаёшь</div>
          <input id="tr-give-money" type="number" min="0" value="0" class="tr-money"> ${CUR}
          <div class="tr-props">${propList(me, 'tr-give')}</div></div>
        <div><div class="tr-head">Ты получаешь</div>
          <input id="tr-get-money" type="number" min="0" value="0" class="tr-money"> ${CUR}
          <div class="tr-props" id="tr-their-props">${propList(to, 'tr-get')}</div></div>
      </div>
      <div class="modal-btns">
        <button class="btn gold" onclick="submitTrade()">Отправить</button>
        <button class="btn" onclick="closeModal()">Отмена</button>
      </div>`, true);
    $('#tr-to').value = to;
    $('#tr-to').addEventListener('change', e => renderFor(+e.target.value));
  };
  renderFor(others[0].i);
}

function submitTrade() {
  const to = +$('#tr-to').value;
  const giveProps = [...document.querySelectorAll('.tr-give:checked')].map(c => +c.value);
  const getProps = [...document.querySelectorAll('.tr-get:checked')].map(c => +c.value);
  const giveMoney = Math.max(0, +$('#tr-give-money').value || 0);
  const getMoney = Math.max(0, +$('#tr-get-money').value || 0);
  if (!giveProps.length && !getProps.length && !giveMoney && !getMoney) return;
  closeModal();
  sendAction({ type: 'proposeTrade', to, giveProps, getProps, giveMoney, getMoney });
}

// ---------- Chat ----------
function addChat(msg) {
  const box = $('#chat-msgs');
  const d = document.createElement('div');
  d.className = 'chat-msg';
  d.innerHTML = `<b>${esc(msg.name)}:</b> ${esc(msg.text)}`;
  box.appendChild(d);
  box.scrollTop = 1e6;
  if ($('#chat-panel').style.display === 'none') {
    unreadChat++;
    $('#chat-badge').textContent = unreadChat;
    $('#chat-badge').style.display = 'block';
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Wire-up ----------
document.addEventListener('DOMContentLoaded', () => {
  buildBoard();
  NET.onUpdate = render;
  NET.onChat = addChat;

  $('#btn-create').addEventListener('click', () => {
    const name = $('#inp-name').value.trim();
    if (!name) { $('#lobby-error').textContent = 'Введи имя'; return; }
    $('#btn-create').disabled = true;
    hostGame(name, (err) => {
      if (err) { $('#lobby-error').textContent = err.message || 'Ошибка соединения'; $('#btn-create').disabled = false; return; }
      renderLobby();
    });
  });

  $('#btn-join').addEventListener('click', () => {
    const name = $('#inp-name').value.trim();
    const code = $('#inp-code').value.trim();
    if (!name) { $('#lobby-error').textContent = 'Введи имя'; return; }
    if (code.length !== 6) { $('#lobby-error').textContent = 'Код комнаты — 6 символов'; return; }
    $('#btn-join').disabled = true;
    $('#lobby-error').textContent = 'Подключение…';
    joinGame(name, code, err => {
      if (err) { $('#lobby-error').textContent = err.message; $('#btn-join').disabled = false; return; }
      $('#lobby-error').textContent = '';
      renderLobby();
    });
  });

  $('#btn-copy').addEventListener('click', () => {
    navigator.clipboard?.writeText(NET.roomCode);
    $('#btn-copy').textContent = '✓';
    setTimeout(() => $('#btn-copy').textContent = 'Копировать', 1200);
  });

  $('#btn-start').addEventListener('click', () => hostStartGame());
  $('#btn-roll').addEventListener('click', () => sendAction({ type: 'roll' }));
  $('#btn-payjail').addEventListener('click', () => sendAction({ type: 'payJail' }));
  $('#btn-jailcard').addEventListener('click', () => sendAction({ type: 'useJailCard' }));
  $('#act-end').addEventListener('click', () => sendAction({ type: 'endTurn' }));
  $('#act-build').addEventListener('click', () => openManage('build'));
  $('#act-sell').addEventListener('click', () => openManage('sellHouse'));
  $('#act-mortgage').addEventListener('click', () => openManage('mortgage'));
  $('#act-redeem').addEventListener('click', () => openManage('redeem'));
  $('#act-trade').addEventListener('click', () => openTrade());

  $('#btn-menu').addEventListener('click', () => {
    document.querySelector('.board-tilt').classList.toggle('flat');
    setTimeout(() => NET.state && placeAllTokens(NET.state), 60);
  });

  $('#btn-sound').textContent = snd.muted() ? '🔇' : '🔊';
  $('#btn-sound').addEventListener('click', () => {
    $('#btn-sound').textContent = snd.toggle() ? '🔇' : '🔊';
  });

  window.addEventListener('resize', () => NET.state && placeAllTokens(NET.state));

  $('#btn-chat').addEventListener('click', () => {
    const p = $('#chat-panel');
    p.style.display = p.style.display === 'none' ? 'flex' : 'none';
    unreadChat = 0;
    $('#chat-badge').style.display = 'none';
  });
  $('#btn-chat-close').addEventListener('click', () => $('#chat-panel').style.display = 'none');
  const doChat = () => {
    const v = $('#chat-inp').value.trim();
    if (!v) return;
    $('#chat-inp').value = '';
    sendChat(v);
  };
  $('#chat-send').addEventListener('click', doChat);
  $('#chat-inp').addEventListener('keydown', e => { if (e.key === 'Enter') doChat(); });
  $('#inp-code').addEventListener('input', e => e.target.value = e.target.value.toUpperCase());
});
