import { prisma } from '../db/prismaClient.js';
import { v4 as uuidv4 } from 'uuid';

export interface RoomOutput {
  id: string;
  code: string;
  name: string;
  maxPlayers: number;
  isPrivate: boolean;
  status: string;
  createdAt: Date;
  players: RoomPlayerOutput[];
}

export interface RoomPlayerOutput {
  id: string;
  userId: string;
  displayName: string;
  avatar?: string;
  score: number;
  isReady: boolean;
  isDrawer: boolean;
  hasGuessedCorrectly: boolean;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createRoom(name: string, hostId: string, maxPlayers: number = 8, isPrivate: boolean = false): Promise<RoomOutput> {
  let code = generateRoomCode();
  
  // Ensure code is unique
  while (await prisma.room.findUnique({ where: { code } })) {
    code = generateRoomCode();
  }

  const room = await prisma.room.create({
    data: {
      code,
      name,
      maxPlayers,
      isPrivate,
      status: 'LOBBY',
      players: {
        create: {
          userId: hostId,
          isDrawer: false,
          isReady: false,
          score: 0,
        },
      },
    },
    include: {
      players: {
        include: {
          user: true,
        },
      },
    },
  });

  return mapRoomToOutput(room);
}

export async function getRoomByCode(code: string): Promise<RoomOutput | null> {
  const room = await prisma.room.findUnique({
    where: { code },
    include: {
      players: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!room) return null;
  return mapRoomToOutput(room);
}

export async function getRoomById(id: string): Promise<RoomOutput | null> {
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      players: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!room) return null;
  return mapRoomToOutput(room);
}

export async function getAllRooms(): Promise<RoomOutput[]> {
  const rooms = await prisma.room.findMany({
    where: {
      isPrivate: false,
      status: 'LOBBY',
    },
    include: {
      players: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return rooms.map(mapRoomToOutput);
}

export async function joinRoom(roomId: string, userId: string): Promise<RoomOutput | null> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      players: true,
    },
  });

  if (!room) return null;
  if (room.players.length >= room.maxPlayers) {
    throw new Error('Room is full');
  }

  // Check if user already in room
  const existingPlayer = room.players.find(p => p.userId === userId);
  if (existingPlayer) {
    return getRoomById(roomId);
  }

  await prisma.roomPlayer.create({
    data: {
      roomId,
      userId,
      isDrawer: false,
      isReady: false,
      score: 0,
    },
  });

  return getRoomById(roomId);
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  await prisma.roomPlayer.deleteMany({
    where: {
      roomId,
      userId,
    },
  });

  // If room is empty, delete it
  const remainingPlayers = await prisma.roomPlayer.count({
    where: { roomId },
  });

  if (remainingPlayers === 0) {
    await prisma.room.delete({
      where: { id: roomId },
    });
  }
}

export async function setPlayerReady(roomId: string, userId: string, isReady: boolean): Promise<RoomOutput | null> {
  await prisma.roomPlayer.updateMany({
    where: {
      roomId,
      userId,
    },
    data: {
      isReady,
    },
  });

  return getRoomById(roomId);
}

export type RoomStatusValue = 'LOBBY' | 'DRAWING' | 'GUESSING' | 'ROUND_END' | 'GAME_END';

export async function updateRoomStatus(roomId: string, status: RoomStatusValue): Promise<RoomOutput | null> {
  await prisma.room.update({
    where: { id: roomId },
    data: { status },
  });

  return getRoomById(roomId);
}

function mapRoomToOutput(room: any): RoomOutput {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    maxPlayers: room.maxPlayers,
    isPrivate: room.isPrivate,
    status: room.status,
    createdAt: room.createdAt,
    players: room.players.map((p: any) => ({
      id: p.id,
      userId: p.userId,
      displayName: p.user?.username || 'Unknown',
      avatar: p.user?.avatar || undefined,
      score: p.score,
      isReady: p.isReady,
      isDrawer: p.isDrawer,
      hasGuessedCorrectly: p.hasGuessedCorrectly,
    })),
  };
}
