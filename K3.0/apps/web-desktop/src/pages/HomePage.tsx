import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Palette, Users, Zap, Gamepad2, Sparkles, User, Eye, EyeOff, X, Loader2, ArrowRight 
} from 'lucide-react';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { useGameStore } from '../stores/gameStore';
import './HomePage.css';

const ParticleBackground = () => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 2,
  }));

  return (
    <div className="particle-container">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="particle"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            opacity: [0.2, 0.8, 0.2],
            scale: [1, 1.5, 1],
            y: [0, -20, 0],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

const FloatingElement = ({ 
  children, 
  delay = 0, 
  duration = 3, 
  yOffset = 20 
}: { 
  children: React.ReactNode; 
  delay?: number;
  duration?: number;
  yOffset?: number;
}) => (
  <motion.div
    animate={{
      y: [0, -yOffset, 0],
    }}
    transition={{
      duration,
      repeat: Infinity,
      ease: "easeInOut",
      delay,
    }}
  >
    {children}
  </motion.div>
);

const FeatureCard = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
  <motion.div 
    className="feature-card glass p-6 rounded-2xl border border-slate-200/50"
    whileHover={{ y: -8, scale: 1.05 }}
    transition={{ type: "spring", stiffness: 400 }}
  >
    <Icon className="w-12 h-12 text-primary-500 mb-4 opacity-75" />
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-slate-600 text-sm">{description}</p>
  </motion.div>
);

export default function HomePage() {
  const navigate = useNavigate();
  const { setUser, setCurrentRoom, setRooms } = useGameStore();
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await api.guestLogin(displayName || 'Guest');
      setUser(result.user);
      
      // Fetch rooms
      const roomsResult = await api.getRooms();
      setRooms(roomsResult.rooms);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await api.joinRoom(roomCode.trim().toUpperCase());
      setCurrentRoom(result.room);
      navigate(`/game/${roomCode.trim().toUpperCase()}`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to join room');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await api.createRoom(`${displayName || 'Player'}'s Room`);
      setCurrentRoom(result.room);
      navigate(`/game/${result.room.code}`);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Palette, title: 'Creative Drawing', description: 'Advanced tools and smooth canvas' },
    { icon: Users, title: 'Multiplayer Fun', description: 'Play with friends worldwide' },
    { icon: Zap, title: 'Real-time Sync', description: 'Lightning fast multiplayer' },
  ];

  const handleGuestQuick = () => {
    setShowGuestModal(true);
  };

  return (
    <div className="home-page relative min-h-screen overflow-hidden">
      <ParticleBackground />

      {/* Quick Room Join Bar */}
      <div className="glass fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl border border-white/30 z-30 max-w-md">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              className="input w-full bg-transparent border-none text-lg font-mono tracking-wider uppercase text-center"
              placeholder="Enter room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
          </div>
          <motion.button
            className="btn btn-primary px-6"
            onClick={handleJoinRoom}
            disabled={isLoading || !roomCode.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            Join
          </motion.button>
        </div>
      </div>
      
      <div className="hero container mx-auto px-6 pt-20 pb-32 lg:pb-20">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          {/* Hero Left */}
          <div className="flex-1 lg:max-w-lg">
            <motion.h1 
              className="hero-title gradient-text"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              Draw. Guess. <span className="text-accent-500">Win!</span>
            </motion.h1>
            
            <motion.p 
              className="hero-subtitle"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Jump into the most addictive drawing game. Sketch your way to victory with friends or strangers!
            </motion.p>

            <motion.div 
              className="hero-buttons flex flex-col sm:flex-row gap-4 mt-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <motion.button
                className="btn btn-primary btn-lg flex items-center gap-3"
                onClick={handleGuestQuick}
                disabled={isLoading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Gamepad2 size={24} />
                {isLoading ? 'Loading...' : 'Play as Guest'}
              </motion.button>
              
              <motion.button
                className="btn btn-accent btn-lg flex items-center gap-3"
                onClick={handleCreateRoom}
                disabled={isLoading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Sparkles size={24} />
                Create Room
              </motion.button>
            </motion.div>

            <div className="hero-features mt-12 flex flex-wrap gap-4">
              {features.map((feature, index) => (
                <FloatingElement key={index} delay={index * 0.2}>
                  <FeatureCard {...feature} />
                </FloatingElement>
              ))}
            </div>

            {/* Name Input for Guest */}
            <motion.div 
              className="glass p-6 rounded-2xl mt-8"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
            >
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Display Name (optional)
              </label>
              <div className="input-wrapper">
                <User className="input-icon" size={20} />
                <input
                  type="text"
                  className="input w-full pl-12"
                  placeholder="Your name here"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={20}
                />
              </div>
              {error && (
                <motion.div 
                  className="error-message mt-3 flex items-center gap-2 p-3 rounded-xl"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  ⚠️ {error}
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* Hero Visual Mock */}
          <motion.div 
            className="flex-1 max-w-md relative"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <div className="glass rounded-3xl p-8 shadow-2xl border-4 border-white/50">
              <div className="mock-canvas w-full h-64 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl relative mb-6 overflow-hidden shadow-inner">
                <motion.div 
                  className="mock-drawing absolute inset-0"
                >
                  <svg viewBox="0 0 300 200" className="w-full h-full">
                    <motion.path 
                      d="M 50 150 Q 100 100 150 120 Q 200 90 250 140" 
                      stroke="#0ea5e9" 
                      strokeWidth="5" 
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 2, delay: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                    />
                    <motion.circle 
                      cx="80" cy="80" r="8" 
                      fill="#f59e0b"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1, duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                    />
                  </svg>
                </motion.div>
                <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Live Session
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <Users size={14} className="text-slate-500" />
                  <span className="font-semibold text-slate-800">4/8 players</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <Zap size={14} className="text-slate-500" />
                  <span className="font-semibold text-slate-800">Round 2/10</span>
                </div>
                <div className="w-full bg-slate-200/50 rounded-full h-2 glass">
                  <div className="bg-gradient-to-r from-primary-400 to-accent-400 h-2 rounded-full glow animate-pulse-slow" style={{width: '75%'}} />
                </div>
                <div className="text-xs text-slate-500 text-center">
                  ???? ?????
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Guest Modal */}
      <AnimatePresence>
        {showGuestModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowGuestModal(false)}
          >
            <motion.div
              className="modal-content glass p-8 rounded-3xl shadow-2xl border border-white/30 max-w-sm"
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 30 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Gamepad2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                      Quick Play
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Join instantly as guest</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowGuestModal(false)} 
                  className="p-2 rounded-xl hover:bg-slate-100/50 transition-all flex-shrink-0"
                >
                  <X size={20} className="text-slate-400 hover:text-slate-600" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="input-wrapper relative">
                  <User className="input-icon" size={20} />
                  <input
                    type="text"
                    className="input w-full pl-12 pr-12 text-lg"
                    placeholder="Enter display name (optional)"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={20}
                  />
                  <span className="char-count absolute -bottom-6 right-4 text-xs text-slate-500">
                    {displayName.length}/20
                  </span>
                </div>
                
                {error && (
                  <motion.div 
                    className="bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-200/50 p-4 rounded-2xl flex items-start gap-3 backdrop-blur-sm"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div className="w-5 h-5 mt-0.5 text-red-500 flex-shrink-0">⚠️</div>
                    <span className="text-red-800 font-medium">{error}</span>
                  </motion.div>
                )}
                
                <div className="flex gap-3">
                  <motion.button
                    className="btn btn-secondary flex-1 h-14 rounded-2xl"
                    onClick={() => setShowGuestModal(false)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    className="btn btn-primary flex-1 h-14 rounded-2xl flex items-center justify-center gap-2"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isLoading ? (
                      <>
<Loader2 className="w-5 h-5 animate-spin" />
                        Connecting...
                      </>
                    ) : (

                      <>
                        <Zap size={20} />
                        Start Playing
                      </>
                    )}
                  </motion.button>
                </div>

                <div className="text-center py-4 border-t border-slate-200/50">
                  <p className="text-xs text-slate-500">
                    ⚡ Guest sessions expire in 24h • No data saved
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
