import { Router, Request, Response } from 'express';
import RoomServiceInstance from '../k2/services/room/RoomService.js';

const router = Router();

// Get all rooms
router.get('/', async (req: Request, res: Response) => {
  const roomList = await RoomServiceInstance.listLobbyRoomSummaries();
  res.json({ rooms: roomList });
});

// Create room
router.post('/', async (req: Request, res: Response) => {
  const { name, settings } = req.body;
  
  const room = await RoomServiceInstance.createRoom(
    undefined,
    name,
    settings?.maxPlayers,
    settings?.isPrivate === true
  );
  
  res.status(201).json({ room });
});


// Get room
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const room = await RoomServiceInstance.findRoom(req.params.id);
    res.json({ room });
  } catch (e) {
    res.status(404).json({ message: 'Room not found' });
  }
});

// Join room
router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const { doodlerId } = req.body;
    const room = await RoomServiceInstance.findRoom(req.params.id);
    
    if (room.doodlers.length >= room.capacity) {
      return res.status(400).json({ message: 'Room is full' });
    }
    
    // In K2, joining via specific ID for a public room:
    if (!room.isPrivate) {
      await RoomServiceInstance.assignDoodlerToSpecificPublicRoom(room.id, doodlerId);
    } else {
      // For private rooms, we'd need a password check here if K2 model added it
      await RoomServiceInstance.assignDoodlerToPrivateRoom(room.id, doodlerId);
    }
    
    res.json({ room: await RoomServiceInstance.findRoom(req.params.id) });
  } catch (e) {
    res.status(404).json({ message: 'Room not found or join failed' });
  }
});

// Leave room
router.post('/:id/leave', (req: Request, res: Response) => {
  res.json({ success: true });
});

// Start game
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const room = await RoomServiceInstance.findRoom(req.params.id);
    res.json({ success: true, roomId: room.id });
  } catch (e) {
    res.status(404).json({ message: 'Room not found' });
  }
});

export { router as roomRoutes };
