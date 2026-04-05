import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionManager } from './connectionManager.js';

class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  sent: string[] = [];

  send(payload: string) {
    this.sent.push(payload);
  }
}

test('room lifecycle and multiplayer broadcast', () => {
  const wsA = new MockWebSocket();
  const wsB = new MockWebSocket();

  const connA = connectionManager.addConnection(wsA as never, 'user-a');
  const connB = connectionManager.addConnection(wsB as never, 'user-b');

  connectionManager.authenticateConnection(connA, 'user-a');
  connectionManager.authenticateConnection(connB, 'user-b');
  connectionManager.joinRoom(connA, 'room-1');
  connectionManager.joinRoom(connB, 'room-1');

  connectionManager.broadcastToRoom('room-1', { type: 'test:event', ok: true });

  assert.equal(wsA.sent.length, 1);
  assert.equal(wsB.sent.length, 1);
  assert.equal(connectionManager.getRoomConnections('room-1').length, 2);

  connectionManager.removeConnection(connA);
  assert.equal(connectionManager.getRoomConnections('room-1').length, 1);

  connectionManager.removeConnection(connB);
  assert.equal(connectionManager.getRoomConnections('room-1').length, 0);
});

test('disconnect and reconnect restores room membership', () => {
  const wsA1 = new MockWebSocket();
  const firstConn = connectionManager.addConnection(wsA1 as never, 'user-reconnect');
  connectionManager.authenticateConnection(firstConn, 'user-reconnect');
  connectionManager.joinRoom(firstConn, 'room-reconnect');
  assert.equal(connectionManager.getRoomConnections('room-reconnect').length, 1);

  connectionManager.removeConnection(firstConn);
  assert.equal(connectionManager.getRoomConnections('room-reconnect').length, 0);

  const wsA2 = new MockWebSocket();
  const secondConn = connectionManager.addConnection(wsA2 as never, 'user-reconnect');
  connectionManager.authenticateConnection(secondConn, 'user-reconnect');
  connectionManager.joinRoom(secondConn, 'room-reconnect');
  assert.equal(connectionManager.getRoomConnections('room-reconnect').length, 1);

  connectionManager.removeConnection(secondConn);
});
