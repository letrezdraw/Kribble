import { DoodlerSocketEvents } from '../../../constants/events/socket.js';
import { ClientToServerEvents, SocketType } from '../../../types/socket/index.js';

export interface DoodlerControllerInterface {
  handleDoodlerOnGet: (
    socket: SocketType
  ) => (
    ...args: Parameters<
      ClientToServerEvents[DoodlerSocketEvents.ON_GET_DOODLER]
    >
  ) => void;
  handleDoodlerOnSet: (
    socket: SocketType
  ) => (
    ...args: Parameters<
      ClientToServerEvents[DoodlerSocketEvents.ON_SET_DOODLER]
    >
  ) => void;
}
