// ===== Networking: PeerJS, host-authoritative =====
// Host runs the game engine; clients send actions, host broadcasts state.

const NET = {
  peer: null,
  isHost: false,
  hostConn: null,       // client -> host connection
  conns: {},            // host: peerId -> conn
  myPeerId: null,
  roomCode: null,
  lobbyPlayers: [],     // [{peerId, name}]
  state: null,
  myName: '',
  onUpdate: () => {},   // UI re-render hook
  onChat: () => {},
};

function makeRoomCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function peerIdForRoom(code) { return 'vk-monopoly-' + code.toLowerCase(); }

function myPlayerIndex() {
  if (!NET.state) return -1;
  return NET.state.players.findIndex(p => p.peerId === NET.myPeerId);
}

// ---------- HOST ----------
function hostGame(name, cb) {
  NET.isHost = true;
  NET.myName = name;
  NET.roomCode = makeRoomCode();
  const peer = new Peer(peerIdForRoom(NET.roomCode), { debug: 1 });
  NET.peer = peer;
  peer.on('open', id => {
    NET.myPeerId = id;
    NET.lobbyPlayers = [{ peerId: id, name }];
    cb(null, NET.roomCode);
    NET.onUpdate();
  });
  peer.on('connection', conn => {
    conn.on('open', () => { NET.conns[conn.peer] = conn; });
    conn.on('data', data => hostOnData(conn, data));
    conn.on('close', () => hostDropPeer(conn.peer));
    conn.on('error', () => hostDropPeer(conn.peer));
  });
  peer.on('error', err => {
    if (err.type === 'unavailable-id') { // rare code collision — retry
      NET.roomCode = makeRoomCode();
      hostGame(name, cb);
    } else cb(err);
  });
}

function hostDropPeer(peerId) {
  delete NET.conns[peerId];
  if (!NET.state) {
    NET.lobbyPlayers = NET.lobbyPlayers.filter(p => p.peerId !== peerId);
    hostBroadcast({ type: 'lobby', players: NET.lobbyPlayers, roomCode: NET.roomCode });
  } else {
    const pi = NET.state.players.findIndex(p => p.peerId === peerId);
    if (pi >= 0 && !NET.state.players[pi].bankrupt) {
      glog(NET.state, `⚠ ${NET.state.players[pi].name} отключился`);
      hostBroadcast({ type: 'state', state: NET.state });
    }
  }
  NET.onUpdate();
}

function hostOnData(conn, data) {
  if (data.type === 'join') {
    if (NET.state) { conn.send({ type: 'errmsg', text: 'Игра уже началась' }); return; }
    if (NET.lobbyPlayers.length >= 6) { conn.send({ type: 'errmsg', text: 'Комната заполнена (макс. 6)' }); return; }
    NET.lobbyPlayers.push({ peerId: conn.peer, name: String(data.name).slice(0, 14) || 'Игрок' });
    hostBroadcast({ type: 'lobby', players: NET.lobbyPlayers, roomCode: NET.roomCode });
    NET.onUpdate();
  } else if (data.type === 'action' && NET.state) {
    const pi = NET.state.players.findIndex(p => p.peerId === conn.peer);
    if (pi >= 0) {
      applyAction(NET.state, pi, data.action);
      hostBroadcast({ type: 'state', state: NET.state });
      NET.onUpdate();
    }
  } else if (data.type === 'chat') {
    const msg = { name: String(data.name).slice(0, 14), text: String(data.text).slice(0, 300) };
    hostBroadcast({ type: 'chat', ...msg });
    NET.onChat(msg);
  }
}

function hostBroadcast(msg) {
  Object.values(NET.conns).forEach(c => { try { c.send(msg); } catch (e) {} });
}

function hostStartGame() {
  NET.state = newGameState(NET.lobbyPlayers);
  glog(NET.state, `🎲 Игра началась! Ходит ${NET.state.players[0].name}`);
  hostBroadcast({ type: 'state', state: NET.state });
  NET.onUpdate();
}

// ---------- CLIENT ----------
function joinGame(name, code, cb) {
  NET.isHost = false;
  NET.myName = name;
  NET.roomCode = code.toUpperCase().trim();
  const peer = new Peer({ debug: 1 });
  NET.peer = peer;
  let opened = false;
  peer.on('open', id => {
    NET.myPeerId = id;
    const conn = peer.connect(peerIdForRoom(NET.roomCode), { reliable: true });
    NET.hostConn = conn;
    const timer = setTimeout(() => { if (!opened) cb(new Error('Не удалось подключиться. Проверь код комнаты.')); }, 12000);
    conn.on('open', () => {
      opened = true; clearTimeout(timer);
      conn.send({ type: 'join', name });
      cb(null);
    });
    conn.on('data', data => {
      if (data.type === 'lobby') { NET.lobbyPlayers = data.players; NET.onUpdate(); }
      else if (data.type === 'state') { NET.state = data.state; NET.onUpdate(); }
      else if (data.type === 'chat') { NET.onChat(data); }
      else if (data.type === 'errmsg') { alert(data.text); }
    });
    conn.on('close', () => { alert('Соединение с хостом потеряно'); location.reload(); });
  });
  peer.on('error', err => {
    if (err.type === 'peer-unavailable') cb(new Error('Комната не найдена. Проверь код.'));
  });
}

// ---------- Actions & chat (both sides) ----------
function sendAction(action) {
  if (NET.isHost) {
    const pi = myPlayerIndex();
    if (pi >= 0 && NET.state) {
      applyAction(NET.state, pi, action);
      hostBroadcast({ type: 'state', state: NET.state });
      NET.onUpdate();
    }
  } else if (NET.hostConn) {
    NET.hostConn.send({ type: 'action', action });
  }
}

function sendChat(text) {
  const msg = { name: NET.myName, text };
  if (NET.isHost) {
    hostBroadcast({ type: 'chat', ...msg });
    NET.onChat(msg);
  } else if (NET.hostConn) {
    NET.hostConn.send({ type: 'chat', ...msg });
  }
}
