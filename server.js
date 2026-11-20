// Serveur multijoueur minimal : relaie les positions des joueurs et le chat.
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 8080;
const MAX_PLAYERS = 20;
const wss = new WebSocketServer({ port: PORT });
const players = new Map(); // id -> { id, name, x, y, z, f, lvl, ws }
let nextId = 1;

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function broadcast(obj, exceptId = null) {
  const msg = JSON.stringify(obj);
  for (const p of players.values()) {
    if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(msg);
  }
}

wss.on('connection', (ws) => {
  if (players.size >= MAX_PLAYERS) {
    ws.close(1013, 'serveur plein');
    return;
  }
  const id = nextId++;
  const p = { id, name: 'Chasseur', x: 0, y: 0, z: 0, f: 0, lvl: 1, ws };
  players.set(id, p);
  ws.send(JSON.stringify({ t: 'welcome', id }));

  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (m.t === 'hello') {
      p.name = clean(m.name, 16) || 'Chasseur';
      broadcast({ t: 'join', name: p.name }, id);
    } else if (m.t === 'pos') {
      p.x = num(m.x);
      p.y = num(m.y);
      p.z = num(m.z);
      p.f = num(m.f);
      p.lvl = Math.max(1, Math.min(200, Math.round(num(m.lvl))));
    } else if (m.t === 'chat') {
      const text = clean(m.text, 140);
      if (text) broadcast({ t: 'chat', name: p.name, text });
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ t: 'leave', name: p.name });
  });
});

// Diffusion des positions 10 fois par seconde
setInterval(() => {
  const list = [...players.values()].map(({ id, name, x, y, z, f, lvl }) => ({ id, name, x, y, z, f, lvl }));
  broadcast({ t: 'players', list });
}, 100);

console.log(`Serveur Éveil des Ombres à l'écoute sur le port ${PORT}`);
