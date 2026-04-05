import { LobbyListedRoom } from '../../types/lobby.js';
import { DoodlerInterface } from '../../types/socket/doodler.js';
import { GameInterface } from '../../types/socket/game.js';
import { RoomInterface } from '../../types/socket/room.js';

export interface RoomServiceInterface {
  // FUNDAMENTALS
  createRoom: (ownerId?: string) => Promise<RoomInterface>;
  isValidGameRoom: (roomId: string) => Promise<boolean>;
  findRoom: (roomId: string) => Promise<RoomInterface>;

  // ROOM WITH DOODLER
  findRoomWithDoodler: (
    roomId: string,
    doodlerId: string
  ) => Promise<RoomInterface>;
  assignDoodlerToPublicRoom: (
    doodlerId: DoodlerInterface['id']
  ) => Promise<RoomInterface>;
  assignDoodlerToSpecificPublicRoom: (
    roomId: string,
    doodlerId: DoodlerInterface['id']
  ) => Promise<RoomInterface>;
  assignDoodlerToPrivateRoom: (
    roomId: string,
    doodlerId: DoodlerInterface['id']
  ) => Promise<RoomInterface>;
  removeDoodlerFromRoom: (
    roomId: string,
    doodlerId: string
  ) => Promise<RoomInterface | undefined>;

  // ROOM WITH GAME
  assignGameToRoom: (
    roomId: string,
    gameId: GameInterface['id']
  ) => Promise<RoomInterface>;
  changeDrawerTurn: (roomId: string) => Promise<RoomInterface>;
  resetScoreboard: (roomId: string) => Promise<void>;

  listLobbyRoomSummaries: () => Promise<LobbyListedRoom[]>;
}
