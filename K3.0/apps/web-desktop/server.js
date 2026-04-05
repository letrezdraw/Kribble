import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = 3001;
const JWT_SECRET = 'kribble-dev-secret';
let rooms = new Map();
let users = new Map();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.post('/auth/guest', (req, res) => {
  const { displayName = `Guest_${Math.random().toString(36).substr(2, 4).toUpperCase()}` } = req.body;
  const userId = `guest_${uuidv4().slice(0, 8)}`;
  const user = { id: userId, displayName, isGuest: true };
  users.set(userId, user);
  const token = jwt.sign({ id: userId, isGuest: true }, JWT_SECRET);
  res.json({ user, token });
});

app.post('/rooms', (req, res) => {
  const { name, maxPlayers = 8, isPrivate = false } = req.body;
  const code = Math.random().toString(36).substr(2, 4).toUpperCase();
  const roomId = uuidv4();
  const room = { id: roomId, code, name, maxPlayers, isPrivate, players: [], status: 'LOBBY' };
  rooms.set(roomId, room);
  res.json({ room });
});

app.get('/rooms/:code', (req, res) => {
  for (let [id, room] of rooms) {
    if (room.code === req.params.code) {
      res.json({ room });
      return;
    }
  }
  res.status(404).json({ message: 'Room not found' });
});

app.post('/rooms/:code/join', (req, res) => {
  const code = req.params.code;
  const userId = req.headers.authorization?.replace('Bearer ', '');
  const user = users.get(userId);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  for (let [id, room] of rooms) {
    if (room.code === code) {
      if (room.players.find(p => p.userId === userId)) return res.json({ room });
      room.players.push({ userId, displayName: user.displayName, score: 0, isReady: false });
      res.json({ room });
      return;
    }
  }
  res.status(404).json({ message: 'Room not found' });
});

app.post('/rooms/:code/leave', (req, res) => {
  // Simplified
  res.json({ message: 'Left room' });
});

app.post('/rooms/:code/ready', (req, res) => {
  const code = req.params.code;
  const { isReady } = req.body;
  const userId = req.headers.authorization?.replace('Bearer ', '');
  for (let [id, room] of rooms) {
    if (room.code === code) {
      const player = room.players.find(p => p.userId === userId);
      if (player) player.isReady = isReady;
      res.json({ room });
      return;
    }
  }
  res.status(404).json({ message: 'Room not found' });
});

app.get('/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).filter(r => !r.isPrivate);
  res.json({ rooms: roomList });
});

app.get('/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ user: users.get(decoded.id) });
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
});

const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // Broadcast to room or handle logic
      wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) client.send(JSON.stringify(msg));
      });
    } catch (e) {}
  });
});

export { app, server };
