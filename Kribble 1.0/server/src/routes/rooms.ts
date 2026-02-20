import { Router, Request, Response } from 'express';
import { rooms, createRoom, getRoomList, getRoom } from '../data/rooms.js';

const router = Router();

// Get all rooms
router.get('/', (req: Request, res: Response) => {
  const roomList = getRoomList();
  res.json({ rooms: roomList });
});

// Create room
router.post('/', (req: Request, res: Response) => {
  const { name, settings } = req.body;
  
  const room = createRoom(name, settings);
  
  res.status(201).json({ room });
});


// Get room
router.get('/:id', (req: Request, res: Response) => {
  const room = rooms.get(req.params.id);
  
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }
  
  res.json({ room });
});

// Join room
router.post('/:id/join', (req: Request, res: Response) => {
  const room = rooms.get(req.params.id);
  
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }
  
  if (room.players.length >= room.maxPlayers) {
    return res.status(400).json({ message: 'Room is full' });
  }
  
  if (room.isPrivate && room.password !== req.body.password) {
    return res.status(403).json({ message: 'Invalid password' });
  }
  
  res.json({ room });
});

// Leave room
router.post('/:id/leave', (req: Request, res: Response) => {
  res.json({ success: true });
});

// Start game
router.post('/:id/start', (req: Request, res: Response) => {
  const room = rooms.get(req.params.id);
  
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }
  
  res.json({ success: true });
});

export { router as roomRoutes };
