import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PenTool, Eraser, Circle, Square, Undo, Redo, Palette, 
  Users, Trophy, Clock, Zap, Check, Send, Crown, Edit3 
} from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { socketService } from '../services/socket';
import { DrawingEngine } from '@kribble/drawing-engine';
import './GamePage.css';

const tools = ['pen', 'eraser', 'line', 'rect', 'circle'] as const;
type Tool = typeof tools[number];

export default function GamePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DrawingEngine | null>(null);
  
  const {
    currentRoom,
    user,
    gamePhase,
    currentDrawerId,
    currentWord,
    wordOptions,
    currentRound,
    maxRounds,
    setGamePhase,
    setCurrentDrawerId,
    setCurrentWord,
    setWordOptions,
    setRoundTime,
    setCurrentRound,
  } = useGameStore();

  const [guess, setGuess] = useState('');
  const [isDrawer, setIsDrawer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [activeTool, setActiveTool] = useState<Tool>('pen');
  const [brushSize, setBrushSize] = useState(4);
  const [brushColor, setBrushColor] = useState('#0ea5e9');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize drawing engine
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new DrawingEngine(canvasRef.current);
    engine.setTool(activeTool);
    engine.setBrushSize(brushSize);
    engine.setColor(brushColor);
    engineRef.current = engine;

    return () => {
      engineRef.current = null;
    };
  }, []);

  // Tool/brush sync
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setTool(activeTool);
      engineRef.current.setBrushSize(brushSize);
      engineRef.current.setColor(brushColor);
    }
  }, [activeTool, brushSize, brushColor]);

  // Check if current user is drawer
  useEffect(() => {
    if (currentDrawerId && user) {
      setIsDrawer(currentDrawerId === user.id);
    }
  }, [currentDrawerId, user]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) return 60;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Set up socket listeners
  useEffect(() => {
    if (code) {
      socketService.setActiveRoomCode(code);
      socketService.send({ type: 'room:resync', code });
    }

    const unsubPhase = socketService.on('game:phase', (data) => {
      setGamePhase(data.phase);
    });

    const unsubWordSelection = socketService.on('game:wordSelection', (data) => {
      setCurrentDrawerId(data.drawerId);
      setWordOptions(data.options);
      setGamePhase('wordSelection');
    });

    const unsubYourWord = socketService.on('game:yourWord', (data: any) => {
      setCurrentWord(data.word);
      setIsDrawer(true);
    });

    const unsubDrawing = socketService.on('game:drawing', (data: any) => {
      setCurrentDrawerId(data.drawerId);
      setIsDrawer(false);
      setGamePhase('drawing');
    });

    const unsubStroke = socketService.on('stroke:new', (data: any) => {
      if (engineRef.current && !isDrawer) {
        // Sync incoming strokes
        engineRef.current?.addStroke(data.stroke);
      }
    });

    return () => {
      socketService.setActiveRoomCode(null);
      unsubPhase();
      unsubWordSelection();
      unsubYourWord();
      unsubDrawing();
      unsubStroke();
    };
  }, [code, isDrawer]);

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || !code) return;

    socketService.send({
      type: 'guess',
      code,
      text: guess.trim(),
    });
    setGuess('');
  };

  const handleWordSelect = (word: string) => {
    if (!code) return;
    socketService.send({
      type: 'word:select',
      code,
      word,
    });
    setWordOptions(null);
  };

  const changeTool = (tool: Tool) => {
    setActiveTool(tool);
  };

  const handleDrawing = useCallback((type: string, data: any) => {
    if (isDrawer) {
      socketService.send({
        type: `stroke:${type}` as const,
        ...data,
      });
    }
  }, [isDrawer]);

  const renderToolBar = () => (
    <div className="tool-bar">
      {[ 'pen', 'eraser', 'line', 'rect', 'circle' ].map((tool) => (
        <motion.button
          key={tool}
          className={`tool-btn ${activeTool === tool ? 'active' : ''}`}
          onClick={() => changeTool(tool as Tool)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {tool === 'pen' && <PenTool size={24} />}
          {tool === 'eraser' && <Eraser size={24} />}
          {tool === 'line' && <Edit3 size={24} />}
          {tool === 'rect' && <Square size={24} />}
          {tool === 'circle' && <Circle size={24} />}
        </motion.button>
      ))}
    </div>
  );

  const renderSidebar = () => (
    <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      {/* Game Header */}
      <div className="game-header flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold gradient-text">Game</div>
          {currentRoom && (
            <div className="text-sm bg-primary-100 text-primary-800 px-3 py-1 rounded-full font-medium">
              {currentRound}/{maxRounds}
            </div>
          )}
        </div>
        <motion.button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Users size={24} />
        </motion.button>
      </div>

      {/* Timer */}
      <div className="glass p-6 rounded-3xl mx-4 mt-6 shadow-2xl text-center">
        <div className="timer-circle">
          {timeLeft}
        </div>
        <div className="mt-4 text-2xl font-black gradient-text">
          {timeLeft <= 10 ? 'Hurry!' : 'Time Left'}
        </div>
      </div>

      {/* Word Display */}
      {currentWord ? (
        isDrawer ? (
          <motion.div 
            className="word-hint glass mx-6 shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="drawer-indicator">
              YOUR WORD
            </div>
            <div className="text-4xl lg:text-5xl">{currentWord}</div>
          </motion.div>
        ) : (
          <motion.div 
            className="word-hint glass mx-6 shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="text-4xl lg:text-5xl mb-4">
              {currentWord.split('').map((char, i) => (
                <span key={i} className="mx-1">_</span>
              ))}
            </div>
            <div className="text-sm text-slate-600 uppercase tracking-wide font-bold">
              Guess the drawing!
            </div>
          </motion.div>
        )
      ) : null}

      {/* Guess Input */}
      {!isDrawer && gamePhase === 'guessing' && (
        <motion.form 
          className="guess-input mx-6 mt-6"
          onSubmit={handleGuessSubmit}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <input
            type="text"
            className="w-full"
            placeholder="Type your guess here..."
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            autoFocus
          />
          <motion.button 
            type="submit" 
            className="guess-btn"
            disabled={!guess.trim()}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 1.05 }}
          >
            <Send size={20} />
          </motion.button>
        </motion.form>
      )}

      {/* Players List */}
      {currentRoom && (
        <motion.div 
          className="player-list-sidebar mx-6 mt-8 p-6 glass rounded-3xl shadow-xl"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <h3 className="font-bold text-xl mb-6 flex items-center gap-2 gradient-text">
            <Users size={24} />
            Players ({currentRoom.players.length}/{currentRoom.maxPlayers})
          </h3>
          <div className="space-y-3">
            {currentRoom.players.map((player, index) => (
              <motion.div
                key={player.id}
                className="flex items-center gap-4 p-4 glass-hover rounded-2xl px-4 py-3"
                whileHover={{ scale: 1.02 }}
              >
                <div 
                  className="avatar w-12 h-12 flex items-center justify-center font-bold text-lg shadow-lg"
                  style={{ backgroundColor: `hsl(${index * 137 % 360}, 70%, 85%)` }}
                >
                  {player.displayName[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 truncate">{player.displayName}</div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                    Score <span className="font-mono ml-1">{player.score}</span>
                  </div>
                </div>
                <div className="score-badge">
                  {player.score}
                </div>
                {player.id === currentDrawerId && (
                  <div className="ml-auto">
                    <Crown size={20} className="text-accent-500" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (gamePhase) {
      case 'wordSelection':
        if (isDrawer && wordOptions) {
          return (
            <div className="glass p-12 rounded-3xl text-center shadow-2xl max-w-2xl mx-auto mt-32">
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-block p-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl mb-12 shadow-2xl"
              >
                <PenTool className="w-32 h-32 text-primary-500 mx-auto mb-8 animate-bounce" />
              </motion.div>
              <h2 className="text-4xl font-black mb-8 gradient-text">Choose Your Word</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {wordOptions.map((word, index) => (
                  <motion.button
                    key={word}
                    className="glass p-8 rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl active:shadow-xl"
                    onClick={() => handleWordSelect(word)}
                    initial={{ scale: 0.9, opacity: 0, y: 30 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.05, y: -10 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="text-3xl font-black mb-4">{word}</div>
                    <div className="text-sm text-slate-600 uppercase tracking-wide">Select this word</div>
                  </motion.button>
                ))}
              </div>
              <p className="text-slate-500 mt-12 text-lg">Choose wisely - your friends have to guess it!</p>
            </div>
          );
        }
        return (
          <div className="glass p-12 rounded-3xl text-center shadow-2xl max-w-2xl mx-auto mt-32">
            <motion.div 
              className="inline-block p-8 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl mb-8 shadow-xl"
              initial={{ rotate: -10 }}
              animate={{ rotate: 10 }}
              transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
            >
              <PenTool className="w-24 h-24 text-slate-400" />
            </motion.div>
            <h2 className="text-4xl font-black mb-4 gradient-text">Drawer Choosing</h2>
            <p className="text-xl text-slate-500 mb-8">The artist is picking the perfect word...</p>
            <div className="dots">
              <div className="dot"></div>
              <div className="dot" style={{animationDelay: '0.2s'}}></div>
              <div className="dot" style={{animationDelay: '0.4s'}}></div>
            </div>
          </div>
        );

      case 'drawing':
      case 'guessing':
        return (
          <div className="game-layout flex">
            <div className="flex-1 flex flex-col">
              <div className="canvas-container">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full"
                  style={{ touchAction: 'none', cursor: 'crosshair' }}
                />
                {isDrawer && renderToolBar()}
                {currentDrawerId && currentDrawerId !== user?.id && (
                  <div className="drawer-indicator">
                    <Crown size={20} className="inline mr-1" />
                    {currentRoom?.players.find(p => p.id === currentDrawerId)?.displayName} drawing
                  </div>
                )}
              </div>
            </div>

            {renderSidebar()}
          </div>
        );

      case 'roundEnd':
        return (
          <motion.div 
            className="glass p-16 rounded-3xl text-center shadow-2xl max-w-4xl mx-auto mt-24"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <motion.div 
              className="trophy w-32 h-32 mx-auto mb-8"
              animate={{ rotateY: 360 }}
              transition={{ duration: 1 }}
            >
              🏆
            </motion.div>
            <h2 className="text-5xl font-black mb-6 gradient-text">Round Complete!</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              {currentRoom?.players
                .sort((a, b) => b.score - a.score)
                .slice(0, 4)
                .map((player, index) => (
                  <motion.div 
                    key={player.id} 
                    className="glass p-6 rounded-2xl shadow-lg border border-slate-200/50 flex items-center gap-4"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className={`text-3xl font-black ${index === 0 ? 'text-yellow-500 drop-shadow-lg' : index === 1 ? 'text-slate-500' : index === 2 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 3}
                    </div>
                    <div>
                      <div className="font-bold text-xl">{player.displayName}</div>
                      <div className="score-badge ml-auto">
                        {player.score}
                      </div>
                    </div>
                  </motion.div>
                ))}
            </div>
            <motion.button 
              onClick={() => navigate('/')} 
              className="btn btn-primary btn-lg px-12 py-6 text-xl"
              whileHover={{ scale: 1.05 }}
            >
              Play Again
            </motion.button>
          </motion.div>
        );

      case 'gameEnd':
        const winner = currentRoom?.players.sort((a, b) => b.score - a.score)[0];
        return (
          <motion.div 
            className="glass p-16 rounded-3xl text-center shadow-2xl max-w-3xl mx-auto mt-24"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <motion.div 
              className="trophy w-40 h-40 mx-auto mb-12"
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🏆
            </motion.div>
            <h2 className="text-6xl font-black mb-6 gradient-text">Game Over!</h2>
            {winner && (
              <motion.div 
                className="glass p-12 rounded-3xl shadow-2xl mb-12"
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
              >
                <div className="text-7xl mb-6">🥇</div>
                <h3 className="text-4xl font-black text-accent-500 mb-4">{winner.displayName}</h3>
                <div className="score-badge text-4xl mx-auto w-32 h-32 flex items-center justify-center">
                  {winner.score}
                </div>
                <p className="text-xl text-slate-600 mt-4">Final Score</p>
              </motion.div>
            )}
            <div className="flex gap-4 justify-center">
              <motion.button 
                onClick={() => navigate('/')} 
                className="btn btn-accent btn-lg px-12 py-6 text-xl"
                whileHover={{ scale: 1.05 }}
              >
                New Game
              </motion.button>
              <motion.button 
                onClick={handleCopyLink} 
                className="btn btn-secondary btn-lg px-12 py-6 text-xl"
                whileHover={{ scale: 1.05 }}
              >
                Share Results
              </motion.button>
            </div>
          </motion.div>
        );

      default:
        return (
          <div className="glass p-12 rounded-3xl text-center shadow-2xl max-w-md mx-auto mt-32">
            <div className="animate-spin rounded-full h-24 w-24 border-b-2 border-primary-600 mx-auto mb-8"></div>
            <p className="text-2xl font-bold gradient-text">Loading Game...</p>
          </div>
        );
    }
  };

  return (
    <div className="h-screen">
      {renderContent()}
    </div>
  );
}
