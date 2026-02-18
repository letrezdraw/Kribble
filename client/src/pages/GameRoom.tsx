import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Pencil, Eraser, Square, Circle, Type, Undo2, Redo2, 
  Trash2, Send, Users, Clock, MessageCircle, Crown, Palette,
  Settings, LogOut, ChevronRight, Trophy, Sparkles, PaintBucket,
  Globe, Timer, Hash, Eye, Gamepad2
} from 'lucide-react';
import { useGame, Player } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { ToolType } from '../components/canvas/types';
import Button from '../components/Button';
import DrawingCanvas from '../components/DrawingCanvas';
import './GameRoom.css';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  isCorrect?: boolean;
  timestamp: Date;
}

const generateMessageId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const colorPalette = {
  grays: ['#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF'],
  reds: ['#330000', '#660000', '#990000', '#CC0000', '#FF0000', '#FF6666'],
  oranges: ['#331900', '#663300', '#994C00', '#CC6600', '#FF8000', '#FFB366'],
  yellows: ['#333300', '#666600', '#999900', '#CCCC00', '#FFFF00', '#FFFF66'],
  greens: ['#003300', '#006600', '#009900', '#00CC00', '#00FF00', '#66FF66'],
  cyans: ['#003333', '#006666', '#009999', '#00CCCC', '#00FFFF', '#66FFFF'],
  blues: ['#000033', '#000066', '#000099', '#0000CC', '#0000FF', '#6666FF'],
  purples: ['#330033', '#660066', '#990099', '#CC00CC', '#FF00FF', '#FF66FF'],
  browns: ['#331A00', '#663300', '#994C00', '#CC6600', '#FF9933', '#FFCC99'],
  skinTones: ['#FFE0BD', '#FFCD94', '#EAC086', '#FFAD60', '#FFE5B4', '#8D5524'],
};

export default function GameRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { room, gameState, isDrawer, isHost, leaveRoom, submitGuess, startGame, rankings, playAgain, selectWord, joinRoom, requestHint } = useGame();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [guess, setGuess] = useState('');
  const [activeTool, setActiveTool] = useState<ToolType>('brush');
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(true);

  const [gameSettings, setGameSettings] = useState({
    maxPlayers: room?.maxPlayers || 8,
    roundTime: room?.settings?.roundTime || 80,
    rounds: room?.settings?.rounds || 3,
    wordCount: 3,
    hints: room?.settings?.hints || 2,
    language: 'English',
    gameMode: 'Normal',
  });
  
  const processedMessageIds = useRef(new Set<string>());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const listenersSetup = useRef(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (roomId && !room) {
      const password = (location.state as any)?.password;
      const joinByCode = (location.state as any)?.joinByCode;
      joinRoom(roomId, password, joinByCode);
    }
  }, [roomId, room, joinRoom, location.state]);

  // Sync room settings to local state - only for non-hosts to receive updates
  useEffect(() => {
    if (room && !isHost) {
      setGameSettings(prev => ({
        ...prev,
        maxPlayers: room.maxPlayers || 8,
        roundTime: room.settings?.roundTime || 80,
        rounds: room.settings?.rounds || 3,
        hints: room.settings?.hints || 2,
        wordCount: room.settings?.wordCount || 3,
        gameMode: room.settings?.gameMode || 'Normal',
        language: room.settings?.language || 'English',
      }));
    }
  }, [room, isHost]);

  // Update settings function with proper room ID from room object
  const updateSettings = useCallback(() => {
    if (!isHost || !socket || !room?.id) {
      return;
    }
    
    socket.emit('room:update-settings', {
      roomId: room.id,
      settings: {
        maxPlayers: gameSettings.maxPlayers,
        roundTime: gameSettings.roundTime,
        rounds: gameSettings.rounds,
        hints: gameSettings.hints,
        wordCount: gameSettings.wordCount,
        gameMode: gameSettings.gameMode,
        language: gameSettings.language,
      }
    });
  }, [isHost, socket, room, gameSettings]);

  const handleClearCanvas = useCallback(() => {
    (window as any).canvasControls?.clear();
  }, []);

  const handleUndo = useCallback(() => {
    (window as any).canvasControls?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    (window as any).canvasControls?.redo();
  }, []);

  useEffect(() => {
    if (!socket || listenersSetup.current) return;
    listenersSetup.current = true;

    const handleChatMessage = (data: ChatMessage & { _local?: boolean }) => {
      if (data._local) return;
      const messageId = (data as any).id || generateMessageId();
      if (processedMessageIds.current.has(messageId)) return;
      processedMessageIds.current.add(messageId);
      
      setMessages(prev => [...prev, {
        ...data,
        id: messageId,
        timestamp: new Date(data.timestamp)
      }]);
    };

    const handlePlayerGuessed = (data: { userId: string; username: string; points: number }) => {
      const messageId = generateMessageId();
      processedMessageIds.current.add(messageId);
      
      const messageText = `${data.username} guessed the word! (+${data.points} pts)`;
      
      setMessages(prev => [...prev, {
        id: messageId,
        userId: 'system',
        username: 'System',
        message: messageText,
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
    } else if (gameState.phase === 'drawing') {
      submitGuess(trimmedGuess);
    } else {
      socket?.emit('chat:message', { message: trimmedGuess });
    }
    setGuess('');
  };

  const getWordDisplay = () => {
    if (!gameState.currentWord) return '???';
    return gameState.wordHints.join(' ');
  };

  const sortedPlayers = [...(room?.players || [])].sort((a: Player, b: Player) => b.score - a.score);

  return (
    <div className="game-room-desktop">
      {/* Header */}
      <header className="game-header-desktop">
        <div className="header-left">
          <div className="room-info">
            <h1 className="room-name">{room?.name || 'Game Room'}</h1>
            <div className="room-meta">
              <span className="player-count">
                <Users size={14} />
                {room?.players?.length || 0} / {room?.maxPlayers || 8}
              </span>
              {isHost && <span className="host-badge"><Crown size={12} /> Host</span>}
            </div>
          </div>
        </div>

        <div className="header-center">
          {room?.phase !== 'waiting' && room?.phase !== 'gameEnd' && (
            <div className="game-status">
              <div className="round-badge">
                Round {gameState.roundNumber} / {gameState.totalRounds}
              </div>
              <div className={`timer-badge ${gameState.turnTimer <= 10 ? 'urgent' : ''}`}>
                <Clock size={16} />
                <span>{gameState.turnTimer}s</span>
              </div>
            </div>
          )}
        </div>


        <div className="header-right">
          <Button variant="ghost" size="sm" onClick={() => {
            leaveRoom();
            navigate('/lobby');
          }}>
            <LogOut size={18} />
            Leave
          </Button>
        </div>
      </header>

      {/* Main Game Area */}
      <div className="game-layout">
        {/* Left Sidebar - Players */}
        <aside className="players-sidebar">
          <div className="sidebar-header">
            <Users size={18} />
            <h3>Players</h3>
            <span className="player-count-badge">{room?.players?.length || 0}</span>
          </div>
          
          <div className="players-list">
            {sortedPlayers.map((player: Player, index: number) => (
              <div 
                key={player.userId} 
                className={`player-card ${player.isDrawer ? 'drawer' : ''} ${player.isHost ? 'host' : ''} ${!player.connected ? 'offline' : ''}`}
              >
                <div className="player-rank">#{index + 1}</div>
                <div className="player-avatar">{player.avatarId}</div>
                <div className="player-info">
                  <div className="player-name">
                    {player.username}
                    {player.isHost && <Crown size={12} className="host-icon" />}
                    {player.isDrawer && <Pencil size={12} className="drawer-icon" />}
                    {!player.connected && <span className="offline-badge">(Offline)</span>}
                  </div>
                  <div className="player-score">{player.score} pts</div>
                </div>
              </div>
            ))}
          </div>

          {room?.phase === 'waiting' && isHost && (
            <div className="lobby-actions">
              <Button variant="primary" fullWidth onClick={startGame}>
                <Sparkles size={16} />
                Start Game
              </Button>
            </div>
          )}

        </aside>

        {/* Center - Canvas Area */}
        <main className="canvas-area">
          {/* Word Display */}
          {room?.phase === 'drawing' && (
            <div className="word-display-bar">
              {isDrawer ? (
                <div className="word-revealed">
                  <span className="word-label">Your word:</span>
                  <span className="word-text">{gameState.currentWord}</span>
                </div>
              ) : (
                <div className="word-hidden">
                  <span className="word-label">Guess the word:</span>
                  <span className="word-blanks">{getWordDisplay()}</span>
                </div>
              )}
              <div 
                className="hints-remaining"
                title="Hints are revealed automatically during the round"
              >
                <Sparkles size={14} />
                {gameState.hintsRemaining} hints remaining
              </div>
              <button 
                className="leave-room-btn-bar"
                onClick={() => {
                  leaveRoom();
                  navigate('/lobby');
                }}
                title="Leave Room"
              >
                <LogOut size={16} />
                Leave
              </button>
            </div>
          )}


          {room?.phase === 'wordSelection' && isDrawer && (

            <div className="word-selection-panel">
              <h3>Choose a word to draw:</h3>
              <div className="word-options">
                {gameState.wordOptions.map((word: string, i: number) => (
                  <button
                    key={i}
                    className="word-option-btn"
                    onClick={() => selectWord(word)}
                  >
                    {word}
                  </button>
                ))}
              </div>
              <div className="selection-timer">
                Choosing in {gameState.wordSelectionTimer}s...
              </div>
            </div>
          )}

          {room?.phase === 'wordSelection' && !isDrawer && (
            <div className="waiting-panel">
              <div className="spinner"></div>
              <p>Waiting for drawer to choose a word...</p>
            </div>
          )}

          {room?.phase === 'roundEnd' && (

            <div className="round-end-panel">
              <h3>Round Complete!</h3>
              <p className="word-reveal">The word was: <strong>{gameState.currentWord}</strong></p>
              <div className="round-scores">
                {sortedPlayers.slice(0, 3).map((player: Player, i: number) => (
                  <div key={player.userId} className="round-score-item">
                    <span className="medal">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                    </span>
                    <span>{player.username}</span>
                    <span className="points">+{player.score} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {room?.phase === 'gameEnd' && rankings && (

            <div className="game-end-panel">
              <Trophy size={48} className="trophy-icon" />
              <h2>Game Over!</h2>
              <div className="final-standings">
                {rankings.map((player: any, index: number) => (
                  <div 
                    key={player.userId}
                    className={`final-player ${index === 0 ? 'winner' : ''}`}
                  >
                    <span className="final-rank">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </span>
                    <span className="final-avatar">{player.avatarId}</span>
                    <span className="final-name">{player.username}</span>
                    <span className="final-score">{player.score}</span>
                  </div>
                ))}
              </div>
              <div className="game-end-actions">
                <Button variant="primary" onClick={playAgain}>Play Again</Button>
                <Button variant="secondary" onClick={() => {
                  leaveRoom();
                  navigate('/lobby');
                }}>Leave Room</Button>
              </div>
            </div>
          )}

          {/* Lobby Waiting Overlay with Settings beside */}
          {room?.phase === 'waiting' && (

            <div className="lobby-waiting-overlay">
              <div className="waiting-animation">
                <div className="waiting-left">
                  <div className="spinner-large"></div>
                  <h2>Waiting for players...</h2>
                  <p>Share the room code with friends to join!</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      leaveRoom();
                      navigate('/lobby');
                    }}
                    className="leave-room-btn"
                  >
                    <LogOut size={16} />
                    Leave Room
                  </Button>
                </div>
                <div className="waiting-right">
                  <div className="room-code-display">
                    <span className="code-label">Room Code:</span>
                    <span className="code-value">{roomId?.toUpperCase()}</span>
                  </div>
                  <div className="waiting-players-list">
                    <h4>Players in room ({room?.players?.length || 0}/{room?.maxPlayers || 8}):</h4>
                    <div className="waiting-avatars">
                      {room?.players?.map((player) => (
                        <div key={player.userId} className="waiting-avatar" title={player.username}>
                          {player.avatarId}
                          {player.isHost && <span className="host-crown">👑</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Game Settings Panel - Beside waiting content */}
                {showSettings && (
                  <div className={`game-settings-panel ${!isHost ? 'read-only' : ''}`}>
                    <h3><Settings size={18} /> Game Settings {isHost && <span className="host-badge-inline">(Host)</span>}</h3>
                    <div className="settings-grid">
                      <div className="setting-item">
                        <label><Users size={14} /> Players</label>
                        {isHost ? (
                          <input 
                            type="number" 
                            min="2" 
                            max="20" 
                            value={gameSettings.maxPlayers}
                            onChange={(e) => setGameSettings({...gameSettings, maxPlayers: parseInt(e.target.value) || 8})}
                          />
                        ) : (
                          <span className="setting-value">{gameSettings.maxPlayers}</span>
                        )}
                      </div>
                      <div className="setting-item">
                        <label><Globe size={14} /> Language</label>
                        {isHost ? (
                          <select 
                            value={gameSettings.language}
                            onChange={(e) => setGameSettings({...gameSettings, language: e.target.value})}
                          >
                            <option>English</option>
                            <option>Spanish</option>
                            <option>French</option>
                            <option>German</option>
                          </select>
                        ) : (
                          <span className="setting-value">{gameSettings.language}</span>
                        )}
                      </div>
                      <div className="setting-item">
                        <label><Timer size={14} /> Draw Time (s)</label>
                        {isHost ? (
                          <input 
                            type="number" 
                            min="30" 
                            max="300" 
                            value={gameSettings.roundTime}
                            onChange={(e) => setGameSettings({...gameSettings, roundTime: parseInt(e.target.value) || 80})}
                          />
                        ) : (
                          <span className="setting-value">{gameSettings.roundTime}s</span>
                        )}
                      </div>
                      <div className="setting-item">
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
                          <span className="setting-value">{gameSettings.rounds}</span>
                        )}
                      </div>
                      <div className="setting-item">
                        <label><Gamepad2 size={14} /> Game Mode</label>
                        {isHost ? (
                          <select 
                            value={gameSettings.gameMode}
                            onChange={(e) => setGameSettings({...gameSettings, gameMode: e.target.value})}
                          >
                            <option>Normal</option>
                            <option>Blitz</option>
                            <option>Custom</option>
                          </select>
                        ) : (
                          <span className="setting-value">{gameSettings.gameMode}</span>
                        )}
                      </div>
                      <div className="setting-item">
                        <label><Hash size={14} /> Word Count</label>
                        {isHost ? (
                          <input 
                            type="number" 
                            min="1" 
                            max="5" 
                            value={gameSettings.wordCount}
                            onChange={(e) => setGameSettings({...gameSettings, wordCount: parseInt(e.target.value) || 3})}
                          />
                        ) : (
                          <span className="setting-value">{gameSettings.wordCount}</span>
                        )}
                      </div>
                      <div className="setting-item">
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
                          <span className="setting-value">{gameSettings.hints}</span>
                        )}
                      </div>
                    </div>
                    {isHost && (
                      <div className="settings-actions">
                        <Button variant="primary" size="sm" onClick={updateSettings}>
                          Apply Settings
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Drawer Indicator - Shows current drawer in multiplayer */}
          {room?.phase === 'drawing' && (

            <div className="drawer-indicator">
              <Pencil size={16} />
              <span className="drawer-label">
                {isDrawer ? 'You are drawing' : `${room?.players.find((p: Player) => p.isDrawer)?.username || 'Someone'} is drawing`}
              </span>
            </div>
          )}

          {/* Canvas */}
          <div className="canvas-wrapper">
            <DrawingCanvas
              isDrawer={isDrawer}
              brushColor={brushColor}
              brushSize={brushSize}
              brushOpacity={1}
              activeTool={activeTool}
              shapeType={activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line' ? activeTool : 'rect'}
              onToolChange={setActiveTool}
              onBrushSizeChange={setBrushSize}
              onBrushColorChange={setBrushColor}
            />
          </div>

          {/* Drawing Tools - Only for drawer */}
          {isDrawer && (
            <div className="drawing-toolbar">
              <div className="tool-group">
                <button 
                  className={`tool-btn ${activeTool === 'brush' ? 'active' : ''}`}
                  onClick={() => setActiveTool('brush')}
                  title="Brush (B)"
                >
                  <Pencil size={20} />
                </button>
                <button 
                  className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`}
                  onClick={() => setActiveTool('eraser')}
                  title="Eraser (E)"
                >
                  <Eraser size={20} />
                </button>
                <button 
                  className={`tool-btn ${activeTool === 'fill' ? 'active' : ''}`}
                  onClick={() => setActiveTool('fill')}
                  title="Fill/Bucket (G)"
                >
                  <PaintBucket size={20} />
                </button>
                <button 
                  className={`tool-btn ${activeTool === 'rect' ? 'active' : ''}`}
                  onClick={() => setActiveTool('rect')}
                  title="Rectangle (M)"
                >
                  <Square size={20} />
                </button>
                <button 
                  className={`tool-btn ${activeTool === 'circle' ? 'active' : ''}`}
                  onClick={() => setActiveTool('circle')}
                  title="Circle (L)"
                >
                  <Circle size={20} />
                </button>
                <button 
                  className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`}
                  onClick={() => setActiveTool('text')}
                  title="Text (T)"
                >
                  <Type size={20} />
                </button>
              </div>

              <div className="tool-divider"></div>

              <div className="color-picker-desktop">
                <div className="color-picker-main">
                  <button 
                    className="active-color-preview"
                    style={{ background: brushColor }}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    title="Current Color"
                  />
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="color-input-native"
                    title="Color Picker"
                  />
                </div>
                
                <AnimatePresence>
                  {showColorPicker && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="color-picker-palette"
                    >
                      {Object.entries(colorPalette).map(([category, colors]) => (
                        <div key={category} className="color-row">
                          {colors.map((color: string) => (
                            <button
                              key={color}
                              className={`color-swatch ${brushColor === color ? 'selected' : ''}`}
                              style={{ background: color }}
                              onClick={() => setBrushColor(color)}
                              title={color}
                            />
                          ))}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="tool-divider"></div>

              <div className="size-slider-group">
                <input 
                  type="range" 
                  min="1" 
                  max="50" 
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="size-slider"
                />
                <span className="size-value">{brushSize}px</span>
              </div>

              <div className="tool-divider"></div>

              <div className="action-group">
                <button className="tool-btn" onClick={handleUndo} title="Undo">
                  <Undo2 size={20} />
                </button>
                <button className="tool-btn" onClick={handleRedo} title="Redo">
                  <Redo2 size={20} />
                </button>
                <button className="tool-btn danger" onClick={handleClearCanvas} title="Clear">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar - Chat */}
        <aside className="chat-sidebar">
          <div className="sidebar-header">
            <MessageCircle size={18} />
            <h3>Chat</h3>
            <span className="message-count">{messages.length}</span>
          </div>
          
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="empty-chat">
                <MessageCircle size={32} />
                <p>No messages yet</p>
                <span>Start chatting with other players!</span>
              </div>
            ) : (
              messages.map((msg: ChatMessage, index: number) => (
                <div 
                  key={`${msg.id}-${index}`}
                  className={`chat-message ${msg.isCorrect ? 'correct-guess' : ''} ${msg.userId === 'system' ? 'system' : ''}`}
                >
                  <span className="message-sender">{msg.username}:</span>
                  <span className="message-text">{msg.message}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          
          <form className="chat-input-form" onSubmit={handleSendGuess}>
            <input
              type="text"
              placeholder={isDrawer ? "Chat with players..." : "Type your guess..."}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              className="chat-input"
            />
            <Button type="submit" variant="primary" size="sm" disabled={!guess.trim()}>
              <Send size={16} />
            </Button>
          </form>
        </aside>
      </div>
    </div>
  );
}
