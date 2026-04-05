import test from 'node:test';
import assert from 'node:assert/strict';
import { GameStateMachine } from './stateMachine.js';
import type { GameContext, GameRoom } from './types.js';

function createRoom(overrides: Partial<GameRoom> = {}): GameRoom {
  return {
    id: 'room-1',
    code: 'ABCD',
    name: 'Test Room',
    hostId: 'u1',
    players: [
      {
        id: 'p1',
        userId: 'u1',
        displayName: 'Drawer',
        score: 0,
        isReady: true,
        hasGuessedCorrectly: false,
      },
      {
        id: 'p2',
        userId: 'u2',
        displayName: 'Guesser',
        score: 0,
        isReady: true,
        hasGuessedCorrectly: true,
      },
    ],
    maxPlayers: 8,
    roundTime: 60,
    currentRound: 1,
    maxRounds: 3,
    phase: 'roundEnd',
    currentDrawerId: 'p1',
    currentWord: 'apple',
    roundStartTime: Date.now() - 5000,
    ...overrides,
  };
}

test('state machine moves lobby -> starting when all players ready', async () => {
  let room = createRoom({
    phase: 'lobby',
    players: [
      { id: 'p1', userId: 'u1', displayName: 'A', score: 0, isReady: true, hasGuessedCorrectly: false },
      { id: 'p2', userId: 'u2', displayName: 'B', score: 0, isReady: true, hasGuessedCorrectly: false },
    ],
  });

  const machine = new GameStateMachine(room.id);
  const context: GameContext = {
    room,
    updateRoom(next) {
      room = next;
      context.room = next;
    },
    broadcast() {},
    broadcastToRoom() {},
  };

  machine.initialize(context);
  await machine.update();

  assert.equal(context.room.phase, 'starting');
});

test('round end scoring awards points to drawer and guesser', async () => {
  let room = createRoom();
  const machine = new GameStateMachine(room.id);

  const context: GameContext = {
    room,
    updateRoom(next) {
      room = next;
      context.room = next;
    },
    broadcast() {},
    broadcastToRoom() {},
  };

  machine.initialize(context);
  await machine.transitionTo('roundEnd');

  const drawer = context.room.players.find((player) => player.id === 'p1');
  const guesser = context.room.players.find((player) => player.id === 'p2');

  assert.ok(drawer && drawer.score > 0, 'drawer should receive points');
  assert.ok(guesser && guesser.score > 0, 'guesser should receive points');
});
