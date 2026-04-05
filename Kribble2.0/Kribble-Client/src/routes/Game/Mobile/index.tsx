import '../GameLayout.css';

import { useState } from 'react';
import { FaUser } from 'react-icons/fa6';

import CanvasProvider from '@/contexts/canvas';
import { useGame } from '@/contexts/game';
import { useRoom } from '@/contexts/room';
import { useUser } from '@/contexts/user';
import { GameStatus } from '@/types/models/game';

import { OptionConfig } from '../components/Canvas/useCanvasActions';
import DetailBar from '../components/DetailBar';
import DoodlerList from '../components/DoodlerList';
import HunchList from '../components/HunchList';
import Main, { Toolbar } from '../Main';

interface MobileGameLayoutProps {
  gameComponent: React.ReactNode;
}

const MobileGameLayout = ({ gameComponent }: MobileGameLayoutProps) => {
  const [showPlayers, setShowPlayers] = useState(false);
  const { game } = useGame();
  const { user } = useUser();
  const {
    room: { drawerId },
  } = useRoom();

  const isDrawingPhase = game.status === GameStatus.GAME;
  const isDrawing = user.id === drawerId;

  // Toolbar state
  const [optionConfig, setOptionConfig] = useState<OptionConfig>({
    color: '#000000',
    type: undefined,
    brushSize: 5,
  });

  return (
    <div className="mobile-game-layout-new">
      {/* Top Bar - Timer | Word | Rounds | Players */}
      <div className="mobile-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <DetailBar />
        </div>
        <button
          className="mobile-players-btn"
          onClick={() => setShowPlayers(!showPlayers)}
        >
          <FaUser size={14} />
          <span>Players</span>
        </button>
      </div>

      {/* Canvas Section */}
      <div className="mobile-canvas-section">
        <div className="mobile-canvas-area" style={{ position: 'relative' }}>
          <CanvasProvider>
            <Main
              component={
                game.status === GameStatus.LOBBY ? null : gameComponent
              }
              optionConfig={optionConfig}
              setOptionConfig={setOptionConfig}
              isDrawing={isDrawing}
              style={{ position: 'relative', height: '100%' }}
            />
          </CanvasProvider>

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

        {/* Toolbar */}
        {isDrawingPhase && isDrawing && (
          <div className="mobile-toolbar">
            <Toolbar
              optionConfig={optionConfig}
              setOptionConfig={setOptionConfig}
              isDrawing={isDrawing}
              onClear={() => {
                // Clear handled via socket
              }}
              onUndo={() => {
                // Undo handled via canvas engine
              }}
              onRedo={() => {
                // Redo handled via canvas engine
              }}
              canUndo={false}
              canRedo={false}
            />
          </div>
        )}
      </div>

      {/* Players Panel - Overlay */}
      {showPlayers && (
        <div className="mobile-players-panel">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}
          >
            <h3 style={{ margin: 0, color: 'white' }}>Players</h3>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setShowPlayers(false)}
            >
              Close
            </button>
          </div>
          <DoodlerList />
        </div>
      )}

      {/* Chat Section - Fixed at bottom */}
      <div className="mobile-chat-section">
        <div className="mobile-chat-messages">
          <HunchList />
        </div>
      </div>
    </div>
  );
};

export default MobileGameLayout;
