import { RoomSocketEvents } from '@/constants/events/socket';
import { RoomModel } from '@/models/RoomModel';

import { ClientToServerEventsArgument } from './helper';
import { LobbyListedRoom } from '../lobby';

import { DoodlerInterface } from './doodler';

export type RoomInterface = RoomModel['json'];

export interface RoomClientToServerEventsArgumentMap {
  [RoomSocketEvents.ON_ADD_DOODLER_TO_PUBLIC_ROOM]: ClientToServerEventsArgument<
    undefined,
    { roomId: RoomInterface['id'] }
  >;
  [RoomSocketEvents.ON_ADD_DOODLER_TO_SPECIFIC_PUBLIC_ROOM]: ClientToServerEventsArgument<
    { roomId: string },
    { roomId: RoomInterface['id'] }
  >;
  [RoomSocketEvents.ON_ADD_DOODLER_TO_PRIVATE_ROOM]: ClientToServerEventsArgument<
    { roomId: string },
    { room: RoomInterface }
  >;
  [RoomSocketEvents.ON_CREATE_PRIVATE_ROOM]: ClientToServerEventsArgument<
    undefined,
    { roomId: RoomInterface['id'] }
  >;
  [RoomSocketEvents.ON_GET_ROOM]: ClientToServerEventsArgument<
    string,
    { room: RoomInterface; doodlers: DoodlerInterface[] }
  >;
  [RoomSocketEvents.ON_GET_LOBBY_ROOMS]: ClientToServerEventsArgument<
    undefined,
    { rooms: LobbyListedRoom[]; onlineCount?: number }
  >;
}

export interface RoomServerToClientEvents {
  [RoomSocketEvents.EMIT_DOODLER_JOIN]: (args: {
    doodler: DoodlerInterface;
  }) => void;
  [RoomSocketEvents.EMIT_DOODLER_LEAVE]: (args: {
    doodlerId: DoodlerInterface['id'];
  }) => void;
  [RoomSocketEvents.EMIT_LOBBY_ROOMS_UPDATED]: (args: { rooms: LobbyListedRoom[]; onlineCount?: number }) => void;
}
