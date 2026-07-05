// ===== Networking: MQTT over WebSockets (public brokers), host-authoritative =====
// Host runs the game engine; clients send actions, host broadcasts state.
// Works in any network (mobile, strict NAT, corporate Wi-Fi) — no P2P needed.

const NET = {
  client: null,         // mqtt.js client
  isHost: false,
  myPeerId: null,       // random session id
  roomCode: null,
  lobbyPlayers: [],     // [{peerId, name}]
  state: null,
  myName: '',
  joined: false,        // client: got first lobby snapshot
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

function pub(topic, obj) {
  if (NET.client) NET.client.publish(topic, JSON.stringify(obj));
}

// ---------- HOST ----------
function hostGame(name, cb, brokerIdx = 0) {
  if (brokerIdx >= BROKERS.length) { cb(new Error('Не удалось подключиться к серверу. Проверь интернет.')); return; }
  const broker = BROKERS[brokerIdx];
  NET.isHost = true;
  NET.myName = name;
  NET.myPeerId = randId();
  NET.roomCode = makeRoomCode(broker.key);
  const code = NET.roomCode;

  const will = { topic: topicAll(code), payload: JSON.stringify({ type: 'hostleave' }), qos: 0, retain: false };
  mqttConnect(broker.url, will, (err, client) => {
    if (err) { hostGame(name, cb, brokerIdx + 1); return; }
    NET.client = client;
    client.subscribe(topicHost(code));
    client.on('message', (topic, raw) => {
      let data; try { data = JSON.parse(raw.toString()); } catch (e) { return; }
      hostOnData(data);
    });
    NET.lobbyPlayers = [{ peerId: NET.myPeerId, name }];
    cb(null, code);
    NET.onUpdate();
  });
}

function hostDropPeer(peerId) {
  if (!NET.state) {
    if (!NET.lobbyPlayers.some(p => p.peerId === peerId)) return;
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

function hostOnData(data) {
  if (data.type === 'join') {
    if (NET.lobbyPlayers.some(p => p.peerId === data.from)) return; // duplicate join
    if (NET.state) { hostBroadcast({ type: 'errmsg', to: data.from, text: 'Игра уже началась' }); return; }
    if (NET.lobbyPlayers.length >= 6) { hostBroadcast({ type: 'errmsg', to: data.from, text: 'Комната заполнена (макс. 6)' }); return; }
    NET.lobbyPlayers.push({ peerId: data.from, name: String(data.name).slice(0, 14) || 'Игрок' });
    hostBroadcast({ type: 'lobby', players: NET.lobbyPlayers, roomCode: NET.roomCode });
    NET.onUpdate();
  } else if (data.type === 'leave') {
    hostDropPeer(data.from);
  } else if (data.type === 'ping') {
    // client checks room existence before showing "not found"
    hostBroadcast({ type: 'lobby', players: NET.lobbyPlayers, roomCode: NET.roomCode });
    if (NET.state) hostBroadcast({ type: 'state', state: NET.state });
  } else if (data.type === 'action' && NET.state) {
    const pi = NET.state.players.findIndex(p => p.peerId === data.from);
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
  pub(topicAll(NET.roomCode), msg);
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
  NET.myPeerId = randId();
  NET.roomCode = code.toUpperCase().replace(/\s+/g, '');
  const rc = NET.roomCode;
  const broker = BROKERS.find(b => b.key === rc[rc.length - 1]) || BROKERS[0];

  let done = false;
  const finish = err => { if (!done) { done = true; cb(err || null); } };

  const will = { topic: topicHost(rc), payload: JSON.stringify({ type: 'leave', from: NET.myPeerId }), qos: 0, retain: false };
  mqttConnect(broker.url, will, (err, client) => {
    if (err) { finish(new Error('Нет связи с сервером. Проверь интернет и попробуй ещё раз.')); return; }
    NET.client = client;
    client.subscribe(topicAll(rc), () => {
      pub(topicHost(rc), { type: 'join', name, from: NET.myPeerId });
    });

    const timer = setTimeout(() => {
      if (!NET.joined) {
        client.end(true);
        finish(new Error('Комната не найдена. Проверь код и что вкладка создателя комнаты открыта.'));
      }
    }, 10000);

    client.on('message', (topic, raw) => {
      let data; try { data = JSON.parse(raw.toString()); } catch (e) { return; }
      if (data.type === 'lobby') {
        NET.lobbyPlayers = data.players;
        if (data.players.some(p => p.peerId === NET.myPeerId)) {
          if (!NET.joined) { NET.joined = true; clearTimeout(timer); finish(null); }
        }
        NET.onUpdate();
      } else if (data.type === 'state') {
        if (data.state.players.some(p => p.peerId === NET.myPeerId) && !NET.joined) {
          NET.joined = true; clearTimeout(timer); finish(null);
        }
        if (NET.joined) { NET.state = data.state; NET.onUpdate(); }
      } else if (data.type === 'chat') {
        if (NET.joined) NET.onChat(data);
      } else if (data.type === 'errmsg') {
        if (data.to === NET.myPeerId) {
          clearTimeout(timer);
          if (!NET.joined) finish(new Error(data.text)); else alert(data.text);
        }
      } else if (data.type === 'hostleave') {
        if (NET.joined) { alert('Создатель комнаты вышел — игра остановлена'); location.reload(); }
      }
    });
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
  } else if (NET.client) {
    pub(topicHost(NET.roomCode), { type: 'action', action, from: NET.myPeerId });
  }
}

function sendChat(text) {
  const msg = { name: NET.myName, text };
  if (NET.isHost) {
    hostBroadcast({ type: 'chat', ...msg });
    NET.onChat(msg);
  } else if (NET.client) {
    pub(topicHost(NET.roomCode), { type: 'chat', ...msg });
  }
}
