/**
 * GameRoom.tsx — Kribble 1.0 UI with Kribble 2.0 Multiplayer + Canvas engine
 *
 * This file replaces the old GameRoom.tsx. It keeps the Kribble 1.0 layout/CSS
 * but delegates all game state, room management, and canvas drawing to the
 * Kribble 2.0 engine (K2) through the K2GameRoomProvider wrapper in App.tsx.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pencil, Eraser, Undo2, Redo2, Trash2, Send, Users, Clock,
  MessageCircle, Crown, Sparkles, PaintBucket, Globe, Timer,
  Hash, Eye, Gamepad2, LogOut, Trophy, Settings
} from 'lucide-react';
import Button from '../components/Button';
import './GameRoom.css';

// ───── K2 contexts & types ─────
import { useUser } from '../k2/contexts/user';
import { useRoom } from '../k2/contexts/room';
import { useGame } from '../k2/contexts/game';
import {
  useSocket,
  SocketConnectionState,
  emitFireAndForget,
} from '../k2/contexts/socket';
import CanvasProvider from '../k2/contexts/canvas';
import { GameStatus } from '../k2/types/models/game';
import {
  DoodlerEvents,
  GameEvents,
  RoomEvents,
} from '../k2/constants/Events';
import { GameStatusChangeData, PrivateGameOptions } from '../k2/types/socket/game';

// ───── K2 Canvas component (the actual drawing surface) ─────
import K2Canvas from '../k2/components/Canvas';
import { OptionConfig } from '../k2/components/Canvas/useCanvasActions';
import { OptionKey } from '../k2/components/Option/utils';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  isCorrect?: boolean;
  isNearby?: boolean;
  isSystem?: boolean;
  timestamp: Date;
}

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const colorPalette = {
  grays:     ['#000000','#333333','#666666','#999999','#CCCCCC','#FFFFFF'],
  reds:      ['#330000','#660000','#990000','#CC0000','#FF0000','#FF6666'],
  oranges:   ['#331900','#663300','#994C00','#CC6600','#FF8000','#FFB366'],
  yellows:   ['#333300','#666600','#999900','#CCCC00','#FFFF00','#FFFF66'],
  greens:    ['#003300','#006600','#009900','#00CC00','#00FF00','#66FF66'],
  cyans:     ['#003333','#006666','#009999','#00CCCC','#00FFFF','#66FFFF'],
  blues:     ['#000033','#000066','#000099','#0000CC','#0000FF','#6666FF'],
  purples:   ['#330033','#660066','#990099','#CC00CC','#FF00FF','#FF66FF'],
  browns:    ['#331A00','#663300','#994C00','#CC6600','#FF9933','#FFCC99'],
  skinTones: ['#FFE0BD','#FFCD94','#EAC086','#FFAD60','#FFE5B4','#8D5524'],
};

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
export default function GameRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // K2 contexts
  const { user } = useUser();
  const { room, setRoom } = useRoom();
  const { game, setGame } = useGame();
  const { asyncEmitEvent, registerEvent, unregisterEvent, socketConnectionState } = useSocket();

  const isDrawing = user.id === room.drawerId;
  const isHost    = user.id === room.ownerId;

  // ── Canvas option state (toolbar) ──
  const [optionConfig, setOptionConfig] = useState<OptionConfig>({
    color: '#000000',
    type: undefined,
    brushSize: 5,
  });

  // ── UI state ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [guess, setGuess] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusChangeData, setStatusChangeData] = useState<GameStatusChangeData>();

  // Game settings (for lobby UI)
  const [gameSettings, setGameSettings] = useState({
    maxRounds: 3,
    drawingTime: 120,
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const seenMsgIds = useRef(new Set<string>());

  // ── Scroll chat ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Initial room setup ──
  useEffect(() => {
    if (socketConnectionState !== SocketConnectionState.CONNECTED) return;

    const setup = async () => {
      try {
        // Validate doodler identity
        await asyncEmitEvent(DoodlerEvents.EMIT_GET_DOODLER, undefined);

        // Fetch room data
        if (!roomId) throw new Error('No room ID');
        const { room: roomData, doodlers } = await asyncEmitEvent(RoomEvents.EMIT_GET_ROOM, roomId);
        setRoom({ ...roomData, doodlers });

        // Fetch game if exists
        if (roomData.gameId) {
          const { game: gameData } = await asyncEmitEvent(GameEvents.EMIT_GET_GAME, roomData.gameId);
          setGame(gameData);
        }

        // Register live events
        registerEvent(RoomEvents.ON_DOODLER_JOIN, ({ doodler }) => {
          setRoom(prev => {
            if (prev.doodlers.some(d => d.id === doodler.id)) return prev;
            return { ...prev, doodlers: [...prev.doodlers, doodler] };
          });
          addSystemMsg(`${doodler.name} joined the room!`);
        });

        registerEvent(RoomEvents.ON_DOODLER_LEAVE, ({ doodlerId }) => {
          setRoom(prev => ({ ...prev, doodlers: prev.doodlers.filter(d => d.id !== doodlerId) }));
        });

        registerEvent(
          GameEvents.ON_GAME_STATUS_UPDATED,
          ({ room: updatedRoom, game: updatedGame, statusChangeData: data }) => {
            setRoom(prev => ({ ...updatedRoom, doodlers: prev.doodlers }));
            if (updatedGame) setGame(updatedGame);
            setStatusChangeData(data);

            if (data?.[GameStatus.TURN_END]?.scores) {
              const scores = data[GameStatus.TURN_END]!.scores!;
              setRoom(prev => ({
                ...prev,
                doodlers: prev.doodlers.map(d => ({
                  ...d,
                  score: d.score + (scores[d.id] ?? 0),
                })),
              }));
            }
          }
        );

        registerEvent(GameEvents.ON_GAME_HUNCH, ({ hunch }) => {
          const id = genId();
          if (seenMsgIds.current.has(id)) return;
          seenMsgIds.current.add(id);

          // Find doodler by senderId for display name
          const senderName = room.doodlers.find(d => d.id === hunch.senderId)?.name
            ?? hunch.senderId ?? 'Player';

          const msgText =
            hunch.status === 'correct'
              ? `✅ ${senderName} guessed correctly!`
              : hunch.status === 'nearby'
              ? `🔥 ${senderName}: ${hunch.message} (close!)`
              : `${senderName}: ${hunch.message}`;

          setMessages(prev => [
            ...prev,
            {
              id,
              userId: hunch.senderId ?? 'unknown',
              username: senderName,
              message: msgText,
              isCorrect: hunch.status === 'correct',
              isNearby:  hunch.status === 'nearby',
              timestamp: new Date(),
            },
          ]);
        });
      } catch (e) {
        console.error(e);
        navigate('/lobby');
      } finally {
        setLoading(false);
      }
    };

    void setup();

    return () => {
      unregisterEvent(RoomEvents.ON_DOODLER_JOIN, () => {});
      unregisterEvent(RoomEvents.ON_DOODLER_LEAVE, () => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, socketConnectionState]);

  // ── Sync drawing tool state based on isDrawing ──
  useEffect(() => {
    if (isDrawing) {
      setOptionConfig(prev => ({ ...prev, type: OptionKey.PENCIL }));
    } else {
      setOptionConfig(prev => ({ ...prev, type: undefined }));
    }
  }, [isDrawing]);

  const addSystemMsg = (text: string) => {
    const id = genId();
    setMessages(prev => [
      ...prev,
      { id, userId: 'system', username: 'System', message: text, isSystem: true, timestamp: new Date() },
    ]);
  };

  // ── Game actions ──
  const startGame = useCallback(() => {
    if (!room.id) return;
    const opts: PrivateGameOptions = {
      drawing: gameSettings.drawingTime,
      round: gameSettings.maxRounds,
    };
    emitFireAndForget(GameEvents.EMIT_GAME_START_PRIVATE_GAME, {
      roomId: room.id,
      options: opts,
    });
  }, [room.id, gameSettings]);

  const leaveRoom = useCallback(() => {
    navigate('/lobby');
  }, [navigate]);

  const sendGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || !room.id) return;

    const id = genId();
    seenMsgIds.current.add(id);
    setMessages(prev => [
      ...prev,
      { id, userId: user.id, username: user.name, message: guess.trim(), timestamp: new Date() },
    ]);

    emitFireAndForget(GameEvents.EMIT_GAME_HUNCH, { roomId: room.id, message: guess.trim() });
    setGuess('');
  };

  const handleSelectWord = useCallback((word: string) => {
    if (!room.id) return;
    emitFireAndForget(GameEvents.EMIT_GAME_CHOOSE_WORD, { roomId: room.id, word });
  }, [room.id]);

  const handleClear = useCallback(() => {
    if (!isDrawing || !room.id) return;
    (window as any).k2CanvasControls?.clear?.();
  }, [isDrawing, room.id]);

  const handleUndo = useCallback(() => {
    (window as any).k2CanvasControls?.undo?.();
  }, []);

  const handleRedo = useCallback(() => {
    (window as any).k2CanvasControls?.redo?.();
  }, []);

  const sortedDoodlers = useMemo(
    () => [...(room.doodlers ?? [])].sort((a, b) => b.score - a.score),
    [room.doodlers]
  );

  const wordDisplay = useMemo(() => {
    const w = game.options?.word;
    if (!w || w === '_') return '???';
    if (isDrawing) return w;
    return w.split('').map(c => (c === ' ' ? ' ' : '_')).join(' ');
  }, [game.options?.word, isDrawing]);

  if (loading) {
    return (
      <div className="loading-screen" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
        <div className="spinner" />
        <p style={{ marginLeft: 16, color: 'white' }}>Joining room…</p>
      </div>
    );
  }

  // ── Phase-specific overlays ──
  const renderPhaseOverlay = () => {
    switch (game.status) {
      case GameStatus.CHOOSE_WORD:
        if (!isDrawing) return (
          <div className="waiting-panel">
            <div className="spinner" />
            <p>Waiting for drawer to choose a word…</p>
          </div>
        );
        return (
          <div className="word-selection-panel">
            <h3>Choose a word to draw:</h3>
            <div className="word-options">
              {(statusChangeData?.[GameStatus.CHOOSE_WORD]?.wordOptions ?? []).map((word: string, i: number) => (
                <button key={i} className="word-option-btn" onClick={() => handleSelectWord(word)}>
                  {word}
                </button>
              ))}
            </div>
            <div className="selection-timer">
              Choosing in {game.options.timers.chooseWordTime.current}s…
            </div>
          </div>
        );

      case GameStatus.ROUND_START:
        return (
          <div className="round-end-panel">
            <div className="spinner" />
            <h3>Round {game.options.round.current} Starting…</h3>
            <p>Get ready!</p>
          </div>
        );

      case GameStatus.TURN_END:
        return (
          <div className="round-end-panel">
            <h3>Round Complete!</h3>
            <p className="word-reveal">The word was: <strong>{game.options.word}</strong></p>
            <div className="round-scores">
              {sortedDoodlers.slice(0, 3).map((d, i) => (
                <div key={d.id} className="round-score-item">
                  <span className="medal">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                  <span>{d.name}</span>
                  <span className="points">{d.score} pts</span>
                </div>
              ))}
            </div>
          </div>
        );

      case GameStatus.RESULT: {
        const scoresMap = statusChangeData?.[GameStatus.RESULT]?.results ?? {};
        // Convert Record<id, score> to sorted array with doodler info
        const resultsList = sortedDoodlers.map(d => ({
          ...d,
          score: scoresMap[d.id] ?? d.score,
        })).sort((a, b) => b.score - a.score);
        return (
          <div className="game-end-panel">
            <Trophy size={48} className="trophy-icon" />
            <h2>Game Over!</h2>
            <div className="final-standings">
              {resultsList.map((player, idx) => (
                <div key={player.id} className={`final-player ${idx === 0 ? 'winner' : ''}`}>
                  <span className="final-rank">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  <span className="final-name">{player.name}</span>
                  <span className="final-score">{player.score} pts</span>
                </div>
              ))}
            </div>
            <div className="game-end-actions">
              <Button variant="primary" onClick={startGame}>Play Again</Button>
              <Button variant="secondary" onClick={leaveRoom}>Leave Room</Button>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="game-room-desktop">
      {/* ── Header ── */}
      <header className="game-header-desktop">
        <div className="header-left">
          <div className="room-info">
            <h1 className="room-name">{roomId?.toUpperCase()}</h1>
            <div className="room-meta">
              <span className="player-count">
                <Users size={14} /> {room.doodlers?.length ?? 0} players
              </span>
              {isHost && <span className="host-badge"><Crown size={12} /> Host</span>}
            </div>
          </div>
        </div>

        <div className="header-center">
          {game.status === GameStatus.GAME && (
            <div className="game-status">
              <div className="round-badge">
                Round {game.options.round.current} / {game.options.round.max}
              </div>
              <div className={`timer-badge ${game.options.timers.drawing.current <= 10 ? 'urgent' : ''}`}>
                <Clock size={16} />
                <span>{game.options.timers.drawing.current}s</span>
              </div>
            </div>
          )}
        </div>

        <div className="header-right">
          <Button variant="ghost" size="sm" onClick={leaveRoom}>
            <LogOut size={18} /> Leave
          </Button>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="game-layout">
        {/* Left sidebar — Players */}
        <aside className="players-sidebar">
          <div className="sidebar-header">
            <Users size={18} />
            <h3>Players</h3>
            <span className="player-count-badge">{room.doodlers?.length ?? 0}</span>
          </div>
          <div className="players-list">
            {sortedDoodlers.map((player, index) => (
              <div
                key={player.id}
                className={`player-card ${player.id === room.drawerId ? 'drawer' : ''} ${player.id === room.ownerId ? 'host' : ''}`}
              >
                <div className="player-rank">#{index + 1}</div>
                <div className="player-avatar">🎨</div>
                <div className="player-info">
                  <div className="player-name">
                    {player.name}
                    {player.id === room.ownerId && <Crown size={12} className="host-icon" />}
                    {player.id === room.drawerId && <Pencil size={12} className="drawer-icon" />}
                  </div>
                  <div className="player-score">{player.score} pts</div>
                </div>
              </div>
            ))}
          </div>

          {game.status === GameStatus.LOBBY && isHost && (
            <div className="lobby-actions">
              <Button 
                variant="primary" 
                fullWidth 
                onClick={startGame}
                disabled={(room.doodlers?.length || 0) <= 1}
              >
                <Sparkles size={16} /> {(room.doodlers?.length || 0) <= 1 ? "Wait for players..." : "Start Game"}
              </Button>
            </div>
          )}
        </aside>

        {/* Center — Canvas */}
        <main className="canvas-area">
          {/* Word bar */}
          {game.status === GameStatus.GAME && (
            <div className="word-display-bar">
              {isDrawing ? (
                <div className="word-revealed">
                  <span className="word-label">Your word:</span>
                  <span className="word-text">{game.options.word}</span>
                </div>
              ) : (
                <div className="word-hidden">
                  <span className="word-label">Guess:</span>
                  <span className="word-blanks">{wordDisplay}</span>
                </div>
              )}
              <div className="hints-remaining">
                <Sparkles size={14} /> {game.options.timers.drawing.current}s left
              </div>
            </div>
          )}

          {/* Lobby waiting screen */}
          {game.status === GameStatus.LOBBY && (
            <div className="lobby-waiting-overlay">
              <div className="waiting-animation">
                <div className="waiting-left">
                  <div className="spinner-large" />
                  <h2>Waiting for players…</h2>
                  <p>Share the room code: <strong>{roomId?.toUpperCase()}</strong></p>
                </div>

                {isHost && (
                  <div className="game-settings-panel">
                    <h3><Settings size={18} /> Game Settings</h3>
                    <div className="settings-grid">
                      <div className="setting-item">
                        <label><Hash size={14} /> Rounds</label>
                        <input
                          type="number" min={1} max={10}
                          value={gameSettings.maxRounds}
                          onChange={e => setGameSettings(prev => ({ ...prev, maxRounds: parseInt(e.target.value) || 3 }))}
                        />
                      </div>
                      <div className="setting-item">
                        <label><Timer size={14} /> Draw Time (s)</label>
                        <input
                          type="number" min={30} max={300}
                          value={gameSettings.drawingTime}
                          onChange={e => setGameSettings(prev => ({ ...prev, drawingTime: parseInt(e.target.value) || 120 }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Game-phase overlays */}
          {game.status !== GameStatus.LOBBY && game.status !== GameStatus.GAME && (
            <div className="phase-overlay-container">
              {renderPhaseOverlay()}
            </div>
          )}

          {/* Drawer indicator */}
          {game.status === GameStatus.GAME && (
            <div className="drawer-indicator">
              <Pencil size={16} />
              <span>
                {isDrawing ? 'You are drawing' : `${room.doodlers.find(d => d.id === room.drawerId)?.name ?? 'Someone'} is drawing`}
              </span>
            </div>
          )}

          {/* The canvas */}
          <div className="canvas-wrapper">
            <CanvasProvider>
              <K2Canvas optionConfig={optionConfig} />
            </CanvasProvider>
          </div>

          {/* Toolbar — only for the active drawer */}
          {isDrawing && game.status === GameStatus.GAME && (
            <div className="drawing-toolbar">
              {/* Tools */}
              <div className="tool-group">
                {([
                  { key: OptionKey.PENCIL,  icon: <Pencil size={20} />,      title: 'Brush (B)' },
                  { key: OptionKey.ERASER,  icon: <Eraser size={20} />,      title: 'Eraser (E)' },
                  { key: OptionKey.FILL,    icon: <PaintBucket size={20} />, title: 'Fill (G)' },
                ] as const).map(({ key, icon, title }) => (
                  <button
                    key={key}
                    className={`tool-btn ${optionConfig.type === key ? 'active' : ''}`}
                    onClick={() => setOptionConfig(prev => ({ ...prev, type: key }))}
                    title={title}
                  >
                    {icon}
                  </button>
                ))}

                <button
                  className="tool-btn danger"
                  onClick={handleClear}
                  title="Clear"
                >
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="tool-divider" />

              {/* Colour picker */}
              <div className="color-picker-desktop">
                <div className="color-picker-main">
                  <button
                    className="active-color-preview"
                    style={{ background: optionConfig.color }}
                    onClick={() => setShowColorPicker(v => !v)}
                    title="Current Color"
                  />
                  <input
                    type="color"
                    value={optionConfig.color}
                    onChange={e => setOptionConfig(prev => ({ ...prev, color: e.target.value }))}
                    className="color-input-native"
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
                      {Object.entries(colorPalette).map(([cat, colors]) => (
                        <div key={cat} className="color-row">
                          {colors.map(c => (
                            <button
                              key={c}
                              className={`color-swatch ${optionConfig.color === c ? 'selected' : ''}`}
                              style={{ background: c }}
                              onClick={() => setOptionConfig(prev => ({ ...prev, color: c }))}
                              title={c}
                            />
                          ))}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="tool-divider" />

              {/* Brush size */}
              <div className="size-slider-group">
                <input
                  type="range" min={1} max={50}
                  value={optionConfig.brushSize}
                  onChange={e => setOptionConfig(prev => ({ ...prev, brushSize: parseInt(e.target.value) }))}
                  className="size-slider"
                />
                <span className="size-value">{optionConfig.brushSize}px</span>
              </div>

              <div className="tool-divider" />

              {/* Undo / Redo */}
              <div className="action-group">
                <button className="tool-btn" onClick={handleUndo} title="Undo"><Undo2 size={20} /></button>
                <button className="tool-btn" onClick={handleRedo} title="Redo"><Redo2 size={20} /></button>
              </div>
            </div>
          )}
        </main>

        {/* Right sidebar — Chat / Guesses */}
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
                <span>Start guessing!</span>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={`${msg.id}-${i}`}
                  className={`chat-message ${msg.isCorrect ? 'correct-guess' : ''} ${msg.isNearby ? 'nearby-guess' : ''} ${msg.isSystem ? 'system' : ''}`}
                >
                  <span className="message-sender">{msg.username}:</span>
                  <span className="message-text">{msg.message}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <form className="chat-input-form" onSubmit={sendGuess}>
            <input
              type="text"
              placeholder={isDrawing ? 'Chat with players…' : 'Type your guess…'}
              value={guess}
              onChange={e => setGuess(e.target.value)}
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
