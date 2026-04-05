import { DoodlerSocketEvents } from '../../constants/events/socket.js';
import { DoodlerModel } from '../../models/DoodlerModel.js';

import { ClientToServerEventsArgument } from './helper.js';

export type DoodlerInterface = DoodlerModel['json'];

export interface DoodlerClientToServerEventsArgumentMap {
  [DoodlerSocketEvents.ON_GET_DOODLER]: ClientToServerEventsArgument<
    undefined,
    DoodlerInterface
  >;
  [DoodlerSocketEvents.ON_SET_DOODLER]: ClientToServerEventsArgument<
    Pick<DoodlerInterface, 'name' | 'avatar'>,
    Pick<DoodlerInterface, 'id'>
  >;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DoodlerServerToClientEvents {}
