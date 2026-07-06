// ===== Networking: MQTT over WebSockets (public brokers), host-authoritative =====
// Host runs the game engine; clients send actions, host broadcasts state.
// Reliability: stateV versioning + QoS 1 + host heartbeat re-broadcast, so a
// lost publish can never leave a client stuck on stale state.
// Reconnect: session saved in localStorage; both host and clients survive a
// page refresh (host restores full game state, clients rejoin by peerId).

const NET = {
  client: null,         // mqtt.js client
  isHost: false,
  myPeerId: null,       // random session id (stable across refreshes via session)
  roomCode: null,
  lobbyPlayers: [],     // [{peerId, name}]
  state: null,
  myName: '',
  myPhoto: '',          // Telegram avatar url (optional)
  settings: null,       // host-chosen game settings (applied at start)
  joined: false,        // client: got first lobby snapshot
  hostAway: false,      // client: host disconnected, waiting for it to return
  lastHostMsg: 0,       // client: timestamp of last message from host
  onUpdate: () => {},   // UI re-render hook
  onChat: () => {},
};

// Broker list. The LAST character of the room code encodes which broker the
// host is on, so all players always meet on the same broker.
const BROKERS = [
  { key: 'X', url: 'wss://broker.emqx.io:8084/mqtt' },
  { key: 'H', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { key: 'M', url: 'wss://test.mosquitto.org:8081' },
];

const SES_KEY = 'mono-session';
const STATE_KEY = 'mono-state';
const HEARTBEAT_MS = 2500;
const CLIENT_STALE_MS = 6000;

function makeRoomCode(brokerKey) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s + brokerKey;
}

function randId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function topicHost(code) { return 'vkmono/' + code + '/host'; }
function topicAll(code) { return 'vkmono/' + code + '/all'; }

function myPlayerIndex() {
  if (!NET.state) return -1;
  return NET.state.players.findIndex(p => p.peerId === NET.myPeerId);
}

// ---------- Session persistence ----------
function saveSession() {
  try {
    localStorage.setItem(SES_KEY, JSON.stringify({
      roomCode: NET.roomCode, peerId: NET.myPeerId, name: NET.myName, isHost: NET.isHost, photo: NET.myPhoto,
      solo: !!NET.solo,
    }));
  } catch (e) { /* private mode */ }
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SES_KEY) || 'null'); } catch (e) { return null; }
}

function clearSession() {
  try { localStorage.removeItem(SES_KEY); localStorage.removeItem(STATE_KEY); } catch (e) {}
}

function saveHostState() {
  if (!NET.isHost) return;
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      state: NET.state, lobbyPlayers: NET.lobbyPlayers, roomCode: NET.roomCode,
    }));
  } catch (e) {}
}

function loadHostState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); } catch (e) { return null; }
}

function mqttConnect(url, will, cb) {
  const client = mqtt.connect(url, {
    clientId: 'vk_' + randId(),
    keepalive: 20,
    reconnectPeriod: 2000,
    connectTimeout: 10000,
    will,
  });
  let done = false;
  client.on('connect', () => { if (!done) { done = true; cb(null, client); } });
  client.on('error', err => { if (!done) { done = true; client.end(true); cb(err); } });
  return client;
}

function pub(topic, obj, qos = 0) {
  if (NET.client) NET.client.publish(topic, JSON.stringify(obj), { qos });
}

// ---------- HOST ----------
function hostBroadcastState() {
  hostBroadcast({ type: 'state', state: NET.state }, 1);
  saveHostState();
}

let heartbeatTimer = null;
function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!NET.isHost || !NET.client) return;
    // turn timer: if the active player's deadline passed, auto-resolve the turn
    if (NET.state && NET.state.turnDeadline && NET.state.winner === null
        && Date.now() > NET.state.turnDeadline) {
      autoTurn(NET.state);
      hostBroadcastState();
      NET.onUpdate();
      return;
    }
    if (NET.state) hostBroadcast({ type: 'state', state: NET.state }, 0);
    else hostBroadcast({ type: 'lobby', players: NET.lobbyPlayers, roomCode: NET.roomCode }, 0);
  }, HEARTBEAT_MS);
}
function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

function hostGame(name, cb, brokerIdx = 0) {
  if (brokerIdx >= BROKERS.length) { cb(new Error('Не удалось подключиться к серверу. Проверь интернет.')); return; }
  const broker = BROKERS[brokerIdx];
  NET.isHost = true;
  NET.myName = name;
  NET.myPeerId = randId();
  NET.roomCode = makeRoomCode(broker.key);
  const code = NET.roomCode;

  const will = { topic: topicAll(code), payload: JSON.stringify({ type: 'hostleave' }), qos: 1, retain: false };
  mqttConnect(broker.url, will, (err, client) => {
    if (err) { hostGame(name, cb, brokerIdx + 1); return; }
    NET.client = client;
    client.subscribe(topicHost(code), { qos: 1 });
    client.on('message', (topic, raw) => {
      let data; try { data = JSON.parse(raw.toString()); } catch (e) { return; }
      hostOnData(data);
    });
    NET.lobbyPlayers = [{ peerId: NET.myPeerId, name, photo: NET.myPhoto || '' }];
    saveSession();
    startHeartbeat();
    cb(null, code);
    NET.onUpdate();
  });
}

// Host page refreshed mid-game: reconnect to same broker/room, restore state.
function hostResume(session, cb) {
  const saved = loadHostState();
  if (!saved || saved.roomCode !== session.roomCode) { clearSession(); cb(new Error('no saved state')); return; }
  const rc = session.roomCode;
  const broker = BROKERS.find(b => b.key === rc[rc.length - 1]) || BROKERS[0];
  NET.isHost = true;
  NET.myName = session.name;
  NET.myPeerId = session.peerId;
  NET.roomCode = rc;

  const will = { topic: topicAll(rc), payload: JSON.stringify({ type: 'hostleave' }), qos: 1, retain: false };
  mqttConnect(broker.url, will, (err, client) => {
    if (err) { cb(err); return; }
    NET.client = client;
    client.subscribe(topicHost(rc), { qos: 1 });
    client.on('message', (topic, raw) => {
      let data; try { data = JSON.parse(raw.toString()); } catch (e) { return; }
      hostOnData(data);
    });
    NET.state = saved.state;
    NET.lobbyPlayers = saved.lobbyPlayers || [];
    if (NET.state) {
      glog(NET.state, 'Создатель комнаты вернулся в игру');
      NET.state.stateV = (NET.state.stateV || 0) + 1;
      hostBroadcastState();
    } else {
      hostBroadcast({ type: 'lobby', players: NET.lobbyPlayers, roomCode: rc }, 1);
    }
    startHeartbeat();
    cb(null, rc);
    NET.onUpdate();
  });
}

function hostDropPeer(peerId) {
  if (!NET.state) {
    if (!NET.lobbyPlayers.some(p => p.peerId === peerId)) return;
    NET.lobbyPlayers = NET.lobbyPlayers.filter(p => p.peerId !== peerId);
    hostBroadcast({ type: 'lobby', players: NET.lobbyPlayers, roomCode: NET.roomCode }, 1);
  } else {
    const pi = NET.state.players.findIndex(p => p.peerId === peerId);
    if (pi >= 0 && !NET.state.players[pi].bankrupt) {
      glog(NET.state, `⚠ ${NET.state.players[pi].name} отключился`);
      bumpV(NET.state);
      hostBroadcastState();
    }
  }
  NET.onUpdate();
}

function hostOnData(data) {
  if (data.type === 'join') {
    if (NET.lobbyPlayers.some(p => p.peerId === data.from)) return; // duplicate join
    // game already running: allow rejoin if this peerId belongs to a player
    if (NET.state) {
      if (NET.state.players.some(p => p.peerId === data.from)) {
        glog(NET.state, `${NET.state.players.find(p => p.peerId === data.from).name} вернулся в игру`);
        bumpV(NET.state);
        hostBroadcastState();
        NET.onUpdate();
      } else {
        hostBroadcast({ type: 'errmsg', to: data.from, text: 'Игра уже началась' }, 1);
      }
      return;
    }
    if (NET.lobbyPlayers.length >= 6) { hostBroadcast({ type: 'errmsg', to: data.from, text: 'Комната заполнена (макс. 6)' }, 1); return; }
    NET.lobbyPlayers.push({ peerId: data.from, name: String(data.name).slice(0, 14) || 'Игрок', photo: (data.photo || '').slice(0, 512) });
    hostBroadcast({ type: 'lobby', players: NET.lobbyPlayers, roomCode: NET.roomCode }, 1);
    saveHostState();
    NET.onUpdate();
  } else if (data.type === 'leave') {
    hostDropPeer(data.from);
  } else if (data.type === 'ping') {
    // client checks room existence / requests fresh state
    hostBroadcast({ type: 'lobby', players: NET.lobbyPlayers, roomCode: NET.roomCode }, 1);
    if (NET.state) hostBroadcast({ type: 'state', state: NET.state }, 1);
  } else if (data.type === 'action' && NET.state) {
    const pi = NET.state.players.findIndex(p => p.peerId === data.from);
    if (pi >= 0) {
      applyAction(NET.state, pi, data.action);
      hostBroadcastState();
      NET.onUpdate();
    }
  } else if (data.type === 'chat') {
    const msg = { name: String(data.name).slice(0, 14), text: String(data.text).slice(0, 300) };
    hostBroadcast({ type: 'chat', ...msg }, 1);
    NET.onChat(msg);
  } else if (data.type === 'react' && NET.state) {
    const pi = NET.state.players.findIndex(p => p.peerId === data.from);
    if (pi >= 0 && typeof NET.onReact === 'function') {
      hostBroadcast({ type: 'react', pi, emoji: String(data.emoji).slice(0, 8) }, 0);
      NET.onReact(pi, data.emoji);
    }
  }
}

function hostBroadcast(msg, qos = 0) {
  pub(topicAll(NET.roomCode), msg, qos);
}

function hostStartGame() {
  NET.state = newGameState(NET.lobbyPlayers, NET.settings);
  glog(NET.state, `🎲 Игра началась! Ходит ${NET.state.players[0].name}`);
  hostBroadcastState();
  NET.onUpdate();
}

// ---------- SOLO (offline vs bots) ----------
// Same host code path, just no MQTT client: pub() silently no-ops.
let botTimer = null;

function startBotLoop() {
  stopBotLoop();
  botTimer = setInterval(() => {
    if (!NET.isHost || !NET.state || NET.state.winner !== null) return;
    const s = NET.state;
    // one bot action per tick keeps the pace watchable
    for (let i = 0; i < s.players.length; i++) {
      if (!isBot(s.players[i])) continue;
      const act = botDecide(s, i);
      if (act) {
        applyAction(s, i, act);
        hostBroadcastState();
        NET.onUpdate();
        return;
      }
    }
  }, 1800);
}
function stopBotLoop() {
  if (botTimer) { clearInterval(botTimer); botTimer = null; }
}

function soloGame(name, botCount) {
  NET.isHost = true;
  NET.solo = true;
  NET.myName = name;
  NET.myPeerId = randId();
  NET.roomCode = 'SOLO';
  const bots = BOT_ROSTER.slice(0, Math.max(1, Math.min(4, botCount))).map((b, i) => ({
    peerId: 'bot:' + i, name: `${b.emoji} ${b.name}`, photo: '',
  }));
  NET.lobbyPlayers = [{ peerId: NET.myPeerId, name, photo: NET.myPhoto || '' }, ...bots];
  saveSession();
  hostStartGame();
  startBotLoop();
}

// Resume a solo game after a page refresh (no network involved).
function soloResume(session, cb) {
  const saved = loadHostState();
  if (!saved || !saved.state) { clearSession(); cb(new Error('no saved solo state')); return; }
  NET.isHost = true;
  NET.solo = true;
  NET.myName = session.name;
  NET.myPeerId = session.peerId;
  NET.roomCode = 'SOLO';
  NET.state = saved.state;
  NET.lobbyPlayers = saved.lobbyPlayers || [];
  startBotLoop();
  cb(null);
  NET.onUpdate();
}

// ---------- CLIENT ----------
function clientApplyState(state) {
  // version gate: ignore stale or duplicate snapshots (heartbeat re-sends)
  if (NET.state && (state.stateV || 0) <= (NET.state.stateV || 0)) return;
  NET.state = state;
  NET.hostAway = false;
  NET.onUpdate();
}

let staleTimer = null;
function startStaleWatch() {
  if (staleTimer) clearInterval(staleTimer);
  staleTimer = setInterval(() => {
    if (NET.isHost || !NET.client || !NET.joined) return;
    if (Date.now() - NET.lastHostMsg > CLIENT_STALE_MS) {
      // no heartbeat for a while — poke the host for a fresh snapshot
      pub(topicHost(NET.roomCode), { type: 'ping', from: NET.myPeerId }, 1);
    }
  }, CLIENT_STALE_MS);
}

function joinGame(name, code, cb, resumePeerId = null) {
  NET.isHost = false;
  NET.myName = name;
  NET.myPeerId = resumePeerId || randId();
  NET.roomCode = code.toUpperCase().replace(/\s+/g, '');
  const rc = NET.roomCode;
  const broker = BROKERS.find(b => b.key === rc[rc.length - 1]) || BROKERS[0];

  let done = false;
  const finish = err => { if (!done) { done = true; cb(err || null); } };

  const will = { topic: topicHost(rc), payload: JSON.stringify({ type: 'leave', from: NET.myPeerId }), qos: 1, retain: false };
  mqttConnect(broker.url, will, (err, client) => {
    if (err) { finish(new Error('Нет связи с сервером. Проверь интернет и попробуй ещё раз.')); return; }
    NET.client = client;
    client.subscribe(topicAll(rc), { qos: 1 }, () => {
      pub(topicHost(rc), { type: 'join', name, from: NET.myPeerId, photo: NET.myPhoto || '' }, 1);
    });

    const timer = setTimeout(() => {
      if (!NET.joined) {
        client.end(true);
        finish(new Error('Комната не найдена. Проверь код и что вкладка создателя комнаты открыта.'));
      }
    }, 12000);

    client.on('message', (topic, raw) => {
      let data; try { data = JSON.parse(raw.toString()); } catch (e) { return; }
      NET.lastHostMsg = Date.now();
      if (data.type === 'lobby') {
        NET.lobbyPlayers = data.players;
        NET.hostAway = false;
        if (data.players.some(p => p.peerId === NET.myPeerId)) {
          if (!NET.joined) { NET.joined = true; clearTimeout(timer); saveSession(); startStaleWatch(); finish(null); }
        }
        NET.onUpdate();
      } else if (data.type === 'state') {
        if (data.state.players.some(p => p.peerId === NET.myPeerId) && !NET.joined) {
          NET.joined = true; clearTimeout(timer); saveSession(); startStaleWatch(); finish(null);
        }
        if (NET.joined) clientApplyState(data.state);
      } else if (data.type === 'chat') {
        if (NET.joined) NET.onChat(data);
      } else if (data.type === 'react') {
        if (NET.joined && typeof NET.onReact === 'function') NET.onReact(data.pi, data.emoji);
      } else if (data.type === 'errmsg') {
        if (data.to === NET.myPeerId) {
          clearTimeout(timer);
          if (!NET.joined) { clearSession(); finish(new Error(data.text)); } else alert(data.text);
        }
      } else if (data.type === 'hostleave') {
        // host may come back after a refresh — show waiting banner, don't kill the game
        if (NET.joined) { NET.hostAway = true; NET.onUpdate(); }
      }
    });
  });
}

// ---------- Auto-resume on page load ----------
// Returns true if a resume attempt is in progress (UI shows "reconnecting").
function tryResume(onDone) {
  const ses = loadSession();
  if (!ses || !ses.roomCode || !ses.peerId) return false;
  if (ses.photo) NET.myPhoto = ses.photo;
  if (ses.solo) {
    soloResume(ses, err => onDone(err, ses));
    return true;
  }
  if (ses.isHost) {
    hostResume(ses, err => onDone(err, ses));
  } else {
    joinGame(ses.name, ses.roomCode, err => {
      if (err) clearSession();
      onDone(err, ses);
    }, ses.peerId);
  }
  return true;
}

function leaveRoom() {
  clearSession();
  stopHeartbeat();
  if (NET.client) {
    if (NET.isHost) hostBroadcast({ type: 'hostleave' }, 1);
    else pub(topicHost(NET.roomCode), { type: 'leave', from: NET.myPeerId }, 1);
    NET.client.end(true);
  }
  location.reload();
}

// ---------- Actions & chat (both sides) ----------
function sendAction(action) {
  if (NET.isHost) {
    const pi = myPlayerIndex();
    if (pi >= 0 && NET.state) {
      applyAction(NET.state, pi, action);
      hostBroadcastState();
      NET.onUpdate();
    }
  } else if (NET.client) {
    pub(topicHost(NET.roomCode), { type: 'action', action, from: NET.myPeerId }, 1);
  }
}

function sendChat(text) {
  const msg = { name: NET.myName, text };
  if (NET.isHost) {
    hostBroadcast({ type: 'chat', ...msg }, 1);
    NET.onChat(msg);
  } else if (NET.client) {
    pub(topicHost(NET.roomCode), { type: 'chat', ...msg }, 1);
  }
}

// Quick emoji reaction floating above the sender's plaque.
function sendReaction(emoji) {
  if (NET.isHost) {
    const pi = myPlayerIndex();
    if (pi >= 0 && NET.state) {
      hostBroadcast({ type: 'react', pi, emoji }, 0);
      if (typeof NET.onReact === 'function') NET.onReact(pi, emoji);
    }
  } else if (NET.client) {
    pub(topicHost(NET.roomCode), { type: 'react', from: NET.myPeerId, emoji }, 0);
  }
}
