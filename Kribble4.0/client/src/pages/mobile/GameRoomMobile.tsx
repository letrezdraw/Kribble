import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Pencil, Eraser, Square, Circle, Type, Undo2, Redo2, 
  Trash2, Send, Users, Clock, MessageCircle, Crown,
  Palette, LogOut, ChevronLeft, X, Settings, Maximize2,
  Minimize2, PaintBucket, Sparkles, Globe, Timer, Hash, Eye, Gamepad2
} from 'lucide-react';
import { useGame, Player } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { ToolType } from '../../components/canvas/types';
import Button from '../../components/Button';
import DrawingCanvas from '../../components/canvas/DrawingCanvas';
import './GameRoomMobile.css';


interface ChatMessage {
  id: string;
  playerId: string;
  username: string;
  message: string;
  isCorrect?: boolean;
  timestamp: Date;
}

const generateMessageId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const colorPalette = [
  '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
  '#FF0000', '#FF8000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF',
  '#8000FF', '#FF00FF', '#8B4513', '#FFE0BD'
];

export default function GameRoomMobile() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { room, gameState, isDrawer, isHost, leaveRoom, submitGuess, startGame, rankings, playAgain, selectWord, joinRoom, roomError } = useGame();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [guess, setGuess] = useState('');
  const [activeTool, setActiveTool] = useState<ToolType>('brush');
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [showPlayers, setShowPlayers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);


  const [gameSettings, setGameSettings] = useState({
    maxPlayers: room?.maxPlayers || 8,
    roundTime: room?.settings?.roundTime || 80,
    rounds: room?.settings?.totalRounds || room?.settings?.rounds || 3,
    wordCount: 3,
    hints: room?.settings?.hints || 2,
    language: 'English',
    gameMode: 'Normal',
  });

  const processedMessageIds = useRef(new Set<string>());
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const listenersSetup = useRef(false);

  // Auto-scroll chat
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);


  useEffect(() => {
    if (roomId && !room) {
      const password = (location.state as any)?.password;
      const joinByCode = (location.state as any)?.joinByCode;
      joinRoom(roomId, password, joinByCode);
    }
  }, [roomId, room, joinRoom, location.state]);

  // Sync room settings
  useEffect(() => {
    if (room && !isHost) {
      setGameSettings(prev => ({
        ...prev,
        maxPlayers: room.maxPlayers || 8,
        roundTime: room.settings?.roundTime || 80,
        rounds: room.settings?.totalRounds || room.settings?.rounds || 3,
        hints: room.settings?.hints || 2,
        wordCount: room.settings?.wordCount || 3,
        gameMode: room.settings?.gameMode || 'Normal',
        language: room.settings?.language || 'English',
      }));
    }
  }, [room, isHost]);

  const updateSettings = useCallback(() => {
    if (!isHost || !socket || !room?.id) return;
    socket.emit('room:update-settings', {
      roomId: room.id,
      settings: gameSettings
    });
  }, [isHost, socket, room, gameSettings]);

  useEffect(() => {
    if (!socket || listenersSetup.current) return;
    listenersSetup.current = true;

    const handleChatMessage = (data: ChatMessage & { _local?: boolean }) => {
      if (data._local) return;
      const messageId = data.id || generateMessageId();
      if (processedMessageIds.current.has(messageId)) return;
      processedMessageIds.current.add(messageId);
      setMessages(prev => [...prev, { ...data, id: messageId, timestamp: new Date(data.timestamp) }]);
    };

    const handlePlayerGuessed = (data: { userId: string; username: string; points?: number }) => {
      const messageId = generateMessageId();
      processedMessageIds.current.add(messageId);
      setMessages(prev => [...prev, {
        id: messageId,
        playerId: 'system',
        username: 'System',
        message: `${data.username} guessed the word! (+${data.points || 0} pts)`,
        isCorrect: true,
        timestamp: new Date(),
      }]);
    };

    socket.on('chat:message', handleChatMessage);
    socket.on('game:player-guessed', handlePlayerGuessed);

    return () => {
      socket.off('chat:message', handleChatMessage);
      socket.off('game:player-guessed', handlePlayerGuessed);
      listenersSetup.current = false;
    };
  }, [socket]);

  const handleSendGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim()) return;
    const trimmedGuess = guess.trim();
    if (isDrawer) {
      socket?.emit('chat:message', { message: trimmedGuess });
    } else if (room?.phase === 'drawing') {
      submitGuess(trimmedGuess);
    } else {
      socket?.emit('chat:message', { message: trimmedGuess });
    }
    setGuess('');
  };

  const handleClearCanvas = useCallback(() => (window as any).canvasControls?.clear(), []);
  const handleUndo = useCallback(() => (window as any).canvasControls?.undo(), []);
  const handleRedo = useCallback(() => (window as any).canvasControls?.redo(), []);

  const getWordDisplay = () => gameState.currentWord ? gameState.wordHints.join(' ') : '???';
  const visibleTimer = room?.phase === 'wordSelection'
    ? gameState.wordSelectionTimer
    : gameState.turnTimer;
  const canvasTurnKey = `${room?.roundNumber ?? 0}-${room?.currentDrawerIndex ?? -1}-${room?.phase ?? 'waiting'}`;

  const sortedPlayers = [...(room?.players || [])].sort((a: Player, b: Player) => b.score - a.score);
  const isSoloMode = room?.settings?.gameMode === 'solo' || (room?.players?.length === 1 && room?.maxPlayers === 1);

  const toggleFullscreen = () => {
    const newFullscreen = !isFullscreen;
    setIsFullscreen(newFullscreen);
    setShowToolbar(!newFullscreen);
  };

  // Reset canvas transform on mount to ensure proper initial state (50% zoom for mobile)
  useEffect(() => {
    if ((window as any).canvasControls) {
      (window as any).canvasControls.resetTransform();
      setTimeout(() => {
        (window as any).canvasControls.zoomOut?.();
        (window as any).canvasControls.zoomOut?.();
      }, 100);
    }
  }, []);

  if (!room) {
    return (
      <div className="game-room-mobile lobby-screen">
        <header className="lobby-header">
          <button className="icon-btn" onClick={() => navigate('/lobby')}>
            <ChevronLeft size={24} />
          </button>
          <h1>Joining Room</h1>
          <div style={{ width: 40 }} />
        </header>

        <main className="lobby-content">
          <div className="lobby-card">
            <div className="spinner-large" />
            <h2>Joining room...</h2>
            <p>{roomError || 'Loading room state from server.'}</p>
          </div>
        </main>
      </div>
    );
  }

  // If in waiting phase, show full lobby screen
  if (room?.phase === 'waiting') {

    return (
      <div className="game-room-mobile lobby-screen">
        <header className="lobby-header">
          <button className="icon-btn" onClick={() => navigate('/lobby')}>
            <ChevronLeft size={24} />
          </button>
          <h1>{room?.name || 'Game Room'}</h1>
          <div style={{ width: 40 }} />
        </header>

        <main className="lobby-content">
          <div className="lobby-card">
            <div className="spinner-large" />
            <h2>Waiting for players...</h2>
            
            <div className="room-code-box">
              <span className="label">Room Code</span>
              <span className="code">{roomId?.split('-')[1]?.toUpperCase() || roomId}</span>
              <span className="players-count">{room?.players?.length || 0} / {room?.maxPlayers || 8} players</span>
            </div>

            {/* Players List */}
            <div className="lobby-players">
              <h3>Players in room</h3>
              <div className="players-avatars">
              {room?.players?.map((player) => (
                <div key={player.userId} className="player-avatar-item" title={player.username}>

                    <span className="avatar-emoji">{player.avatarId}</span>
                    {player.isHost && <span className="host-badge">👑</span>}
                    <span className="player-name-tag">{player.username}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Game Settings */}
            <div className="lobby-settings">
              <div className="settings-header" onClick={() => setShowSettings(!showSettings)}>
                <Settings size={18} />
                <span>Game Settings</span>
                {isHost && <span className="host-tag">Host</span>}
              </div>
              
              {showSettings && (
                <div className="settings-panel">
                  <div className="setting-row">
                    <label><Users size={14} /> Players</label>
                    {isHost ? (
                      <input 
                        type="number" 
                        min="1" 
                        max="20" 
                        value={gameSettings.maxPlayers}
                        onChange={(e) => setGameSettings({...gameSettings, maxPlayers: parseInt(e.target.value) || 8})}
                      />
                    ) : (
                      <span className="value">{gameSettings.maxPlayers}</span>
                    )}
                  </div>
                  
                  <div className="setting-row">
                    <label><Timer size={14} /> Draw Time</label>
                    {isHost ? (
                      <input 
                        type="number" 
                        min="30" 
                        max="300" 
                        value={gameSettings.roundTime}
                        onChange={(e) => setGameSettings({...gameSettings, roundTime: parseInt(e.target.value) || 80})}
                      />
                    ) : (
                      <span className="value">{gameSettings.roundTime}s</span>
                    )}
                  </div>
                  
                  <div className="setting-row">
                    <label><Hash size={14} /> Rounds</label>
                    {isHost ? (
                      <input 
                        type="number" 
                        min="1" 
                        max="10" 
                        value={gameSettings.rounds}
                        onChange={(e) => setGameSettings({...gameSettings, rounds: parseInt(e.target.value) || 3})}
                      />
                    ) : (
                      <span className="value">{gameSettings.rounds}</span>
                    )}
                  </div>
                  
                  <div className="setting-row">
                    <label><Gamepad2 size={14} /> Mode</label>
                    {isHost ? (
                      <select 
                        value={gameSettings.gameMode}
                        onChange={(e) => setGameSettings({...gameSettings, gameMode: e.target.value})}
                      >
                        <option>Normal</option>
                        <option>Solo</option>
                        <option>Blitz</option>
                      </select>
                    ) : (
                      <span className="value">{gameSettings.gameMode}</span>
                    )}
                  </div>
                  
                  <div className="setting-row">
                    <label><Eye size={14} /> Hints</label>
                    {isHost ? (
                      <input 
                        type="number" 
                        min="0" 
                        max="5" 
                        value={gameSettings.hints}
                        onChange={(e) => setGameSettings({...gameSettings, hints: parseInt(e.target.value) || 2})}
                      />
                    ) : (
                      <span className="value">{gameSettings.hints}</span>
                    )}
                  </div>

                  {isHost && (
                    <button className="apply-btn" onClick={updateSettings}>
                      Apply Settings
                    </button>
                  )}
                </div>
              )}
            </div>

            {isHost && (
              <Button variant="primary" fullWidth onClick={startGame} className="start-btn">
                <Sparkles size={18} />
                Start Game
              </Button>
            )}
            
            <Button 
              variant="ghost" 
              fullWidth 
              onClick={() => {
                leaveRoom();
                navigate('/lobby');
              }}
              className="leave-btn"
            >
              <LogOut size={18} />
              Leave Room
            </Button>
          </div>
        </main>


        {/* Chat Button - Always visible in lobby */}
        <button className="floating-chat-btn" onClick={() => setShowPlayers(true)}>
          <MessageCircle size={24} />
          {messages.length > 0 && <span className="badge">{messages.length}</span>}
        </button>

        {/* Chat Bottom Sheet for Lobby */}
        <AnimatePresence>
          {showPlayers && (
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bottom-sheet"
            >
              <div className="sheet-header">
                <h3>Chat</h3>
                <button className="icon-btn" onClick={() => setShowPlayers(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="sheet-content chat-content" ref={chatMessagesRef}>
                {messages.length === 0 ? (
                  <div className="empty-state">
                    <MessageCircle size={32} />
                    <p>No messages yet</p>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div key={`${msg.id}-${index}`} className={`chat-bubble ${msg.isCorrect ? 'correct' : ''} ${msg.playerId === 'system' ? 'system' : ''}`}>
                      <span className="sender">{msg.username}</span>
                      <span className="text">{msg.message}</span>
                    </div>
                  ))
                )}
              </div>
              <form className="chat-input-bar" onSubmit={handleSendGuess}>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  className="chat-input"
                />
                <Button type="submit" variant="primary" size="sm" disabled={!guess.trim()}>
                  <Send size={16} />
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Main game screen
  return (
    <div className={`game-room-mobile ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Game Header */}
      <header className={`game-header ${isFullscreen ? 'hidden' : ''}`}>
        <div className="header-top">
          <button className="icon-btn" onClick={() => navigate('/lobby')}>
            <ChevronLeft size={20} />
          </button>
          
          <div className="header-center">
            <h1 className="room-title">{room?.name || 'Game'}</h1>
            <div className="game-badges">
            {(room?.phase === 'drawing' || room?.phase === 'wordSelection') && gameState.roundNumber > 0 ? (
                <>
                  <span className="badge round">Round {gameState.roundNumber}/{gameState.totalRounds}</span>
                  <span className={`badge timer ${visibleTimer <= 10 ? 'urgent' : ''}`}>
                    <Clock size={10} />
                    {visibleTimer}s
                  </span>
                </>

              ) : null}
            </div>
          </div>

          <div className="header-actions">
            <button className="action-btn" onClick={() => setShowPlayers(true)}>
              <Users size={22} />
            </button>
          </div>
        </div>

        {/* Drawer Indicator */}
        {room?.phase === 'drawing' && (

          <div className="drawer-indicator">
            <Pencil size={14} />
            <span>
              {room?.players?.find(p => p.isDrawer)?.username || 'Someone'} is drawing
            </span>
          </div>
        )}

        {/* Word Bar */}
        {room?.phase === 'drawing' && (

          <div className="word-bar">
            {isDrawer ? (
              <span className="word-text">Draw: <strong>{gameState.currentWord}</strong></span>
            ) : (
              <span className="word-hints">{getWordDisplay()}</span>
            )}
          </div>
        )}

        {room?.phase === 'wordSelection' && isDrawer && (
          <div className="word-bar selection">
            <span>Choose a word to draw...</span>
          </div>
        )}

        {room?.phase === 'wordSelection' && !isDrawer && (
          <div className="word-bar selection">
            <span>Waiting for {room?.players?.find(p => p.isDrawer)?.username || 'drawer'} to choose...</span>
          </div>
        )}
      </header>

      {/* Canvas Area */}
      <main className="canvas-container-mobile">
        <div className="canvas-wrapper-mobile">
          <DrawingCanvas
            key={canvasTurnKey}
            isDrawer={isDrawer}
            brushColor={brushColor}
            brushSize={brushSize}
            brushOpacity={brushOpacity / 100}
            activeTool={activeTool}
            roomId={roomId}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClearCanvas}
            isMobile={true}
          />
        </div>


        {/* Fullscreen Toggle */}
        <button className="fullscreen-toggle" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>

        {/* Drawing Toolbar - Only show for drawer */}
        {isDrawer && showToolbar && (

          <div className="floating-toolbar">

            <div className="toolbar-section tools">


              <button className={`tool-btn ${activeTool === 'brush' ? 'active' : ''}`} onClick={() => setActiveTool('brush')}>
                <Pencil size={18} />
              </button>
              <button className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`} onClick={() => setActiveTool('eraser')}>
                <Eraser size={18} />
              </button>
              <button className={`tool-btn ${activeTool === 'fill' ? 'active' : ''}`} onClick={() => setActiveTool('fill')}>
                <PaintBucket size={18} />
              </button>
              <button className={`tool-btn ${activeTool === 'rect' ? 'active' : ''}`} onClick={() => setActiveTool('rect')}>
                <Square size={18} />
              </button>
              <button className={`tool-btn ${activeTool === 'circle' ? 'active' : ''}`} onClick={() => setActiveTool('circle')}>
                <Circle size={18} />
              </button>
              <button className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => setActiveTool('text')}>
                <Type size={18} />
              </button>
            </div>

            <div className="toolbar-section colors">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  className={`color-dot ${brushColor === color ? 'active' : ''}`}
                  style={{ background: color }}
                  onClick={() => setBrushColor(color)}
                />
              ))}
              <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} className="color-native" />
            </div>

            <div className="toolbar-section actions">
              <div className="slider-group">
                <span className="slider-label">Size</span>
                <input type="range" min="1" max="50" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="size-slider" />
                <span className="slider-value">{brushSize}</span>
              </div>
              <button className="tool-btn" onClick={handleUndo}><Undo2 size={18} /></button>

              <button className="tool-btn" onClick={handleRedo}><Redo2 size={18} /></button>
              <button className="tool-btn danger" onClick={handleClearCanvas}><Trash2 size={18} /></button>
            </div>
          </div>
        )}

        {isDrawer && !showToolbar && (

          <button className="toolbar-show-btn" onClick={() => setShowToolbar(true)}>
            <Palette size={20} />
          </button>
        )}


        {/* Fixed Chat Panel - Bottom 30% (Permanent, no toggle) */}
        <div className="fixed-chat-panel">
          <div className="chat-messages-scrollable" ref={chatMessagesRef}>
            {messages.length === 0 ? (
              <div className="empty-state-compact">
                <MessageCircle size={20} />
                <p>No messages yet</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={`${msg.id}-${index}`} 
                  className={`chat-bubble-compact ${msg.isCorrect ? 'correct' : ''} ${msg.playerId === 'system' ? 'system' : ''}`}
                >
                  <span className="sender-compact">{msg.username}:</span>
                  <span className="text-compact">{msg.message}</span>
                </div>
              ))
            )}
          </div>
          <form className="chat-input-compact" onSubmit={handleSendGuess}>
            <input
              type="text"
              placeholder={isDrawer ? "Chat..." : "Your guess..."}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              className="chat-input-field"
            />
            <Button type="submit" variant="primary" size="sm" disabled={!guess.trim()}>
              <Send size={14} />
            </Button>
          </form>
        </div>


        {/* Overlays */}
        {room?.phase === 'wordSelection' && isDrawer && (
          <div className="overlay-panel word-select">
            <h3>Choose a word</h3>
            <div className="word-grid">
              {gameState.wordOptions.map((word: string, i: number) => (
                <button key={i} className="word-btn" onClick={() => selectWord(word)}>{word}</button>
              ))}
            </div>
            <div className="timer-text">{gameState.wordSelectionTimer}s</div>
          </div>
        )}

        {room?.phase === 'wordSelection' && !isDrawer && (

          <div className="overlay-panel waiting">
            <div className="spinner" />
            <p>Waiting for drawer to choose...</p>
          </div>
        )}

        {room?.phase === 'turnEnd' && (
          <div className="overlay-panel round-end">
            <h3>Turn Ended!</h3>
            <p className="word-reveal">The word was: <strong>{gameState.currentWord}</strong></p>
            <div className="round-scores">
              {(gameState.turnAwards.length > 0 ? gameState.turnAwards : [{
                userId: 'system',
                username: 'No correct guesses',
                points: 0,
              }]).map((award, index) => (
                <div key={`${award.userId}-${index}`} className="round-score-item">
                  <span>{award.username}</span>
                  <span className="points">+{award.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {room?.phase === 'roundEnd' && (

          <div className="overlay-panel round-end">
            <h3>Round Complete!</h3>
            <p className="word-reveal">The word was: <strong>{gameState.currentWord}</strong></p>
          </div>
        )}

        {room?.phase === 'gameEnd' && rankings && (
          <div className="overlay-panel game-end">
            <Crown size={40} className="winner-icon" />
            <h2>Game Over!</h2>
            <div className="podium">
              {rankings.slice(0, 3).map((player: any, index: number) => (
                <div key={player.userId} className={`podium-item rank-${index + 1}`}>

                  <span className="medal">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                  <span className="name">{player.username}</span>
                  <span className="score">{player.score}</span>
                </div>
              ))}
            </div>
            <div className="overlay-actions">
              <Button variant="primary" size="sm" onClick={playAgain}>Play Again</Button>
              <Button variant="ghost" size="sm" onClick={() => { leaveRoom(); navigate('/lobby'); }}>Leave</Button>
            </div>
          </div>
        )}
      </main>

      {/* Players Bottom Sheet */}
      <AnimatePresence>
        {showPlayers && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="bottom-sheet">
            <div className="sheet-header">
              <h3>Players ({room?.players?.length || 0})</h3>
              <button className="icon-btn" onClick={() => setShowPlayers(false)}><X size={20} /></button>
            </div>
            <div className="sheet-content players-content">
              {sortedPlayers.map((player, index) => (
                <div key={player.userId} className={`player-row ${player.isDrawer ? 'drawer' : ''}`}>

                  <div className="rank">#{index + 1}</div>
                  <div className="avatar">{player.avatarId}</div>
                  <div className="info">
                    <div className="name">{player.username}{player.isHost && <Crown size={10} className="host-icon" />}</div>
                    <div className="score">{player.score} pts</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
