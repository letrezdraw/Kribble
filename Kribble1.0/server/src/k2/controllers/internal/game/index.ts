// @ts-nocheck
import { GameSocketEvents } from '../../../constants/events/socket.js';
import { MINIMUM_VALID_SIZE } from '../../../constants/game.js';
import DoodlerServiceInstance from '../../../services/doodler/DoodlerService.js';
import GameServiceInstance from '../../../services/game/GameService.js';
import RoomServiceInstance from '../../../services/room/RoomService.js';
import { GameStatus } from '../../../types/game.js';
import { HunchStatus } from '../../../types/socket/game.js';
import { DoodleServerError } from '../../../utils/error.js';
import { createHunch } from '../../../utils/game.js';

import { GameControllerInterface } from './interface.js';

class GameController implements GameControllerInterface {
  /**
   * Handle when the client requests the game details
   * @param roomId
   * @param respond
   */
  public handleGameOnGetGame: GameControllerInterface['handleGameOnGetGame'] =
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_socket) => async (payload, respond) => {
      const gameId = payload;
      const game = await GameServiceInstance.findGame(gameId);
      // const { data: isValidGameData } = GameService.isValidGame(roomId);
      // // TODO: Check for room is public
      // if (isValidGameData) {
      //   GameServiceInstance.startGame(roomId);
      // }

      respond({ data: { game } });
    };

  /**
   * Handle when the clients sends a canvas based operation
   * @param socket
   * @returns
   */
  public handleGameOnGameCanvasOperation: GameControllerInterface['handleGameOnGameCanvasOperation'] =
    (socket) => async (payload, respond) => {
      const { roomId, canvasOperation } = payload;
      const { gameId } = await RoomServiceInstance.findRoomWithDoodler(
        roomId,
        socket.id
      );
      if (!gameId) throw new DoodleServerError('Game not found!');
      const game = await GameServiceInstance.updateCanvasOperations(
        gameId,
        canvasOperation
      );
      socket
        .to(roomId)
        .emit(GameSocketEvents.EMIT_GAME_CANVAS_OPERATION, { canvasOperation });
      if (respond) {
        respond({ data: { game } });
      }
    };

  public handleGameOnChooseWord: GameControllerInterface['handleGameOnChooseWord'] =
    (socket) => async (payload, respond) => {
      const { roomId, word } = payload;
      const { gameId } = await RoomServiceInstance.findRoomWithDoodler(
        roomId,
        socket.id
      );
      if (!gameId) throw new DoodleServerError('Game not found!');
      const game = await GameServiceInstance.updateStatus(
        gameId,
        GameStatus.GAME,
        true,
        { word }
      );
      respond({ data: { game } });
    };

  public handleGameOnGameHunch: GameControllerInterface['handleGameOnGameHunch'] =
    (socket) => async (payload, respond) => {
      const { roomId, message } = payload;
      const room = await RoomServiceInstance.findRoomWithDoodler(
        roomId,
        socket.id
      );
      if (!room.gameId) throw new DoodleServerError('Game not found!');
      const game = await GameServiceInstance.findGame(room.gameId);

      // If the socket is not drawer and status is game
      if (room.drawerId !== socket.id && game.status === GameStatus.GAME) {
        const hunchStatus = await GameServiceInstance.getHunchStatus(
          room.gameId,
          message
        );
        // If the hunch is correct, send a system message to all clients
        if (hunchStatus === HunchStatus.CORRECT) {
          const doodler = await DoodlerServiceInstance.findDooder(socket.id);
          const hunch = createHunch(
            `${doodler.name} hunched the word!`,
            hunchStatus
          );
          await GameServiceInstance.addHunchTime(game.id, doodler.id);
          socket.to(roomId).emit(GameSocketEvents.EMIT_GAME_HUNCH, { hunch });
          respond({ data: { hunch } });
          return;
        }
        // If the hunch is nearby, send a system message to socket and normal message to all other clients
        if (hunchStatus === HunchStatus.NEARBY) {
          const senderHunch = createHunch(
            `"${message}" is close!`,
            hunchStatus
          );
          const receiverHunch = createHunch(message, hunchStatus, socket.id);
          socket.to(roomId).emit(GameSocketEvents.EMIT_GAME_HUNCH, {
            hunch: { ...receiverHunch, status: HunchStatus.WRONG }
          });
          respond({ data: { hunch: senderHunch } });
          return;
        }
      }
      // If none of the above condition is correct, send a normal message to all
      const hunch = createHunch(message, HunchStatus.WRONG, socket.id);
      socket.to(roomId).emit(GameSocketEvents.EMIT_GAME_HUNCH, { hunch });
      respond({ data: { hunch } });
      return;
    };

  /**
   * Handle when a private room owner starts the game
   */
  public handleGameOnStartPrivateGame: GameControllerInterface['handleGameOnStartPrivateGame'] =
    (socket) => async (payload, respond) => {
      try {
        const { roomId, options } = payload;
        console.log(`[GameController] START_GAME called: socket=${socket.id}, room=${roomId}`);
        
        const room = await RoomServiceInstance.findRoom(roomId);
        console.log(`[GameController] Room found: ownerId=${room.ownerId}, isHost=${room.ownerId === socket.id}`);

        // If socket is not the owner of the room, socket cannot start the game
        if (room.ownerId !== socket.id) {
          console.warn(`[GameController] Unauthorized start attempt by ${socket.id}`);
          throw new DoodleServerError('Invalid action!');
        }

        // If room has less than 2 players, game can not be started
        if (room.doodlers.length < 2) {
          console.warn(`[GameController] Insufficient players: ${room.doodlers.length}`);
          throw new DoodleServerError('Insufficient players!');
        }

        if (!room.gameId) throw new DoodleServerError('Invalid game!');
        
        await GameServiceInstance.setDefaultOptions(room.gameId, options);
        await RoomServiceInstance.changeDrawerTurn(roomId);
        const game = await GameServiceInstance.updateStatus(
          room.gameId,
          GameStatus.CHOOSE_WORD,
          true
        );
        console.log(`[GameController] Game started successfully: ${room.gameId}`);
        respond({ data: { game } });
      } catch (e) {
        console.error(`[GameController] START_GAME failed:`, e);
        respond({ error: { message: e.message } });
      }
    };

  public handleGameOnUpdatePrivateSetting: GameControllerInterface['handleGameOnUpdatePrivateSetting'] =
    (socket) => async (payload, respond) => {
      const { roomId, options } = payload;
      const room = await RoomServiceInstance.findRoomWithDoodler(
        roomId,
        socket.id
      );
      if (room.ownerId !== socket.id) {
        throw new DoodleServerError('Invalid action!');
      }
      if (!room.gameId) {
        throw new DoodleServerError('Game not found!');
      }
      const game = await GameServiceInstance.updatePrivateLobbyOptions(
        room.gameId,
        options
      );
      socket
        .to(roomId)
        .emit(GameSocketEvents.EMIT_GAME_UPDATE_PRIVATE_SETTING, { options });
      respond({ data: { game } });
    };
}

export default GameController;
