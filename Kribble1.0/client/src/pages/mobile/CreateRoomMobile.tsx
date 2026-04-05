import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Globe, Users, Clock, Trophy, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/Button';
import './CreateRoomMobile.css';



interface CreateRoomMobileProps {
  onClose: () => void;
}

const GAME_MODES = [
  { id: 'classic', name: 'Classic', icon: '🎨', desc: 'Draw & guess' },
  { id: 'speed', name: 'Speed', icon: '⚡', desc: 'Fast rounds' },
  { id: 'team', name: 'Teams', icon: '👥', desc: 'Team battle' },
];

const ROUND_TIMES = [
  { value: 60, label: '1 min' },
  { value: 90, label: '1.5 min' },
  { value: 120, label: '2 min' },
  { value: 180, label: '3 min' },
];

// Max limits for settings
const MAX_PLAYERS_LIMIT = 32;
const MIN_PLAYERS = 2;
const MAX_ROUNDS = 20;
const MIN_ROUNDS = 1;
const MAX_HINTS = 8;
const MIN_HINTS = 0;
const MAX_ROUND_TIME = 300;
const MIN_ROUND_TIME = 30;



export default function CreateRoomMobile({ onClose }: CreateRoomMobileProps) {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { createRoom, leaveRoom } = useGame();
  const { user } = useAuth();


  
  const [roomName, setRoomName] = useState(`${user?.username || 'Player'}'s Room`);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [roundTime, setRoundTime] = useState(80);
  const [rounds, setRounds] = useState(3);
  const [hints, setHints] = useState(3);
  const [gameMode, setGameMode] = useState('classic');

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: basic, 2: advanced

  // Increment/decrement helpers
  const increment = (value: number, max: number, step: number = 1) => Math.min(value + step, max);
  const decrement = (value: number, min: number, step: number = 1) => Math.max(value - step, min);

  // Listen for room creation response and navigate
  useEffect(() => {
    if (!socket) return;

    const handleRoomCreated = (response: { room?: { id: string }; userId?: string; isHost?: boolean }) => {
      if (response.room?.id) {
        setLoading(false);
        navigate(`/room/${response.room.id}`);
        onClose();
      }
    };


    socket.on('room:created', handleRoomCreated);
    return () => {
      socket.off('room:created', handleRoomCreated);
    };
  }, [socket, navigate, onClose]);

  const handleCreate = async (e: React.FormEvent) => {


    e.preventDefault();
    
    setLoading(true);
    
    // Clear any previous room associations first
    leaveRoom();
    
    const settings = {
      isPrivate,
      password: isPrivate ? password : undefined,
      maxPlayers,
      roundTime,
      rounds,
      hints,
      gameMode,
      categories: ['animals', 'food', 'objects', 'places', 'activities', 'fantasy'],
      wordCount: 3,
      language: 'English',
    };
    
    // Use GameContext's createRoom which properly initializes state
    createRoom(roomName, settings);
  };


  return (
    <motion.div 
      className="create-room-mobile-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="create-room-mobile-sheet"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="sheet-handle" onClick={onClose}></div>
        
        {/* Header */}
        <div className="create-room-header">
          <h2>Create Room</h2>
          <button className="close-icon-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="create-room-form">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="form-step"
              >
                {/* Room Name */}
                <div className="form-group-compact">
                  <label>Room Name</label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Enter room name"
                    maxLength={30}
                    className="room-name-input"
                  />
                </div>

                {/* Game Mode - Horizontal Scroll */}
                <div className="form-group-compact">
                  <label>Game Mode</label>
                  <div className="mode-scroll">
                    {GAME_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        className={`mode-card ${gameMode === mode.id ? 'active' : ''}`}
                        onClick={() => setGameMode(mode.id)}
                      >
                        <span className="mode-emoji">{mode.icon}</span>
                        <span className="mode-title">{mode.name}</span>
                        <span className="mode-desc">{mode.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Privacy Toggle */}
                <div className="form-group-compact">
                  <button
                    type="button"
                    className="privacy-row"
                    onClick={() => setIsPrivate(!isPrivate)}
                  >
                    <div className="privacy-icon-row">
                      {isPrivate ? (
                        <Lock size={20} className="icon-private" />
                      ) : (
                        <Globe size={20} className="icon-public" />
                      )}
                      <div className="privacy-text-row">
                        <span className="privacy-title">{isPrivate ? 'Private' : 'Public'}</span>
                        <span className="privacy-desc">{isPrivate ? 'Password required' : 'Anyone can join'}</span>
                      </div>
                    </div>
                    <div className={`toggle-pill ${isPrivate ? 'active' : ''}`}>
                      <div className="toggle-circle"></div>
                    </div>
                  </button>
                  
                  <AnimatePresence>
                    {isPrivate && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="password-wrapper"
                      >
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Set password"
                          className="password-input-compact"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Next Button */}
                <Button 
                  type="button" 
                  variant="primary" 
                  size="lg"
                  fullWidth
                  onClick={() => setStep(2)}
                  className="next-btn"
                >
                  Next <ChevronRight size={20} />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="form-step"
              >
                {/* Quick Settings */}
                <div className="form-group-compact">
                  <label>Settings</label>
                  <div className="settings-list">
                    {/* Players */}
                    <div className="setting-row">
                      <div className="setting-label">
                        <Users size={18} />
                        <span>Max Players</span>
                      </div>
                      <div className="stepper-control">
                        <button 
                          type="button" 
                          className="stepper-btn"
                          onClick={() => setMaxPlayers(prev => decrement(prev, MIN_PLAYERS))}
                          disabled={maxPlayers <= MIN_PLAYERS}
                        >
                          −
                        </button>
                        <span className="stepper-value">{maxPlayers}</span>
                        <button 
                          type="button" 
                          className="stepper-btn"
                          onClick={() => setMaxPlayers(prev => increment(prev, MAX_PLAYERS_LIMIT))}
                          disabled={maxPlayers >= MAX_PLAYERS_LIMIT}
                        >
                          +
                        </button>
                      </div>
                    </div>


                    {/* Round Time */}
                    <div className="setting-row">
                      <div className="setting-label">
                        <Clock size={18} />
                        <span>Round Time</span>
                      </div>
                      <div className="stepper-control">
                        <button 
                          type="button" 
                          className="stepper-btn"
                          onClick={() => setRoundTime(prev => decrement(prev, MIN_ROUND_TIME, 10))}
                          disabled={roundTime <= MIN_ROUND_TIME}
                        >
                          −
                        </button>
                        <span className="stepper-value">{roundTime}s</span>
                        <button 
                          type="button" 
                          className="stepper-btn"
                          onClick={() => setRoundTime(prev => increment(prev, MAX_ROUND_TIME, 10))}
                          disabled={roundTime >= MAX_ROUND_TIME}
                        >
                          +
                        </button>
                      </div>
                    </div>


                    {/* Rounds */}
                    <div className="setting-row">
                      <div className="setting-label">
                        <Trophy size={18} />
                        <span>Rounds</span>
                      </div>
                      <div className="stepper-control">
                        <button 
                          type="button" 
                          className="stepper-btn"
                          onClick={() => setRounds(prev => decrement(prev, MIN_ROUNDS))}
                          disabled={rounds <= MIN_ROUNDS}
                        >
                          −
                        </button>
                        <span className="stepper-value">{rounds}</span>
                        <button 
                          type="button" 
                          className="stepper-btn"
                          onClick={() => setRounds(prev => increment(prev, MAX_ROUNDS))}
                          disabled={rounds >= MAX_ROUNDS}
                        >
                          +
                        </button>
                      </div>
                    </div>


                    {/* Hints */}
                    <div className="setting-row">
                      <div className="setting-label">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 16v-4M12 8h.01"/>
                        </svg>
                        <span>Hints</span>
                      </div>
                      <div className="stepper-control">
                        <button 
                          type="button" 
                          className="stepper-btn"
                          onClick={() => setHints(prev => decrement(prev, MIN_HINTS))}
                          disabled={hints <= MIN_HINTS}
                        >
                          −
                        </button>
                        <span className="stepper-value">{hints}</span>
                        <button 
                          type="button" 
                          className="stepper-btn"
                          onClick={() => setHints(prev => increment(prev, MAX_HINTS))}
                          disabled={hints >= MAX_HINTS}
                        >
                          +
                        </button>
                      </div>
                    </div>

                  </div>
                </div>


                {/* Summary */}
                <div className="room-summary">
                  <div className="summary-item">
                    <span className="summary-label">Mode</span>
                    <span className="summary-value">{GAME_MODES.find(m => m.id === gameMode)?.name}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Privacy</span>
                    <span className="summary-value">{isPrivate ? 'Private' : 'Public'}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Hints</span>
                    <span className="summary-value">{hints}</span>
                  </div>
                </div>


                {/* Action Buttons */}
                <div className="action-buttons">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="lg"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    size="lg"
                    loading={loading}
                  >
                    Create
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </motion.div>
    </motion.div>
  );
}
