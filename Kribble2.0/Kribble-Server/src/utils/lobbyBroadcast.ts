import type { Server } from 'socket.io';

import RoomServiceInstance from '@/services/room/RoomService';

let ioRef: Server | undefined;

export function setLobbyBroadcastIo(io: Server): void {
  ioRef = io;
}

/** Broadcast latest lobby snapshot to all connected clients (Kribble 1.0 parity). */
export function scheduleLobbyRoomsBroadcast(): void {
  if (!ioRef) return;
  void RoomServiceInstance.listLobbyRoomSummaries().then((rooms) => {
    const onlineCount = ioRef!.engine.clientsCount;
    ioRef!.emit('lobby:rooms-updated', { rooms, onlineCount });
  });
}
