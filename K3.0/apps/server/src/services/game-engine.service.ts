import { GameStateMachine, type GameRoom, type GamePhase } from '@kribble/game-engine';
import type { ServerMessage } from '@kribble/shared-types';
import * as roomService from './room.service.js';

type BroadcastFn = (message: ServerMessage | Record<string, unknown>) => void;

interface RuntimeState {
  machine: GameStateMachine;
  room: GameRoom;
}

const runtimeByRoomId = new Map<string, RuntimeState>();

function toGamePhase(status: string): GamePhase {
  switch (status) {
    case 'DRAWING':
      return 'drawing';
    case 'GUESSING':
      return 'guessing';
    case 'ROUND_END':
      return 'roundEnd';
    case 'GAME_END':
      return 'gameEnd';
    default:
      return 'lobby';
  }
}

function toRoomStatus(phase: GamePhase): string {
  switch (phase) {
    case 'drawing':
      return 'DRAWING';
    case 'guessing':
      return 'GUESSING';
    case 'roundEnd':
      return 'ROUND_END';
    case 'gameEnd':
      return 'GAME_END';
    default:
      return 'LOBBY';
  }
}
function toTypedRoomStatus(phase: GamePhase): roomService.RoomStatusValue {
  return toRoomStatus(phase) as roomService.RoomStatusValue;
}

function toGameRoom(room: roomService.RoomOutput): GameRoom {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    hostId: room.players[0]?.userId ?? '',
    players: room.players.map((player) => ({
      id: player.id,
      userId: player.userId,
      displayName: player.displayName,
      avatar: player.avatar,
      score: player.score,
      isReady: player.isReady,
      hasGuessedCorrectly: player.hasGuessedCorrectly,
    })),
    maxPlayers: room.maxPlayers,
    roundTime: 90,
    currentRound: 0,
    maxRounds: 3,
    phase: toGamePhase(room.status),
  };
}

async function persistPhase(roomId: string, phase: GamePhase): Promise<void> {
  await roomService.updateRoomStatus(roomId, toTypedRoomStatus(phase));
}

async function getOrCreateRuntime(roomCode: string, broadcast: BroadcastFn): Promise<RuntimeState | null> {
  const room = await roomService.getRoomByCode(roomCode.toUpperCase());
  if (!room) return null;

  const existing = runtimeByRoomId.get(room.id);
  if (existing) {
    // Keep runtime players in sync with latest DB-backed room shape.
    existing.room.players = room.players.map((player) => ({
      id: player.id,
      userId: player.userId,
      displayName: player.displayName,
      avatar: player.avatar,
      score: player.score,
      isReady: player.isReady,
      hasGuessedCorrectly: player.hasGuessedCorrectly,
    }));
    return existing;
  }

  const runtimeRoom = toGameRoom(room);
  const machine = new GameStateMachine(room.id);
  const runtime: RuntimeState = { machine, room: runtimeRoom };

  machine.initialize({
    room: runtime.room,
    updateRoom: (nextRoom) => {
      const previousPhase = runtime.room.phase;
      runtime.room = nextRoom;

      const nextPhase = nextRoom.phase;
      if (previousPhase !== nextPhase) {
        void persistPhase(room.id, nextPhase);
        void machine.transitionTo(nextPhase).catch(() => undefined);
      }
    },
    broadcast: (message) => broadcast(message as Record<string, unknown>),
    broadcastToRoom: (_roomId, message) => broadcast(message as Record<string, unknown>),
  });

  runtimeByRoomId.set(room.id, runtime);
  return runtime;
}

export async function syncPlayerReady(
  roomCode: string,
  userId: string,
  isReady: boolean,
  broadcast: BroadcastFn
): Promise<{ roomId: string; room: GameRoom } | null> {
  const room = await roomService.getRoomByCode(roomCode.toUpperCase());
  if (!room) return null;

  await roomService.setPlayerReady(room.id, userId, isReady);
  const runtime = await getOrCreateRuntime(roomCode, broadcast);
  if (!runtime) return null;

  await runtime.machine.update();
  return { roomId: runtime.room.id, room: runtime.room };
}

export async function selectWord(
  roomCode: string,
  userId: string,
  word: string,
  broadcast: BroadcastFn
): Promise<{ roomId: string; room: GameRoom } | null> {
  const runtime = await getOrCreateRuntime(roomCode, broadcast);
  if (!runtime) return null;

  const drawer = runtime.room.players.find((p) => p.id === runtime.room.currentDrawerId);
  if (!drawer || drawer.userId !== userId) {
    return null;
  }

  if (!runtime.room.wordOptions?.includes(word)) {
    return null;
  }

  runtime.room = {
    ...runtime.room,
    currentWord: word,
    phase: 'drawing',
  };
  await persistPhase(runtime.room.id, 'drawing');
  await runtime.machine.transitionTo('drawing');

  return { roomId: runtime.room.id, room: runtime.room };
}

export async function submitGuess(
  roomCode: string,
  userId: string,
  guessText: string,
  broadcast: BroadcastFn
): Promise<{ roomId: string; room: GameRoom; isCorrect: boolean } | null> {
  const runtime = await getOrCreateRuntime(roomCode, broadcast);
  if (!runtime || !runtime.room.currentWord) return null;

  const isCorrect = runtime.room.currentWord.toLowerCase() === guessText.trim().toLowerCase();
  if (!isCorrect) {
    return { roomId: runtime.room.id, room: runtime.room, isCorrect: false };
  }

  const player = runtime.room.players.find((p) => p.userId === userId);
  if (!player || player.id === runtime.room.currentDrawerId) {
    return { roomId: runtime.room.id, room: runtime.room, isCorrect: false };
  }

  player.hasGuessedCorrectly = true;
  await runtime.machine.update();

  return { roomId: runtime.room.id, room: runtime.room, isCorrect: true };
}

export async function getRoomState(
  roomCode: string,
  broadcast: BroadcastFn
): Promise<{ roomId: string; room: GameRoom } | null> {
  const runtime = await getOrCreateRuntime(roomCode, broadcast);
  if (!runtime) return null;

  return { roomId: runtime.room.id, room: runtime.room };
}
