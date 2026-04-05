import { RoomSocketEvents } from '../../../constants/events/socket.js';
import { ClientToServerEvents, SocketType } from '../../../types/socket/index.js';

export interface RoomControllerInterface {
  handleRoomOnAddDoodlerToPublicRoom: (
    socket: SocketType
  ) => (
    ...args: Parameters<
      ClientToServerEvents[RoomSocketEvents.ON_ADD_DOODLER_TO_PUBLIC_ROOM]
    >
  ) => void;
  handleRoomOnAddDoodlerToSpecificPublicRoom: (
    socket: SocketType
  ) => (
    ...args: Parameters<
      ClientToServerEvents[RoomSocketEvents.ON_ADD_DOODLER_TO_SPECIFIC_PUBLIC_ROOM]
    >
  ) => void;
  handleRoomOnAddDoodlerToPrivateRoom: (
    socket: SocketType
  ) => (
    ...args: Parameters<
      ClientToServerEvents[RoomSocketEvents.ON_ADD_DOODLER_TO_PRIVATE_ROOM]
    >
  ) => void;
  handleRoomOnCreatePrivateRoom: (
    socket: SocketType
  ) => (
    ...args: Parameters<
      ClientToServerEvents[RoomSocketEvents.ON_CREATE_PRIVATE_ROOM]
    >
  ) => void;
  handleRoomOnGetRoom: (
    socket: SocketType
  ) => (
    ...args: Parameters<ClientToServerEvents[RoomSocketEvents.ON_GET_ROOM]>
  ) => void;
  handleRoomOnGetLobbyRooms: (
    socket: SocketType
  ) => (
    ...args: Parameters<ClientToServerEvents[RoomSocketEvents.ON_GET_LOBBY_ROOMS]>
  ) => void;
}
