import './GameLayout.css';

import { useEffect, useMemo, useState } from 'react';
import { FaCopy, FaShare, FaUser } from 'react-icons/fa6';
import { useNavigate, useParams } from 'react-router-dom';

import Loading from '@/components/Loading';
import { DoodlerEvents, GameEvents, RoomEvents } from '@/constants/Events';
import texts from '@/constants/texts';
import { useGame } from '@/contexts/game';
import { useRoom } from '@/contexts/room';
import { useSnackbar } from '@/contexts/snackbar';
import { SocketConnectionState, useSocket } from '@/contexts/socket';
import { useUser } from '@/contexts/user';
import useMobile from '@/hooks/useMobile';
import { GameStatus } from '@/types/models/game';
import { GameStatusChangeData } from '@/types/socket/game';
import { ErrorFromServer } from '@/utils/error';

import Bubble from './components/Bubble';
import { OptionConfig } from './components/Canvas/useCanvasActions';
import DetailBar from './components/DetailBar';
import DoodlerList from './components/DoodlerList';
import HunchList from './components/HunchList';
import Main, { Toolbar } from './Main';
import MobileGameLayout from './Mobile';
import ChooseWord from './Status/ChooseWord';
import Lobby from './Status/Lobby';
import Result from './Status/Result';
import RoundStart from './Status/RoundStart';
import TurnEnd from './Status/TurnEnd';

const Game = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { user } = useUser();
  const { game, setGame } = useGame();
  const { room, setRoom } = useRoom();
  const { asyncEmitEvent, registerEvent, socketConnectionState } = useSocket();
  const { openSnackbar } = useSnackbar();
  const isMobile = useMobile();

  const [loading, setLoading] = useState(true);
  const [statusChangeData, setStatusChangeData] =
    useState<GameStatusChangeData>();
  const isDrawing = user.id === room.drawerId;

  // Toolbar state - shared between Main and bottom bar
  const [optionConfig, setOptionConfig] = useState<OptionConfig>({
    color: '#000000',
    type: undefined,
    brushSize: 5,
  });

  const returnToHomePage = () => {
    navigate('/', { replace: true });
  };

  const handleEventsRegistration = () => {
    // When a new doodler joins the room
    registerEvent(RoomEvents.ON_DOODLER_JOIN, ({ doodler }) => {
      setRoom((prev) => {
        // Check if doodler already exists to avoid duplicates
        if (prev.doodlers.some((d) => d.id === doodler.id)) {
          return prev;
        }
        return { ...prev, doodlers: [...prev.doodlers, doodler] };
      });
      openSnackbar({
        message: `${doodler.name} has joined the room!`,
        color: 'warning',
      });
    });

    // When a doodler leaves the room
    registerEvent(RoomEvents.ON_DOODLER_LEAVE, ({ doodlerId }) => {
      setRoom((prev) => ({
        ...prev,
        doodlers: prev.doodlers.filter(({ id }) => id !== doodlerId),
      }));
    });

    // When a game status updates
    registerEvent(
      GameEvents.ON_GAME_STATUS_UPDATED,
      ({ room: updatedRoom, game: updatedGame, statusChangeData: data }) => {
        setRoom((prev) => ({ ...updatedRoom, doodlers: prev.doodlers }));
        if (updatedGame) setGame(updatedGame);
        setStatusChangeData(data);
        if (data?.[GameStatus.TURN_END]?.scores) {
          const addedScores = data[GameStatus.TURN_END].scores;
          setRoom((prev) => ({
            ...prev,
            doodlers: prev.doodlers.map((doodler) => ({
              ...doodler,
              score: doodler.score + (addedScores[doodler.id] ?? 0),
            })),
          }));
        }
      }
    );
  };

  const handleValidateUser = async () => {
    const data = await asyncEmitEvent(
      DoodlerEvents.EMIT_GET_DOODLER,
      undefined
    );
    if (data.id !== user.id) {
      throw new Error('Verification failed!');
    }
    handleEventsRegistration();
  };

  const handleGetRoom = async () => {
    if (!roomId) {
      throw new Error('Invalid Room ID!');
    }
    const { room: roomData, doodlers } = await asyncEmitEvent(
      RoomEvents.EMIT_GET_ROOM,
      roomId
    );
    if (roomData.id !== roomId) {
      throw new Error('Invalid Room ID!');
    }
    setRoom({
      ...roomData,
      doodlers,
    });
    return roomData;
  };

  const handleGetGame = async (gameId?: string) => {
    if (!gameId) return;
    const { game: gameData } = await asyncEmitEvent(
      GameEvents.EMIT_GET_GAME,
      gameId
    );
    setGame(gameData);
  };

  const handleSetup = async () => {
    try {
      await handleValidateUser();
      const roomData = await handleGetRoom();
      await handleGetGame(roomData.gameId);
    } catch (e) {
      if (e instanceof ErrorFromServer || e instanceof Error) {
        openSnackbar({
          message: e.message,
          color: 'error',
          isInfinite: true,
        });
      }
      returnToHomePage();
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const inviteLink = `${window.location.origin}?roomId=${roomId}`;
    navigator.clipboard.writeText(inviteLink);
    openSnackbar({ message: 'Copied invite link!', color: 'success' });
  };

  useEffect(() => {
    if (socketConnectionState !== SocketConnectionState.CONNECTED) {
      returnToHomePage();
      return;
    }
    handleSetup();
  }, [roomId, socketConnectionState]);

  const gameComponent = useMemo(() => {
    switch (game.status) {
      case GameStatus.LOBBY:
        return <Lobby />;
      case GameStatus.CHOOSE_WORD:
        return (
          <ChooseWord
            wordOptions={statusChangeData?.[game.status]?.wordOptions}
          />
        );
      case GameStatus.TURN_END:
        return <TurnEnd scores={statusChangeData?.[game.status]?.scores} />;
      case GameStatus.ROUND_START:
        return <RoundStart />;
      case GameStatus.RESULT:
        return <Result results={statusChangeData?.[game.status]?.results} />;
      default:
        return null;
    }
  }, [game.status, statusChangeData]);

  if (loading) return <Loading fullScreen />;

  if (isMobile) {
    return <MobileGameLayout gameComponent={gameComponent} />;
  }

  return (
    <div className="game-layout">
      {/* Top Bar - 5vh */}
      <div className="game-top-bar">
        <div className="glass-panel" style={{ flex: 1, height: '100%' }}>
          <DetailBar />
        </div>
      </div>

      {/* Left Sidebar - 10vw */}
      <div className="game-left-sidebar">
        <div className="glass-panel" style={{ height: '100%' }}>
          <div className="sidebar-header">
            <FaUser size={16} />
            <span>Players ({room.doodlers.length})</span>
          </div>
          <div className="sidebar-content">
            <DoodlerList />
          </div>
        </div>
      </div>

      {/* Canvas Area - 80vw x 90vh */}
      <div className="game-canvas-area" style={{ position: 'relative' }}>
        <Main
          component={game.status === GameStatus.LOBBY ? null : gameComponent}
          optionConfig={optionConfig}
          setOptionConfig={setOptionConfig}
          isDrawing={isDrawing}
          style={{ position: 'relative', height: '100%' }}
        />

        {/* Glass overlay for lobby - centered over canvas */}
        {game.status === GameStatus.LOBBY && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '75%',
              height: '75%',
              background: 'rgba(26, 26, 46, 0.85)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            {gameComponent}
          </div>
        )}
      </div>

      {/* Right Sidebar - 15vw */}
      <div className="game-right-sidebar">
        <HunchList style={{ height: '100%' }} />
      </div>

      {/* Bottom Bar - 5vh with Toolbar */}
      <div className="game-bottom-bar">
        <div className="glass-panel" style={{ flex: 1, height: '100%' }}>
          <Toolbar
            optionConfig={optionConfig}
            setOptionConfig={setOptionConfig}
            isDrawing={isDrawing}
            onClear={() => {
              // Clear handled via socket in Main component
            }}
          />
        </div>
      </div>

      {/* Private Room Share Bubble */}
      {room.isPrivate && (
        <Bubble>
          <FaShare />
          {texts.game.privateLobby.share}
          <button
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.25rem 0.75rem',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            <FaCopy /> Copy
          </button>
        </Bubble>
      )}
    </div>
  );
};

export default Game;
