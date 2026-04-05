// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
import { GameSocketEvents, RoomSocketEvents } from '../../../constants/events/socket.js';
import DoodlerServiceInstance from '../../../services/doodler/DoodlerService.js';
import GameServiceInstance from '../../../services/game/GameService.js';
import RoomServiceInstance from '../../../services/room/RoomService.js';
import { GameStatus } from '../../../types/game.js';
import { GameInterface } from '../../../types/socket/game.js';
import { scheduleLobbyRoomsBroadcast } from '../../../utils/lobbyBroadcast.js';

import { RoomControllerInterface } from './interface.js';

class RoomController implements RoomControllerInterface {
  /**
   * Handle when the client wants to be added to a public room
   */
  public handleRoomOnAddDoodlerToPublicRoom: RoomControllerInterface['handleRoomOnAddDoodlerToPublicRoom'] =
    (socket) => async (_payload, respond) => {
      const doodler = await DoodlerServiceInstance.findDooder(socket.id);
      const { id: roomId, gameId } =
        await RoomServiceInstance.assignDoodlerToPublicRoom(doodler.id);

      // Join the new room
      socket.join(roomId);
      socket.to(roomId).emit(RoomSocketEvents.EMIT_DOODLER_JOIN, { doodler });

      let game: GameInterface | undefined = undefined;
      if (!gameId) {
        const gameInterface = await GameServiceInstance.createGame(roomId);
        await RoomServiceInstance.assignGameToRoom(roomId, gameInterface.id);
        game = gameInterface;
      } else {
        const gameInterface = await GameServiceInstance.findGame(gameId);
        game = gameInterface;
      }

      const isValidGameRoom = await RoomServiceInstance.isValidGameRoom(roomId);
      if (!gameId || !isValidGameRoom) {
        await RoomServiceInstance.changeDrawerTurn(roomId, true);
        await GameServiceInstance.updateStatus(game.id, GameStatus.LOBBY, true);
      } else if (game.status === GameStatus.LOBBY && isValidGameRoom) {
        await RoomServiceInstance.changeDrawerTurn(roomId);
        await GameServiceInstance.updateStatus(
          game.id,
          GameStatus.CHOOSE_WORD,
          true
        );
      }

      respond({ data: { roomId } });
      scheduleLobbyRoomsBroadcast();
    };

  /**
   * Join a specific public room (from lobby list / quick play).
   */
  public handleRoomOnAddDoodlerToSpecificPublicRoom: RoomControllerInterface['handleRoomOnAddDoodlerToSpecificPublicRoom'] =
    (socket) => async (payload, respond) => {
      const { roomId } = payload;
      const doodler = await DoodlerServiceInstance.findDooder(socket.id);
      const { id: joinedRoomId, gameId } =
        await RoomServiceInstance.assignDoodlerToSpecificPublicRoom(
          roomId,
          doodler.id
        );

      socket.join(joinedRoomId);
      socket.to(joinedRoomId).emit(RoomSocketEvents.EMIT_DOODLER_JOIN, {
        doodler
      });

      let game: GameInterface | undefined = undefined;
      if (!gameId) {
        const gameInterface = await GameServiceInstance.createGame(joinedRoomId);
        await RoomServiceInstance.assignGameToRoom(
          joinedRoomId,
          gameInterface.id
        );
        game = gameInterface;
      } else {
        const gameInterface = await GameServiceInstance.findGame(gameId);
        game = gameInterface;
      }

      const isValidGameRoom =
        await RoomServiceInstance.isValidGameRoom(joinedRoomId);
      if (!gameId || !isValidGameRoom) {
        await RoomServiceInstance.changeDrawerTurn(joinedRoomId, true);
        await GameServiceInstance.updateStatus(game!.id, GameStatus.LOBBY, true);
      } else if (game!.status === GameStatus.LOBBY && isValidGameRoom) {
        await RoomServiceInstance.changeDrawerTurn(joinedRoomId);
        await GameServiceInstance.updateStatus(
          game!.id,
          GameStatus.CHOOSE_WORD,
          true
        );
      }

      respond({ data: { roomId: joinedRoomId } });
      scheduleLobbyRoomsBroadcast();
    };

  /**
   * Handle when the client wants to be added to a private room
   */
  public handleRoomOnAddDoodlerToPrivateRoom: RoomControllerInterface['handleRoomOnAddDoodlerToPrivateRoom'] =
    (socket) => async (payload, respond) => {
      const { roomId } = payload;
      const doodler = await DoodlerServiceInstance.findDooder(socket.id);
      const room = await RoomServiceInstance.assignDoodlerToPrivateRoom(
        roomId,
        doodler.id
      );

      // Join the new room
      socket.join(roomId);
      socket.to(roomId).emit(RoomSocketEvents.EMIT_DOODLER_JOIN, { doodler });
      respond({ data: { room } });
      scheduleLobbyRoomsBroadcast();
    };

  /**
   * Handle when the client wants to create a private room
   */
  public handleRoomOnCreatePrivateRoom: RoomControllerInterface['handleRoomOnCreatePrivateRoom'] =
    (socket) => async (_, respond) => {
      const doodler = await DoodlerServiceInstance.findDooder(socket.id);
      const { id: roomId } = await RoomServiceInstance.createRoom(doodler.id);
      const gameInterface = await GameServiceInstance.createGame(roomId);
      await RoomServiceInstance.assignGameToRoom(roomId, gameInterface.id);
      socket.join(roomId);
      await RoomServiceInstance.changeDrawerTurn(roomId, true);
      await GameServiceInstance.updateStatus(
        gameInterface.id,
        GameStatus.LOBBY,
        true
      );
      respond({ data: { roomId } });
      scheduleLobbyRoomsBroadcast();
    };

  /**
   * Handle when the client wants to get room details
   * K1 BRIDGE: Support auto-join if the doodler isn't already in the room.
   */
  public handleRoomOnGetRoom: RoomControllerInterface['handleRoomOnGetRoom'] =
    (socket) => async (payload, respond) => {
      const roomId = payload;
      const room = await RoomServiceInstance.findRoom(roomId);
      
      const isAlreadyInRoom = room.doodlers.some(id => id === socket.id);
      
      if (!isAlreadyInRoom) {
        // Auto-join the room
        if (room.isPrivate) {
          await RoomServiceInstance.assignDoodlerToPrivateRoom(room.id, socket.id);
        } else {
          await RoomServiceInstance.assignDoodlerToSpecificPublicRoom(room.id, socket.id);
        }
        
        // Notify others in the room
        try {
          const doodler = await DoodlerServiceInstance.findDooder(socket.id);
          socket.join(room.id);
          socket.to(room.id).emit(RoomSocketEvents.EMIT_DOODLER_JOIN, { doodler });
        } catch (e) {
          console.error('[RoomController] Failed to notify join:', e);
        }
        
        // Re-fetch updated room data and filter doodlers
        const updatedRoom = await RoomServiceInstance.findRoom(roomId);
        const doodlers: DoodlerInterface[] = [];
        const activeDoodlerIds: string[] = [];

        for (const doodlerId of updatedRoom.doodlers) {
          try {
            const d = await DoodlerServiceInstance.findDooder(doodlerId);
            doodlers.push(d);
            activeDoodlerIds.push(doodlerId);
          } catch (e) {
            // Doodler not found in service (stale ID), skip it
            console.log(`[RoomController] Pruning stale doodler ${doodlerId} from room ${roomId}`);
          }
        }
        
        // Return filtered data
        respond({ data: { room: { ...updatedRoom, doodlers: activeDoodlerIds }, doodlers } });
      } else {
        const doodlers: DoodlerInterface[] = [];
        for (const doodlerId of room.doodlers) {
          try {
            const d = await DoodlerServiceInstance.findDooder(doodlerId);
            doodlers.push(d);
          } catch (e) {
             // Skip stale
          }
        }
        respond({ data: { room, doodlers } });
      }

      // ALWAYS join the room's socket channel to ensure receipt of broadcasts
      socket.join(room.id);
      console.log(`[RoomController] Socket ${socket.id} joined channel ${room.id}`);
    };

  /**
   * Handle when the client requests the lobby rooms list
   */
  public handleRoomOnGetLobbyRooms: RoomControllerInterface['handleRoomOnGetLobbyRooms'] =
    (socket) => async (_payload, respond) => {
      const rooms = await RoomServiceInstance.listLobbyRoomSummaries();
      // Socket.io doesn't expose total clients cleanly per namespace statically here without io,
      // but we can pass undefined for onlineCount or try to get it. Emitting without onlineCount is fine
      // because onlineCount can be broadcasted globally or managed elsewhere.
      // Wait, RoomController can access the socket's server instance!
      const onlineCount = socket.nsp.server.engine.clientsCount;
      respond({ data: { rooms, onlineCount } });
    };
}

export default RoomController;
