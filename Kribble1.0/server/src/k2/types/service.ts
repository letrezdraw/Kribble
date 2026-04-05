import { DoodleServerError } from '../utils/error.js';

export type ServiceResponse<T> = {
  data?: T;
  error?: DoodleServerError;
};
