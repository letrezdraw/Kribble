import React, {
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from 'react';

import { GameEvents } from '@/constants/Events';
import { useSocket } from '@/contexts/socket';
import { GameInterface, GameStatus } from '@/types/models/game';

interface GameContextInterface {
  game: GameInterface;
  setGame: Dispatch<SetStateAction<GameInterface>>;
}

const defaultGame: GameInterface = {
  id: '',
  status: GameStatus.LOBBY,
  options: {
    round: { current: 0, max: 0 },
    timers: {
      drawing: { current: 0, max: 0 },
      turnEndCooldownTime: { current: 0, max: 0 },
      roundStartCooldownTime: { current: 0, max: 0 },
      chooseWordTime: { current: 0, max: 0 },
      resultCooldownTime: { current: 0, max: 0 },
    },
    word: '',
  },
  canvasOperations: [],
};

const GameContext = createContext<GameContextInterface>({
  game: defaultGame,
  setGame: () => {},
});

const GameProvider = ({ children }: PropsWithChildren) => {
  const [game, setGame] = useState<GameInterface>(defaultGame);
  const { registerEvent, unregisterEvent } = useSocket();

  // Listen for game status updates from server
  useEffect(() => {
    const handleGameStatusUpdate = ({
      game: updatedGame,
    }: {
      game?: GameInterface;
      room?: unknown;
      statusChangeData?: unknown;
    }) => {
      if (updatedGame) {
        setGame(updatedGame);
      }
    };

    registerEvent(GameEvents.ON_GAME_STATUS_UPDATED, handleGameStatusUpdate);

    return () => {
      unregisterEvent(
        GameEvents.ON_GAME_STATUS_UPDATED,
        handleGameStatusUpdate
      );
    };
  }, [registerEvent, unregisterEvent]);

  return (
    <GameContext.Provider
      value={{
        game,
        setGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => useContext(GameContext);

export default GameProvider;
