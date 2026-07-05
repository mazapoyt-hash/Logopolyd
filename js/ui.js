// ===== UI rendering & interaction =====
const $ = sel => document.querySelector(sel);
const TOKENS = ['🎩', '🚗', '🐕', '⛵', '👢', '🐈'];
const DICE_CH = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
let unreadChat = 0;
let lastCardKey = '';

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
      <div class="plaque-ava">${TOKENS[p.color]}</div>
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
      housesEl.innerHTML = ps.houses === 5 ? '<span class="hotel">🏨</span>' : '🏡'.repeat(ps.houses);
    }
    const toks = s.players.map((p, pi) => ({ p, pi })).filter(x => !x.p.bankrupt && x.p.pos === i);
    d.querySelector('.tile-tokens').innerHTML = toks.map(x =>
      `<span class="token" style="border-color:${PLAYER_COLORS[x.p.color].solid}">${TOKENS[x.p.color]}</span>`).join('');
  });
}

function renderCenter() {
  const s = NET.state;
  const me = myPlayerIndex();
  const myTurn = me === s.turn && !s.players[me]?.bankrupt && s.winner === null;
  const p = s.players[s.turn];

  $('#dice').innerHTML = s.dice ? `<span class="die">${DICE_CH[s.dice[0]]}</span><span class="die">${DICE_CH[s.dice[1]]}</span>` : '';
  const canRoll = myTurn && !s.rolled && s.pendingBuy === null;
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
  $('#act-end').disabled = !(myTurn && s.rolled && s.pendingBuy === null && meP && meP.money >= 0);
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

  if (s.winner !== null) {
    const w = s.players[s.winner];
    openModal(`<div class="modal-title">🏆 ПОБЕДА!</div>
      <div class="card-body big">${esc(w.name)} — монополист!</div>
      <button class="btn gold" onclick="location.reload()">Новая игра</button>`);
    return;
  }

  if (s.pendingCard) {
    const key = s.pendingCard.deck + s.pendingCard.text + s.pendingCard.player;
    openModal(`<div class="modal-title">${s.pendingCard.deck}</div>
      <div class="card-body">${esc(s.pendingCard.player)}: «${esc(s.pendingCard.text)}»</div>
      <button class="btn gold" onclick="sendAction({type:'dismissCard'})">OK</button>`);
    lastCardKey = key;
    return;
  }

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
      if (err) { $('#lobby-error').textContent = 'Ошибка соединения: ' + err.type; $('#btn-create').disabled = false; return; }
      renderLobby();
    });
  });

  $('#btn-join').addEventListener('click', () => {
    const name = $('#inp-name').value.trim();
    const code = $('#inp-code').value.trim();
    if (!name) { $('#lobby-error').textContent = 'Введи имя'; return; }
    if (code.length !== 5) { $('#lobby-error').textContent = 'Код комнаты — 5 символов'; return; }
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
  });

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
