/** Kribble 1.0–compatible room row for the lobby browser UI */
export interface LobbyListedRoom {
  id: string;
  name: string;
  hostName?: string;
  playerCount: number;
  maxPlayers: number;
  isPrivate: boolean;
  gameMode: string;
  phase: string;
}
