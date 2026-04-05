import { RoomEvents } from '../../constants/Events';

import { DoodlerInterface } from '../models/doodler';
import { RoomInterface } from '../models/room';
import { ClientToServerEventsArgument } from './helper';
import { LobbyListedRoom } from '../lobby';

export interface RoomClientToServerEventsArgumentMap {
  [RoomEvents.EMIT_ADD_DOODLER_TO_PUBLIC_ROOM]: ClientToServerEventsArgument<
    undefined,
    { roomId: RoomInterface['id'] }
  >;
  [RoomEvents.EMIT_ADD_DOODLER_TO_SPECIFIC_PUBLIC_ROOM]: ClientToServerEventsArgument<
    { roomId: RoomInterface['id'] },
    { roomId: RoomInterface['id'] }
  >;
  [RoomEvents.EMIT_ADD_DOODLER_TO_PRIVATE_ROOM]: ClientToServerEventsArgument<
    { roomId: string },
    { room: RoomInterface }
  >;
  [RoomEvents.EMIT_CREATE_PRIVATE_ROOM]: ClientToServerEventsArgument<
    undefined,
    { roomId: RoomInterface['id'] }
  >;
  [RoomEvents.EMIT_GET_ROOM]: ClientToServerEventsArgument<
    string,
    { room: RoomInterface; doodlers: DoodlerInterface[] }
  >;
  [RoomEvents.EMIT_GET_LOBBY_ROOMS]: ClientToServerEventsArgument<
    undefined,
    { rooms: LobbyListedRoom[]; onlineCount?: number }
  >;
}

export interface RoomServerToClientEvents {
  [RoomEvents.ON_DOODLER_JOIN]: (args: { doodler: DoodlerInterface }) => void;
  [RoomEvents.ON_DOODLER_LEAVE]: (args: {
    doodlerId: DoodlerInterface['id'];
  }) => void;
  [RoomEvents.ON_LOBBY_ROOMS_UPDATED]: (args: { rooms: LobbyListedRoom[]; onlineCount?: number }) => void;
}
