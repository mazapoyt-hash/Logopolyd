// ===== Bot AI =====
// Bots are regular players whose peerId starts with "bot:". The host runs a
// loop (startBotLoop in net.js) that asks botDecide() for one action per tick,
// so moves stay nicely paced with the animations.

const BOT_ROSTER = [
  { name: 'Бот Макс', emoji: '🤖' },
  { name: 'Бот Лола', emoji: '🎩' },
  { name: 'Бот Жора', emoji: '🎲' },
  { name: 'Бот Юна', emoji: '💼' },
  { name: 'Бот Дан', emoji: '🚀' },
];

function isBot(player) { return player && String(player.peerId).startsWith('bot:'); }

// How much cash the bot tries to keep in reserve for upcoming rents.
function botReserve(state) {
  const houses = Object.values(state.props).filter(ps => ps.houses > 0).length;
  return 100 + houses * 30;
}

// Rough value of a tile for trade/auction decisions.
function tileValue(state, idx) {
  const t = TILES[idx];
  if (!t || !t.price) return 0;
  let v = t.price;
  // tiles that complete (or block) a color group are worth more
  if (t.type === 'prop') {
    const ps = state.props[idx];
    const owner = ps.owner;
    const g = countGroup(state, t.group, owner >= 0 ? owner : -99);
    if (g.owned >= g.total - 1) v *= 1.5;
  }
  return v;
}

// Decide ONE action for the bot at index pi, or null if nothing to do.
function botDecide(state, pi) {
  const p = state.players[pi];
  if (!p || p.bankrupt || state.winner !== null) return null;

  // ---- money emergency: raise cash or fold ----
  if (p.money < 0) {
    // sell houses first (highest house count first)
    const withHouses = Object.entries(state.props)
      .filter(([, ps]) => ps.owner === pi && ps.houses > 0)
      .sort((a, b) => b[1].houses - a[1].houses);
    if (withHouses.length) return { type: 'sellHouse', tile: Number(withHouses[0][0]) };
    const toMortgage = Object.entries(state.props)
      .filter(([i, ps]) => ps.owner === pi && !ps.mortgaged && ps.houses === 0)
      .sort((a, b) => (TILES[a[0]].price || 0) - (TILES[b[0]].price || 0));
    if (toMortgage.length) return { type: 'mortgage', tile: Number(toMortgage[0][0]) };
    return { type: 'bankrupt' };
  }

  // ---- respond to a trade offered to the bot ----
  if (state.trade && state.trade.to === pi) {
    const tr = state.trade;
    const gets = tr.giveMoney + tr.giveProps.reduce((s, i) => s + tileValue(state, i), 0);
    const gives = tr.getMoney + tr.getProps.reduce((s, i) => s + tileValue(state, i), 0);
    return gets >= gives * 1.1 ? { type: 'acceptTrade' } : { type: 'declineTrade' };
  }

  // ---- auction bidding (any bot may act, not only on its turn) ----
  if (state.auction) {
    const au = state.auction;
    if (au.passed.includes(pi) || au.bidder === pi) return null;
    const cap = Math.min(Math.floor(tileValue(state, au.tile) * 0.8), p.money - botReserve(state));
    const step = au.high < 50 ? 10 : au.high < 200 ? 25 : 50;
    const next = au.high + step;
    if (next <= cap) return { type: 'bid', amount: next };
    return { type: 'passBid' };
  }

  if (state.turn !== pi) return null;

  // ---- card shown: acknowledge ----
  if (state.pendingCard) return { type: 'dismissCard' };

  // ---- metro choice: jump towards an unowned station ----
  if (state.pendingMetro) {
    const destOwner = state.props[state.pendingMetro.to]?.owner;
    return (destOwner === -1 || destOwner === pi)
      ? { type: 'metroJump' } : { type: 'metroStay' };
  }

  // ---- buy decision ----
  if (state.pendingBuy !== null) {
    const t = TILES[state.pendingBuy];
    const wantIt = p.money - t.price >= botReserve(state);
    return wantIt ? { type: 'buy' } : { type: 'declineBuy' };
  }

  // ---- jail ----
  if (p.inJail && !state.rolled) {
    if (p.jailCards > 0) return { type: 'useJailCard' };
    if (p.money > 250) return { type: 'payJail' };
    return { type: 'roll' };
  }

  // ---- roll ----
  if (!state.rolled) return { type: 'roll' };

  // ---- after rolling: build one house if it makes sense ----
  const buildable = [];
  TILES.forEach((t, i) => {
    if (t.type !== 'prop') return;
    const ps = state.props[i];
    if (ps.owner !== pi || ps.mortgaged || ps.houses >= 5) return;
    const g = countGroup(state, t.group, pi);
    if (!g.monopoly) return;
    const groupTiles = TILES.map((tt, j) => ({ tt, j })).filter(x => x.tt.type === 'prop' && x.tt.group === t.group);
    if (groupTiles.some(x => state.props[x.j].mortgaged)) return;
    const minH = Math.min(...groupTiles.map(x => state.props[x.j].houses));
    if (ps.houses > minH) return;
    if (p.money - t.house >= botReserve(state) + 100) buildable.push(i);
  });
  if (buildable.length) return { type: 'build', tile: buildable[0] };

  // ---- redeem mortgaged tiles when flush ----
  const mortgaged = Object.entries(state.props)
    .filter(([i, ps]) => ps.owner === pi && ps.mortgaged);
  for (const [i] of mortgaged) {
    const cost = Math.ceil(TILES[i].price / 2 * 1.1);
    if (p.money - cost >= botReserve(state) + 150) return { type: 'redeem', tile: Number(i) };
  }

  // ---- done ----
  return { type: 'endTurn' };
}
