import { SocketType } from '../../../types/socket/index.js';

export interface SocketControllerInterface {
  handleSocketOnDisconnecting: (socket: SocketType) => () => void;
  handleSocketOnDisconnect: (socket: SocketType) => () => void;
  handleSocketOnError: (socket: SocketType) => () => void;
}
