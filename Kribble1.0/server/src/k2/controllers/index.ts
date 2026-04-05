import DoodlerController from './internal/doodler/index.js';
import { DoodlerControllerInterface } from './internal/doodler/interface.js';
import GameController from './internal/game/index.js';
import { GameControllerInterface } from './internal/game/interface.js';
import RoomController from './internal/room/index.js';
import { RoomControllerInterface } from './internal/room/interface.js';
import SocketController from './internal/socket/index.js';
import { SocketControllerInterface } from './internal/socket/interface.js';

export type ControllerInterface = SocketControllerInterface &
  DoodlerControllerInterface &
  RoomControllerInterface &
  GameControllerInterface;

/**
 * A delegator controller that delegates the control to sub-controllers
 * depending on the accessed handler
 */
class Controller {
  private _socketController = new SocketController();
  private _doodlerController = new DoodlerController();
  private _roomController = new RoomController();
  private _gameController = new GameController();

  constructor() {
    return new Proxy(this, {
      get: (target, prop: keyof ControllerInterface) => {
        if (prop in target) return target[prop as keyof typeof target];
        for (const ctrl of [
          this._socketController,
          this._doodlerController,
          this._roomController,
          this._gameController
        ]) {
          if (prop in ctrl) {
            const property = ctrl[prop as keyof typeof ctrl];
            if (typeof property === 'function')
              return (
                property as ControllerInterface[keyof ControllerInterface]
              ).bind(ctrl);
            return property;
          }
        }
        return undefined;
      }
    }) as unknown as Controller & ControllerInterface;
  }
}

export default Controller;
