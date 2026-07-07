// ===== UI rendering & interaction =====
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const TOKENS = ['🎩', '🚗', '🐕', '⛵', '👢', '🐈'];
const TOKEN_IMGS = ['tok_hat', 'tok_car', 'tok_dog', 'tok_ship', 'tok_boot', 'tok_cat'];
let unreadChat = 0;
const cardFx = { key: '', visible: false };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const inviteBtnLabel = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg> Пригласить в Telegram`;
// prefer a player's Telegram photo, fall back to the built-in colored avatar
const avaSrc = p => p.photo ? p.photo : `assets/ava_${p.color}.png`;

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
  const fxq = { chain: Promise.resolve(), disp: null, lastSeq: 0, money: null, dispMoney: null };
let fxBusy = 0;
function queueFx(fn) {
  fxBusy++;
  fxq.chain = fxq.chain.then(fn).catch(() => {}).then(() => {
    fxBusy--;
    // animations done: show the modals/buttons we held back
    if (fxBusy === 0 && NET.state) { renderCenter(); renderModals(); }
  });
}

// All board visuals live in the Three.js scene (js/board3d.js).
function ensureTokens(s) {
  B3D.syncPlayers(s.players, myPlayerIndex());
}

function placeAllTokens(s) {
  if (!fxq.disp) return;
  B3D.snapTokens(fxq.disp, s.players);
}

async function walkToken(s, pi, from, to, jump = false, back = false) {
  await B3D.moveToken(pi, from, to, {
    jump, back,
    onHop: kind => (kind === 'fly' ? snd.card() : snd.hop()),
  });
  fxq.disp[pi] = to;
  placeAllTokens(s);
}

function setDice(vals) {
  B3D.setDice(vals);
}

function renderFx(s) {
  ensureTokens(s);
  if (!fxq.disp) {
    // first state: snap everything into place, skip past all existing events
    fxq.disp = s.players.map(p => p.pos);
    fxq.money = s.players.map(p => p.money);
    fxq.dispMoney = s.players.map(p => p.money);
    fxq.jail = s.players.map(p => !!p.inJail && !p.bankrupt);
    fxq.lastSeq = s.evSeq || 0;
    placeAllTokens(s);
    // snap cages for anyone already jailed (e.g. reconnect mid-game)
    s.players.forEach((p, i) => { if (fxq.jail[i]) B3D.setJail(i, true, true); });
    setDice(s.dice);
    return;
  }
  // Detect balance changes now (so re-broadcasts don't double-count),
  // but hold back the visible update until the token has actually landed.
  const moneyChanges = [];
  if (fxq.money) {
    s.players.forEach((p, i) => {
      if (fxq.money[i] !== undefined && p.money !== fxq.money[i]) {
        moneyChanges.push({ i, delta: p.money - fxq.money[i], to: p.money });
      }
    });
  }
  fxq.money = s.players.map(p => p.money);

  const commitMoney = () => {
    const me = myPlayerIndex();
    moneyChanges.forEach(({ i, delta, to }) => {
      fxq.dispMoney[i] = to;
      flashMoney(i, delta);
      if (i === me) TG.haptic(delta < 0 ? 'warning' : 'success');
    });
    snd.cash();
    renderPlaques(); // reveal the new balance only now
  };

  // Consume new animation events exactly once, strictly in order.
  // Re-broadcasts of the same state are harmless: seq dedup skips them.
  const evs = (s.events || []).filter(e => e.seq > (fxq.lastSeq || 0));
  if (evs.length) fxq.lastSeq = evs[evs.length - 1].seq;
  evs.forEach(ev => {
    if (ev.kind === 'dice') {
      queueFx(async () => {
        snd.dice();
        await B3D.rollDice(ev.d);
        // Hold on the settled dice so the player can actually read the roll
        // before the camera flies in to follow the token.
        await sleep(1150);
      });
    } else if (ev.kind === 'move') {
      queueFx(() => walkToken(s, ev.pi, ev.from, ev.to, ev.jump, ev.back));
    } else if (ev.kind === 'card') {
      queueFx(async () => {
        cardFx.key = ev.deck + ev.text + ev.player;
        showCardFx(ev);
        await sleep(1500); // let players read before any follow-up move plays
      });
    }
  });

  // Apply balance changes after the queued animation (landing), or now if idle.
  if (moneyChanges.length) {
    if (evs.length || fxBusy > 0) queueFx(async () => commitMoney());
    else commitMoney();
  }

  if (fxBusy === 0) {
    // idle: keep display state in sync (resize, missed snapshots)
    if (!s.dice) { setDice(null); }
    s.players.forEach((p, pi) => { if (!p.bankrupt) fxq.disp[pi] = p.pos; });
    placeAllTokens(s);
  }
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
  TG.haptic('success');
  setTimeout(() => { c.innerHTML = ''; }, 7000);
}

// ---------- Card draw animation ----------
function showCardFx(card0) {
  if (NET.state && NET.state.winner !== null) return;
  const isChance = card0.deck === 'ШАНС';
  const cls = isChance ? 'chance' : 'chest';
  const fx = $('#card-fx'), card = $('#fx-card'), inner = $('#fx-inner');
  const back = $('#fx-back'), front = $('#fx-front');
  back.className = 'fx-face fx-back ' + cls;
  const deckLbl = deckName(card0.deck);
  back.innerHTML = `<div class="fx-big">${isChance ? '❓' : '📦'}</div><div>${deckLbl}</div>`;
  front.innerHTML = `<div class="fx-front-head ${cls}">${isChance ? '❓' : '📦'} ${deckLbl}</div>
    <div class="fx-front-body">${esc(cardText(card0.text))}</div>
    <div class="fx-front-foot"><div class="fx-who">${t('cardFor')}: ${esc(card0.player)}</div><span id="fx-ok"></span></div>`;
  if (NET.state) updateCardFxButton(NET.state);
  snd.card();
  // start small at the deck's projected on-screen position, card back up
  const r = B3D.deckScreenRect(isChance);
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

// ---------- Board construction (Three.js scene) ----------
function buildBoard() {
  B3D.init(document.getElementById('board3d-wrap'), { onTileClick: showTileInfo });
}

// ---------- Rendering ----------
function render() {
  if (!NET.state) { renderLobby(); return; }
  const wasHidden = $('#game').style.display === 'none';
  $('#lobby').style.display = 'none';
  $('#game').style.display = 'flex';
  if (wasHidden) B3D.resize(); // canvas was 0x0 while hidden
  $('#host-away').style.display = NET.hostAway ? 'flex' : 'none';
  renderPlaques();
  renderTiles();
  renderFx(NET.state);   // queue animations FIRST so fxBusy gates modals below
  renderCenter();
  renderLog();
  renderModals();
}

function renderLobby() {
  const wait = $('#lobby-wait');
  if (NET.roomCode && NET.myPeerId) {
    $('#lobby-form').style.display = 'none';
    wait.style.display = 'block';
    $('#room-code').textContent = NET.roomCode;
    $('#btn-invite').style.display = TG.inside ? 'flex' : 'none';
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
    const owned = Object.keys(s.props).map(Number).filter(k => s.props[k].owner === i).length;
    // show the lagging displayed balance so money updates on landing, not on roll
    const shownMoney = (fxq.dispMoney && fxq.dispMoney[i] !== undefined) ? fxq.dispMoney[i] : p.money;
    return `<div id="plaque-${i}" class="plaque ${i === s.turn ? 'active' : ''} ${p.bankrupt ? 'dead' : ''}"
      role="button" tabindex="0" title="Показать участки" onclick="showPlayerHoldings(${i})"
      style="background:linear-gradient(90deg,${col.grad[0]},${col.grad[1]})">
      <div class="plaque-ava"><img src="${avaSrc(p)}" alt="" onerror="this.src='assets/ava_${p.color}.png'"></div>
      <div class="plaque-info"><div class="plaque-name">${esc(p.name)}${p.peerId === NET.myPeerId ? ' (ты)' : ''}</div>
      <div class="plaque-money">${CUR}${shownMoney}${p.inJail ? ' 🚔' : ''}${p.jailCards ? ' 🎫'.repeat(p.jailCards) : ''}</div></div>
      <div class="plaque-badge">${owned}</div>
    </div>`;
  }).join('');
}

function renderTiles() {
  B3D.updateProps(NET.state);
}

function renderCenter() {
  const s = NET.state;
  const me = myPlayerIndex();
  const myTurn = me === s.turn && !s.players[me]?.bankrupt && s.winner === null;
  const p = s.players[s.turn];

  const canRoll = myTurn && !s.rolled && s.pendingBuy === null && !s.auction && fxBusy === 0;
  $('#btn-roll').style.display = canRoll ? 'inline-block' : 'none';

  const showJail = myTurn && p.inJail && !s.rolled;
  $('#jail-actions').style.display = showJail ? 'flex' : 'none';
  if (showJail) {
    $('#btn-payjail').disabled = s.players[me].money < 50;
    $('#btn-jailcard').style.display = s.players[me].jailCards > 0 ? 'inline-block' : 'none';
  }

  let hint = '';
  if (s.winner !== null) hint = `🏆 ${t('winner')}: ${esc(s.players[s.winner].name)}!`;
  else if (myTurn) hint = s.rolled ? t('finishOrManage') : (p.inJail ? t('jailHint') : t('yourTurn'));
  else hint = `${t('turnOf')} ${esc(p.name)}…`;
  // turn timer countdown — hidden while dice/token animations play, so it
  // doesn't keep ticking on-screen while the piece is still moving.
  if (s.winner === null && s.turnDeadline && s.settings && s.settings.turnTimer > 0 && fxBusy === 0) {
    const left = Math.max(0, Math.ceil((s.turnDeadline - Date.now()) / 1000));
    const warn = left <= 10 ? ' timer-warn' : '';
    hint += `<div class="turn-timer${warn}">⏱ ${left}s</div>`;
  }
  // free-parking pot indicator
  if (s.settings && s.settings.freeParkingPot && s.parkingPot > 0) {
    hint += `<div class="parking-pot">🅿️ ${t('parkingPot')}: ${CUR}${s.parkingPot}</div>`;
  }
  $('#turn-hint').innerHTML = hint;

  const meP = s.players[me];
  const canEnd = myTurn && s.rolled && s.pendingBuy === null && !s.auction && meP && meP.money >= 0 && fxBusy === 0;
  $('#act-end').disabled = !canEnd;
  // prominent central end-turn button so it's not forgotten
  $('#btn-end-center').style.display = canEnd ? 'inline-flex' : 'none';
  ['#act-trade', '#act-build', '#act-sell', '#act-mortgage', '#act-redeem'].forEach(id => {
    $(id).disabled = me < 0 || s.players[me]?.bankrupt || s.winner !== null;
  });
}

function renderLog() {
  const s = NET.state, box = $('#log');
  // keep the user's scroll position if they scrolled up to browse history
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = s.log.slice(-120).map(l => `<div>${esc(l)}</div>`).join('');
  if (atBottom) box.scrollTop = 1e6;
}

function setLogCollapsed(collapsed) {
  $('#log-wrap').classList.toggle('collapsed', collapsed);
  $('#log-arrow').textContent = collapsed ? '▸' : '▾';
  $('#log-toggle').setAttribute('aria-expanded', String(!collapsed));
  localStorage.setItem('mono-log', collapsed ? '1' : '0');
}

// Post-game stats table for the victory modal.
function statsHTML(s) {
  if (!s.stats) return '';
  const propVal = pi => Object.entries(s.props)
    .filter(([, ps]) => ps.owner === pi)
    .reduce((sum, [i]) => sum + (BOARD[i].price || 0), 0);
  const rows = s.players.map((p, i) => {
    const st = s.stats[i] || { rentPaid: 0, rentEarned: 0, bought: 0, circles: 0 };
    const total = p.bankrupt ? 0 : p.money + propVal(i);
    return { name: p.name, color: p.color, bankrupt: p.bankrupt, total, st };
  }).sort((a, b) => b.total - a.total);
  return `<div class="stats-table">
    <div class="stats-row stats-head">
      <span>${t('stPlayer')}</span><span>${t('stTotal')}</span><span>${t('stTiles')}</span><span>${t('stRentIn')}</span><span>${t('stRentOut')}</span><span>${t('stCircles')}</span>
    </div>
    ${rows.map(r => `<div class="stats-row${r.bankrupt ? ' stats-out' : ''}">
      <span><i class="stats-dot" style="background:${PLAYER_COLORS[r.color].solid}"></i>${esc(r.name)}</span>
      <span>${r.bankrupt ? '💀' : CUR + r.total}</span>
      <span>${r.st.bought}</span>
      <span>${CUR}${r.st.rentEarned}</span>
      <span>${CUR}${r.st.rentPaid}</span>
      <span>${r.st.circles}</span>
    </div>`).join('')}
  </div>`;
}

// ---------- Modals ----------
function renderModals() {
  const s = NET.state;
  const me = myPlayerIndex();
  if (fxBusy > 0 && !modalLocked) { if ($('#modal-overlay').style.display !== 'none' && !modalLocked) closeModal(); return; } // wait for animations

  if (s.winner !== null) {
    const w = s.players[s.winner];
    confettiBurst();
    clearSession(); // game is over: never auto-resume into a finished game
    openModal(`<div class="modal-title">🏆 ${t('victory')}</div>
      <div class="card-body big">${esc(w.name)} — ${t('monopolist')}</div>
      ${statsHTML(s)}
      <button class="btn gold" onclick="leaveRoom()">${t('newGame')}</button>`);
    return;
  }

  if (s.pendingCard) {
    // the reveal animation is played by the FX queue (card event);
    // here we only handle a fallback (joined mid-card) and the OK button
    const key = s.pendingCard.deck + s.pendingCard.text + s.pendingCard.player;
    if (!cardFx.visible && key !== cardFx.key) { cardFx.key = key; showCardFx(s.pendingCard); }
    else updateCardFxButton(s);
    if (!modalLocked) closeModal();
    return;
  }
  if (cardFx.visible) hideCardFx();

  if (s.auction) {
    const au = s.auction;
    const t = BOARD[au.tile];
    const iAmIn = me >= 0 && !s.players[me].bankrupt && !au.passed.includes(me);
    const highTxt = au.bidder >= 0 ? `${CUR}${au.high} — ${esc(s.players[au.bidder].name)}` : 'ставок нет';
    let controls = '';
    if (iAmIn) {
      const step = au.high < 50 ? 10 : au.high < 200 ? 25 : 50;
      const next = au.high + step;
      const canBid = s.players[me].money >= next;
      controls = `<div class="modal-btns">
        <button class="btn gold" ${canBid ? '' : 'disabled'} onclick="sendAction({type:'bid',amount:${next}})">Ставка ${CUR}${next}</button>
        <button class="btn" onclick="sendAction({type:'passBid'})">Пас</button>
      </div>
      <div class="wait-note">Твой баланс: ${CUR}${s.players[me].money}</div>`;
    } else {
      controls = `<div class="wait-note">${au.passed.includes(me) ? 'Ты спасовал. ' : ''}Идут торги…</div>`;
    }
    openModal(`<div class="modal-title">🔨 Аукцион</div>
      <div class="deed">${deedHTML(au.tile)}</div>
      <div class="card-body">Текущая ставка: <b>${highTxt}</b></div>
      ${controls}`);
    return;
  }

  if (s.pendingBuy !== null) {
    const t = BOARD[s.pendingBuy];
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
      side.props.forEach(i => parts.push(esc(tileName(BOARD[i].name))));
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
  const t = BOARD[i];
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
  return `<div class="deed-head" style="background:${barColor}">${esc(tileName(t.name))}</div>
    <table class="deed-table">${rows}<tr><td>Залог</td><td>${CUR}${Math.floor(t.price / 2)}</td></tr></table>`;
}

function confirmExit() {
  const wa = window.Telegram && window.Telegram.WebApp;
  if (TG.inside && wa && wa.showConfirm) {
    wa.showConfirm('Выйти из игры? Ты покинешь текущую комнату.', ok => { if (ok) leaveRoom(); });
  } else if (confirm('Выйти из игры? Ты покинешь текущую комнату.')) {
    leaveRoom();
  }
}

function showPlayerHoldings(pi) {
  const s = NET.state;
  if (!s || !s.players[pi]) return;
  const p = s.players[pi];
  const owned = Object.keys(s.props).map(Number).filter(i => s.props[i].owner === pi);
  const worth = owned.reduce((a, i) => a + BOARD[i].price, 0);
  const pledgeLbl = t('pledge');   // capture before `t` is shadowed by the tile below
  const rows = owned.length ? owned.map(i => {
    const t = BOARD[i], ps = s.props[i];
    const bar = t.type === 'prop' ? GROUP_COLORS[t.group] : '#666';
    const extra = ps.mortgaged ? ` <span class="hold-mort">${pledgeLbl}</span>`
      : ps.houses ? ' ' + (ps.houses === 5 ? '🏨' : '🏡'.repeat(ps.houses)) : '';
    return `<div class="mng-row"><span class="mng-dot" style="background:${bar}"></span>
      <span class="mng-name">${esc(tileName(t.name))}${extra}</span>
      <span class="hold-val">${CUR}${t.price}</span></div>`;
  }).join('') : '<div class="wait-note">Пока нет участков</div>';
  const col = PLAYER_COLORS[p.color];
  openModal(`<div class="hold-head" style="background:linear-gradient(90deg,${col.grad[0]},${col.grad[1]})">
      <img src="${avaSrc(p)}" alt="" onerror="this.src='assets/ava_${p.color}.png'"><span>${esc(p.name)}</span></div>
    <div class="hold-cash">Баланс <b>${CUR}${p.money}</b> · Участков <b>${owned.length}</b> · Активы <b>${CUR}${worth}</b></div>
    <div class="mng-list">${rows}</div>
    <button class="btn" onclick="closeModal()">Закрыть</button>`, true);
}

// floating "-₩220 / +₩200" over a player's plaque when their balance changes
function flashMoney(pi, delta) {
  const plaque = document.getElementById('plaque-' + pi);
  const layer = $('#money-fx');
  if (!plaque || !layer) return;
  const r = plaque.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'money-float ' + (delta < 0 ? 'neg' : 'pos');
  el.textContent = (delta < 0 ? '−' : '+') + CUR + Math.abs(delta);
  el.style.left = (r.left + r.width / 2) + 'px';
  el.style.top = (r.bottom - 4) + 'px';
  layer.appendChild(el);
  plaque.classList.remove('money-pulse'); void plaque.offsetWidth; plaque.classList.add('money-pulse');
  setTimeout(() => el.remove(), 1700);
}

// floating emoji reaction above a player's plaque (same fx layer as money)
const REACT_ALLOWED = ['😂', '😡', '😱', '👍', '💰'];
function showReaction(pi, emoji) {
  if (!REACT_ALLOWED.includes(emoji)) return;
  const plaque = document.getElementById('plaque-' + pi);
  const layer = $('#money-fx');
  if (!plaque || !layer) return;
  const r = plaque.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'react-float';
  el.textContent = emoji;
  el.style.left = (r.left + r.width / 2) + 'px';
  el.style.top = (r.bottom - 2) + 'px';
  layer.appendChild(el);
  TG.haptic('light');
  setTimeout(() => el.remove(), 2100);
}

function showTileInfo(i) {
  const t = BOARD[i];
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
    const t = BOARD[i], ps = s.props[i];
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
      <span class="mng-name">${esc(tileName(t.name))}${ps.houses ? ' ' + (ps.houses === 5 ? '🏨' : '🏡'.repeat(ps.houses)) : ''}</span>
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
      <span class="mng-dot" style="background:${BOARD[i].type === 'prop' ? GROUP_COLORS[BOARD[i].group] : '#666'}"></span>${esc(tileName(BOARD[i].name))}${s.props[i].mortgaged ? ` (${t('pledge')})` : ''}</label>`).join('') || `<div class="wait-note">${t('noFreePlots')}</div>`;

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
  NET.onReact = showReaction;

  // ---- language selector (applyI18n also highlights the active button) ----
  applyI18n();
  $('#lang-row').addEventListener('click', e => {
    const b = e.target.closest('.lang-btn');
    if (!b) return;
    setLang(b.dataset.lang);
  });

  // ---- emoji quick reactions (throttled to avoid spam) ----
  let lastReact = 0;
  $('#react-bar').addEventListener('click', e => {
    const b = e.target.closest('.react-btn');
    if (!b) return;
    const now = Date.now();
    if (now - lastReact < 1500) return;
    lastReact = now;
    sendReaction(b.dataset.e);
  });

  // 1s ticker so the turn-timer countdown stays live between state updates
  setInterval(() => {
    const s = NET.state;
    if (s && s.winner === null && s.turnDeadline && s.settings && s.settings.turnTimer > 0
        && $('#game').style.display !== 'none') {
      renderCenter();
    }
  }, 1000);

  // ---- Telegram Mini App: expand, theme, auto name/avatar, deep-link invites ----
  let inviteCode = '';
  TG.init();
  if (TG.inside) {
    document.body.classList.add('in-telegram');
    const tgName = TG.name();
    if (tgName) {
      $('#inp-name').value = tgName;
      NET.myPhoto = TG.photo();
      const ava = $('#tg-greet-ava');
      if (NET.myPhoto) { ava.src = NET.myPhoto; ava.style.display = 'block'; }
      else ava.style.display = 'none';
      $('#tg-greet-name').textContent = tgName;
      $('#tg-greet').style.display = 'flex';
      $('#inp-name').style.display = 'none';
    }
    // opened via invite link t.me/bot/app?startapp=CODE
    const sp = TG.startParam();
    if (sp && /^[A-Z0-9]{6}$/i.test(sp)) inviteCode = sp.toUpperCase();
  }
  // let the user reveal the name field to change the auto-filled Telegram name
  $('#tg-greet-edit').addEventListener('click', () => {
    $('#tg-greet').style.display = 'none';
    $('#inp-name').style.display = 'block';
    $('#inp-name').focus();
  });

  // Join a room from an invite link. Used both for a fresh open and as a
  // fallback when a stale session fails to reconnect.
  function autoJoinInvite(code) {
    const name = $('#inp-name').value.trim();
    $('#inp-code').value = code;
    if (!name) { // no auto name yet: show the lobby with the code prefilled
      $('#lobby-wait').style.display = 'none';
      $('#lobby-form').style.display = 'block';
      $('#lobby-error').textContent = '';
      return;
    }
    $('#lobby-form').style.display = 'none';
    $('#lobby-wait').style.display = 'block';
    $('#wait-note').textContent = 'Подключение к игре…';
    joinGame(name, code, err => {
      if (err) {
        $('#lobby-wait').style.display = 'none';
        $('#lobby-form').style.display = 'block';
        $('#lobby-error').textContent = err.message;
        return;
      }
      $('#lobby-error').textContent = '';
      renderLobby();
    });
  }

  // An invite deep-link takes priority over a stale saved session: if we were
  // opened via an invite for a different room than the saved one, that session
  // is stale (e.g. the previous host already left), so drop it instead of
  // spinning forever trying to reconnect to a dead room.
  if (inviteCode) {
    const ses = loadSession();
    if (!ses || ses.roomCode !== inviteCode) clearSession();
    $('#inp-code').value = inviteCode;
  }

  // auto-resume a saved session (page was refreshed mid-game)
  const resuming = tryResume((err) => {
    if (err) {
      $('#lobby-wait').style.display = 'none';
      $('#lobby-form').style.display = 'block';
      $('#lobby-error').textContent = '';
      if (inviteCode) autoJoinInvite(inviteCode); // hop into the invited room
      return;
    }
    render();
  });
  if (resuming) {
    $('#lobby-form').style.display = 'none';
    $('#lobby-error').textContent = '';
    $('#lobby-wait').style.display = 'block';
    $('#wait-note').textContent = 'Переподключение к игре…';
  } else if (inviteCode) {
    autoJoinInvite(inviteCode); // fresh open from an invite link
  }

  // "Создать комнату" opens the settings screen first.
  // soloMode controls whether the confirm button starts a network room or a bot game.
  let soloMode = false;
  function openSettings(solo) {
    const name = $('#inp-name').value.trim();
    if (!name) { $('#lobby-error').textContent = t('enterName'); return; }
    soloMode = solo;
    $('#set-bots-group').style.display = solo ? 'block' : 'none';
    $('#lobby-form').style.display = 'none';
    $('#settings-screen').style.display = 'block';
  }
  $('#btn-create').addEventListener('click', () => openSettings(false));
  $('#btn-solo').addEventListener('click', () => openSettings(true));
  $('#btn-settings-back').addEventListener('click', () => {
    $('#settings-screen').style.display = 'none';
    $('#lobby-form').style.display = 'block';
  });

  // segmented pickers: single choice per group
  $$('.seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const b = e.target.closest('.seg-btn');
      if (!b) return;
      seg.querySelectorAll('.seg-btn').forEach(x => x.classList.remove('is-on'));
      b.classList.add('is-on');
      if (seg.id === 'set-theme') B3D.previewTheme?.(b.dataset.v);
    });
  });

  function collectSettings() {
    const segVal = id => {
      const on = $('#' + id).querySelector('.seg-btn.is-on');
      return on ? on.dataset.v : null;
    };
    return {
      startMoney: parseInt(segVal('set-money'), 10) || 1500,
      turnTimer: parseInt(segVal('set-timer'), 10) || 0,
      theme: segVal('set-theme') || 'classic',
      auction: $('#set-auction').checked,
      freeParkingPot: $('#set-pot').checked,
      innerCircle: $('#set-metro').checked,
      speedDie: $('#set-speed').checked,
    };
  }

  $('#btn-create-confirm').addEventListener('click', () => {
    const name = $('#inp-name').value.trim();
    if (!name) { $('#lobby-error').textContent = t('enterName'); return; }
    NET.settings = collectSettings();
    if (soloMode) {
      const on = $('#set-bots').querySelector('.seg-btn.is-on');
      const botCount = parseInt(on ? on.dataset.v : '1', 10) || 1;
      $('#settings-screen').style.display = 'none';
      soloGame(name, botCount);
      render();
      return;
    }
    $('#btn-create-confirm').disabled = true;
    hostGame(name, (err) => {
      if (err) {
        $('#btn-create-confirm').disabled = false;
        $('#settings-screen').style.display = 'none';
        $('#lobby-form').style.display = 'block';
        $('#lobby-error').textContent = err.message || t('connErr');
        return;
      }
      $('#settings-screen').style.display = 'none';
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
    TG.haptic('light');
    $('#btn-copy').textContent = '✓';
    setTimeout(() => $('#btn-copy').textContent = 'Коп��ровать', 1200);
  });

  $('#btn-invite').addEventListener('click', () => {
    TG.haptic('light');
    if (!TG.shareInvite(NET.roomCode)) {
      // bot/mini-app not configured yet: fall back to copying the code
      navigator.clipboard?.writeText(NET.roomCode);
      $('#btn-invite').textContent = 'Код скопирован ✓';
      setTimeout(() => { $('#btn-invite').innerHTML = inviteBtnLabel(); }, 1400);
    }
  });

  $('#btn-start').addEventListener('click', () => { TG.haptic('medium'); hostStartGame(); });
  $('#btn-roll').addEventListener('click', () => { TG.haptic('medium'); sendAction({ type: 'roll' }); });
  $('#btn-end-center').addEventListener('click', () => { TG.haptic('light'); sendAction({ type: 'endTurn' }); });
  $('#btn-exit').addEventListener('click', () => { TG.haptic('light'); confirmExit(); });
  $('#btn-payjail').addEventListener('click', () => sendAction({ type: 'payJail' }));
  $('#btn-jailcard').addEventListener('click', () => sendAction({ type: 'useJailCard' }));
  $('#act-end').addEventListener('click', () => sendAction({ type: 'endTurn' }));
  $('#act-build').addEventListener('click', () => openManage('build'));
  $('#act-sell').addEventListener('click', () => openManage('sellHouse'));
  $('#act-mortgage').addEventListener('click', () => openManage('mortgage'));
  $('#act-redeem').addEventListener('click', () => openManage('redeem'));
  $('#act-trade').addEventListener('click', () => openTrade());

  $('#btn-menu').addEventListener('click', () => B3D.toggleFlat());

  // log: collapsible, collapsed by default on small screens
  const savedLog = localStorage.getItem('mono-log');
  setLogCollapsed(savedLog !== null ? savedLog === '1' : window.innerWidth < 700);
  $('#log-toggle').addEventListener('click', () => setLogCollapsed(!$('#log-wrap').classList.contains('collapsed')));

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
