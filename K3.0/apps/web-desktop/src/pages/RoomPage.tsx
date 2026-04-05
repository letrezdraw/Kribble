import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Zap, Crown, CheckCircle, Clock, Share2, X, CrownOff } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { socketService } from '../services/socket';
import { api } from '../services/api';
import './RoomPage.css';

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentRoom, user, setCurrentRoom, updateRoom, setGamePhase } = useGameStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }

    const loadRoom = async () => {
      try {
        const result = await api.getRoom(code);
        setCurrentRoom(result.room);
        socketService.setActiveRoomCode(code);
        socketService.send({ type: 'room:join', code });
      } catch (err: any) {
        setError(err.message || 'Room not found');
      } finally {
        setIsLoading(false);
      }
    };

    loadRoom();

    // Set up socket listeners
    const unsubRoomUpdated = socketService.on('room:updated', (data) => {
      updateRoom(data.room);
    });

    const unsubGamePhase = socketService.on('game:phase', (data) => {
      setGamePhase(data.phase);
      if (data.phase === 'drawing' || data.phase === 'guessing') {
        navigate(`/game/${code}`);
      }
    });

    const unsubPlayerJoined = socketService.on('player:joined', () => {
      // Refresh room
      api.getRoom(code!).then((result) => {
        setCurrentRoom(result.room);
      });
    });

    // Countdown timer if in waiting phase
    const interval = setInterval(() => {
      if (currentRoom?.status === 'waiting') {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 60));
      }
    }, 1000);

    return () => {
      socketService.setActiveRoomCode(null);
      unsubRoomUpdated();
      unsubGamePhase();
      unsubPlayerJoined();
      clearInterval(interval);
    };
  }, [code, navigate]);

  const handleLeaveRoom = async () => {
    try {
      await api.leaveRoom(code!);
      setCurrentRoom(null);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to leave room');
    }
  };

  const handleReady = async () => {
    try {
      await api.setReady(code!, true);
    } catch (err: any) {
      setError(err.message || 'Failed to set ready');
    }
  };

  const handleStartGame = () => {
    socketService.send({
      type: 'game:start',
      roomCode: code,
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${currentRoom?.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 relative">
        <ParticleBackground />
        <motion.div 
          className="glass p-12 rounded-3xl text-center shadow-2xl max-w-md"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <motion.div 
            className="w-20 h-20 border-4 border-primary-200 border-t-primary-500 rounded-full mx-auto mb-6 animate-spin"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <h2 className="text-2xl font-bold mb-2 gradient-text">Joining Room</h2>
          <p className="text-slate-500">Getting ready for some drawing fun...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <motion.div 
          className="glass p-12 rounded-3xl text-center shadow-2xl max-w-md"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Room Not Found</h2>
          <p className="text-slate-500 mb-8">{error}</p>
          <motion.button 
            onClick={() => navigate('/')} 
            className="btn btn-primary px-8 py-3 rounded-xl text-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            Back to Home
          </motion.button>
        </motion.div>
      </div>
    );
  }

  const isHost = currentRoom.players[0]?.userId === user?.id;
  const allReady = currentRoom.players.every((p) => p.isReady);
  const minPlayers = 2;
  const readyCount = currentRoom.players.filter(p => p.isReady).length;

  return (
    <div className="room-page pt-20 pb-20 relative">
      <div className="room-hero">
        <div className="room-hero-bg" />
        <motion.div 
          className="glass text-center p-12 rounded-3xl shadow-2xl border border-white/40 max-w-4xl mx-auto"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.h1 
            className="text-5xl lg:text-6xl font-black bg-gradient-to-r from-slate-800 via-slate-600 to-slate-400 bg-clip-text text-transparent mb-6"
            initial={{ y: 30 }}
            animate={{ y: 0 }}
          >
            {currentRoom.name}
          </motion.h1>
          <motion.div 
            className="flex items-center gap-6 justify-center mb-8 text-2xl"
            initial={{ y: 30 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2">
              <Users className="text-slate-500" />
              <span className="font-bold text-slate-800">{currentRoom.players.length}/{currentRoom.maxPlayers}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="text-slate-500" />
              <span className="font-bold text-slate-800">{timeLeft}s</span>
            </div>
          </motion.div>
          <div className="countdown w-32 h-32 mx-auto">
            <div className="countdown-inner">
              {readyCount}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="container mx-auto px-6 -mt-16">
        {/* Main Room Card */}
        <motion.div 
          className="room-header"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl lg:text-4xl font-black mb-2 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                {currentRoom.name}
              </h1>
              <div className="flex items-center gap-6 text-sm text-slate-600">
                <div className="flex items-center gap-1">
                  <span className="font-mono text-lg tracking-wider bg-slate-100 px-3 py-1 rounded-full">
                    {currentRoom.code}
                  </span>
                </div>
                {isHost && (
                  <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                    <Crown size={16} />
                    Host
                  </div>
                )}
              </div>
            </div>
            <motion.button 
              onClick={handleLeaveRoom} 
              className="btn btn-secondary px-8 py-3 h-fit whitespace-nowrap"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <X size={20} className="inline mr-2" />
              Leave Room
            </motion.button>
          </div>

          {/* Players Grid */}
          <div className="player-list mb-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              Players 
              <span className="text-lg text-slate-500 font-normal">({currentRoom.players.length}/{currentRoom.maxPlayers})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentRoom.players.map((player, index) => (
                <motion.div
                  key={player.id}
                  className="player-card glass p-6 rounded-2xl border border-slate-200/30 hover:shadow-2xl transition-all duration-300 cursor-default"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                >
                  <div className="flex items-center gap-4">
                    <div className="avatar relative" style={{ backgroundColor: `hsl(${index * 137}, 70%, 85%)` }}>
                      {player.id === user?.id && (
                        <div className="host-crown">
                          {index === 0 ? '👑' : '⭐'}
                        </div>
                      )}
                      <span>{player.displayName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-lg truncate" title={player.displayName}>
                        {player.displayName}
                      </div>
                      <div className="text-sm text-slate-500">
                        Score: <span className="font-mono">{player.score}</span>
                      </div>
                      {player.isDrawer && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-accent-100 text-accent-800 rounded-full text-xs mt-1 font-medium">
                          ✏️ Drawer
                        </div>
                      )}
                    </div>
                    <motion.div 
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${player.isReady ? 'ready-badge shadow-lg' : 'not-ready-badge'}`}
                      animate={player.isReady ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >
                      {player.isReady ? 'Ready' : 'Waiting'}
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Status Banner */}
          {currentRoom.players.length < minPlayers && (
            <motion.div 
              className="waiting-banner p-6 rounded-3xl mb-8 text-center shadow-xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="text-4xl mb-4">⏳</div>
              <h3 className="text-xl font-bold text-yellow-800 mb-2">
                Waiting for Players
              </h3>
              <p className="text-lg text-yellow-900">
                Need <strong>{minPlayers - currentRoom.players.length}</strong> more player(s)
              </p>
              <motion.div 
                className="countdown mt-6 mx-auto"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                <div className="countdown-inner pulse-ready">
                  {timeLeft}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="action-buttons gap-4 mb-8">
            {!user?.isGuest && (
              <motion.button 
                onClick={handleReady} 
                className="btn btn-primary btn-ready shadow-xl hover:shadow-2xl"
                disabled={isLoading}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <CheckCircle size={24} className="mr-2" />
                I'm Ready
              </motion.button>
            )}
            
            {isHost && currentRoom.players.length >= minPlayers && (
              <motion.button
                onClick={handleStartGame}
                disabled={!allReady}
                className={`btn btn-start shadow-xl ${!allReady ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-2xl'}`}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <Zap size={24} className="mr-2" />
                {allReady ? 'Start Game!' : `${readyCount}/${currentRoom.players.length} Ready`}
              </motion.button>
            )}
          </div>

          {/* Share Link */}
          <motion.div 
            className="share-section"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
              <Share2 size={24} />
              Invite Friends
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/room/${currentRoom.code}`}
                className="input flex-1 bg-slate-50/50"
                onFocus={(e) => e.target.select()}
              />
              <motion.button
                onClick={handleCopyLink}
                className="btn btn-secondary copy-btn"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </motion.button>
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              Share this link with friends to join instantly
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
