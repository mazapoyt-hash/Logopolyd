// ===== Game engine (runs on the host, clients only render state) =====

function newGameState(lobbyPlayers, settings) {
  const cfg = Object.assign({}, DEFAULT_SETTINGS, settings || {});
  const props = {};
  BOARD.forEach((t, i) => {
    if (t.type === 'prop' || t.type === 'rail' || t.type === 'util') {
      props[i] = { owner: -1, houses: 0, mortgaged: false };
    }
  });
  return {
    started: true,
    settings: cfg,
    parkingPot: 0,          // free-parking money pile (if enabled)
    auction: null,          // active auction state (if enabled)
    players: lobbyPlayers.map((p, i) => ({
      peerId: p.peerId, name: p.name, photo: p.photo || '', color: i % PLAYER_COLORS.length,
      money: cfg.startMoney, pos: 0, ring: 0, metroReturn: 5,
      inJail: false, jailTurns: 0, jailCards: 0, bankrupt: false,
    })),
    props,
    turn: 0,
    turnDeadline: cfg.turnTimer > 0 ? Date.now() + cfg.turnTimer * 1000 : 0,
    dice: null,
    rolled: false,
    doubles: 0,
    pendingBuy: null,       // tile index awaiting buy/decline
    pendingCard: null,      // {deck, text} shown to all
    trade: null,            // {from, to, giveMoney, getMoney, giveProps, getProps}
    chanceIdx: 0, chestIdx: 0,
    chanceDeck: shuffle([...CHANCE_CARDS.keys()]),
    chestDeck: shuffle([...CHEST_CARDS.keys()]),
    log: [],
    stats: lobbyPlayers.map(() => ({ rentPaid: 0, rentEarned: 0, bought: 0, circles: 0 })),
    events: [],   // ordered animation events, consumed exactly once by clients
    evSeq: 0,
    stateV: 1,    // state version: clients ignore snapshots with stateV <= theirs
    winner: null,
  };
}

// Bump the state version. Called on every mutation the host broadcasts.
function bumpV(state) {
  state.stateV = (state.stateV || 0) + 1;
}

// Push an ordered animation event (dice roll, token move, card draw).
// Clients replay these strictly in order and exactly once (dedup by seq),
// which fixes duplicated walks and premature modals on re-broadcasts.
function pushEv(state, ev) {
  state.evSeq = (state.evSeq || 0) + 1;
  if (!state.events) state.events = [];
  state.events.push({ seq: state.evSeq, ...ev });
  if (state.events.length > 24) state.events.shift();
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function glog(state, msg) {
  state.log.push(msg);
  if (state.log.length > 60) state.log.shift();
}

function pName(state, i) { return state.players[i].name; }

function countGroup(state, group, owner) {
  let total = 0, owned = 0;
  BOARD.forEach((t, i) => {
    if (t.type === 'prop' && t.group === group) {
      total++;
      if (state.props[i].owner === owner) owned++;
    }
  });
  return { total, owned, monopoly: total === owned && total > 0 };
}

function countType(state, type, owner) {
  let n = 0;
  BOARD.forEach((t, i) => { if (t.type === type && state.props[i].owner === owner) n++; });
  return n;
}

function calcRent(state, tileIdx, diceSum) {
  const t = BOARD[tileIdx];
  const ps = state.props[tileIdx];
  if (ps.mortgaged) return 0;
  if (t.type === 'rail') {
    const n = countType(state, 'rail', ps.owner);
    return [0, 25, 50, 100, 200][n];
  }
  if (t.type === 'util') {
    const n = countType(state, 'util', ps.owner);
    return diceSum * (n === 2 ? 10 : 4);
  }
  if (ps.houses > 0) return t.rent[ps.houses];
  const g = countGroup(state, t.group, ps.owner);
  return g.monopoly ? t.rent[0] * 2 : t.rent[0];
}

function transfer(state, fromIdx, toIdx, amount) {
  // toIdx === -1 => bank
  if (fromIdx >= 0) state.players[fromIdx].money -= amount;
  if (toIdx >= 0) state.players[toIdx].money += amount;
  // player-to-player transfers are rent: feed the post-game stats
  if (state.stats && fromIdx >= 0 && toIdx >= 0 && amount > 0) {
    state.stats[fromIdx].rentPaid += amount;
    state.stats[toIdx].rentEarned += amount;
  }
}

function movePlayer(state, pi, steps) {
  const p = state.players[pi];
  const old = p.pos;
  const base = ringBase(old), len = ringLen(old);
  const rel = (((old - base) + steps) % len + len) % len;
  p.pos = base + rel;
  // Pass the ACTUAL walk direction (sign of steps) so the animation walks the
  // real path. Dice rolls always move forward; only "back N" cards move back.
  // Without this the renderer guessed via shortest-path, which reversed inner
  // ring walks longer than half the ring (len 24) — looking inconsistent.
  pushEv(state, { kind: 'move', pi, from: old, to: p.pos, jump: false, back: steps < 0 });
  // GO bonus only when looping the OUTER ring forward past start
  if (base === 0 && steps > 0 && p.pos < old) {
    p.money += 200;
    if (state.stats) state.stats[pi].circles++;
    glog(state, `${p.name} проходит GO и получает ${CUR}200`);
  }
}

function moveTo(state, pi, tileIdx, collectGo = true) {
  const p = state.players[pi];
  const old = p.pos;
  if (collectGo && tileIdx < p.pos) {
    p.money += 200;
    glog(state, `${p.name} проходит GO и получает ${CUR}200`);
  }
  p.pos = tileIdx;
  if (old !== tileIdx) pushEv(state, { kind: 'move', pi, from: old, to: tileIdx, jump: true });
}

function sendToJail(state, pi) {
  const p = state.players[pi];
  const old = p.pos;
  p.pos = 10; p.inJail = true; p.jailTurns = 0;
  state.doubles = 0;
  if (old !== 10) pushEv(state, { kind: 'move', pi, from: old, to: 10, jump: true });
  glog(state, `${p.name} отправляется в тюрьму 🚔`);
}

// Put an unbought tile up for auction among all solvent players.
function startAuction(state, tileIdx) {
  const eligible = state.players.map((p, i) => i).filter(i => !state.players[i].bankrupt);
  if (eligible.length < 1) return;
  state.auction = { tile: tileIdx, high: 0, bidder: -1, passed: [] };
  glog(state, `🔨 ${BOARD[tileIdx].name} выставлен на аукцион (стартовая цена ${CUR}0)`);
  resolveAuction(state);
}

// Close the auction once only one (or zero) bidder remains.
function resolveAuction(state) {
  const au = state.auction;
  if (!au) return;
  const active = state.players
    .map((p, i) => i)
    .filter(i => !state.players[i].bankrupt && !au.passed.includes(i));
  // more than one player left -> keep it open
  if (active.length > 1) return;
  // exactly one left who hasn't yet placed the top bid -> let them bid
  if (active.length === 1 && active[0] !== au.bidder) return;
  // everyone passed and nobody bid -> tile stays with the bank
  if (au.bidder === -1) {
    glog(state, `Аукцион завершён без ставок — ${BOARD[au.tile].name} остаётся у банка`);
    state.auction = null;
      maybeEnterMetro(state, state.turn);
    return;
  }
  // winner is the top bidder (or the last one left who bid)
  const w = state.players[au.bidder];
  w.money -= au.high;
  state.props[au.tile].owner = au.bidder;
  if (state.stats) state.stats[au.bidder].bought++;
  addToPot(state, 0);
  glog(state, `🔨 ${w.name} выигрывает ${BOARD[au.tile].name} за ${CUR}${au.high}`);
  state.auction = null;
  maybeEnterMetro(state, state.turn);
}

// Inner-ring metro: once an outer station tile is fully settled (bought,
// declined, or rent paid — no pending buy/auction), the player is pulled down
// into the inner ring automatically. They resume rolling from inside next turn.
function maybeEnterMetro(state, pi) {
  const p = state.players[pi];
  if (!(state.settings && state.settings.innerCircle)) return;
  if (state.pendingBuy !== null || state.auction) return;
  if (p.ring !== 0) return;
  if (!OUTER_STATIONS.includes(p.pos)) return;
  const from = p.pos;
  p.metroReturn = from;      // remember which station to resurface at
  p.ring = 1;
  p.pos = INNER_BASE;        // inner entrance (a metro tile, but placement only)
  pushEv(state, { kind: 'move', pi, from, to: INNER_BASE, jump: true });
  glog(state, `🚇 ${p.name} спускается в метро`);
}

// Leaving the inner ring: landing on any inner metro tile resurfaces the player
// at the outer station they entered from.
function exitMetro(state, pi) {
  const p = state.players[pi];
  const from = p.pos;
  const back = (typeof p.metroReturn === 'number') ? p.metroReturn : 5;
  p.ring = 0;
  p.pos = back;
  pushEv(state, { kind: 'move', pi, from, to: back, jump: true });
  glog(state, `🚇 ${p.name} выходит из метро на ${BOARD[back].name}`);
}

function landOn(state, pi, diceSum, rentMult = 1, skipMetro = false) {
  const p = state.players[pi];
  // inner-ring exit: landing on an inner metro tile resurfaces the player
  if (p.ring === 1 && BOARD[p.pos].type === 'metro') {
    exitMetro(state, pi);
    return;
  }
  const t = BOARD[p.pos];
  const idx = p.pos;
  switch (t.type) {
    case 'prop': case 'rail': case 'util': {
      const ps = state.props[idx];
      if (ps.owner === -1) {
        // can't afford it and auctions are on -> straight to auction
        if (state.settings && state.settings.auction && p.money < (t.price || 0)) {
          startAuction(state, idx);
        } else {
          state.pendingBuy = idx;
        }
      } else if (ps.owner !== pi && !ps.mortgaged && !state.players[ps.owner].bankrupt) {
        const rent = calcRent(state, idx, diceSum) * rentMult;
        transfer(state, pi, ps.owner, rent);
        glog(state, `${p.name} платит ${CUR}${rent} аренды → ${pName(state, ps.owner)} (${t.name})`);
      }
      if (!skipMetro) maybeEnterMetro(state, pi); // outer station -> inner ring
      break;
    }
    case 'tax':
      transfer(state, pi, -1, t.amount);
      addToPot(state, t.amount);
      glog(state, `${p.name} платит налог ${CUR}${t.amount}`);
      break;
    case 'bonus':
      // inner-ring money-only tile: pure gain, never moves the player
      p.money += t.amount;
      glog(state, `${p.name} получает бонус ${CUR}${t.amount} 🎁`);
      break;
    case 'chance': drawCard(state, pi, 'chance', diceSum); break;
    case 'chest': drawCard(state, pi, 'chest', diceSum); break;
    case 'gotojail': sendToJail(state, pi); break;
    case 'free':
      if (state.settings && state.settings.freeParkingPot && state.parkingPot > 0) {
        p.money += state.parkingPot;
        glog(state, `${p.name} забирает банк стоянки ${CUR}${state.parkingPot} 🅿️`);
        state.parkingPot = 0;
      }
      break;
    default: break;
  }
}

// Add money to the Free Parking pot (only when that rule is on).
function addToPot(state, amount) {
  if (state.settings && state.settings.freeParkingPot && amount > 0) {
    state.parkingPot += amount;
  }
}

function drawCard(state, pi, deck, diceSum) {
  const cards = deck === 'chance' ? CHANCE_CARDS : CHEST_CARDS;
  const order = deck === 'chance' ? state.chanceDeck : state.chestDeck;
  const key = deck === 'chance' ? 'chanceIdx' : 'chestIdx';
  const card = cards[order[state[key] % order.length]];
  state[key]++;
  const p = state.players[pi];
  state.pendingCard = { deck: deck === 'chance' ? 'ШАНС' : 'ОБЩЕСТВЕННАЯ КАЗНА', text: card.text, player: p.name };
  // card event goes BEFORE any moves the card causes, so clients show the
  // card between "landed on Chance" and "flew to the new tile"
  pushEv(state, { kind: 'card', deck: state.pendingCard.deck, text: card.text, player: p.name });
  glog(state, `${p.name} тянет карту: «${card.text}»`);
  switch (card.act) {
    case 'money': p.money += card.v; if (card.v < 0) addToPot(state, -card.v); break;
    case 'moveTo': moveTo(state, pi, card.v); landOn(state, pi, diceSum); break;
    case 'back3': movePlayer(state, pi, -3); landOn(state, pi, diceSum); break;
    case 'jail': sendToJail(state, pi); break;
    case 'jailcard': p.jailCards++; break;
    case 'payEach':
      state.players.forEach((q, qi) => {
        if (qi !== pi && !q.bankrupt) { p.money -= card.v; q.money += card.v; }
      });
      break;
    case 'collectEach':
      state.players.forEach((q, qi) => {
        if (qi !== pi && !q.bankrupt) { q.money -= card.v; p.money += card.v; }
      });
      break;
    case 'repairs': {
      let cost = 0;
      Object.entries(state.props).forEach(([ti, ps]) => {
        if (ps.owner === pi) cost += ps.houses === 5 ? card.ho : ps.houses * card.h;
      });
      p.money -= cost;
      addToPot(state, cost);
      if (cost) glog(state, `${p.name} платит за ремонт ${CUR}${cost}`);
      break;
    }
    case 'nearRail': {
      const rails = [5, 15, 25, 35];
      const target = rails.find(r => r > p.pos) ?? rails[0];
      moveTo(state, pi, target);
      landOn(state, pi, diceSum, 2);
      break;
    }
    case 'nearUtil': {
      const utils = [12, 28];
      const target = utils.find(u => u > p.pos) ?? utils[0];
      moveTo(state, pi, target);
      const ps = state.props[target];
      if (ps.owner !== -1 && ps.owner !== pi && !ps.mortgaged) {
        const rent = diceSum * 10;
        transfer(state, pi, ps.owner, rent);
        glog(state, `${p.name} платит ${CUR}${rent} → ${pName(state, ps.owner)}`);
      } else if (ps.owner === -1) {
        state.pendingBuy = target;
      }
      break;
    }
  }
}

// ===== Action handler: (state, playerIdx, action) -> mutates state =====
function applyAction(state, pi, a) {
  const p = state.players[pi];
  if (state.winner !== null) return;
  if (p.bankrupt) return;
  bumpV(state);
  const isTurn = state.turn === pi;

  switch (a.type) {
    case 'roll': {
      if (!isTurn || state.rolled || state.pendingBuy !== null || state.auction) return;
      const d1 = 1 + Math.floor(Math.random() * 6), d2 = 1 + Math.floor(Math.random() * 6);
      const useSpeed = !!(state.settings && state.settings.speedDie) && !p.inJail;
      const d3 = useSpeed ? 1 + Math.floor(Math.random() * 6) : 0;
      const diceArr = useSpeed ? [d1, d2, d3] : [d1, d2];
      const steps = d1 + d2 + d3;
      state.dice = diceArr;
      pushEv(state, { kind: 'dice', d: diceArr, pi });
      const isDouble = d1 === d2;
      if (p.inJail) {
        p.jailTurns++;
        if (isDouble) {
          p.inJail = false;
          glog(state, `${p.name} выбрасывает дубль ${d1}:${d2} и выходит из тюрьмы!`);
          state.rolled = true;
          movePlayer(state, pi, steps);
          landOn(state, pi, steps);
        } else if (p.jailTurns >= 3) {
          p.money -= 50;
          addToPot(state, 50);
          p.inJail = false;
          glog(state, `${p.name} платит ${CUR}50 и выходит из тюрьмы`);
          state.rolled = true;
          movePlayer(state, pi, steps);
          landOn(state, pi, steps);
        } else {
          glog(state, `${p.name} бросает ${d1}:${d2} — не дубль, остаётся в тюрьме`);
          state.rolled = true;
        }
        state.doubles = 0;
        return;
      }
      if (isDouble) {
        state.doubles++;
        if (state.doubles >= 3) {
          glog(state, `${p.name} выбрасывает 3-й дубль подряд!`);
          sendToJail(state, pi);
          state.rolled = true;
          return;
        }
      } else {
        state.doubles = 0;
        state.rolled = true;
      }
      glog(state, `${p.name} бросает ${d1}:${d2}${d3 ? `:${d3}🚀` : ''}${isDouble ? ' (дубль — ходит ещё раз)' : ''}`);
      movePlayer(state, pi, steps);
      landOn(state, pi, steps);
      if (p.inJail) { state.rolled = true; state.doubles = 0; }
      break;
    }
    case 'buy': {
      if (state.pendingBuy === null || !isTurn) return;
      const idx = state.pendingBuy;
      const t = BOARD[idx];
      if (p.money < t.price) return;
      p.money -= t.price;
      state.props[idx].owner = pi;
      state.pendingBuy = null;
      if (state.stats) state.stats[pi].bought++;
      glog(state, `${p.name} покупает ${t.name} за ${CUR}${t.price} 🏠`);
      maybeEnterMetro(state, pi);
      break;
    }
    case 'declineBuy': {
      if (state.pendingBuy === null || !isTurn) return;
      const idx = state.pendingBuy;
      glog(state, `${p.name} отказывается от покупки ${BOARD[idx].name}`);
      state.pendingBuy = null;
      if (state.settings && state.settings.auction) startAuction(state, idx);
      else maybeEnterMetro(state, pi);
      break;
    }
    case 'bid': {
      const au = state.auction;
      if (!au || p.bankrupt) return;
      const amt = Math.floor(a.amount || 0);
      if (amt <= au.high || amt > p.money) return;
      au.high = amt; au.bidder = pi;
      au.passed = au.passed.filter(x => x !== pi);
      glog(state, `${p.name} ставит ${CUR}${amt} за ${BOARD[au.tile].name}`);
      resolveAuction(state);
      break;
    }
    case 'passBid': {
      const au = state.auction;
      if (!au || p.bankrupt) return;
      if (!au.passed.includes(pi)) au.passed.push(pi);
      glog(state, `${p.name} пасует на аукционе`);
      resolveAuction(state);
      break;
    }
    case 'payJail': {
      if (!isTurn || !p.inJail || state.rolled || p.money < 50) return;
      p.money -= 50; addToPot(state, 50); p.inJail = false; p.jailTurns = 0;
      glog(state, `${p.name} платит ${CUR}50 и выходит из тюрьмы`);
      break;
    }
    case 'useJailCard': {
      if (!isTurn || !p.inJail || state.rolled || p.jailCards < 1) return;
      p.jailCards--; p.inJail = false; p.jailTurns = 0;
      glog(state, `${p.name} использует карту «Освобождение из тюрьмы»`);
      break;
    }
    case 'build': {
      const idx = a.tile, t = BOARD[idx], ps = state.props[idx];
      if (!t || t.type !== 'prop' || ps.owner !== pi || ps.mortgaged || ps.houses >= 5) return;
      const g = countGroup(state, t.group, pi);
      if (!g.monopoly) return;
      // even-build rule + no mortgaged tiles in group
      const groupTiles = BOARD.map((tt, i) => ({ tt, i })).filter(x => x.tt.type === 'prop' && x.tt.group === t.group);
      if (groupTiles.some(x => state.props[x.i].mortgaged)) return;
      const minH = Math.min(...groupTiles.map(x => state.props[x.i].houses));
      if (ps.houses > minH) return;
      if (p.money < t.house) return;
      p.money -= t.house;
      ps.houses++;
      glog(state, `${p.name} строит ${ps.houses === 5 ? 'отель 🏨' : 'дом 🏡'} на ${t.name}`);
      break;
    }
    case 'sellHouse': {
      const idx = a.tile, t = BOARD[idx], ps = state.props[idx];
      if (!t || t.type !== 'prop' || ps.owner !== pi || ps.houses < 1) return;
      const groupTiles = BOARD.map((tt, i) => ({ tt, i })).filter(x => x.tt.type === 'prop' && x.tt.group === t.group);
      const maxH = Math.max(...groupTiles.map(x => state.props[x.i].houses));
      if (ps.houses < maxH) return;
      ps.houses--;
      p.money += Math.floor(t.house / 2);
      glog(state, `${p.name} продаёт постройку на ${t.name} за ${CUR}${Math.floor(t.house / 2)}`);
      break;
    }
    case 'mortgage': {
      const idx = a.tile, t = BOARD[idx], ps = state.props[idx];
      if (!t || !ps || ps.owner !== pi || ps.mortgaged || ps.houses > 0) return;
      ps.mortgaged = true;
      p.money += Math.floor(t.price / 2);
      glog(state, `${p.name} закладывает ${t.name} за ${CUR}${Math.floor(t.price / 2)}`);
      break;
    }
    case 'redeem': {
      const idx = a.tile, t = BOARD[idx], ps = state.props[idx];
      if (!t || !ps || ps.owner !== pi || !ps.mortgaged) return;
      const cost = Math.ceil(t.price / 2 * 1.1);
      if (p.money < cost) return;
      p.money -= cost;
      ps.mortgaged = false;
      glog(state, `${p.name} выкупает ${t.name} за ${CUR}${cost}`);
      break;
    }
    case 'proposeTrade': {
      if (state.trade) return;
      const to = a.to;
      if (to === pi || !state.players[to] || state.players[to].bankrupt) return;
      const valid = (props, owner) => props.every(i => state.props[i] && state.props[i].owner === owner && state.props[i].houses === 0);
      if (!valid(a.giveProps || [], pi) || !valid(a.getProps || [], to)) return;
      if ((a.giveMoney || 0) > p.money || (a.getMoney || 0) > state.players[to].money) return;
      state.trade = {
        from: pi, to,
        giveMoney: Math.max(0, a.giveMoney || 0), getMoney: Math.max(0, a.getMoney || 0),
        giveProps: a.giveProps || [], getProps: a.getProps || [],
      };
      glog(state, `${p.name} предлагает обмен → ${pName(state, to)}`);
      break;
    }
    case 'acceptTrade': {
      const tr = state.trade;
      if (!tr || tr.to !== pi) return;
      const from = state.players[tr.from], to = state.players[tr.to];
      if (tr.giveMoney > from.money || tr.getMoney > to.money) { state.trade = null; return; }
      from.money -= tr.giveMoney; to.money += tr.giveMoney;
      to.money -= tr.getMoney; from.money += tr.getMoney;
      tr.giveProps.forEach(i => state.props[i].owner = tr.to);
      tr.getProps.forEach(i => state.props[i].owner = tr.from);
      glog(state, `🤝 Обмен между ${from.name} и ${to.name} состоялся!`);
      state.trade = null;
      break;
    }
    case 'declineTrade': {
      const tr = state.trade;
      if (!tr || (tr.to !== pi && tr.from !== pi)) return;
      glog(state, `Обмен отклонён`);
      state.trade = null;
      break;
    }
    case 'dismissCard': {
      state.pendingCard = null;
      break;
    }
    case 'bankrupt': {
      if (p.money >= 0) return;
      p.bankrupt = true;
      Object.values(state.props).forEach(ps => {
        if (ps.owner === pi) { ps.owner = -1; ps.houses = 0; ps.mortgaged = false; }
      });
      glog(state, `💀 ${p.name} объявляет банкротство! Имущество возвращается банку.`);
      const alive = state.players.map((q, qi) => ({ q, qi })).filter(x => !x.q.bankrupt);
      if (alive.length === 1) {
        state.winner = alive[0].qi;
        glog(state, `🏆 ${alive[0].q.name} побеждает!`);
      } else if (isTurn) {
        advanceTurn(state);
      }
      break;
    }
    case 'endTurn': {
      if (!isTurn || !state.rolled || state.pendingBuy !== null || state.auction || p.money < 0) return;
      advanceTurn(state);
      break;
    }
  }
}

function advanceTurn(state) {
  state.rolled = false;
  state.dice = null;
  state.doubles = 0;
  state.pendingBuy = null;
  let next = state.turn;
  for (let k = 0; k < state.players.length; k++) {
    next = (next + 1) % state.players.length;
    if (!state.players[next].bankrupt) break;
  }
  state.turn = next;
  const tt = state.settings && state.settings.turnTimer;
  state.turnDeadline = tt > 0 ? Date.now() + tt * 1000 : 0;
  glog(state, `▶ Ход игрока ${pName(state, next)}`);
}

// Auto-resolve a stalled turn when the timer runs out (host-driven).
// Does the minimum sensible thing so the game keeps moving: roll if needed,
// decline pending buys, then end the turn.
function autoTurn(state) {
  if (state.winner !== null) return false;
  const pi = state.turn;
  const p = state.players[pi];
  if (!p || p.bankrupt) { advanceTurn(state); return true; }
  bumpV(state);
  if (state.auction) { applyAction(state, pi, { type: 'passBid' }); return true; }
  if (state.pendingCard) { state.pendingCard = null; }
  if (state.pendingBuy !== null) { applyAction(state, pi, { type: 'declineBuy' }); }
  if (!state.rolled && !p.inJail) { applyAction(state, pi, { type: 'roll' }); }
  if (p.inJail && !state.rolled) { applyAction(state, pi, { type: 'roll' }); }
  if (state.pendingBuy !== null) { applyAction(state, pi, { type: 'declineBuy' }); }
  if (state.rolled && state.pendingBuy === null && !state.auction && p.money >= 0) {
    advanceTurn(state);
  }
  glog(state, `⏱ Время вышло — ход ${p.name} завершён автоматически`);
  return true;
}
